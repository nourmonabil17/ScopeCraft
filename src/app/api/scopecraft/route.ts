// src/app/api/scopecraft/route.ts
//
// Session 1 deliverable (AI & Backend Engineer — Nour):
// Stub Route Handler. Validates input and returns DETERMINISTIC sample data.
// No real AI provider call yet — that comes in Session 2.

import { NextRequest, NextResponse } from "next/server";
import { validateRequest, ScopeCraftError } from "@/lib/scopecraft/schema";
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
      message: "Field 'idea' is required and must be at least 5 characters.",
    };
    return NextResponse.json(err, { status: 400 }); // never calls a provider on bad input
  }

  try {
    const { data, providerUsed } = await runScopeCraft(validated);
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Provider-Used": providerUsed },
    });
  } catch {
    const err: ScopeCraftError = {
      error: true,
      code: "PROVIDER_ERROR",
      message: "Both AI providers failed. Please try again shortly.",
    };
    return NextResponse.json(err, { status: 502 });
  }
}
