# Backend Delivery Summary — ScopeCraft

**Owner:** Yousef Mohmed Hasabo (AI & Backend Engineer)
**Scope:** Modules 1–5 plus final integration
**Date:** 2026-08-23
**Branch target:** `dev`

This is the handover document for the backend. It states what is built, what is
verified, what is *not* verified, and exactly what Joe and Yasmin need to do next.

---

## 1. Status at a glance

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 — eslint `--max-warnings=0` |
| Types | `npx tsc --noEmit` | exit 0 |
| Tests | `npm test` | **130 passing**, 3 suites, 0 skipped |
| Build | `npm run build` | exit 0 — 4 routes, `/api/scopecraft` dynamic |
| Client secret scan | `grep -rqE "AIza…\|gsk_…\|nvapi-…" .next/static` | `CLEAN` |
| Live connectivity | `npm run smoke` | **run 2026-08-24 with real keys — all 3 providers green after model-ID fix, see §7** |

| Suite | Tests | Covers |
|---|---|---|
| `tests/api/scopecraft.test.ts` | 106 | Route handler, schemas, failover at the `fetch` layer, timeouts, payload cap, injection defense, secret/log leak guards |
| `tests/api/tools.test.ts` | 14 | `priorityScore`, `scheduleSprints`, `planSprint` invariants |
| `tests/evaluation/scopecraft.evaluation.test.ts` | 10 | The 10-case evaluation matrix |

---

## 2. Architecture: three-tier fallback

```
POST /api/scopecraft
   │
   ├─ 16 KB cap ──────────► 413 PAYLOAD_TOO_LARGE
   ├─ JSON.parse ─────────► 400 INVALID_JSON
   ├─ RequestSchema ──────► 422 VALIDATION_ERROR  (+ issues[])
   ├─ clarification ──────► 422 CLARIFICATION_REQUIRED (+ questions[])
   │
   ══════════ no provider module is touched above this line ══════════
   │
   ├─ NVIDIA NIM · meta/llama-3.1-8b-instruct   (primary)
   │     └─ on failure ─► Groq · openai/gpt-oss-120b (fallback 1)
   │                        └─ on failure ─► Gemini · gemini-3.5-flash-lite (fallback 2)
   │
   ├─ ModelReplySchema ──► plan | refusal | (retry once) → 502 SCHEMA_VIOLATION
   ├─ deterministic tools ► 502 PLANNING_ERROR
   └─ ScopeCraftResponseSchema ─────────────────────────► 200
```

**Failover semantics that matter to the caller:**

- A provider with **no credential is skipped, not failed**. One key gives a working
  endpoint; you simply lose the tiers behind it.
- A **refusal is a valid reply.** An out-of-domain answer returns immediately rather
  than burning the remaining tiers on a request the product will not serve.
