// src/lib/scopecraft/taxonomy.ts
//
// Domain taxonomy — the controlled vocabulary used across generated content.
// Owned jointly: Yasmin defines the domain rules, Youssef wires them into the
// deterministic pipeline. Nothing here calls an AI provider.

import { MOSCOW_BUCKETS, type MoscowBucket } from "./schema";

export const IMPACT_LEVELS = ["low", "medium", "high"] as const;
export const LIKELIHOOD_LEVELS = ["low", "medium", "high"] as const;

export type ImpactLevel = (typeof IMPACT_LEVELS)[number];
export type LikelihoodLevel = (typeof LIKELIHOOD_LEVELS)[number];

export { MOSCOW_BUCKETS };
export type { MoscowBucket };

/**
 * MoSCoW bands, calibrated for priorityScore = (value + risk) / points where
 * value and risk are 1..5 and points are 1..13.
 *
 * That gives a theoretical range of 10/1 = 10.0 at the top and 2/13 = 0.15 at
 * the bottom, with a typical mid-sized story — value 3, risk 3, 5 points —
 * landing at 1.2. The thresholds below place that typical story in "should",
 * which is the intended centre of the distribution.
 *
 * These constants and the estimation ranges in schema.ts are a single unit:
 * widening `value`/`risk`/`points` without re-deriving these bands silently
 * collapses every story into one bucket.
 */
export const MOSCOW_THRESHOLDS = {
  must: 2.2,
  should: 1.3,
  could: 0.7,
} as const;

export function toMoscow(score: number): MoscowBucket {
  if (!Number.isFinite(score)) {
    throw new Error("moscow classification requires a finite score");
  }
  if (score >= MOSCOW_THRESHOLDS.must) return "must";
  if (score >= MOSCOW_THRESHOLDS.should) return "should";
  if (score >= MOSCOW_THRESHOLDS.could) return "could";
  return "wont";
}

/** Required PRD sections — every generated PRD must include these. */
export const REQUIRED_PRD_SECTIONS = [
  "problem",
  "target_user",
  "goals",
  "non_goals",
  "requirements",
] as const;

export type RequiredPrdSection = (typeof REQUIRED_PRD_SECTIONS)[number];
