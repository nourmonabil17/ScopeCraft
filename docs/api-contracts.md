# ScopeCraft API Contracts

Owner: Yousef Mohmed Hasabo (AI & Backend Engineer).
Last synchronised with the code: **2026-08-23**, after final integration.

Every status code and field below was read from the implementation. Anything not yet
implemented is marked **PLANNED** and must not be relied on by the UI until it ships.

---

## `POST /api/scopecraft`

Generates a structured PRD, a prioritized backlog and a capacity-bounded sprint plan.

**Runtime:** Node.js, server-only. Provider credentials are read exclusively inside this
route's dependency graph and never reach the client bundle.

### Request

**Headers**

```
Content-Type: application/json
```

**Body** — validated by `RequestSchema` in `src/lib/scopecraft/schema.ts`.

| Field | Type | Required | Constraints | Default |
|---|---|---|---|---|
| `idea` | string | **yes** | trimmed, min 20, max 2000 characters | — |
| `constraints` | string \| string[] | no | each string max 1000 characters | — |
| `team_capacity_points` | integer | no | 1–500 | `30` |
| `sprint_length_days` | integer | no | 5–30 | `14` |

Total request body is capped at **16 KB** (`MAX_REQUEST_BODY_BYTES`), enforced by streaming
the body and aborting once the cap is exceeded.

> **Deprecated alias.** The browser currently posts `capacity_per_sprint`. It is accepted
> and mapped to `team_capacity_points` by `normalizeRequestInput`. Joe should migrate the
> client to the canonical name; the alias is removed once that lands.

**Example**

```json
{
  "idea": "A tool that turns a rough product idea into a sprint-ready backlog for student teams.",
  "constraints": ["Team of 4", "5 weeks", "no paid APIs"],
  "team_capacity_points": 30,
  "sprint_length_days": 14
}
```

### Response `200 OK`

Validated by `ScopeCraftResponseSchema` before it leaves the server. Eleven mandatory
fields plus the deterministic `moscow` classification.

| # | Field | Type | Source |
|---|---|---|---|
| 1 | `problem` | string | model |
| 2 | `target_user` | string | model |
| 3 | `goals` | string[] (≥1) | model |
| 4 | `non_goals` | string[] | model |
| 5 | `requirements` | string[] (≥1) | model |
| 6 | `user_stories` | Story[] (≥1) | model |
| 7 | `acceptance_criteria` | string[] (≥1) | model |
| 8 | `risks` | Risk[] (≥1) | model |
| 9 | `priority` | Record<storyId, number> | **deterministic** |
| 10 | `effort` | Record<storyId, positive int> | **deterministic** |
| 11 | `sprint` | SprintItem[] | **deterministic** |
| — | `moscow` | Record<storyId, "must"\|"should"\|"could"\|"wont"> | **deterministic** |
| — | `sprint_plan` | SprintPlanResult | **deterministic** |

**Story**

| Field | Type | Constraints |
|---|---|---|
| `id` | string | non-empty |
| `as_a`, `i_want`, `so_that` | string | non-empty |
| `acceptance_criteria` | string[] | ≥1 |
| `points` | integer | 1–13 |
| `value` | integer | 1–5 |
| `risk` | integer | 1–5 |
| `dependencies` | string[] | unique; may not contain the story's own `id` |

**Risk** — `{ id, description, impact, likelihood }` where `impact` and `likelihood` are
`"low" \| "medium" \| "high"`.

**SprintItem** — `{ story_id, priority_score, effort, sprint }` where `sprint` is a
positive integer sprint index.

**SprintPlanResult** — the first-sprint commitment:

| Field | Type | Meaning |
|---|---|---|
| `capacity_points` | positive integer | Echoes the request's `team_capacity_points` |
| `committed_points` | non-negative integer | Points actually scheduled into sprint 1 |
| `included` | string[] | Story IDs in sprint 1, priority order |
| `deferred` | string[] | Story IDs beyond sprint 1, priority order |

`sprint` and `sprint_plan` answer different questions and are complementary, not
redundant: `sprint` says *which sprint each story lands in* across the whole backlog;
`sprint_plan` says *what the team is committing to now, and what slipped*. Schema
refinement guarantees `committed_points <= capacity_points`, and every story ID appears
in exactly one of `included` / `deferred` — both asserted by test.

**Response headers**

| Header | Meaning |
|---|---|
| `X-Provider-Used` | `nvidia` \| `groq` \| `gemini` — which tier answered |
| `X-Prompt-Version` | prompt contract version (currently `v5`) |

### Error responses

All errors share the shape `{ error: true, code, message }`. Messages are user-safe: they
never contain provider identifiers, stack traces, request payloads, or credentials.