- A **timeout anywhere in the chain is sticky** — the caller gets `504` ("retry
  shortly"), not a hard `502`.
- **Credentials travel in headers only.** Gemini uses `x-goog-api-key`; NVIDIA and Groq
  use a bearer token. No key ever appears in a URL, because URLs land in proxy logs.
- Configure the primary tier with `PRIMARY_AI_PROVIDER`; it is resolved per request, so
  no rebuild is needed.

---

## 3. Deterministic overrides

The model writes prose and estimates. **Code does all arithmetic.** Four fields are
recomputed and overwrite whatever the model returned:

| Field | Computed by | Rule |
|---|---|---|
| `priority` | `priorityScore()` | `(value + risk) / points`, rounded to 2 dp |
| `moscow` | `toMoscow()` | `must ≥ 2.2` · `should ≥ 1.3` · `could ≥ 0.7` · else `wont` |
| `sprint` | `scheduleSprints()` | Greedy, capacity-bounded, dependency-ordered |
| `sprint_plan` | `summarizeSprintPlan()` | First-sprint commitment: capacity, committed, included, deferred |

Estimation scale: `value` 1–5, `risk` 1–5, `points` 1–13. **The MoSCoW bands are
calibrated for exactly this scale** — changing either range requires recalibrating the
other. They are this project's own numbers, not an external standard.

Asserted by test: a model reply carrying `priority: 999`, `sprint: 42`,
`moscow: "must"` and an invented `sprint_plan` yields `priority: 2`, `sprint: 1`,
`moscow: "should"` and a computed plan. Identical input produces byte-identical output.

---

## 4. HTTP status catalog

All nine codes are exported as `ERROR_CODES` from `src/lib/scopecraft/schema.ts`, so a
client can switch on them exhaustively. Every error shares the envelope
`{ error: true, code, message }`.

| Status | `code` | Trigger | Provider called? |
|---|---|---|---|
| `200` | — | Success | yes |
| `400` | `INVALID_JSON` | Body is not valid JSON | no |
| `413` | `PAYLOAD_TOO_LARGE` | Body over 16 KB | no |
| `422` | `VALIDATION_ERROR` | Fails `RequestSchema`; adds `issues: {path, message}[]` | no |
| `422` | `CLARIFICATION_REQUIRED` | Idea unintelligible; adds `questions: string[]` | no |
| `422` | `OUT_OF_DOMAIN` | Outside software product planning | yes (one tier) |
| `502` | `PLANNING_ERROR` | Estimates cannot form a valid sprint plan | yes |
| `502` | `SCHEMA_VIOLATION` | Model output failed validation twice | yes |
| `502` | `PROVIDER_ERROR` | All providers unreachable, or none configured | yes |
| `504` | `TIMEOUT` | A provider aborted on the clock | yes |

**Sanitization guarantees, each asserted by test:**

- Error messages never contain a provider name, model ID, stack trace, payload, or
  credential.
- A `422 VALIDATION_ERROR` forwards only `path` and `message`. Zod's `received`/`input`
  are dropped, so **a rejected request cannot echo the submitted value back.**
- `5xx` logs exactly one line: `scopecraft.request_failed code=<CODE> status=<NNN>`.
  `4xx` logs nothing. No raw `Error` object ever reaches `console`.
- A `200` carries exactly three headers: `content-type`, `x-provider-used`,
  `x-prompt-version`.

Exact JSON bodies for every code are in [`docs/api-contracts.md`](./api-contracts.md).

---

## 5. Integration instructions — Joe (UI)

**The response gained a field.** A `200` now has **13** keys: the 11 mandatory PRD
fields, plus `moscow`, plus the new `sprint_plan`.

```ts
interface SprintPlanResult {
  capacity_points: number;    // what the team said it could take
  committed_points: number;   // what sprint 1 actually holds
  included: string[];         // story IDs in sprint 1, priority order
  deferred: string[];         // everything that slipped, priority order
}
```

`sprint_plan` and `sprint` answer different questions and you will likely want both:

- `sprint` (`SprintItem[]`) — *which sprint does each story land in*, across the whole
  backlog. Use it for a multi-sprint roadmap view.
- `sprint_plan` — *what is the team committing to now, and what slipped*. This is the
  editable sprint board's data. `included` and `deferred` are already in priority
  order, and every story ID appears in exactly one of them.

**Three things to do:**

1. **Render `sprint_plan`** as the board's two columns. `committed_points` /
   `capacity_points` is your capacity meter — it is guaranteed by schema refinement
   that committed never exceeds capacity.
2. **Branch on `code`, not on `message`.** The client currently reads only
   `err.message`, which is why the Module 5 code rename needed no UI change — but
   `422 VALIDATION_ERROR` now carries a field-level `issues` array you can attach to
   the right form input, and `422 CLARIFICATION_REQUIRED` carries `questions`. Those are
   real UX wins sitting unused.
3. **Migrate off the deprecated request field.** The form still posts
   `capacity_per_sprint`. It is accepted and mapped to `team_capacity_points`, and the
   alias is removed once you land the rename.

`planSprint` is pure — no I/O, no clock, no randomness — so you can import it directly
and re-run a plan client-side when the user edits points or capacity, without a round
trip. It throws `PlanningError` on unusable input; catch it.

**Confirm please:** one line of `ResultView.tsx` was changed during Module 2 —
`Value: {s.value}/10 · Risk: {s.risk}/10 · Effort:` became `/5 · … · Points:` — because
the displayed scale would otherwise have been wrong.

---

## 6. Integration instructions — Yasmin (evaluation & tools)

**Two changes need your sign-off.**

1. **The estimation scale moved from 1–10 to 1–5** (`value`, `risk`); `points` is 1–13.
   The MoSCoW thresholds only classify correctly on this scale. This forced edits to
   files you own: `tests/api/tools.test.ts`, `tests/fixtures/scopecraft/sample-response.json`,
   `tests/evaluation/scopecraft.evaluation.test.ts`, `tests/evaluation/scopecraft-cases.json`.
   Every change is itemized in [`AI_USAGE.md`](../AI_USAGE.md).

2. **`planSprint` changed shape** to match the handbook tool contract. The old
   multi-sprint array function is still there under its accurate name:

   | Before | Now |
   |---|---|
   | `planSprint(...) → PlannedStory[]` | `scheduleSprints(...) → PlannedStory[]` |
   | — | `planSprint(...) → SprintPlanResult` |

   Aliases `plan_sprint`, `schedule_sprints` and `priority_score` are the *same function
   references*, asserted by test. Your two `planSprint` assertions in `tools.test.ts`
   were migrated to `scheduleSprints`; the throw-cases needed no change because
   `planSprint` delegates and raises identically.

**Evaluation matrix alignment.** All 10 cases pass. Two notes:

- Cases 7 and 8 assert `422 VALIDATION_ERROR` (was `400 INVALID_INPUT` before Module 5).
  I updated the `expected` strings only; the inputs are untouched.
- **Cases 7 and 8 are still mislabeled** `"type": "not-found"` and `"malformed"`. They
  test malformed *input*, not a not-found condition. This is the D-05 audit finding and
  it is yours to close — I did not want to change your taxonomy unilaterally.
- The harness pins `team_capacity_points: 10` so cases assert planner behaviour rather
  than whatever the schema default happens to be. If you change the default, these
  cases will not silently drift.

---

## 7. What is NOT verified — read before the demo

Stated plainly, because a green test suite is not the same as a working product.

1. **RESOLVED 2026-08-24 — `npm run smoke` was run with real credentials for the first
   time.** Every automated test still mocks the network, so this remains the only real
   proof of live connectivity — and it caught exactly what it exists to catch: all three
   default model IDs were dead. Groq and Gemini returned `404` (credential valid, model
   retired); NVIDIA's `deepseek-v4-flash-0731` hung to the full timeout instead of
   erroring (confirmed via direct `curl` against `integrate.api.nvidia.com`: the model is
   catalog-listed but its `chat/completions` route never responds on this account, unlike
   a cleanly-unavailable model). All three defaults in `src/lib/ai/models.ts` were
   replaced with IDs verified live with a real `200 OK`: `meta/llama-3.1-8b-instruct`
   (NVIDIA), `openai/gpt-oss-120b` (Groq), `gemini-3.5-flash-lite` (Gemini). Full details
   in `docs/decision-log.md` item 5.

   A second bug surfaced in the same run: `npm run smoke` reported every provider
   `SKIPPED` even with a populated `.env.local`, because `tsx` doesn't auto-load `.env`
   files. Fixed by changing the script to
   `tsx --env-file-if-exists=.env.local scripts/smoke-test.ts`.

   ```bash
   npm run smoke
   ```

   It prints `[PROVIDER] [MODEL_ID] [STATUS]`, never a key or a response body, costs
   about one token per provider, and exits non-zero if a configured provider fails.
   **Known limit still applies:** providers authenticate before resolving the model ID,
   so an invalid key returns 401 and masks whether the model is live — re-verify with a
   real key if this ever needs re-checking, don't trust a green run made with a bad key.

2. **Partially closed 2026-08-24.** The suite still only asserts our side of the
   boundary: the fence cannot be forged, exactly one closing delimiter survives, the
   rules precede user text, no credential reaches the prompt, and non-conforming output
   is rejected then fails closed — all against a mocked transport. What's new: one
   adversarial prompt (developer-mode override + credential-exfiltration attempt) was
   sent live through the running app to the real NVIDIA endpoint and correctly refused
   with `422 OUT_OF_DOMAIN`, response scanned clean of any credential. That's one prompt,
   one provider, once — not the five-case-by-three-provider coverage the mocked suite
   has. Full detail and the honest scope of what's still not covered: decision-log item 2.

3. **The refusal path depends on the model emitting the envelope — same live evidence as
   above applies here too**, since it's the same mechanism (`OutOfDomainSchema` /
   `422 OUT_OF_DOMAIN`) being exercised. A model that ignores rule 4 and answers a medical
   question in valid PRD shape would still pass schema validation and be returned — a
   server-side domain classifier would close this and remains not built.

