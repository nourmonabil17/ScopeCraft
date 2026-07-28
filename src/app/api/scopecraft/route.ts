// src/app/api/scopecraft/route.ts
//
// AI & Backend endpoint (owner: Youssef).
// Validates input, calls Gemini with Groq fallback, and returns a
// deterministically recalculated sprint plan.

import { NextRequest, NextResponse } from "next/server";
import {
  getClarification,
  validateRequest,
  ScopeCraftError,
} from "@/lib/scopecraft/schema";
import { runScopeCraft } from "@/lib/scopecraft/service";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
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
