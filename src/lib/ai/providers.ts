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

/**
 * A prompt as two separately-addressed parts, never as one string.
 *
 * `system` is this application's instructions. `user` is the end user's text,
 * fenced. They travel in different message roles because that is the only
 * separation the model actually sees: delimiters are a convention the model may
 * or may not honour, while the role boundary is structural. Merging them back
 * into one string — however carefully fenced — puts the rules and the untrusted
 * data at the same level of authority again, which is the condition prompt
 * injection needs.
 *
 * Kept as an object rather than two positional strings so a caller cannot pass
 * them the wrong way round; `{system, user}` is impossible to transpose by
 * accident, `(a, b)` is not.
 */
export interface Prompt {
  /** This application's rules. Never contains user-supplied text. */
  system: string;
  /** The end user's text, already fenced. Never contains rules. */
  user: string;
}

export interface AIProvider {
  name: ProviderName;
  /**
   * `timeoutMs` is the budget for THIS attempt, handed down by
   * `generateWithFallback` so the whole chain stays inside one deadline.
   * Optional so a direct caller (a script, a test) still works without it.
   */
  generate(prompt: Prompt, timeoutMs?: number): Promise<ModelReply>;
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

  /**
   * How many providers were actually called before the chain gave up.
   *
   * Carried on the error so the failure path can log the same failover fact the
   * success path does (Module B2). Optional because a ProviderError can be
   * constructed by a caller that never ran a chain, and because every existing
   * throw site predates this field.
   *
   * Zero and one are not the same story: zero means nothing was configured,
   * one means a single provider was tried and failed while the rest were
   * skipped for want of a key.
   */
  readonly attempts?: number;

  constructor(code: ProviderErrorCode, attempts?: number) {
    super(code);
    this.name = "ProviderError";
    this.code = code;
    this.attempts = attempts;
  }
}

// ---- Configuration ----
//
// Per attempt. Raised from 15 s on 2026-08-28, but NOT for the reason it looks
// like. Measured over 8 live runs at each setting:
//
//   15 s: 3 of 8 timed out on NVIDIA and fell through — median 14.2 s, max 22.3 s
//   30 s: 0 of 8 timed out; NVIDIA answered in 9.8-25.8 s — median 16.1 s, max 25.9 s
//
// So this does NOT make requests faster. End-to-end latency is a wash, and the
// median is marginally worse: a 25 s answer from tier one costs about what a
// 15 s timeout plus a 20 s fallback cost. What changes is that the wait now buys
// something. At 15 s a third of requests paid the full timeout and threw the
// result away, then spent a Groq call — and Groq meters tokens per minute, which
// has already broken evidence captures. Fewer discarded attempts is the argument
// here; speed is not.
const DEFAULT_TIMEOUT_MS = 30_000;

// For the whole chain, across every attempt. Raising the per-attempt budget
// without this would put the three-tier worst case near 90 s, and a serverless
// platform kills the function before that: the caller then gets the platform's
// own 504 instead of this app's typed TIMEOUT envelope, which breaks the
// contract that every failure carries a code. The budget is what keeps the
// worst case bounded regardless of how many tiers are configured.
const DEFAULT_TOTAL_BUDGET_MS = 50_000;

/** Read at call time, not module load, so tests can vary it per case. */
export function getTimeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** The ceiling for the whole failover chain. See DEFAULT_TOTAL_BUDGET_MS. */
export function getTotalBudgetMs(): number {
  const raw = Number(process.env.AI_TOTAL_BUDGET_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TOTAL_BUDGET_MS;
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
  prompt: Prompt,
  timeoutMs?: number
): Promise<ModelReply> {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelFor(provider),
      // Two roles, not one. Until 2026-09-03 this sent a single `user` message
      // holding the rules and the user's idea concatenated, which meant the
      // model had no structural reason to treat one as more authoritative than
      // the other. The system role is also what makes the prefix byte-identical
      // across requests, which is the condition provider-side prefix caching
      // needs — see A2 in docs/upgrade-checklist.md.
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4096,
    }),
  }, timeoutMs ?? getTimeoutMs());

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
  async generate(prompt: Prompt, timeoutMs?: number) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("MISSING_NVIDIA_API_KEY");

    return openAICompatibleGenerate(
      "nvidia",
      `${NVIDIA_BASE_URL}/chat/completions`,
      apiKey,
      prompt,
      timeoutMs
    );
  },
};

// ---- Groq (fallback 1) ----
export const groqProvider: AIProvider = {
  name: "groq",
  async generate(prompt: Prompt, timeoutMs?: number) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("MISSING_GROQ_API_KEY");

    return openAICompatibleGenerate(
      "groq",
      `${GROQ_BASE_URL}/chat/completions`,
      apiKey,
      prompt,
      timeoutMs
    );
  },
};

// ---- Gemini (fallback 2) ----
export const geminiProvider: AIProvider = {
  name: "gemini",
  async generate(prompt: Prompt, timeoutMs?: number) {
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
          // Gemini's own field for the same separation the OpenAI-compatible
          // providers get from the system role. It is not a stylistic mirror:
          // instructions sent here are outside `contents`, so nothing the user
          // wrote shares a container with them.
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ parts: [{ text: prompt.user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      },
      timeoutMs ?? getTimeoutMs()
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
 * the final attempt aborted on the clock or the chain ran out of total budget.
 */
export async function generateWithFallback(
  prompt: Prompt
): Promise<{ result: ModelReply; providerUsed: ProviderName; attempts: number }> {
  const order = getProviderOrder();

  // One deadline for the whole chain. Each attempt gets whichever is smaller:
  // its own budget, or whatever is left. Without this the worst case is
  // per-attempt x tiers, which grows every time a provider is added.
  const deadline = Date.now() + getTotalBudgetMs();

  // Sticky: if any provider in the chain aborted on the clock, the caller is
  // told TIMEOUT (504, "retry shortly") rather than a hard PROVIDER_ERROR (502).
  let sawTimeout = false;
  let allInvalidOutput = true;
  let attempted = 0;

  for (const name of order) {
    const provider = PROVIDERS[name];

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      // Out of clock with tiers still untried. Reported as a timeout because
      // that is what it is from the caller's seat, and because a 504 "try again
      // shortly" is the honest answer when the chain never got to finish.
      console.warn(`AI provider chain out of budget before ${name}.`);
      sawTimeout = true;
      break;
    }

    try {
      const result = await provider.generate(prompt, Math.min(getTimeoutMs(), remaining));
      // Counted here rather than at the top of the loop: `attempted` must mean
      // "providers that were actually called", and the winning call is one of
      // them. A provider skipped for a missing key never reaches this line and
      // never increments — which is the whole point of the number.
      return { result, providerUsed: name, attempts: attempted + 1 };
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
    throw new ProviderError("not_configured", 0);
  }

  console.error("AI provider fallback exhausted.");
  if (sawTimeout) throw new ProviderError("timeout", attempted);
  if (allInvalidOutput) throw new ProviderError("invalid_provider_output", attempted);
  throw new ProviderError("all_providers_failed", attempted);
}
