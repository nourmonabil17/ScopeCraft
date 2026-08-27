# ScopeCraft — Project Plan & Master Checklist

**Owner:** Yousef Mohmed Hasabo — **whole project**, every side of it.
**Written:** 2026-08-27 · **Baseline commit:** `10fc945`
**Structure:** Part → Module → Point → Step. Every step is a checkbox. Nothing is ticked
until it has been *run*, not read.

Steps marked **decision** cannot be worked around by trying harder — they need an answer
from you before the work under them can proceed.

---

## Coverage map

Every part of this system, and which module owns it. If something in the repository is not
in this table, the plan does not cover it and the table is wrong — fix the table.

| Part of the system | Where it lives | Module |
|---|---|---|
| Local dev environment, Docker | `Dockerfile`, `docker-compose.yml` | [1](#module-1--docker--the-local-environment) |
| Database schema & data | `db/schema.sql`, `src/lib/db.ts` | [2](#module-2--database) |
| Authentication & session | `src/auth.ts`, `src/app/api/auth/`, `src/app/login/` | [0.2](#02-auth_-variables-are-not-set-in-vercel), [3.1](#31-persist-the-user-on-sign-in), [3.2](#32-stage-0-session-check-on-the-api-route) |
| API route pipeline & error contract | `src/app/api/scopecraft/route.ts` | [3](#module-3--backend--api) |
| AI providers & failover | `src/lib/ai/providers.ts`, `models.ts` | [7](#module-7--ai-prompts--knowledge-layer), [9](#module-9--performance--reliability) |
| Prompts & prompt versioning | `src/lib/scopecraft/service.ts`, `docs/prompt-versions.md` | [7](#module-7--ai-prompts--knowledge-layer) |
| Deterministic tools (scoring, MoSCoW, sprint packing) | `src/lib/scopecraft/tools.ts`, `tool-rules.ts` | [7](#module-7--ai-prompts--knowledge-layer) |
| Knowledge corpus, taxonomy, source register | `knowledge/`, `taxonomy.ts`, `docs/source-register.md` | [7](#module-7--ai-prompts--knowledge-layer) |
| Evaluation set & safety cases | `tests/evaluation/` | [7](#module-7--ai-prompts--knowledge-layer) |
| UI components & the seven states | `src/components/`, `src/app/scopecraft/page.tsx` | [4](#module-4--frontend) |
| Theming, direction, translations | `src/context/`, `src/lib/i18n/` | [10](#module-10--accessibility--internationalisation) |
| Accessibility | measured by `scripts/capture-ui-evidence.mjs` | [10](#module-10--accessibility--internationalisation) |
| Client/server boundary & secrets | `NEXT_PUBLIC_` audit, bundle scan | [8](#module-8--security) |
| Security headers & CSP | `next.config.js` | [0.1](#01-the-login-page-renders-unstyled-in-safari-on-localhost), [8](#module-8--security) |
| Wiring between all of the above | — | [5](#module-5--integration--wiring-it-together) |
| Tests, evidence capture, manual QA | `tests/`, `scripts/capture-*` | [6](#module-6--qa--testing) |
| Performance, cost, reliability | — | [9](#module-9--performance--reliability) |
| All documentation (38 documents) | `README.md`, `docs/`, root files | [11](#module-11--documentation) |
| Repository, branches, PRs, CI | `.github/`, git remotes | [12](#module-12--repository-ci--process) |
| Rubric coverage, defense, demo | handbook CSVs | [13](#module-13--submission--defense) |
| Deployment & release | Vercel, fork `main` | [14](#module-14--release) |

---

## Contents

**Part I — Unblock & build**

| Module | Scope | Cost | Blocks |
|---|---|---|---|
| [0](#module-0--blockers) | Blockers — visible breakage | 1–2 h | everything |
| [1](#module-1--docker--the-local-environment) | Docker & the local environment | 3–4 h | 2, 6 |
| [2](#module-2--database) | Database | 2–3 h | 3, 4, 5, 6 |
| [3](#module-3--backend--api) | Backend & API | 4–5 h | 4, 5 |
| [4](#module-4--frontend) | Frontend | 4–5 h | 5 |
| [5](#module-5--integration--wiring-it-together) | Integration — wiring it together | 2–3 h | 6 |

**Part II — Verify**

| Module | Scope | Cost | Blocks |
|---|---|---|---|
| [6](#module-6--qa--testing) | QA & testing | 4–5 h | 14 |
| [7](#module-7--ai-prompts--knowledge-layer) | AI, prompts & knowledge layer | 3–4 h | 13 |
| [8](#module-8--security) | Security | 2–3 h | 14 |
| [9](#module-9--performance--reliability) | Performance & reliability | 2–3 h | — |
| [10](#module-10--accessibility--internationalisation) | Accessibility & internationalisation | 2–3 h | 13 |

**Part III — Document & ship**

| Module | Scope | Cost | Blocks |
|---|---|---|---|
| [11](#module-11--documentation) | Documentation — all 38 documents | 6–8 h | 13, 14 |
| [12](#module-12--repository-ci--process) | Repository, CI & process | 2–3 h | 14 |
| [13](#module-13--submission--defense) | Submission & defense | 3–4 h | — |
| [14](#module-14--release) | Release | 1 h | — |

**Total: roughly five working days.** Module 11 is the largest single block and the one
most likely to be underestimated — thirteen documents do not write themselves.

**Related documents.** The auth/database design this plan executes is
[`database-and-auth-design.md`](database-and-auth-design.md); the schema is
[`db/schema.sql`](../db/schema.sql); decisions land in [`decision-log.md`](decision-log.md).
None are superseded by this file — this is sequencing, they are reasoning.

---
---

# Part I — Unblock & build

---

## Module 0 — Blockers

Three things wrong right now. Two are visible to anyone who opens the app.

### 0.1 The login page renders unstyled in Safari on `localhost`

**Symptom (observed 2026-08-27).** Safari at `http://localhost:3311/login` shows raw HTML —
`SCScopeCraftLive`, `ENEnglish العربية`, an unstyled heading, a plain link. Chromium renders
the same URL correctly. The inline `<style>` from the root layout *does* apply (background
and text colour are right); the CSS Module chunks under `/_next/static/chunks/*.css` do not.

**Leading hypothesis — `upgrade-insecure-requests` in the CSP.** That directive rewrites
every `http://` subresource request to `https://`. Chromium exempts `localhost`; Safari does
not, so it requests `https://localhost:3311/_next/static/chunks/….css`, no TLS listener
answers, and the request dies. This explains the exact split observed: inline styles need no
network and survive; external CSS and JS need one and do not.

**Already established — do not re-check:**

- The stylesheets serve correctly over http: `200`, `text/css`, 1721 bytes.
- There is no TLS listener on the dev port; an https request to it fails to connect.
- `upgrade-insecure-requests` is present in the `Content-Security-Policy` response header.

**Steps**

- [ ] **0.1.1** Reproduce in Safari with the Web Inspector Console open. Confirm the CSS
      requests are upgraded to `https://` rather than 404ing or being blocked by a different
      directive. **Record the exact console text** — this is the line between a confirmed
      diagnosis and a plausible one.
- [ ] **0.1.2** If confirmed: make `upgrade-insecure-requests` production-only in
      `next.config.js` — build the directive array conditionally on
      `process.env.NODE_ENV === "production"`. It buys nothing on `http://localhost` (there
      is no mixed content to upgrade) and costs the entire local Safari experience.
- [ ] **0.1.3** If **not** confirmed, work these in order and record which it was:
      (a) stale Safari cache of an older build — ⌥⌘E then ⌘R;
      (b) `localhost` vs `127.0.0.1` origin mismatch against `default-src 'self'`;
      (c) Safari's Develop → Disable Styles left on from earlier debugging.
- [ ] **0.1.4** Verify in **both** Safari and Chromium, at `localhost` *and* `127.0.0.1`,
      on `/login` *and* `/scopecraft`.
- [ ] **0.1.5** Confirm the deployed https site is unaffected either way. On https there is
      nothing to upgrade — this was never a production bug. Say that explicitly rather than
      letting it read as a production incident.
- [ ] **0.1.6** Note it in [`security-review.md`](security-review.md) beside the CSP
      section: what the directive does, why it is production-only, what it looked like when
      it was not.
- [ ] **0.1.7** Re-check after Module 1 — Docker changes the local origin. See 1.5.4.

### 0.2 `AUTH_*` variables are not set in Vercel

Production redirects every visitor to `/login`, where sign-in fails. **The highest-value ten
minutes in this plan.**

- [ ] **0.2.1** Create a GitHub OAuth app at <https://github.com/settings/developers>.
      Callback URL, exactly:
      `https://scope-craft-nine.vercel.app/api/auth/callback/github`
- [ ] **0.2.2** `npx auth secret`
- [ ] **0.2.3** Set in Vercel, **Production and Preview**: `AUTH_SECRET`, `AUTH_GITHUB_ID`,
      `AUTH_GITHUB_SECRET`, `AUTH_URL=https://scope-craft-nine.vercel.app`
- [ ] **0.2.4** While in that screen, check `NVIDIA_API_KEY` — known finding #5. Three
      production generations were served by Groq/Gemini, never NVIDIA. A missing key is
      *skipped* rather than failed, which is exactly that signature.
- [ ] **0.2.5** Redeploy. Verify by signing in on the live URL: header shows your GitHub
      name, **Sign out** returns you to `/login`.
- [ ] **0.2.6** Register a second OAuth app (or second callback URL) for
      `http://localhost:3000/api/auth/callback/github`; put those values in `.env.local`.

### 0.3 The pending history rewrite

Eleven commits carry a `Co-Authored-By` trailer.

- [ ] **0.3.1** **Decision:** do it at all? It rewrites shared history on a repo with an open
      PR from a teammate. That is a real cost.
- [ ] **0.3.2** If yes: run the rewrite (blocked on the assistant's side — must be you).
- [ ] **0.3.3** **In the same sitting**, fix every invalidated SHA: `HANDOFF.md`,
      `docs/youssef-ai-backend-checklist.md`, `docs/evidence/curl-evidence.md`,
      `docs/evidence/provider-fallback-log.md`, `docs/evidence/ui/ui-evidence.md`,
      `docs/evidence/ui/accessibility-checklist.md`, and three files under
      `docs/evidence/raw/`. Never "later" — some are graded artifacts.
- [ ] **0.3.4** Force-push to both remotes and tell the team before they pull.
- [ ] **0.3.5** If no: close it in `HANDOFF.md` §1.5 rather than leaving it open forever.

---

## Module 1 — Docker & the local environment

**Decision made:** Docker is in. Recorded honestly for the defense: Vercel does **not**
build from a Dockerfile, so this is not the production deploy path. What it buys is a local
environment that starts with one command, a real Postgres without a signup, integration
tests that can touch a real database, and a portable deploy path if the project leaves
Vercel. What it costs is a second build definition to keep in sync. Both halves belong in
the decision log — see 11.6.2.

### 1.1 The database container

Start here. This half pays for itself immediately.

- [ ] **1.1.1** Write `docker-compose.yml` with a `db` service: `postgres:16-alpine`,
      `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, port `5432` published.
- [ ] **1.1.2** Add a named volume so data survives `docker compose down`. Without it every
      restart wipes the database, which is confusing rather than clean.
- [ ] **1.1.3** Mount `db/schema.sql` into `/docker-entrypoint-initdb.d/` so a fresh
      container applies the schema automatically. This is why the schema is idempotent.
- [ ] **1.1.4** Add a `healthcheck` using `pg_isready`. Without it, anything depending on
      the database races container startup and fails on the first run only — the worst kind
      of flake.
- [ ] **1.1.5** Verify: `docker compose up -d db`, then `psql` in and confirm `users` and
      `plans` exist with their constraints and index.
- [ ] **1.1.6** Verify the volume: insert a row, `docker compose restart db`, confirm it
      survived.

### 1.2 The application image

- [ ] **1.2.1** Add `output: "standalone"` to `next.config.js`. Without it the image carries
      all of `node_modules`; with it Next emits a self-contained server bundle.
      **Verify the Vercel build still works immediately after this** — it is a build-level
      change to a config file Vercel shares.
- [ ] **1.2.2** Write a multi-stage `Dockerfile`: `deps` → `builder` → `runner`, on
      `node:22-alpine`. Node 22 is required — `scripts/capture-ui-evidence.mjs` uses the
      global `WebSocket`.
- [ ] **1.2.3** Run as a non-root user in the final stage. A container running as root is a
      finding an examiner spots in five seconds.
- [ ] **1.2.4** Write `.dockerignore`: `node_modules`, `.next`, `.git`, `.env*`,
      `docs/evidence/ui/shots`. **Verify no `.env` file can enter the image** — a baked-in
      secret survives in every layer.
- [ ] **1.2.5** `AUTH_SECRET` and `DATABASE_URL` are **run-time**, never `ARG`, never baked
      into a layer.
- [ ] **1.2.6** Add the `web` service to compose, depending on `db` with
      `condition: service_healthy`.
- [ ] **1.2.7** Verify: `docker compose up --build`, open `http://localhost:3000/login`,
      sign in, generate a plan, confirm the row lands in the containerised database.
- [ ] **1.2.8** Check the final image size. Over ~400 MB means standalone output is not
      being used correctly.

### 1.3 Developer experience

- [ ] **1.3.1** Add `.env.docker.example` — compose-specific values, where `DATABASE_URL`
      points at the `db` service hostname rather than `localhost`.
- [ ] **1.3.2** Add npm scripts: `docker:up`, `docker:down`, `docker:logs`, `docker:psql`.
      Nobody should have to remember compose flags to read a log.
- [ ] **1.3.3** **Decision:** does `docker compose up` run the app in dev mode with hot
      reload, or production mode? Recommendation: **database in Docker, app on the host**
      for daily work — bind-mount hot reload is slow on macOS and the app has no native
      dependencies needing containerisation. Keep `web` for verifying the image and for a
      portable demo.
- [ ] **1.3.4** Document the one-command start in `docs/local-development.md` (11.4.1).
- [ ] **1.3.5** Verify a genuinely cold start: `docker compose down -v`, then
      `docker compose up`. That is what a teammate's first run looks like.

### 1.4 Interaction with what already exists

The parts most likely to break, and why this module is not just "write a Dockerfile".

- [ ] **1.4.1** The evidence scripts run `next start` on **host** ports 3200/3201/3100.
      Decide host or container, and keep the base URLs configurable either way — they
      already read `UI_BASE_URL` / `UI_BAD_BASE_URL`.
- [ ] **1.4.2** `scripts/capture-ui-evidence.mjs` launches Chrome from a macOS path and
      cannot run inside the app container without a headless Chrome image. Keep it on the
      host — say so in the docs rather than leaving someone to discover it.
- [ ] **1.4.3** `AUTH_URL` inside the container is `http://localhost:3000`, but the
      container's own hostname is not `localhost`. Verify the OAuth callback resolves from
      the **browser's** point of view, not the container's.
- [ ] **1.4.4** Re-test 0.1 (Safari) against the containerised app.
- [ ] **1.4.5** Confirm `output: "standalone"` did not change the built HTML or CSP
      behaviour. Re-run the bundle secret scan afterwards.

---

## Module 2 — Database

### 2.1 Review the schema before applying it

`db/schema.sql` was written as a design artifact and has never been executed.

- [ ] **2.1.1** Confirm `users.id` (`uuid default gen_random_uuid()`) matches whatever the
      `jwt` callback writes into `token.uid`. A type mismatch makes every `plans` insert
      fail on the foreign key.
- [ ] **2.1.2** Confirm `users` still needs no password column. It does not — sign-in is
      OAuth. Re-state that in the file so nobody adds one later "for flexibility".
- [ ] **2.1.3** Check `plans_ok_has_response` against the real response shape — 13 top-level
      fields, stored whole as JSONB.
- [ ] **2.1.4** **Decision:** `plans.constraints` as `text` or JSONB? The request schema
      accepts more than one shape and `constraintsToText` already normalises it. Storing the
      normalised text is the lazy correct answer — write down that the original shape is not
      recoverable from it.
- [ ] **2.1.5** Confirm `plans_user_created_idx` serves both queries ("my plans, newest
      first" and the rate-limit count). Verify with `EXPLAIN` in 3.4.6, not by assuming.

### 2.2 Apply and prove it

- [ ] **2.2.1** Apply via the Docker init mount (1.1.3), or
      `psql "$DATABASE_URL" -f db/schema.sql`.
- [ ] **2.2.2** `\d users` and `\d plans` show the expected columns, constraints and index.
- [ ] **2.2.3** Prove the `status` check constraint: rejects `'pending'`, accepts `'ok'` and
      `'failed'`. A constraint nobody has seen fire is a constraint nobody knows works.
- [ ] **2.2.4** Prove `on delete cascade`: delete the test user, confirm the plan row goes.
- [ ] **2.2.5** Prove the foreign key: an insert with an unknown `user_id` must be rejected.
- [ ] **2.2.6** Delete the test rows.
- [ ] **2.2.7** Record the migration story: two tables and one developer do not need a
      migration engine. `db/schema.sql` is idempotent; future changes are numbered files
      beside it.

### 2.3 Production database

- [ ] **2.3.1** Provision a hosted Postgres — **Neon** recommended (free tier,
      serverless-friendly pooling, ~2 minutes). Docker covers local; production still needs
      a managed instance because Vercel is the deploy target.
- [ ] **2.3.2** Choose the region closest to the Vercel deployment region. Every request in
      Module 3 pays this latency twice.
- [ ] **2.3.3** Use the **pooled** connection string, not the direct one.
- [ ] **2.3.4** Set `DATABASE_URL` in Vercel and `.env.local`; add to `.env.example` with a
      comment saying which connection string and why.
- [ ] **2.3.5** Apply the schema to the production database.
- [ ] **2.3.6** Confirm `DATABASE_URL` never gains a `NEXT_PUBLIC_` prefix and never appears
      in the client bundle.
- [ ] **2.3.7** **Decision:** backups. A free tier may have none. For a graded project this
      is probably acceptable — record that it is a deliberate acceptance, not an oversight.

### 2.4 The connection module

- [ ] **2.4.1** `npm i postgres` — dependency six. Justify it against the ladder in
      `CLAUDE.md`: two tables and ~6 queries do not earn an ORM's schema DSL, generate step
      and migration engine.
- [ ] **2.4.2** Write `src/lib/db.ts`: one pooled client at module scope, `{ max: 1 }`, so
      warm serverless containers reuse it.
- [ ] **2.4.3** Comment *why* `max: 1` — serverless multiplies connections by instance count
      and a free-tier Postgres has a low connection ceiling.
- [ ] **2.4.4** Grep to confirm `src/lib/db.ts` is never imported from a `"use client"`
      file. One accidental import would try to bundle a database driver into the browser.
- [ ] **2.4.5** Verify with a one-off script that runs `select 1` and exits. Do not verify by
      starting the whole app.

---

## Module 3 — Backend & API

### 3.1 Persist the user on sign-in

- [ ] **3.1.1** Add the `jwt` callback to `src/auth.ts` — upsert on `email`, return the row
      id, store as `token.uid`.
- [ ] **3.1.2** Add the `session` callback so `session.user.id` reaches anything that needs
      it.
- [ ] **3.1.3** Add the `next-auth` module augmentation so `session.user.id` is typed.
      Without it `npm run typecheck` passes on a lie.
- [ ] **3.1.4** Keep the `if (token.uid) return token` early exit — the callback runs on
      every JWT refresh, not only first sign-in. That guard is what makes it one insert per
      user rather than one per request.
- [ ] **3.1.5** **Decision:** what happens when GitHub returns no email (a private-email
      user)? `token.email` would be null and the upsert violates `not null`. Either request
      the `user:email` scope explicitly, or fail sign-in with an actionable message. **Do
      not** silently generate a fake email.
- [ ] **3.1.6** Verify: sign in → exactly one row in `users`. Sign out, sign in again →
      still exactly one row.

### 3.2 Stage-0 session check on the API route

**The point of the whole exercise.** Until this step the endpoint is open and the quota
boundary is not closed.

- [ ] **3.2.1** Add `UNAUTHORIZED` (401) and `RATE_LIMITED` (429) to `ERROR_CODES` in
      `src/lib/scopecraft/schema.ts`.
- [ ] **3.2.2** Put the session check **first** in the handler — before the 16 KB body read.
      There is no reason to read a body from an anonymous caller.
- [ ] **3.2.3** Match the existing error envelope exactly. A new code with a different shape
      breaks the frontend's single error parser.
- [ ] **3.2.4** Confirm the 401 body leaks nothing — no provider name, no stack, no echoed
      input.
- [ ] **3.2.5** Verify with `curl`: no cookie → `401`; valid session cookie → proceeds.
- [ ] **3.2.6** Re-verify the pipeline is otherwise unchanged — a malformed request from an
      *authenticated* caller must still cost zero provider tokens.

### 3.3 Persist the plan

- [ ] **3.3.1** Insert the success row after `runScopeCraft` returns, including
      `provider_used` and `prompt_version` (they mirror the response headers).
- [ ] **3.3.2** Insert the failure row in the `catch` with `status = 'failed'` and the error
      code. A generation that reached a provider and then failed still cost tokens; if only
      successes were stored, a caller could burn quota on failures for free.
- [ ] **3.3.3** Confirm the 4xx paths above stage 5 never reach either insert.
- [ ] **3.3.4** **Decision:** what if the *insert* fails while the *generation* succeeded?
      Recommendation: return the plan and log the persistence failure. A user's result
      should not be discarded because a bookkeeping write failed.
- [ ] **3.3.5** Confirm `sql.json(data)` round-trips unchanged — select it back and
      deep-compare against what was returned to the client.

### 3.4 Rate limiting

- [ ] **3.4.1** Write `src/lib/quota.ts` — `count(*)` over `plans` in the last 24 hours.
- [ ] **3.4.2** Place it at **stage 4b**: after the free local checks, before
      `runScopeCraft`. A malformed request must never cost a database round trip.
- [ ] **3.4.3** Configurable via `DAILY_PLAN_LIMIT`, default 20. Add to `.env.example`.
- [ ] **3.4.4** Confirm it counts **attempts**, not successes.
- [ ] **3.4.5** Return the limit and a reset hint in the 429 body so the UI can say
      something better than "try again later".
- [ ] **3.4.6** `EXPLAIN` the count query — confirm it uses `plans_user_created_idx` and
      does not sequential-scan. This runs on every generation.
- [ ] **3.4.7** Verify with `DAILY_PLAN_LIMIT=2` locally and three generations.
- [ ] **3.4.8** Write down what it does **not** solve: it is per-account, not per-IP.

### 3.5 Read and write APIs for the frontend

- [ ] **3.5.1** **Decision:** does plan history ship? (See 4.3.) If not, skip 3.5.
- [ ] **3.5.2** If yes: prefer a server component reading the database directly over a new
      JSON endpoint. A route that exists only for your own frontend is an API surface you
      have to secure for no benefit.
- [ ] **3.5.3** Scope every query by `user_id` from the **session**, never from a URL
      parameter or body. This is the one place an IDOR could enter this codebase.
- [ ] **3.5.4** Paginate or cap. `select *` over an unbounded table of JSONB rows is a time
      bomb.
- [ ] **3.5.5** A `PATCH` for the board (4.4) that writes `board` and **never** `response`.
      The model's output stays immutable.
- [ ] **3.5.6** Validate the board payload with Zod before it touches the database. A JSONB
      column accepts anything; that is not a reason to store anything.

### 3.6 Server-side logging

- [ ] **3.6.1** Confirm the existing safe-logging rules still hold: no API key, no full
      prompt, no user input echoed into logs.
- [ ] **3.6.2** Decide what a persistence failure logs, and confirm it does not include the
      connection string.
- [ ] **3.6.3** Confirm nothing added in this plan logs a session token or cookie value.

---

## Module 4 — Frontend

### 4.1 The two new error states

- [ ] **4.1.1** Map `401` in `src/app/scopecraft/page.tsx` to a redirect to `/login`, not an
      error card. An expired session is not something the user can act on from where they
      are.
- [ ] **4.1.2** Map `429` onto the existing `provider_error` shape — it already renders a
      message plus a retry affordance. No new UI state; adding one would be unrequested
      work.
- [ ] **4.1.3** Add `en` and `ar` strings for both. The type system fails the build if
      Arabic is missing.
- [ ] **4.1.4** Confirm the discriminated union still makes two simultaneous states
      impossible. That property is why the state machine is a union.

### 4.2 Session-aware UI

- [ ] **4.2.1** Confirm `UserMenu` renders correctly for a long GitHub display name, a null
      name (email fallback), and at ≤30rem where the name hides and the button stays.
- [ ] **4.2.2** Handle the expired-session case: the page was server-rendered with a session
      that has since expired. The first API call returns 401 → 4.1.1 handles it.
- [ ] **4.2.3** Confirm sign-out clears state and returns to `/login` with no stale result
      rendered behind it.

### 4.3 Plan history

- [ ] **4.3.1** **Decision:** does this ship, or does the database exist only for metering?
      A `plans` table nobody can read is defensible — it exists for the rate limit — but it
      is a weaker demo.
- [ ] **4.3.2** If yes: a server component at `/scopecraft/history`, newest first.
- [ ] **4.3.3** Header link, visible only when signed in.
- [ ] **4.3.4** Empty state for a user with no plans. Reuse the existing `EmptyState`.
- [ ] **4.3.5** Loading and error states. Every other view has all seven; a new one with two
      is an inconsistency an examiner will find.
- [ ] **4.3.6** Full i18n and a11y pass — folded into Module 10.

### 4.4 Board persistence

- [ ] **4.4.1** **Decision:** does the interactive sprint board save the user's edits? This
      is what `plans.board` exists for.
- [ ] **4.4.2** If yes: wire `InteractiveSprintBoard` to the `PATCH` from 3.5.5, debounced.
- [ ] **4.4.3** Confirm `client-recalc.ts` still runs on the loaded board — the arithmetic
      stays in code, never in stored state.
- [ ] **4.4.4** Show save state (saving / saved / failed). Silent persistence that
      occasionally fails is worse than no persistence.
- [ ] **4.4.5** Verify a second user cannot patch the first user's board.

### 4.5 Frontend hygiene

- [ ] **4.5.1** No new client component imports `src/lib/db.ts` or server-only exports of
      `src/auth.ts`.
- [ ] **4.5.2** Decide on the React hydration #418 fix (known finding #3). The fix trades a
      console error for a language flash on load. **Owner's decision.**
- [ ] **4.5.3** Confirm every new component has a matching CSS Module rather than inline
      styles — the CSP allows inline styles, but consistency is the reason the codebase is
      readable.
- [ ] **4.5.4** Confirm no component grew past the point where its state should move up.
      `page.tsx` orchestrates state; components render it.

---

## Module 5 — Integration — wiring it together

The seams. Each is a place where two correct halves make one broken whole.

- [ ] **5.1.1** End to end by hand: signed out → signed in → generate → view → sign out. In
      both locales and both themes.
- [ ] **5.1.2** Confirm the frontend's error parser handles all **ten** codes:
      `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `VALIDATION_ERROR`, `CLARIFICATION_REQUIRED`,
      `OUT_OF_DOMAIN`, `PLANNING_ERROR`, `SCHEMA_VIOLATION`, `PROVIDER_ERROR`, `TIMEOUT`,
      plus `UNAUTHORIZED` and `RATE_LIMITED`.
- [ ] **5.1.3** Confirm the response headers the UI depends on still arrive:
      `X-Provider-Used`, `X-Prompt-Version`. The evidence panel reads them.
- [ ] **5.1.4** Confirm provider failover still works with auth in play — the session check
      is upstream and must not have changed the timeout budget.
- [ ] **5.1.5** Confirm the deterministic boundary survived the round trip: a plan loaded
      from the database recomputes `priority`, `effort`, `sprint`, `sprint_plan` and
      `moscow` identically to when it was generated.
- [ ] **5.1.6** Confirm `committed_points <= capacity_points` on a freshly captured **live**
      result, not a fixture.
- [ ] **5.1.7** Confirm the app behaves sanely when the **database is down** — Docker makes
      this easy (`docker compose stop db`). Decide what the user sees; a stack trace is not
      an answer.
- [ ] **5.1.8** Confirm the app behaves sanely when **all three providers** are down.
      Already captured in evidence; re-verify it still holds.
- [ ] **5.1.9** Confirm the CSP still permits everything the new UI does — new fetches, new
      images, new inline anything.
- [ ] **5.1.10** Confirm a **cold serverless start** works: the first request after a
      deployment does the database connection and the auth check for the first time.

---
---

# Part II — Verify

---

## Module 6 — QA & testing

### 6.1 Repair what the change breaks

- [ ] **6.1.1** Add **one** `auth()` mock to the node project's setup — not 82 edits. Every
      test in `tests/api/scopecraft.test.ts` currently posts anonymously.
- [ ] **6.1.2** Mock `src/lib/db.ts` so route tests never touch a real database.
- [ ] **6.1.3** Confirm all 251 existing tests still pass and the count only goes up.

### 6.2 New unit and component tests

- [ ] **6.2.1** `401` with no session; `429` over the limit.
- [ ] **6.2.2** The ordering test that matters: a **malformed** request from an
      authenticated caller must hit neither the database nor a provider. Assert both mocks
      were never called.
- [ ] **6.2.3** One check that fails if the rate limit stops counting failures.
- [ ] **6.2.4** One check that fails if a plan query stops being scoped by `user_id`.
- [ ] **6.2.5** One check that fails if the board endpoint can write `response`.
- [ ] **6.2.6** UI tests for every new state in Module 4.

### 6.3 Integration tests

- [ ] **6.3.1** **Decision:** integration tests against a real database, or mock-only?
      Docker makes a real one cheap, which changes the calculus. Recommendation: **one small
      integration suite** against the Docker Postgres covering the three things mocks cannot
      — the foreign key, the check constraint, and the index being used.
- [ ] **6.3.2** If yes: a separate Jest project so `npm test` stays fast and runs without
      Docker. A suite that needs infrastructure must be opt-in.
- [ ] **6.3.3** If no: write down what is therefore not covered, referencing 2.2.

### 6.4 Evidence capture repair

- [ ] **6.4.1** `scripts/capture-evidence.sh` posts unauthenticated on all eleven cases and
      will get `401` on every one after 3.2.
- [ ] **6.4.2** Give it a session the way `capture-ui-evidence.mjs` does — mint a real
      cookie from `AUTH_SECRET`. **Do not** add an env flag that makes the app skip its own
      auth check; a production bypass switch is a worse thing to own.
- [ ] **6.4.3** The shell script cannot call `encode` directly. Move cookie minting into one
      shared `.mjs` helper both scripts import.
- [ ] **6.4.4** Add a `401` case (no cookie).
- [ ] **6.4.5** Add a `429` case — one run with `DAILY_PLAN_LIMIT=1`.
- [ ] **6.4.6** Re-run both captures end to end. Confirm the committability guard still
      passes and nothing lands in a `.gitignore` path.
- [ ] **6.4.7** Update `docs/evidence/curl-evidence.md` and
      `docs/evidence/provider-fallback-log.md` with the new counts and cases.

### 6.5 Manual QA pass

Things no automated test in this repository covers.

- [ ] **6.5.1** Full keyboard-only pass on `/login`, `/scopecraft`, and any new route.
- [ ] **6.5.2** Both locales read on screen — do not trust the dictionary, read the UI.
- [ ] **6.5.3** Both themes, plus `system` following an OS change mid-session.
- [ ] **6.5.4** Real mobile device, not just emulation. Touch targets, sticky header, the
      sprint board's drag interaction.
- [ ] **6.5.5** Cross-browser: Safari, Chrome, Firefox. Safari has already produced one
      finding this project did not have (0.1).
- [ ] **6.5.6** Named gap, do not claim otherwise: there has still been **no real
      screen-reader run**.
- [ ] **6.5.7** Record the pass in `docs/qa-test-plan.md` (11.4.4) — who ran it, on what,
      when, what they found. An unrecorded manual test did not happen.

### 6.6 Coverage honesty

- [ ] **6.6.1** Produce a coverage map: what each suite covers, in one table.
- [ ] **6.6.2** Name what is **not** covered and why. A coverage percentage without that
      list is a number, not information.
- [ ] **6.6.3** **Decision:** is a coverage threshold enforced in CI? Recommendation: no.
      A threshold on a project this size produces tests written to satisfy a number.

---

## Module 7 — AI, prompts & knowledge layer

The actual product. Easy to skip because it works — and it is exactly what the rubric grades
hardest.

### 7.1 The deterministic boundary

- [ ] **7.1.1** Re-verify the core rule holds everywhere: **the model writes prose, the code
      does the arithmetic.** `priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are
      recomputed server-side and overwrite model output.
- [ ] **7.1.2** Confirm nothing added in Modules 2–4 lets stored model output become the
      source of truth for a number.
- [ ] **7.1.3** Confirm `priorityScore = (value + risk) / effort` and the MoSCoW bands
      (2.2 / 1.3 / 0.7) still match `docs/api-contracts.md`.
- [ ] **7.1.4** Confirm the sprint packer is still capacity-bounded and still detects
      dependency cycles.
- [ ] **7.1.5** Confirm `plans.board` stays separate from `plans.response` — "what the AI
      said" versus "what the human decided" is a graded trust boundary.

### 7.2 Prompts and versioning

- [ ] **7.2.1** Confirm `docs/prompt-versions.md` matches the prompt actually shipping.
- [ ] **7.2.2** Confirm `X-Prompt-Version` reports the real version and that it is stored
      in `plans.prompt_version`.
- [ ] **7.2.3** If the prompt changed at any point in this plan, bump the version and record
      what changed and why.
- [ ] **7.2.4** Confirm the prompt still instructs the refusal envelope for out-of-domain
      requests.

### 7.3 Providers and failover

- [ ] **7.3.1** `npm run smoke` — all three providers reachable, model IDs still live.
      Hosted model availability changes independently of this repository.
- [ ] **7.3.2** Confirm the three-tier order and that a **missing** key is skipped while a
      **failing** key is attempted. That distinction is why known finding #5 is diagnosable.
- [ ] **7.3.3** Confirm `AbortController` timeouts still apply per attempt, and that
      worst-case total latency is still roughly 3 × `AI_TIMEOUT_MS`.
- [ ] **7.3.4** Confirm no provider name reaches an error response body.

### 7.4 Knowledge, taxonomy and sources

- [ ] **7.4.1** Confirm `knowledge/scopecraft/` templates match what the prompt references.
- [ ] **7.4.2** Confirm `taxonomy.ts` and `tool-rules.ts` match `docs/source-register.md`.
- [ ] **7.4.3** Re-check every citation in `docs/source-register.md` still resolves.
      Decision-log items 1 and 4 are open on exactly this (MoSCoW/RICE URLs; the OWASP page
      403s automated fetch).
- [ ] **7.4.4** **Do not "fix"** the five docs matching `grep INVALID_INPUT` — only two were
      ever wrong; the other three are correct historical notes.

### 7.5 Evaluation and safety

- [ ] **7.5.1** Re-run the evaluation suite. Confirm all 10 cases still pass.
- [ ] **7.5.2** Confirm the injection tests still pass and that decision-log item 2 stays
      accurately described as *partially* closed — one live case, not coverage.
- [ ] **7.5.3** Named gap: the evaluation set has **no explicit ambiguous category** and
      **no tool-failure category**. Either add them or document the gap; do not leave it
      implied.
- [ ] **7.5.4** Confirm out-of-domain refusal still holds against a live adversarial prompt,
      not just a fixture.
- [ ] **7.5.5** Re-state the honest caveat: refusal depends on the model emitting the
      refusal envelope. A model that ignores the rule and returns a medical answer in valid
      PRD shape passes schema validation and is returned. A server-side domain classifier
      would close that and is not built.
- [ ] **7.5.6** Attack the `PLANNING_ERROR` intermittency (known finding #4, 4 of 9 live
      runs). Likely cause: dangling dependencies in the model's story graph. Likely fix:
      drop unresolvable dependency edges before planning rather than failing the request.

---

## Module 8 — Security

- [ ] **8.1.1** Bundle secret scan after a fresh build.
- [ ] **8.1.2** Grep the whole tree for `NEXT_PUBLIC_`. Expect zero.
- [ ] **8.1.3** Git history secret scan across all branches.
- [ ] **8.1.4** Confirm every database query is parameterised. The `postgres` tagged
      template does this by construction — confirm nothing was built by string concatenation
      as a "quick fix".
- [ ] **8.1.5** Confirm every user-scoped query takes `user_id` from the session, never from
      client input. Check each `sql\`` call individually.
- [ ] **8.1.6** Re-verify all six security headers on the **live** deployment.
- [ ] **8.1.7** Confirm `X-Powered-By` is still absent.
- [ ] **8.1.8** Confirm the session cookie is `httpOnly`, `sameSite=lax`, and `secure` in
      production — read the actual `Set-Cookie` header on the live site, not the config.
- [ ] **8.1.9** Confirm CSRF protection is active on the auth routes (Auth.js provides it —
      verify the token is required, do not assume).
- [ ] **8.1.10** Confirm error responses leak nothing on **every** path, including the two
      new codes.
- [ ] **8.1.11** Docker: non-root user, no `.env` in any layer, no secret in an `ARG`, base
      image free of known criticals (`docker scout` or `trivy`).
- [ ] **8.1.12** `npm audit` — record and triage anything it finds rather than ignoring it.
- [ ] **8.1.13** Confirm dependency count is still six and every one is justified.
- [ ] **8.1.14** Re-read [`security-review.md`](security-review.md) and correct anything the
      database and Docker changes made stale.
- [ ] **8.1.15** Confirm the CSP `script-src 'unsafe-inline'` weakness is still recorded as
      a deliberate, bounded decision (log item 11) rather than quietly forgotten.

---

## Module 9 — Performance & reliability

- [ ] **9.1.1** Confirm the database adds exactly the round trips expected — one for the
      rate limit, one for the insert. Not one per request for the user lookup; `token.uid`
      in the JWT is what prevents that.
- [ ] **9.1.2** Confirm connection pooling behaves under repeated requests.
- [ ] **9.1.3** Note which routes are now dynamic rather than prerendered, and why. Reading
      cookies makes a route dynamic — the cost of requiring a session, not a regression.
- [ ] **9.1.4** Confirm the client bundle did not grow meaningfully.
- [ ] **9.1.5** Record Docker image size and cold-start time.
- [ ] **9.1.6** Measure end-to-end generation latency on the live site, three times, and
      record the range. "It feels fast" is not a number.
- [ ] **9.1.7** Confirm the app degrades rather than crashes on: database down, one provider
      down, all providers down, session expired mid-request.
- [ ] **9.1.8** Confirm no unbounded query, unbounded loop, or unbounded retry was
      introduced anywhere in this plan.

---

## Module 10 — Accessibility & internationalisation

A graded row in its own right, not a subsection of the frontend.

### 10.1 Measured

- [ ] **10.1.1** `npm run capture:ui` green, including all six LTR/RTL overflow checks.
- [ ] **10.1.2** Every contrast pair at or above AA in both themes.
- [ ] **10.1.3** Zero controls without an accessible name.
- [ ] **10.1.4** Zero skipped heading levels; landmarks present; exactly one `h1`.
- [ ] **10.1.5** Update the measured-results table in
      [`accessibility-checklist.md`](evidence/ui/accessibility-checklist.md) with the new
      counts after every UI change in this plan.

### 10.2 Internationalisation

- [ ] **10.2.1** Every new string exists in `en` **and** `ar`. The type system enforces it —
      do not work around it with a fallback.
- [ ] **10.2.2** Read both locales on screen. A key that exists is not a translation that
      reads correctly.
- [ ] **10.2.3** Confirm Arabic register stays Modern Standard, matching the existing copy.
- [ ] **10.2.4** Confirm product names keep `translate="no"` — machine translation renders
      "ScopeCraft" as "craft of scope" in Arabic.
- [ ] **10.2.5** Confirm numbers, dates and capacity readouts render correctly in RTL.

### 10.3 The RTL rules

- [ ] **10.3.1** Grep all new CSS for physical offsets: `left:`, `right:`, `margin-left`,
      `padding-right`, and asymmetric `border-radius` shorthand.
- [ ] **10.3.2** Confirm every viewport is measured in **both** directions. A direction-blind
      check on a bilingual app is not a passing check; it is an untested direction. This is
      how a `left: -9999px` skip link made every Arabic page scroll ~10000px sideways.
- [ ] **10.3.3** Confirm decorative marks (the GitHub logo, the SC badge) do not mirror.

### 10.4 Not verified — do not claim these

- [ ] **10.4.1** Keep the honest "not verified" section current: no real screen-reader run,
      no automated axe/Lighthouse scan, contrast measured on rendered text only (not icon
      glyphs, focus rings or borders).

---
---

# Part III — Document & ship

---

## Module 11 — Documentation

**38 documents.** 25 exist, 13 do not. Status is honest, not aspirational.

Legend: **✅ current** · **⚠️ exists but stale or incomplete** · **❌ missing**

### 11.1 Register — what exists

| # | Category | Document | Path | Status | Action |
|---|---|---|---|---|---|
| 1 | Entry | Project README | `README.md` | ⚠️ | 11.3.1 |
| 2 | Entry | Session handoff | `HANDOFF.md` | ⚠️ | 11.6.5 |
| 3 | Entry | AI usage disclosure | `AI_USAGE.md` | ⚠️ **3 of 4 sections are placeholders** | 13.2 |
| 4 | Entry | Local operating rules | `CLAUDE.md` | ✅ local-only, gitignored | — |
| 5 | Design | System architecture | `docs/architecture.md` | ⚠️ | 11.3.2 |
| 6 | Design | Database & auth design | `docs/database-and-auth-design.md` | ⚠️ status table | 11.3.3 |
| 7 | Design | Database schema | `db/schema.sql` | ✅ commented; not yet applied | 2.2 |
| 8 | API | Endpoint contracts | `docs/api-contracts.md` | ⚠️ needs 401/429 | 11.3.4 |
| 9 | API | Prompt versions | `docs/prompt-versions.md` | ⚠️ verify against shipping prompt | 7.2.1 |
| 10 | Security | Security review | `docs/security-review.md` | ⚠️ CSP + Docker | 11.3.5 |
| 11 | Process | Decision log | `docs/decision-log.md` | ⚠️ needs new entries | 11.6 |
| 12 | Process | Contribution matrix | `docs/contribution-matrix.md` | ⚠️ recent work missing | 11.3.6 |
| 13 | Process | Release checklist | `docs/release-checklist.md` | ⚠️ re-verify each row | 11.3.7 |
| 14 | Process | This plan | `docs/project-plan.md` | ✅ | 11.6.7 |
| 15 | Knowledge | Source register | `docs/source-register.md` | ⚠️ citations to re-check | 7.4.3 |
| 16 | Delivery | Backend delivery summary | `docs/backend-delivery-summary.md` | ⚠️ | 11.3.8 |
| 17 | Delivery | Backend role checklist | `docs/youssef-ai-backend-checklist.md` | ⚠️ SHA refs if 0.3 runs | 0.3.3 |
| 18 | Defense | Backend defense prep | `docs/defense-prep-backend.md` | ⚠️ auth + DB sections | 13.4.1 |
| 19 | Evidence | API / curl evidence | `docs/evidence/curl-evidence.md` | ⚠️ | 6.4.7 |
| 20 | Evidence | Provider fallback log | `docs/evidence/provider-fallback-log.md` | ⚠️ | 6.4.7 |
| 21 | Evidence | UI evidence | `docs/evidence/ui/ui-evidence.md` | ✅ 17 screenshots | 11.3.9 |
| 22 | Evidence | Accessibility checklist | `docs/evidence/ui/accessibility-checklist.md` | ✅ measured | 10.1.5 |
| 23 | Evidence | Raw captures | `docs/evidence/raw/` | ✅ | 6.4.6 |
| 24 | Historical | Session 1–4 lead checklists | `docs/session[1-4]-lead-checklist.md` | ✅ dated records | **do not rewrite** |
| 25 | Historical | Completion checklist | `docs/scopecraft-completion-checklist.html` | ✅ superseded banner intact | **do not rewrite** |

### 11.2 Register — what is missing, and why each is needed

| # | Category | Document | Proposed path | Why it is needed |
|---|---|---|---|---|
| 26 | Environment | **Local development guide** | `docs/local-development.md` | Docker arrives in Module 1 and nothing tells anyone how to start it |
| 27 | Environment | **Deployment guide** | `docs/deployment.md` | The fork-deploy trap lives only in `HANDOFF.md` and `CLAUDE.md`, neither team-facing |
| 28 | Environment | **Environment variables reference** | `docs/environment-variables.md` | Eleven variables across three concerns; the README table is outgrowing itself |
| 29 | Frontend | **Frontend architecture** | `docs/frontend-architecture.md` | **The biggest gap.** No component map, no state model, nothing on the seven-state union or the pre-paint theme/locale scripts. Backend has three documents; frontend has zero |
| 30 | QA | **QA & test plan** | `docs/qa-test-plan.md` | 251 tests with no document saying what is covered, what is not, and how manual QA runs |
| 31 | QA | **Manual QA evidence** | `docs/evidence/qa/` | 6.5 produces findings with nowhere to live |
| 32 | Operations | **Runbook / troubleshooting** | `docs/runbook.md` | What to do when providers fail, the database is down, or sign-in breaks. Every known finding is a runbook entry |
| 33 | Submission | **Known limitations** | `docs/known-limitations.md` | The rubric asks for *signed-off* known limitations. Currently scattered across README, architecture and the decision log |
| 34 | Submission | **Demo script** | `docs/demo-script.md` | A three-minute demo is a graded deliverable and does not exist |
| 35 | Defense | **Frontend defense prep** | `docs/defense-prep-frontend.md` | Only the backend row has one; three members have none |
| 36 | Defense | **Integration defense prep** | `docs/defense-prep-integration.md` | as above |
| 37 | Defense | **Evaluation & safety defense prep** | `docs/defense-prep-evaluation.md` | as above |
| 38 | Process | **Changelog** | `CHANGELOG.md` | No tag, no release notes, no way to see what changed between sessions |

*(A `CONTRIBUTING.md` was considered and rejected: branch rules live in `architecture.md` §5
and the four gates live in `CLAUDE.md`. A third home for the same rules is drift waiting to
happen. Revisit if the team grows.)*

### 11.3 Update every existing document

- [ ] **11.3.1** `README.md` — Authentication section reflects the endpoint being gated
      (3.6.4); environment table gains `DATABASE_URL` and `DAILY_PLAN_LIMIT`; Docker quick
      start; **add the documentation index from 11.5.1**.
- [ ] **11.3.2** `docs/architecture.md` — pipeline diagram gains stage 0 and stage 4b; §4a
      boundary section updated; the "no authentication" MVP non-goal in §4 explicitly marked
      reversed with a pointer to the decision log.
- [ ] **11.3.3** `docs/database-and-auth-design.md` — move every shipped row out of "design
      only" in the status table; update the adoption-cost section to describe what is left.
- [ ] **11.3.4** `docs/api-contracts.md` — `401 UNAUTHORIZED` and `429 RATE_LIMITED` with
      example bodies; any new read/patch routes; the changed pre-provider ordering.
- [ ] **11.3.5** `docs/security-review.md` — CSP production-only note (0.1.6), Docker
      hardening (8.1.11), the session cookie flags, the closed and still-open boundaries.
- [ ] **11.3.6** `docs/contribution-matrix.md` — authentication, Docker, the database, this
      plan, and the audit work.
- [ ] **11.3.7** `docs/release-checklist.md` — re-verify **every** row against reality and
      untick anything no longer true. Add rows for the database and Docker.
- [ ] **11.3.8** `docs/backend-delivery-summary.md` — the backend is no longer what it was
      when this was written.
- [ ] **11.3.9** `docs/evidence/ui/ui-evidence.md` — screenshot count and any new states
      captured in Module 4.
- [ ] **11.3.10** `.env.example` — every new variable, with a comment saying what it is for
      and whether it is required.

### 11.4 Write the missing documents

Ordered by value. Not all thirteen have to ship — but skipping one should be a decision, not
the result of running out of time. **Write 11.4.1–11.4.5 first; treat the rest as optional.**

- [ ] **11.4.1** `docs/local-development.md` — prerequisites, `docker compose up`, the host
      vs container decision from 1.3.3, how to run the evidence captures (and why the UI one
      must run on the host), common failures.
- [ ] **11.4.2** `docs/frontend-architecture.md` — **the highest-value missing document.**
      Component tree; the seven-state discriminated union and why it is a union; the
      theme/locale pre-paint scripts and why they are blocking; the CSS Modules + custom
      properties model; the `.dark` class decision over `prefers-color-scheme`; the RTL
      rules; the client/server boundary; where state lives and why.
- [ ] **11.4.3** `docs/deployment.md` — the fork trap in plain language, Vercel environment
      variables, what Docker is and is not for, how to roll back.
- [ ] **11.4.4** `docs/qa-test-plan.md` — the two (or three) Jest projects and why, what
      each suite covers, what is deliberately not covered, how manual QA runs, how evidence
      is captured. Records the 6.5 pass and the 6.6 coverage map.
- [ ] **11.4.5** `docs/known-limitations.md` — consolidate every honest limitation into one
      document the rubric can point at, with a sign-off line each: the open API endpoint if
      it stays open, per-IP abuse, session revocation, the domain-classifier gap, estimate
      quality, `PLANNING_ERROR` intermittency, no screen-reader run, CSP `unsafe-inline`.
- [ ] **11.4.6** `docs/runbook.md` — symptom → cause → fix, seeded from the nine known
      findings in `CLAUDE.md` §9.
- [ ] **11.4.7** `docs/demo-script.md` — three minutes, timed, rehearsed against the live
      site. What to show, in what order, what to say when a provider is slow.
- [ ] **11.4.8** `docs/environment-variables.md` — one table, three concerns (providers,
      auth, database), which are required, which are per-environment, which are secret.
- [ ] **11.4.9** `docs/defense-prep-frontend.md` — **Joe writes it.** Scaffold the structure
      from the backend one; never the content.
- [ ] **11.4.10** `docs/defense-prep-integration.md` — **Nour writes it.**
- [ ] **11.4.11** `docs/defense-prep-evaluation.md` — **Yasmin writes it.**
- [ ] **11.4.12** `CHANGELOG.md` — seed from git history, then maintain per release.
- [ ] **11.4.13** `docs/evidence/qa/` — where the manual QA record lives.

### 11.5 Discoverability

- [ ] **11.5.1** Add a documentation index to `README.md` linking all 38 documents by
      category. A register that lives only in this plan is a register nobody reads.
- [ ] **11.5.2** Confirm every document says at the top what it is for and who owns it.
- [ ] **11.5.3** Confirm every internal link resolves and every external link still loads.

### 11.6 Keeping documentation honest

- [ ] **11.6.1** Decision-log entry for **Docker**: what it buys, what it costs, and the
      honest note that **Vercel does not build from it**.
- [ ] **11.6.2** Decision-log entry for the **database adoption**: what was deliberately not
      built — no ORM, no sessions table, no Redis, response as JSONB rather than eleven
      normalised tables.
- [ ] **11.6.3** Decision-log entry for **every** step marked *decision* that got answered:
      0.3.1, 1.3.3, 2.1.4, 2.3.7, 3.1.5, 3.3.4, 4.3.1, 4.4.1, 6.3.1, 6.6.3, 12.2.1. An
      answered decision with no record is an argument that will be had again.
- [ ] **11.6.4** **The truthfulness sweep.** Re-read `README.md`, `architecture.md` and
      every checklist in `docs/` against the running app. Untick anything no longer true.
      This is the single highest-yield audit in this repository — the README once claimed
      "not yet deployed" while the site was live.
- [ ] **11.6.5** Update `HANDOFF.md` **last**, after everything else.
- [ ] **11.6.6** Verify the five numbers that drift and appear in ~6 files each: **test
      count, screenshot count, dependency count, branch heads, commit SHAs.**
- [ ] **11.6.7** Re-read this plan and tick what is genuinely done. Leave the rest open — an
      honestly incomplete checklist is worth more than a dishonestly complete one.

---

## Module 12 — Repository, CI & process

### 12.1 Branch state

- [ ] **12.1.1** **`main` is 16 commits behind `dev`.** Decide whether `main` becomes the
      release branch it is documented as, or whether the documentation changes to match
      reality. Either is fine; the current mismatch is not.
- [ ] **12.1.2** Confirm `fork/main` matches what production actually serves.
- [ ] **12.1.3** Clean up the three stale feature branches on the fork
      (`feature/backend-production-v2`, `feature/joe-intake-wizard`,
      `feature/youssef-updates`) once their PRs are resolved.
- [ ] **12.1.4** Confirm branch protection matches `architecture.md` §5, which claims `main`
      is protected with no direct pushes.

### 12.2 CI

- [ ] **12.2.1** **Decision:** CI currently runs on **both** `push` and `pull_request` for
      `main` and `dev` — every PR commit runs the suite twice. Recommendation: keep
      `pull_request` and restrict `push` to `main` only.
- [ ] **12.2.2** Add the client-bundle secret scan as a CI step. It is currently a manual
      grep in the README, which means it runs when someone remembers.
- [ ] **12.2.3** Add `npm audit --audit-level=high` as a non-blocking informational step.
- [ ] **12.2.4** If integration tests ship (6.3), add a Postgres service container.
- [ ] **12.2.5** **Decision:** build the Docker image in CI? Recommendation: on pull requests
      only. A container build on every push doubles CI time for a check that rarely catches
      what the normal build did not.
- [ ] **12.2.6** Confirm CI has the environment it needs — tests must not require real
      provider keys or a real database.
- [ ] **12.2.7** Confirm CI still passes on both branches after every module.

### 12.3 Repository hygiene

- [ ] **12.3.1** Confirm `.gitignore` covers everything local: `.env*`, `CLAUDE.md`,
      `.DS_Store`, `.claude-flow/`, `node_modules`, `.next`, `*.tsbuildinfo`, plus the
      `!docs/evidence/raw/*.log` negation that keeps the graded fallback log.
- [ ] **12.3.2** Confirm no secret has ever been committed — history scan across all
      branches.
- [ ] **12.3.3** Confirm the handbook CSV folder stays untracked (it has a literal `[` in
      its name that breaks Jest globs).
- [ ] **12.3.4** Confirm no commit in this plan's work carries a `Co-Authored-By` trailer.
- [ ] **12.3.5** Confirm `package-lock.json` is committed and in sync with `package.json`.

### 12.4 Open team items

- [ ] **12.4.1** **PR #2 is still open** (`feat: complete role-specific updates`). The only
      outstanding item currently failing a written acceptance criterion. Merge or close — it
      belongs to a teammate, so it needs a human decision.
- [ ] **12.4.2** Yasmin's sign-off on the 1–10 → 1–5 estimation scale change is outstanding
      (decision-log item 9). It rewrote her fixtures.
- [ ] **12.4.3** Confirm one GitHub issue per member per session exists, as
      `architecture.md` §5 requires — or correct §5 if the team stopped doing that.

---

## Module 13 — Submission & defense

### 13.1 Rubric coverage

- [ ] **13.1.1** Re-read the handbook acceptance CSVs **row by row** against what exists.
- [ ] **13.1.2** For each row, name the artifact that satisfies it. A row with no named
      artifact is a row that is not satisfied.
- [ ] **13.1.3** For each row that is *not* satisfied, decide: build it, or declare it a
      known limitation with a reason.

### 13.2 AI usage disclosure

- [ ] **13.2.1** **`AI_USAGE.md` has three placeholder sections** (Nour, Joe, Yasmin). This
      blocks a *Required* submission row.
- [ ] **13.2.2** **They must write their own.** Scaffold structure, never disclosures — a
      fabricated disclosure is worse than a missing one.
- [ ] **13.2.3** Note for Yasmin: her artifacts all entered in Nour's scaffold commit
      `9c67f42`, so **git cannot show her authorship**. She has to state it herself.
- [ ] **13.2.4** Update Yousef's own section with the database, Docker and audit work.

### 13.3 The demo

- [ ] **13.3.1** Write `docs/demo-script.md` (11.4.7).
- [ ] **13.3.2** Rehearse against the **live** site, timed.
- [ ] **13.3.3** Prepare for the two things most likely to go wrong on stage: a slow provider
      and a `PLANNING_ERROR`. Know what you will say.
- [ ] **13.3.4** Have the evidence screenshots open as a fallback if the live site fails.

### 13.4 Individual defense preparation

- [ ] **13.4.1** Update `docs/defense-prep-backend.md` with the auth and database work.
- [ ] **13.4.2** The other three members write theirs (11.4.9–11.4.11).
- [ ] **13.4.3** Rehearse the questions with the sharpest edges:
      *Why is the endpoint still open?* · *Why `unsafe-inline` in the CSP?* ·
      *Why no ORM?* · *Why can a session not be revoked?* ·
      *How do you know the sprint plan is correct rather than merely consistent?* ·
      *Why does Docker exist if Vercel does not use it?*
- [ ] **13.4.4** For each, have the honest answer ready rather than a defensive one. A named
      gap is worth more than a gap an examiner finds.

### 13.5 Known limitations sign-off

- [ ] **13.5.1** `docs/known-limitations.md` written (11.4.5).
- [ ] **13.5.2** Every limitation has an owner and a sign-off.
- [ ] **13.5.3** Confirm nothing in the README or architecture contradicts it.

---

## Module 14 — Release

- [ ] **14.1.1** All four gates green: `typecheck`, `lint`, `test`, `build`.
- [ ] **14.1.2** Both evidence captures green.
- [ ] **14.1.3** `docker compose up --build` works from a cold start.
- [ ] **14.1.4** Bundle secret scan clean.
- [ ] **14.1.5** CI green on `dev`.
- [ ] **14.1.6** `git status` clean apart from the known-untracked handbook folder. Never
      `git add -A` without looking first.
- [ ] **14.1.7** No `Co-Authored-By` trailer on any new commit.
- [ ] **14.1.8** `git push origin dev`
- [ ] **14.1.9** `git push fork dev:main` — **this is the one that deploys.**
- [ ] **14.1.10** Verify live: sign in, generate a plan, sign out. Check response headers and
      `Set-Cookie` flags.
- [ ] **14.1.11** Confirm a plan row landed in the production database.
- [ ] **14.1.12** Resolve 12.1.1 — bring `main` up to date or change the documentation.
- [ ] **14.1.13** Tag the release and write the `CHANGELOG.md` entry.

---

## Risk register

| Risk | Likelihood | Cost | Mitigation |
|---|---|---|---|
| `output: "standalone"` breaks the Vercel build | Medium | A broken production deploy from a change made for Docker | Verify the Vercel build immediately after 1.2.1, before anything else in Module 1 |
| Thirteen missing documents is more writing than it looks | **High** | The last two days become prose, not code | Write 11.4.1–11.4.5 and treat the rest as optional. Decide that early, not on the last day |
| Free-tier Postgres connection ceiling under serverless | Medium | Intermittent 500s that look like application bugs | `max: 1`, pooled connection string, verify under load in 9.1.2 |
| Docker becomes a second build definition that drifts | Medium | The image works and Vercel does not, or the reverse | One shared config; build the image in CI on PRs (12.2.5) |
| GitHub returns no email for some user | Low | Sign-in fails at the upsert with a `not null` violation | Decide the behaviour in 3.1.5 *before* it happens in a demo |
| Evidence capture repair (6.4) is fiddlier than it looks | Medium | Half a day; the shell script cannot call `encode` directly | One shared minting helper both scripts import |
| 0.3 invalidates SHAs faster than docs get fixed | Medium | Broken references in nine documents, some graded | Do 0.3.3 in the **same sitting** as 0.3.2 |
| Three teammates' `AI_USAGE.md` sections never arrive | Medium | A *Required* rubric row fails, and it cannot be fixed by you | Ask early and ask twice. Do not write them |

---

## Definition of done

True all at once, each verified by **running** something rather than reading something:

1. Every module's steps are ticked, or explicitly marked "not doing, because —".
2. All four gates green; both evidence captures pass; `docker compose up --build` works
   cold; CI green.
3. `POST /api/scopecraft` returns `401` without a session and `429` over the daily limit,
   verified with `curl` against the **live** deployment.
4. A generated plan appears in the production database, attributed to the right user.
5. The coverage map at the top of this document accounts for every part of the system.
6. The register in 11.1–11.2 has no ⚠️ or ❌ that was not deliberately accepted and recorded.
7. No document in the repository makes a claim that is no longer true.
8. `AI_USAGE.md` has four complete sections, each written by its own author.
9. Every step marked *decision* has an answer, and that answer is in the decision log.
