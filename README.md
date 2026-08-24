# ScopeCraft — Team 10

Turn a raw product idea into a structured PRD, user stories, risks, and a capacity-bounded
sprint plan.

**Live public beta:** **https://scope-craft-nine.vercel.app/scopecraft**

**Status:** deployed and live-verified. Lint, type-check, **245/245 tests** and the
production build all pass. All three AI providers are confirmed reachable with real
credentials (`npm run smoke`), and the full journey has been exercised **against the
deployed production URL** — a real idea returns a coherent 11-field PRD with a
capacity-respecting `sprint_plan`, and an out-of-domain request is refused with
`422 OUT_OF_DOMAIN` rather than answered. See [Live verification](#live-verification), and
[Known limitations](#known-limitations--safe-refusals) for what that does and does not
cover.

> **Production note (2026-08-24).** Three consecutive production generations were served by
> Groq and Gemini, never by NVIDIA — the configured primary. A provider with no credential
> is *skipped* rather than failed, so the most likely cause is that `NVIDIA_API_KEY` is not
> set in the hosting environment. The failover chain is doing exactly its job and users are
> unaffected, but the deployed environment does not match `.env.example`. Tracked in
> `docs/release-checklist.md`.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in at least one provider key
npm run dev                  # http://localhost:3000/scopecraft
```

### Environment

All configuration is **server-only**. No variable here may ever be prefixed with
`NEXT_PUBLIC_` — that prefix inlines the value into the client bundle and permanently
leaks the key to every visitor.

| Variable | Purpose | Default |
|---|---|---|
| `NVIDIA_API_KEY` | Primary provider (NVIDIA NIM) | — |
| `GROQ_API_KEY` | Fallback 1 (Groq) | — |
| `GEMINI_API_KEY` | Fallback 2 (Google Gemini) | — |
| `PRIMARY_AI_PROVIDER` | Which tier is tried first | `nvidia` |
| `AI_TIMEOUT_MS` | Per-attempt abort timeout | `15000` |
| `NVIDIA_MODEL` / `GROQ_MODEL` / `GEMINI_MODEL` | Model ID overrides | see `.env.example` |

**At least one key is required.** A provider with no credential is skipped rather than
treated as a failure, so a single key still gives a working endpoint — you simply lose the
failover tiers behind it.

## Deterministic vs AI generative boundary

This is the core design rule of the backend: **the model writes prose, the code does the
arithmetic.**

```
request → 16 KB cap → RequestSchema → [ NVIDIA → Groq → Gemini ] → ProviderOutputSchema
                                                    ↓
                        priorityScore · toMoscow · planSprint      ← deterministic, pure
                                                    ↓
                                    ScopeCraftResponseSchema → 200
```

| Field | Produced by | Trusted from the model? |
|---|---|---|
| `problem`, `target_user`, `goals`, `non_goals`, `requirements` | model | yes — descriptive prose |
| `user_stories`, `acceptance_criteria`, `risks` | model | yes — but every field is schema-validated |
| `priority` | `priorityScore()` | **no — overwritten** |
| `effort` | story `points` | **no — overwritten** |
| `sprint` | `scheduleSprints()` | **no — overwritten** |
| `sprint_plan` | `summarizeSprintPlan()` | **no — overwritten** |
| `moscow` | `toMoscow()` | **no — overwritten** |

The prompt explicitly instructs the model *not* to return the four deterministic fields,
and `service.ts` overwrites them unconditionally regardless. Two consequences worth
stating plainly:

- **The same estimates always produce the same plan.** The planner is pure — no clock, no
  randomness, no I/O — with a stable tie-break, so re-running never reshuffles a backlog.
  Safe to import and re-run client-side when a user edits points or capacity.
- **The model cannot inflate a priority or overcommit a sprint.** If its estimates are
  unusable (a story larger than one sprint, a dependency cycle), the planner raises
  `PLANNING_ERROR` and the request fails loudly rather than returning a plausible-looking
  wrong plan.

Scoring is `(value + risk) / points`, with `value` and `risk` on 1–5 and `points` on 1–13.
MoSCoW bands (`must ≥ 2.2`, `should ≥ 1.3`, `could ≥ 0.7`) are calibrated for exactly that
scale — changing either range requires recalibrating the other.

## Live verification

Every automated test below mocks the network — correct for CI, but it cannot catch a
retired model ID or a misconfigured account. `npm run smoke` closes that gap by making
real, minimal (one output token) calls to whichever providers have credentials set:

```bash
cp .env.example .env.local   # fill in at least one provider key
npm run smoke
```

This was run for the first time on 2026-08-24 and immediately caught a real bug: all
three default model IDs were dead in production despite passing all mocked tests.
Full story in `docs/decision-log.md` item 5. After the fix, all three providers report
`200 OK`, and a real product idea sent through the running app
(`POST /api/scopecraft`) returns a coherent 11-field PRD with a valid `sprint_plan` — the
first end-to-end proof this project's core value proposition actually works, not just
that its mocks are internally consistent.

**Known limit:** providers authenticate before resolving the model ID, so an invalid key
returns `401` and masks whether the model itself is live — only a run with real
credentials is evidence about model IDs. Re-run before every release; hosted model
availability changes independently of this repository, and it has already gone stale
once.

## Test and verify

```bash
npm test          # 245 tests, 8 suites
npm run typecheck
npm run lint
npm run build
```

| Suite | Tests | Covers |
|---|---|---|
| `tests/api/scopecraft.test.ts` | 107 | Request/response validation, the real route handler, the three-tier failover chain driven at the `fetch` layer, timeouts, payload cap, injection defense, secret and log leak guards |
| `tests/api/tools.test.ts` | 14 | `priorityScore` / `scheduleSprints` / `planSprint` invariants |
| `tests/evaluation/scopecraft.evaluation.test.ts` | 10 | Offline evaluation harness over `tests/evaluation/scopecraft-cases.json` |
| `tests/ui/InputForm.test.tsx` | 38 | Intake wizard validation, presets, accessibility wiring |
| `tests/ui/InteractiveBoard.test.tsx` | 19 | Client-side sprint board recalculation, zero network calls |
| `tests/ui/StateTransitions.test.tsx` | 13 | All 7 UI states driven end-to-end through the real `page.tsx` |

The failover tests mock `global.fetch` rather than the provider objects, so the real
request construction, status handling, JSON extraction and schema gate all execute — the
Gemini credential is asserted to travel in the `x-goog-api-key` header and never in the
URL, and the OpenAI-compatible tiers as a bearer token.

Secret-leak check — run after a build, and part of the release checklist:

```bash
grep -rqE "AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|nvapi-[0-9A-Za-z_-]{20,}" .next/static && echo "SECRET LEAKED" || echo "CLEAN"
```

CI (`.github/workflows/ci.yml`) runs tests, type-check, lint and build on every push and
pull request to `main` and `dev`.

## Known limitations & safe refusals

Stated honestly, because the release gate asks for bounded limitations rather than a clean
sales pitch.

**Unauthenticated endpoint & rate-limiting boundary.** `POST /api/scopecraft` is a **public
demo endpoint**. There is no authentication, no session, and no per-caller rate limiting, so
anyone who knows the URL can spend the project's provider quota. This is a deliberate MVP
scope decision, not an oversight — the app has no user accounts to authenticate against — but
it is the single boundary that must close before any broader production use.

What bounds the exposure today:

| Control | Where | Effect |
|---|---|---|
| 16 KB streamed body cap | `route.ts`, before `JSON.parse` | An oversized body is rejected without ever being parsed or held in memory |
| Strict Zod validation | `RequestSchema`, before any provider import | A malformed request costs **zero** provider tokens |
| Local clarification heuristic | `getClarification`, pre-provider | Unintelligible input is refused without a model call |
| Per-request provider timeout | `AI_TIMEOUT_MS`, default 15 s | A single request cannot hold a connection open indefinitely |
| Server-only credentials | Route handler + `NEXT_PUBLIC_` audit | A caller can spend quota but can never read a key |

What is **not** bounded: the number of *valid* requests one caller may make. A well-formed
request always reaches a provider.

**Production upgrade path**, in the order it should be done:

1. **Edge middleware token-bucket rate limiting** — per-IP and per-session, in Next middleware
   backed by a durable store (Upstash Redis or equivalent), so the limit survives serverless
   cold starts rather than living in per-instance memory.
2. **Session authentication (JWT)** — move the endpoint behind a signed session so quota is
   attributable to a user rather than an IP, and abuse can be revoked per account.
3. **Per-account quota accounting** — daily generation budgets, since provider spend is the
   real resource being protected.

Until (1) exists, treat the deployed URL as a demo whose cost ceiling is the provider account's
own limits.

**Domain boundary.** ScopeCraft plans *software product* work. Out-of-domain requests
(medical, legal, financial advice) are refused with `422 OUT_OF_DOMAIN` rather than
answered. The caveat is that the refusal depends on the model emitting the refusal
envelope: if a model ignores the rule and returns a medical answer in valid PRD shape,
schema validation passes and it is returned. A server-side domain classifier would close
that gap and is not built. One live adversarial prompt (see
[Live verification](#live-verification)) confirmed the refusal holds against a real
model — that is one data point, not comprehensive coverage.

**Prompt-injection defense is mitigation, not proof.** Untrusted input is fenced inside
`<product_idea>` and `<constraints>`, beneath an authoritative rules block that always
precedes user text, and `fenceUserText()` strips `<`/`>` from user input so a forged
`</product_idea>` cannot break out of the fence. The binding control is downstream: every
model reply must satisfy `ModelReplySchema` or it is rejected, retried once, and then fails
closed. The mocked test suite covers five adversarial cases (delimiter escape, prompt
extraction, developer-mode override, forged closing tags, environment-variable
exfiltration) across our own rejection behaviour. Live, only one of those five has been
run against one real provider so far — refused correctly, `422 OUT_OF_DOMAIN`, no
credential in the response — but a full live pass across all five cases and all three
providers has not been done.

**Greedy, single-pass sprint packing.** `scheduleSprints` fills each sprint in priority order
and opens a new one when the next story does not fit. It does not backfill a smaller
later story into leftover capacity, so a plan can be capacity-valid without being optimally
packed. This is deliberate — predictable and explainable beats marginally tighter.

**Single default capacity profile.** One team profile, not configurable per team beyond
the per-request `team_capacity_points`.

**No persistence.** Results are not stored; refreshing loses the generated plan.

**A 502 is terminal for the caller.** There is no server-side backoff or queue: when the
whole chain fails, the client is told to retry. The one automatic retry that does exist is
narrow — a single re-run of the chain when model output fails schema validation.

## Project structure

```
src/app/scopecraft/page.tsx                          7-state UI orchestration (Joe)
src/components/scopecraft/InputForm.tsx              Intake wizard + presets (Joe)
src/components/scopecraft/InteractiveSprintBoard.tsx  Live client-side board (Joe)
src/components/scopecraft/EvidencePanel.tsx           Cited sources panel (Joe)
src/components/scopecraft/ExportActions.tsx           Markdown/JSON export (Joe)
src/app/api/scopecraft/route.ts                       API endpoint (Yousef)
src/lib/scopecraft/schema.ts                           Zod schemas + validation (Yousef)
src/lib/scopecraft/service.ts                          Orchestration + deterministic override (Yousef)
src/lib/scopecraft/tools.ts                             priorityScore / planSprint (Yousef)
src/lib/scopecraft/client-recalc.ts                     Pure client-side recompute, no I/O (Joe/Yousef)
src/lib/scopecraft/taxonomy.ts                          MoSCoW bands + domain vocabulary (Yasmin/Yousef)
src/lib/scopecraft/tool-rules.ts                        Domain tool rules (Yasmin)
src/lib/ai/providers.ts                                 NVIDIA → Groq → Gemini failover (Yousef)
src/lib/ai/models.ts                                    Endpoints + model IDs, shared with the smoke test (Yousef)
scripts/smoke-test.ts                                   Live provider connectivity check (Yousef)
knowledge/scopecraft/                                   Approved corpus (Yasmin)
tests/                                                  API, tools, evaluation, and UI suites
next.config.js                                          Security headers + CSP (Youssef)
docs/architecture.md                                    System architecture (Nour)
docs/contribution-matrix.md                             Verified per-member deliverables (Nour)
docs/api-contracts.md                                   API + tool contracts (Yousef)
docs/decision-log.md                                    Research source & decision log
docs/backend-delivery-summary.md                        Backend handover + PR description (Yousef)
docs/security-review.md                                 Dependency + provider security review (Yousef)
docs/source-register.md                                 Approved source register (Yasmin)
docs/release-checklist.md                               Release checklist (Nour)
AI_USAGE.md                                              AI usage disclosure (all members)
```

## Team 10

| Name | Role |
|---|---|
| Nour Eldeen Mohamed Nabil | Integration Lead / Architect |
| Yousef Mohmed Hasabo | AI & Backend Engineer |
| Joe (Youssef Alaaeldin) | Product UI & Workflow Engineer |
| Yasmin Mohamed Islam | Knowledge, Tools & Quality Engineer |
