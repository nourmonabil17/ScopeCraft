// src/lib/ai/providers.ts
//
// Session 2 deliverable (AI & Backend — Nour):
// Provider abstraction so we can swap Gemini <-> Groq, with fallback.
// Both providers are asked to return STRICT JSON matching our schema.

import { ScopeCraftResponse } from "@/lib/scopecraft/schema";

export interface AIProvider {
  name: "gemini" | "groq";
  generate(prompt: string): Promise<ScopeCraftResponse>;
}

// ---- Prompt contract (versioned so we can track changes) ----
export const PROMPT_VERSION = "v1";

export function buildPrompt(idea: string, constraints?: string): string {
  return `
You are a product-planning assistant. Return ONLY valid JSON, no markdown, no prose.
The JSON MUST match this exact shape:
{
  "problem": string,
  "target_user": string,
  "goals": string[],
  "non_goals": string[],
  "requirements": string[],
  "user_stories": [{ "id": string, "as_a": string, "i_want": string, "so_that": string, "acceptance_criteria": string[] }],
  "acceptance_criteria": string[],
  "risks": [{ "id": string, "description": string, "impact": "low"|"medium"|"high", "likelihood": "low"|"medium"|"high" }],
  "priority": { [storyId: string]: number },
  "effort": { [storyId: string]: number },
  "sprint": [{ "story_id": string, "priority_score": number, "effort": number, "sprint": number }]
}

Idea: ${idea}
Constraints: ${constraints ?? "none provided"}
`.trim();
}

function safeParseModelJSON(raw: string): ScopeCraftResponse {
  // Strip accidental code fences before parsing
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned); // throws if invalid -> caught by caller
  return parsed as ScopeCraftResponse;
}

// ---- Gemini provider ----
export const geminiProvider: AIProvider = {
  name: "gemini",
  async generate(prompt: string) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return safeParseModelJSON(text);
  },
};

// ---- Groq provider ----
export const groqProvider: AIProvider = {
  name: "groq",
  async generate(prompt: string) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return safeParseModelJSON(text);
  },
};

// ---- Fallback wrapper: try Gemini first, fall back to Groq ----
export async function generateWithFallback(
  idea: string,
  constraints?: string
): Promise<{ result: ScopeCraftResponse; providerUsed: "gemini" | "groq" }> {
  const prompt = buildPrompt(idea, constraints);

  try {
    const result = await geminiProvider.generate(prompt);
    return { result, providerUsed: "gemini" };
  } catch (geminiErr) {
    console.warn("Gemini failed, falling back to Groq:", geminiErr);
    try {
      const result = await groqProvider.generate(prompt);
      return { result, providerUsed: "groq" };
    } catch (groqErr) {
      console.error("Both providers failed:", groqErr);
      throw new Error("PROVIDER_ERROR"); // caller turns this into a 502 response
    }
  }
}
