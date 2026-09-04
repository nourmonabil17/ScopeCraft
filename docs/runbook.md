# Runbook

**Owner:** Yousef · **Last updated:** 2026-09-04

What to do when the live site misbehaves. One section per **symptom**, because a symptom is
what you actually have when something goes wrong — nobody arrives already knowing which
subsystem broke.

Every section follows the same three steps:

1. **What you see** — the observable, from a user's report or a status code.
2. **How to confirm** — a command or a log line that distinguishes this cause from the
   others that produce the same symptom. Do not skip to step 3 on a guess; three of the
   entries below were originally diagnosed wrong precisely that way (`docs/decision-log.md`
   entries 49 and 50).
3. **What to do.**

This is seeded from `docs/known-limitations.md` and `docs/decision-log.md` — every entry
here is a failure this project has actually hit, not a hypothetical one.

**Where the logs are.** Vercel dashboard → the project → **Logs**, filtered to
`/api/scopecraft`. Every generation emits exactly one line beginning `scopecraft.generation`;
failures emit a second line naming the subsystem. Nothing in this application logs a
credential, a connection string or a request body, so the log is safe to paste into a chat
with a teammate.

The one line worth memorising:

```
scopecraft.generation status=ok duration_ms=4227 attempts=1 provider=groq prompt=v7 code=none persisted=true
```

`attempts=1` means the first provider in the chain answered. `persisted=true` means the row
reached Postgres. Those two fields answer most of what follows.

---

## 1. `503 STORAGE_UNAVAILABLE` — nobody can generate anything

**What you see.** Every generation fails immediately, for every user, with
`"Plans cannot be generated right now."` No provider is called, so nothing is spent.

**How to confirm.** The log carries `scopecraft.quota_unavailable reason=...` alongside the
failure. Then, from a machine with the production credential:

```bash
read -rs "DATABASE_URL?prod DATABASE_URL: " && DATABASE_URL="$DATABASE_URL" npm run db:check
```

`read -rs` keeps the credential off the command line and out of shell history. Six `OK`
lines means the database is fine and the problem is that *production* cannot reach it —
almost always a `DATABASE_URL` that is wrong in Vercel rather than a database that is down.

**What to do.**

- If `db:check` fails to connect: check <https://neon.tech> for the project's status. Neon
  branches on free plans suspend when idle, and the first request after a suspension can
  time out before it wakes.
- If `db:check` passes but production still 503s: `DATABASE_URL` in Vercel is stale or
  points at the wrong branch. Set the whole new **pooled** connection string and
  **redeploy** — §8 of [`deployment.md`](deployment.md). A running deployment does not pick
  up an environment change on its own. This is the exact failure a credential rotation
  produces when step 2 is skipped.

**This is deliberate, not a bug in the error path.** The quota check fails *closed*. If the
store is unreachable the endpoint refuses rather than generating unmetered — the reasoning
is in `src/app/api/scopecraft/route.ts` above the `checkDailyQuota` call, and the short
version is that "the database is down" must not become "spending is unlimited".

---

## 2. Plans generate fine but never appear in history

**The nastiest one in this document, because the user sees success.** The plan renders, the
board works, export works. Only the history is empty, and only later.

**What you see.** `200 OK`, a complete plan, and no `x-plan-id` response header. A returning
user reports that their plans "disappear".

**How to confirm.** Two log signals, both present:

```
scopecraft.persist_failed status=ok reason=PostgresError
scopecraft.generation status=ok ... persisted=false
```

`persisted=false` on an otherwise healthy line is the whole diagnosis. **Nothing surfaces in
the HTTP response** — `recordPlan` catches its own error and returns `null`
(`src/lib/plans.ts:113-125`), the route carries on, and the caller is told `200`. That is a
deliberate trade (a failed *save* should not throw away a plan the user is looking at) with
this exact blind spot as its cost.

**What to do.** The overwhelmingly likely cause is **schema/code skew**: a deploy shipped
code that names a column the production database does not have.

```bash
read -rs "DATABASE_URL?prod DATABASE_URL: " && psql "$DATABASE_URL" -f db/schema.sql
```

`db/schema.sql` is idempotent — it is the entire migration story, and re-applying it on a
current database is a no-op. Then redeploy is *not* needed; the next request picks it up.

