# ScopeCraft — My AI & Backend Checklist

**Name:** Yousef Mohmed Hasabo
**Role:** AI & Backend Engineer
**Last verified:** 2026-08-24 against commit `aa37291`

> Every line below was re-checked against the code on the date above, not carried
> forward from a previous session. Where an earlier version of this file claimed
> something that is no longer true, the correction is noted rather than silently
> overwritten — the history matters for the defense.

## Backend implementation

- [x] I created typed request and response models (`src/lib/scopecraft/schema.ts`).
- [x] Zod is the single source of truth — every type is inferred from a schema, so
      the compile-time type and the runtime check cannot drift.
- [x] I added complete runtime validation for AI responses.
- [x] I validated all required and nested response fields.
- [x] I reject missing, unknown, and incorrectly typed fields.
- [x] I reject malformed provider JSON.
- [x] I removed unsafe TypeScript casting.
- [x] I added valid and invalid request examples (`SAMPLE_VALID_REQUEST`,
      `SAMPLE_INVALID_REQUEST`).

## API endpoint

- [x] I implemented and tested `POST /api/scopecraft`.
- [x] Valid requests return HTTP `200`.
- [x] Request body is capped at 16 KB and streamed — an oversized body returns
      `413 PAYLOAD_TOO_LARGE` without being read into memory.
- [x] Malformed JSON returns `400 INVALID_JSON`.
- [x] Schema-invalid input returns `422 VALIDATION_ERROR` with field-level `issues[]`.
- [x] Ambiguous input returns `422 CLARIFICATION_REQUIRED`.
- [x] Out-of-domain requests return `422 OUT_OF_DOMAIN`.
- [x] Unusable model output returns `502 SCHEMA_VIOLATION` after one retry.
- [x] Unschedulable stories return `502 PLANNING_ERROR`.
- [x] Provider failure returns `502 PROVIDER_ERROR`.
- [x] Provider timeout returns `504 TIMEOUT`.
- [x] Invalid input never contacts an AI provider — the size cap, JSON parse, schema
      check and clarification heuristic all run first, so a bad request costs zero tokens.
- [x] I added provider and prompt-version response headers
      (`X-Provider-Used`, `X-Prompt-Version`).

> **Correction (2026-08-24).** This file previously read
> "Invalid input returns HTTP `400 INVALID_INPUT`". That catch-all code was split in
> Module 5 into `INVALID_JSON` (400, syntax), `PAYLOAD_TOO_LARGE` (413, size) and
> `VALIDATION_ERROR` (422, semantics), following RFC 9110 §15.5. The full status map
> is in `docs/api-contracts.md`, which is canonical if this file and it ever disagree.

## AI providers

- [x] Three-tier failover: **NVIDIA NIM → Groq → Gemini**.
- [x] A provider with no credential is skipped, not failed, so one key still gives a
      working endpoint.
- [x] Missing API keys are detected before any network request.
- [x] Per-attempt timeout is **30 s**, configurable via `AI_TIMEOUT_MS`, with the whole
      chain bounded by `AI_TOTAL_BUDGET_MS` (50 s).
- [x] I added request cancellation using `AbortController`.
- [x] The Gemini credential travels in the `x-goog-api-key` header, never in the URL —
      URLs are logged by proxies and error trackers; headers are not.
- [x] Model IDs are environment-overridable (`NVIDIA_MODEL` / `GROQ_MODEL` /
      `GEMINI_MODEL`) so a retired model is a config change, not a code change.
- [x] **Tested all three providers with real API keys** (`npm run smoke`, 2026-08-24).
- [x] **Confirmed live behaviour** — see "Live verification" below.

> **Correction (2026-08-24).** This file previously said "Gemini as the primary
> provider, Groq as the fallback" with a 10-second timeout and prompt version 2.
> All three were out of date: the chain is now NVIDIA-first with two fallbacks, the
> timeout is 30 s, and the prompt contract is v6.

## Live verification (2026-08-24)

