// src/lib/scopecraft/schema.ts
//
// Typed request/response contract for ScopeCraft (owner: Youssef) — Module 2.
// Zod is the single source of truth: every type below is inferred from a schema,
// so the compile-time type and the runtime check can never drift apart.
//
// No AI call happens here. This module provides types and validation only.

import { z } from "zod";

// ---------- LIMITS ----------
export const MIN_IDEA_LENGTH = 20;
export const MAX_IDEA_LENGTH = 2_000;
export const MAX_CONSTRAINTS_LENGTH = 1_000;
export const MAX_REQUEST_BODY_BYTES = 16_384;

export const MIN_TEAM_CAPACITY_POINTS = 1;
export const MAX_TEAM_CAPACITY_POINTS = 500;
export const DEFAULT_TEAM_CAPACITY_POINTS = 30;
export const MIN_SPRINT_LENGTH_DAYS = 5;
export const MAX_SPRINT_LENGTH_DAYS = 30;
export const DEFAULT_SPRINT_LENGTH_DAYS = 14;

// Story estimation scale. `points` follows a Fibonacci-style 1..13 range;
// `value` and `risk` are 1..5. The MoSCoW bands in taxonomy.ts are calibrated
// against exactly this scale — changing either range requires recalibrating
// toMoscow(), because the two are a single unit.
export const MIN_STORY_POINTS = 1;
export const MAX_STORY_POINTS = 13;
export const MIN_VALUE = 1;
export const MAX_VALUE = 5;
export const MIN_RISK = 1;
export const MAX_RISK = 5;

// ---------- REQUEST ----------
export const ConstraintsSchema = z
  .union([z.string().max(MAX_CONSTRAINTS_LENGTH), z.array(z.string().max(MAX_CONSTRAINTS_LENGTH))])
  .optional();

export const RequestSchema = z.object({
  idea: z.string().trim().min(MIN_IDEA_LENGTH).max(MAX_IDEA_LENGTH),
  constraints: ConstraintsSchema,
  team_capacity_points: z
    .number()
    .int()
    .min(MIN_TEAM_CAPACITY_POINTS)
    .max(MAX_TEAM_CAPACITY_POINTS)
    .default(DEFAULT_TEAM_CAPACITY_POINTS),
  sprint_length_days: z
    .number()
    .int()
    .min(MIN_SPRINT_LENGTH_DAYS)
    .max(MAX_SPRINT_LENGTH_DAYS)
    .default(DEFAULT_SPRINT_LENGTH_DAYS),

  // "I have seen this answer; give me a different one."
  //
  // The only field here that does not describe the product being planned. It
  // asks the route to skip the A3 lookup and generate for real, which is what
  // makes a second, independent answer to an identical question possible at
  // all — the same idea hashes the same way, so without this the cache would
  // hand back the first plan verbatim and there would be nothing to compare.
  //
  // Deliberately NOT part of the cache key. The key covers the fields that
  // change what a provider would say, and this changes only whether we ask
  // one. Adding it there would file the two plans under different hashes and
  // break the pairing that the comparison depends on.
  //
  // Costs a generation and is counted like any other, because it is read after
  // the daily budget has already been checked.
  //
  // `.optional()` rather than `.default(false)`, unlike the two fields above.
  // Their defaults are values the planner actually uses, so materialising one
  // is the point; here absent and false mean the same thing to the single line
  // that reads it, and a default would make the field required on every object
  // typed as a request — including the fixtures, which have no opinion on it.
  bypass_cache: z.boolean().optional(),
});

export type ScopeCraftRequest = z.infer<typeof RequestSchema>;

/**
 * The browser currently posts `capacity_per_sprint`. The canonical field is
 * `team_capacity_points`; the legacy name is accepted so the existing UI keeps
 * working, and should be removed once the client migrates.
 */
export function normalizeRequestInput(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  const b = { ...(body as Record<string, unknown>) };
  if (b.team_capacity_points === undefined && b.capacity_per_sprint !== undefined) {
    b.team_capacity_points = b.capacity_per_sprint;
  }
  delete b.capacity_per_sprint;
  return b;
}

