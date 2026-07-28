// tests/api/scopecraft.test.ts
//
// Session 1 deliverable (AI & Backend Engineer — Nour):
// First test: one valid case, one invalid/failure case.

import {
  getClarification,
  parseScopeCraftResponse,
  validateRequest,
  validateResponse,
  SAMPLE_VALID_REQUEST,
  SAMPLE_INVALID_REQUEST,
} from "@/lib/scopecraft/schema";
import {
  fetchWithTimeout,
  geminiProvider,
  groqProvider,
  generateWithFallback,
} from "@/lib/ai/providers";
import { POST } from "@/app/api/scopecraft/route";
import { NextRequest } from "next/server";

const fakeResponse = {
  problem: "Teams need a plan",
  target_user: "Student teams",
  goals: ["Create a PRD"],
  non_goals: ["Replace product owners"],
  requirements: ["Generate structured output"],
  user_stories: [{
    id: "US-1",
    as_a: "student",
    i_want: "a structured plan",
    so_that: "my team can start",
    acceptance_criteria: ["The plan contains a PRD"],
    value: 8,
    risk: 4,
    effort: 3,
  }],
  acceptance_criteria: ["Every story is testable"],
  risks: [{
    id: "R-1",
    description: "The scope may be too large",
    impact: "medium" as const,
    likelihood: "low" as const,
  }],
  priority: { "US-1": 8 },
  effort: { "US-1": 3 },
  sprint: [{
    story_id: "US-1",
    priority_score: 8,
    effort: 3,
    sprint: 1,
  }],
};

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

  it("does not flag concise legitimate ideas for clarification", () => {
    expect(getClarification({ idea: "Recipe manager" })).toBeNull();
    expect(getClarification({ idea: "Build a CRM" })).toBeNull();
  });
});

describe("ScopeCraft response validation", () => {
  it("accepts a complete valid provider response", () => {
    expect(validateResponse(fakeResponse)).toEqual(fakeResponse);
  });

  it("rejects a response with a missing required field", () => {
    const missingProblem: Record<string, unknown> = { ...fakeResponse };
    delete missingProblem.problem;
    expect(validateResponse(missingProblem)).toBeNull();
  });

  it("rejects a response with the wrong field type", () => {
    expect(validateResponse({ ...fakeResponse, goals: "not-an-array" })).toBeNull();
  });

  it("rejects a response with an invalid risk level", () => {
    const invalidRisk = {
      ...fakeResponse,
      risks: [{ ...fakeResponse.risks[0], impact: "critical" }],
    };
    expect(validateResponse(invalidRisk)).toBeNull();
  });

  it("accepts valid optional story dependencies", () => {
    const withDependencies = {
      ...fakeResponse,
      user_stories: [{
        ...fakeResponse.user_stories[0],
        dependencies: ["US-0"],
      }],
    };
    expect(validateResponse(withDependencies)).not.toBeNull();
  });

  it("rejects a story that depends on itself", () => {
    const selfDependent = {
      ...fakeResponse,
      user_stories: [{
        ...fakeResponse.user_stories[0],
        dependencies: ["US-1"],
      }],
    };
    expect(validateResponse(selfDependent)).toBeNull();
  });

  it("rejects story planning inputs outside their validated ranges", () => {
    const invalidValue = {
      ...fakeResponse,
      user_stories: [{
        ...fakeResponse.user_stories[0],
        value: 11,
      }],
    };
    expect(validateResponse(invalidValue)).toBeNull();
  });

  it("throws a controlled error for malformed provider output", () => {
    expect(() => parseScopeCraftResponse({ problem: "incomplete" }))
      .toThrow("INVALID_PROVIDER_RESPONSE");
  });
});

// ---- Session 2: provider + fallback tests ----
describe("AI provider fallback", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses Gemini when it succeeds", async () => {
    jest.spyOn(geminiProvider, "generate").mockResolvedValue(fakeResponse);
    const { providerUsed } = await generateWithFallback("a valid idea here");
    expect(providerUsed).toBe("gemini");
  });

  it("falls back to Groq when Gemini fails", async () => {
    jest.spyOn(geminiProvider, "generate").mockRejectedValue(new Error("Gemini down"));
    jest.spyOn(groqProvider, "generate").mockResolvedValue(fakeResponse);
    const { providerUsed } = await generateWithFallback("a valid idea here");
    expect(providerUsed).toBe("groq");
  });

  it("falls back to Groq when Gemini returns a malformed response", async () => {
    jest.spyOn(geminiProvider, "generate").mockImplementation(async () =>
      parseScopeCraftResponse({ problem: "incomplete" })
    );
    jest.spyOn(groqProvider, "generate").mockResolvedValue(fakeResponse);

    const { providerUsed, result } = await generateWithFallback("a valid idea here");

    expect(providerUsed).toBe("groq");
    expect(result).toEqual(fakeResponse);
  });

  it("throws PROVIDER_ERROR when both providers fail", async () => {
    jest.spyOn(geminiProvider, "generate").mockRejectedValue(new Error("Gemini down"));
    jest.spyOn(groqProvider, "generate").mockRejectedValue(new Error("Groq down"));
    await expect(generateWithFallback("a valid idea here")).rejects.toThrow("PROVIDER_ERROR");
  });
});

