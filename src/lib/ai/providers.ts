// src/lib/ai/providers.ts
//
// AI & Backend provider layer (owner: Youssef) — Module 1.
//
// Three-tier failover: NVIDIA NIM (primary) -> Groq -> Gemini.
// Every provider is asked for STRICT JSON matching the ScopeCraft schema, is
// wrapped in an AbortController timeout, and reads its credential from a
// server-only environment variable. This module is imported exclusively by
// server code; nothing here may ever reach the client bundle.
//
// Logging rule: only provider names and error codes are ever logged. Raw error
// objects are deliberately never passed to console, because a provider SDK error
// can carry the request URL — and therefore a credential — in its message.

import {
  validateModelReply,
  type ModelReply,
} from "@/lib/scopecraft/schema";
import {
  modelFor,
  NVIDIA_BASE_URL,
  GROQ_BASE_URL,
  GEMINI_BASE_URL,
  DEFAULT_NVIDIA_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GEMINI_MODEL,
  type ProviderName,
} from "./models";

// ---- Provider identity ----
// Endpoints and model IDs live in ./models so scripts/smoke-test.ts can import
// them without pulling in the whole server dependency graph.
export {
  modelFor,
  NVIDIA_BASE_URL,
  GROQ_BASE_URL,
  GEMINI_BASE_URL,
  DEFAULT_NVIDIA_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GEMINI_MODEL,
};
export type { ProviderName };

export interface AIProvider {
  name: ProviderName;
  generate(prompt: string): Promise<ModelReply>;
}

// ---- Typed errors ----
export type ProviderErrorCode =
  | "timeout"
  | "not_configured"
  | "provider_unavailable"
  | "invalid_provider_output"
  | "all_providers_failed";

/**
 * Typed provider failure. `code` is the single source of truth and is what the
 * route branches on.
 *
 * The Module 1 legacy message bridge (forcing `message` to "TIMEOUT" /
 * "PROVIDER_ERROR" so the un-migrated route could compare strings) was removed
 * in Module 4. `message` is now simply the code.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super(code);
    this.name = "ProviderError";
    this.code = code;
  }
}

// ---- Configuration ----
const DEFAULT_TIMEOUT_MS = 15_000;

/** Read at call time, not module load, so tests can vary it per case. */
export function getTimeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** Kept as a named export for callers that want the configured default. */
export const PROVIDER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

// ---- Timeout wrapper ----
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = getTimeoutMs()
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProviderError("timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function safeParseModelJSON(raw: string): ModelReply {
  // Strip accidental code fences before parsing.
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ProviderError("invalid_provider_output");
  }

  // A refusal is a valid reply, not a malformed one.
  const reply = validateModelReply(parsed);
  if (!reply) throw new ProviderError("invalid_provider_output");
  return reply;
}

// ---- OpenAI-compatible chat completion (NVIDIA NIM and Groq share this shape) ----
async function openAICompatibleGenerate(
  provider: ProviderName,
  url: string,
  apiKey: string,
  prompt: string
): Promise<ModelReply> {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelFor(provider),
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    // Status only. The response body can echo the request, including the key.
    throw new ProviderError("provider_unavailable");
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return safeParseModelJSON(text);
}

// ---- NVIDIA NIM (primary) ----
export const nvidiaProvider: AIProvider = {
  name: "nvidia",
  async generate(prompt: string) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("MISSING_NVIDIA_API_KEY");

    return openAICompatibleGenerate(
      "nvidia",
      `${NVIDIA_BASE_URL}/chat/completions`,
      apiKey,
      prompt
    );
  },
};

// ---- Groq (fallback 1) ----
export const groqProvider: AIProvider = {
  name: "groq",
  async generate(prompt: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("MISSING_GROQ_API_KEY");

    return openAICompatibleGenerate(
      "groq",
      `${GROQ_BASE_URL}/chat/completions`,
      apiKey,
      prompt
    );
  },
};