4. **Greedy packing is not optimal packing.** `scheduleSprints` does not backfill a
   smaller later story into leftover capacity. Deliberate — predictable and explainable
   beats marginally tighter.

5. **Two team checklists quote a retired error code.** `docs/session2-lead-checklist.md`
   and `docs/youssef-ai-backend-checklist.md` still say `400 INVALID_INPUT`. Not my
   files — flagged for Nour.

---

## 8. Pull request description

> ### Backend: provider failover, deterministic planning, hardened API boundary
>
> Implements Modules 1–5 of backend production hardening plus final integration.
>
> **Provider layer.** Three-tier failover — NVIDIA NIM (DeepSeek V4 Flash) → Groq
> (Llama 3.3 70B) → Gemini 1.5 Flash — with per-attempt `AbortController` timeouts
> (15s, configurable). Unconfigured providers are skipped rather than failed. Gemini's
> credential moved from a URL query parameter to the `x-goog-api-key` header, closing
> audit defect D-06.
>
> **Contract.** Zod is the single source of truth. `ProviderOutputSchema` bounds what
> the model may supply; `ScopeCraftResponseSchema` validates the assembled response
> before it leaves the server. All 11 mandatory PRD fields, plus deterministic `moscow`
> and `sprint_plan`.
>
> **Determinism.** `priority`, `moscow`, `sprint` and `sprint_plan` are computed by pure
> functions in `tools.ts` / `taxonomy.ts` and unconditionally overwrite anything the
> model returns. Same input, same plan, every time.
>
> **Security.** 16 KB payload cap; all validation runs before any provider module is
> touched, so a malformed request costs zero tokens; OWASP LLM01 defense via XML fencing
> with delimiter-forgery neutralization; sanitized logging that never receives a raw
> `Error`, a payload, or a credential. No `NEXT_PUBLIC_` anywhere; client bundle and git
> history both scan clean.
>
> **Tests.** 61 → 130. New coverage drives the failover chain through `global.fetch`, so
> the real provider clients execute rather than being mocked away.
>
> **Breaking changes:** `INVALID_INPUT` split into `INVALID_JSON` (400) and
> `PAYLOAD_TOO_LARGE` (413); schema failures now return `SCHEMA_VIOLATION` rather than
> `PROVIDER_ERROR`; `planSprint` returns `SprintPlanResult` and the array-returning
> function is now `scheduleSprints`; responses gained `sprint_plan`. Statuses and
> messages are unchanged and the browser client reads `message`, not `code`, so no UI
> change is required to merge.
>
> **Verified 2026-08-24:** `npm run smoke` was run with real keys against all three
> providers. It caught three dead default model IDs — fixed, all three now green — see
> §7 of `docs/backend-delivery-summary.md`.
