# AI Usage Disclosure — ScopeCraft

Required by the Team 10 Submission Checklist. Each member maintains their own section.

---

## Yousef Mohmed Hasabo — AI & Backend Engineer

**Reporting period:** Modules 1–5 of backend production hardening, final integration, live
provider verification, and the evidence-capture pass — to **2026-08-24**.

> **Revised 2026-08-24.** Statements in this section that live verification had never
> happened were true when written and are no longer. They are corrected in place below
> rather than deleted, and the correction is called out, because the drift itself is the
> point of a disclosure document.

### Tools used

| Tool | Role in this work |
|---|---|
| Claude Code (CLI agent) | Paired implementation of the provider layer, Zod schemas and documentation; repository audit against the handbook rubric; the frontend pass in PR #3; the two evidence-capture harnesses |
| NVIDIA NIM — `openai/gpt-oss-20b` | Product-planning inference at runtime (primary tier). Was `meta/llama-3.1-8b-instruct` until NVIDIA retired it on 2026-08-27 |
| Groq — `openai/gpt-oss-120b` | Product-planning inference at runtime (fallback tier 1) |
| Google Gemini — `gemini-3.5-flash-lite` | Product-planning inference at runtime (fallback tier 2) |

> **Corrected 2026-08-24.** This table previously named `deepseek-v4-flash-0731`,
> `llama-3.3-70b-versatile` and an unversioned "Google Gemini". All three were dead in
> production — the first hung to timeout, the other two returned `404`. `npm run smoke`
> caught it on its first-ever live run. The IDs above are the ones verified with a real
> `200 OK`; `src/lib/ai/models.ts` is the source of truth if this table drifts again.

The last three are **runtime dependencies of the product**, not authoring tools. They are
listed because the handbook asks which AI systems the module depends on.

### Files I own and changed

`src/app/api/scopecraft/route.ts` · `src/lib/ai/providers.ts` ·
`src/lib/scopecraft/schema.ts` · `src/lib/scopecraft/service.ts` ·
`src/lib/scopecraft/tools.ts` · `src/lib/scopecraft/taxonomy.ts` ·
`src/lib/ai/models.ts` · `scripts/smoke-test.ts` ·
`tests/api/scopecraft.test.ts` · `.env.example` · `docs/decision-log.md` ·
`docs/api-contracts.md` · `docs/backend-delivery-summary.md` · `AI_USAGE.md` ·
`scripts/capture-evidence.sh` · `scripts/capture-ui-evidence.mjs` ·
`docs/evidence/**` · `docs/defense-prep-backend.md`

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

Re-run on **2026-09-03** against the working tree. The earlier 2026-08-23 and
2026-08-24 figures are superseded; the counts moved because Module 5, the frontend
pass, the accessibility fixes and the frontend rebuild each added tests.

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 — eslint `--max-warnings=0`, no output |
| Types | `npx tsc --noEmit` | exit 0 — no diagnostics |
| Tests | `npm test` | **548/548 passing**, 22 suites — 267 node (API · tools · evaluation) + 281 UI. Was 520/520 before the second-opinion assertions, 508/508 before the print-stylesheet and cache-label assertions, 506/506 before the A3 cache assertions, 503/503 before the B2 attempt-counting assertions, 499/499 before the E4 hover-token assertions, 496/496 before the E2 entry-effect assertions, 492/492 before the E1 motion-token assertions, 488/488 before the v7 prompt split, 486/486 before the RTL fix, 245/245 on 2026-08-24 and 130/130 on 2026-08-23 |
| Live providers | `npm run smoke` | all three reachable and answering |
| API evidence | `npm run capture:evidence` | 11/11 cases matched `docs/api-contracts.md` |
| UI + a11y evidence | `npm run capture:ui` | 22 screenshots; 38 contrast pairs (18 light, 20 dark), 0 below WCAG AA; five rebuilt views rendered in Arabic RTL |
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

- ~~**No live provider call has ever been made from this repository.**~~
  **CLOSED 2026-08-24 — and it was right to worry.** Every test still mocks `fetch`, but the
  network boundary is now exercised for real by `npm run smoke` and by
  `npm run capture:evidence`, which drives a production build against live providers. The
  first live run immediately proved the point this bullet was making: **all three default
  model IDs were dead** while all tests passed. `docs/evidence/` now holds captured
  one-hop and two-hop failovers, an exhausted chain, an unconfigured deployment and a
  timeout — real failures, forced with invalid credentials and a 1 ms deadline rather than
  mocked.