// ---- Gemini (fallback 2) ----
export const geminiProvider: AIProvider = {
  name: "gemini",
  async generate(prompt: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("MISSING_GEMINI_API_KEY");

    // The key travels in a header, never in the query string: URLs are recorded
    // by proxies, browsers and error trackers; headers are not.
    const res = await fetchWithTimeout(
      `${GEMINI_BASE_URL}/models/${modelFor("gemini")}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) throw new ProviderError("provider_unavailable");

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return safeParseModelJSON(text);
  },
};

// ---- Failover ordering ----
const PROVIDERS: Record<ProviderName, AIProvider> = {
  nvidia: nvidiaProvider,
  groq: groqProvider,
  gemini: geminiProvider,
};

const DEFAULT_ORDER: ProviderName[] = ["nvidia", "groq", "gemini"];

function isProviderName(value: string): value is ProviderName {
  return value === "nvidia" || value === "groq" || value === "gemini";
}

/**
 * Resolved at call time so PRIMARY_AI_PROVIDER can be changed without a rebuild.
 * The configured primary is attempted first; the remaining providers keep their
 * default relative order behind it.
 */
export function getProviderOrder(): ProviderName[] {
  const configured = (process.env.PRIMARY_AI_PROVIDER ?? "").trim().toLowerCase();
  if (!isProviderName(configured)) return [...DEFAULT_ORDER];
  return [configured, ...DEFAULT_ORDER.filter((name) => name !== configured)];
}

function isMissingKeyError(error: unknown): boolean {
  return (
    error instanceof Error && /^MISSING_[A-Z]+_API_KEY$/.test(error.message)
  );
}

/**
 * A timeout can arrive either as a typed ProviderError or, from older throw
 * sites and test doubles, as a plain Error whose message is the legacy token.
 */
function isTimeoutError(error: unknown): boolean {
  if (error instanceof ProviderError) return error.code === "timeout";
  return error instanceof Error && error.message === "TIMEOUT";
}

/** Duck-typed for the same reason as isTimeoutError: test doubles and any
 *  future throw site should not have to be a ProviderError instance. */
function isInvalidOutputError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as { code?: string }).code === "invalid_provider_output"
  );
}

/**
 * Try each configured provider in order and return the first schema-valid
 * result. A provider with no credential is skipped rather than treated as a
 * failure, so a team that configures only one key still gets a working app.
 *
 * Throws ProviderError("all_providers_failed"), or ProviderError("timeout") when
 * the final attempt aborted on the clock.
 */
export async function generateWithFallback(
  prompt: string
): Promise<{ result: ModelReply; providerUsed: ProviderName }> {
  const order = getProviderOrder();

  // Sticky: if any provider in the chain aborted on the clock, the caller is
  // told TIMEOUT (504, "retry shortly") rather than a hard PROVIDER_ERROR (502).
  let sawTimeout = false;
  let allInvalidOutput = true;
  let attempted = 0;

  for (const name of order) {
    const provider = PROVIDERS[name];
    try {
      const result = await provider.generate(prompt);
      return { result, providerUsed: name };
    } catch (error) {
      if (isMissingKeyError(error)) {
        // Not configured — skip silently, do not count as an attempt.
        continue;
      }

      attempted += 1;
      const timedOut = isTimeoutError(error);
      sawTimeout = sawTimeout || timedOut;
      const invalidOutput = isInvalidOutputError(error);
      allInvalidOutput = allInvalidOutput && invalidOutput;

      // Name and code only — never the error object.
      console.warn(
        `AI provider failed: ${name} (${
          timedOut ? "timeout" : invalidOutput ? "invalid output" : "unavailable"
        }); trying next provider.`
      );
    }
  }

  if (attempted === 0) {
    console.error("No AI provider is configured.");
    throw new ProviderError("not_configured");
  }

  console.error("AI provider fallback exhausted.");
  if (sawTimeout) throw new ProviderError("timeout");
  if (allInvalidOutput) throw new ProviderError("invalid_provider_output");
  throw new ProviderError("all_providers_failed");
}
