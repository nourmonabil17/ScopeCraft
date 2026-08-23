# AI Usage Disclosure — ScopeCraft

Required by the Team 10 Submission Checklist. Each member maintains their own section.

---

## Yousef Mohmed Hasabo — AI & Backend Engineer

**Reporting period:** Modules 1–5 of backend production hardening plus final integration, to 2026-08-23.

### Tools used

| Tool | Role in this work |
|---|---|
| Claude Code (CLI agent) | Paired implementation of the provider layer, Zod schemas and documentation; repository audit against the handbook rubric |
| Google Gemini | Product-planning inference at runtime (fallback tier 2) |
| NVIDIA NIM — DeepSeek V4 Flash | Product-planning inference at runtime (primary tier) |
| Groq — Llama 3.3 70B Versatile | Product-planning inference at runtime (fallback tier 1) |

The last three are **runtime dependencies of the product**, not authoring tools. They are
listed because the handbook asks which AI systems the module depends on.

### Files I own and changed

`src/app/api/scopecraft/route.ts` · `src/lib/ai/providers.ts` ·
`src/lib/scopecraft/schema.ts` · `src/lib/scopecraft/service.ts` ·
`src/lib/scopecraft/tools.ts` · `src/lib/scopecraft/taxonomy.ts` ·
`src/lib/ai/models.ts` · `scripts/smoke-test.ts` ·
`tests/api/scopecraft.test.ts` · `.env.example` · `docs/decision-log.md` ·
`docs/api-contracts.md` · `docs/backend-delivery-summary.md` · `AI_USAGE.md`

### Changes I made outside my ownership, and why

Declared explicitly so they are reviewed rather than discovered in a merge:

| File | Owner | Change | Reason |
|---|---|---|---|
| `tests/api/tools.test.ts` | Yasmin | Migrated range assertions from 1–10 to 1–5 | The MoSCoW thresholds only classify correctly on the 1–5 scale; the tests pinned the old range |
| `tests/fixtures/scopecraft/sample-response.json` | Yasmin | `effort` → `points`, rescaled `value`/`risk`, added `moscow` | Same schema change |
| `tests/evaluation/scopecraft-cases.json` | Yasmin | case-7 / case-8 `expected` text updated from `400 INVALID_INPUT` to `422 VALIDATION_ERROR` | Module 4 status-code change |
| `tests/evaluation/scopecraft.evaluation.test.ts` | Yasmin | Fixture rescale; capacity pinned in the harness; case-9 now asserts the Module 3 delimiters; imports moved to `service.ts` | Schema change, plus `buildPrompt` relocating from `providers.ts` to `service.ts` |
| `src/components/scopecraft/ResultView.tsx` | Joe | One line: `Value: {s.value}/10 · Risk: {s.risk}/10 · Effort:` → `/5 · … · Points:` | The displayed scale would otherwise be wrong |

**Yasmin owns the deterministic tool rules and evaluation matrix; the 1–10 → 1–5 estimation
scale change needs her sign-off.** Joe should confirm the `ResultView` label change.

| `tests/api/tools.test.ts` | Yasmin | Two `planSprint` assertions migrated to `scheduleSprints`; six tests added for the new `SprintPlanResult` shape | `planSprint` adopted the handbook return shape during final integration |
| `tests/evaluation/scopecraft.evaluation.test.ts` | Yasmin | Key-count guard `+1` → `+2`; four assertions added tying `sprint_plan` to the schedule | The response gained a `sprint_plan` field |
| `package.json` | shared | Added `tsx` devDependency and an `npm run smoke` script | The smoke test needs a TypeScript runner; pinning it beats relying on `npx` resolving a floating version |

**Final integration** also changed `planSprint`'s return type — a breaking change to a
function Yasmin's tests exercise. The array-returning behaviour is preserved verbatim
under the name `scheduleSprints`, so nothing was lost; but the rename and the new
`sprint_plan` response field both need her review, and Joe needs to consume
`sprint_plan` for the editable board.

