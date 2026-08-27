# Plan — Database Integration & Full System Audit

**Owner:** Yousef Mohmed Hasabo · **Written:** 2026-08-27 · **Baseline commit:** `7f45a2b`
**Structure:** Module → Point → Step. Every step is a checkbox. Nothing is ticked until it
has been *run*, not read.

**Related documents.** The design this plan executes is
[`database-and-auth-design.md`](database-and-auth-design.md). The schema is
[`db/schema.sql`](../db/schema.sql). Decisions land in
[`decision-log.md`](decision-log.md). None of those are superseded by this file — this is
the sequencing, they are the reasoning.

---

## How to read this plan

Modules are ordered by dependency, not by importance. **Module 0 blocks everything**: two
of its three points are things that make the app look broken to anyone who opens it, and
fixing them costs minutes. Modules 1–4 are the database work in the only order it can
safely be done. Module 5 is the "check the whole system" sweep, deliberately placed *after*
the change rather than before, so it audits what will actually be submitted.

**Estimates are honest, not optimistic.** Where something is a decision rather than a task,
it says so — those cannot be worked around by trying harder.

| Module | What it is | Rough cost | Blocks |
|---|---|---|---|
| 0 | Blockers — visible breakage, fix first | 1–2 h | everything |
| 1 | Database foundation | 1–2 h | 2, 3, 4 |
| 2 | Backend integration | 3–4 h | 3, 4 |
| 3 | Frontend integration | 3–4 h | — |
| 4 | Test & evidence repair | 2–3 h | 7 |
| 5 | Full system audit | 3–4 h | 7 |
| 6 | Documentation & decision record | 1–2 h | 7 |
| 7 | Ship | 30 m | — |

---

## Module 0 — Blockers

Three things that are wrong right now. Two are visible to anyone who opens the app.

### 0.1 The login page renders with no styling in Safari on `localhost`

**Symptom (observed 2026-08-27).** Opening `http://localhost:3311/login` in Safari shows
raw unstyled HTML — "SCScopeCraftLive", "ENEnglish العربية", an unstyled heading and a
plain link. The same page in Chromium renders correctly. The inline `<style>` from the root
layout *does* apply (background and text colour are right), but the CSS Module stylesheets
under `/_next/static/chunks/*.css` do not.

**Leading hypothesis — `upgrade-insecure-requests` in the CSP.** That directive rewrites
every `http://` subresource request to `https://`. Chromium exempts `localhost`; Safari
historically does not, so it asks for `https://localhost:3311/_next/static/chunks/….css`,
there is no TLS listener, and the request dies. This explains the exact split observed:
inline styles need no network and survive, external CSS and JS need one and do not.

**Already established, so do not re-check:**

- The stylesheets serve correctly over http — `200`, `text/css`, 1721 bytes.
- There is no https listener on the dev port; a TLS request to it fails to connect.
- The response carries `upgrade-insecure-requests` in the `Content-Security-Policy` header.

**Steps**

- [ ] **0.1.1** Reproduce in Safari and open the Web Inspector Console. Confirm the CSS
      requests are being upgraded to `https://` rather than 404ing or being blocked by a
      different directive. *Record the exact console text* — this is the difference between
      a confirmed diagnosis and a plausible one.
- [ ] **0.1.2** If confirmed: make `upgrade-insecure-requests` production-only in
      `next.config.js`. Build the directive array conditionally on
      `process.env.NODE_ENV === "production"`. It buys nothing on `http://localhost` — there
      is no mixed content to upgrade — and it costs the entire local Safari experience.
- [ ] **0.1.3** If **not** confirmed, work the other candidates in order and record which
      one it was: (a) a stale Safari cache of a previous build — hard-reload with
      ⌥⌘E then ⌘R; (b) `default-src 'self'` interacting with a non-`localhost` host in the
      URL bar (`127.0.0.1` and `localhost` are different origins for CSP purposes);
      (c) Safari's Develop → Disable Styles left on from earlier debugging.
