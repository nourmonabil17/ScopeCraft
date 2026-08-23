#!/usr/bin/env npx tsx
//
// scripts/smoke-test.ts — live provider connectivity check (owner: Youssef).
//
//   npx tsx --env-file-if-exists=.env.local scripts/smoke-test.ts   # or: npm run smoke
//
// `npm run smoke` passes --env-file-if-exists=.env.local so credentials in
// that file are picked up automatically. tsx does not load .env files on its
// own — running the bare `npx tsx scripts/smoke-test.ts` form above without
// that flag will report every provider SKIPPED even with a real .env.local
// present, because nothing put the values into process.env.
//
// WHY THIS EXISTS
// Every automated test in this repository mocks the network. That is correct for
// CI — tests must not depend on a third party or spend tokens — but it leaves one
// real gap: a retired or renamed model ID passes all 127 tests and fails only in
// production. This script is the one thing that closes it, and it is deliberately
// NOT part of `npm test`: it needs real credentials and makes real calls.
//
// SAFETY RULES THIS SCRIPT FOLLOWS
//  - Credentials are read from the environment and never printed, not even
//    truncated or masked — a masked key still confirms a prefix.
//  - Response bodies are never printed. A provider error body can echo the
//    request, and therefore the key.
//  - Output is the status table and nothing else.
//  - Requests are capped at one output token, so a full run costs approximately
//    nothing.
//  - A provider with no credential is SKIPPED, never FAILED. Configuring one key
//    is a legitimate setup.
//
// KNOWN LIMIT — read before trusting a green run
// Providers authenticate before they resolve the model ID, so an invalid
// credential returns 401 and masks whether the model is live. A run is only
// evidence about model IDs when the credential is real: 200 OK proves both, and
// 404 proves the model is gone. Verified by running this script against Groq
// with a deliberately invalid key: it reported 401 even with a nonsense model.
//
// EXIT CODE: 0 when no configured provider failed, 1 otherwise — so CI can gate
// a release on it.

import {
  API_KEY_ENV_VAR,
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  NVIDIA_BASE_URL,
  modelFor,
  type ProviderName,
} from "../src/lib/ai/models";

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) > 0
  ? Number(process.env.AI_TIMEOUT_MS)
  : 15_000;

const PROVIDERS: ProviderName[] = ["nvidia", "groq", "gemini"];

type Status =
  | { kind: "ok"; httpStatus: number }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; detail: string };

interface Row {
  provider: ProviderName;
  model: string;
  status: Status;
}

/**
 * Wraps fetch in an AbortController, mirroring the production timeout so this
 * check exercises the same failure mode the application would see.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Describes a failure without ever quoting the provider's response body.
 * A 401/403 means the credential was rejected; a 404 almost always means the
 * model ID is retired, which is the exact thing this script exists to catch.
 */
function describeHttpFailure(httpStatus: number): string {
  if (httpStatus === 401 || httpStatus === 403) return `HTTP ${httpStatus} (credential rejected)`;
  if (httpStatus === 404) return `HTTP ${httpStatus} (model ID not found)`;
  if (httpStatus === 429) return `HTTP ${httpStatus} (rate limited)`;
  return `HTTP ${httpStatus}`;
}

function describeThrown(error: unknown): string {
  // Never interpolate the error's own message: a fetch/SDK error can carry the
  // request URL, and a URL can carry a credential.
  if (error instanceof Error && error.name === "AbortError") {
    return `timeout after ${TIMEOUT_MS}ms`;
  }
  if (error instanceof Error) return `network error (${error.name})`;
  return "network error";
}

async function ping(provider: ProviderName): Promise<Status> {
  const envVar = API_KEY_ENV_VAR[provider];
  const apiKey = process.env[envVar];
  if (!apiKey) return { kind: "skipped", reason: `${envVar} not set` };

  const model = modelFor(provider);

  try {
    const response = provider === "gemini"
      ? await fetchWithTimeout(
          `${GEMINI_BASE_URL}/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Header, never a ?key= query parameter — URLs land in proxy logs.
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ping" }] }],
              generationConfig: { maxOutputTokens: 1 },
            }),
          }
        )
      : await fetchWithTimeout(
          `${provider === "nvidia" ? NVIDIA_BASE_URL : GROQ_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 1,
            }),
          }
        );

    // The body is deliberately never read. Status alone answers the question:
    // is this credential accepted and is this model ID still live?
    if (!response.ok) return { kind: "failed", detail: describeHttpFailure(response.status) };
    return { kind: "ok", httpStatus: response.status };
  } catch (error) {
    return { kind: "failed", detail: describeThrown(error) };
  }
}

function render(rows: Row[]): void {
  const cell = (row: Row): string => {
    switch (row.status.kind) {
      case "ok": return `${row.status.httpStatus} OK`;
      case "skipped": return `SKIPPED (${row.status.reason})`;
      case "failed": return `FAILED — ${row.status.detail}`;
    }
  };

  const header = ["PROVIDER", "MODEL_ID", "STATUS"] as const;
  const body = rows.map((row) => [row.provider, row.model, cell(row)]);
  const widths = header.map((label, column) =>
    Math.max(label.length, ...body.map((line) => line[column].length))
  );
  const line = (cells: readonly string[]) =>
    cells.map((text, column) => text.padEnd(widths[column])).join("  ").trimEnd();

  console.log("");
  console.log(line(header));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of body) console.log(line(row));
  console.log("");
}

async function main(): Promise<void> {
  // Sequential, not Promise.all: three providers is not worth the concurrency,
  // and a serial run keeps rate-limit behaviour easy to reason about.
  const rows: Row[] = [];
  for (const provider of PROVIDERS) {
    rows.push({ provider, model: modelFor(provider), status: await ping(provider) });
  }

  render(rows);

  const failed = rows.filter((row) => row.status.kind === "failed");
  const configured = rows.filter((row) => row.status.kind !== "skipped");

  if (configured.length === 0) {
    console.log("No provider credentials found. Set at least one of:");
    console.log(`  ${Object.values(API_KEY_ENV_VAR).join(", ")}`);
    console.log("See .env.example. Nothing was called.");
    process.exit(0);
  }

  if (failed.length > 0) {
    console.log(
      `${failed.length} of ${configured.length} configured provider(s) failed. ` +
      "A 404 means the model ID is retired — override it with " +
      "NVIDIA_MODEL / GROQ_MODEL / GEMINI_MODEL rather than editing source."
    );
    process.exit(1);
  }

  console.log(`All ${configured.length} configured provider(s) reachable with a live model ID.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`smoke-test failed to run: ${error instanceof Error ? error.name : "unknown error"}`);
  process.exit(1);
});