Module 5 itself touched **no file outside my ownership.** The error-code rename was checked
against the browser client first: `src/app/scopecraft/page.tsx` reads `err.message` and
never `err.code`, so the change needs no UI edit. Two team checklists
(`docs/session2-lead-checklist.md`, `docs/youssef-ai-backend-checklist.md`) still quote
`400 INVALID_INPUT`; they are Nour's files and are flagged in `docs/decision-log.md`
rather than edited.

### Tasks delegated to AI assistance

- Boilerplate for the Zod schema module and the provider client abstractions.
- First draft of the Module 3 system-rules prompt block.
- Test fixture synthesis and mock-based API test scaffolding, including the
  table-driven `it.each` matrices in the Module 5 suite.
- Mechanical fixture migration when the estimation scale changed.
- First drafts of this file and `docs/decision-log.md`.

### Tasks done and verified manually

- **The scoring mathematics.** `priorityScore` = `(value + risk) / effort` and the greedy
  capacity-bounded packing in `planSprint`, including dependency ordering, cycle detection
  and the stable `localeCompare` tie-break that makes output reproducible.
- **MoSCoW threshold calibration.** The bands (2.2 / 1.3 / 0.7) were derived by hand
  against the 1–5 value / 1–5 risk / 1–13 points range so a typical story (3/3/5 → 1.2)
  lands in `should`. An earlier draft carried thresholds calibrated for a different scale
  that would have classified nearly every story as `must`; that was caught by inspection.
- **HTTP status mapping** in `route.ts` — 400, 413, 422, 502, 504 — reviewed case by case
  against the error taxonomy. Module 4 split validation failures out of `400 INVALID_INPUT`
  into `422 VALIDATION_ERROR` with a field-level `issues` array, keeping `400` for JSON
  syntax errors only.
- **Validation issues are filtered by hand.** Zod issue objects can carry the offending
  input; only `path` and `message` are forwarded, so a rejected request cannot echo user
  data back. Asserted by a test that submits a secret-looking short idea and checks the
  whole response body for it.
- **Secret handling.** Verified no secret reaches the client bundle or the repository
  history.
- **Delimiter-forgery defense.** The instinct to fence input in XML tags is standard; the
  gap — that a user can simply type `</product_idea>` and escape the fence — was found by
  writing an attack test first. `fenceUserText()` strips `<`/`>` from user text so the
  fence cannot be terminated. The prompt rules alone would not have caught this.
- **A retry bug found by test.** The schema-violation retry silently never fired, because
  the failover chain only recognised an invalid-output error when it was a `ProviderError`
  *instance*. A test asserting "two attempts" caught it; the check is now duck-typed on
  `.code`, matching how timeouts were already handled.
- **The tool return shapes, and where I did not follow the handbook.** The handbook
  draft specified `plan_sprint(...) -> { capacity_points, committed_points, included,
  deferred }` and `priority_score(...) -> { score, moscow }`. I adopted the first and
  declined the second. Folding MoSCoW into `priorityScore` would couple two
  independently-owned rules — the scoring formula is mine, the MoSCoW calibration is
  Yasmin's in `taxonomy.ts` — and would force every caller that only wants a number to
  depend on the taxonomy. Both values reach the client separately, so a consumer loses
  nothing. Reasoning recorded in `docs/api-contracts.md` rather than left implicit.
- **Not deleting the multi-sprint planner.** The obvious reading of "make `planSprint`
  return `SprintPlanResult`" is to replace the function. That would have silently
  dropped the per-story sprint index the `sprint` response field is built from, breaking
  the 11-field contract, Joe's roadmap view and Yasmin's `[1, 2]` assertion. The packer
  is preserved as `scheduleSprints`; `planSprint` is a summary layer over it. The two
  answer different questions and the response now carries both.