- [ ] **0.1.4** Verify the fix in **both** Safari and Chromium, at `localhost` *and*
      `127.0.0.1`, on `/login` and `/scopecraft`.
- [ ] **0.1.5** Confirm the deployed https site is unaffected either way — on https there is
      nothing to upgrade, so this was never a production bug. State that explicitly rather
      than implying production was broken.
- [ ] **0.1.6** Add a one-line note to `docs/security-review.md` next to the CSP section:
      what the directive does, why it is production-only, and what it looked like when it
      was not.

### 0.2 `AUTH_*` variables are not set in Vercel

Production currently redirects every visitor to `/login`, where sign-in fails. This is the
single highest-value 10 minutes in the whole plan.

**Steps**

- [ ] **0.2.1** Create a GitHub OAuth app at <https://github.com/settings/developers>.
      Authorization callback URL, exactly:
      `https://scope-craft-nine.vercel.app/api/auth/callback/github`
- [ ] **0.2.2** Generate a secret: `npx auth secret`
- [ ] **0.2.3** Set four variables in the Vercel project (Production **and** Preview):
      `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and
      `AUTH_URL=https://scope-craft-nine.vercel.app`
- [ ] **0.2.4** While in that screen, check whether `NVIDIA_API_KEY` is set — known finding
      #5, three production generations were served by Groq/Gemini and never NVIDIA. A
      missing key is *skipped* rather than failed, which is exactly that signature.
- [ ] **0.2.5** Redeploy, then verify by actually signing in on the live URL. Confirm the
      header shows your GitHub name and that **Sign out** returns you to `/login`.
- [ ] **0.2.6** Register a second OAuth app (or a second callback URL) for
      `http://localhost:3000/api/auth/callback/github` so local development works too, and
      put those values in `.env.local`.

### 0.3 The pending history rewrite

Eleven commits carry a `Co-Authored-By` trailer. Nine documents hardcode commit SHAs that
a rewrite would invalidate.

**Steps**

- [ ] **0.3.1** Decide whether to do it at all. It rewrites shared history on a repo with an
      open PR from a teammate, which is a real cost. *This is a decision, not a task.*
