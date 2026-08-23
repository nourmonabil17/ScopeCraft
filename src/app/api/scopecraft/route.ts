// src/app/api/scopecraft/route.ts
//
// AI & Backend endpoint (owner: Youssef) — Module 4.
//
// Security boundary. Everything cheap and local happens before anything expensive
// and remote: size cap, then JSON parse, then schema validation, then the domain
// clarification check. No provider module is touched until all four have passed,
// so a malformed request costs zero tokens.
//
// Error discipline. Every failure is mapped to a typed code and a user-safe
// message. Messages never contain provider names, model IDs, stack traces,
// request payloads, or credentials. Logs carry the error code and status only —
// never the request body and never a raw Error object, since a provider error's
// message can contain the request URL and therefore a key.

import { NextRequest, NextResponse } from "next/server";
import {
  getClarification,
  MAX_REQUEST_BODY_BYTES,
  normalizeRequestInput,
  RequestSchema,
  type ScopeCraftError,
  type ValidationIssue,
} from "@/lib/scopecraft/schema";
import {
  OutOfDomainError,
  PlanningError,
  SchemaViolationError,
  runScopeCraft,
} from "@/lib/scopecraft/service";
import { ProviderError } from "@/lib/ai/providers";

export const runtime = "nodejs";

/** Sanitized server log. Code and status only — never payloads or credentials. */
function logFailure(code: string, status: number): void {
  console.error(`scopecraft.request_failed code=${code} status=${status}`);
}

function fail(
  code: ScopeCraftError["code"],
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  if (status >= 500) logFailure(code, status);
  const body: ScopeCraftError = { error: true, code, message };
  return NextResponse.json({ ...body, ...extra }, { status });
}

async function readLimitedBody(
  req: NextRequest
): Promise<{ text: string; tooLarge: boolean }> {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return { text: "", tooLarge: true };
  }

  if (!req.body) return { text: "", tooLarge: false };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      return { text: "", tooLarge: true };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(body), tooLarge: false };
}

export async function POST(req: NextRequest) {
  // ---- 1. Size cap (before reading anything into memory) ----
  let body: unknown;
  try {
    const requestBody = await readLimitedBody(req);
    if (requestBody.tooLarge) {
      return fail("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }
    // ---- 2. Syntax ----
    body = JSON.parse(requestBody.text);
  } catch {
    return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  // ---- 3. Schema. Still no provider module has been touched. ----
  const parsed = RequestSchema.safeParse(normalizeRequestInput(body));
  if (!parsed.success) {
    // Only path and message are forwarded. Zod's `received`/`input` fields are
    // deliberately dropped so a rejected request can never echo user data back.
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    return fail(
      "VALIDATION_ERROR",
      "Some fields need attention before a plan can be generated.",
      422,
      { issues }
    );
  }

  // ---- 4. Domain clarification (local heuristic, still no provider call) ----
  const clarification = getClarification(parsed.data);
  if (clarification) {
    return fail(
      "CLARIFICATION_REQUIRED",
      "Please clarify the product idea before generating a plan.",
      422,
      { questions: clarification.questions }
    );
  }

  // ---- 5. Generate ----
  try {
    const { data, providerUsed, promptVersion } = await runScopeCraft(parsed.data);
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Provider-Used": providerUsed,
        "X-Prompt-Version": promptVersion,
      },
    });
  } catch (error) {
    return mapGenerationError(error);
  }
}

function mapGenerationError(error: unknown): NextResponse {
  if (error instanceof OutOfDomainError) {
    return fail(
      "OUT_OF_DOMAIN",
      "ScopeCraft only plans software products.",
      422
    );
  }

  if (error instanceof PlanningError) {
    return fail(
      "PLANNING_ERROR",
      "The generated stories could not be converted into a valid sprint plan.",
      502
    );
  }

  // Distinct from PROVIDER_ERROR: the provider answered, twice, with output
  // that does not satisfy the contract. Reachability is not the problem.
  if (error instanceof SchemaViolationError) {
    return fail(
      "SCHEMA_VIOLATION",
      "The AI provider returned an unusable response. Please try again.",
      502
    );
  }

  // Typed provider failures. `.code` is authoritative; the legacy message
  // bridge introduced in Module 1 is no longer consulted.
  if (error instanceof ProviderError) {
    if (error.code === "timeout") {
      return fail(
        "TIMEOUT",
        "The AI provider timed out. Please try again shortly.",
        504
      );
    }
    if (error.code === "not_configured") {
      return fail(
        "PROVIDER_ERROR",
        "No AI provider is configured. Please try again shortly.",
        502
      );
    }
    return fail(
      "PROVIDER_ERROR",
      "No AI provider could be reached. Please try again shortly.",
      502
    );
  }

  // Interop: a non-ProviderError carrying the legacy TIMEOUT token.
  if (error instanceof Error && error.message === "TIMEOUT") {
    return fail(
      "TIMEOUT",
      "The AI provider timed out. Please try again shortly.",
      504
    );
  }

  return fail(
    "PROVIDER_ERROR",
    "No AI provider could be reached. Please try again shortly.",
    502
  );
}
