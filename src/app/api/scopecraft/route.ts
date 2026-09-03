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
import { checkDailyQuota } from "@/lib/quota";
import {
  constraintsToText,
  getClarification,
  MAX_REQUEST_BODY_BYTES,
  normalizeRequestInput,
  RequestSchema,
  type ScopeCraftError,
  type ScopeCraftRequest,
  type ValidationIssue,
} from "@/lib/scopecraft/schema";
import {
  OutOfDomainError,
  PlanningError,
  PROMPT_VERSION,
  SchemaViolationError,
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
    const response = mapGenerationError(error);
    const errorCode = await readErrorCode(response);

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

    return response;
  }
}

interface PlanOutcome {
  status: "ok" | "failed";
  response?: unknown;
  errorCode?: string;
  providerUsed?: string;
  promptVersion?: string;
  durationMs?: number;
  /** Omitted rather than zeroed when the count is not knowable — see the catch
   *  block above. Null in the column means "not recorded", not "no providers". */
  attempts?: number;
}

/**
 * Persists one generation attempt. Returns the new row's id, or null if the
 * write failed.
 *
 * Never throws. A failed bookkeeping write must not destroy a plan the user
 * already waited for and already paid provider tokens for — the request
 * succeeded, and the only thing lost is a row. The failure is logged so it is
 * visible rather than silent, but the caller's result is returned regardless.
 * The cost of that choice is honest: a persistence outage under-counts the
 * quota for as long as it lasts, and the board cannot be saved for that plan.
 */
async function recordPlan(
  userId: string,
  request: ScopeCraftRequest,
  outcome: PlanOutcome
): Promise<string | null> {
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into plans (user_id, idea, constraints, capacity_points, sprint_days,
                         status, error_code, response, provider_used, prompt_version,
                         duration_ms, attempts)
      values (${userId},
              ${request.idea},
              ${constraintsToText(request.constraints) ?? null},
              ${request.team_capacity_points},
              ${request.sprint_length_days},
              ${outcome.status},
              ${outcome.errorCode ?? null},
              ${outcome.response ? sql.json(outcome.response as never) : null},
              ${outcome.providerUsed ?? null},
              ${outcome.promptVersion ?? null},
              ${outcome.durationMs ?? null},
              ${outcome.attempts ?? null})
      returning id`;
    return row?.id ?? null;
  } catch (error) {
    // Deliberately not `logFailure`: this is not a request failure, and
    // conflating the two would make the quota look like it was rejecting
    // people. No connection string, no request body.
    console.error(
      `scopecraft.persist_failed status=${outcome.status} ` +
        `reason=${error instanceof Error ? error.name : "unknown"}`
    );
    return null;
  }
}

/** Reads the typed code back off a response we just built, without consuming it. */
async function readErrorCode(response: NextResponse): Promise<string> {
  try {
    const body = (await response.clone().json()) as Partial<ScopeCraftError>;
    return body.code ?? "PROVIDER_ERROR";
  } catch {
    return "PROVIDER_ERROR";
  }
}

function mapGenerationError(error: unknown): NextResponse {
  if (error instanceof OutOfDomainError) {
    return fail(
      "OUT_OF_DOMAIN",
      "ScopeCraft only plans software products.",
      422
    );
  }

  if (error instanceof PlanningError) {
    return fail(
      "PLANNING_ERROR",
      "The generated stories could not be converted into a valid sprint plan.",
      502
    );
  }

  // Distinct from PROVIDER_ERROR: the provider answered, twice, with output
  // that does not satisfy the contract. Reachability is not the problem.
  if (error instanceof SchemaViolationError) {
    return fail(
      "SCHEMA_VIOLATION",
      "The AI provider returned an unusable response. Please try again.",
      502
    );
  }

  // Typed provider failures. `.code` is authoritative; the legacy message
  // bridge introduced in Module 1 is no longer consulted.
  if (error instanceof ProviderError) {
    if (error.code === "timeout") {
      return fail(
        "TIMEOUT",
        "The AI provider timed out. Please try again shortly.",
        504
      );
    }
    if (error.code === "not_configured") {
      return fail(
        "PROVIDER_ERROR",
        "No AI provider is configured. Please try again shortly.",
        502
      );
    }
    return fail(
      "PROVIDER_ERROR",
      "No AI provider could be reached. Please try again shortly.",
      502
    );
  }

  // Interop: a non-ProviderError carrying the legacy TIMEOUT token.
  if (error instanceof Error && error.message === "TIMEOUT") {
    return fail(
      "TIMEOUT",
      "The AI provider timed out. Please try again shortly.",
      504
    );
  }

  return fail(
    "PROVIDER_ERROR",
    "No AI provider could be reached. Please try again shortly.",
    502
  );
}