describe("AI provider safety", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGroqKey = process.env.GROQ_API_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
    if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqKey;
  });

  it("rejects a missing Gemini API key before making a network request", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(geminiProvider.generate("prompt"))
      .rejects.toThrow("MISSING_GEMINI_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing Groq API key before making a network request", async () => {
    delete process.env.GROQ_API_KEY;
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(groqProvider.generate("prompt"))
      .rejects.toThrow("MISSING_GROQ_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aborts a provider request after its timeout", async () => {
    jest.spyOn(global, "fetch").mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
    );

    await expect(fetchWithTimeout("https://provider.test", {}, 1))
      .rejects.toThrow("TIMEOUT");
  });
});

describe("POST /api/scopecraft", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createRequest(body: string): NextRequest {
    return new NextRequest("http://localhost/api/scopecraft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  it("returns 200, validated JSON, and the provider header for a valid request", async () => {
    jest.spyOn(geminiProvider, "generate").mockResolvedValue(fakeResponse);
    const groqSpy = jest.spyOn(groqProvider, "generate");

    const response = await POST(
      createRequest(JSON.stringify({ idea: "A valid product planning idea" }))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Provider-Used")).toBe("gemini");
    expect(validateResponse(body)).not.toBeNull();
    expect(body.problem).toBe(fakeResponse.problem);
    expect(body.priority).toEqual({ "US-1": 4 });
    expect(body.effort).toEqual({ "US-1": 3 });
    expect(body.sprint[0].priority_score).toBe(body.priority["US-1"]);
    expect(groqSpy).not.toHaveBeenCalled();
  });

  it("uses a validated request capacity instead of the default capacity", async () => {
    const twoStoryResponse = {
      ...fakeResponse,
      user_stories: [
        fakeResponse.user_stories[0],
        {
          ...fakeResponse.user_stories[0],
          id: "US-2",
          value: 6,
          risk: 2,
          effort: 3,
        },
      ],
      priority: { "US-1": 99, "US-2": 99 },
      effort: { "US-1": 99, "US-2": 99 },
    };
    jest.spyOn(geminiProvider, "generate").mockResolvedValue(twoStoryResponse);

    const response = await POST(createRequest(JSON.stringify({
      idea: "A valid product planning idea",
      capacity_per_sprint: 3,
    })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sprint.map((story: { sprint: number }) => story.sprint))
      .toEqual([1, 2]);
  });

  it("rejects an invalid sprint capacity before contacting a provider", async () => {
    const geminiSpy = jest.spyOn(geminiProvider, "generate");

    const response = await POST(createRequest(JSON.stringify({
      idea: "A valid product planning idea",
      capacity_per_sprint: 0,
    })));

    expect(response.status).toBe(400);
    expect(geminiSpy).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_INPUT for an idea that is too short", async () => {
    const geminiSpy = jest.spyOn(geminiProvider, "generate");
    const groqSpy = jest.spyOn(groqProvider, "generate");

    const response = await POST(createRequest(JSON.stringify({ idea: "hi" })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: true, code: "INVALID_INPUT" });
    expect(geminiSpy).not.toHaveBeenCalled();
    expect(groqSpy).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_INPUT when the request body is not valid JSON", async () => {
    const geminiSpy = jest.spyOn(geminiProvider, "generate");
    const groqSpy = jest.spyOn(groqProvider, "generate");

    const response = await POST(createRequest("{ invalid-json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: true,
      code: "INVALID_INPUT",
      message: "Request body must be valid JSON.",
    });
    expect(geminiSpy).not.toHaveBeenCalled();
    expect(groqSpy).not.toHaveBeenCalled();
  });

  it("returns 502 PROVIDER_ERROR when both providers fail", async () => {
    jest.spyOn(geminiProvider, "generate").mockRejectedValue(new Error("Gemini down"));
    jest.spyOn(groqProvider, "generate").mockRejectedValue(new Error("Groq down"));

    const response = await POST(
      createRequest(JSON.stringify({ idea: "A valid product planning idea" }))
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: true,
      code: "PROVIDER_ERROR",
      message: "Both AI providers failed. Please try again shortly.",
    });
  });

  it("returns 504 TIMEOUT when fallback ends with a provider timeout", async () => {
    jest.spyOn(geminiProvider, "generate").mockRejectedValue(new Error("Gemini down"));
    jest.spyOn(groqProvider, "generate").mockRejectedValue(new Error("TIMEOUT"));

    const response = await POST(
      createRequest(JSON.stringify({ idea: "A valid product planning idea" }))
    );
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body).toEqual({
      error: true,
      code: "TIMEOUT",
      message: "The AI provider timed out. Please try again shortly.",
    });
  });
});
