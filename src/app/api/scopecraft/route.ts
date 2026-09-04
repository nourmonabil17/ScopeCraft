// src/app/api/scopecraft/route.ts
//
// AI & Backend endpoint (owner: Youssef) — Module 4.
//
// Security boundary. Everything cheap and local happens before anything expensive
// and remote, and the ordering is the security property:
//
//   0.  session check      401  no reason to read a body from an anonymous caller
//   1.  size cap           413
//   2.  JSON parse         400
//   3.  schema             422
//   4.  clarification      422
//   4b. daily quota        429  one DB round trip, after every free local check
//   4c. cache lookup            a second round trip that can skip step 5 entirely
//   5.  generate                the only expensive step
//   6.  persist the outcome
//
// A malformed request from a signed-in caller still costs zero provider tokens
// *and* zero database round trips. Do not reorder these.
//
// Error discipline. Every failure is mapped to a typed code and a user-safe
// message. Messages never contain provider names, model IDs, stack traces,
// request payloads, or credentials. Logs carry the error code and status only —
// never the request body and never a raw Error object, since a provider error's
// message can contain the request URL and therefore a key.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { recordPlan, requestHash } from "@/lib/plans";
import { mapGenerationError } from "@/lib/api-errors";
import { checkDailyQuota } from "@/lib/quota";
import {
  getClarification,
  MAX_REQUEST_BODY_BYTES,
  normalizeRequestInput,
  RequestSchema,
  type ScopeCraftError,
  type ValidationIssue,
} from "@/lib/scopecraft/schema";
import {
  PROMPT_VERSION,
  runScopeCraft,
} from "@/lib/scopecraft/service";
import { ProviderError } from "@/lib/ai/providers";

export const runtime = "nodejs";

// Stated explicitly rather than left to the platform default, because the
// default is invisible from inside the repository and this route is the one that
// waits on a provider chain. It must stay ABOVE the chain's total budget
// (AI_TOTAL_BUDGET_MS, 50 s by default) with room for validation and the
// database write: if the platform kills the function first, the caller gets the
// platform's untyped 504 instead of this app's TIMEOUT envelope, and "every
// failure carries a code" stops being true.
//
// Hosting plans cap this. If the deploy target's ceiling is lower than 60, lower
// the budget to match rather than raising this number.
export const maxDuration = 60;

/** Sanitized server log. Code and status only — never payloads or credentials. */
function logFailure(code: string, status: number): void {
  console.error(`scopecraft.request_failed code=${code} status=${status}`);
}

/**
 * One line per generation that reached a provider (Module B2).
 *
 * WHY logfmt AND NOT JSON. Five other log lines in this codebase already use
 * `scopecraft.<event> key=value` — request_failed above, persist_failed and
 * quota_unavailable below, dependencies_dropped in the service. A JSON line
 * would be no more machine-readable in practice and would mean this file emits
 * two formats, so anything reading the logs has to handle both. Matching the
 * existing shape is worth more than the format being fashionable.
 *
 * WHY IT DUPLICATES THE DATABASE ROW. Almost every field here is also written
 * to `plans`, and the row is the better record — it is queryable and it is
 * kept. This line exists for the one case the row cannot cover: when the insert
 * itself fails. `recordPlan` deliberately never throws, so a persistence outage
 * is otherwise invisible in the data, and the generation it silently dropped is
 * the one you most want to know about.
 *
 * WHAT IS NOT HERE. No idea text, no constraints, no response, no user id. The
 * first three are user data and the fourth identifies a person; none of them is
 * needed to answer a latency or failover question, and a server log is not
 * scoped to one request or one reader.
 */
function logGeneration(fields: {
  status: "ok" | "failed";
  durationMs: number;
  attempts: number | null;
  providerUsed?: string;
  errorCode?: string;
  persisted: boolean;
}): void {
  console.log(
    `scopecraft.generation status=${fields.status} ` +
      `duration_ms=${fields.durationMs} ` +
      `attempts=${fields.attempts ?? "unknown"} ` +
      `provider=${fields.providerUsed ?? "none"} ` +
      `prompt=${PROMPT_VERSION} ` +
      `code=${fields.errorCode ?? "none"} ` +
      `persisted=${fields.persisted}`
  );
}

function fail(
  code: ScopeCraftError["code"],
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  if (status >= 500) logFailure(code, status);
  const body: ScopeCraftError = { error: true, code, message };
  return NextResponse.json({ ...body, ...extra }, { status });
}

async function readLimitedBody(
  req: NextRequest
): Promise<{ text: string; tooLarge: boolean }> {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return { text: "", tooLarge: true };
  }

  if (!req.body) return { text: "", tooLarge: false };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      return { text: "", tooLarge: true };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(body), tooLarge: false };
}

