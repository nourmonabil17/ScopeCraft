// src/lib/scopecraft/schema.ts
//
// Typed request/response schema for ScopeCraft (owner: Youssef).
// This is the CONTRACT everyone else (UI, Lead, Quality) builds against.
// No AI call happens here; this module provides types and runtime validation.

// ---------- REQUEST ----------
export interface ScopeCraftRequest {
  idea: string;            // raw product idea from the user
  constraints?: string;    // optional constraints (budget, timeline, team size, etc.)
  capacity_per_sprint?: number; // optional positive integer; defaults to Team 10 profile
}

// ---------- RESPONSE (the 11 required structured fields) ----------
export interface UserStory {
  id: string;
  as_a: string;
  i_want: string;
  so_that: string;
  acceptance_criteria: string[];
  dependencies?: string[];
  value: number;
  risk: number;
  effort: number;
}

export interface Risk {
  id: string;
  description: string;
  impact: "low" | "medium" | "high";
  likelihood: "low" | "medium" | "high";
}

export interface SprintItem {
  story_id: string;
  priority_score: number; // from priority_score()
  effort: number;         // story points / days
  sprint: number;         // which sprint it lands in
}

export interface ScopeCraftResponse {
  problem: string;
  target_user: string;
  goals: string[];
  non_goals: string[];
  requirements: string[];
  user_stories: UserStory[];
  acceptance_criteria: string[]; // top-level PRD acceptance criteria
  risks: Risk[];
  priority: Record<string, number>; // story_id -> priority_score
  effort: Record<string, number>;   // story_id -> effort estimate
  sprint: SprintItem[];
}

// ---------- ERROR SHAPE ----------
export interface ScopeCraftError {
  error: true;
  code:
    | "INVALID_INPUT"
    | "CLARIFICATION_REQUIRED"
    | "PROVIDER_ERROR"
    | "TIMEOUT";
  message: string;
}

export interface ClarificationResult {
  required: true;
  questions: string[];
}

// ---------- RESPONSE RUNTIME VALIDATION ----------
// TypeScript interfaces are removed when the app runs, so provider output must
// be checked at runtime before the rest of the application is allowed to use it.
const RESPONSE_KEYS = [
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
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberRecord(value: unknown, positiveOnly = false): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        isNonEmptyString(key) &&
        isFiniteNumber(item) &&
        (!positiveOnly || item > 0)
    )
  );
}

function isUserStory(value: unknown): value is UserStory {
  if (!isRecord(value)) return false;
  const requiredKeys = [
    "id",
    "as_a",
    "i_want",
    "so_that",
    "acceptance_criteria",
    "value",
    "risk",
    "effort",
  ];
  const allowedKeys = [...requiredKeys, "dependencies"];
  const actualKeys = Object.keys(value);
  if (
    !requiredKeys.every((key) => actualKeys.includes(key)) ||
    actualKeys.some((key) => !allowedKeys.includes(key))
  ) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.as_a) &&
    isNonEmptyString(value.i_want) &&
    isNonEmptyString(value.so_that) &&
    isStringArray(value.acceptance_criteria) &&
    isFiniteNumber(value.value) &&
    Number.isInteger(value.value) &&
    value.value >= 1 &&
    value.value <= 10 &&
    isFiniteNumber(value.risk) &&
    Number.isInteger(value.risk) &&
    value.risk >= 1 &&
    value.risk <= 10 &&
    isFiniteNumber(value.effort) &&
    Number.isInteger(value.effort) &&
    value.effort > 0 &&
    (value.dependencies === undefined ||
      (isStringArray(value.dependencies) &&
        new Set(value.dependencies).size === value.dependencies.length &&
        !value.dependencies.includes(value.id)))
  );
}

function isRisk(value: unknown): value is Risk {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "id",
      "description",
      "impact",
      "likelihood",
    ])
  ) {
    return false;
  }
  const levels = ["low", "medium", "high"];
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.description) &&
    typeof value.impact === "string" &&
    levels.includes(value.impact) &&
    typeof value.likelihood === "string" &&
    levels.includes(value.likelihood)
  );
}

function isSprintItem(value: unknown): value is SprintItem {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "story_id",
      "priority_score",
      "effort",
      "sprint",
    ])
  ) {
    return false;
  }
  return (
    isNonEmptyString(value.story_id) &&
    isFiniteNumber(value.priority_score) &&
    isFiniteNumber(value.effort) &&
    value.effort > 0 &&
    isFiniteNumber(value.sprint) &&
    Number.isInteger(value.sprint) &&
    value.sprint > 0
  );
}

export function validateResponse(value: unknown): ScopeCraftResponse | null {
  if (!isRecord(value) || !hasExactKeys(value, RESPONSE_KEYS)) return null;

  const valid =
    isNonEmptyString(value.problem) &&
    isNonEmptyString(value.target_user) &&
    isStringArray(value.goals) &&
    isStringArray(value.non_goals) &&
    isStringArray(value.requirements) &&
    Array.isArray(value.user_stories) &&
    value.user_stories.every(isUserStory) &&
    isStringArray(value.acceptance_criteria) &&
    Array.isArray(value.risks) &&
    value.risks.every(isRisk) &&
    isNumberRecord(value.priority) &&
    isNumberRecord(value.effort, true) &&
    Array.isArray(value.sprint) &&
    value.sprint.every(isSprintItem);

  return valid ? (value as unknown as ScopeCraftResponse) : null;
}

export function parseScopeCraftResponse(value: unknown): ScopeCraftResponse {
  const validated = validateResponse(value);
  if (!validated) {
    throw new Error("INVALID_PROVIDER_RESPONSE");
  }
  return validated;
}

// ---------- VALIDATION (no external libs needed for Session 1 stub) ----------
export function validateRequest(body: unknown): ScopeCraftRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.idea !== "string" || b.idea.trim().length < 5) {
    return null; // idea missing or too short — reject before calling any AI provider
  }
  if (b.constraints !== undefined && typeof b.constraints !== "string") {
    return null;
  }
  if (
    b.capacity_per_sprint !== undefined &&
    (typeof b.capacity_per_sprint !== "number" ||
      !Number.isInteger(b.capacity_per_sprint) ||
      b.capacity_per_sprint <= 0 ||
      b.capacity_per_sprint > 100)
  ) {
    return null;
  }
  return {
    idea: b.idea.trim(),
    constraints: typeof b.constraints === "string" ? b.constraints.trim() : undefined,
    capacity_per_sprint:
      typeof b.capacity_per_sprint === "number"
        ? b.capacity_per_sprint
        : undefined,
  };
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

// ---------- SAMPLE VALID REQUEST (for docs / tests) ----------
export const SAMPLE_VALID_REQUEST: ScopeCraftRequest = {
  idea: "An app that helps student teams turn a rough idea into a sprint-ready backlog.",
  constraints: "Team of 4, 5 weeks, no budget for paid APIs.",
};

// ---------- SAMPLE INVALID REQUEST (for docs / tests) ----------
export const SAMPLE_INVALID_REQUEST = {
  idea: "hi", // too short — must fail validation
};
