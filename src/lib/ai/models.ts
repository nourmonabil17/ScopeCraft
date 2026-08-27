// src/lib/ai/models.ts
//
// Provider endpoints and model IDs (owner: Youssef).
//
// Deliberately dependency-free — no imports, no path aliases. `providers.ts`
// re-exports everything here, and `scripts/smoke-test.ts` imports it by relative
// path so the live connectivity check and the running application can never
// disagree about which model is being called.

export type ProviderName = "nvidia" | "groq" | "gemini";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Was `meta/llama-3.1-8b-instruct` until 2026-08-27, when NVIDIA retired it —
// the endpoint answers HTTP 410 Gone, and every Llama 3.x instruct model has
// left the NIM catalogue with it. A default that 410s means anyone cloning this
// repository gets a dead first tier and a failover chain that only looks like
// it has three links.
//
// LATENCY, stated because it is the real constraint and no model choice fixes
// it. Measured on this account for a full-PRD request: this model returns valid
// JSON every time, but in 9.3 s, 18.6 s and 26.0 s across three consecutive
// runs. `AI_TIMEOUT_MS` defaults to 15 s, so NVIDIA times out more often than
// not and the request falls through to Groq. That is the failover chain working
// as designed rather than a fault, but it does mean tier one is unreliable at
// the default budget. The alternatives were worse: every other reachable NIM
// model either 404s on this account or exceeds 30 s.
export const DEFAULT_NVIDIA_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Model IDs are environment-overridable because hosted availability changes
 * independently of this repository. Read at call time, never at module load, so
 * a test or a script can vary it without a rebuild.
 */
export function modelFor(provider: ProviderName): string {
  switch (provider) {
    case "nvidia":
      return process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL;
    case "groq":
      return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    case "gemini":
      return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  }
}

/** The env var holding each provider's credential. Names only — never values. */
export const API_KEY_ENV_VAR: Record<ProviderName, string> = {
  nvidia: "NVIDIA_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
};
