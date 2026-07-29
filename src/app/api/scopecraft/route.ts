// src/app/api/scopecraft/route.ts
//
// AI & Backend endpoint (owner: Youssef).
// Validates input, calls Gemini with Groq fallback, and returns a
// deterministically recalculated sprint plan.

import { NextRequest, NextResponse } from "next/server";
import {
  getClarification,
  MAX_REQUEST_BODY_BYTES,
  validateRequest,
  ScopeCraftError,
} from "@/lib/scopecraft/schema";
import { PlanningError, runScopeCraft } from "@/lib/scopecraft/service";

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
  let body: unknown;
  try {
    const requestBody = await readLimitedBody(req);
    if (requestBody.tooLarge) {
      const err: ScopeCraftError = {
        error: true,
        code: "INVALID_INPUT",
        message: "Request body is too large.",
      };
      return NextResponse.json(err, { status: 413 });
    }
    body = JSON.parse(requestBody.text);
  } catch {
    const err: ScopeCraftError = {
      error: true,
      code: "INVALID_INPUT",
      message: "Request body must be valid JSON.",
    };
    return NextResponse.json(err, { status: 400 });
  }

  const validated = validateRequest(body);
  if (!validated) {
    const err: ScopeCraftError = {
      error: true,
      code: "INVALID_INPUT",
      message: "Request fields are invalid. Check the idea, constraints, and sprint capacity.",
    };
    return NextResponse.json(err, { status: 400 }); // never calls a provider on bad input
  }

  const clarification = getClarification(validated);
  if (clarification) {
    return NextResponse.json(
      {
        error: true,
        code: "CLARIFICATION_REQUIRED",
        message: "Please clarify the product idea before generating a plan.",
        questions: clarification.questions,
      },
      { status: 422 }
    );
  }

  try {
    const { data, providerUsed, promptVersion } = await runScopeCraft(validated);
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Provider-Used": providerUsed,
        "X-Prompt-Version": promptVersion,
      },
    });
  } catch (error) {
    if (error instanceof PlanningError) {
      const err: ScopeCraftError = {
        error: true,
        code: "PLANNING_ERROR",
        message: "The generated stories could not be converted into a valid sprint plan.",
      };
      return NextResponse.json(err, { status: 502 });
    }
    if (error instanceof Error && error.message === "TIMEOUT") {
      const err: ScopeCraftError = {
        error: true,
        code: "TIMEOUT",
        message: "The AI provider timed out. Please try again shortly.",
      };
      return NextResponse.json(err, { status: 504 });
    }
    const err: ScopeCraftError = {
      error: true,
      code: "PROVIDER_ERROR",
      message: "Both AI providers failed. Please try again shortly.",
    };
    return NextResponse.json(err, { status: 502 });
  }
}
