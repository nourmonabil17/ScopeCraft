# ScopeCraft — Project Plan & Master Checklist

**Owner:** Yousef Mohmed Hasabo — **whole project**, not a single role.
**Written:** 2026-08-27 · **Baseline commit:** `7f2b583`
**Structure:** Module → Point → Step. Every step is a checkbox. Nothing is ticked until it
has been *run*, not read.

This plan covers the entire application from every side: local environment, database,
backend, API, frontend, the wiring between them, QA, audit, documentation, and release.
Modules 0–1 unblock everything else. Module 8 is the documentation register — the organized
list of every document this project needs, what exists, and what does not.

---

## Contents

| Module | Scope | Cost | Blocks |
|---|---|---|---|
| [0](#module-0--blockers) | Blockers — visible breakage | 1–2 h | everything |
| [1](#module-1--docker--the-local-environment) | Docker & the local environment | 3–4 h | 2, 6 |
| [2](#module-2--database) | Database | 2–3 h | 3, 4, 5, 6 |
| [3](#module-3--backend--api) | Backend & API | 4–5 h | 4, 5 |
| [4](#module-4--frontend) | Frontend | 4–5 h | 5 |
| [5](#module-5--integration--wiring-it-together) | Integration — wiring it together | 2–3 h | 6 |
| [6](#module-6--qa--testing) | QA & testing | 4–5 h | 9 |
| [7](#module-7--full-system-audit) | Full system audit | 3–4 h | 9 |
| [8](#module-8--documentation-register) | Documentation register | 4–6 h | 9 |
| [9](#module-9--release) | Release | 1 h | — |

**Total: roughly four working days**, assuming the decisions marked *decision* get answered
promptly. Steps labelled **decision** cannot be worked around by trying harder.

**Related documents.** The auth/database design this plan executes is
[`database-and-auth-design.md`](database-and-auth-design.md); the schema is
[`db/schema.sql`](../db/schema.sql); decisions land in [`decision-log.md`](decision-log.md).
None are superseded by this file — this is sequencing, they are reasoning.

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
- [ ] **0.1.7** Re-check after Module 1 — the Docker setup changes the local origin and may
      change this behaviour. See 1.5.4.

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
      `http://localhost:3000/api/auth/callback/github`, and put those values in `.env.local`.

### 0.3 The pending history rewrite

Eleven commits carry a `Co-Authored-By` trailer.

- [ ] **0.3.1** **Decision:** do it at all? It rewrites shared history on a repo with an open
      PR from a teammate. That is a real cost.
- [ ] **0.3.2** If yes: run the rewrite (blocked on the assistant's side — must be you).
- [ ] **0.3.3** **In the same sitting**, fix every invalidated SHA: `HANDOFF.md`,
      `docs/youssef-ai-backend-checklist.md`, `docs/evidence/curl-evidence.md`,
      `docs/evidence/provider-fallback-log.md`, `docs/evidence/ui/ui-evidence.md`,
      `docs/evidence/ui/accessibility-checklist.md`, and three files under
      `docs/evidence/raw/`. Never "later" — some of these are graded artifacts.
- [ ] **0.3.4** Force-push to both remotes and tell the team before they pull.
- [ ] **0.3.5** If no: close it in `HANDOFF.md` §1.5 rather than leaving it open forever.

---

## Module 1 — Docker & the local environment

**Decision made:** Docker is in. Recorded honestly for the defense: Vercel does **not**
build from a Dockerfile, so this is not the production deploy path. What it buys is a local
environment that starts with one command, a real Postgres without a signup, integration
tests that can touch a real database, and a portable deploy path if the project ever leaves
Vercel. What it costs is a second build definition to keep in sync with the Vercel build.
Both halves belong in the decision log — see 8.4.2.

### 1.1 The database container

Start here. This is the half that pays for itself immediately.

- [ ] **1.1.1** Write `docker-compose.yml` with a `db` service: `postgres:16-alpine`,
      `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, port `5432` published.
- [ ] **1.1.2** Add a named volume so data survives `docker compose down`. Without it every
      restart wipes the database, which is confusing rather than clean.
- [ ] **1.1.3** Mount `db/schema.sql` into `/docker-entrypoint-initdb.d/` so a fresh
      container applies the schema automatically. This is why the schema is idempotent.
- [ ] **1.1.4** Add a `healthcheck` using `pg_isready`. Without it, anything depending on
      the database races the container's startup and fails on the first run only — the worst
      kind of flake.
- [ ] **1.1.5** Verify: `docker compose up -d db`, then `psql` in and confirm `users` and
      `plans` exist with their constraints and index.
- [ ] **1.1.6** Verify the data volume: insert a row, `docker compose restart db`, confirm
      the row survived.

### 1.2 The application image

- [ ] **1.2.1** Add `output: "standalone"` to `next.config.js`. Without it the image has to
      carry all of `node_modules`; with it Next emits a self-contained server bundle.
      **Verify the Vercel build still works after this** — it is a build-level change and
      Vercel shares the same config file.
- [ ] **1.2.2** Write a multi-stage `Dockerfile`: `deps` → `builder` → `runner`, on
      `node:22-alpine` (Node 22 is required — `scripts/capture-ui-evidence.mjs` uses the
      global `WebSocket`).
- [ ] **1.2.3** Run as a non-root user in the final stage. A container running as root is a
      finding an examiner will spot in five seconds.
- [ ] **1.2.4** Write `.dockerignore`: `node_modules`, `.next`, `.git`, `.env*`,
      `docs/evidence/ui/shots`. **Verify no `.env` file can enter the image** — a baked-in
      secret is the classic Docker mistake and it survives in every layer.
- [ ] **1.2.5** Pass build-time vs run-time configuration correctly. `AUTH_SECRET` and
      `DATABASE_URL` are **run-time** — never `ARG`, never baked into a layer.
- [ ] **1.2.6** Add the `web` service to `docker-compose.yml`, depending on `db` with
      `condition: service_healthy`.
- [ ] **1.2.7** Verify: `docker compose up --build`, open `http://localhost:3000/login`,
      sign in, generate a plan, confirm the row lands in the containerised database.
- [ ] **1.2.8** Check the final image size. If it is over ~400 MB, the standalone output is
      not being used correctly.

### 1.3 Developer experience

- [ ] **1.3.1** Add `.env.docker.example` — the compose-specific values, where
      `DATABASE_URL` points at the `db` service hostname rather than `localhost`.
- [ ] **1.3.2** Add npm scripts: `docker:up`, `docker:down`, `docker:logs`, `docker:psql`.
      Nobody should have to remember compose flags to see a log.
- [ ] **1.3.3** **Decision:** does `docker compose up` run the app in dev mode with hot
      reload, or production mode? Recommendation: **database in Docker, app on the host**
      for day-to-day work — hot reload through a bind mount is slow on macOS and the app has
      no native dependencies that need containerising. Keep the `web` service for verifying
      the image and for a portable demo.
- [ ] **1.3.4** Document the one-command start in `docs/local-development.md` (see 8.3.1).
- [ ] **1.3.5** Verify a genuinely cold start works: `docker compose down -v`, then
      `docker compose up`. That is what a teammate's first run looks like.

### 1.4 CI

- [ ] **1.4.1** **Decision:** does `.github/workflows/ci.yml` build the image on every push?
      Recommendation: build on pull requests only. A container build on every push doubles
      CI time for a check that rarely catches anything the normal build did not.
- [ ] **1.4.2** If integration tests against a real database ship (6.3), add a Postgres
      service container to the CI job.
- [ ] **1.4.3** Confirm CI still passes tests, typecheck, lint and build on `main` and `dev`.

### 1.5 Interaction with everything already built

The parts most likely to break, and the reason this module is not just "write a Dockerfile".

- [ ] **1.5.1** The evidence scripts run `next start` on **host** ports 3200/3201/3100. Decide
      whether they run against the host or the container, and make the base URLs
      configurable either way. They already read `UI_BASE_URL` / `UI_BAD_BASE_URL`.
- [ ] **1.5.2** `scripts/capture-ui-evidence.mjs` launches Chrome from a macOS path. It
      cannot run inside the app container without a headless Chrome image. Keep it on the
      host — say so in the docs rather than leaving someone to discover it.
- [ ] **1.5.3** `AUTH_URL` inside the container is `http://localhost:3000`, but the
      container's own hostname is not `localhost`. Verify the OAuth callback resolves
      correctly from the browser's point of view, not the container's.
- [ ] **1.5.4** Re-test 0.1 (Safari) against the containerised app. Same origin scheme,
      probably the same result — but confirm rather than assume.
- [ ] **1.5.5** Confirm `output: "standalone"` did not change the built HTML or the CSP
      behaviour. Re-run the bundle secret scan afterwards.

---

## Module 2 — Database

### 2.1 Review the schema before applying it

`db/schema.sql` was written as a design artifact and has never been executed.

- [ ] **2.1.1** Confirm `users.id` (`uuid default gen_random_uuid()`) matches whatever the
      `jwt` callback will write into `token.uid`. A type mismatch makes every `plans` insert
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
- [ ] **2.2.3** Prove the `status` check constraint: it must reject `'pending'` and accept
      `'ok'` / `'failed'`. A constraint nobody has seen fire is a constraint nobody knows
      works.
- [ ] **2.2.4** Prove `on delete cascade`: delete the test user, confirm the plan row goes.
- [ ] **2.2.5** Prove the foreign key: an insert with an unknown `user_id` must be rejected.
- [ ] **2.2.6** Delete the test rows.
- [ ] **2.2.7** Record the migration story: two tables and one developer do not need a
      migration engine. `db/schema.sql` is idempotent; future changes are numbered files
      beside it.

### 2.3 Production database

- [ ] **2.3.1** Provision a hosted Postgres for production — **Neon** recommended (free
      tier, serverless-friendly pooling, ~2 minutes). Docker covers local; production still
      needs a managed instance because Vercel is the deploy target.
- [ ] **2.3.2** Choose the region closest to the Vercel deployment region. Every request in
      Module 3 pays this latency twice.
- [ ] **2.3.3** Use the **pooled** connection string, not the direct one.
- [ ] **2.3.4** Set `DATABASE_URL` in Vercel and in `.env.local`; add it to `.env.example`
      with a comment saying which of the two connection strings and why.
- [ ] **2.3.5** Apply the schema to the production database.
- [ ] **2.3.6** Confirm `DATABASE_URL` never gains a `NEXT_PUBLIC_` prefix and never appears
      in the client bundle. Run the secret scan after the next build.

### 2.4 The connection module

- [ ] **2.4.1** `npm i postgres` — dependency six. Justify it against the ladder in
      `CLAUDE.md`: two tables and ~6 queries do not earn an ORM's schema DSL, generate step
      and migration engine.
- [ ] **2.4.2** Write `src/lib/db.ts`: one pooled client at module scope, `{ max: 1 }`, so
      warm serverless containers reuse it.
- [ ] **2.4.3** Comment *why* `max: 1` — serverless multiplies connections by instance
      count and a free-tier Postgres has a low connection ceiling.
- [ ] **2.4.4** Grep to confirm `src/lib/db.ts` is never imported from a `"use client"`
      file. One accidental import would try to bundle a database driver into the browser.
- [ ] **2.4.5** Verify with the smallest possible round trip — a one-off script that runs
      `select 1` and exits. Do not verify by starting the whole app.

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
- [ ] **3.1.5** **Decision:** what happens when GitHub returns no email (a user with a
      private email)? `token.email` would be null and the upsert violates `not null`. Either
      request the `user:email` scope explicitly, or fail sign-in with an actionable message.
      **Do not** silently generate a fake email.
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
      input. Same rule as every other error path.
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
      should not be discarded because a bookkeeping write failed. Record this — it is the
      kind of thing an examiner asks about.
- [ ] **3.3.5** Confirm `sql.json(data)` round-trips unchanged — select it back and
      deep-compare against what was returned to the client.

### 3.4 Rate limiting

- [ ] **3.4.1** Write `src/lib/quota.ts` — `count(*)` over `plans` in the last 24 hours.
- [ ] **3.4.2** Place it at **stage 4b**: after the free local checks, before
      `runScopeCraft`. A malformed request must never cost a database round trip.
- [ ] **3.4.3** Configurable via `DAILY_PLAN_LIMIT`, default 20. Add to `.env.example`.
- [ ] **3.4.4** Confirm it counts **attempts**, not successes — the `status` column exists
      for exactly this.
- [ ] **3.4.5** Return the limit and a reset hint in the 429 body so the UI can say
      something better than "try again later".
- [ ] **3.4.6** `EXPLAIN` the count query — confirm it uses `plans_user_created_idx` and
      does not sequential-scan. This runs on every generation.
- [ ] **3.4.7** Verify with `DAILY_PLAN_LIMIT=2` locally and three generations.
- [ ] **3.4.8** Write down what it does **not** solve: it is per-account, not per-IP.
      Someone willing to create many GitHub accounts is not addressed.

### 3.5 Read APIs for the frontend

- [ ] **3.5.1** **Decision:** does plan history ship? (See 4.3.) If not, skip 3.5.
- [ ] **3.5.2** If yes: prefer a server component reading the database directly over a new
      JSON endpoint. A route that exists only for your own frontend is an API surface you
      have to secure for no benefit.
- [ ] **3.5.3** Scope every query by `user_id` from the **session**, never from a URL
      parameter or body. This is the one place an IDOR could enter this codebase.
- [ ] **3.5.4** Paginate or cap. `select *` over an unbounded table of JSONB rows is a time
      bomb.
- [ ] **3.5.5** A `PATCH` for the board (see 4.4) that can write `board` and **never**
      `response`. The model's output stays immutable.
- [ ] **3.5.6** Validate the board payload with Zod before it touches the database. A JSONB
      column accepts anything; that is not a reason to store anything.

### 3.6 Contract documentation

- [ ] **3.6.1** Add `401` and `429` to [`api-contracts.md`](api-contracts.md) with example
      bodies.
- [ ] **3.6.2** Add any new read/patch routes to the same file.
- [ ] **3.6.3** Update the pipeline diagram in [`architecture.md`](architecture.md) —
      stage 0 and stage 4b are new, and the security section's ordering claim depends on it.
- [ ] **3.6.4** Update the README boundary section: the endpoint is no longer anonymous.
      **Remove** the language saying it is; do not add a contradicting paragraph beside it.

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
      name (email fallback), and at ≤30rem where the name is hidden and the button stays.
- [ ] **4.2.2** Handle the expired-session case in the UI: the page was server-rendered with
      a session that has since expired. The first API call returns 401 → 4.1.1 handles it.
- [ ] **4.2.3** Confirm the sign-out flow clears state and returns to `/login` cleanly, with
      no stale result rendered behind it.

### 4.3 Plan history

*The first feature the database makes visible to a user.*

- [ ] **4.3.1** **Decision:** does this ship, or does the database exist only for metering?
      A `plans` table nobody can read is defensible — it exists for the rate limit — but it
      is a weaker demo.
- [ ] **4.3.2** If yes: a server component at `/scopecraft/history`, newest first. Server
      component, so the query runs where the credential is.
- [ ] **4.3.3** Header link, visible only when signed in.
- [ ] **4.3.4** Empty state for a user with no plans. Reuse the existing `EmptyState`.
- [ ] **4.3.5** Loading and error states. Every other view in this app has all seven; a new
      one that has two is an inconsistency an examiner will find.
- [ ] **4.3.6** Full i18n and a11y pass: both locales, both themes, keyboard reachable,
      measured contrast.

### 4.4 Board persistence

- [ ] **4.4.1** **Decision:** does the interactive sprint board save the user's edits? This
      is what `plans.board` exists for.
- [ ] **4.4.2** If yes: wire `InteractiveSprintBoard` to the `PATCH` from 3.5.5, debounced.
- [ ] **4.4.3** Confirm `client-recalc.ts` still runs on the loaded board — the arithmetic
      stays in code, never in stored state.
- [ ] **4.4.4** Show save state (saving / saved / failed). Silent persistence that
      occasionally fails is worse than no persistence.
- [ ] **4.4.5** Verify a second user cannot patch the first user's board.

### 4.5 Cross-cutting frontend checks

- [ ] **4.5.1** Every new string in `en` **and** `ar`.
- [ ] **4.5.2** Every new control has an accessible name.
- [ ] **4.5.3** No physical CSS offsets — logical properties only. Grep new CSS for `left:`,
      `right:`, `margin-left`, `padding-right`, and asymmetric `border-radius` shorthand.
- [ ] **4.5.4** No new client component imports `src/lib/db.ts` or server-only exports of
      `src/auth.ts`.
- [ ] **4.5.5** Re-run `npm run capture:ui`; all six LTR/RTL overflow checks still pass.
- [ ] **4.5.6** Decide on the React hydration #418 fix (known finding #3). The fix trades a
      console error for a language flash on load. **Owner's decision.**

---

## Module 5 — Integration — wiring it together

The seams. Each of these is a place where two correct halves make one broken whole.

- [ ] **5.1.1** End-to-end by hand, signed out → signed in → generate → view → sign out.
      Do it in both locales and both themes.
- [ ] **5.1.2** Confirm the frontend's error parser handles all **eight** codes:
      `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `VALIDATION_ERROR`, `CLARIFICATION_REQUIRED`,
      `OUT_OF_DOMAIN`, `PLANNING_ERROR`/`SCHEMA_VIOLATION`/`PROVIDER_ERROR`, `TIMEOUT`,
      plus the two new ones.
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
      this easy to test (`docker compose stop db`). Decide what the user sees; a stack trace
      is not an answer.
- [ ] **5.1.8** Confirm the app behaves sanely when **all three providers** are down. Already
      captured in evidence; re-verify it still holds after the changes.
- [ ] **5.1.9** Confirm the CSP still permits everything the new UI does. New fetches,
      new images, new inline anything.

---

## Module 6 — QA & testing

### 6.1 Repair what the change breaks

- [ ] **6.1.1** Add **one** `auth()` mock to the node project's setup — not 82 edits. Every
      test in `tests/api/scopecraft.test.ts` currently posts anonymously.
- [ ] **6.1.2** Mock `src/lib/db.ts` so route tests never touch a real database. Those tests
      are about the pipeline, not about Postgres.
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
      Docker makes a real one cheap, which changes the calculus from the original plan.
      Recommendation: **one small integration suite** against the Docker Postgres, covering
      the three things mocks cannot — the foreign key, the check constraint, and the index
      being used.
- [ ] **6.3.2** If yes: keep it a separate Jest project so `npm test` stays fast and can run
      without Docker. A test suite that needs infrastructure must be opt-in.
- [ ] **6.3.3** If no: write down explicitly what is therefore not covered, and reference
      the manual verification in 2.2.

### 6.4 Evidence capture repair

- [ ] **6.4.1** `scripts/capture-evidence.sh` posts unauthenticated on all eleven cases and
      will get `401` on every one after 3.2.
- [ ] **6.4.2** Give it a session the way `capture-ui-evidence.mjs` does — mint a real
      cookie from `AUTH_SECRET`. **Do not** add an env flag that makes the app skip its own
      auth check; a production bypass switch is a worse thing to own.
- [ ] **6.4.3** The shell script cannot call `encode` directly. Move cookie minting into one
      shared `.mjs` helper both scripts import.
- [ ] **6.4.4** Add a `401` case (no cookie). The auth boundary deserves the same captured
      evidence as every other code.
- [ ] **6.4.5** Add a `429` case — one run with `DAILY_PLAN_LIMIT=1`.
- [ ] **6.4.6** Re-run both captures end to end. Confirm the committability guard still
      passes and nothing lands in a `.gitignore` path.
- [ ] **6.4.7** Update `docs/evidence/curl-evidence.md` and
      `docs/evidence/provider-fallback-log.md` with the new counts and cases.

### 6.5 Manual QA pass

Things no automated test in this repository covers.

- [ ] **6.5.1** Full keyboard-only pass on `/login`, `/scopecraft`, and any new route: tab
      order, focus visibility, skip link, no keyboard trap.
- [ ] **6.5.2** Both locales read on screen — do not trust the dictionary, read the UI.
- [ ] **6.5.3** Both themes, plus `system` following an OS change mid-session.
- [ ] **6.5.4** Real mobile device, not just emulation. Touch targets, the sticky header,
      the sprint board's drag interaction.
- [ ] **6.5.5** Cross-browser: Safari, Chrome, Firefox. Safari has already produced one
      finding this project did not have (0.1).
- [ ] **6.5.6** Named gap, do not claim otherwise: there has still been **no real
      screen-reader run**. The audit measures the DOM contract, which is not the same thing.
- [ ] **6.5.7** Record the manual pass in `docs/qa-test-plan.md` (8.3.4) — who ran it, on
      what, when, and what they found. An unrecorded manual test did not happen.

---

## Module 7 — Full system audit

Run **after** Modules 1–6, so it audits what will actually be submitted.

### 7.1 Security

- [ ] **7.1.1** Bundle secret scan after a fresh build.
- [ ] **7.1.2** Grep the whole tree for `NEXT_PUBLIC_`. Expect zero.
- [ ] **7.1.3** Confirm every database query is parameterised. The `postgres` tagged
      template does this by construction — confirm nothing was built by string concatenation
      as a "quick fix".
- [ ] **7.1.4** Confirm every user-scoped query takes `user_id` from the session, never from
      client input. Check each `sql\`` call individually.
- [ ] **7.1.5** Re-verify all six security headers on the **live** deployment.
- [ ] **7.1.6** Confirm `X-Powered-By` is still absent.
- [ ] **7.1.7** Confirm the session cookie is `httpOnly`, `sameSite=lax`, and `secure` in
      production — check the actual `Set-Cookie` header on the live site, not the config.
- [ ] **7.1.8** Docker: image runs as non-root, no `.env` in any layer, no secret in an
      `ARG`, base image has no known criticals (`docker scout` or `trivy`).
- [ ] **7.1.9** Confirm error responses still leak nothing on every path.
- [ ] **7.1.10** Re-read [`security-review.md`](security-review.md) and correct anything the
      database and Docker changes made stale.

### 7.2 Correctness and reliability

- [ ] **7.2.1** `npm run smoke` — all three providers reachable, model IDs still live.
      Hosted model availability changes independently of this repository.
- [ ] **7.2.2** Attack the `PLANNING_ERROR` intermittency (known finding #4, 4 of 9 live
      runs). Likely cause: dangling dependencies in the model's story graph. Likely fix:
      drop unresolvable dependency edges before planning rather than failing the request.
- [ ] **7.2.3** Confirm the deterministic boundary holds after every change in this plan.
- [ ] **7.2.4** Confirm failover still hops correctly through all three tiers.

### 7.3 Accessibility and internationalisation

- [ ] **7.3.1** `npm run capture:ui` green including all six LTR/RTL overflow checks.
- [ ] **7.3.2** Every contrast pair at or above AA in both themes.
- [ ] **7.3.3** Zero controls without an accessible name.
- [ ] **7.3.4** Confirm no untranslated string reached the UI.
- [ ] **7.3.5** Confirm no physical CSS offsets were introduced anywhere in this plan's work.

### 7.4 Performance and cost

- [ ] **7.4.1** Confirm the database adds exactly the round trips expected — one for the
      rate limit, one for the insert. Not one per request for the user lookup; `token.uid`
      in the JWT is what prevents that.
- [ ] **7.4.2** Confirm connection pooling behaves under repeated requests.
- [ ] **7.4.3** Note which routes are now dynamic rather than prerendered, and why. Reading
      cookies makes a route dynamic — that is the cost of requiring a session, not a
      regression.
- [ ] **7.4.4** Confirm the client bundle did not grow meaningfully.
- [ ] **7.4.5** Docker image size and cold-start time recorded.

### 7.5 Documentation truthfulness sweep

**The single highest-yield audit in this repository, because it has failed before.** The
README once claimed "not yet deployed" while the site was live.

- [ ] **7.5.1** Re-read `README.md` end to end against the running app. Every claim.
- [ ] **7.5.2** Re-read [`architecture.md`](architecture.md) the same way.
- [ ] **7.5.3** Re-read every checklist in `docs/` and confirm each ticked box is still
      true. **Untick anything that is not.**
- [ ] **7.5.4** Verify every commit SHA referenced in any doc still resolves
      (`git cat-file -e <sha>`). Especially if 0.3 was executed.
- [ ] **7.5.5** Verify every internal link resolves and every external link still loads.
- [ ] **7.5.6** Confirm the dated historical records (`session2-lead-checklist.md`,
      `scopecraft-completion-checklist.html`) still carry their superseded banners with the
      original text intact. **Do not rewrite them.**
- [ ] **7.5.7** Confirm the test count, screenshot count and dependency count are correct
      everywhere they appear — they drift on every change and appear in ~6 files.

### 7.6 Rubric and submission coverage

- [ ] **7.6.1** Re-read the handbook acceptance CSVs row by row against what exists.
- [ ] **7.6.2** **`AI_USAGE.md` — three sections are still placeholders** (Nour, Joe,
      Yasmin). Blocks a *Required* submission row. They must write their own.
- [ ] **7.6.3** **PR #2 is still open.** The only outstanding item currently failing a
      written acceptance criterion. Merge or close — it belongs to a teammate.
- [ ] **7.6.4** **There is no git tag.**
- [ ] **7.6.5** Yasmin's sign-off on the 1–10 → 1–5 scale change is outstanding
      (decision-log item 9). It rewrote her fixtures.
- [ ] **7.6.6** Evaluation set gaps documented: no explicit **ambiguous** category, no
      **tool-failure** category.
- [ ] **7.6.7** [`contribution-matrix.md`](contribution-matrix.md) reflects who actually did
      what, including auth, Docker and this plan's work.

---

## Module 8 — Documentation register

Every document this project needs, organized. **Status is honest**, not aspirational.

Legend: **✅ exists** · **⚠️ exists but stale or incomplete** · **❌ missing**

### 8.1 What exists

| # | Category | Document | Path | Status |
|---|---|---|---|---|
| 1 | Entry | Project README | `README.md` | ⚠️ needs 3.6.4, 8.3 links |
| 2 | Entry | Session handoff | `HANDOFF.md` | ⚠️ stale after every module |
| 3 | Entry | AI usage disclosure | `AI_USAGE.md` | ⚠️ **3 of 4 sections are placeholders** |
| 4 | Entry | Local operating rules | `CLAUDE.md` | ✅ local-only, gitignored |
| 5 | Design | System architecture | `docs/architecture.md` | ⚠️ needs 3.6.3 |
| 6 | Design | Database & auth design | `docs/database-and-auth-design.md` | ⚠️ status table needs updating |
| 7 | Design | Database schema | `db/schema.sql` | ✅ commented; not yet applied |
| 8 | API | Endpoint contracts | `docs/api-contracts.md` | ⚠️ needs 401/429 + new routes |
| 9 | API | Prompt versions | `docs/prompt-versions.md` | ✅ |
| 10 | Security | Security review | `docs/security-review.md` | ⚠️ needs CSP + Docker notes |
| 11 | Process | Decision log | `docs/decision-log.md` | ✅ 13 items |
| 12 | Process | Contribution matrix | `docs/contribution-matrix.md` | ⚠️ needs recent work |
| 13 | Process | Release checklist | `docs/release-checklist.md` | ⚠️ re-verify each row |
| 14 | Process | This plan | `docs/project-plan.md` | ✅ |
| 15 | Knowledge | Source register | `docs/source-register.md` | ✅ |
| 16 | Delivery | Backend delivery summary | `docs/backend-delivery-summary.md` | ✅ |
| 17 | Delivery | Backend role checklist | `docs/youssef-ai-backend-checklist.md` | ⚠️ SHA refs if 0.3 runs |
| 18 | Defense | Backend defense prep | `docs/defense-prep-backend.md` | ✅ |
| 19 | Evidence | API / curl evidence | `docs/evidence/curl-evidence.md` | ⚠️ needs 6.4.7 |
| 20 | Evidence | Provider fallback log | `docs/evidence/provider-fallback-log.md` | ⚠️ needs 6.4.7 |
| 21 | Evidence | UI evidence | `docs/evidence/ui/ui-evidence.md` | ✅ 17 screenshots |
| 22 | Evidence | Accessibility checklist | `docs/evidence/ui/accessibility-checklist.md` | ✅ measured |
| 23 | Evidence | Raw captures | `docs/evidence/raw/` | ✅ |
| 24 | Historical | Session 1–4 lead checklists | `docs/session[1-4]-lead-checklist.md` | ✅ dated records — **do not rewrite** |
| 25 | Historical | Completion checklist | `docs/scopecraft-completion-checklist.html` | ✅ superseded banner intact |

### 8.2 What is missing — and why each one is needed

| # | Category | Document | Proposed path | Why it is needed |
|---|---|---|---|---|
| 26 | Environment | **Local development guide** | `docs/local-development.md` | Docker arrives in Module 1 and nothing tells anyone how to start it |
| 27 | Environment | **Deployment guide** | `docs/deployment.md` | The fork-deploy trap lives only in `HANDOFF.md` and `CLAUDE.md`, neither of which is team-facing documentation |
| 28 | Environment | **Environment variables reference** | `docs/environment-variables.md` | Now eleven variables across three concerns; the README table is outgrowing itself |
| 29 | Frontend | **Frontend architecture** | `docs/frontend-architecture.md` | **The biggest documentation gap.** There is no component map, no state model, no explanation of the seven-state union or the theme/locale pre-paint scripts |
| 30 | QA | **QA & test plan** | `docs/qa-test-plan.md` | 251 tests exist with no document saying what is covered, what is not, and how manual QA is run |
| 31 | QA | **Manual QA evidence** | `docs/evidence/qa/` | 6.5 produces findings that currently have nowhere to live |
| 32 | Operations | **Runbook / troubleshooting** | `docs/runbook.md` | What to do when providers fail, the database is down, or sign-in breaks. Every known finding is a runbook entry |
| 33 | Submission | **Known limitations** | `docs/known-limitations.md` | The rubric asks for *signed-off* known limitations. They are currently scattered across README, architecture and the decision log |
| 34 | Submission | **Demo script** | `docs/demo-script.md` | A three-minute demo is a graded deliverable and does not exist |
| 35 | Defense | **Frontend defense prep** | `docs/defense-prep-frontend.md` | Only the backend row has one; three members have none |
| 36 | Defense | **Integration defense prep** | `docs/defense-prep-integration.md` | as above |
| 37 | Defense | **Evaluation & safety defense prep** | `docs/defense-prep-evaluation.md` | as above |
| 38 | Process | **Changelog** | `CHANGELOG.md` | No tag, no release notes, no way to see what changed between sessions |
| 39 | Process | **Contributing guide** | `CONTRIBUTING.md` | Branch rules and PR requirements live in `architecture.md` §5 where no contributor will look |

### 8.3 Writing the missing documents

Ordered by value. Not all thirteen have to ship — but the decision to skip one should be
made deliberately, not by running out of time.

- [ ] **8.3.1** `docs/local-development.md` — prerequisites, `docker compose up`, the host
      vs container decision from 1.3.3, how to run the evidence captures, common failures.
- [ ] **8.3.2** `docs/frontend-architecture.md` — the highest-value missing document.
      Component tree, the seven-state discriminated union, the theme/locale pre-paint
      scripts and why they are blocking, the CSS Modules + custom properties model, the RTL
      rules, the client/server boundary.
- [ ] **8.3.3** `docs/deployment.md` — the fork trap in plain language, Vercel environment
      variables, what Docker is and is not for, rollback.
- [ ] **8.3.4** `docs/qa-test-plan.md` — the two Jest projects and why, what each suite
      covers, what is deliberately not covered, how to run manual QA, how evidence is
      captured. Records the 6.5 pass.
- [ ] **8.3.5** `docs/known-limitations.md` — consolidate every honest limitation into one
      document the rubric can point at. Sign-off line per limitation.
- [ ] **8.3.6** `docs/runbook.md` — symptom → cause → fix, seeded from the seven known
      findings.
- [ ] **8.3.7** `docs/demo-script.md` — three minutes, timed, rehearsed against the live
      site. What to show, in what order, what to say when a provider is slow.
- [ ] **8.3.8** `docs/environment-variables.md` — one table, three concerns (providers,
      auth, database), which are required, which are per-environment.
- [ ] **8.3.9** The three `defense-prep-*.md` files. **Each member writes their own** —
      scaffold the structure from the backend one, never the content.
- [ ] **8.3.10** `CHANGELOG.md` — seed from git history, then maintain per release.
- [ ] **8.3.11** `CONTRIBUTING.md` — branch rules, PR requirements, commit conventions, the
      four gates.
- [ ] **8.3.12** `docs/evidence/qa/` — where the manual QA record lives.

### 8.4 Keeping documentation honest

- [ ] **8.4.1** Add an index table to the README linking every document in 8.1 and 8.2, so
      the register has one home rather than living only here.
- [ ] **8.4.2** Decision-log entry for **Docker**: what it buys (one-command local setup,
      real Postgres without signup, integration tests, portable deploy path), what it costs
      (a second build definition to keep in sync), and the honest note that **Vercel does
      not build from it**.
- [ ] **8.4.3** Decision-log entry for the **database adoption**: what was deliberately not
      built — no ORM, no sessions table, no Redis, response as JSONB rather than eleven
      normalised tables.
- [ ] **8.4.4** Decision-log entry for **every** step in this plan marked *decision* that
      got answered: 1.3.3, 1.4.1, 2.1.4, 3.1.5, 3.3.4, 4.3.1, 4.4.1, 6.3.1, 0.3.1. An
      answered decision with no record is an argument that will be had again.
- [ ] **8.4.5** Update `HANDOFF.md` last, after everything else — branch heads, test count,
      screenshot count, dependency count, open findings, per-person status.
- [ ] **8.4.6** Update `AI_USAGE.md`'s own section with the database, Docker and audit work.
- [ ] **8.4.7** Re-read this plan and tick what is genuinely done. Leave the rest open — an
      honestly incomplete checklist is worth more than a dishonestly complete one.

---

## Module 9 — Release

- [ ] **9.1.1** All four gates green: `typecheck`, `lint`, `test`, `build`.
- [ ] **9.1.2** Both evidence captures green.
- [ ] **9.1.3** `docker compose up --build` works from a cold start.
- [ ] **9.1.4** Bundle secret scan clean.
- [ ] **9.1.5** `git status` clean apart from the known-untracked handbook folder. Never
      `git add -A` without looking first.
- [ ] **9.1.6** No `Co-Authored-By` trailer on any new commit.
- [ ] **9.1.7** `git push origin dev`
- [ ] **9.1.8** `git push fork dev:main` — **this is the one that deploys.**
- [ ] **9.1.9** Verify live: sign in, generate a plan, sign out. Check response headers and
      `Set-Cookie` flags.
- [ ] **9.1.10** Confirm a plan row landed in the production database.
- [ ] **9.1.11** Tag the release and write the changelog entry.

---

## Risk register

| Risk | Likelihood | Cost | Mitigation |
|---|---|---|---|
| `output: "standalone"` changes the Vercel build | Medium | A broken production deploy from a change made for Docker | Verify the Vercel build immediately after 1.2.1, before anything else in Module 1 |
| Free-tier Postgres connection ceiling under serverless | Medium | Intermittent 500s that look like application bugs | `max: 1`, pooled connection string, verify under repeated load in 7.4.2 |
| Docker becomes a second build definition that drifts | Medium | The image works and Vercel does not, or the reverse | One config file, `output: "standalone"` shared; build the image in CI on PRs (1.4.1) |
| GitHub returns no email for some user | Low | Sign-in fails at the upsert with a `not null` violation | Decide the behaviour in 3.1.5 *before* it happens in a demo |
| Evidence capture repair (6.4) is fiddlier than it looks | Medium | Half a day; the shell script cannot call `encode` directly | One shared minting helper both scripts import |
| 0.3 invalidates SHAs faster than docs get fixed | Medium | Broken references in nine documents, some graded | Do 0.3.3 in the **same sitting** as 0.3.2 |
| Thirteen missing documents is more writing than it looks | High | The last two days become prose, not code | Write 8.3.1–8.3.5 and treat the rest as optional |

---

## Definition of done

True all at once, each verified by **running** something rather than reading something:

1. Every module's steps are ticked, or explicitly marked "not doing, because —".
2. All four gates green; both evidence captures pass; `docker compose up --build` works cold.
3. `POST /api/scopecraft` returns `401` without a session and `429` over the daily limit,
   verified with `curl` against the **live** deployment.
4. A generated plan appears in the production database, attributed to the right user.
5. No document in the repository makes a claim that is no longer true.
6. `AI_USAGE.md` has four complete sections, each written by its own author.
7. The documentation register in 8.1–8.2 has no ⚠️ or ❌ left that was not deliberately
   accepted and recorded.
