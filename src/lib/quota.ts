// src/lib/quota.ts
//
// Daily generation budget (owner: Yousef).
//
// WHY THERE IS NO RATE-LIMIT TABLE AND NO REDIS. The data needed to answer
// "how many has this user run today" is already in `plans`, one row per
// attempt. A second store would have to be kept consistent with the first for
// no information gained, and Redis would add a dependency and a moving part to
// count rows a covering index already counts.
//
// WHAT THIS DOES NOT SOLVE, said plainly because it will be asked: the limit is
// per account, not per IP. Requiring a session is what stops anonymous quota
// burn; someone willing to create many GitHub accounts is not addressed here.
// Edge middleware token-bucket limiting is the next layer if that becomes real.

import { sql } from "@/lib/db";

/** The value used when the environment does not supply a usable one. */
export const DEFAULT_DAILY_LIMIT = 20;

/**
 * Overridable per environment; a demo may want a smaller number than a defence.
 *
 * Falls back rather than trusting `Number()`, because both wrong answers were
 * reachable and neither said anything.
 *
 * The former `Number(...)` call treated an EMPTY STRING as 0 — `??` only catches
 * `undefined` and `null`. An empty string is exactly what `docker-compose.yml`
 * passes for an unset variable (`${DAILY_PLAN_LIMIT:-}`), so the compose stack
 * answered 429 on a user's first request of the day, before any provider was
 * called.
 *
 * The other direction is worse. A non-numeric value parses to `NaN`, and
 * `used >= NaN` is false forever — the meter is simply gone, with no error and
 * no log line. This is a spend control, so it must fail loud or fall back to a
 * known-safe number; failing open silently is the one outcome it cannot have.
 *
 * Exported so the parsing is testable without re-importing the module: the
 * constant below is evaluated once at load, which is right for the app and
 * awkward for a test.
 */
export function readDailyLimit(raw = process.env.DAILY_PLAN_LIMIT): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

export const DAILY_LIMIT = readDailyLimit();

export interface QuotaStatus {
  exceeded: boolean;
  used: number;
  limit: number;
}

/**
 * Counts **attempts**, not successes.
 *
 * A generation that reached a provider and then failed still spent tokens. If
 * only successful rows were counted, a caller could burn the entire quota on
 * failures for free — which is why `plans.status` allows `'failed'` and why
 * this query does not filter on it.
 *
 * A rolling 24-hour window rather than a calendar day: no timezone to agree on,
 * and no midnight cliff where the whole quota returns at once.
 */
export async function checkDailyQuota(userId: string): Promise<QuotaStatus> {
  const [row] = await sql<{ used: number }[]>`
    select count(*)::int as used
    from plans
    where user_id = ${userId}
      and created_at > now() - interval '24 hours'`;

  const used = row?.used ?? 0;
  return { exceeded: used >= DAILY_LIMIT, used, limit: DAILY_LIMIT };
}
