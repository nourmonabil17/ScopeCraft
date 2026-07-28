// src/lib/scopecraft/service.ts
//
// AI & Backend — orchestration layer.
// Ties together: schema validation -> AI provider (with fallback) -> deterministic tools.
// The route handler should call this instead of talking to providers directly.

import { ScopeCraftRequest, ScopeCraftResponse } from "./schema";
import { generateWithFallback } from "@/lib/ai/providers";
import { planSprint, ScoringInput } from "./tools";

export interface ServiceResult {
  data: ScopeCraftResponse;
  providerUsed: "gemini" | "groq";
}

export async function runScopeCraft(request: ScopeCraftRequest): Promise<ServiceResult> {
  const { result, providerUsed } = await generateWithFallback(request.idea, request.constraints);

  // Re-derive the sprint plan deterministically instead of trusting the AI's math,
  // in case the model's own priority/effort numbers aren't internally consistent.
  const scoringInputs: ScoringInput[] = result.user_stories.map((story) => ({
    storyId: story.id,
    value: result.priority[story.id] ?? 5,
    risk: 5, // default mid-risk if not provided; Yasmin's tool-rules.ts can refine this
    effort: result.effort[story.id] ?? 3,
  }));

  const capacityPerSprint = 10; // placeholder team capacity; see knowledge/scopecraft/capacity-profile.json
  const sprint = scoringInputs.length
    ? planSprint({ stories: scoringInputs, capacityPerSprint })
    : result.sprint;

  return {
    data: { ...result, sprint },
    providerUsed,
  };
}