/** Flattens the string | string[] constraint shape for prompt construction. */
export function constraintsToText(constraints?: string | string[]): string | undefined {
  if (constraints === undefined) return undefined;
  const text = Array.isArray(constraints) ? constraints.join("\n") : constraints;
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ---------- BOARD EDITS ----------
/**
 * What a human changed on the sprint board, and nothing else.
 *
 * Only `points` and `column` are stored, because they are the only two things
 * the board lets a person change (`setPoints`, `toggleColumn` in
 * client-recalc.ts). Score, MoSCoW bucket and capacity are *derived* from those
 * two and are recomputed on load — storing them would create a second source of
 * truth for numbers the code owns, which is the one thing this codebase does
 * not do. It also means a change to the scoring formula applies to saved boards
 * instead of leaving them frozen at an old answer.
 */
export const BoardEditSchema = z
  .object({
    points: z.number().int().min(MIN_STORY_POINTS).max(MAX_STORY_POINTS),
    column: z.enum(["included", "deferred"]),
  })
  // `.strict()` rather than Zod's default strip. Stripping is safe — a derived
  // field like `moscow` would never reach the database either way — but it is
  // silently safe: the caller is told the save succeeded while part of what
  // they sent was discarded. Rejecting says which field is not storable, and
  // turns a client bug into an error instead of a mystery.
  .strict();

/** Keyed by story id. A JSONB column accepts anything; that is not a reason to store anything. */
export const BoardSchema = z.record(z.string().min(1).max(64), BoardEditSchema);

export type BoardEdits = z.infer<typeof BoardSchema>;

// ---------- RESPONSE ----------
export const MOSCOW_BUCKETS = ["must", "should", "could", "wont"] as const;
export const MoscowSchema = z.enum(MOSCOW_BUCKETS);
export type MoscowBucket = z.infer<typeof MoscowSchema>;

export const IMPACT_SCHEMA = z.enum(["low", "medium", "high"]);

export const StorySchema = z.object({
  id: z.string().min(1),
  as_a: z.string().min(1),
  i_want: z.string().min(1),
  so_that: z.string().min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  points: z.number().int().min(MIN_STORY_POINTS).max(MAX_STORY_POINTS),
  value: z.number().int().min(MIN_VALUE).max(MAX_VALUE),
  risk: z.number().int().min(MIN_RISK).max(MAX_RISK),
  dependencies: z.array(z.string().min(1)).default([]),
})
  .refine((story) => !story.dependencies.includes(story.id), {
    message: "a story cannot depend on itself",
    path: ["dependencies"],
  })
  .refine(
    (story) => new Set(story.dependencies).size === story.dependencies.length,
    { message: "dependencies must be unique", path: ["dependencies"] }
  );

export type UserStory = z.infer<typeof StorySchema>;

export const RiskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  impact: IMPACT_SCHEMA,
  likelihood: IMPACT_SCHEMA,
});

export type Risk = z.infer<typeof RiskSchema>;

export const SprintItemSchema = z.object({
  story_id: z.string().min(1),
  priority_score: z.number().finite(),
  effort: z.number().int().positive(),
  sprint: z.number().int().positive(),
});

export type SprintItem = z.infer<typeof SprintItemSchema>;

/**
 * The first-sprint commitment, as named by the handbook tool contract and
 * consumed by the interactive sprint board.
 *
 * `sprint` (SprintItem[]) answers "which sprint does each story land in" across
 * the whole backlog. This answers the different question the board actually
 * asks: "what is the team committing to *now*, and what slipped?" — so the two
 * are complementary rather than redundant. `included` and `deferred` are in
 * planner order (priority descending, story ID as the stable tie-break), and
 * every story ID appears in exactly one of them.
 */
export const SprintPlanResultSchema = z.object({
  capacity_points: z.number().int().positive(),
  committed_points: z.number().int().nonnegative(),
  included: z.array(z.string().min(1)),
  deferred: z.array(z.string().min(1)),
}).refine((plan) => plan.committed_points <= plan.capacity_points, {
  message: "committed_points cannot exceed capacity_points",
  path: ["committed_points"],
});

export type SprintPlanResult = z.infer<typeof SprintPlanResultSchema>;

