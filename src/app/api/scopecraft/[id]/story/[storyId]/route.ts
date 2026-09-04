// src/app/api/scopecraft/[id]/story/[storyId]/route.ts
//
// Rewriting one story of an existing plan (owner: Yousef).
//
// WHY A NEW ROW AND NOT AN UPDATE. `plans.response` is what the model produced.
// Overwriting it would destroy the record of the first answer, which is the
// thing `plans.board` is a separate column to protect. The rewrite is a new
// plan that knows its parent (`derived_from`), so both survive and it stays
// possible to say which came from which.
//
// WHY THE WHOLE PLAN IS RECOMPUTED. A rewritten story almost always changes its
// points, and points decide what fits the sprint — so one story moving re-sorts
// the backlog and can push a different story out. Patching the one field would
// leave `sprint_plan` describing a backlog that no longer exists. The recompute
// runs through `applyDeterministicTools`, the same function the full generation
// uses, so the two cannot disagree.
//
// IT SPENDS PROVIDER TOKENS, so it goes through the daily meter exactly like the
// generate route, and records a row whether it succeeds or fails.

// CSRF, recorded rather than inherited. This is a bodiless POST, which makes it
// a CORS-simple request a cross-site form can send with no preflight, and what
// stops that today is the session cookie's SameSite=Lax default. The choose
// route accepted the same shape because the worst case there was flipping a
// preference; here it is up to a day's quota spent on the victim's account, so
// the acceptance rests on something narrower: the attacker also needs the
// plan's uuid, which is v4 and not guessable. If `cookies` is ever configured
// in src/auth.ts, this route needs an origin check before that one does.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { checkDailyQuota } from "@/lib/quota";
import { recordPlan } from "@/lib/plans";
import { mapGenerationError } from "@/lib/api-errors";
import { regenerateStory, STORY_PROMPT_VERSION } from "@/lib/scopecraft/service";
import {
  ScopeCraftResponseSchema,
  type ScopeCraftError,
  type ScopeCraftRequest,
} from "@/lib/scopecraft/schema";
import { ProviderError } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(
  code: ScopeCraftError["code"],
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({ error: true, code, message, ...extra }, { status });
}

interface ParentRow {
  idea: string;
  constraints: string | null;
  capacity_points: number;
  sprint_days: number;
  response: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; storyId: string }> }
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return fail("UNAUTHORIZED", "Please sign in to rewrite a story.", 401);
  }

  const { id, storyId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  // Ownership is a predicate, never a read-then-check, and a foreign row is
  // reported as absent so ids cannot be enumerated.
  const [parent] = await sql<ParentRow[]>`
    select idea, constraints, capacity_points, sprint_days, response
    from plans
    where id = ${id} and user_id = ${userId} and status = 'ok'`;

  if (!parent) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  // Re-validated on read for the same reason the saved-plan page does it: the
  // column is jsonb and a row written under an older contract is not something
  // to hand to the planner.
  const plan = ScopeCraftResponseSchema.safeParse(parent.response);
  if (!plan.success) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  // `storyId` is the only value here that came from the URL. It is never
  // interpolated into a query or a prompt — it is compared against ids this
  // server wrote, and only the matching stored story is ever sent onward.
  if (!plan.data.user_stories.some((story) => story.id === storyId)) {
    return fail("NOT_FOUND", "Unknown story.", 404);
  }

  // The meter, before any provider is reached. Fails closed: if the budget
  // cannot be read it is not spent.
  let quota;
  try {
    quota = await checkDailyQuota(userId);
  } catch (error) {
    console.error(
      `scopecraft.quota_unavailable reason=${error instanceof Error ? error.name : "unknown"}`
    );
    return fail(
      "STORAGE_UNAVAILABLE",
      "Stories cannot be rewritten right now. Please try again shortly.",
      503
    );
  }
  if (quota.exceeded) {
    return fail(
      "RATE_LIMITED",
      `You have reached the limit of ${quota.limit} plans per day. Please try again tomorrow.`,
      429,
      { limit: quota.limit, used: quota.used }
    );
  }

  // Rebuilt rather than stored: these four fields are what the request was, and
  // hashing them reproduces the parent's `request_hash` exactly — which is what
  // files the rewrite under the same question as the plan it came from.
  const request: ScopeCraftRequest = {
    idea: parent.idea,
    constraints: parent.constraints ?? undefined,
    team_capacity_points: parent.capacity_points,
    sprint_length_days: parent.sprint_days,
  };

  const startedAt = Date.now();
  try {
    const { data, providerUsed, attempts } = await regenerateStory(
      plan.data,
      storyId,
      parent.capacity_points
    );

    const planId = await recordPlan(userId, request, {
      status: "ok",
      response: data,
      providerUsed,
      promptVersion: STORY_PROMPT_VERSION,
      durationMs: Date.now() - startedAt,
      attempts,
      derivedFrom: id,
    });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Provider-Used": providerUsed,
        "X-Prompt-Version": STORY_PROMPT_VERSION,
        ...(planId ? { "X-Plan-Id": planId } : {}),
      },
    });
  } catch (error) {
    const failure = mapGenerationError(error);

    // Recorded like any other failed generation: it reached a provider, so it
    // cost tokens, so it counts. Not recording it would make failure the cheap
    // way to use this endpoint.
    await recordPlan(userId, request, {
      status: "failed",
      errorCode: failure.code,
      durationMs: Date.now() - startedAt,
      attempts: error instanceof ProviderError ? error.attempts ?? undefined : undefined,
      derivedFrom: id,
    });

    return fail(failure.code, failure.message, failure.status);
  }
}