The full code set is exported as `ERROR_CODES` from `src/lib/scopecraft/schema.ts`, so a
client can exhaustively switch on it.

| Status | `code` | Trigger | Provider called? |
|---|---|---|---|
| `401` | `UNAUTHORIZED` | No valid session cookie. Checked **first**, before the body is read | no |
| `400` | `INVALID_JSON` | Body is not valid JSON (syntax) | no |
| `413` | `PAYLOAD_TOO_LARGE` | Body exceeds 16 KB, by declared `Content-Length` or by measured stream | no |
| `422` | `VALIDATION_ERROR` | Body parses but fails `RequestSchema`; response adds `issues: {path, message}[]` | **no** |
| `422` | `CLARIFICATION_REQUIRED` | Idea detected as unintelligible; response adds `questions: string[]` | no |
| `422` | `OUT_OF_DOMAIN` | Request is outside software product planning; the model returned the refusal envelope | yes (one tier only) |
| `429` | `RATE_LIMITED` | Over the rolling 24-hour budget for this account; response adds `limit` and `used` | no |
| `502` | `PLANNING_ERROR` | Deterministic planner rejected the model's estimates (story exceeds capacity, missing dependency, dependency cycle, duplicate story ID) | yes |
| `502` | `SCHEMA_VIOLATION` | Model output failed `ModelReplySchema` on the initial pass **and** on the single retry | yes |
| `502` | `PROVIDER_ERROR` | Every configured provider was unreachable, or none is configured | yes |
| `504` | `TIMEOUT` | Any provider in the chain aborted on the timeout | yes |

> **Contract change in Module 5.** The former catch-all `INVALID_INPUT` is gone. `400` and
> `413` now carry distinct codes, and a schema violation is distinguishable from an
> unreachable chain. The 400/413/502 **HTTP statuses and messages are unchanged**, and the
> browser client reads `message` rather than `code`, so no UI change is required — but any
> code branching on `INVALID_INPUT` must be updated. **Both stale references were
> corrected on 2026-08-24:** `docs/youssef-ai-backend-checklist.md` was rewritten
> against the current code, and `docs/session2-lead-checklist.md` — a Session 2
> historical record — now carries a superseded banner pointing here instead of being
> rewritten, so the decision trail stays intact.

**Validation failures (`422 VALIDATION_ERROR`)** carry a field-level `issues` array:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Some fields need attention before a plan can be generated.",
  "issues": [
    { "path": "idea", "message": "Too small: expected string to have >=20 characters" },
    { "path": "team_capacity_points", "message": "Too big: expected number to be <=500" }
  ]
}
```

`path` is the dotted field path (`"(root)"` when the failure is on the object itself).
Only `path` and `message` are forwarded — Zod's `received` / `input` fields are dropped, so
**a rejected request can never echo the submitted value back to the caller.** Asserted by
test.

`422 OUT_OF_DOMAIN` is implemented and safe for the UI to branch on. Its body is
`{ error: true, code: "OUT_OF_DOMAIN", message: "ScopeCraft only plans software products." }`
and carries no PRD fields.

### Exact error payloads

Every one of these is asserted verbatim by a test, so the strings below are the strings the
client receives. Most are additionally captured from a **live production build** in
[`docs/evidence/curl-evidence.md`](evidence/curl-evidence.md) and
[`docs/evidence/provider-fallback-log.md`](evidence/provider-fallback-log.md); re-capture
with `npm run capture:evidence`, which fails if any response drifts from this table.

```jsonc
// 400 — body is not valid JSON
{ "error": true, "code": "UNAUTHORIZED",
  "message": "Please sign in to generate a plan." }

{ "error": true, "code": "RATE_LIMITED",
  "message": "You have reached the limit of 20 plans per day. Please try again tomorrow.",
  "limit": 20, "used": 20 }

{ "error": true, "code": "INVALID_JSON",
  "message": "Request body must be valid JSON." }

// 413 — body exceeds 16 KB
{ "error": true, "code": "PAYLOAD_TOO_LARGE",
  "message": "Request body is too large." }

// 422 — body parses but fails RequestSchema (adds `issues`)
{ "error": true, "code": "VALIDATION_ERROR",
  "message": "Some fields need attention before a plan can be generated.",
  "issues": [{ "path": "idea", "message": "Too small: expected string to have >=20 characters" }] }

// 422 — idea is unintelligible (adds `questions`)
{ "error": true, "code": "CLARIFICATION_REQUIRED",
  "message": "Please clarify the product idea before generating a plan.",
  "questions": ["What problem should the product solve?", "Who is the intended user?"] }

