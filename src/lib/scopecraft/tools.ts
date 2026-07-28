// src/lib/scopecraft/tools.ts
//
// Deterministic (non-AI) tools owned by AI & Backend Engineer.
// These are plain math functions — no AI call happens here.

export interface ScoringInput {
  storyId: string;
  value: number;   // business value, 1-10
  risk: number;    // risk if delayed, 1-10
  effort: number;  // estimated effort/story points, > 0
}

/**
 * priority_score = (value + risk) / effort
 * Higher value/risk with lower effort => higher priority.
 */
export function priorityScore({ value, risk, effort }: ScoringInput): number {
  if (effort <= 0) throw new Error("effort must be greater than 0");
  return Number(((value + risk) / effort).toFixed(2));
}

export interface SprintPlanInput {
  stories: ScoringInput[];
  capacityPerSprint: number; // total effort points a team can do per sprint
}

export interface PlannedStory {
  story_id: string;
  priority_score: number;
  effort: number;
  sprint: number;
}

/**
 * Greedy sprint planner: sort by priority_score descending,
 * fill each sprint up to capacity before moving to the next.
 */
export function planSprint({ stories, capacityPerSprint }: SprintPlanInput): PlannedStory[] {
  if (capacityPerSprint <= 0) throw new Error("capacityPerSprint must be greater than 0");

  const scored = stories
    .map((s) => ({ ...s, score: priorityScore(s) }))
    .sort((a, b) => b.score - a.score);

  const plan: PlannedStory[] = [];
  let sprint = 1;
  let remaining = capacityPerSprint;

  for (const s of scored) {
    if (s.effort > remaining) {
      sprint += 1;
      remaining = capacityPerSprint;
    }
    plan.push({ story_id: s.storyId, priority_score: s.score, effort: s.effort, sprint });
    remaining -= s.effort;
  }

  return plan;
}
