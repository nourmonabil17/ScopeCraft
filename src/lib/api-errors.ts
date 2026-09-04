// src/lib/api-errors.ts
//
// The typed failure contract for anything that calls a provider (owner: Yousef).
//
// Extracted when a second route started generating: regenerating one story can
// fail every way a full generation can — refusal, unusable estimates, a provider
// that answered with garbage twice, a chain that ran out of clock — and two
// copies of this mapping would drift, which means the same failure would answer
// 502 on one endpoint and 504 on the other.
//
// It returns a DESCRIPTOR rather than a NextResponse so the caller keeps its own
// response shape and its own logging. That also removed the previous
// `readErrorCode`, which re-parsed a response the route had just built in order
// to recover the code it already knew.

import {
  OutOfDomainError,
  PlanningError,
  SchemaViolationError,
} from "@/lib/scopecraft/service";
import { ProviderError } from "@/lib/ai/providers";
import type { ScopeCraftErrorCode } from "@/lib/scopecraft/schema";

export interface GenerationFailure {
  code: ScopeCraftErrorCode;
  message: string;
  status: number;
}

export function mapGenerationError(error: unknown): GenerationFailure {
  if (error instanceof OutOfDomainError) {
    return { code: "OUT_OF_DOMAIN", message: "ScopeCraft only plans software products.", status: 422 };
  }

  if (error instanceof PlanningError) {
    return { code: "PLANNING_ERROR", message: "The generated stories could not be converted into a valid sprint plan.", status: 502 };
  }

  // Distinct from PROVIDER_ERROR: the provider answered, twice, with output
  // that does not satisfy the contract. Reachability is not the problem.
  if (error instanceof SchemaViolationError) {
    return { code: "SCHEMA_VIOLATION", message: "The AI provider returned an unusable response. Please try again.", status: 502 };
  }

  // Typed provider failures. `.code` is authoritative; the legacy message
  // bridge introduced in Module 1 is no longer consulted.
  if (error instanceof ProviderError) {
    if (error.code === "timeout") {
      return { code: "TIMEOUT", message: "The AI provider timed out. Please try again shortly.", status: 504 };
    }
    if (error.code === "not_configured") {
      return { code: "PROVIDER_ERROR", message: "No AI provider is configured. Please try again shortly.", status: 502 };
    }
    return { code: "PROVIDER_ERROR", message: "No AI provider could be reached. Please try again shortly.", status: 502 };
  }

  // Interop: a non-ProviderError carrying the legacy TIMEOUT token.
  if (error instanceof Error && error.message === "TIMEOUT") {
    return { code: "TIMEOUT", message: "The AI provider timed out. Please try again shortly.", status: 504 };
  }

  return { code: "PROVIDER_ERROR", message: "No AI provider could be reached. Please try again shortly.", status: 502 };
}
