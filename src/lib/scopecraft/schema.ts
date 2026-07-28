// src/lib/scopecraft/schema.ts
//
// Session 1 deliverable (AI & Backend Engineer — Nour):
// Typed request/response schema for ScopeCraft.
// This is the CONTRACT everyone else (UI, Lead, Quality) builds against.
// No AI call happens here yet — this is pure shape + validation.

// ---------- REQUEST ----------
export interface ScopeCraftRequest {
  idea: string;            // raw product idea from the user
  constraints?: string;    // optional constraints (budget, timeline, team size, etc.)
}

// ---------- RESPONSE (the 11 required structured fields) ----------
export interface UserStory {
  id: string;
  as_a: string;
  i_want: string;
  so_that: string;
  acceptance_criteria: string[];
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
  code: "INVALID_INPUT" | "PROVIDER_ERROR" | "TIMEOUT";
  message: string;
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
  return {
    idea: b.idea.trim(),
    constraints: typeof b.constraints === "string" ? b.constraints.trim() : undefined,
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
