# ScopeCraft — Team 10

Turn a raw product idea into a structured PRD, user stories, risks, and a capacity-bounded
sprint plan.

**Status:** pre-release. Lint, type-check, 130 tests and the production build all pass. Not
yet deployed publicly, and no live AI provider call has been made from this repository —
see [Known limitations](#known-limitations--safe-refusals).

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

## Test and verify

```bash
npm test          # 130 tests, 3 suites
npm run typecheck
npm run lint
npm run build
```

| Suite | Tests | Covers |
|---|---|---|
| `tests/api/scopecraft.test.ts` | 106 | Request/response validation, the real route handler, the three-tier failover chain driven at the `fetch` layer, timeouts, payload cap, injection defense, secret and log leak guards |
| `tests/api/tools.test.ts` | 14 | `priorityScore` / `scheduleSprints` / `planSprint` invariants |
| `tests/evaluation/scopecraft.evaluation.test.ts` | 10 | Offline evaluation harness over `tests/evaluation/scopecraft-cases.json` |

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

**Domain boundary.** ScopeCraft plans *software product* work. Out-of-domain requests
(medical, legal, financial advice) are refused with `422 OUT_OF_DOMAIN` rather than
answered. The caveat is that the refusal depends on the model emitting the refusal
envelope: if a model ignores the rule and returns a medical answer in valid PRD shape,
schema validation passes and it is returned. A server-side domain classifier would close
that gap and is not built.

**Prompt-injection defense is mitigation, not proof.** Untrusted input is fenced inside
`<product_idea>` and `<constraints>`, beneath an authoritative rules block that always
precedes user text, and `fenceUserText()` strips `<`/`>` from user input so a forged
`</product_idea>` cannot break out of the fence. The binding control is downstream: every
model reply must satisfy `ModelReplySchema` or it is rejected, retried once, and then fails
closed. Current tests assert prompt structure and our own rejection behaviour — **no test
asserts that a live model actually refused.** That needs adversarial runs against a real
provider.

**Greedy, single-pass sprint packing.** `scheduleSprints` fills each sprint in priority order
and opens a new one when the next story does not fit. It does not backfill a smaller
later story into leftover capacity, so a plan can be capacity-valid without being optimally
packed. This is deliberate — predictable and explainable beats marginally tighter.

**The sprint plan is not yet editable in the browser.** The handbook requires human
adjustment of capacity and story points after generation. The backend side is now
complete — responses carry `sprint_plan` with the `included` / `deferred` split the board
needs, and the planner is pure and safe to call client-side — but the UI does not consume
it yet, so today the only way to change a plan is to regenerate it.

**No live provider call has ever been made from this repository.** Every test mocks
`fetch`. A retired model ID would pass all 130 tests and fail only in production. The
smoke-test script below exists to close this and **has not yet been run with real keys.**
Verify before any demo:

```bash
npm run smoke
```

It pings each configured provider with a one-token request and prints
`[PROVIDER] [MODEL_ID] [STATUS]` — never a key, never a response body. Unconfigured
providers are reported `SKIPPED`, and the script exits non-zero if a configured one
fails. Note that providers authenticate *before* resolving the model ID, so only a run
with real credentials is evidence about model IDs.

**Single default capacity profile.** One team profile, not configurable per team beyond
the per-request `team_capacity_points`.

**No persistence.** Results are not stored; refreshing loses the generated plan.

**A 502 is terminal for the caller.** There is no server-side backoff or queue: when the
whole chain fails, the client is told to retry. The one automatic retry that does exist is
narrow — a single re-run of the chain when model output fails schema validation.

## Project structure

```
src/app/scopecraft/page.tsx         UI (Joe)
src/app/api/scopecraft/route.ts     API endpoint (Yousef)
src/lib/scopecraft/schema.ts        Zod schemas + validation (Yousef)
src/lib/scopecraft/service.ts       Orchestration + deterministic override (Yousef)
src/lib/scopecraft/tools.ts         priorityScore / planSprint (Yousef)
src/lib/scopecraft/taxonomy.ts      MoSCoW bands + domain vocabulary (Yasmin/Yousef)
src/lib/scopecraft/tool-rules.ts    Domain tool rules (Yasmin)
src/lib/ai/providers.ts             NVIDIA → Groq → Gemini failover (Yousef)
src/lib/ai/models.ts                Endpoints + model IDs, shared with the smoke test (Yousef)
scripts/smoke-test.ts               Live provider connectivity check (Yousef)
knowledge/scopecraft/               Approved corpus (Yasmin)
tests/                              API, tools and evaluation suites
docs/architecture.md                System architecture (Nour)
docs/api-contracts.md               API + tool contracts (Yousef)
docs/decision-log.md                Research source & decision log
docs/backend-delivery-summary.md    Backend handover + PR description (Yousef)
docs/source-register.md             Approved source register (Yasmin)
docs/release-checklist.md           Release checklist (Nour)
AI_USAGE.md                         AI usage disclosure (all members)
```

## Team 10

| Name | Role |
|---|---|
| Nour Eldeen Mohamed Nabil | Integration Lead / Architect |
| Yousef Mohmed Hasabo | AI & Backend Engineer |
| Joe (Youssef Alaaeldin) | Product UI & Workflow Engineer |
| Yasmin Mohamed Islam | Knowledge, Tools & Quality Engineer |
