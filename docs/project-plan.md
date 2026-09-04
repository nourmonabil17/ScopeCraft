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
| All documentation (39 documents) | `README.md`, `docs/`, root files | [11](#module-11--documentation) |
| Repository, branches, PRs, CI | `.github/`, git remotes | [12](#module-12--repository-ci--process) |
| Rubric coverage, defense, demo | handbook CSVs | [13](#module-13--submission--defense) |
| Deployment & release | Vercel, fork `main` | [14](#module-14--deployment--release) |

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
| [14](#module-14--deployment--release) | Deployment & release | 2 h | — |

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
      `docs/evidence/ui/accessibility-checklist.md`, `docs/evidence/cache-evidence.md`,
      and three files under `docs/evidence/raw/`. Never "later" — some are graded artifacts.
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

- [x] **1.1.1** Write `docker-compose.yml` with a `db` service: `postgres:16-alpine`,
      `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, port `5432` published.
- [x] **1.1.2** Add a named volume so data survives `docker compose down`. Without it every
      restart wipes the database, which is confusing rather than clean.
- [x] **1.1.3** Mount `db/schema.sql` into `/docker-entrypoint-initdb.d/` so a fresh
      container applies the schema automatically. This is why the schema is idempotent.
- [x] **1.1.4** Add a `healthcheck` using `pg_isready`. Without it, anything depending on
      the database races container startup and fails on the first run only — the worst kind
      of flake.
- [x] **1.1.5** Verify: `docker compose up -d db`, then `psql` in and confirm `users` and
      `plans` exist with their constraints and index.
- [x] **1.1.6** Verify the volume: insert a row, `docker compose restart db`, confirm it
      survived.

### 1.2 The application image

- [x] **1.2.1** Add `output: "standalone"` to `next.config.js`. Without it the image carries
      all of `node_modules`; with it Next emits a self-contained server bundle.
      **Verify the Vercel build still works immediately after this** — it is a build-level
      change to a config file Vercel shares.
- [x] **1.2.2** Write a multi-stage `Dockerfile`: `deps` → `builder` → `runner`, on
      `node:22-alpine`. Node 22 is required — `scripts/capture-ui-evidence.mjs` uses the
      global `WebSocket`.
- [x] **1.2.3** Run as a non-root user in the final stage. A container running as root is a
      finding an examiner spots in five seconds.
- [x] **1.2.4** Write `.dockerignore`: `node_modules`, `.next`, `.git`, `.env*`,
      `docs/evidence/ui/shots`. **Verify no `.env` file can enter the image** — a baked-in
      secret survives in every layer.
- [x] **1.2.5** `AUTH_SECRET` and `DATABASE_URL` are **run-time**, never `ARG`, never baked
      into a layer.
- [x] **1.2.6** Add the `web` service to compose, depending on `db` with
      `condition: service_healthy`.
- [ ] **1.2.7** Verify: `docker compose up --build`, open `http://localhost:3000/login`,
      sign in, generate a plan, confirm the row lands in the containerised database.
      **Partly done (2026-08-27).** The container serves `/login` with `200`, the CSP and
      `X-Frame-Options` headers arrive, `X-Powered-By` is absent, the CSS chunks serve
      (so the `.next/static` copy is right), `POST /api/scopecraft` answers `422` on an
      empty body, and `web` reaches `db:5432` over the compose network. **Sign-in and the
      database row cannot be verified yet** — sign-in needs a real GitHub OAuth app
      (0.2.6) and nothing in the app writes to the database until Module 3. Re-run this
      step after 3.3 and close it then.
- [x] **1.2.8** Check the final image size. Over ~400 MB means standalone output is not
      being used correctly.

### 1.3 Developer experience

- [x] **1.3.1** Add `.env.docker.example` — compose-specific values, where `DATABASE_URL`
      points at the `db` service hostname rather than `localhost`.
- [x] **1.3.2** Add npm scripts: `docker:up`, `docker:down`, `docker:logs`, `docker:psql`.
      Nobody should have to remember compose flags to read a log.
- [x] **1.3.3** **Decision — ANSWERED 2026-08-27: database in Docker, application on the
      host.** `docker compose up` starts only `db`; the `web` service is gated behind
      `profiles: ["app"]`. Recorded as decision-log entry 14.

      One consequence worth knowing: the auth variables had to drop `${VAR:?message}` for
      empty defaults. Compose interpolates the whole file *before* applying profiles, so a
      required variable on the profiled-out service broke a plain `docker compose up` —
      the normal case — to improve the rare one. No fallback value was added; a committed
      secret is a secret that ships.

      Scripts are named `db:*` rather than the `docker:*` this plan originally said, because
      with the app on the host that is what they actually do: `db:up`, `db:down`, `db:logs`,
      `db:psql`, `db:reset`.
- [x] **1.3.4** Document the one-command start in `docs/local-development.md` (11.4.1).
- [x] **1.3.5** Verify a genuinely cold start: `docker compose down -v`, then
      `docker compose up`. That is what a teammate's first run looks like.

### 1.4 Interaction with what already exists

The parts most likely to break, and why this module is not just "write a Dockerfile".

- [x] **1.4.1** **Decided: both capture scripts stay on the host — structurally, not by
      preference.** `capture-evidence.sh` boots `next start` six times, each with a
      different provider environment; it *is* the server's lifecycle manager, so it cannot
      be pointed at a long-running container whose environment is fixed at start. That is
      the whole mechanism by which failover evidence gets captured.

      **Verified:** `next start` is unaffected by `output: "standalone"` — `/login` 200,
      `POST /api/scopecraft` 422 on an empty body, CSS chunk 200. Both scripts therefore
      still work after Module 1.

      **Verified:** no port collision. The scripts use 3100 / 3200 / 3201 / 9333; compose
      uses 3000 (profiled off) and 5432. Only 5432 was listening.

      No base-URL knob was added to `capture-evidence.sh`. `EVIDENCE_PORT` already covers
      the real need (a port clash), and a host override would be configuration for a
      scenario that cannot exist.
- [x] **1.4.2** `scripts/capture-ui-evidence.mjs` launches Chrome from a macOS path and
      cannot run inside the app container without a headless Chrome image. Kept on the
      host, and said out loud in `docs/local-development.md` rather than left to be
      discovered. **Confirmed:** the discovery list is two macOS `.app` paths, so the
      script exits with a clear message on any other platform. No Linux paths were added —
      nothing runs this outside this machine, and the failure is already legible.
- [x] **1.4.3** **Verified.** The container's own hostname is `8aec4e96dddf`; with
      `AUTH_URL=http://localhost:3000` set, `/api/auth/providers` advertises
      `http://localhost:3000/api/auth/callback/github`, and the real `redirect_uri` sent in
      the 302 to `github.com/login/oauth/authorize` is that same URL. Correct, because
      GitHub redirects the **browser** — which is on the host — not the container. Without
      `AUTH_URL` this would resolve to the container ID and GitHub would reject the
      callback as a mismatch.
- [ ] **1.4.4** **Partly done (2026-08-27).** Re-tested at the mechanism level: the container's
      `Content-Security-Policy` header is **byte-identical** to the host's under
      `next start` (same md5), `upgrade-insecure-requests` included, and it is served over
      the same `http://localhost` origin. So the containerised app reproduces 0.1 exactly
      — there is no container-specific variant of this bug, and fixing 0.1.2 fixes both.
      **Not closed:** confirming what Safari actually does still needs the Safari console,
      which is step 0.1.1 and needs you.
- [x] **1.4.5** Confirm `output: "standalone"` did not change the built HTML or CSP
      behaviour. Re-run the bundle secret scan afterwards. **Done** — the route table is
      byte-identical before and after, and the client-bundle secret scan is clean.

### 1.5a Finding — the local database is a different Postgres major version

Docker runs **PostgreSQL 16.14**; Neon runs **18.6**. Nothing has broken, and the schema uses
nothing version-sensitive, but "test what you deploy" is worth more than a pinned tag.

- [ ] **1.5a.1** Move `docker-compose.yml` to `postgres:18-alpine`. **Blocked on 1.5.1** —
      pulling a new image needs Docker DNS, which does not currently resolve on this machine.
- [ ] **1.5a.2** Re-run `npm run db:check` against the new container afterwards.

### 1.5 Machine-specific finding — Docker Desktop DNS

Not a project defect; recorded so it is not rediagnosed as one.

**On this machine, `docker build` cannot resolve DNS.** Containers get
`nameserver 192.168.65.7` (Docker Desktop's internal resolver) and it does not answer —
`npm ci` dies with `ECONNRESET` after ~160 s, and `docker pull` of an uncached image times
out. The host resolves fine, and `docker run --dns 8.8.8.8` resolves fine, which isolates
it to Docker Desktop's own forwarder. The daemon also has an HTTP proxy configured at
`http.docker.internal:3128`, which is the likely cause.

The image was built with `docker build --network=host`, which bypasses the forwarder.
That flag is **not** in `docker-compose.yml` — a local machine's broken resolver does not
belong in a committed project file.

- [ ] **1.5.1** Fix it properly in Docker Desktop → Settings → Resources → Proxies (set
      "No proxy", or point it at a proxy that actually answers), then confirm plain
      `docker compose up --build` works with no flags.
- [ ] **1.5.2** Add it to `docs/local-development.md` troubleshooting (11.4.1) — symptom,
      one-line diagnosis (`docker run --rm alpine cat /etc/resolv.conf`), and both fixes.

---

## Module 2 — Database

### 2.1 Review the schema before applying it

`db/schema.sql` was written as a design artifact and has never been executed.

- [x] **2.1.1** **Verified against a live database.** `src/auth.ts` has no `jwt` callback
      yet (that is 3.1), so this was checked as a type path rather than a call: the upsert
      returns a 36-character text uuid, and using that string as `plans.user_id` — a `uuid`
      column with a foreign key — inserts successfully. Postgres casts text to uuid on the
      way in, so what 3.1 will put in `token.uid` is already the right shape.
- [x] **2.1.2** Confirmed: no password column, and `db/schema.sql` already says why in a
      comment. Sign-in is GitHub OAuth, so the app never sees, hashes, stores, resets or
      leaks a password — a class of vulnerability removed rather than mitigated.
- [x] **2.1.3** **Verified.** The response schema has exactly 13 top-level fields, and all
      13 keys survive a JSONB round trip unchanged. `plans_ok_has_response` only asserts
      `response is not null`, so it is shape-agnostic and will not break when the PRD shape
      changes.
- [x] **2.1.4** **Decision — ANSWERED: `text`.** The evidence settles it rather than taste.
      `constraints` is `string | string[]`, and `service.ts` calls
      `constraintsToText(request.constraints)` *before* building the prompt — so the model
      never receives the original shape either. Storing the normalised text therefore loses
      nothing that could have affected the output. Recorded: the array-versus-string
      distinction is **not** recoverable from a stored row, and nothing needs it to be.
- [x] **2.1.5** **Verified with `EXPLAIN`, better than assumed.** The rate-limit count plans
      as an **Index Only Scan** on `plans_user_created_idx` with both predicates in the
      `Index Cond` — it never touches the heap. One index, both jobs, confirmed. This also
      closes 3.4.6 ahead of time.

### 2.2 Apply and prove it

- [x] **2.2.1** Applied via the Docker init mount (1.1.3). `db/schema.sql` has now been
      executed for the first time since it was written, and applied cleanly.
- [x] **2.2.2** Verified — every column, both check constraints, the composite index and
      the foreign key are present exactly as declared.
- [x] **2.2.3** **Seen to fire.** `'pending'` → rejected by `plans_status_check`;
      `'failed'` → accepted with a null response; `'ok'` with a null response → rejected by
      `plans_ok_has_response`. Also proved `users_email_key` rejects a duplicate email.
- [x] **2.2.4** **Seen to fire.** Two plan rows, one `delete from users`, zero plan rows
      after.
- [x] **2.2.5** **Seen to fire.** An insert with an unknown `user_id` is rejected by
      `plans_user_id_fkey`.
- [x] **2.2.6** Done — the cascade in 2.2.4 removed them; the database is back to zero
      rows in both tables.
- [x] **2.2.7** Recorded as decision-log entry 15. `db/schema.sql` is idempotent
      (`create table if not exists`) and is mounted into the container's init directory;
      future changes are numbered files beside it. The trap that comes with that — the init
      directory runs **once**, only on an empty data directory — is documented in
      `docs/local-development.md` and is why `npm run db:reset` exists.

### 2.3 Production database — Neon

**Decided 2026-08-27: Neon.** Docker covers local development; production still needs a
managed instance because Vercel is the deploy target and does not run the compose stack.
Free tier, serverless-friendly pooling, and about two minutes to a connection string.

Four Neon-specific things that are easy to get wrong and expensive to debug later:

| | Why it matters here |
|---|---|
| **Pooled vs direct host** | The pooled endpoint carries `-pooler` in the hostname. Serverless multiplies connections by instance count, and the direct endpoint's ceiling is low enough that a handful of warm functions exhausts it. `max: 1` in `db.ts` reduces the pressure; it does not remove the need for the pooler |
| **Autosuspend** | The free tier suspends the compute after ~5 minutes idle. The first query after that pays a wake-up of roughly half a second. Real, harmless, and worth knowing before someone reports it as a bug — a demo opened cold will feel slower than one opened warm |
| **Region** | Every request in Module 3 pays the round trip twice (quota check, then insert). Match the Vercel deployment region |
| **`sslmode=require`** | Neon requires TLS. It is already in the string Neon gives you; do not strip it while editing the URL by hand |

- [x] **2.3.1** Project `delicate-star-12997110` ("ScopeCraft") exists.
- [x] **2.3.2** Region `aws-us-east-2`. Note for 14.2: the Vercel deployment region should
      be set to match, or every request pays an avoidable cross-region hop twice.
- [x] **2.3.3** Both branch connection strings are pooled (`-pooler` in the host) and carry
      `sslmode=require`. Verified by inspection, not assumed.
- [ ] **2.3.4** **`.env.example` done; the Vercel half needs you.** Get the string with:
      `npx neon@latest connection-string --project-id delicate-star-12997110 --branch production --role-name neondb_owner --pooled`
      and set it as `DATABASE_URL` in Vercel. Use the **`dev`** branch's string for Preview,
      so previews never write to the demo database.
- [x] **2.3.5** Schema applied to **both** branches. It was already present — every
      statement reported "already exists, skipping", which is the idempotence from decision 15
      doing its job on a re-run. `npm run db:check` then passed against both: all four
      constraints seen to reject, and the index present. **This is 14.3.3 satisfied early** —
      the constraints are proven to enforce in production, not only in Docker.
- [ ] **2.3.6** Confirm `DATABASE_URL` never gains a `NEXT_PUBLIC_` prefix and never appears
      in the client bundle. Run the secret scan after the next build.
- [ ] **2.3.7** **Decision:** backups. Neon's free tier keeps a short restore window and no
      scheduled backups. For a graded project that is almost certainly fine — record it as a
      deliberate acceptance rather than leaving it as an unexamined gap.
- [x] **2.3.8** **Decision — ANSWERED: yes, and it already is.** Two branches exist,
      `production` (default) and `dev`, on **separate endpoints** — so a preview deployment
      cannot write into the database the demo runs against.
- [x] **2.3.9** Wake-up cost not separately timed, but the end-to-end generation against
      Neon completed normally with no visible stall. Re-measure before the demo if the project
      has been idle.
- [x] **2.4.1** Installed. **Runtime dependencies: 5 → 6** (`next`, `next-auth`,
      `postgres`, `react`, `react-dom`, `zod`). Justification is in the module header: the
      driver's tagged templates parameterise every interpolation by construction, which is
      the one property an ORM would have been bought for.
- [x] **2.4.2** Written. Also throws at **import** time when `DATABASE_URL` is missing,
      rather than at first query — a deployment mistake should surface while the stack trace
      still names this file.
- [x] **2.4.3** Commented, with the arithmetic: a pool of 10 across 20 warm instances
      exhausts a free-tier ceiling.
- [x] **2.4.4** Checked across all **21** client components: none imports `@/lib/db`.
      Worth noting the check itself was wrong twice first — the directive is not on line 1
      (it follows each file's header comment), and a naive grep self-matched `db.ts`, whose
      own comment contains the string `"use client"`.
- [x] **2.4.5** Verified, and left behind as `npm run db:check` rather than thrown away —
      the same pattern as `npm run smoke`, answering "is Postgres reachable right now" the
      way that one answers it for the providers. All three paths tested: success, missing
      `DATABASE_URL`, connection refused, and reachable-but-schema-missing.

      One real defect found and fixed in it. A connection failure from the driver is an
      `AggregateError` whose own `message` is the **empty string** — the detail lives on
      `.code` and inside `.errors[]`. Reporting `error.message` printed `FAIL:` and nothing
      else. That is now a named function with the reason written above it.

---

## Module 3 — Backend & API

### 3.1 Persist the user on sign-in

- [x] **3.1.1** Add the `jwt` callback to `src/auth.ts` — upsert on `email`, return the row
      id, store as `token.uid`.
- [x] **3.1.2** Add the `session` callback so `session.user.id` reaches anything that needs
      it.
- [x] **3.1.3** Add the `next-auth` module augmentation so `session.user.id` is typed.
      Without it `npm run typecheck` passes on a lie.
- [x] **3.1.4** Keep the `if (token.uid) return token` early exit — the callback runs on
      every JWT refresh, not only first sign-in. That guard is what makes it one insert per
      user rather than one per request.
- [x] **3.1.5** **Decision — ANSWERED, and the premise was half wrong.** The Auth.js GitHub
      provider *already* requests `read:user user:email` and already falls back to
      `/user/emails` for the primary address when the public one is null, so a private email
      is not the failure case. What remains is genuinely rare — a revoked scope, a GitHub API
      failure mid-flow, an account with no address at all — and it now **fails the sign-in
      with a named error** rather than surfacing as a `not null` violation. No placeholder is
      generated: `users.email` is the unique key, so a fabricated value would either collide
      with another user or create an unreachable orphan row.
- [x] **3.1.6** Verify: sign in → exactly one row in `users`. Sign out, sign in again →
      still exactly one row.

### 3.2 Stage-0 session check on the API route

**The point of the whole exercise.** Until this step the endpoint is open and the quota
boundary is not closed.

- [x] **3.2.1** Add `UNAUTHORIZED` (401) and `RATE_LIMITED` (429) to `ERROR_CODES` in
      `src/lib/scopecraft/schema.ts`.
- [x] **3.2.2** Put the session check **first** in the handler — before the 16 KB body read.
      There is no reason to read a body from an anonymous caller.
- [x] **3.2.3** Match the existing error envelope exactly. A new code with a different shape
      breaks the frontend's single error parser.
- [x] **3.2.4** Confirm the 401 body leaks nothing — no provider name, no stack, no echoed
      input.
- [x] **3.2.5** Verify with `curl`: no cookie → `401`; valid session cookie → proceeds.
- [x] **3.2.6** Re-verify the pipeline is otherwise unchanged — a malformed request from an
      *authenticated* caller must still cost zero provider tokens.

### 3.3 Persist the plan

- [x] **3.3.1** Insert the success row after `runScopeCraft` returns, including
      `provider_used` and `prompt_version` (they mirror the response headers).
- [x] **3.3.2** Insert the failure row in the `catch` with `status = 'failed'` and the error
      code. A generation that reached a provider and then failed still cost tokens; if only
      successes were stored, a caller could burn quota on failures for free.
- [x] **3.3.3** Confirm the 4xx paths above stage 5 never reach either insert.
- [x] **3.3.4** **Decision — ANSWERED: return the plan, log the failure.** `recordPlan` never
      throws. A failed bookkeeping write must not destroy a plan the user already waited for
      and already spent provider tokens on. The cost is stated rather than hidden: a
      persistence outage under-counts the quota for as long as it lasts. Logged with an error
      *name* only — no connection string, no request body.
- [x] **3.3.5** Confirm `sql.json(data)` round-trips unchanged — select it back and
      deep-compare against what was returned to the client.

### 3.4 Rate limiting

- [x] **3.4.1** Write `src/lib/quota.ts` — `count(*)` over `plans` in the last 24 hours.
- [x] **3.4.2** Place it at **stage 4b**: after the free local checks, before
      `runScopeCraft`. A malformed request must never cost a database round trip.
- [x] **3.4.3** Configurable via `DAILY_PLAN_LIMIT`, default 20. Add to `.env.example`.
- [x] **3.4.4** Confirm it counts **attempts**, not successes.
- [x] **3.4.5** Return the limit and a reset hint in the 429 body so the UI can say
      something better than "try again later".
- [x] **3.4.6** `EXPLAIN` the count query — confirm it uses `plans_user_created_idx` and
      does not sequential-scan. This runs on every generation.
- [x] **3.4.7** Verify with `DAILY_PLAN_LIMIT=2` locally and three generations.
- [x] **3.4.8** Write down what it does **not** solve: it is per-account, not per-IP.

### 3.4b Application-layer request cache

Shipped 2026-09-04 as A3 in [`upgrade-checklist.md`](upgrade-checklist.md). Numbered `3.4b`
rather than appended at `3.7`, because it lives beside the rate limit in the pipeline and
reads the same table — putting it after the read/write APIs would misrepresent where it sits.

- [x] **3.4b.1** Add `plans.request_hash`: sha256 over `(hash version, idea, constraints,
      team_capacity_points)`. In the `create table` block **and** as an `alter table ... add
      column if not exists`, because `create table if not exists` does nothing at all on a
      database that already holds the table.
- [x] **3.4b.2** Place the lookup at **stage 4c** — after the quota at 4b, before
      `runScopeCraft` at 5. In front of the quota, a replayed request would bypass the meter
      entirely, which is the one thing the meter exists to prevent.
- [x] **3.4b.3** Scope it **per user**. A global cache hits more often and saves more tokens,
      but it turns response time into an oracle: a fast answer would reveal that somebody
      else had already generated that exact idea.
- [x] **3.4b.4** Filter to `status = 'ok'`, `response is not null` and
      `prompt_version = PROMPT_VERSION`. The table keeps failed rows on purpose and an error
      is not a cached answer; a v7 plan must not answer a v8 request.
- [x] **3.4b.5** A hit writes its **own** `plans` row with `attempts = 0` and returns a fresh
      `X-Plan-Id`. History stays complete, and an edit made after a hit cannot overwrite the
      original plan's board. It counts against the daily quota — the limit is plans per day,
      not provider calls per day.
- [x] **3.4b.6** Prove no provider is called on a repeat **by a provider spy, not by timing**.
      `tests/api/scopecraft.test.ts` → "Module A3 · application-layer cache". Confirmed to
      fail against a stubbed-out lookup before being kept.
- [x] **3.4b.7** Capture it live. `npm run capture:cache` writes
      [`docs/evidence/cache-evidence.md`](evidence/cache-evidence.md): dev branch miss
      **35.86 s** / hit **0.62 s**; production miss **21.47 s** / hit **0.61 s**. The rows
      carry `attempts=2` then `attempts=0`, which is the actual proof.
- [x] **3.4b.8** Record what the round trip changes. A hit is **not** byte-identical to the
      miss: the plan passes through a `jsonb` column and Postgres does not preserve object key
      order in that type. Same data, same byte count, different order — reproduced on both
      the dev and production branches, so it is a property of the column type. Harmless to a
      JSON client and outside the Zod contract, recorded so it does not read as a bug later.
- [ ] **3.4b.9** Nothing evicts a cached row. It stops being served when `PROMPT_VERSION`
      moves, which is the only change that makes it wrong. **Open by decision, not oversight** —
      a TTL would be a second expiry rule with nothing asking for it. Revisit only if a plan
      is ever wrong for a reason other than the prompt.

### 3.5 Read and write APIs for the frontend

~~Blocked on 4.3.1 and 4.4.1.~~ **Both answered yes on 2026-08-27**, so 3.5 was built with
Module 4.

- [x] **3.5.1** **Decision — ANSWERED: yes, plan history ships.**
- [x] **3.5.2** If yes: prefer a server component reading the database directly over a new
      JSON endpoint. A route that exists only for your own frontend is an API surface you
      have to secure for no benefit.
- [x] **3.5.3** Scope every query by `user_id` from the **session**, never from a URL
      parameter or body. This is the one place an IDOR could enter this codebase.
- [x] **3.5.4** Paginate or cap. `select *` over an unbounded table of JSONB rows is a time
      bomb.
- [x] **3.5.5** A `PATCH` for the board (4.4) that writes `board` and **never** `response`.
      The model's output stays immutable.
- [x] **3.5.6** Validate the board payload with Zod before it touches the database. A JSONB
      column accepts anything; that is not a reason to store anything.

### 3.6 Server-side logging

- [x] **3.6.1** Confirm the existing safe-logging rules still hold: no API key, no full
      prompt, no user input echoed into logs.
- [x] **3.6.2** Decide what a persistence failure logs, and confirm it does not include the
      connection string.
- [x] **3.6.3** Confirm nothing added in this plan logs a session token or cookie value.

---

## Module 4 — Frontend

### 4.1 The two new error states

- [x] **4.1.1** Map `401` in `src/app/scopecraft/page.tsx` to a redirect to `/login`, not an
      error card. An expired session is not something the user can act on from where they
      are.
- [x] **4.1.2** Map `429` onto the existing `provider_error` shape — it already renders a
      message plus a retry affordance. No new UI state; adding one would be unrequested
      work.
- [x] **4.1.3** Add `en` and `ar` strings for both. The type system fails the build if
      Arabic is missing.
- [x] **4.1.4** Confirm the discriminated union still makes two simultaneous states
      impossible. That property is why the state machine is a union.

### 4.2 Session-aware UI

- [x] **4.2.1** Confirm `UserMenu` renders correctly for a long GitHub display name, a null
      name (email fallback), and at ≤30rem where the name hides and the button stays.
- [x] **4.2.2** Handle the expired-session case: the page was server-rendered with a session
      that has since expired. The first API call returns 401 → 4.1.1 handles it.
- [x] **4.2.3** Confirm sign-out clears state and returns to `/login` with no stale result
      rendered behind it.

### 4.3 Plan history

- [x] **4.3.1** **Decision — ANSWERED: yes.** `/scopecraft/history`, a server component so
      the query runs where the credential is. No JSON endpoint behind it: a route that exists
      only to feed your own frontend is an API surface you have to secure for no benefit.
- [x] **4.3.2** If yes: a server component at `/scopecraft/history`, newest first.
- [x] **4.3.3** Header link, visible only when signed in.
- [x] **4.3.4** Empty state for a user with no plans. Reuse the existing `EmptyState`.
- [x] **4.3.5** Loading and error states. Every other view has all seven; a new one with two
      is an inconsistency an examiner will find.
- [x] **4.3.6** Full i18n and a11y pass — folded into Module 10.

### 4.4 Board persistence

- [x] **4.4.1** **Decision — ANSWERED: yes.** Debounced `PATCH` at 800 ms, because the board
      reports on every keystroke of a points field and an unthrottled request per keystroke
      would be both wasteful and racy — the last *response* would win rather than the last
      *edit*.
- [x] **4.4.2** If yes: wire `InteractiveSprintBoard` to the `PATCH` from 3.5.5, debounced.
- [x] **4.4.3** Confirm `client-recalc.ts` still runs on the loaded board — the arithmetic
      stays in code, never in stored state.
- [x] **4.4.4** Show save state (saving / saved / failed). Silent persistence that
      occasionally fails is worse than no persistence.
- [x] **4.4.5** Verify a second user cannot patch the first user's board.

### 4.5 Frontend hygiene

- [x] **4.5.1** No new client component imports `src/lib/db.ts` or server-only exports of
      `src/auth.ts`.
- [ ] **4.5.2** Decide on the React hydration #418 fix (known finding #3). The fix trades a
      console error for a language flash on load. **Owner's decision — still open.**
- [x] **4.5.3** Confirm every new component has a matching CSS Module rather than inline
      styles — the CSP allows inline styles, but consistency is the reason the codebase is
      readable.
- [x] **4.5.4** Confirm no component grew past the point where its state should move up.
      `page.tsx` orchestrates state; components render it.

---

## Module 5 — Integration — wiring it together

The seams. Each is a place where two correct halves make one broken whole.

- [x] **5.1.1** End to end by hand: signed out → signed in → generate → view → sign out. In
      both locales and both themes. **Done** — including the reopened-plan path, checked in
      `ar`/dark and `en`/light.
- [x] **5.1.2** Confirm the frontend's error parser handles every code. **All 13**:
      `UNAUTHORIZED`, `VALIDATION_ERROR` and `OUT_OF_DOMAIN` are handled explicitly; the
      other ten fall to the "explain and offer retry" shape, which is the right one for each.
      Two codes are new since this step was written — `NOT_FOUND` and `STORAGE_UNAVAILABLE`.
- [x] **5.1.3** Confirm the response headers the UI depends on still arrive.
      `X-Provider-Used`, `X-Prompt-Version` and the new `X-Plan-Id`, all three present.
      A fourth joined them in A3: `X-Cache` (`hit` / `miss`). The UI does not read it — it
      exists so a cache hit is distinguishable from a generation, since `X-Provider-Used` on
      a hit names the tier that answered the *original* request.
- [x] **5.1.4** Confirm provider failover still works with auth in play. **Verified** —
      with `NVIDIA_API_KEY` empty and a session present, `groq` answered.
- [x] **5.1.5** Confirm the deterministic boundary survived the round trip. **This step
      found the module's real bug.** Board persistence was write-only — nothing read `board`
      back — so it was half a feature and unverifiable. Building the load path
      (`/scopecraft/history/[id]`) then exposed the actual defect: a reopened plan showed the
      saved **13 points** beside **"Score 2.00"**, the score computed when it was 5. Derived
      values were being replayed instead of recomputed, which is precisely the second-source-
      of-truth failure the storage design exists to prevent. Fixed by seeding the live scores
      from the saved edits; the same story now reads **13 points, Score 0.46, Won't** —
      predicted before the test, then observed.
- [x] **5.1.6** Confirm `committed_points <= capacity_points` on freshly captured **live**
      results. Verified against the stored rows: 21/30 and 20/30.
- [x] **5.1.7** Confirm the app behaves sanely when the **database is down**. **It did
      not.** `POST /api/scopecraft` returned an untyped `500` with an empty body, bypassing
      the whole error contract, and `/scopecraft/history` served the framework's crash page.
      Both fixed: the quota check now **fails closed** with a typed `503 STORAGE_UNAVAILABLE`
      — generating anyway would mean "when the database is down this endpoint is unmetered",
      which is the exact property Module 3 removed — and the history page degrades to an
      error card with the header and navigation intact.
- [x] **5.1.8** Confirm the app behaves sanely when **all three providers** are down.
      `502 PROVIDER_ERROR`, and the attempt is recorded as a `failed` row so it still counts
      against the quota.
- [x] **5.1.9** Confirm the CSP still permits everything the new UI does. **Zero CSP
      violations** on `/scopecraft/history` and `/scopecraft/history/[id]`. The only console
      error is the pre-existing React #418.
- [x] **5.1.10** Confirm a **cold start** works: the first request after a deployment does
      the database connection and the auth check for the first time. Measured at **4.2 s**
      end to end, which is dominated by the model call, not by the connection.
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

- [x] **6.3.1** **Decision — ANSWERED, and not the way this step proposed.** No Jest
      integration project. The three things mocks cannot cover are now asserted by
      `npm run db:check`, which already existed — no new framework, no Docker dependency in
      CI, and one property a local suite could never have: **it runs against production too**,
      which is what 14.3.3 asks for. Each check does the forbidden thing inside a transaction
      that is always rolled back, so it is safe to point at a live database.
- [x] **6.3.2** Not applicable — no separate project was created. See 6.3.1.
- [x] **6.3.3** Covered by `db:check`: `plans_status_check`, `plans_ok_has_response`,
      `plans_user_id_fkey`, `users_email_key`, and the index's existence. **Not** covered:
      concurrent writes, and the planner's *choice* of index — see 6.6.2 for why the second
      one is deliberate.
- [x] **6.4.1** Confirmed broken exactly as predicted, then fixed.
- [x] **6.4.2** The capture signs in the way a person does, with a real cookie minted from
      `AUTH_SECRET`. **No bypass flag** — that would be a production switch living in the
      route forever, guarded only by the hope nobody sets the variable.
- [x] **6.4.3** `scripts/mint-session.mjs` — one implementation, imported by the Node
      capture and shelled out to by the bash one. It also upserts a real `users` row, because
      `plans.user_id` is a foreign key: a cookie whose `uid` matches no row passes the session
      check and then fails every insert, so the capture would record 200s that never
      persisted. **The API capture now needs Postgres**, and says so when it is missing.
- [x] **6.4.4** Added — `anonymous request is refused → 401`.
- [x] **6.4.5** Added as Scenario 7, its own server because `DAILY_PLAN_LIMIT` is read once
      at module load: first request serves, second returns `429`.
- [x] **6.4.6** Both captures re-run end to end. **API: 14/14 scenarios pass**, secret scan
      clean, committability guard clean. **UI: 17 screenshots**, 19 contrast pairs with none
      below AA in either theme, 0 unnamed controls, 0 heading skips, and no horizontal
      overflow at any of six viewport/direction combinations.
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

- [ ] **6.6.1** Produce a coverage map: what each suite covers, in one table. Belongs in
      `docs/qa-test-plan.md` (11.4.4), not here.
- [ ] **6.6.2** Name what is **not** covered and why. Started, in 6.3.3 — the honest one is
      that `db:check` asserts the index **exists** rather than that the planner **uses** it.
      The first version asserted the plan and failed on an empty database, correctly: a
      sequential scan over zero rows is the cheaper plan. Asserting a planner decision means
      asserting the table's size, which is not a property of the schema.
- [x] **6.6.3** **Decision — ANSWERED: no threshold.** On a project this size a coverage
      percentage produces tests written to satisfy a number rather than to catch a defect.
      Every real bug found in Modules 3–6 — the eager `DATABASE_URL` read, the replayed board
      score, the silent Zod strip, the untyped 500 on a database outage — was found by
      running the thing, not by an uncovered line. Recorded as a deliberate omission.

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
      worst-case total latency is bounded by `AI_TOTAL_BUDGET_MS` rather than by
      3 × `AI_TIMEOUT_MS`, so it no longer grows with the number of tiers.
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
- [x] **7.5.6** Attack the `PLANNING_ERROR` intermittency (known finding #4, 4 of 9 live
      runs). **Done 2026-08-28.** The guessed cause was close but wrong in a way that
      mattered: the dangling edges were not references to stories the model forgot to
      emit, they were **prose** — `"User authentication"`, `"Profile data"` — the model
      answering "what does this depend on" in English. Measured 1 failure in 12 live
      generations, with all 8 rejected edges prose. Fixed on both sides: prompt v6 states
      that `dependencies` holds ID cross-references, and `service.ts` drops unresolvable
      edges before planning. **Verified 10/10 clean across all three providers**, with
      zero prose edges in the raw-output probe.

---

## Module 8 — Security

- [x] **8.1.1** Bundle secret scan after a fresh build. **Clean.** Scanned the actual
      values of all 7 secrets in `.env.local` — not just their prefixes — against both
      `.next/static` and `.next/server`. No match in either.
- [x] **8.1.2** Grep the whole tree for `NEXT_PUBLIC_`. **Zero.** The only two hits are
      comments in `.env.example` forbidding it.
- [x] **8.1.3** Git history secret scan across all branches. **Clean across 49 commits.**
      Searched every reachable revision for provider key prefixes, credentialed Postgres
      URLs, GitHub tokens and PEM private keys. Every hit was the local Docker placeholder
      `scopecraft:scopecraft@localhost`. No Neon host or credential has ever been tracked.
- [x] **8.1.4** Confirm every database query is parameterised. **All 12 call sites** across
      `src/` and `scripts/` are tagged templates. No string concatenation, no `sql.unsafe`.
- [x] **8.1.5** Confirm every user-scoped query takes `user_id` from the session. **All four**
      (history list, history detail, board `PATCH`, quota) filter on a `userId` read from
      `auth()`. The `PATCH` and detail queries scope by session id *and* row id, so another
      account's plan is a 404 rather than a leak.
- [x] **8.1.6** Re-verify all six security headers on the **live** deployment. **All six
      present**, on both a page and `/api/scopecraft`. **Finding: only five are ours.**
      `Strict-Transport-Security` is added by Vercel, not by `next.config.js`, so the
      container image serves five headers and loses HSTS silently. Recorded in
      [`security-review.md`](security-review.md).
- [x] **8.1.7** Confirm `X-Powered-By` is still absent. **Absent** on the live response.
- [ ] **8.1.8** Confirm the session cookie is `httpOnly`, `sameSite=lax`, and `secure` in
      production. **Mostly verified 2026-09-03; the last step needs a sign-in.** The old
      blocker — no auth in production — is gone. `src/auth.ts` sets no `cookies` override, so
      Auth.js defaults apply to every cookie it issues, and the two it issues to an
      anonymous caller were read live off `GET /api/auth/csrf`:

      ```
      __Host-authjs.csrf-token=…;   Path=/; HttpOnly; Secure; SameSite=Lax
      __Secure-authjs.callback-url=…; Path=/; HttpOnly; Secure; SameSite=Lax
      ```

      All three attributes correct on both, and the `__Host-` prefix is browser-enforced —
      it cannot be set without `Secure` and `Path=/`, so production is demonstrably in
      secure-cookie mode. **Left unticked deliberately:** the *session* cookie is only issued
      after a successful OAuth callback, so it was not observed. It comes from the same
      default config as the two above, but inferred is not measured. Ticking this needs one
      browser sign-in and a look at `__Secure-authjs.session-token`.
- [x] **8.1.9** Confirm CSRF protection is active on the auth routes. **Verified live
      2026-09-03, both directions.** A sign-in `POST` with no CSRF token is rejected by name:

      ```
      POST /api/auth/signin/github  (no token)   302 → /login?error=MissingCSRF
      POST /api/auth/signin/github  (cookie+token) 302 → github.com/login/oauth/authorize
      ```

      The negative case alone would not prove much — everything on that route answers `302`.
      The positive case is what makes it evidence: the same request with a matching
      `__Host-authjs.csrf-token` cookie and form token proceeds to the provider. Double-submit
      is enforced, not merely issued. The authorize URL also carries
      `code_challenge_method=S256`, so PKCE is on.
- [x] **8.1.10** Confirm error responses leak nothing on **every** path. **All 21 `fail()`
      sites** across both routes reviewed. Every message is a static string; the only
      interpolations are the quota limit and count, both integers. Zod issues are mapped to
      `{path, message}` with no `received` value. Server logs carry `error.name` only, never
      the error object.
- [ ] **8.1.11** Docker. **Partly done — three of four pass, the fourth fails.**
      Non-root **verified** (`uid=1000(node)`), no `.env*` anywhere in the image
      **verified**, no secret in the layer history **verified**. But `docker scout` found
      **16 critical/high CVEs**: 9 inside npm's own vendored tree and 7 in the base image's
      `openssl`, none in this project's dependencies. The runner stage now removes `npm`,
      `npx` and `yarn`, **but that change is unverified** — the daemon cannot reach Docker
      Hub to rebuild. Stays open until the rebuild runs.
- [x] **8.1.12** `npm audit`. **Zero vulnerabilities**, with and without dev dependencies.
      This supersedes the two ESLint-chain advisories in `security-review.md`, which have
      since been resolved upstream.
- [x] **8.1.13** Confirm dependency count is still six. **Six:** next, next-auth, postgres,
      react, react-dom, zod. An uncommitted seventh (`@neondatabase/neon-js`) had appeared
      from outside the session with nothing importing it; removed.
- [x] **8.1.14** Re-read [`security-review.md`](security-review.md) and correct what went
      stale. **Done:** the dev-dependency advisories are marked resolved, and two new
      sections cover the container image scan and the five-versus-six header finding.
- [x] **8.1.15** Confirm the CSP `script-src 'unsafe-inline'` weakness is still recorded.
      **Recorded in three places** — the sourcing table, the open-risks table (row 11), and
      decision-log item 11 — each stating the cost and why it was accepted.

---

## Module 9 — Performance & reliability

- [x] **9.1.1** Confirm the database adds exactly the round trips expected. **Measured, not
      reasoned about:** `log_statement='all'` on the local container, then four authenticated
      generations. Three requests produced **exactly six queries** — one quota `count`, one
      `insert into plans`, per request. **Zero `insert into users`**, so `token.uid` is doing
      its job. The driver's array-type introspection against `pg_catalog.pg_type` runs once
      on the first connection and never again.
- [x] **9.1.2** Confirm connection pooling behaves under repeated requests. **One backend
      connection** held across four requests (`pg_stat_activity`), matching `max: 1` in
      `src/lib/db.ts`. No per-request connect/disconnect churn.
- [x] **9.1.3** Note which routes are now dynamic rather than prerendered. **Two static, seven
      dynamic.** Only `/` and `/_not-found` prerender. `/scopecraft`, `/login`,
      `/scopecraft/history`, `/scopecraft/history/[id]` and the three API routes are dynamic
      because they read the session cookie. That is the price of requiring a session, and it
      is visible live: production still serves `/scopecraft` as a cached prerender because it
      is running the pre-auth build.
- [x] **9.1.4** Confirm the client bundle did not grow meaningfully. **+6 KB, about 2%.**
      Production still runs the pre-auth build, so it served as the baseline: the same page's
      JS is **266 KB gzipped live (8 chunks)** against **272 KB on the current build (10
      chunks)** — for auth, plan history and board persistence together.
- [x] **9.1.5** Record Docker image size and cold-start time. **270 MB**, first `200` from a
      cold `docker run` in **0.47 s**. Measured against the pre-hardening image; the npm/yarn
      removal in 8.1.11 should shrink it, but that rebuild is still blocked.
- [x] **9.1.6** Measure end-to-end generation latency **on the live site**. ~~Not done, and
      not faked from local numbers.~~ **Done 2026-09-04.** Local numbers on current code, kept
      as the comparison: four generations at **10.8 s, 11.3 s, 13.5 s, 13.6 s** against a
      local database.

      **Blocker replaced 2026-09-03 — the original one is gone.** This item used to say the
      deployed build predated the auth work, so any live figure would describe an artifact
      the next push replaced. That push has happened: `dev` was merged and pushed to both
      remotes, and production now runs the auth build.

      It is still blocked, for a different and narrower reason. `POST /api/scopecraft`
      checks the session first and answers `401` to an anonymous caller, so no unauthenticated
      request can generate anything. A session minted locally by `scripts/mint-session.mjs`
      does not verify against production either — all four Auth.js cookie names return `401`,
      which means production's `AUTH_SECRET` is not the local one. That is correct security
      hygiene, not a fault, and it is not something to work around.

      **What would unblock it:** a real session cookie taken from a browser sign-in on the
      live site by whoever holds the account. Four timed generations would then finish this
      item against the local baseline above. Know the cost before running it — four rows in
      the production `plans` table and four real provider calls.

      **Measured 2026-09-04**, through a real browser session held by the account holder.
      Four generations, four **distinct** ideas — a repeated idea would now be answered by
      the A3 cache and would not be a generation at all:

      | # | Idea | Elapsed | `x-cache` | Served by |
      |---|---|---|---|---|
      | 1 | shared grocery list for flatmates | **21.47 s** | miss | `groq` |
      | 2 | microservice / shared-library dependency tracker | **21.61 s** | miss | `groq` |
      | 3 | lab equipment booking with per-department quotas | **20.58 s** | miss | `groq` |
      | 4 | changelog generator from merged pull requests | **19.03 s** | miss | `groq` |

      **Live mean 20.67 s** (range 19.03–21.61) against a **local mean of 12.30 s** (range
      10.8–13.6). Live is **1.68× slower**, and notably *tighter* — a 2.6 s spread against
      the local 2.8 s on a higher base. All four returned `200`.

      A cached repeat returned in **0.61 s**. That is a cache hit, not a generation, and is
      deliberately excluded from the mean.

      **The inference this produced was tested, and it was wrong.** The reading recorded here
      was that no live generation approached the ~30 s ceiling a timing-out NVIDIA tier
      produces, which looked like a *skipped* tier and therefore a missing key. Reading
      `attempts` off the production rows on 2026-09-04 says otherwise: all five recent
      generations are `attempts=2` with `provider_used=groq`, so **NVIDIA was called and
      failed** on every one. The key is present in Vercel and is being rejected.

      Two corrections follow. The ~30 s timeout is only one of NVIDIA's failure modes — the
      dev rows show it *succeeding* as primary at 15.1 s and 28.5 s — so the ceiling argument
      never held. And the live mean of 20.67 s above **includes a wasted provider round trip
      on every request**, which the local baseline of 12.30 s does not necessarily carry.
      The 1.68× gap is therefore not a clean local-versus-live comparison; part of it is a
      failing tier. See `HANDOFF.md` §4.1.

      **Re-measured after the fix, same day, four runs against four.** `NVIDIA_API_KEY` was
      removed from Vercel and the project redeployed, so the tier is skipped instead of tried.

      | Configuration | n | `attempts` | `duration_ms` | mean | range |
      |---|---|---|---|---|---|
      | Live, NVIDIA configured and failing | 5 | 2 | 18618 / 19892 / 19814 / 19777 / 19840 | **19588** | 1274 (7%) |
      | Live, NVIDIA removed | 4 | 1 | 5332 / 5640 / 3395 / 4391 | **4690** | 2245 (48%) |
      | Local baseline, above | 4 | — | 10800 / 11300 / 13500 / 13600 | **12300** | 2800 (23%) |

      The wasted attempt was worth **~14.9 s per request, 76% of the total**. Production is
      **4.18× faster** than it was and **2.6× faster than the local baseline** — local still
      has NVIDIA configured and still pays for it.

      **Relative variance got worse, not better.** The pre-fix band was 7% of its mean because
      a fixed ~15 s cost dominated; post-fix it is **48%**. Absolute spread is comparable
      (1274 ms → 2245 ms); what changed is that Groq's own variability is no longer hidden
      behind something large. Quote the mean with its range.

      **The 20.67 s figure above stands as recorded and is now historical.** It was the real
      live mean on the contaminated configuration — what the site actually served that
      afternoon — and is not deleted.

      **Final configuration, and the reason the middle row above is also historical.** Deleting
      NVIDIA was the blunt fix for a misdiagnosis; the real cause was ordering, not a broken
      credential. With `PRIMARY_AI_PROVIDER=groq` and NVIDIA restored as the third tier:
      **3 runs, `attempts=1` on every one, `duration_ms` 5512 / 3358 / 3811, mean 4227 ms.**
      That is **4.63× faster than the broken configuration**, 462 ms faster than the two-tier
      state — inside the noise, so no measurable cost for keeping the tier — and **2.91×
      faster than the local baseline** in this item, which still runs NVIDIA first.
      Decision-log entry 50 supersedes 49.

- [x] **9.1.7** Confirm the app degrades rather than crashes. **All four exercised for real.**
      *Database down* (container stopped): `503 STORAGE_UNAVAILABLE` in **8 ms**, failing
      closed before any provider call, and `/scopecraft/history` still answered `200` with an
      error state rather than crashing. *One provider down*: observed repeatedly — NVIDIA
      times out or returns unusable output and Groq or Gemini serves the request. *All
      providers down* (three invalid credentials): `502 PROVIDER_ERROR` in **1.8 s**, with
      provider names in the server log and absent from the response body. *Session missing or
      tampered*: `401 UNAUTHORIZED` for both, identically.
- [x] **9.1.8** Confirm nothing unbounded was introduced. **Checked each class.** Queries:
      history is `limit 50`, quota is a `count` over a 24-hour window, the other two address a
      single row by primary key. Loops: the only `while (true)` is the body reader, bounded by
      `MAX_REQUEST_BODY_BYTES` with a `reader.cancel()`; the sprint packer removes one story
      or throws each pass. Retries: exactly one, on schema violation. The provider loop is
      bounded by three tiers **and**, since `d00282c`, by `AI_TOTAL_BUDGET_MS`.

---

## Module 10 — Accessibility & internationalisation

A graded row in its own right, not a subsection of the frontend.

### 10.1 Measured

- [x] **10.1.1** `npm run capture:ui` green. **17 screenshots, all six LTR/RTL overflow checks
      clean.** Ran twice — before and after the i18n fix below. The header now reports **1**
      generation attempt where it used to report up to four, which is independent confirmation
      of the `PLANNING_ERROR` fix from a script that knows nothing about it.
- [x] **10.1.2** Every contrast pair at or above AA in both themes. **19 pairs per theme, 0
      below AA.** Lowest is 4.87:1 on the 11px "Live" badge, against a 4.5 threshold.
- [x] **10.1.3** Zero controls without an accessible name. **0 of 15**, both themes. The count
      rose from 14 to 15 with the history link.
- [x] **10.1.4** Zero skipped heading levels; landmarks present; exactly one `h1`. **Measured
      in both themes:** heading levels 1 and 2 with 0 skips, `banner` and `main` both present,
      `<h1>` count exactly 1.
- [x] **10.1.5** Update the measured-results table in
      [`accessibility-checklist.md`](evidence/ui/accessibility-checklist.md). **Four stale
      numbers corrected:** controls 14 → 15, keyboard-reachable 14 → 15, tab order "13 of 13"
      → 15 of 15, and the skip-link clearance 59px → 73px.

### 10.2 Internationalisation

- [x] **10.2.1** Every new string exists in `en` **and** `ar`. **175 keys each, exact parity**,
      nothing missing in either direction.
- [x] **10.2.2** Read both locales on screen. **Done by reading the rendered Arabic page, not
      the dictionary** — which is how the `d` bug below was found, since it was a literal in
      JSX rather than a key and no type check could see it.
- [x] **10.2.3** Confirm Arabic register stays Modern Standard. **Holds.** The tagline,
      form labels and hints all read as MSA product/agile vocabulary, matching the existing
      copy rather than drifting colloquial.
- [x] **10.2.4** Confirm product names keep `translate="no"`. **Present on the header brand,
      and confirmed on screen:** "ScopeCraft" renders untranslated in both the header and the
      `h1` on the Arabic page.
- [x] **10.2.5** Confirm numbers, dates and capacity readouts render correctly in RTL. **One
      real bug found and fixed.** The preset badges rendered `14d` — an English day unit
      hardcoded as a JSX literal, so it had no `ar` entry and the type system could not catch
      it. Moved into the dictionary as `form.presets.meta`; the Arabic badges now read
      `30 · 14 يوم`, verified in the re-captured screenshot. Digits are Western in both
      locales, consistently, and the capacity slider mirrors correctly.

### 10.3 The RTL rules

- [x] **10.3.1** Grep all new CSS for physical offsets. **Zero across every CSS module** —
      no `left:`/`right:`, no `margin-left`/`padding-right`, no four-value `border-radius`
      shorthand.
- [x] **10.3.2** Confirm every viewport is measured in **both** directions. **Six checks:**
      1280 / 768 / 390px, each in `en/ltr` and `ar/rtl`. No horizontal overflow in any of
      them.
- [x] **10.3.3** Confirm decorative marks do not mirror. **Nothing mirrors anywhere:** no
      `scaleX`, no `rotateY`, no `[dir="rtl"]` transform override in any CSS module. The SC
      badge is upright in the Arabic screenshot.

### 10.4 Not verified — do not claim these

- [x] **10.4.1** Keep the honest "not verified" section current. **Still accurate, still five
      items**, and none of this pass's work touched them: no screen-reader run, no
      axe/Lighthouse scan, contrast on rendered text only, no 200%/400% zoom test, no
      colour-blind simulation. Nothing was quietly promoted to "verified".

---
---

# Part III — Document & ship

---

## Module 11 — Documentation

**39 documents.** 30 exist, 9 do not. Status is honest, not aspirational.

Legend: **✅ current** · **⚠️ exists but stale or incomplete** · **❌ missing**

### 11.1 Register — what exists

| # | Category | Document | Path | Status | Action |
|---|---|---|---|---|---|
| 1 | Entry | Project README | `README.md` | ⚠️ | 11.3.1 |
| 2 | Entry | Session handoff | `HANDOFF.md` | ✅ rewritten 2026-09-04 at `31ed8ae` | — |
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
| 21 | Evidence | UI evidence | `docs/evidence/ui/ui-evidence.md` | ✅ 22 screenshots | 11.3.9 |
| 22 | Evidence | Accessibility checklist | `docs/evidence/ui/accessibility-checklist.md` | ✅ measured | 10.1.5 |
| 23 | Evidence | Raw captures | `docs/evidence/raw/` | ✅ | 6.4.6 |
| 24 | Evidence | Request-cache evidence | `docs/evidence/cache-evidence.md` | ✅ dev + production | 3.4b.7 |
| 25 | Historical | Session 1–4 lead checklists | `docs/session[1-4]-lead-checklist.md` | ✅ dated records | **do not rewrite** |
| 26 | Historical | Completion checklist | `docs/scopecraft-completion-checklist.html` | ✅ superseded banner intact | **do not rewrite** |

### 11.2 Register — what is missing, and why each is needed

| # | Category | Document | Proposed path | Why it is needed |
|---|---|---|---|---|
| 26 | Environment | ~~**Local development guide**~~ **WRITTEN 2026-08-27** | `docs/local-development.md` | ✅ Done in 1.3.4 — setup, the host/container split, evidence captures, five troubleshooting entries |
| 27 | Environment | **Deployment guide** | `docs/deployment.md` | The fork-deploy trap lives only in `HANDOFF.md` and `CLAUDE.md`, neither team-facing |
| 28 | Environment | **Environment variables reference** | `docs/environment-variables.md` | Eleven variables across three concerns; the README table is outgrowing itself |
| 29 | Frontend | ~~**Frontend architecture**~~ **WRITTEN 2026-09-04** | `docs/frontend-architecture.md` | ✅ Done in 11.4.2 — routes, component tree, the seven-state union, the pre-paint scripts, the `.dark` decision, the token/CSS-Modules model, the breakpoint audit, RTL, the client/server boundary, and what is not covered |
| 30 | QA | **QA & test plan** | `docs/qa-test-plan.md` | 508 tests with no document saying what is covered, what is not, and how manual QA runs |
| 31 | QA | **Manual QA evidence** | `docs/evidence/qa/` | 6.5 produces findings with nowhere to live |
| 32 | Operations | **Runbook / troubleshooting** | `docs/runbook.md` | What to do when providers fail, the database is down, or sign-in breaks. Every known finding is a runbook entry |
| 33 | Submission | ~~**Known limitations**~~ **WRITTEN 2026-09-03** | `docs/known-limitations.md` | ✅ Done in 11.4.5 — 19 entries, each Accepted (a weighed trade-off) or Open (a real gap with an owner and a next step), with a sign-off block |
| 34 | Submission | ~~**Demo script**~~ **WRITTEN 2026-09-03** | `docs/demo-script.md` | ✅ Done in 11.4.7 — a timed 3:00 running order, the recovery paths, the questions, and the five claims not to make |
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
- [ ] **11.3.2** `docs/architecture.md` — pipeline diagram gains stage 0, stage 4b and stage 4c; §4a
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

Ordered by value. Four of the thirteen are written; not all of the rest have to ship — but skipping one should be a decision, not
the result of running out of time. **Write 11.4.1–11.4.5 first; treat the rest as optional.**

- [x] **11.4.1** `docs/local-development.md` — prerequisites, `docker compose up`, the host
      vs container decision from 1.3.3, how to run the evidence captures (and why the UI one
      must run on the host), common failures. **Done 2026-08-27** (1.3.4).
- [x] **11.4.2** `docs/frontend-architecture.md` — **the highest-value missing document.**
      Component tree; the seven-state discriminated union and why it is a union; the
      theme/locale pre-paint scripts and why they are blocking; the CSS Modules + custom
      properties model; the `.dark` class decision over `prefers-color-scheme`; the RTL
      rules; the client/server boundary; where state lives and why. **Done 2026-09-04.**
      13 sections, written from the source rather than from memory — the rationale it
      quotes is the rationale already in the file headers (`layout.tsx` on theming,
      `Dialog.tsx` on the native element, `Card.module.css` on per-theme elevation,
      `css.ts` on why the token CSS is generated, `breakpoint-audit.test.ts` on why the
      audit is a test).

      §12 states what is *not* covered and cross-links `known-limitations.md`: no
      screen-reader run, no real-device test, hydration #418, the two `unsafe-inline` CSP
      directives, no visual-regression testing, no hover state exercised anywhere, and the
      fact that a page-level view transition forbids per-element ones beneath it. The
      `prefers-reduced-motion` entry that stood here was closed by Module E1 on 2026-09-04
      and is struck through in place rather than deleted.

      **Authorship.** H4 marks this row formally Joe's and says not to write it on his
      behalf. Written by Yousef on the owner's decision, and recorded as such in
      `docs/contribution-matrix.md` — the components it describes stay credited where they
      were built.
- [ ] **11.4.3** `docs/deployment.md` — the fork trap in plain language, Vercel environment
      variables, what Docker is and is not for, how to roll back.
- [ ] **11.4.4** `docs/qa-test-plan.md` — the two (or three) Jest projects and why, what
      each suite covers, what is deliberately not covered, how manual QA runs, how evidence
      is captured. Records the 6.5 pass and the 6.6 coverage map.
- [x] **11.4.5** `docs/known-limitations.md` — consolidate every honest limitation into one
      document the rubric can point at, with a sign-off line each: the open API endpoint if
      it stays open, per-IP abuse, session revocation, the domain-classifier gap, estimate
      quality, `PLANNING_ERROR` intermittency, no screen-reader run, CSP `unsafe-inline`.
      **Done 2026-09-03.** 19 entries across security, AI behaviour, accessibility, testing
      and platform. Two of the listed items had changed under the brief and are recorded as
      changed rather than copied across: the API endpoint is **not** open — it returns `401`
      before reading a body — and `PLANNING_ERROR` was fixed on 2026-08-27, so neither is a
      live limitation.

      Writing it found one nobody had named: `getClarification` tokenises with `/[a-z]+/g`,
      so **Arabic input produces zero tokens and skips the pre-provider gibberish guard
      entirely**, going straight to a paid generation. Verified 2026-09-03. Entry 9, Open.

      The split that makes the document worth having is **Accepted** (weighed and chosen,
      with the reasoning) versus **Open** (a real gap with an owner and a next step). An
      accepted entry with no reasoning behind it is a bug in the document.
- [ ] **11.4.6** `docs/runbook.md` — symptom → cause → fix, seeded from the nine known
      findings in `CLAUDE.md` §9.
- [x] **11.4.7** `docs/demo-script.md` — three minutes, timed, rehearsed against the live
      site. What to show, in what order, what to say when a provider is slow.
      **Written 2026-09-03. Not yet rehearsed** — the timings are budgeted against the real
      bounds (30 s per provider attempt, 50 s for the chain) rather than measured with a
      stopwatch, and the document says so. Rehearsing it is the remaining half.

      Two structural choices worth keeping. The generation is started at 0:35 and the
      AI/human boundary explanation runs 0:50–1:30 **over** it — that explanation is the
      demo's central claim and it is also exactly long enough to cover the full 50-second
      budget, so the worst case has no dead air. And a saved plan is opened in a second tab
      before the demo starts: every beat from 1:30 on works identically on a saved plan, so
      a provider failure costs one beat rather than the demo.

      It closes on a named gap — no screen-reader run — rather than a flourish, and carries a
      *What not to claim* list of five sentences an examiner could falsify on the spot.
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
      0.3.1, ~~1.3.3~~ (logged as entry 14), 2.1.4, 2.3.7, 3.1.5, 3.3.4, 4.3.1, 4.4.1, 6.3.1,
      6.6.3, 12.2.1. An
      answered decision with no record is an argument that will be had again.
- [ ] **11.6.4** **The truthfulness sweep.** Re-read `README.md`, `architecture.md` and
      every checklist in `docs/` against the running app. Untick anything no longer true.
      This is the single highest-yield audit in this repository — the README once claimed
      "not yet deployed" while the site was live.
- [ ] **11.6.5** Update `HANDOFF.md` **last**, after everything else.
- [x] **11.6.6** Verify the five numbers that drift and appear in ~6 files each: **test
      count, screenshot count, dependency count, branch heads, commit SHAs.**
      **Swept 2026-09-04.** Test count consistent at **508** across 7 files. Dependency count
      consistent at **six** across 5 files. Branch heads and SHAs refreshed in `HANDOFF.md`.
      **Screenshot count had drifted:** four places in `upgrade-checklist.md` still said 17.
      They are dated verification records — the contrast-pair figures in them match that era
      too — so the original numbers were annotated rather than overwritten, which would have
      falsified what those runs actually produced. Current count is **22**.
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

## Module 14 — Deployment & release

The one module where a mistake is visible to everyone. It is last because everything else
has to be true first, and it is detailed because the deploy path for this project is not the
obvious one.

### 14.1 The deploy path, and the trap in it

```
origin  = nourmonabil17/ScopeCraft   team repo — reviews, PRs, history
fork    = mr-h12/ScopeCraft          what Vercel actually builds, branch main
```

**Vercel deploys from the FORK, branch `main`.** Pushing to `origin` alone updates the team
repository and changes nothing about the live site. Both pushes, every time:

```bash
git push origin dev && git push fork dev:main
```

**Docker is not on this path.** Vercel does not build from the `Dockerfile`; it runs
`next build` against `next.config.js`, the same file the image uses. Shipping the image
ships nothing to production. Anything changed for the container — `output: "standalone"`
above all — has to be verified against the Vercel build, not assumed compatible.

- [ ] **14.1.1** Confirm both remotes are configured and point where this says.
- [ ] **14.1.2** Confirm the Vercel project is connected to the **fork**, branch `main`.
- [ ] **14.1.3** Note that the Vercel MCP tools authenticate as an account that cannot see
      this project. Use the dashboard or `curl` against the live URL; do not retry that path.

### 14.2 Environment — everything that must exist before the first deploy

Eleven variables across three concerns. A missing one fails differently in each case, and
two of them fail *silently*, which is worse.

- [ ] **14.2.1** `AUTH_SECRET` — `npx auth secret`. Missing: every request is unauthenticated
      and the site bounces to `/login`. **This is the current state of production.**
- [ ] **14.2.2** `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — from a GitHub OAuth app whose
      callback is exactly `https://scope-craft-nine.vercel.app/api/auth/callback/github`.
- [ ] **14.2.3** `AUTH_URL=https://scope-craft-nine.vercel.app` — pins the callback origin so
      a forged `Host` header cannot redirect the OAuth flow.
- [ ] **14.2.4** `DATABASE_URL` — Neon's **pooled** string (2.3.3). Production branch for
      Production, `dev` branch for Preview.
- [ ] **14.2.5** At least one provider key. **A missing provider key is *skipped*, not
      failed** — that is why known finding #5 was diagnosable at all, and why three
      production generations were served by Groq and Gemini and never NVIDIA.
- [ ] **14.2.6** `DAILY_PLAN_LIMIT` — optional, defaults to 20.
- [ ] **14.2.7** Set every one of them for **Production and Preview**. A Preview deployment
      with no `AUTH_SECRET` is a broken PR review nobody can use.
- [ ] **14.2.8** Confirm not one of them has a `NEXT_PUBLIC_` prefix. That prefix inlines the
      value into the client bundle permanently — a rotation does not undo a leak that has
      already been served.

### 14.3 Deploying the database

The database is deployed **before** the application, not with it. An app that starts against
a schema-less database fails on the first generation; a schema with no app is inert.

- [x] **14.3.1** Applied to both Neon branches on 2026-08-27.
- [x] **14.3.2** Verified against both branches — PostgreSQL 18.6, both tables present.
- [x] **14.3.3** **Confirmed in production.** All four constraints were watched to reject on
      the Neon `production` branch, inside transactions that rolled back. This is the property
      no local test suite could have given, and the reason 6.3.1 put the assertions in
      `db:check` rather than in Jest.
- [ ] **14.3.4** Order matters for the first deploy: schema → environment variables → push.
      Getting it backwards means the first visitor hits a `503 STORAGE_UNAVAILABLE`.

### 14.4 Pre-flight — everything green before pushing

- [ ] **14.4.1** `npm run typecheck`
- [ ] **14.4.2** `npm run lint`
- [ ] **14.4.3** `npm test`
- [ ] **14.4.4** `npm run build`
- [ ] **14.4.5** Both evidence captures green.
- [ ] **14.4.6** `docker compose up --build` from a cold start.
- [ ] **14.4.7** Bundle secret scan clean — grep the built client bundle for every key
      pattern **and** for `postgres://`.
- [ ] **14.4.8** CI green on `dev`.
- [ ] **14.4.9** `git status` clean apart from the known-untracked handbook folder. Never
      `git add -A` without looking first.
- [ ] **14.4.10** No `Co-Authored-By` trailer on any new commit:
      `git log origin/dev..dev --format=%B | grep -i co-authored` returns nothing.

### 14.5 The push

- [ ] **14.5.1** `git push origin dev`
- [ ] **14.5.2** `git push fork dev:main` — **this is the one that deploys.**
- [ ] **14.5.3** Watch the Vercel build. A build that succeeds locally can still fail there:
      the environment differs, and `next build` evaluates route modules — which is exactly
      how an eager `DATABASE_URL` read broke the build in Module 3.

### 14.6 Post-deploy verification — against the live site, not localhost

- [ ] **14.6.1** Sign in with GitHub. Confirm the header shows your name.
      **Half-met 2026-09-04 and left open on purpose.** A sign-in on the live site did
      happen and the header showed the account name, but *which* provider was used was not
      observed, and this item names GitHub specifically. Ticking it would be a guess.
- [x] **14.6.2** Generate a plan. Confirm `X-Provider-Used`, `X-Prompt-Version` and
      `X-Plan-Id` all arrive. **Done 2026-09-04** on a live signed-in generation:
      `x-provider-used: groq`, `x-prompt-version: v7`,
      `x-plan-id: cb53652a-e46e-4e62-807d-69c8ef127689`, plus the new `x-cache: miss`.
- [ ] **14.6.3** Edit the sprint board, reload the plan from history, confirm the edit
      survived **and** that the score recomputed rather than replayed.
- [ ] **14.6.4** Confirm a row landed in the Neon database, attributed to the right user.
- [x] **14.6.5** `curl` the endpoint with no cookie — expect `401`, not a plan.
      **Done 2026-09-04** against production: `401` with
      `{"error":true,"code":"UNAUTHORIZED","message":"Please sign in to generate a plan."}`
      and no plan fields.
- [ ] **14.6.6** Check the `Set-Cookie` header: `HttpOnly`, `SameSite=Lax`, and `Secure` in
      production. Read the header, not the config.
- [ ] **14.6.7** Re-verify all six security headers on the live response.
- [ ] **14.6.8** Confirm `X-Powered-By` is absent.
- [ ] **14.6.9** Sign out. Confirm it returns to `/login` and the session is gone.
- [ ] **14.6.10** Check the browser console on the live site. Record what is there — the
      pre-existing React #418 is expected until 4.5.2 is decided; anything else is new.

### 14.7 Rollback

Decide this before it is needed, not during.

- [ ] **14.7.1** **Application:** Vercel keeps every previous deployment. Promoting the last
      good one is instant and is the first move for any bad deploy — faster than a revert
      commit and a rebuild.
- [ ] **14.7.2** **Database:** there is no rollback. `db/schema.sql` is additive and
      idempotent, which is the whole reason a migration engine was not adopted; a change that
      drops or rewrites a column would need a real plan and does not exist yet.
- [ ] **14.7.3** Confirm the app tolerates a **newer schema than the code expects** —
      additive columns are ignored — so the database can be migrated before the app deploys.
- [ ] **14.7.4** Write down who can roll back and how. A runbook nobody has read is not a
      runbook (11.4.6).

### 14.8 Release record

- [ ] **14.8.1** Resolve 12.1.1 — bring `main` up to date, or change the documentation that
      calls it the release branch.
- [ ] **14.8.2** Tag the release.
- [ ] **14.8.3** Write the `CHANGELOG.md` entry (11.4.12).
- [ ] **14.8.4** Update `HANDOFF.md` with the new branch heads.
- [ ] **14.8.5** Record the deployed commit SHA somewhere a person will find it, so "what is
      live" is answerable without guessing.

---

## Risk register

| Risk | Likelihood | Cost | Mitigation |
|---|---|---|---|
| `output: "standalone"` breaks the Vercel build | Medium | A broken production deploy from a change made for Docker | Verify the Vercel build immediately after 1.2.1, before anything else in Module 1 |
| Thirteen missing documents is more writing than it looks | **High** | The last two days become prose, not code | Write 11.4.1–11.4.5 and treat the rest as optional. Decide that early, not on the last day |
| Neon's **direct** connection string used instead of the pooled one | Medium | Intermittent `503 STORAGE_UNAVAILABLE` under load, looking like an application bug rather than an exhausted connection ceiling | The host must contain `-pooler` (2.3.3); `max: 1` in `db.ts` reduces pressure but does not replace it |
| Deploying the app before the schema exists | Medium | The first visitor gets `503 STORAGE_UNAVAILABLE`, on the deploy most likely to be watched | Fixed order in 14.3.4: schema, then environment variables, then push |
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