**Prevent it.** Apply the schema **before** pushing code that names a new column, not after.
Ordering is §3 of [`deployment.md`](deployment.md). This hazard blocked a deploy on
2026-09-04 and is the reason that ordering is written down.

---

## 3. `504 TIMEOUT`, or generations that take 20 seconds

**What you see.** `"The AI provider timed out."`, or successes that are simply slow enough
that users complain.

**How to confirm.** Read `duration_ms` and `attempts` on the `scopecraft.generation` line.

| Reading | Meaning |
|---|---|
| `attempts=1`, `duration_ms` ~4000 | Healthy. This is the current production baseline. |
| `attempts=2` or `3` | The first provider in the chain is failing or timing out and the failover is carrying it. Users are unaffected but each request costs the full timeout first. |
| `duration_ms` clustered within ~100 ms of `AI_TIMEOUT_MS` | A **cutoff**, not a network or auth error. A rejected credential fails fast; a slow provider fails at exactly the limit, every time. |

That last row is the one that has been misread twice. See
[`known-limitations.md`](known-limitations.md) #12 and `docs/decision-log.md` entry 50: a
provider that was cut off every time was recorded first as "key probably unset", then as
"key set and being rejected". Both were wrong, and the tell was in the timing all along.

**What to do.** Check `PRIMARY_AI_PROVIDER` in Vercel. It should be `groq`. NVIDIA needs
9–26 s for a full PRD, which does not fit inside `AI_TIMEOUT_MS`; it is kept in the chain as
a later tier because three tiers measured 462 ms slower than two — inside the noise — so the
redundancy is effectively free.

**If you cannot read the variable's value in Vercel**, it was typed **Secret**. Secret is
write-only. Retype it as **Config** — neither `PRIMARY_AI_PROVIDER` nor `AI_TIMEOUT_MS` is a
credential, and typing them Secret cost three deploys' worth of diagnosis because
production's actual configuration could not be read back. *Type a variable Secret only if
leaking it would hurt.*

---

## 4. `429 RATE_LIMITED` on a user's first request of the day

**What you see.** A user who has generated nothing is told they are out of budget.

**How to confirm.** This is a configuration bug, not a busy user. Check `DAILY_PLAN_LIMIT`
in the environment. A valid value is a positive integer; the default is 20.

**What to do.** Set it to a positive integer or remove it entirely.

Since 2026-09-04 `readDailyLimit()` (`src/lib/quota.ts`) falls back to the default on
anything that is not a positive integer, so this symptom should no longer be reachable on a
current deploy. It is documented because of what it used to do, and because the *older*
failure was the dangerous direction: `DAILY_PLAN_LIMIT=""` produced a limit of 0 and this
429, but `DAILY_PLAN_LIMIT=unlimited` produced `NaN`, and `used >= NaN` is false forever —
**the meter simply vanished**, with no error and no log line. If you are looking at a
deployment older than that commit, check for the silent version too.

`tests/api/env-documentation.test.ts` now fails the build when the application reads a
variable that `.env.example` does not document, which is the class of mistake underneath
both.

---

## 5. `502` — three different causes wearing one status

`PROVIDER_ERROR`, `SCHEMA_VIOLATION` and `PLANNING_ERROR` all return 502. The `code` field
in the response body and in the log line is what separates them, and they need opposite
responses.

| Code | What happened | What to do |
|---|---|---|
| `PROVIDER_ERROR` | No provider in the chain could be reached at all. `attempts` says how many were tried. | Check provider status pages and that at least one `*_API_KEY` is set. If `attempts=0`, **no provider is configured** — that is an environment problem, not an outage. |
| `SCHEMA_VIOLATION` | A provider answered, and its reply failed `ModelReplySchema` twice. | Usually transient — the chain already retried once. If it is persistent, a model ID has been retired: run `npm run smoke`. |
| `PLANNING_ERROR` | A provider answered validly and the **deterministic planner** refused the result: a story larger than one sprint, or a dependency cycle. | See below. |

`PLANNING_ERROR` is the system working. The planner refuses to emit a plausible-looking
wrong plan, so the request fails loudly instead. Two known triggers:

- **Prose in `dependencies`.** Fixed 2026-08-27 in prompt v6; unresolvable edges are dropped
  in `service.ts`.
