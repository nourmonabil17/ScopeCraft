// src/lib/scopecraft/service.ts
//
// AI & Backend — orchestration layer.
// Ties together: schema validation -> AI provider (with fallback) -> deterministic tools.
// The route handler should call this instead of talking to providers directly.

import { ScopeCraftRequest, ScopeCraftResponse } from "./schema";
import { generateWithFallback, PROMPT_VERSION } from "@/lib/ai/providers";
import { planSprint, PlannedStory, ScoringInput } from "./tools";
import { DEFAULT_TEAM_CAPACITY_PROFILE } from "./tool-rules";

export interface ServiceResult {
  data: ScopeCraftResponse;
  providerUsed: "gemini" | "groq";
  promptVersion: string;
}

export class PlanningError extends Error {
  constructor() {
    super("PLANNING_ERROR");
    this.name = "PlanningError";
  }
}

export async function runScopeCraft(request: ScopeCraftRequest): Promise<ServiceResult> {
  const { result, providerUsed } = await generateWithFallback(request.idea, request.constraints);

  // Treat the provider's validated story estimates as inputs only. Recalculate
  // every score and planning output so the returned maps and sprint agree.
  const scoringInputs: ScoringInput[] = result.user_stories.map((story) => ({
    storyId: story.id,
    value: story.value,
    risk: story.risk,
    effort: story.effort,
    dependencies: story.dependencies ?? [],
  }));

  const capacityPerSprint =
    request.capacity_per_sprint ??
    DEFAULT_TEAM_CAPACITY_PROFILE.capacityPerSprint;
  let sprint: PlannedStory[];
  try {
    sprint = planSprint({ stories: scoringInputs, capacityPerSprint });
  } catch {
    throw new PlanningError();
  }
  const priority = Object.fromEntries(
    sprint.map((story) => [story.story_id, story.priority_score])
  );
  const effort = Object.fromEntries(
    scoringInputs.map((story) => [story.storyId, story.effort])
  );

  return {
    data: { ...result, priority, effort, sprint },
    providerUsed,
    promptVersion: PROMPT_VERSION,
  };
}
