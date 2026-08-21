// src/lib/scopecraft/tools.ts
//
// Deterministic (non-AI) tools owned by AI & Backend Engineer.
// These are plain math functions — no AI call happens here.

export interface ScoringInput {
  storyId: string;
  value: number;   // business value, 1-10
  risk: number;    // risk if delayed, 1-10
  effort: number;  // estimated effort/story points, > 0
  dependencies?: string[]; // story IDs that must be planned first
}

/**
 * priority_score = (value + risk) / effort
 * Higher value/risk with lower effort => higher priority.
 */
export function priorityScore({ value, risk, effort }: ScoringInput): number {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error("value must be an integer from 1 to 10");
  }
  if (!Number.isInteger(risk) || risk < 1 || risk > 10) {
    throw new Error("risk must be an integer from 1 to 10");
  }
  if (!Number.isInteger(effort)) throw new Error("effort must be an integer");
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

  const storyIds = new Set(stories.map((story) => story.storyId));
  if (storyIds.size !== stories.length) {
    throw new Error("story IDs must be unique");
  }

  for (const story of stories) {
    if (story.effort > capacityPerSprint) {
      throw new Error(
        `story ${story.storyId} effort exceeds sprint capacity`
      );
    }
    for (const dependency of story.dependencies ?? []) {
      if (!storyIds.has(dependency)) {
        throw new Error(
          `story ${story.storyId} has missing dependency ${dependency}`
        );
      }
      if (dependency === story.storyId) {
        throw new Error(`story ${story.storyId} cannot depend on itself`);
      }
    }
  }

  const pending = stories
    .map((s) => ({ ...s, score: priorityScore(s) }))
    .sort((a, b) => b.score - a.score);

  const plan: PlannedStory[] = [];
  const scheduled = new Set<string>();
  let sprint = 1;
  let remaining = capacityPerSprint;

  while (pending.length > 0) {
    const nextIndex = pending.findIndex((story) =>
      (story.dependencies ?? []).every((dependency) => scheduled.has(dependency))
    );

    if (nextIndex === -1) {
      throw new Error("story dependencies contain a cycle");
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