- **No adversarial test asserts the model's actual behaviour** under injection. Module 5
  added five attack inputs and asserts, for each, that the fence holds, that exactly one
  closing delimiter survives, that the rules precede the user text, and that no credential
  reaches the prompt — plus that non-conforming output is refused, retried once, and then
  fails closed as `502 SCHEMA_VIOLATION`. Those are real guarantees about **our** side of
  the boundary. None of them proves a live model refuses; that still needs adversarial
  runs against a real provider and is blocked on the same open item as above.

- **Test-suite size is not test-suite coverage.** 245 passing tests is evidence of
  regression safety, not of correctness in production. The clause that followed here —
  *"`scripts/smoke-test.ts` has not been run with real credentials — I have no keys"* — was
  true on 2026-08-23 and is **no longer**: it has been run repeatedly against real keys held
  only in a gitignored `.env.local`.

- **A defect the evidence pass found, which nothing else had.** `502 PLANNING_ERROR` is
  intermittent: **4 of 9** live generations of the same idea failed because the model
  referenced a story it never emitted. The deterministic planner is doing its job — an
  invalid plan is never rendered — but from a user's seat it reads as a broken product, and
  no mocked test would ever have surfaced it. Recorded in
  `docs/evidence/ui/ui-evidence.md`; not yet fixed.
- **The refusal path depends on the model emitting the envelope.** If a model ignores rule 4
  and answers a medical question in valid PRD shape, schema validation passes and the
  answer is returned. A server-side domain classifier would close this; it is not built.

### Work outside the backend module (2026-08-23 → 2026-08-24)

Declared here because it crosses into another member's row and should be reviewed, not
discovered in a merge.

| Work | Files | Why I did it rather than the owner |
|---|---|---|
| **Frontend pass — PR #3** (merged 2026-08-23): dark/light/system theming, full EN/AR bilingual + RTL, tabbed PRD result, toast system, header, capacity slider, progress ring | `src/components/**`, `src/context/**`, `src/lib/i18n/translations.ts`, `tests/ui/**` | The UI row's owner had no merged contribution and the main journey was not demoable. Raised as a PR and reviewed rather than pushed to `dev` |
| **Seven accessibility fixes**: skip link, sticky-header scroll clearance, 10px horizontal overflow below 768px, `autocomplete`, `theme-color`, `translate="no"`, `touch-action` | `src/app/layout.tsx`, `src/components/common/Header.tsx`, `src/components/scopecraft/InputForm.{tsx,module.css}`, `src/lib/i18n/translations.ts` | Found by auditing against the Web Interface Guidelines while producing the required evidence. Each is covered by a regression test |
| **Two evidence harnesses** | `scripts/capture-evidence.sh`, `scripts/capture-ui-evidence.mjs` | Both acceptance rows required captured evidence that did not exist |

**Joe owns the UI row and should review PR #3 and the accessibility changes.** The
accessibility work changes his components; I did not alter their behaviour, only their
markup contract, and `tests/ui/` went 111 → 114 to pin it.

### Delegated vs. verified, for the 2026-08-24 work specifically

**Delegated to AI assistance:** first drafts of both capture scripts; the CDP driver
boilerplate; first drafts of `docs/evidence/**` and `docs/defense-prep-backend.md`; the
mechanical parts of the accessibility fixes.

**Done or verified manually — these are the ones I would defend:**

- **Choosing to force real failures rather than mock them.** A mocked failover proves the
  mock. The credentials in scenarios 2–4 are genuinely invalid and the 1 ms deadline is
  genuinely a deadline, so the captured logs are the application's own output.
- **Not trusting the first draft of my own evidence.** My initial UI document asserted
  "no horizontal scrolling appears at any width". When I made the script measure it instead,
  tablet and mobile were both exactly 10px over — a real bug, found only because the claim
  was converted from prose into a check that can fail.
- **Catching a wrong WCAG citation.** I first scored target size against 44×44px; that is
  SC 2.5.5, Level **AAA**. The AA criterion is 2.5.8 at 24×24. Measured and re-stated.
- **Rejecting an over-broad fix.** The overflow could have been fixed with a global
  `box-sizing` reset; that close to submission I scoped it to the one rule that was wrong.
- **Verifying, not assuming, an inherited figure.** `docs/api-contracts.md` claims "twelve
  rejection shapes"; the table in the test file holds ten. I checked before repeating it —
  ten table cases plus a malformed body and an oversized one really is twelve.

---

## How to complete your section

Three sections below are unfinished. The Submission Checklist marks `AI_USAGE.md` **Required**
and owned by *every member*, so the row cannot pass until all four are filled in.

