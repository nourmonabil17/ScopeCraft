// src/app/api/scopecraft/[id]/route.ts
//
// Board persistence (owner: Yousef).
//
// THE TRUST BOUNDARY THIS ROUTE EXISTS TO PROTECT. `plans.response` holds what
// the AI produced. `plans.board` holds what the human decided afterwards. This
// route can write the second and can **never** write the first — the update
// statement names one column, and a test asserts it. Blurring those two would
// destroy the product's central claim: that you can always tell the model's
// output from the human's edits.
//
// WHAT IS STORED. Only `points` and `column` per story, because they are the
// only two things the board lets a person change. Score, MoSCoW bucket and
// capacity are recomputed from them on load. Storing derived numbers would make
// a saved board a second source of truth for arithmetic the code owns.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import {
  BoardSchema,
  MAX_REQUEST_BODY_BYTES,
  type ScopeCraftError,
} from "@/lib/scopecraft/schema";

export const runtime = "nodejs";

function fail(
  code: ScopeCraftError["code"],
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: true, code, message }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Same ordering discipline as the generate route: session first, then cheap
  // local checks, and only then a database round trip.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return fail("UNAUTHORIZED", "Please sign in to save changes.", 401);
  }

  const { id } = await params;
  // Reject a malformed id before it reaches Postgres, where an invalid uuid is
  // a thrown error rather than an empty result. Answered as 404 rather than
  // 422 so "not a uuid" and "not your plan" are indistinguishable from outside.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  const raw = await req.text();
  if (raw.length > MAX_REQUEST_BODY_BYTES) {
    return fail("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = BoardSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Those board changes could not be saved.", 422);
  }

  // Scoped by user_id from the **session**, never from the request. This is the
  // one place an IDOR could enter this codebase: without that predicate, any
  // signed-in user could overwrite any other user's board by guessing an id.
  // A row that exists but belongs to someone else updates nothing and is
  // reported as 404 — the same answer as a row that does not exist, so the
  // endpoint cannot be used to discover which ids are real.
  const rows = await sql`
    update plans set board = ${sql.json(parsed.data)}
    where id = ${id} and user_id = ${userId}
    returning id`;

  if (rows.length === 0) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  return new NextResponse(null, { status: 204 });
}