This closes the single largest gap in the project — until this date, every test in
the repository mocked the network, so nothing proved the product actually worked.

- [x] `npm run smoke` run against real credentials for all three providers.
- [x] **It immediately caught a real production bug: all three default model IDs were
      dead.** Groq and Gemini returned `404` (valid credential, retired model); NVIDIA's
      `deepseek-v4-flash-0731` hung to the full timeout rather than erroring. Replaced
      with IDs verified live with a real `200 OK`.
- [x] A real product idea sent through the running app returned a coherent 11-field
      PRD with a valid deterministic `sprint_plan`.
- [x] A live prompt-injection attempt (developer-mode override plus a request for the
      `NVIDIA_API_KEY`) was correctly refused with `422 OUT_OF_DOMAIN`, and the
      response body scanned clean against the credential regexes.
- [x] Fixed a second bug found in the same run: `npm run smoke` silently reported every
      provider `SKIPPED` even with a populated `.env.local`, because `tsx` does not
      auto-load `.env` files. Now uses `--env-file-if-exists`.

Full narrative: `docs/decision-log.md` items 2 and 5.

## Captured evidence (2026-08-24)

My acceptance row requires two artifacts that no test can substitute for: *"Postman/curl
evidence"* and a *"provider fallback/error log"*. Both now exist as committed files under
[`docs/evidence/`](evidence/README.md), captured from a production build against live
providers by `scripts/capture-evidence.sh` (`npm run capture:evidence`).

- [x] **curl evidence** — [`docs/evidence/curl-evidence.md`](evidence/curl-evidence.md),
      raw transcript at [`raw/curl-transcript.txt`](evidence/raw/curl-transcript.txt).
      Eleven cases: the happy path plus every 4xx rejection (`400`, `413`, `422`
      validation, `422` clarification, `405`).
- [x] **Provider fallback/error log** —
      [`docs/evidence/provider-fallback-log.md`](evidence/provider-fallback-log.md), raw
      server output at [`raw/provider-fallback.log`](evidence/raw/provider-fallback.log).
      One-hop failover to Groq and two-hop failover to Gemini, both serving a real `200`;
      plus an exhausted chain (`502`), an unconfigured deployment (`502`) and a timeout
      (`504`).
- [x] Failures are **forced for real** — invalid credentials and a 1 ms deadline — not
      mocked. A mocked failover proves the mock, not the chain.
- [x] Three live `sprint_plan` results, one per provider. The Groq failover run returned
      8 stories worth 39 points against a capacity of 30; the planner committed 28 and
      deferred 3. This closes decision-log item 10.
- [x] All eleven cases matched `docs/api-contracts.md` on the first run, so the script
      doubles as a contract regression check and exits non-zero on drift.
- [x] Every captured file is scanned for `nvapi-` / `gsk_` / `AIza` patterns before the
      run is allowed to succeed. Reported `CLEAN`.

## Prompt security

- [x] Prompt contract is at **v5**, surfaced per-response as `X-Prompt-Version`.
- [x] I require strict JSON output.
- [x] User content is fenced inside `<product_idea>` and `<constraints>` and marked
      as untrusted data.
- [x] `fenceUserText()` strips `<` and `>` from user input, so a forged
      `</product_idea>` cannot terminate the fence — defense in depth beyond
      instruction-only mitigation.
- [x] The authoritative rules block always precedes user text.
- [x] I prohibit system-prompt and credential disclosure (rule 3).
- [x] The model is instructed not to return the deterministic fields, and the server
      discards them regardless (rule 6).
- [x] I added prompt-injection tests (five adversarial inputs).

## Deterministic planning

