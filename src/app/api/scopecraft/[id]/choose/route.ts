// src/app/api/scopecraft/[id]/choose/route.ts
//
// Recording which of two plans the human kept (owner: Yousef).
//
// WHY THIS IS NOT A THIRD BRANCH OF THE [id] PATCH HANDLER. That handler writes
// `board` and is pinned by a test asserting its SQL never contains the word
// `response`. The assertion is cheap to keep only because the statement it
// guards does exactly one thing; widening it to also carry a "choose" action
// would weaken the check that protects the product's trust boundary in order to
// save a file. A separate route keeps that statement single-purpose.
//
// WHAT THIS WRITES. `chosen_at`, and nothing else. It records a decision ABOUT
// a plan and must never be able to edit the plan itself — neither the model's
// output nor the human's board edits.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import type { ScopeCraftError } from "@/lib/scopecraft/schema";

export const runtime = "nodejs";

function fail(
  code: ScopeCraftError["code"],
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: true, code, message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Same ordering discipline as the other two routes: session, then the shape
  // of the id, and only then the database.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return fail("UNAUTHORIZED", "Please sign in to keep a plan.", 401);
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  // No body is read. There is nothing to say beyond which plan, and the id is
  // already in the path — so there is no payload to size-cap, parse or validate,
  // and no way for a body to influence what gets written.
  //
  // ONE STATEMENT, DELIBERATELY. Marking the winner and clearing the previous
  // one are halves of a single fact: exactly one plan per question is kept. Run
  // as two statements, a failure between them leaves either two plans claiming
  // to be kept or none, and `findCachedPlan` then picks between them by date —
  // silently serving the plan the user rejected.
  //
  // The target is excluded from the clearing arm (`id <>`), because one
  // statement updating the same row twice is undefined behaviour, not a
  // last-write-wins.
  //
  // `cleared` is never selected from, and does not need to be: a data-modifying
  // CTE in Postgres runs exactly once and to completion whether or not the
  // primary query reads its output.
  //
  // TWO KNOWN LIMITS, both found by review and both left as they are.
  //
  // A row whose `request_hash` is NULL — every plan generated before A3 added
  // the column — clears no siblings, because `= NULL` is NULL and matches
  // nothing. Two such rows can therefore both end up marked. Harmless, and not
  // worth code: pairing is BY hash, so a row without one has no sibling to be
  // chosen against, and `findCachedPlan` never serves a NULL-hash row.
  //
  // This is a bodiless POST, which makes it a CORS-simple request: a cross-site
  // form can send it with no preflight. What stops that today is the session
  // cookie's SameSite=Lax default, which is Auth.js's and is not pinned in
  // src/auth.ts. Accepted because the worst outcome is flipping which of a
  // signed-in user's own plans is marked as kept. If a custom `cookies` config
  // ever sets sameSite: "none", this endpoint needs an origin check first.
  //
  // Ownership is a predicate on every arm, never a read-then-check. A row
  // belonging to someone else matches nothing, `returning` comes back empty,
  // and the caller is told the plan does not exist rather than that it is
  // forbidden — so this cannot be used to find out which ids are real.
  const rows = await sql<{ id: string }[]>`
    with target as (
      select request_hash from plans
      where id = ${id} and user_id = ${userId}
    ), cleared as (
      update plans set chosen_at = null
      where user_id = ${userId}
        and chosen_at is not null
        and id <> ${id}
        and request_hash = (select request_hash from target)
    )
    update plans set chosen_at = now()
    where id = ${id} and user_id = ${userId}
    returning id`;

  if (rows.length === 0) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  return new NextResponse(null, { status: 204 });
}
