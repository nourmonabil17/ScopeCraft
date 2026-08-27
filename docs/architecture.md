# ScopeCraft — Architecture (Session 1 Baseline)

**Team 10 · Integration Lead deliverable**

## 1. Product Workflow

```
User enters product idea + constraints
        │
        ▼
[UI: Discovery Wizard]  (owned by Joe)
        │  POST /api/scopecraft
        ▼
[API Route Handler]     (owned by Youssef — AI & Backend)
        │  1. validate input
        │  2. call AI provider (Gemini/Groq) — Session 2+
        │  3. return typed structured response
        ▼
[Deterministic tools]   priority_score(), plan_sprint()  (owned by Youssef + Yasmin)
        │
        ▼
[UI: PRD / Stories / Sprint board]  (owned by Joe)
        │
        ▼
Team reviews and edits the result
```

## 2. Module Ownership (updated roster)

| Module | Owner |
|---|---|
| Repo, branching, integration, deployment | Nour (Lead) |
| API route, schema, validation, AI provider, deterministic tools | Youssef (AI & Backend) |
| Discovery wizard, PRD/story rendering, sprint board UI | Joe (UI) |
| Approved templates, domain rules, test/evaluation cases | Yasmin (Knowledge/Quality) |

> Note: Karim has left the project. His Integration Lead responsibilities have transferred to Nour.

## 3. MVP (Session 1 freeze)

- Discovery wizard
- PRD sections
- User-story generator
- Acceptance-criteria editor
- MoSCoW/priority
- Capacity planner
- Backlog export

## 4. Non-Goals (out of scope)

- Automatically committing the team to hard delivery dates
- Replacing product-owner decisions
- Generating unbounded/uncontrolled scope

## 4a. Trust boundary: the API surface

Added 2026-08-24 after an information-disclosure review, so the boundary is a recorded
decision rather than an unstated assumption.

```
   public internet
        │
        ▼
┌───────────────────────────────────────────────┐
│  POST /api/scopecraft   (Next.js route handler)│
│  ┌─────────────────────────────────────────┐  │
│  │ session check       → 401, body unread  │  │  ← closed 2026-08-27
│  ├─────────────────────────────────────────┤  │
│  │ 16 KB body cap      → 413, unparsed     │  │
│  │ JSON.parse          → 400               │  │  cheap, local,
│  │ Zod RequestSchema   → 422               │  │  zero-token,
│  │ clarification check → 422               │  │  zero-query
│  ├─────────────────────────────────────────┤  │  rejections
│  │ daily quota (1 query) → 429             │  │
│  └─────────────────────────────────────────┘  │
│  ══ no provider module imported above here ══ │
│  provider call (credential never leaves here) │
│  persist the outcome, success or failure      │
└───────────────────────────────────────────────┘
        │                          │
        ▼  NVIDIA / Groq / Gemini  ▼  Postgres (users, plans)
```

**What is protected.** Provider credentials are read only inside the server route handler and
never enter the client bundle; the pre-provider gates mean a malformed or abusive-shaped
request costs nothing; and error responses carry no provider name, model ID, stack trace or
echoed input.

**Closed 2026-08-27.** The endpoint is no longer anonymous. `POST /api/scopecraft` requires a
session before it reads the body, every generation is attributed to a `users` row, and a
rolling 24-hour per-account budget is counted from `plans`. The budget counts **attempts**,
not successes — a generation that reached a provider and then failed still spent tokens, so
`plans.status` allows `'failed'` and those rows count. Verified end to end: `401` with no
cookie and zero rows written, `200` with a session and the row persisted, `429` at the limit.

**What is still not protected.** The limit is **per account, not per IP**. Requiring a session
is what stops anonymous quota burn; someone willing to create many GitHub accounts is not
addressed. Sessions also cannot be revoked server-side before they expire — that is the price
of the JWT strategy, and rotating `AUTH_SECRET` invalidates all of them at once, which is the
only lever. Edge middleware token-bucket limiting backed by a durable store is the next layer
if per-IP abuse becomes real; it is designed, not built.

**Upgrade path.** ~~session JWT authentication~~ **done** — Auth.js, GitHub OAuth, JWT
strategy, no session table. ~~stage-0 session check inside the route handler~~ **done**.
~~per-account daily generation budgets counted from the `plans` table~~ **done**. What remains
is edge middleware token-bucket rate limiting backed by a durable store (e.g. Upstash Redis)
for the per-IP layer sign-in cannot cover. Designed in
[`database-and-auth-design.md`](database-and-auth-design.md).

> **Scope note.** §4 below froze "no authentication" as an MVP non-goal. That decision has
> been deliberately reversed, in two steps — the page in the sign-in change, the endpoint
> here. Recorded rather than left for an examiner to find as a contradiction; the reasoning is
> in [`decision-log.md`](decision-log.md) entries 12 and 16.

## 5. Repository & Branch Rules

- `main` — always deployable, protected, no direct pushes
- `dev` — integration branch, all feature branches merge here first
- One GitHub issue per member per session
- Every merge to `dev`/`main` requires a reviewed pull request (no self-merge without review)

## 6. Session 1 Checkpoint

- [ ] Every member can run the project locally
- [ ] Repository created; all 4 members have write access
- [ ] `main` and `dev` branches created; PR rule active
- [ ] This architecture doc reviewed and agreed by the whole team
- [ ] One GitHub issue created per member
- [ ] 30-minute kickoff held; each member explained their module
