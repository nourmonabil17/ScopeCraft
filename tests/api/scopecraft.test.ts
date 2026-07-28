// tests/api/scopecraft.test.ts
//
// Session 1 deliverable (AI & Backend Engineer — Nour):
// First test: one valid case, one invalid/failure case.

import { validateRequest, SAMPLE_VALID_REQUEST, SAMPLE_INVALID_REQUEST } from "@/lib/scopecraft/schema";
import { geminiProvider, groqProvider, generateWithFallback } from "@/lib/ai/providers";

describe("ScopeCraft request validation", () => {
  it("accepts a valid request", () => {
    const result = validateRequest(SAMPLE_VALID_REQUEST);
    expect(result).not.toBeNull();
    expect(result?.idea).toContain("student teams");
  });

  it("rejects an invalid request (idea too short)", () => {
    const result = validateRequest(SAMPLE_INVALID_REQUEST);
    expect(result).toBeNull(); // must fail BEFORE any provider call
  });

  it("rejects a completely missing body", () => {
    const result = validateRequest({});
    expect(result).toBeNull();
  });
});

// ---- Session 2: provider + fallback tests ----
describe("AI provider fallback", () => {
  const fakeResponse = {
    problem: "p", target_user: "t", goals: [], non_goals: [], requirements: [],
    user_stories: [], acceptance_criteria: [], risks: [], priority: {}, effort: {}, sprint: [],
  };

  it("uses Gemini when it succeeds", async () => {
    jest.spyOn(geminiProvider, "generate").mockResolvedValue(fakeResponse as any);
    const { providerUsed } = await generateWithFallback("a valid idea here");
    expect(providerUsed).toBe("gemini");
  });

  it("falls back to Groq when Gemini fails", async () => {
    jest.spyOn(geminiProvider, "generate").mockRejectedValue(new Error("Gemini down"));
    jest.spyOn(groqProvider, "generate").mockResolvedValue(fakeResponse as any);
    const { providerUsed } = await generateWithFallback("a valid idea here");
    expect(providerUsed).toBe("groq");
  });

  it("throws PROVIDER_ERROR when both providers fail", async () => {
    jest.spyOn(geminiProvider, "generate").mockRejectedValue(new Error("Gemini down"));
    jest.spyOn(groqProvider, "generate").mockRejectedValue(new Error("Groq down"));
    await expect(generateWithFallback("a valid idea here")).rejects.toThrow("PROVIDER_ERROR");
  });
});
