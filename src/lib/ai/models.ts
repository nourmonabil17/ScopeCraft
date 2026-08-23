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

export const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
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