- [x] Story `value`, `risk` and `points` are validated on a 1–5 / 1–5 / 1–13 scale.
- [x] I removed the hardcoded risk value.
- [x] `priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are recomputed
      server-side and overwrite whatever the model returned.
- [x] Scoring is `(value + risk) / effort` — pure, no clock, no randomness, stable
      tie-break, so identical input always produces an identical plan.
- [x] I added configurable sprint capacity (`team_capacity_points`, 1–500).
- [x] No sprint's committed points can exceed capacity.
- [x] `planSprint` returns the handbook shape
      `{ capacity_points, committed_points, included, deferred }`.
- [x] The same pure functions run client-side for human edits
      (`src/lib/scopecraft/client-recalc.ts`) — the model is never re-invoked for a
      manual change. Verified live: deferring a story recomputed capacity 29/30 → 21/30
      with exactly one network call for the whole session.

## Story dependencies

- [x] I added optional story dependencies.
- [x] Prerequisites are scheduled before dependent stories.
- [x] I reject missing dependencies.
- [x] I reject duplicate story IDs.
- [x] I reject self-dependencies.
- [x] I reject circular dependencies.

## Ambiguous input

- [x] I added conservative gibberish detection.
- [x] Ambiguous input returns `422 CLARIFICATION_REQUIRED` with two questions.
- [x] Ambiguous input never reaches a provider.
- [x] Legitimate concise ideas remain accepted — detection targets multiple long,
      low-vowel tokens rather than merely short or unfamiliar ideas.

## Backend testing

- [x] Request-validation tests.
- [x] Response-validation tests.
- [x] Real API-route tests (the actual handler, not a stub).
- [x] Provider-fallback tests driven at the `fetch` layer, so real request
      construction, status handling and JSON extraction all execute.
- [x] Missing-key tests.
- [x] Timeout and cancellation tests.
- [x] Deterministic-scoring tests.
- [x] Sprint-capacity tests.
- [x] Dependency tests.
- [x] Malformed-output tests.
- [x] Prompt-injection tests.
- [x] Secret and log leak-guard tests.
- [x] All ten evaluation cases automated.
- [x] **242 automated tests pass** across 8 suites — 131 backend/evaluation, 111 UI.

> **Correction (2026-08-24).** Previously read "All 44 automated tests pass".

## Quality and security

- [x] TypeScript validation passes (`npx tsc --noEmit`).
- [x] ESLint passes with zero warnings or errors (`--max-warnings=0`).
- [x] The Next.js production build passes.
- [x] `npm audit --omit=dev` reports zero known vulnerabilities — a high-severity
      `nanoid` advisory (GHSA-2v37-7h3g-55p8) was patched on 2026-08-24.
- [x] No real API keys are committed; `.env.local` is gitignored and a repo-wide grep
      for the actual key values used in testing returns nothing on tracked files.
- [x] Client bundle secret scan is clean (`grep` over `.next/static`).
- [x] No variable carrying a secret is prefixed `NEXT_PUBLIC_`.
- [x] Server logs carry the error code and status only — never a payload, a raw
      `Error`, or a credential.
- [x] Backend CI checks are configured (`.github/workflows/ci.yml`, Node 22).

## Git status

- [x] Branch `feature/backend-safety-ci` created; commit `5e062c5`.
- [x] Pushed to GitHub.
- [x] Remote GitHub Actions checks pass.
- [x] Backend pull-request review completed (PR #1, merged 2026-08-21).
- [x] Merged through `dev`; `main` and `dev` are in sync.

## Still open

- [ ] Broader live adversarial pass — all five injection cases against all three
      providers. One case against one provider has been verified; that is a data
      point, not coverage.
- [ ] A server-side domain classifier. The refusal currently depends on the model
      emitting the envelope; a model that ignores rule 4 and answers in valid PRD
      shape would pass validation.
- [x] Backend defense preparation for Session 5 — done:
      [`docs/defense-prep-backend.md`](defense-prep-backend.md) covers the end-to-end trace
      with file:line anchors, each decision paired with the alternative it rejected, a
      modify-map of likely live change requests, the failure matrix, and the limitations to
      concede rather than argue.

## Final result

The AI and backend implementation is complete, and — as of 2026-08-24 — verified
against live providers rather than only against mocks. The remaining items are
coverage depth and defense preparation, not missing functionality.
