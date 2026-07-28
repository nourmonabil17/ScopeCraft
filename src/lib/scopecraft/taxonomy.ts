// src/lib/scopecraft/taxonomy.ts
//
// Knowledge, Tools & Quality Engineer (Yasmin) — domain taxonomy.
// Defines the controlled vocabulary used across generated content.

export const IMPACT_LEVELS = ["low", "medium", "high"] as const;
export const LIKELIHOOD_LEVELS = ["low", "medium", "high"] as const;

// MoSCoW priority buckets, mapped from priority_score() ranges (tune with real data)
export type MoscowBucket = "must" | "should" | "could" | "wont";

export function toMoscow(score: number): MoscowBucket {
  if (score >= 8) return "must";
  if (score >= 5) return "should";
  if (score >= 2) return "could";
  return "wont";
}

// Required PRD sections — every generated PRD must include these
export const REQUIRED_PRD_SECTIONS = [
  "problem",
  "target_user",
  "goals",
  "non_goals",
  "requirements",
] as const;