/**
 * What the AI provider is asked to return: the descriptive PRD fields plus
 * story estimates. The four deterministic fields (priority, effort, sprint,
 * moscow) are computed by tools.ts and are NOT trusted from the model, so they
 * are optional here and overwritten by the service layer.
 */
export const ProviderOutputSchema = z.object({
  problem: z.string().min(1),
  target_user: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  non_goals: z.array(z.string().min(1)),
  requirements: z.array(z.string().min(1)).min(1),
  user_stories: z.array(StorySchema).min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  risks: z.array(RiskSchema).min(1),
  priority: z.record(z.string(), z.number()).optional(),
  effort: z.record(z.string(), z.number()).optional(),
  sprint: z.array(SprintItemSchema).optional(),
  sprint_plan: SprintPlanResultSchema.optional(),
  moscow: z.record(z.string(), MoscowSchema).optional(),
});

export type ProviderOutput = z.infer<typeof ProviderOutputSchema>;

/**
 * The safe-refusal envelope. A model that is asked to plan something outside
 * software product planning returns this instead of a fabricated PRD. It is a
 * *valid* model response — not a malformed one — so the failover chain must not
 * treat it as a provider failure and retry the next provider.
 */
export const OutOfDomainSchema = z.object({
  out_of_domain: z.literal(true),
  message: z.string().min(1),
});

export type OutOfDomain = z.infer<typeof OutOfDomainSchema>;

/** Either a usable plan or an explicit refusal. Anything else is malformed. */
export const ModelReplySchema = z.union([OutOfDomainSchema, ProviderOutputSchema]);
export type ModelReply = z.infer<typeof ModelReplySchema>;

export function isOutOfDomain(reply: ModelReply): reply is OutOfDomain {
  return "out_of_domain" in reply && reply.out_of_domain === true;
}

/**
 * Parses a model reply, accepting both the plan and the refusal shapes.
 * Returns null on anything else so the caller can fail over.
 */
