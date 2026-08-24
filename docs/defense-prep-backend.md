# Session 5 — AI & Backend Defense Prep

**Owner:** Yousef Mohmed Hasabo (AI & Backend Engineer)
**My Session 5 responsibility:** *"Defend AI/backend decisions and failure behavior."*
**What the rubric scores:** *"Every member can explain and modify the part they own and trace
data through the system."* Red flag: *"Member cannot explain assigned work or perform a small
change/debug task."*

So this sheet is built around three things I must be able to do live, not recite:
**trace**, **modify**, **debug**.

---

## 1. Trace a request end to end

The one thing I should be able to draw from memory. Every stage below is a real branch in
the code, in this order.

```
POST /api/scopecraft
  │
  1  size cap 16 KB ......... route.ts:86    → 413 PAYLOAD_TOO_LARGE
  2  JSON.parse ............. route.ts:93    → 400 INVALID_JSON
  3  RequestSchema .......... route.ts:99    → 422 VALIDATION_ERROR (+ issues[])
  4  clarification check .... route.ts:116   → 422 CLARIFICATION_REQUIRED (+ questions[])
  ══════ no provider module has been imported above this line ══════
  5  runScopeCraft .......... route.ts:127
       ├─ buildPrompt ............... service.ts:130   (rules first, user text fenced)
       ├─ generateWithFallback ...... providers.ts:280 (nvidia → groq → gemini)
       │    each attempt wrapped in fetchWithTimeout (providers.ts:88, 15 s default)
       ├─ retry once on invalid output ... service.ts:156  → 502 SCHEMA_VIOLATION
       ├─ refusal envelope? .............. → 422 OUT_OF_DOMAIN
       ├─ scheduleSprints ................ tools.ts:86    → 502 PLANNING_ERROR
       └─ summarizeSprintPlan ............ tools.ts:155
  6  200 OK + x-provider-used + x-prompt-version
```

**The sentence that explains the whole design:** *the model writes prose, the code does the
arithmetic.* `priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are recomputed
server-side and **overwrite** whatever the model returned. So the model cannot make the plan
exceed capacity even if it tries.

### Where the numbers come from

```
priorityScore = (value + risk) / effort        tools.ts:54, rounded to 2 dp
  value 1–5, risk 1–5, effort = story points 1–13