- **Model IDs extracted to `src/lib/ai/models.ts`.** The smoke test and the running
  application must never disagree about which model is being called. A shared,
  dependency-free module makes that structural instead of a convention, and a test
  asserts `providers.ts` re-exports rather than redeclares.
- **The error-code taxonomy.** Module 5 split the catch-all `INVALID_INPUT` into
  `INVALID_JSON` (400) and `PAYLOAD_TOO_LARGE` (413), and gave a repeated schema failure
  its own `SCHEMA_VIOLATION` (502) so "the model returned garbage twice" is
  distinguishable from "nothing was reachable". Each status was checked against RFC 9110
  section by section rather than chosen by habit — see entry 7 of `docs/decision-log.md`.
- **A stale user-facing string.** The `PROVIDER_ERROR` message still read "Both AI
  providers failed" after the chain grew to three tiers. Found by reading the payload
  catalog aloud against the code, not by a test — no test would ever have caught it.
- **Test titles, by hand.** A first draft used `it.each(...)("rejects %s with %i", ...)`,
  which silently rendered as "with NaN" because the positional placeholder consumed the
  payload object rather than the status. The assertions were correct; the report was
  lying. Fixed before the gates were run.
- **Console noise as a signal.** Four older tests exercised failure paths without mocking
  `console`, so the suite printed real-looking error output on a fully passing run. That
  makes a genuine regression easy to miss, so the mocks were added.
- **Source verification.** Every URL in `docs/decision-log.md` marked `Verified` was
  fetched and its content read on 2026-08-23. Rows that could not be confirmed are marked
  `Partially verified`, `Verified (indirect)` or `Open` rather than being presented as
  verified.

### Verification evidence

All commands run on 2026-08-23 against the working tree.

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 — eslint `--max-warnings=0`, no output |
| Types | `npx tsc --noEmit` | exit 0 — no diagnostics |
| Tests | `npm test` | **130/130 passing**, 3 suites (106 API · 14 tools · 10 evaluation) |
| Build | `npm run build` | exit 0 — 4 routes, `/api/scopecraft` dynamic |
| Client secret scan | `grep -rqE "AIza\|gsk_\|nvapi-" .next/static \|\| echo "CLEAN"` | `CLEAN` |
| `NEXT_PUBLIC_` audit | `grep -rn "NEXT_PUBLIC_" src/` | no matches |
| Key identifiers in bundle | `grep -rl "NVIDIA_API_KEY\|GROQ_API_KEY\|GEMINI_API_KEY" .next/static` | no matches |
| History scan | `git log -p --all \| grep -E "AIza…\|gsk_…"` | no matches |

Acceptance criteria are verified **by execution**. Through Module 4 this used a temporary
harness that was run and then removed; Module 5 promoted every one of those checks into the
permanent suite, so the evidence re-runs on every commit instead of existing once:

| Criterion | Permanent test | How it is proven |
|---|---|---|
| Valid input conforms to the typed schema | `Module 5 · happy path` | 200 asserted to carry all 11 mandatory fields plus `moscow`, and nothing else — `Object.keys(body)` is length-checked, so an accidental extra field fails the build |
| Scores and buckets are deterministic | `Module 5 · happy path` | Every story's `priority` recomputed with `priorityScore` and its `moscow` with `toMoscow`, then anchored against hand-computed values so a bug in the tools cannot make the check vacuous; all four MoSCoW buckets exercised |
| Sprints respect capacity | `Module 5 · happy path` | Committed points summed per sprint and asserted `<= team_capacity_points`; dependency ordering asserted with a high-scoring story forced to wait on a low-scoring one |
| Identical input yields identical output | `Module 5 · happy path` | Two runs compared byte-for-byte as serialized JSON |
| Invalid input returns 4xx without calling a provider | `Module 5 · pre-provider validation` | 12 rejection shapes → 4xx, with spies on all three providers **and on `global.fetch`** recording zero calls |
| Oversized bodies are rejected before parsing | `Module 5 · payload size cap` | 413 asserted, `JSON.parse` asserted never called with the oversized body, and a declared `Content-Length` over the cap rejected with a `null` body so the stream is provably never read |
| Failover works end to end | `Module 5 · provider failover chain` | `global.fetch` mocked by host: NVIDIA 500 → Groq; NVIDIA + Groq 500 → Gemini; call order asserted exactly |
| Credentials travel correctly | `Module 5 · provider failover chain` | Gemini's key asserted present in `x-goog-api-key` and absent from the URL (no `key=`); NVIDIA's asserted as a bearer token and absent from the URL |
| Timeouts surface as 504 | `Module 5 · provider failover chain` | Real `AbortController` path driven at `AI_TIMEOUT_MS=5`; also asserted that one timeout among two hard failures still yields 504, not 502 |
| Unusable model output fails closed | `Module 5 · provider failover chain` | Non-JSON payload through the real parser → chain retried exactly once (6 calls, order asserted) → `502 SCHEMA_VIOLATION` |
| Planner failures return no partial data | `Module 5 · planning failures` | 4 unusable estimate shapes → `502 PLANNING_ERROR` with the body asserted to hold exactly `error`, `code`, `message` |
| Injection is defanged | `Module 5 · OWASP LLM01` | 5 attacks; for each, exactly one closing delimiter survives, the fenced region contains no `<`/`>`, and the rules precede the user text |
| Logs and responses leak nothing | `Module 5 · secret and log leak guard` | Realistic `nvapi-`/`gsk_`/`AIza` values in env across 4 failure scenarios — including a provider error whose message embeds the key in a URL. Response body, response headers and console output all scanned for the literal keys, the Gate 5 regexes, the key variable names and the user's prompt; no `Error` object ever reaches `console` |
| No header echoes internals | `Module 5 · secret and log leak guard` | A 200's header set asserted to be exactly `content-type`, `x-provider-used`, `x-prompt-version` |

### What I could not verify, and what remains

- **No live provider call has ever been made from this repository.** Every test mocks
  `fetch`. A retired model ID would pass all 130 tests and fail only in production. See
  open item 5 in `docs/decision-log.md` for the two `curl` commands that close this.
  Module 5 narrowed but did not close this: the failover tests now mock `global.fetch`
  rather than the provider objects, so the real URL construction, header assembly, status
  handling, JSON extraction and schema gate execute — but the endpoint on the other side
  is still a stub.
- **No adversarial test asserts the model's actual behaviour** under injection. Module 5
  added five attack inputs and asserts, for each, that the fence holds, that exactly one
  closing delimiter survives, that the rules precede the user text, and that no credential
  reaches the prompt — plus that non-conforming output is refused, retried once, and then
  fails closed as `502 SCHEMA_VIOLATION`. Those are real guarantees about **our** side of
  the boundary. None of them proves a live model refuses; that still needs adversarial
  runs against a real provider and is blocked on the same open item as above.

- **Test-suite size is not test-suite coverage.** 130 passing tests is evidence of
  regression safety, not of correctness in production. The single largest untested surface
  remains the network boundary. `scripts/smoke-test.ts` now exists to close it, but
  **it has not been run with real credentials** — I have no keys. Running it is a
  handover item, not a completed one.
- **The refusal path depends on the model emitting the envelope.** If a model ignores rule 4
  and answers a medical question in valid PRD shape, schema validation passes and the
  answer is returned. A server-side domain classifier would close this; it is not built.

---

## Nour Eldeen Mohamed Nabil — Integration Lead

_To be completed by Nour._

## Joe (Youssef Alaaeldin) — Product UI & Workflow Engineer

_To be completed by Joe._

## Yasmin Mohamed Islam — Knowledge, Tools & Quality Engineer

_To be completed by Yasmin._