export function validateModelReply(value: unknown): ModelReply | null {
  const parsed = ModelReplySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * One rewritten story, or a refusal.
 *
 * A SEPARATE union rather than a third member of ModelReplySchema. Widening the
 * shared one would let a story-shaped object satisfy a full-plan request, which
 * turns a malformed reply the chain would have retried into one it accepts and
 * fails on later — a strictly worse failure, further from its cause.
 *
 * Wrapped in `{ story: ... }` rather than sent bare so the reply cannot be
 * confused with the refusal envelope by either the model or the parser.
 */
export const StoryReplySchema = z.union([
  OutOfDomainSchema,
  z.object({ story: StorySchema }),
]);

export type StoryReply = z.infer<typeof StoryReplySchema>;

export function validateStoryReply(value: unknown): StoryReply | null {
  const parsed = StoryReplySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The API response contract: all 11 mandatory fields plus the deterministic
 * `moscow` classification. Every field here is required — by the time a response
 * reaches the client, the service layer has computed the deterministic ones.
 */
export const ScopeCraftResponseSchema = z.object({
  problem: z.string().min(1),
  target_user: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  non_goals: z.array(z.string().min(1)),
  requirements: z.array(z.string().min(1)).min(1),
  user_stories: z.array(StorySchema).min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  risks: z.array(RiskSchema).min(1),
  priority: z.record(z.string(), z.number()),
  effort: z.record(z.string(), z.number().int().positive()),
  sprint: z.array(SprintItemSchema),
  sprint_plan: SprintPlanResultSchema,
  moscow: z.record(z.string(), MoscowSchema),
});

export type ScopeCraftResponse = z.infer<typeof ScopeCraftResponseSchema>;

/** The 11 mandatory field names, asserted against the schema at compile time. */
export const REQUIRED_RESPONSE_FIELDS = [
  "problem",
  "target_user",
  "goals",
  "non_goals",
  "requirements",
  "user_stories",
  "acceptance_criteria",
  "risks",
  "priority",
  "effort",
  "sprint",
] as const satisfies readonly (keyof ScopeCraftResponse)[];

// ---------- ERROR SHAPE ----------
/**
 * The closed set of error codes the endpoint can return. Each names one
 * distinct failure, so a caller can branch on the code without parsing prose.
 *
 * Module 5 split the former catch-all `INVALID_INPUT` into `PAYLOAD_TOO_LARGE`
 * (413) and `INVALID_JSON` (400), and gave a schema violation its own
 * `SCHEMA_VIOLATION` code so "the model returned garbage twice" is
 * distinguishable from "every provider was unreachable".
 */
export const ERROR_CODES = [
  // 401 — no valid session. First check in the route, before the body is read.
  "UNAUTHORIZED",
  "PAYLOAD_TOO_LARGE",
  "INVALID_JSON",
  "VALIDATION_ERROR",
  "CLARIFICATION_REQUIRED",
  "OUT_OF_DOMAIN",
  // 404 — no such plan, or it belongs to someone else. Deliberately the same
  // answer for both, so the endpoint cannot be used to discover real ids.
  "NOT_FOUND",
  // 503 — the quota store is unreachable, so the budget cannot be enforced.
  // Deliberately fails *closed*: see the comment on the check in route.ts.
  "STORAGE_UNAVAILABLE",
  // 429 — over the daily generation budget. Checked after the free local
  // validation, so a malformed request never costs a database round trip.
  "RATE_LIMITED",
  "PLANNING_ERROR",
  "SCHEMA_VIOLATION",
  "PROVIDER_ERROR",
  "TIMEOUT",
] as const;

export type ScopeCraftErrorCode = (typeof ERROR_CODES)[number];

export interface ScopeCraftError {
  error: true;
  code: ScopeCraftErrorCode;
  message: string;
}

/**
 * A single field-level validation failure, as returned alongside a 422
 * VALIDATION_ERROR. Carries the field path and the rule that failed — never the
 * value the caller submitted, so an error response cannot echo user data.
 */
export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ClarificationResult {
  required: true;
  questions: string[];
}

// ---------- VALIDATION HELPERS ----------
/**
 * Validates provider output. Returns null instead of throwing so the failover
 * loop can treat a malformed response as "try the next provider".
 */
export function validateResponse(value: unknown): ProviderOutput | null {
  const parsed = ProviderOutputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseScopeCraftResponse(value: unknown): ProviderOutput {
  const validated = validateResponse(value);
  if (!validated) {
    throw new Error("INVALID_PROVIDER_RESPONSE");
  }
  return validated;
}

/** Validates the fully-assembled API response, including deterministic fields. */
export function parseFinalResponse(value: unknown): ScopeCraftResponse {
  return ScopeCraftResponseSchema.parse(value);
}

/**
 * Request validation. Returns null on failure; Module 4 switches the route to
 * `RequestSchema.safeParse` directly so field-level issues reach the client.
 */
export function validateRequest(body: unknown): ScopeCraftRequest | null {
  const parsed = RequestSchema.safeParse(normalizeRequestInput(body));
  return parsed.success ? parsed.data : null;
}

/**
 * Conservatively detects input that looks like multiple long gibberish tokens.
 * It intentionally does not reject merely short, niche, or unfamiliar ideas.
 */
export function getClarification(
  request: ScopeCraftRequest
): ClarificationResult | null {
  const tokens = request.idea.toLowerCase().match(/[a-z]+/g) ?? [];
  if (tokens.length < 2) return null;

  const longTokens = tokens.filter((token) => token.length >= 8);
  const allLongTokensLookUnpronounceable =
    longTokens.length === tokens.length &&
    longTokens.every((token) => {
      const vowelCount = (token.match(/[aeiou]/g) ?? []).length;
      return vowelCount / token.length < 0.25;
    });

  if (!allLongTokensLookUnpronounceable) return null;

  return {
    required: true,
    questions: [
      "What problem should the product solve?",
      "Who is the intended user?",
    ],
  };
}

// ---------- SAMPLES (docs / tests) ----------
export const SAMPLE_VALID_REQUEST: ScopeCraftRequest = {
  idea: "An app that helps student teams turn a rough idea into a sprint-ready backlog.",
  constraints: "Team of 4, 5 weeks, no budget for paid APIs.",
  team_capacity_points: DEFAULT_TEAM_CAPACITY_POINTS,
  sprint_length_days: DEFAULT_SPRINT_LENGTH_DAYS,
};

export const SAMPLE_INVALID_REQUEST = {
  idea: "hi", // below MIN_IDEA_LENGTH — must fail validation
};
