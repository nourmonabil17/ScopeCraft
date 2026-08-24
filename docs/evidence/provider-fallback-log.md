# Provider Fallback & Error Log

**Owner:** Yousef Mohmed Hasabo (AI & Backend Engineer)
**Satisfies:** the *"provider fallback/error log"* row of the Individual Acceptance & Review
tracker, and the criterion *"Groq/Gemini fallback or a documented safe provider-failure path
is demonstrated."*
**Captured:** 2026-08-24 11:27:57 UTC, at commit `d05710d`, against a production build with
all three provider credentials live.

**Raw, unedited server output:** [`raw/provider-fallback.log`](raw/provider-fallback.log).
Every log line quoted below is the application's own `console` output, captured from the
server process — not a transcription.

## The chain

Three tiers, resolved at call time from `PRIMARY_AI_PROVIDER` (default `nvidia`):

```
NVIDIA NIM  ──fails──▶  Groq  ──fails──▶  Gemini  ──fails──▶  502 / 504
```

A provider with **no credential** is *skipped*, not failed, so a deployment that configures
only one key still works. A provider that *has* a credential and fails counts as an attempt.
Implementation: `generateWithFallback` in [`src/lib/ai/providers.ts`](../../src/lib/ai/providers.ts).

## How each scenario was forced

Real failures, not mocks. Next.js does not override variables already present in
`process.env`, so the capture script starts the server with a prefix environment that wins
over `.env.local`:

| Scenario | Environment | Failure mode |
|---|---|---|
| 2 | `NVIDIA_API_KEY=INVALID_KEY_FOR_EVIDENCE_CAPTURE` | real `401` from NVIDIA |
| 3 | NVIDIA + Groq invalid | real `401` from both |
| 4 | all three invalid | real auth failure from all three |
| 5 | all three set to empty string | no credential present at all |
| 6 | `AI_TIMEOUT_MS=1`, credentials valid | `AbortController` fires before any response |

---

## Scenario 2 — one hop: NVIDIA fails, Groq serves

```
AI provider failed: nvidia (unavailable); trying next provider.
```

Response: `HTTP/1.1 200 OK`, `x-provider-used: groq`. The user got a complete plan; the
failure is visible only in the server log. Groq returned 8 stories worth 39 points; the
deterministic planner committed **28 of 30** and **deferred 3 stories** — the capacity bound
holding on a real fallback response rather than on a fixture.
Body: [`raw/200-response-groq.json`](raw/200-response-groq.json).

## Scenario 3 — two hops: NVIDIA and Groq fail, Gemini serves

```
AI provider failed: nvidia (unavailable); trying next provider.
AI provider failed: groq (unavailable); trying next provider.
```

Response: `HTTP/1.1 200 OK`, `x-provider-used: gemini`. The chain walks the full depth and
still returns a valid plan. Body: [`raw/200-response-gemini.json`](raw/200-response-gemini.json).

## Scenario 4 — the chain is exhausted

```
AI provider failed: nvidia (unavailable); trying next provider.
AI provider failed: groq (unavailable); trying next provider.
AI provider failed: gemini (unavailable); trying next provider.
AI provider fallback exhausted.
scopecraft.request_failed code=PROVIDER_ERROR status=502
```

```http
HTTP/1.1 502 Bad Gateway
```
```json
{"error":true,"code":"PROVIDER_ERROR","message":"No AI provider could be reached. Please try again shortly."}
```

Three attempts, one summary line, one route-level line. The caller is told to retry; it is
not told which providers exist, which one failed, or why.

## Scenario 5 — nothing is configured

```
No AI provider is configured.
scopecraft.request_failed code=PROVIDER_ERROR status=502
```

```json
{"error":true,"code":"PROVIDER_ERROR","message":"No AI provider is configured. Please try again shortly."}
```

Note the distinction, and that it is deliberate: **no** `AI provider failed` lines appear.
Providers without a credential are skipped rather than attempted, so a misconfigured
deployment is reported as a configuration problem instead of masquerading as three
upstream outages.

## Scenario 6 — every provider aborts on the clock

```
AI provider failed: nvidia (timeout); trying next provider.
AI provider failed: groq (timeout); trying next provider.
AI provider failed: gemini (timeout); trying next provider.
AI provider fallback exhausted.
scopecraft.request_failed code=TIMEOUT status=504
```

```http
HTTP/1.1 504 Gateway Timeout
```
```json
{"error":true,"code":"TIMEOUT","message":"The AI provider timed out. Please try again shortly."}
```

The failure reason is carried through the whole chain: a timeout anywhere in it is *sticky*,
so the caller receives `504 TIMEOUT` ("try again shortly") rather than a flat `502`. A slow
provider and an unreachable one are different operational events and are reported as such.

---

## What the log does *not* contain

This is the half of the criterion that matters for *"server logs are useful but do not expose
secrets or unnecessary user data."* Across all six scenarios, with three real credentials in
the environment, the captured log contains:

- **No credential.** The capture script greps every file it writes for `nvapi-`, `gsk_` and
  `AIza` patterns and aborts the run on a hit. This run reported `CLEAN`.
- **No credential variable names**, not even as an absence marker.
- **No request payload.** The user's product idea appears nowhere in the log.
- **No raw `Error` object and no stack trace.** This is load-bearing rather than tidiness: a
  provider SDK error's `message` can embed the request URL, and therefore the key. Only the
  provider name and a classified reason (`unavailable` / `timeout` / `invalid output`) are
  ever passed to `console`.
- **No model IDs or endpoint URLs.**

4xx rejections are not logged at all, and a `422 OUT_OF_DOMAIN` refusal is not logged as a
server failure — a user asking for something out of scope is not an incident. Exactly one
line per 5xx: `scopecraft.request_failed code=<CODE> status=<NNN>`.

## Coverage note

Five of the six documented failure paths are demonstrated live here: `PROVIDER_ERROR`
(unreachable), `PROVIDER_ERROR` (unconfigured), `TIMEOUT`, and both fallback hops.
`SCHEMA_VIOLATION` and `PLANNING_ERROR` require a provider to return specific *malformed
content* on demand, which cannot be forced from the outside without a stub — both are covered
by unit tests in [`tests/api/scopecraft.test.ts`](../../tests/api/scopecraft.test.ts)
(`returns 502 SCHEMA_VIOLATION after one retry when output stays unusable`, and a
`PLANNING_ERROR` case table) and by the exact-payload table in
[`api-contracts.md`](../api-contracts.md). `OUT_OF_DOMAIN` depends on the model choosing to
emit the refusal envelope and is therefore not deterministic enough to assert in a capture
run; it too is unit-tested (`returns 422 OUT_OF_DOMAIN instead of fabricating a plan`).