export async function POST(req: NextRequest) {
  // ---- 0. Session. Before the body is touched. ----
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return fail("UNAUTHORIZED", "Please sign in to generate a plan.", 401);
  }

  // ---- 1. Size cap (before reading anything into memory) ----
  let body: unknown;
  try {
    const requestBody = await readLimitedBody(req);
    if (requestBody.tooLarge) {
      return fail("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }
    // ---- 2. Syntax ----
    body = JSON.parse(requestBody.text);
  } catch {
    return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  // ---- 3. Schema. Still no provider module has been touched. ----
  const parsed = RequestSchema.safeParse(normalizeRequestInput(body));
  if (!parsed.success) {
    // Only path and message are forwarded. Zod's `received`/`input` fields are
    // deliberately dropped so a rejected request can never echo user data back.
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    return fail(
      "VALIDATION_ERROR",
      "Some fields need attention before a plan can be generated.",
      422,
      { issues }
    );
  }

  // ---- 4. Domain clarification (local heuristic, still no provider call) ----
  const clarification = getClarification(parsed.data);
  if (clarification) {
    return fail(
      "CLARIFICATION_REQUIRED",
      "Please clarify the product idea before generating a plan.",
      422,
      { questions: clarification.questions }
    );
  }

  // ---- 4b. Daily budget. The first database round trip, and the last check
  //           before anything costs provider tokens. ----
  //
  // FAILS CLOSED, deliberately. If the quota store is unreachable the budget
  // cannot be enforced, and generating anyway would mean "when the database is
  // down, this endpoint is unmetered" — which is precisely the property the
  // session check and the budget exist to remove. An outage would become a way
  // to spend provider quota without limit. Refusing is worse UX for a rare
  // failure and better behaviour for the thing being protected.
  let quota;
  try {
    quota = await checkDailyQuota(userId);
  } catch (error) {
    logFailure("STORAGE_UNAVAILABLE", 503);
    console.error(
      `scopecraft.quota_unavailable reason=${error instanceof Error ? error.name : "unknown"}`
    );
    return fail(
      "STORAGE_UNAVAILABLE",
      "Plans cannot be generated right now. Please try again shortly.",
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

  // ---- 4c. Cache. The second database round trip, and the last chance to
  //           avoid spending provider tokens at all. ----
  //
  // AFTER the quota, deliberately. A lookup in front of it would let a caller
  // replay a request without the budget ever seeing it, which is a hole in the
  // thing the budget exists to close. The ordering costs one count query on a
  // hit and buys "no path through this route skips the meter".
  //
  // The stored response is returned as-is rather than re-validated. It was
  // schema-checked by Zod on the way in and its deterministic fields were
  // already overwritten server-side before it was stored, so re-running either
  // would only be able to agree with itself.
  //
  // Skipped entirely when the caller asked for a second opinion. Note the short
  // circuit is on the LOOKUP, not on the result: querying and then discarding
  // the answer would spend a round trip to learn nothing. `bypass_cache` is
  // read here rather than anywhere earlier so that no path past the meter above
  // can be opened by setting it.
  const cached = parsed.data.bypass_cache
    ? null
    : await findCachedPlan(userId, requestHash(parsed.data));
  if (cached) {
    // duration_ms = 0 and attempts = 0 are both literally true: the generate
    // step did not run and no provider was called. Zero is what separates these
    // rows from NULL ("not recorded") in the B2 columns, so a latency or
    // failover query over `plans` has to say `where attempts > 0`.
    const planId = await recordPlan(userId, parsed.data, {
      status: "ok",
      response: cached.response,
      providerUsed: cached.provider_used ?? undefined,
      promptVersion: PROMPT_VERSION,
      durationMs: 0,
      attempts: 0,
    });

    // No new log key for the hit: `duration_ms=0 attempts=0` on a status=ok line
    // already says a plan was served without calling anything.
    logGeneration({
      status: "ok",
      durationMs: 0,
      attempts: 0,
      providerUsed: cached.provider_used ?? undefined,
      persisted: planId !== null,
    });

    return NextResponse.json(cached.response, {
      status: 200,
      headers: {
        "X-Provider-Used": cached.provider_used ?? "unknown",
        "X-Prompt-Version": PROMPT_VERSION,
        "X-Cache": "hit",
        // The NEW row's id, not the cached row's. The board is saved against the
        // plan the caller is looking at; handing back the older id would let an
        // edit made here overwrite the board of the original plan.
        ...(planId ? { "X-Plan-Id": planId } : {}),
      },
    });
  }

  // ---- 5. Generate ----
  //
  // The clock starts here and not at the top of the handler, so `duration_ms`
  // measures the provider chain and the deterministic tools rather than the
  // session lookup, the validation and the quota query in front of them. Those
  // are bounded and cheap; mixing them in would blur the number that is
  // actually worth watching.
  const startedAt = Date.now();
  try {
    const { data, providerUsed, promptVersion, attempts } = await runScopeCraft(parsed.data);
    const durationMs = Date.now() - startedAt;

    // ---- 6. Record the success. ----
    const planId = await recordPlan(userId, parsed.data, {
      status: "ok",
      response: data,
      providerUsed,
      promptVersion,
      durationMs,
      attempts,
    });

    logGeneration({
      status: "ok",
      durationMs,
      attempts,
      providerUsed,
      persisted: planId !== null,
    });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Provider-Used": providerUsed,
        "X-Prompt-Version": promptVersion,
        // "bypass" is not a miss. A miss says the table was searched and had
        // nothing; on this path it was never searched, and collapsing the two
        // would make the cache look like it was failing to hit when it was
        // never asked. Only "hit" is a claim the client renders, so both read
        // as "no cache label" there.
        "X-Cache": parsed.data.bypass_cache ? "bypass" : "miss",
        // A header rather than a body field: the body is a validated Zod
        // contract that the model's output has to satisfy, and an id is not
        // part of the plan. It travels the same way the other two provenance
        // values already do. Empty when persistence failed, which the client
        // reads as "editing works, saving does not".
        ...(planId ? { "X-Plan-Id": planId } : {}),
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failure = mapGenerationError(error);
    const errorCode = failure.code;

    // Known only when the chain itself gave up. A SchemaViolationError or a
    // PlanningError means a provider DID answer and the failure came after it,
    // so the count is not on the error and is recorded as unknown rather than
    // guessed at — a wrong number here would be worse than a missing one,
    // because it would average into the failover statistics as if it were real.
    const attempts = error instanceof ProviderError ? error.attempts ?? null : null;

    // ---- 6. Record the failure too. ----
    // Only failures that got this far are recorded, and every one of them
    // reached a provider — the 4xx paths above return long before here. That is
    // what makes counting attempts fair: a malformed request still costs the
    // caller nothing, while a generation that burned tokens and then failed
    // counts against the quota.
    const planId = await recordPlan(userId, parsed.data, {
      status: "failed",
      errorCode,
      durationMs,
      attempts: attempts ?? undefined,
    });

    logGeneration({
      status: "failed",
      durationMs,
      attempts,
      errorCode,
      persisted: planId !== null,
    });

    return fail(failure.code, failure.message, failure.status);
  }
}

interface CachedPlan {
  response: unknown;
  provider_used: string | null;
}

/**
 * The plan the caller kept for an identical request, or failing that their most
 * recent one, or null.
 *
 * The ordering is not incidental. A caller can hold two plans for one question —
 * an identical request generated a second time on purpose — and mark one as the
 * one they are keeping. Ordering by `created_at` alone would then hand back the
 * plan they rejected, and only on the THIRD request, long after the choice was
 * made. `nulls last` is what keeps that from also demoting the ordinary case:
 * every plan nobody has chosen between has `chosen_at` null, and those still
 * order newest-first among themselves.
 *
 * Scoped to one user. A global cache would hit more often and save more tokens,
 * but it turns response time into an oracle: a fast answer would tell you that
 * somebody else has already generated that exact idea.
 *
 * `prompt_version` is matched rather than ignored — a plan generated under v7 is
 * not the answer a v8 request would get, and serving it would silently freeze
 * the prompt for every caller who had asked before. Failed rows are excluded
 * because the table keeps them on purpose and an error is not a cached answer.
 *
 * Never throws, for the same reason recordPlan does not: a cache is an
 * optimisation. If the lookup fails, the request generates normally — which is
 * exactly what it did before this stage existed.
 */
async function findCachedPlan(userId: string, hash: string): Promise<CachedPlan | null> {
  try {
    // ponytail: no dedicated index. The lookup rides the user_id prefix of
    // plans_user_created_idx and then filters one caller's rows, which the daily
    // quota bounds to 20 a day. Add `(user_id, request_hash)` if a user's
    // history ever grows to where that scan shows up in a query plan.
    const [row] = await sql<CachedPlan[]>`
      select response, provider_used
      from plans
      where user_id = ${userId}
        and request_hash = ${hash}
        and status = 'ok'
        and response is not null
        and prompt_version = ${PROMPT_VERSION}
      order by chosen_at desc nulls last, created_at desc
      limit 1`;
    return row ?? null;
  } catch (error) {
    // Not `logFailure`: nothing failed for the caller, and counting it as a
    // request failure would make the route look like it was rejecting people.
    console.error(
      `scopecraft.cache_unavailable reason=${error instanceof Error ? error.name : "unknown"}`
    );
    return null;
  }
}