- [ ] **0.3.2** If yes: run the rewrite yourself (it is blocked on the assistant's side).
- [ ] **0.3.3** Immediately after, find and correct every invalidated SHA:
      `HANDOFF.md`, `docs/youssef-ai-backend-checklist.md`,
      `docs/evidence/curl-evidence.md`, `docs/evidence/provider-fallback-log.md`,
      `docs/evidence/ui/ui-evidence.md`, `docs/evidence/ui/accessibility-checklist.md`,
      and three files under `docs/evidence/raw/`.
- [ ] **0.3.4** Force-push to both remotes and tell the team before they pull.
- [ ] **0.3.5** If no: say so in `HANDOFF.md` §1.5 and close it, rather than leaving it
      open forever as ambient guilt.

---

## Module 1 — Database foundation

Nothing in Modules 2–4 can start until a database exists and the app can reach it.

### 1.1 Provision Postgres

- [ ] **1.1.1** Choose a provider. **Neon** is the recommendation: free tier, serverless-
      friendly pooling, ~2 minutes to a connection string. Vercel Postgres and Supabase are
      equivalent for this workload.
- [ ] **1.1.2** Create the database. Pick the region closest to the Vercel deployment
      region — every request in Module 2 pays this latency twice.
- [ ] **1.1.3** Copy the pooled connection string (not the direct one) into `.env.local` as
      `DATABASE_URL`, and set the same in Vercel.
- [ ] **1.1.4** Add `DATABASE_URL` to `.env.example` with a comment saying which of the two
      connection strings to use and why.
- [ ] **1.1.5** Verify the URL is server-only. It must never gain a `NEXT_PUBLIC_` prefix,
      and it must not appear in the client bundle. Run the secret scan after the next build.

### 1.2 Review the schema before applying it

`db/schema.sql` was written as a design artifact and has never been executed. Read it
against what actually shipped in `src/auth.ts` before trusting it.

- [ ] **1.2.1** Confirm `users.id` as `uuid default gen_random_uuid()` is still right. The
      shipped auth carries the user id in the JWT; whatever the `jwt` callback writes must
      match this column's type exactly, or every insert into `plans` fails on the FK.
- [ ] **1.2.2** Confirm `users` still needs no password column. It does not — sign-in is
      OAuth. Re-state that in the migration comment so nobody adds one later "for
      flexibility".
- [ ] **1.2.3** Check the `plans_ok_has_response` constraint against the real response
      shape: 13 top-level fields, stored whole as JSONB.
- [ ] **1.2.4** Decide whether `plans.constraints` should be `text` or JSONB. The request
      schema accepts constraints in more than one shape; `constraintsToText` already
      normalises it. Storing the normalised text is the lazy correct answer — write down
      that the original shape is not recoverable from it.
- [ ] **1.2.5** Confirm `plans_user_created_idx` serves both queries the app will make
      ("my plans, newest first" and the rate-limit count over a recent window). One index,
      both jobs — verify with `EXPLAIN` in 2.4.6 rather than assuming.

### 1.3 Apply the schema

- [ ] **1.3.1** `psql "$DATABASE_URL" -f db/schema.sql`
- [ ] **1.3.2** Verify: `\d users` and `\d plans` show the expected columns, constraints and
      the index.
- [ ] **1.3.3** Insert a throwaway row by hand and confirm the `status` check constraint
      rejects `'pending'` and accepts `'ok'` / `'failed'`. A constraint nobody has seen fire
      is a constraint nobody knows works.
- [ ] **1.3.4** Confirm `on delete cascade` works: delete the test user, confirm the plan
      row goes with it.
- [ ] **1.3.5** Delete the test rows.
- [ ] **1.3.6** Decide on a migration story. Two tables and one developer do not need a
      migration engine. Record the decision: `db/schema.sql` is idempotent
      (`create table if not exists`), and any future change is a numbered file beside it.

### 1.4 The connection module

- [ ] **1.4.1** `npm i postgres` — dependency six. Justify it in the commit message against
      the ladder in `CLAUDE.md`: two tables and ~6 queries do not earn an ORM's schema DSL,
      generate step and migration engine.
- [ ] **1.4.2** Write `src/lib/db.ts` exactly as specified in the design doc — one pooled
      client per process, `{ max: 1 }`, created at module scope so warm serverless
      containers reuse it.
- [ ] **1.4.3** Add a comment explaining why `max: 1`: serverless multiplies connections by
      instance count, and a free-tier Postgres has a low connection ceiling.
- [ ] **1.4.4** Confirm `src/lib/db.ts` is never imported from a client component. Grep for
      it; a single accidental import in a `"use client"` file would attempt to bundle a
      database driver into the browser.
- [ ] **1.4.5** Verify with the smallest possible round trip: a one-off script that runs
      `select 1` and exits. Do not verify by starting the whole app.

---

## Module 2 — Backend integration

### 2.1 Persist the user on sign-in

- [ ] **2.1.1** Add the `jwt` callback to `src/auth.ts` — upsert on `email`, return the row
      id, store it as `token.uid`.
- [ ] **2.1.2** Add the `session` callback so `session.user.id` carries that id to anything
      that needs it.
- [ ] **2.1.3** Add the TypeScript module augmentation for `next-auth` so `session.user.id`
      is typed rather than `any`. Without it `npm run typecheck` will pass on a lie.
- [ ] **2.1.4** Guard the upsert: it runs on **every** JWT refresh, not only first sign-in.
      The `if (token.uid) return token` early exit in the design is what keeps it to one
      insert per user rather than one per request.
- [ ] **2.1.5** Decide what happens when GitHub returns no email address (it can — a user
      with a private email). Today `token.email` would be null and the upsert would violate
      `not null`. Either request the `user:email` scope explicitly, or fail the sign-in with
      a message the user can act on. **Do not** silently generate a fake email.
- [ ] **2.1.6** Verify: sign in, check the `users` table has exactly one row. Sign out, sign
      in again, confirm it is still exactly one row.

### 2.2 Stage-0 session check on the API route

**This is the point of the whole exercise.** Until this step, the endpoint is open and the
quota boundary is not closed.

- [ ] **2.2.1** Add `UNAUTHORIZED` (401) and `RATE_LIMITED` (429) to `ERROR_CODES` in
      `src/lib/scopecraft/schema.ts`.
- [ ] **2.2.2** Add the session check to `src/app/api/scopecraft/route.ts` as the **first**
      thing in the handler — before the 16 KB body read. There is no reason to read a body
      from an anonymous caller.
- [ ] **2.2.3** Confirm the error response shape matches every other error the route emits.
      A new code with a different envelope breaks the frontend's single error parser.
- [ ] **2.2.4** Confirm the 401 body leaks nothing — no provider name, no stack, no echoed
      input. Same rule as every other error path.
- [ ] **2.2.5** Verify with `curl`: no cookie → `401`; valid session cookie → proceeds.
- [ ] **2.2.6** Re-verify the pipeline ordering is otherwise unchanged: a malformed request
      from an *authenticated* caller must still cost zero provider tokens.

### 2.3 Persist the plan

- [ ] **2.3.1** Insert the success row after `runScopeCraft` returns — including
      `provider_used` and `prompt_version`, which mirror the response headers.
- [ ] **2.3.2** Insert the failure row in the `catch`, with `status = 'failed'` and the
      error code. A generation that reached a provider and then failed still cost tokens;
      if only successes were stored, a caller could burn quota on failures for free.
- [ ] **2.3.3** Confirm the 4xx paths above stage 5 never reach either insert — a malformed
      request must still cost the caller nothing.
- [ ] **2.3.4** Decide what happens if the *insert* fails while the *generation* succeeded.
      Recommendation: return the plan anyway and log the persistence failure. The user's
      result should not be thrown away because a bookkeeping write failed. Write this
      decision down; it is the kind of thing an examiner asks about.
- [ ] **2.3.5** Confirm `sql.json(data)` round-trips the response unchanged — select it back
      and deep-compare against what was returned to the client.
- [ ] **2.3.6** Verify the FK: an insert with an unknown `user_id` must be rejected, not
      silently succeed.

### 2.4 The daily rate limit

- [ ] **2.4.1** Write `src/lib/quota.ts` — `count(*)` over `plans` in the last 24 hours.
- [ ] **2.4.2** Place the check at **stage 4b**: after the free local checks, before
      `runScopeCraft`. A malformed request must never cost a database round trip.
- [ ] **2.4.3** Make the limit configurable via `DAILY_PLAN_LIMIT`, default 20. Add it to
      `.env.example`.
- [ ] **2.4.4** Confirm the limit counts **attempts**, not successes — the `status` column
      exists for exactly this.
- [ ] **2.4.5** Return the limit and a human-readable reset hint in the 429 body, so the UI
      can say something better than "try again later".
- [ ] **2.4.6** `EXPLAIN` the count query. Confirm it uses `plans_user_created_idx` and does
      not sequential-scan. This is the one query that runs on every generation.
- [ ] **2.4.7** Verify by setting `DAILY_PLAN_LIMIT=2` locally and generating three times.
- [ ] **2.4.8** Write down what this does **not** solve: it is per-account, not per-IP.
      Someone willing to create many GitHub accounts is not addressed. Edge middleware
      token-bucket limiting is the next layer, and it is not being built here.

### 2.5 Contract and documentation

- [ ] **2.5.1** Add `401 UNAUTHORIZED` and `429 RATE_LIMITED` to `docs/api-contracts.md`,
      with example bodies.
- [ ] **2.5.2** Update the pipeline diagram in `docs/architecture.md` — stage 0 and stage 4b
      are new, and the ordering claim in the security section depends on them.
- [ ] **2.5.3** Update the README boundary section: the endpoint is no longer anonymous.
      Remove the language saying it is, rather than adding a contradicting paragraph.
- [ ] **2.5.4** Update `docs/database-and-auth-design.md` — move the rows that are now
      shipped out of "design only" in its status table.

---

## Module 3 — Frontend integration

### 3.1 The two new error states

- [ ] **3.1.1** Map `401` in `src/app/scopecraft/page.tsx` to a redirect to `/login` rather
      than an error card. A session that expired mid-session is not an error the user can
      act on from where they are.
- [ ] **3.1.2** Map `429` onto the existing `provider_error` shape — it already renders a
      message plus a retry affordance. No new UI state is needed; adding one would be
      unrequested work.
- [ ] **3.1.3** Add `en` and `ar` strings for both. The type system will fail the build if
      Arabic is missing.
- [ ] **3.1.4** Verify the union in `page.tsx` still makes it impossible to render two
      states at once — that property is the reason the state machine is a discriminated
      union.
- [ ] **3.1.5** Add a test per state to `tests/ui/StateTransitions.test.tsx`.

### 3.2 Plan history — "my plans"

*This is the first feature the database makes possible that the user can actually see.*
Decide whether it is in scope before building it.

- [ ] **3.2.1** **Decide:** does this ship, or does the database exist only for metering?
      A `plans` table nobody can read from is defensible (it exists for the rate limit) but
      it is a weaker demo. *This is a decision, not a task.*
- [ ] **3.2.2** If yes: a server component route at `/scopecraft/history` listing the
      signed-in user's plans, newest first. Server component — the query runs where the
      credential is.
- [ ] **3.2.3** Scope every query by `user_id` from the **session**, never from a URL
      parameter or request body. This is the one place an IDOR could enter this codebase.
- [ ] **3.2.4** Paginate or cap the list. `select *` over an unbounded table is a
      time bomb, and JSONB rows are not small.
- [ ] **3.2.5** Add a link in the header, visible only when signed in.
- [ ] **3.2.6** Full i18n and a11y pass: both locales, both themes, keyboard reachable,
      measured contrast.

### 3.3 Board persistence

- [ ] **3.3.1** **Decide:** does the interactive sprint board save the user's edits?
      This is what `plans.board` exists for.
- [ ] **3.3.2** If yes: a `PATCH` route that writes `board` only. It must **never** be able
      to write `response` — the model's output stays immutable, and "what the AI said"
      versus "what the human decided" is a graded trust boundary.
- [ ] **3.3.3** Validate the board payload with Zod before it touches the database. A JSONB
      column accepts anything; that is not a reason to store anything.
- [ ] **3.3.4** Scope the update by `user_id` from the session **and** plan id. Verify a
      second user cannot patch the first user's board.
- [ ] **3.3.5** Confirm the client-side recalculation in `client-recalc.ts` still runs on
      the loaded board — the arithmetic stays in code, never in stored state.

### 3.4 Cross-cutting UI checks

- [ ] **3.4.1** Every new string exists in `en` and `ar`.
- [ ] **3.4.2** Every new control has an accessible name.
- [ ] **3.4.3** No physical CSS offsets in new styles — logical properties only.
- [ ] **3.4.4** Re-run `npm run capture:ui` and confirm all six overflow checks still pass
      in both directions.
- [ ] **3.4.5** Confirm no new client component imports `src/lib/db.ts` or `src/auth.ts`'s
      server-only exports.

---

## Module 4 — Test & evidence repair

This module is not optional. Modules 2 and 3 will break existing tests and both capture
scripts; a plan that does not budget for that is a plan that ends with a red build.

### 4.1 Route tests

- [ ] **4.1.1** Add one `auth()` mock to the node project's setup. **One mock, not 82
      edits** — every test in `tests/api/scopecraft.test.ts` currently posts anonymously.
- [ ] **4.1.2** Mock `src/lib/db.ts` so tests never touch a real database. Route tests are
      about the pipeline, not about Postgres.
- [ ] **4.1.3** Add tests for the two new codes: no session → `401`; over limit → `429`.
- [ ] **4.1.4** Add the ordering test that matters: a **malformed** request from an
      authenticated caller must not hit the database *or* a provider. Assert both mocks
      were never called.
- [ ] **4.1.5** Confirm all 251 existing tests still pass, and that the count only went up.

### 4.2 Database-touching tests

- [ ] **4.2.1** **Decide:** integration tests against a real database, or mock-only?
      Recommendation: mock-only for the suite, plus one manual verification script. A CI
      job that needs a live Postgres is a CI job that goes red for reasons unrelated to the
      code. *This is a decision.*
- [ ] **4.2.2** If mock-only, write down what is therefore **not** covered: the FK, the
      check constraint, the index. Those were verified by hand in 1.3 — reference that.

### 4.3 Evidence capture repair

- [ ] **4.3.1** `scripts/capture-evidence.sh` posts unauthenticated on all eleven cases and
      will get `401` on every one.
- [ ] **4.3.2** Give it a session the same way `capture-ui-evidence.mjs` does — mint a real
      cookie from `AUTH_SECRET`. **Do not** add an environment flag that makes the app skip
      its own auth check; a production bypass switch is a worse thing to own.
- [ ] **4.3.3** The shell script cannot call `next-auth`'s `encode` directly. Either shell
      out to a tiny node one-liner, or move the minting into a small shared `.mjs` helper
      both scripts import.
- [ ] **4.3.4** Add one new case to the harness: `401` with no cookie. The auth boundary
      deserves the same captured evidence as every other error code.
- [ ] **4.3.5** Add a `429` case — set `DAILY_PLAN_LIMIT=1` for one run.
- [ ] **4.3.6** Re-run both captures end to end. Confirm the committability guard still
      passes and nothing lands in `.gitignore`'s path.
- [ ] **4.3.7** Update `docs/evidence/curl-evidence.md` and
      `docs/evidence/provider-fallback-log.md` with the new counts and the new cases.

### 4.4 Regression checks for the new logic

- [ ] **4.4.1** One check that fails if the rate limit stops counting failures.
- [ ] **4.4.2** One check that fails if a plan query stops being scoped by `user_id`.
- [ ] **4.4.3** One check that fails if the board endpoint can write `response`.

---

## Module 5 — Full system audit

The "check the whole system for what is missing" sweep. Run it **after** Modules 1–4, so it
audits what will actually be submitted.

### 5.1 Security

- [ ] **5.1.1** Bundle secret scan after a fresh build (the grep in the README).
- [ ] **5.1.2** Grep the whole tree for `NEXT_PUBLIC_`. There should be zero.
- [ ] **5.1.3** Confirm every database query is parameterised. The `postgres` tagged
      template does this by construction — confirm no query was built by string
      concatenation as a "quick fix".
- [ ] **5.1.4** Confirm every user-scoped query takes its `user_id` from the session, never
      from client input. Grep every `sql\`` call and check each one.
- [ ] **5.1.5** Re-verify all six security headers on the live deployment, not locally.
- [ ] **5.1.6** Confirm `X-Powered-By` is still absent.
- [ ] **5.1.7** Re-read `docs/security-review.md` and correct anything the database change
      made stale.
- [ ] **5.1.8** Confirm error responses still leak nothing on every path, including the two
      new ones.
- [ ] **5.1.9** Confirm the session cookie is `httpOnly`, `sameSite=lax`, and `secure` in
      production. Check the actual `Set-Cookie` header on the live site, not the config.

### 5.2 Correctness and reliability

- [ ] **5.2.1** Re-run `npm run smoke` — all three providers reachable, model IDs still
      live. Hosted model availability changes independently of this repository.
- [ ] **5.2.2** Attack the `PLANNING_ERROR` intermittency (known finding #4, 4 of 9 live
      runs). The likely cause is dangling dependencies in the model's story graph; the
      likely fix is dropping unresolvable dependency edges before planning rather than
      failing the whole request.
- [ ] **5.2.3** Decide on the React hydration #418 fix (known finding #3). The fix trades
      a console error for a language flash on load. **Owner's decision.**
- [ ] **5.2.4** Verify the deterministic boundary still holds after the database change:
      `priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are recomputed server-side
      and overwrite model output. A stored plan must recompute identically on load.
- [ ] **5.2.5** Confirm `committed_points <= capacity_points` on a freshly captured live
      result, not on a fixture.
- [ ] **5.2.6** Confirm provider failover still works with a session in play — the auth
      check is upstream of it and must not have changed the timeout budget.

### 5.3 Accessibility and internationalisation

- [ ] **5.3.1** `npm run capture:ui` green, including all six LTR/RTL overflow checks.
- [ ] **5.3.2** Every contrast pair at or above AA in both themes.
- [ ] **5.3.3** Zero controls without an accessible name.
- [ ] **5.3.4** Full keyboard pass by hand on `/login` and `/scopecraft`: tab order, focus
      visibility, skip link, no keyboard trap.
- [ ] **5.3.5** Grep new CSS for physical offsets: `left:`, `right:`, `margin-left`,
      `padding-right`, `border-radius` shorthand with asymmetric corners.
- [ ] **5.3.6** Confirm no untranslated string reached the UI — read both locales on screen,
      do not trust the dictionary.
- [ ] **5.3.7** Named gap, do not claim otherwise: there has still been **no real
      screen-reader run**. The audit measures the DOM contract, which is not the same thing.

### 5.4 Performance and cost

- [ ] **5.4.1** Confirm the database adds exactly the round trips expected — one for the
      rate limit, one for the insert. Not one per request for the user lookup; that is what
      `token.uid` in the JWT prevents.
- [ ] **5.4.2** Confirm connection pooling behaves under repeated requests. A free-tier
      Postgres has a low connection ceiling and serverless multiplies by instance count.
- [ ] **5.4.3** Note which routes are now dynamic rather than prerendered, and why. Reading
      cookies makes a route dynamic; that is the cost of requiring a session, not a
      regression to fix.
- [ ] **5.4.4** Check the client bundle size did not grow meaningfully.

### 5.5 Documentation truthfulness sweep

The single highest-yield audit in this repository, because it has failed before.

- [ ] **5.5.1** Re-read `README.md` end to end against the running app. Every claim.
- [ ] **5.5.2** Re-read `docs/architecture.md` the same way.
- [ ] **5.5.3** Re-read every checklist in `docs/` and confirm each ticked box is still
      true. Untick anything that is not.
- [ ] **5.5.4** Verify every commit SHA referenced in any doc still resolves
      (`git cat-file -e <sha>`). Especially if Module 0.3 was executed.
- [ ] **5.5.5** Verify every internal link resolves and every external link still loads.
- [ ] **5.5.6** Confirm the dated historical records (`session2-lead-checklist.md`,
      `scopecraft-completion-checklist.html`) still carry their superseded banners with the
      original text intact. Do not rewrite them.
- [ ] **5.5.7** Confirm the test count, screenshot count and dependency count are correct
      everywhere they appear. These drift on every change and appear in ~6 files.

### 5.6 Rubric and submission coverage

- [ ] **5.6.1** Re-read the handbook acceptance CSVs row by row against what exists.
- [ ] **5.6.2** **`AI_USAGE.md` — three sections are still placeholders** (Nour, Joe,
      Yasmin). This blocks a *Required* submission row. They must write their own; do not
      write it for them.
- [ ] **5.6.3** **PR #2 is still open** (`feat: complete role-specific updates`). It is the
      only outstanding item that currently fails a written acceptance criterion. Merge or
      close it — it belongs to a teammate, so it needs a human decision.
- [ ] **5.6.4** **There is no git tag.** Tag a release once Module 7 is done.
- [ ] **5.6.5** Yasmin's sign-off on the 1–10 → 1–5 estimation scale change is still
      outstanding (decision-log item 9). It rewrote her fixtures.
- [ ] **5.6.6** Confirm the evaluation set's known gaps are documented: no explicit
      **ambiguous** category, no **tool-failure** category.
- [ ] **5.6.7** Confirm `docs/contribution-matrix.md` reflects who actually did what,
      including the authentication work.
- [ ] **5.6.8** Three-minute demo script — written, and rehearsed against the live site.
- [ ] **5.6.9** Individual defense prep for each member. Yousef's is
      `docs/defense-prep-backend.md`; the other three rows have none.

---

## Module 6 — Documentation & decision record

- [ ] **6.1.1** Add a decision-log entry for the database adoption: what it buys, what it
      costs, what was deliberately not built (no ORM, no sessions table, no Redis, response
      as JSONB rather than eleven normalised tables).
- [ ] **6.1.2** Add a decision-log entry for every "decide" step in this plan that was
      answered — 1.3.6, 2.3.4, 3.2.1, 3.3.1, 4.2.1. An answered decision with no record is
      an argument that will be had again.
- [ ] **6.1.3** Update `HANDOFF.md`: branch heads, test count, screenshot count, dependency
      count, the open-findings table, and the per-person section.
- [ ] **6.1.4** Update the `docs/database-and-auth-design.md` status table so it describes
      the finished state rather than the plan.
- [ ] **6.1.5** Update `AI_USAGE.md`'s own section with the database and audit work.
- [ ] **6.1.6** Re-read this plan and tick what is genuinely done. Leave the rest open —
      an honestly incomplete checklist is worth more than a dishonestly complete one.

---

## Module 7 — Ship

- [ ] **7.1.1** All four gates green: `typecheck`, `lint`, `test`, `build`.
- [ ] **7.1.2** Both capture scripts green.
- [ ] **7.1.3** Bundle secret scan clean.
- [ ] **7.1.4** `git status` clean apart from the known-untracked handbook folder. Never
      `git add -A` without looking first.
- [ ] **7.1.5** Confirm no `Co-Authored-By` trailer on any new commit.
- [ ] **7.1.6** `git push origin dev`
- [ ] **7.1.7** `git push fork dev:main` — **this is the one that deploys.**
- [ ] **7.1.8** Verify the live site: sign in, generate a plan, sign out. Check the response
      headers and the `Set-Cookie` flags.
- [ ] **7.1.9** Confirm a plan row landed in the production database.
- [ ] **7.1.10** Tag the release.

---

## Risk register

Four things that could turn a half-day into two days. None is a reason not to proceed; all
are reasons to sequence carefully.

| Risk | Likelihood | What it costs | Mitigation |
|---|---|---|---|
| Free-tier Postgres connection ceiling under serverless | Medium | Intermittent 500s that look like application bugs | `max: 1` in `db.ts`, pooled connection string, verify under repeated load in 5.4.2 |
| GitHub returns no email address for some user | Low | Sign-in fails at the upsert with a `not null` violation | Handled explicitly in 2.1.5 — decide the behaviour before it happens in a demo |
| Evidence capture repair (4.3) is fiddlier than it looks | Medium | Half a day; the shell script cannot call `encode` directly | Move cookie minting into one shared helper both scripts import |
| Module 0.3 invalidates SHAs faster than docs get fixed | Medium | Broken references in nine documents, some in graded evidence | Do 0.3.3 in the *same* sitting as 0.3.2, never "later" |

---

## Definition of done

This plan is done when all of the following are true at once, each verified by running
something rather than by reading something:

1. Every module's steps are ticked, or explicitly marked "not doing, because —".
2. All four gates are green and both capture scripts pass.
3. `POST /api/scopecraft` returns `401` without a session and `429` over the daily limit,
   verified with `curl` against the **live** deployment.
4. A generated plan appears in the production database, attributed to the right user.
5. No document in the repository makes a claim that is no longer true.
6. `AI_USAGE.md` has four complete sections, each written by its own author.