moscow  = threshold bands on that score        taxonomy.ts (must 2.2 / should 1.3 / could 0.7)
sprint  = greedy capacity-bounded packing      tools.ts:86, dependency-ordered, cycle-detected
```

If asked *"where did 2.2 come from?"* — the honest answer is **this project's own scale, not
an external standard.** A typical story (value 3, risk 3, 5 points) scores 1.2 and lands in
`should`, which is the intended centre of the distribution. That is recorded as open item 1
in the decision log; I should not claim MoSCoW provenance I cannot cite.

---

## 2. Decisions I chose, and the alternative I rejected

Defending a decision means naming the trade-off, not just the outcome.

| Decision | Why | What I gave up |
|---|---|---|
| Validate **before** any provider import (route.ts:86–126) | A malformed request costs zero tokens and zero latency | Slightly more code in the route than a single `try` around everything |
| **Three-tier** failover, not one provider | Free-tier LLM endpoints are individually unreliable; the demo must not depend on one vendor being up | Three credentials to manage; three model IDs that can rot independently |
| A missing key **skips**, a failing key **fails** (providers.ts:280) | A team configuring one key still gets a working app | Slightly subtle: "not configured" and "unreachable" are different 502 messages |
| Timeout is **sticky** across the chain | A slow chain and a dead chain are different operational events, so they get `504` vs `502` | One extra piece of state (`sawTimeout`) through the loop |
| **One** retry on schema violation, then give up | Structured-output models occasionally emit a stray token; a retry is far cheaper than failing | A schema-violating request costs up to 2× the tokens. The retry re-enters the **whole chain**, so it may land on a different provider |
| Arithmetic in code, not in the model | The capacity guarantee must be a property of the system, not a request to the model | The model's estimates are still its own judgement — see §5 |
| Zod as single source of truth | Compile-time type and runtime check are inferred from one schema, so they cannot drift | A runtime dependency in the hot path |
| Errors carry a **typed code** plus a user-safe message | The client can switch exhaustively; the user never sees a provider name or stack trace | The message alone is not enough to debug from — hence the server log line |
| Gemini key in a **header**, never the query string | URLs are recorded by proxies, browsers and error trackers; headers are not | None. This was an audit defect (D-06) I fixed |

---

## 3. "Make a small change" — where I would go

Likely live-modification asks, and the single place each one is changed. All of these are
one-file edits by design.

| If they ask… | Change | File |
|---|---|---|
| "Make Groq the primary provider" | `PRIMARY_AI_PROVIDER=groq` — read at call time, no rebuild | env only, `providers.ts:242` |
| "Change the timeout to 5 seconds" | `AI_TIMEOUT_MS=5000`, also read at call time | env only, `providers.ts:76` |
| "Raise the body cap to 32 KB" | `MAX_REQUEST_BODY_BYTES` | `schema.ts` |
| "Require at least 3 user stories" | add `.min(3)` to the stories array | `schema.ts` |
| "Change the priority formula" | `priorityScore` — **and re-derive the MoSCoW bands**, they are one unit | `tools.ts:54` + `taxonomy.ts` |
| "Add a fourth provider" | add an `AIProvider`, add to `PROVIDERS` and `DEFAULT_ORDER` | `providers.ts` |
| "Add a new PRD field" | add to the schema, then the prompt's output shape | `schema.ts` + `service.ts:78` |
| "Swap the model" | `NVIDIA_MODEL` / `GROQ_MODEL` / `GEMINI_MODEL` env override | `models.ts` |

**Trap to avoid on the day:** changing the estimation ranges in `schema.ts` without
re-deriving `MOSCOW_THRESHOLDS` silently collapses every story into one bucket. If asked to
widen the scale, say that out loud before editing — the code comment says so, and noticing it
is worth more than the edit.

---

## 4. "Debug this" — the failure paths I can demonstrate on demand

Everything below is already captured in [`docs/evidence/`](evidence/README.md), so I can
either show the file or re-run the capture live.

| Symptom | Real cause | How I would confirm it |
|---|---|---|
| `502 PROVIDER_ERROR` "could not be reached" | every configured key failed | server log shows three `AI provider failed:` lines then `fallback exhausted` |
| `502 PROVIDER_ERROR` "is not configured" | no key present at all | log shows `No AI provider is configured.` and **no** `AI provider failed` lines |
| `504 TIMEOUT` | a provider aborted on the clock | log shows `(timeout)` rather than `(unavailable)` |
| `502 SCHEMA_VIOLATION` | provider answered twice with unusable output | reachability is fine — this is a *content* failure, not a network one |
| `502 PLANNING_ERROR` | a story bigger than one sprint, a missing dependency, or a cycle | deterministic — reproducible from the same estimates every time |
| `200` but wrong provider | primary is down | `x-provider-used` header names who actually served it |

**The diagnostic I would reach for first:** `npm run smoke`. It caught the single worst bug in
this project — all three default model IDs were dead in production while all 242 tests passed,
because every test mocks the network. That is the most honest thing I can say about my own
test suite, and I should say it rather than wait to be asked.

**Reproduce the whole failure matrix live:**

```bash
npm run build && npm run capture:evidence
```

---

## 5. Questions I expect, with honest answers

**"Prove the fallback works."** → [`provider-fallback-log.md`](evidence/provider-fallback-log.md).
Not mocked: I invalidated the real NVIDIA credential and the chain served the request from
Groq; invalidated Groq too and it served from Gemini. Server logs and `x-provider-used`
headers are captured for both.

**"Prove a bad request doesn't cost tokens."** → Two independent arguments. Statically, the
route reaches no provider import until stage 5. Dynamically, twelve rejection shapes are
driven through the route with spies on all three providers *and* on `global.fetch`, all
asserting zero calls.

**"Can the model make the sprint plan exceed capacity?"** → No. Whatever it returns for
`sprint`/`sprint_plan` is discarded and recomputed by `scheduleSprints`. Demonstrated live:
the Groq failover run returned 8 stories worth 39 points against a capacity of 30 — the
planner committed 28 and deferred 3.

**"What stops prompt injection?"** → Layered, and I should be careful not to overclaim.
The rules block precedes all user text; user input is fenced in `<product_idea>` /
`<constraints>`; `fenceUserText` strips `<` and `>` so a forged closing tag cannot terminate
the fence. But the **binding** control is not the prompt — it is that all output must satisfy
`ModelReplySchema`, and anything else becomes `SCHEMA_VIOLATION`. Prompt instructions are a
mitigation, not a guarantee.

**"Are secrets safe?"** → Server-only route handler; no `NEXT_PUBLIC_` anywhere in `src/`;
`.next/static` scanned for key patterns; the evidence capture re-scans every file it writes.
Raw `Error` objects are never logged, because a provider SDK error's message can embed the
request URL and therefore the key.

**"What would you do with another week?"** → A server-side domain classifier. The refusal
currently depends on the model emitting the `out_of_domain` envelope; a model that ignores
rule 4 and answers in valid PRD shape would pass validation. That is the real hole.

### Where I should concede rather than argue

Conceding a known limit scores better than defending a claim I cannot evidence.

- **The estimates are the model's judgement.** The plan is *internally consistent* — capacity
  never exceeded, no story lost — not *well estimated*. Human review of story points before
  committing a sprint is still required.
- **Live adversarial coverage is one case against one provider**, not the five-case mocked
  suite. Decision log item 2, and it is Quality's to close.
- **`SCHEMA_VIOLATION`, `PLANNING_ERROR` and `OUT_OF_DOMAIN` are unit-tested, not captured
  live** — they need a provider to return specific malformed content on demand, which cannot
  be forced from outside the process.
- **MoSCoW thresholds have no external citation.** Derived from our own scale. Open item 1.
- **242 tests all mock the network.** Correct for CI, and the exact reason `npm run smoke` and
  the evidence capture exist.

---

## 6. Pre-session checklist

```bash
npm test          # 242 passing, 8 suites
npm run lint      # --max-warnings=0
npx tsc --noEmit
npm run build
npm run smoke     # live provider check — model IDs have gone stale once already
```

- [ ] Run `npm run smoke` **on the day** — hosted model availability changes independently of
      this repo, and this has already bitten us once.
- [ ] Have [`docs/evidence/`](evidence/README.md) open in a tab; it answers most of §5 faster
      than I can talk.
- [ ] Have `route.ts` open at the numbered stage comments — the trace in §1 reads straight off
      that file.
- [ ] Confirm the live URL serves the current build before the demo.

**Related:** [`api-contracts.md`](api-contracts.md) (canonical contract) ·
[`decision-log.md`](decision-log.md) (why, with sources) ·
[`youssef-ai-backend-checklist.md`](youssef-ai-backend-checklist.md) (what was delivered) ·
[`evidence/README.md`](evidence/README.md) (proof).
