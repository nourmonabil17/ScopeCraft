// src/lib/scopecraft/tools.ts
//
// Deterministic (non-AI) tools owned by the AI & Backend Engineer.
// These are plain functions: same input, same output, every time. No AI call,
// no I/O, no clock, no randomness. Every argument is validated before use, and
// invalid arguments throw rather than being silently clamped — a wrong estimate
// must surface as an error, not as a quietly wrong sprint plan.

import {
  MAX_RISK,
  MAX_STORY_POINTS,
  MAX_VALUE,
  MIN_RISK,
  MIN_STORY_POINTS,
  MIN_VALUE,
  type SprintPlanResult,
} from "./schema";

// Re-exported so callers can reach the type from either module. The canonical
// declaration lives in schema.ts because Zod is this project's single source of
// truth for shapes — the interface and its runtime validator must not be able to
// drift apart.
export type { SprintPlanResult };

export class PlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningError";
  }
}

export interface ScoringInput {
  storyId: string;
  value: number; // business value, 1..5
  risk: number; // risk if delayed, 1..5
  effort: number; // story points, 1..13
  dependencies?: string[]; // story IDs that must be planned first
}

function assertInteger(label: string, actual: unknown, min: number, max: number): void {
  if (!Number.isInteger(actual)) {
    throw new PlanningError(`${label} must be an integer`);
  }
  const value = actual as number;
  if (value < min || value > max) {
    throw new PlanningError(`${label} must be an integer from ${min} to ${max}`);
  }
}

/**
 * priority_score = (value + risk) / effort
 * Higher value and risk with lower effort produce a higher priority.
 */
export function priorityScore({ value, risk, effort }: ScoringInput): number {
  assertInteger("value", value, MIN_VALUE, MAX_VALUE);
  assertInteger("risk", risk, MIN_RISK, MAX_RISK);
  assertInteger("effort", effort, MIN_STORY_POINTS, MAX_STORY_POINTS);
  return Number(((value + risk) / effort).toFixed(2));
}

export interface SprintPlanInput {
  stories: ScoringInput[];
  capacityPerSprint: number; // total points a team can complete per sprint
}

export interface PlannedStory {
  story_id: string;
  priority_score: number;
  effort: number;
  sprint: number;
}

/**
 * Greedy sprint scheduler: sort by priority_score descending, then fill each
 * sprint up to capacity before opening the next one. A story is only scheduled
 * once every story it depends on has already been scheduled.
 *
 * Returns the per-story schedule across the whole backlog. For the first-sprint
 * commitment view the sprint board consumes, see `planSprint` below.
 *
 * Invariants (asserted in tests):
 *  - no sprint's committed points ever exceed capacityPerSprint
 *  - every input story appears exactly once in the output
 *  - identical input produces identical output
 */
export function scheduleSprints({ stories, capacityPerSprint }: SprintPlanInput): PlannedStory[] {
  if (!Number.isInteger(capacityPerSprint) || capacityPerSprint <= 0) {
    throw new PlanningError("capacityPerSprint must be a positive integer");
  }

  const storyIds = new Set(stories.map((story) => story.storyId));
  if (storyIds.size !== stories.length) {
    throw new PlanningError("story IDs must be unique");
  }

  for (const story of stories) {
    if (story.effort > capacityPerSprint) {
      throw new PlanningError(`story ${story.storyId} effort exceeds sprint capacity`);
    }
    for (const dependency of story.dependencies ?? []) {
      if (dependency === story.storyId) {
        throw new PlanningError(`story ${story.storyId} cannot depend on itself`);
      }
      if (!storyIds.has(dependency)) {
        throw new PlanningError(
          `story ${story.storyId} has missing dependency ${dependency}`
        );
      }
    }
  }

  // Deterministic ordering: score descending, then story id for a stable tie-break.
  const pending = stories
    .map((s) => ({ ...s, score: priorityScore(s) }))
    .sort((a, b) => b.score - a.score || a.storyId.localeCompare(b.storyId));

  const plan: PlannedStory[] = [];
  const scheduled = new Set<string>();
  let sprint = 1;
  let remaining = capacityPerSprint;

  while (pending.length > 0) {
    const nextIndex = pending.findIndex((story) =>
      (story.dependencies ?? []).every((dependency) => scheduled.has(dependency))
    );

    if (nextIndex === -1) {
      throw new PlanningError("story dependencies contain a cycle");
    }

    const [story] = pending.splice(nextIndex, 1);
    if (story.effort > remaining) {
      sprint += 1;
      remaining = capacityPerSprint;
    }
    plan.push({
      story_id: story.storyId,
      priority_score: story.score,
      effort: story.effort,
      sprint,
    });
    scheduled.add(story.storyId);
    remaining -= story.effort;
  }

  return plan;
}

/**
 * Collapses a full schedule into the first-sprint commitment.
 *
 * Split out from `planSprint` so the request path can schedule once and derive
 * the summary, rather than running the greedy packer twice per request.
 */
export function summarizeSprintPlan(
  schedule: PlannedStory[],
  capacityPerSprint: number
): SprintPlanResult {
  const included: string[] = [];
  const deferred: string[] = [];
  let committed = 0;

  for (const item of schedule) {
    if (item.sprint === 1) {
      included.push(item.story_id);
      committed += item.effort;
    } else {
      // Deferred for either reason the planner defers: the story did not fit in
      // the remaining capacity, or a dependency pushed it past the boundary.
      deferred.push(item.story_id);
    }
  }

  return {
    capacity_points: capacityPerSprint,
    committed_points: committed,
    included,
    deferred,
  };
}

/**
 * The handbook tool contract: what is the team committing to this sprint, and
 * what slipped?
 *
 * Throws `PlanningError` on the same unusable inputs `scheduleSprints` rejects —
 * a story larger than one sprint, a missing dependency, a cycle, duplicate IDs,
 * or a non-positive capacity. Nothing is silently dropped: every story ID
 * appears in exactly one of `included` or `deferred`.
 */
export function planSprint({
  stories,
  capacityPerSprint,
}: SprintPlanInput): SprintPlanResult {
  return summarizeSprintPlan(
    scheduleSprints({ stories, capacityPerSprint }),
    capacityPerSprint
  );
}

// ---- Contract aliases ----
// The handbook and docs/api-contracts.md name these tools in snake_case.
// The aliases keep the documented contract addressable without renaming the
// camelCase implementations the rest of the codebase already imports.
export {
  priorityScore as priority_score,
  planSprint as plan_sprint,
  scheduleSprints as schedule_sprints,
};