// 422 — outside the software-product-planning domain
{ "error": true, "code": "OUT_OF_DOMAIN",
  "message": "ScopeCraft only plans software products." }

// 502 — the model's estimates cannot be turned into a valid sprint plan
{ "error": true, "code": "PLANNING_ERROR",
  "message": "The generated stories could not be converted into a valid sprint plan." }

// 502 — model output failed schema validation twice
{ "error": true, "code": "SCHEMA_VIOLATION",
  "message": "The AI provider returned an unusable response. Please try again." }

// 502 — every provider unreachable, or none configured
{ "error": true, "code": "PROVIDER_ERROR",
  "message": "No AI provider could be reached. Please try again shortly." }
// ...or, when nothing is configured:
{ "error": true, "code": "PROVIDER_ERROR",
  "message": "No AI provider is configured. Please try again shortly." }

// 504 — a provider aborted on the timeout
{ "error": true, "code": "TIMEOUT",
  "message": "The AI provider timed out. Please try again shortly." }
```

A `PLANNING_ERROR`, `SCHEMA_VIOLATION` or `PROVIDER_ERROR` body contains exactly the three
envelope keys — no partial plan is ever returned alongside a failure.

### Security boundary ordering

The route performs the cheap local checks before anything remote, so a bad request costs
zero tokens:

```
0.  session check       → 401 UNAUTHORIZED
────────────── nothing is read from an anonymous caller above this line ──────────────
1.  size cap (16 KB)    → 413
2.  JSON.parse          → 400
3.  RequestSchema       → 422 VALIDATION_ERROR
4.  clarification check → 422 CLARIFICATION_REQUIRED
────────────── no database round trip above this line ──────────────
4b. daily quota         → 429 RATE_LIMITED
────────────── no provider module touched above this line ──────────────
5.  runScopeCraft       → 200 / 422 / 502 / 504
6.  persist the outcome       (never changes the response)
```

Two of those lines are load-bearing and are asserted by tests rather than trusted:

- **Nothing is read from an anonymous caller.** A request with no session returns `401`
  having called no provider and made no database query.
- **A malformed request from a *signed-in* caller reaches neither.** This is what makes
  counting attempts fair — a typo cannot consume quota, because validation runs before the
  quota query. Reordering those two breaks the test at
  `tests/api/scopecraft.test.ts` → *"never reaches the database for a malformed body"*.

Twelve rejection shapes are driven through the route and asserted to leave spies on **all
three** providers — and on `global.fetch` — at zero calls. The 413 path additionally
asserts that the oversized body is never handed to `JSON.parse`, and that a declared
`Content-Length` over the cap is rejected before the stream is read at all.

### Server logging

5xx responses emit exactly one line: `scopecraft.request_failed code=<CODE> status=<NNN>`.
4xx rejections are not logged at all, and a `422 OUT_OF_DOMAIN` refusal is not logged as a
server failure. No request payload, field value, credential, or raw `Error` object is ever
passed to `console` — a provider error's message can contain the request URL, and
therefore a key.

Asserted across four failure scenarios (success, unreachable chain, timeout, schema
violation) with realistic `nvapi-` / `gsk_` / `AIza` credentials in the environment and a
provider error whose *message embeds the key in a URL*: none of the response body, the
response headers, or the console output ever contains a key, a key variable name, or the
user's prompt.

### Response headers

The route handler sets exactly `content-type`, `x-provider-used` and `x-prompt-version` on a
`200` — asserted by test, so the handler cannot quietly start echoing internals.

On the wire the framework adds the security headers configured in `next.config.js`
(`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`) to every response, and `X-Powered-By` is disabled. The test asserts the
handler's own header set rather than the full HTTP response, which is why adding a security
header does not break it — and why a *handler* leak still would.

---

## Trust boundary

The model supplies descriptive PRD prose and per-story estimates. It does **not** decide
priority, MoSCoW bucket, or sprint allocation.

```
request → 16 KB cap → RequestSchema → [provider chain] → ProviderOutputSchema
                                             ↓
                    priorityScore / toMoscow / planSprint   ← deterministic
                                             ↓
                          ScopeCraftResponseSchema → 200