**Each section must be written by the person named in it.** This is a personal disclosure of
what *you* used and what *you* verified; nobody can write it on your behalf, and a section
written by someone else would make the document worse than an empty one. The scaffolds below
are pre-filled only with facts that are checkable from git — they are a starting point, not a
draft of your answer.

Copy the five headings from the template and answer them honestly. Roughly 15 minutes each.
The handbook asks for: **tools used · tasks delegated · files changed · verification ·
remaining questions.** A short, accurate section scores better than a long, vague one — and
"I could not verify X" is a *positive* signal to the rubric, not an admission of failure.

### What git can and cannot tell you

Every baseline file — the source register, the evaluation cases, the taxonomy, the UI
components — entered the repository in a **single scaffold commit, `9c67f42`, authored by
Nour**. Git therefore cannot attribute authorship *inside* that commit. If you wrote
something that landed there, say so in your own section; the history will not say it for you.

---

## Nour Eldeen Mohamed Nabil — Integration Lead

> **To be completed by Nour.** Pre-filled facts from git, 2026-08-24 — verify before signing.
>
> - **Commits authored:** 2 — `9c67f42` (initial scaffold: architecture, schema, provider
>   fallback, UI, tests) and `1a51b53` (merge of PR #1).
> - **Reviewed and merged:** PR #1 (backend safety, deterministic planning, evaluations, CI).
> - **Documents attributed to this role:** `docs/architecture.md`,
>   `docs/api-contracts.md` (co-owned), `docs/release-checklist.md`,
>   `docs/contribution-matrix.md`, `docs/session1–4-lead-checklist.md`.

**Tools used** — _which AI tools, and for what._

**Tasks delegated to AI assistance** — _what you asked a tool to draft or generate._

**Tasks done and verified manually** — _what you checked yourself, and how._

**Files I own and changed** — _and anything you changed outside your ownership._

**What I could not verify, and what remains** — _open items are expected; name them._

> Known open items already tracked elsewhere, for your convenience: PR #2 is still open;
> no git tag exists; 17 production smoke-test boxes in `docs/release-checklist.md` are
> unchecked; and Vercel still deploys from a personal fork rather than the team repo.

---

## Joe (Youssef Alaaeldin) — Product UI & Workflow Engineer

> **To be completed by Joe.** Pre-filled facts from git, 2026-08-24 — verify before signing.
>
> - **Commits authored:** 1 — `4bdd6df` ("complete role-specific updates for ScopeCraft"),
>   which sits on **PR #2 and is still open**, so it is not yet on `dev` or `main`.
> - **UI code currently on `main`** was contributed through PR #3, authored by Yousef, and
>   through the accessibility pass of 2026-08-24. Both are declared in Yousef's section
>   above and are yours to review.
> - **Evidence for your acceptance row now exists**: `docs/evidence/ui/` holds 16
>   screenshots covering all seven workflow states, three viewport widths, both themes and
>   Arabic RTL, plus a measured WCAG 2.2 AA checklist. Regenerate with `npm run capture:ui`.

**Tools used** · **Tasks delegated** · **Tasks done and verified manually** ·
**Files I own and changed** · **What I could not verify, and what remains**

> The most valuable thing you can add here is what you designed or decided that the code
> alone does not show — the seven-state model, the choice to render structured output rather
> than parse prose, and why the evidence panel is separated from model prose. Those are
> defensible design decisions and they are currently undocumented by their owner.

---

## Yasmin Mohamed Islam — Knowledge, Tools & Quality Engineer

> **To be completed by Yasmin.** Pre-filled facts from git, 2026-08-24 — verify before signing.
>
> - **Commits authored:** none under this name. Your artifacts — `docs/source-register.md`,
>   `knowledge/scopecraft/**`, `src/lib/scopecraft/taxonomy.ts`,
>   `tests/evaluation/scopecraft-cases.json` (10 cases) — all entered in Nour's scaffold
>   commit `9c67f42`, so git cannot show your authorship. **State it here in your own
>   words; nothing else in the repository will.**
> - **Changes made to your files by others** are itemised in Yousef's section above and
>   need your sign-off — in particular the **1–10 → 1–5 estimation scale change**, which
>   rewrote your fixtures and is open item 9 in `docs/decision-log.md`.

**Tools used** · **Tasks delegated** · **Tasks done and verified manually** ·
**Files I own and changed** · **What I could not verify, and what remains**

> Two open items are specifically yours and are worth naming here rather than leaving to be
> found: the evaluation set covers normal, not-found, malformed and injection cases but has
> no explicit **ambiguous** or **tool-failure** category, and live adversarial coverage is
> **one case against one provider** (decision-log item 2). Documented coverage gaps score;
> undocumented ones are a red flag.