- **A rewrite closing a dependency cycle.** Fixed 2026-09-04. `buildStoryPrompt` never
  showed the model the *existing* edges, so rewriting a story that others depended on, it
  would name one of them back — a resolvable edge, so the existing filter passed it — and
  `scheduleSprints` then rejected the whole plan. Measured at 1 in 3 live rewrites. Prompt
  `s2` shows the edges and `dropCyclicDependencies()` enforces it regardless of what the
  model returns. If it recurs, the log line is
  `scopecraft.cyclic_dependencies_dropped story=US-n count=n` — that line means the
  enforcement caught it and the user was **not** affected.

**`npm run smoke` is the tool for the first two**, and it needs real credentials. It makes
one-output-token calls to every configured provider. It caught three dead model IDs on
2026-08-24 that the entire mocked test suite had passed.

---

## 6. Sign-in fails

**What you see.** `/login` renders, the provider button bounces back with an error, or
`/scopecraft` redirects to `/login` in a loop.

**How to confirm and fix**, in the order the failures actually happen:

- **`MissingCSRF` in the URL** → expected for a POST without a token. Not a bug; sign in
  through the page rather than by hand.
- **A button is missing from `/login`** → the login page hides a provider whose variables
  are falsy (`src/app/login/page.tsx:28`). The credentials are unset in that environment.
  Inside Docker, check `docker-compose.yml` actually forwards them — Google's were
  documented in `.env.docker.example` and not forwarded, so filling them in did nothing.
- **`redirect_uri_mismatch` from the provider** → the callback URL registered on the OAuth
  app does not match the origin. It must be exactly `<origin>/api/auth/callback/github` (or
  `/google`). Local and production are different origins and need either two apps or two
  registered callbacks.
- **The callback resolves to an internal hostname** → set `AUTH_URL` to the public origin.
  Auth.js otherwise builds the callback from the incoming request, which behind a proxy can
  be wrong.
- **Everyone is signed out at once** → `AUTH_SECRET` changed. Sessions are JWTs; rotating
  the secret invalidates every one of them. That is also the *only* way to revoke a session,
  by design ([`known-limitations.md`](known-limitations.md) #2).

---

## 7. The live site did not change after a push

**The single most expensive mistake in this project's history.**

**What you see.** CI is green, `origin/dev` has your commit, and production serves the old
build.

**How to confirm.** Compare the two refs:

```bash
git ls-remote origin dev && git ls-remote fork main
```

If they differ, the second push was not made.

**What to do.**

```bash
git push fork dev:main
```

**Vercel builds from the FORK, branch `main`.** Pushing to `origin` alone updates the team
repository and moves nothing. Both pushes, every time:

```bash
git push origin dev && git push fork dev:main
```

Production is live roughly 25 seconds later.

**If both refs match and the site is still stale**, it is a browser or CDN cache, not a
deploy. Confirm from outside the browser:

```bash
curl -sI https://scope-craft-nine.vercel.app/login | head -3
```

---

## 8. How to tell what is live

In order of how much you should trust the answer:

1. **`CHANGELOG.md`** — the deployed SHA, dated, with what was verified against production
   after the deploy. This is the intended answer.
2. **`git ls-remote fork main`** — what Vercel last built from. Authoritative about the code,
   silent about whether the deploy succeeded.
3. **The Vercel dashboard** — the only place that knows whether the build passed.

**A tag is not one of these answers.** `v0.1.0` exists as of 2026-09-04, and tags do not
move — it names what was released, never what is deployed right now. If you reach for it to
answer this question you will be right only until the next deploy.

**Three refs disagree and that is normal.** `origin/main` is behind and is a pending team
decision; `fork/dev` stopped moving over a hundred commits ago and is not a source of
anything. Only `fork/main == origin/dev` is meaningful. The table in
[`deployment.md`](deployment.md) §1 has the measured numbers.

**Not available:** there is no `/api/health` endpoint, no `HEALTHCHECK` in the `Dockerfile`,
and no health check on the compose `web` service. A container that boots and then 500s every
request reports as up. Named here so nobody goes looking for a health check that does not
exist.

---

## Related

- [`deployment.md`](deployment.md) — how to deploy, and every environment variable.
- [`known-limitations.md`](known-limitations.md) — the 19 known gaps, each Accepted or Open.
- [`decision-log.md`](decision-log.md) — why things are the way they are. Entry 50 is the
  provider-ordering diagnosis in full, including the two wrong answers before it.
- [`local-development.md`](local-development.md) — running it on your machine.
