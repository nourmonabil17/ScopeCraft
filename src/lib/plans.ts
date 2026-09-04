// src/lib/plans.ts
//
// Writing a row to `plans`, and the cache key that row is filed under
// (owner: Yousef).
//
// Extracted from the generate route when a second writer appeared: regenerating
// one story also produces a plan, and also has to be counted by the daily quota,
// which counts rows. Two inserts would have been two places to forget a column —
// and the one most easily forgotten is `request_hash`, whose absence does not
// fail anything, it just quietly stops the cache ever hitting for that caller.

import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { constraintsToText, type ScopeCraftRequest } from "@/lib/scopecraft/schema";

export interface PlanOutcome {
  status: "ok" | "failed";
  response?: unknown;
  errorCode?: string;
  providerUsed?: string;
  promptVersion?: string;
  durationMs?: number;
  /** Omitted rather than zeroed when the count is not knowable. Null in the
   *  column means "not recorded", not "no providers". */
  attempts?: number;
  /** The plan this one was derived from, when it was not generated from
   *  scratch. Null for an ordinary generation and for an independent
   *  alternative — both of which share a request_hash with their siblings, so
   *  this column is the only thing that tells the two apart. */
  derivedFrom?: string;
}

/**
 * Bumped when the *inputs* to the hash change, so a hash computed under a new
 * shape can never collide with a row hashed under the old one. Distinct from
 * PROMPT_VERSION, which guards the other direction: same inputs, different
 * prompt, therefore a different answer.
 */
export const REQUEST_HASH_VERSION = "h1";

/**
 * Cache key over the request fields that actually change the answer.
 *
 * `bypass_cache` is deliberately absent too, for the opposite reason: it does
 * not describe the product at all, and it changes only whether this table is
 * consulted rather than what a provider would say. Hashing it would file a
 * second opinion under a different key from the plan it is an opinion about,
 * which is precisely the pairing the comparison relies on.
 *
 * `sprint_length_days` is deliberately absent. It is validated and stored, but
 * nothing in src/lib reads it — it reaches neither the prompt nor the sprint
 * arithmetic, so two requests differing only in sprint length produce identical
 * plans and should share one cache entry. If it ever becomes live, add it here
 * AND bump REQUEST_HASH_VERSION, or old rows will answer new questions.
 *
 * JSON.stringify over an array rather than concatenating the fields: it keeps
 * them unambiguously separated, so ("ab", "c") cannot hash the same as
 * ("a", "bc"). NFC before lowercasing because Arabic can arrive in either
 * normal form and the two spellings are the same idea.
 */
export function requestHash(request: ScopeCraftRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        REQUEST_HASH_VERSION,
        request.idea.normalize("NFC").toLowerCase(),
        constraintsToText(request.constraints)?.normalize("NFC").toLowerCase() ?? "",
        request.team_capacity_points,
      ])
    )
    .digest("hex");
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
export async function recordPlan(
  userId: string,
  request: ScopeCraftRequest,
  outcome: PlanOutcome
): Promise<string | null> {
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into plans (user_id, idea, constraints, capacity_points, sprint_days,
                         request_hash,
                         status, error_code, response, provider_used, prompt_version,
                         duration_ms, attempts, derived_from)
      values (${userId},
              ${request.idea},
              ${constraintsToText(request.constraints) ?? null},
              ${request.team_capacity_points},
              ${request.sprint_length_days},
              ${requestHash(request)},
              ${outcome.status},
              ${outcome.errorCode ?? null},
              ${outcome.response ? sql.json(outcome.response as never) : null},
              ${outcome.providerUsed ?? null},
              ${outcome.promptVersion ?? null},
              ${outcome.durationMs ?? null},
              ${outcome.attempts ?? null},
              ${outcome.derivedFrom ?? null})
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