```

`buildPrompt` (in `service.ts`) explicitly instructs the model not to return `priority`,
`effort`, `sprint`, `sprint_plan` or `moscow`, and `service.ts` overwrites those fields
unconditionally. Any values the model supplies are discarded before validation — asserted
by test: a model reply carrying `priority: 999`, `sprint: 42`, `moscow: "must"` and an
invented `sprint_plan` yields `priority: 2`, `sprint: 1`, `moscow: "should"` and a
computed plan.

### Injection posture (OWASP LLM01)

Untrusted text is fenced inside `<product_idea>` and `<constraints>`, beneath a numbered
AUTHORITATIVE RULES block that always precedes user text. `fenceUserText()` removes `<`
and `>` from user input, so a forged `</product_idea>` cannot break out of the fence.

A model reply must satisfy `ModelReplySchema` — either a full plan or the refusal
envelope. Anything else raises `invalid_provider_output`, the whole provider chain is
retried **once**, and a second failure becomes `schema_violation` → `502`. Prompt rules
reduce injection success; this schema gate is what actually bounds it.

---

## Deterministic tool contracts

Implemented in `src/lib/scopecraft/tools.ts`. Pure: no I/O, no clock, no randomness.
Both are exported under their camelCase names and under snake_case contract aliases
(`priority_score`, `plan_sprint`) which are the *same function references*.

### `priorityScore({ storyId, value, risk, effort }) → number`

```
score = round2((value + risk) / effort)
```

Throws `PlanningError` when `value` or `risk` is outside 1–5, or `effort` is outside 1–13,
or any is non-integer. Arguments are never silently clamped.

### `toMoscow(score: number) → "must" | "should" | "could" | "wont"`

In `src/lib/scopecraft/taxonomy.ts`. Thresholds `must ≥ 2.2`, `should ≥ 1.3`,
`could ≥ 0.7`, else `wont`. Calibrated against this project's 1–5 / 1–5 / 1–13 scale — not
inherited from an external standard. Changing the estimation ranges invalidates these
bands.

### `scheduleSprints({ stories, capacityPerSprint }) → PlannedStory[]`

Greedy: sort by score descending with a stable `storyId` tie-break, fill each sprint to
capacity, open the next when the next story does not fit. A story is scheduled only after
every story it depends on.

Invariants: no sprint's committed points exceed `capacityPerSprint`; every input story
appears exactly once; identical input yields identical output.

Throws `PlanningError` for non-positive or non-integer capacity, duplicate story IDs, a
story larger than one sprint's capacity, a missing dependency, self-dependency, or a
dependency cycle.

### `planSprint({ stories, capacityPerSprint }) → SprintPlanResult`

The handbook tool contract: what is the team committing to this sprint, and what slipped?
Equivalent to `summarizeSprintPlan(scheduleSprints(input), capacityPerSprint)` and throws
on exactly the same unusable inputs, since it delegates.

`summarizeSprintPlan(schedule, capacityPerSprint)` is exported separately so the request
path can schedule once and derive the summary, rather than running the greedy packer
twice per request.

> **Contract discrepancy — RESOLVED.** The handbook draft specified
> `plan_sprint(...) → { capacity_points, committed_points, included, deferred }` while the
> shipped function returned `PlannedStory[]`. This was raised as an open decision through
> Modules 2–5 and resolved in final integration: `planSprint` now returns the handbook
> shape, and the array-returning function is named `scheduleSprints` for what it actually
> does. Both are exported, and `sprint_plan` is surfaced in the API response so the UI can
> consume it without recomputation.
>
> The handbook also specified `priority_score(...) → { score, moscow }`. That half is
> **deliberately not adopted**: `priorityScore` stays a pure `number`. MoSCoW is applied
> by `toMoscow` in `taxonomy.ts`, which is Yasmin's calibration surface — folding it into
> the scoring function would couple two independently-owned rules and force every caller
> that only wants a score to depend on the taxonomy. The response carries both values
> separately, so nothing is lost to a consumer.

---

## Environment

Server-only. Never prefix any of these with `NEXT_PUBLIC_`.

| Variable | Purpose | Default |
|---|---|---|
| `NVIDIA_API_KEY` | Primary provider credential | — |
| `GROQ_API_KEY` | Fallback 1 credential | — |
| `GEMINI_API_KEY` | Fallback 2 credential | — |
| `PRIMARY_AI_PROVIDER` | `nvidia` \| `groq` \| `gemini` | `nvidia` |
| `AI_TIMEOUT_MS` | Per-attempt abort timeout | `15000` |
| `NVIDIA_MODEL` | Model override | `meta/llama-3.1-8b-instruct` |
| `GROQ_MODEL` | Model override | `openai/gpt-oss-120b` |
| `GEMINI_MODEL` | Model override | `gemini-3.5-flash-lite` |

A provider with no credential is **skipped**, not failed, so a team configuring one key
still gets a working endpoint. If no provider is configured the chain raises
`not_configured`.

Model IDs are overridable because hosted availability changes independently of this
repository. **None has been confirmed against a live API** — see open item 4 in
`docs/decision-log.md`.
