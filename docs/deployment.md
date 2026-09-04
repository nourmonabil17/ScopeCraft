# Deployment

**Owner:** Yousef Mohmed Hasabo · **Last verified:** 2026-09-04
**Live site:** <https://scope-craft-nine.vercel.app>

How ScopeCraft gets to production, in the order the steps have to happen. Read it top to
bottom the first time; after that, §4 (pre-flight), §5 (the push) and §6 (verification) are
the working checklist.

The deploy path for this project is **not** the obvious one. The single most expensive
mistake in this repository's history is pushing to the team repository and believing the
site updated. §1 exists to stop that happening again.

---

## 0. Before anything else: who can actually do this

**The Vercel project is a single point of failure, and it is a person.**

- The Vercel MCP tooling available in this repository authenticates as team `mohanad3`
  (hobby plan), which **cannot see or deploy** `scope-craft-nine.vercel.app`.
  `list_projects` returns empty; four deployments were created there and silently reverted.
  Do not retry that path.
- Repointing Vercel at the team repository, changing an environment variable, promoting a
  previous deployment, or triggering a redeploy all require the Vercel dashboard, and the
  dashboard requires whoever owns the Vercel project.

So a teammate can reconstruct this entire procedure from the tracked files in this repo —
every command below is runnable — and still not be able to execute it. The pushes in §5
work for anyone with write access to the fork. Everything that touches Vercel itself does
not. That is the current state; this document does not propose a fix for it.

---

## 1. The deploy path, and the trap in it

```
origin  = nourmonabil17/ScopeCraft   team repo — reviews, PRs, history
fork    = mr-h12/ScopeCraft          what Vercel actually builds, branch main
```

**Vercel deploys from the FORK, branch `main`.** Pushing to `origin` alone updates the team
repository and changes nothing about the live site. Both pushes, every time:

```bash
git push origin dev && git push fork dev:main
```

Only the second one moves production. It is live in roughly 25 seconds.

### Branch topology, as verified on 2026-09-04

Verified with `git ls-remote` and `git rev-list --left-right --count`. The commits move; the
*relationships* are the part worth reading, and they have held all along:

| Ref | Commit | Relationship |
|---|---|---|
| `origin/dev` | `d23f638` | The working branch. Source of truth. |
| `fork/main` | `d23f638` | **Identical to `origin/dev`.** This is what production serves. |
| `origin/main` | `d23f638` | Caught up 2026-09-04 by fast-forward. Was 36 behind, 0 ahead. |
| `fork/dev` | `eb110fd` | **132 behind `origin/dev`, 0 ahead. Not used. Not a source of truth.** |

**Only `fork/dev` is now out of step**, and it is a leftover nothing reads. Even so, do not
treat `origin/main` as a second opinion about what is live: it is caught up today because
somebody caught it up, and nothing keeps it that way. `fork/main` is the only ref Vercel
reads. Re-measure rather than trusting the commits in this table:

```bash
git ls-remote origin dev && git ls-remote fork main
```

Two things to take from that table:

- `fork/dev` exists only as a leftover of the fork. Nothing pushes to it and nothing reads
  it. If you find yourself comparing against it, you are comparing against a branch that
  stopped moving over a hundred commits ago.
- **`v0.1.0` is the first and only tag**, cut 2026-09-04 at `40dd493` and pushed to
  `origin`. It names a release; it does not track one. Tags do not move, so a tag answers
  "what was released" and never "what is deployed right now" — for that, `fork/main` is the
  measured answer and [`../CHANGELOG.md`](../CHANGELOG.md) the written one.

### Docker is not on this path

Vercel does not build from the `Dockerfile`. It runs `next build` against `next.config.js`,
the same file the image uses. **Shipping the image ships nothing to production.**

Docker exists for a one-command local environment, a real Postgres without a signup,
integration tests that can touch a real database, and a portable deploy path that this
project does not currently use. Anything changed for the container — `output: "standalone"`
above all — has to be verified against the Vercel build, because both builds read the same
config file.

---

## 2. Environment variables

Eleven variables across three concerns. A missing one fails differently in each case, and
two of them fail *silently*, which is worse. Set every one for **Production and Preview** —
a Preview deployment with no `AUTH_SECRET` is a broken PR review nobody can use.

### Authentication (6)

| Variable | Where it comes from | If it is missing |
|---|---|---|
| `AUTH_SECRET` | `npx auth secret` | Every request is unauthenticated and the site bounces to `/login`. |
| `AUTH_GITHUB_ID` | GitHub OAuth app | The GitHub button is not offered. |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app | Same. |
| `AUTH_GOOGLE_ID` | Google OAuth client | The Google button is not offered. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client | Same. |
| `AUTH_URL` | `https://scope-craft-nine.vercel.app` | Read by the auth library, not by app code. `src/auth.ts` sets `trustHost: true`, so without `AUTH_URL` the callback origin is taken from the `Host` header — pinning it is what stops a forged header redirecting the OAuth flow. |

The GitHub callback must be exactly
`https://scope-craft-nine.vercel.app/api/auth/callback/github`, and the Google one exactly
`https://scope-craft-nine.vercel.app/api/auth/callback/google`. A trailing slash is a
different URL.

### Storage and quota (2)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon's **pooled** connection string — the host contains `-pooler`. Production Neon branch for Production, the `dev` branch for Preview. Missing or wrong: `503 STORAGE_UNAVAILABLE`. |
| `DAILY_PLAN_LIMIT` | Optional. Defaults to 20. |

### AI providers (3)

`NVIDIA_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`. At least one must be set.

**A missing provider key is *skipped*, not failed.** `generateWithFallback` treats an absent
credential as "this tier is not configured" and moves to the next one, so a team with one
key still gets a working app — and so a key you *believe* is set but is not produces no
error anywhere. This is the first of the two silent failures, and it is why the NVIDIA
mis-ordering (known finding #5) was diagnosable at all.

### Optional tuning — in addition to the eleven

`PRIMARY_AI_PROVIDER`, `AI_TIMEOUT_MS`, `AI_TOTAL_BUDGET_MS`. All three are read at call
time, so changing them needs a redeploy but not a rebuild.

Production runs `PRIMARY_AI_PROVIDER=groq`. `getProviderOrder()` puts the configured primary
first and leaves the rest in their default relative order, so the live chain is:

```
Groq → NVIDIA → Gemini
```

NVIDIA is **second**, not third. It is kept because three tiers measured 462 ms faster than
two — inside the noise, so read it as "costs nothing", not as a gain.

### The rule that came out of the NVIDIA diagnosis: Secret vs Config

`PRIMARY_AI_PROVIDER` and `AI_TIMEOUT_MS` were both typed **Secret** in the Vercel
dashboard. Neither is a credential: one is a number, the other is the string `groq`.

Vercel's Secret type is **write-only**. You can set it and you cannot read it back. So
during the diagnosis nobody could answer the first question — *what is production actually
configured with?* — and the effective timeout was never read at all; it was inferred from
timing. This cost three deploys before the ordering bug was found. Both are **Config** now.

> **Type a variable Secret only if leaking it would hurt.** Marking configuration as secret
> buys nothing and costs the ability to diagnose.

(The decision log's entry 50 says the diagnosis "took four deploys" and known finding #5 in
the working notes says three. The trap itself is the same either way.)

### One thing that is never negotiable

**Confirm not one of these has a `NEXT_PUBLIC_` prefix.** That prefix inlines the value into
the client bundle permanently, and a rotation does not undo a leak that has already been
served. §4 has the grep.

---

## 3. The database is deployed before the application

An app that starts against a schema-less database fails on the first generation. A schema
with no app is inert. So the order for any deploy that touches storage is:

```
schema  →  environment variables  →  push
```

Getting it backwards means the first visitor hits a `503 STORAGE_UNAVAILABLE`.

### Applying the schema

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

`db/schema.sql` is the whole migration story. **There is no runner and no versions
directory** — the file is written to be applied repeatedly to the same database, and
re-running it *is* how migration works here.

The part that catches people: `create table if not exists` does nothing when the table
exists. It does not compare definitions, so a column added inside the `create table` block
never appears on a database that already holds rows. That is why the file ends with
`alter table ... add column if not exists` statements. Those are not duplication and must
not be tidied away; on an existing database they are the only lines that do anything.

Against the local Docker Postgres the equivalent is:

```bash
docker compose exec -T db psql -U scopecraft -d scopecraft -v ON_ERROR_STOP=1 -f - < db/schema.sql
```

`psql` is not installed on the current author's machine, so the remote form above has been
run from elsewhere. If you do not have `psql` either, the Neon SQL editor takes the file's
contents directly.

### The migration hazard — the second silent failure

**Apply the schema to the target database before pushing code that names a new column.**

`recordPlan` in `src/lib/plans.ts` wraps its insert in `try/catch` and returns `null`
instead of throwing. That is deliberate and the comment says why: a failed bookkeeping write
must not destroy a plan the user already waited for and already paid provider tokens for.
The request succeeded; the only thing lost is a row.

The cost of that choice, stated in the same comment, is what makes schema skew dangerous.
If the running code inserts a column the database does not have, then:

- the API still answers **`200`** with a complete, valid plan;
- the user sees nothing wrong;
- **persistence stops entirely** — no rows, no history, and the quota silently under-counts
  for as long as it lasts;
- the board cannot be saved for those plans.

Two signals exist, and both are in the server log rather than the response:

```
scopecraft.persist_failed status=... reason=...        ← emitted by recordPlan's catch
scopecraft.generation ... persisted=false              ← emitted by the route
```

Nothing surfaces in the HTTP response, so **if you are not reading the Vercel runtime log,
you will not notice.** `logGeneration`'s own comment says this outright: the line duplicates
the database row precisely because the one case a row cannot cover is the insert failing.

Adding **nullable** columns first is always safe, because the running code never names them.
That is also why rollback works in one direction only — see §7.

---

## 4. Pre-flight

Everything green before pushing. All four gates, not three.

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint --max-warnings=0
npm test
npm run build
```

Then:

- [ ] Both evidence captures green — `npm run capture:ui` (needs the same `AUTH_SECRET` the
      server under capture was started with; it mints its own session cookie rather than
      bypassing auth) and `npm run capture:cache`.
- [ ] `docker compose up --build` from a cold start, for anything touching the build, the
      database, or environment configuration.
- [ ] **Bundle secret scan clean.** Grep the built client bundle for every key pattern
      **and** for `postgres://`.
- [ ] CI green on `dev`.
- [ ] `git status` clean apart from the known-untracked handbook folder. Never `git add -A`
      without looking first — `.DS_Store` was swept into the index that way once.
- [ ] `git log origin/dev..dev --format=%B | grep -i co-authored` returns nothing.

---

## 5. The push

```bash
git push origin dev        # team repo: reviews, history. Changes nothing live.
git push fork dev:main     # THIS is the one that deploys.
```

Then watch the Vercel build. **A build that succeeds locally can still fail there:** the
environment differs, and `next build` evaluates route modules — which is exactly how an
eager `DATABASE_URL` read broke the build once already.

---

## 6. Post-deploy verification — against the live site, not localhost

Ten checks. Do them against <https://scope-craft-nine.vercel.app>.

1. **Sign in.** Confirm the header shows your account name. Note *which* provider you used;
   both GitHub and Google are live.
2. **Generate a plan.** Confirm `X-Provider-Used`, `X-Prompt-Version`, `X-Plan-Id` and
   `X-Cache` all arrive.
3. **Edit the sprint board**, reload the plan from history, confirm the edit survived **and**
   that the score recomputed rather than replayed.
4. **Confirm a row landed in Neon**, attributed to the right user. This is also the check
   that catches the §3 silent-persistence failure.
5. **`curl` the endpoint with no cookie** — expect `401`, not a plan.
6. **Read the `Set-Cookie` header**: `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
   Read the header, not the config.
7. **Re-verify all six security headers** on the live response.
8. **Confirm `X-Powered-By` is absent.**
9. **Sign out.** Confirm it returns to `/login` and the session is gone.
10. **Check the browser console** and record what is there. The pre-existing React #418
    hydration error is expected until that decision is made; anything else is new.

---

## 7. Rollback

Decide this before it is needed, not during.

**Application — instant.** Vercel keeps every previous deployment. Promoting the last good
one is the first move for any bad deploy: faster than a revert commit and a rebuild, and it
does not depend on the fork push succeeding. It needs the dashboard, so it needs the person
in §0.

**Database — there is no rollback.** `db/schema.sql` is additive and idempotent, which is
the whole reason a migration engine was never adopted. A change that drops or rewrites a
column would need a real plan, and no such change exists yet.

**Why the one-way order in §3 is safe:** the app tolerates a schema *newer* than the code
expects, because additive columns are simply not named by the running code. The reverse —
code newer than the schema — is the silent failure. Migrate the database first, always.

---

## 8. Rotating the database credential

If the production Neon password is ever exposed, the order is fixed. **Skipping step 2
takes production down.**

1. **Neon console** → production branch → Roles → reset `neondb_owner`.
2. **Vercel** → Settings → Environment Variables → `DATABASE_URL` ← the whole new **pooled**
   connection string (host contains `-pooler`). Not a partial edit; replace the whole value.
3. **Vercel** → Deployments → **Redeploy.** A running deployment does not pick up an
   environment change. Steps 1 and 2 without step 3 leave production on the dead credential.
4. **`npm run db:check`** to confirm `.env.local` still connects — it is not established
   whether Neon scopes that role's password per branch.

If those Vercel variables are managed by a Neon integration, resync rather than hand-editing,
or the edit is overwritten on the next sync.

This was done once, on 2026-09-04, and it worked: a live signed-in generation afterwards
returned `200` with an `x-plan-id`, which means the deployment reached Postgres for the
quota check and completed an insert. A reset not carried through to Vercel would have
answered `503 STORAGE_UNAVAILABLE` instead.

---

## 9. Record the deploy

**Do this immediately after §6 passes, not later.** The verification results are the whole
value of the entry, and nobody reconstructs them a week afterwards — which is exactly why
[`../CHANGELOG.md`](../CHANGELOG.md) begins on 2026-09-04 rather than at the first deploy.

Every deploy gets a changelog entry:

```bash
git ls-remote fork main          # the SHA that is actually live
```

Add it at the top of `CHANGELOG.md`, newest first: the SHA, the date, what changed, and —
the part that matters — **what was checked against the live site afterwards**. Write what was
actually observed. "Not separately verified against production" is a legitimate entry; an
invented check is not.

A deploy that is meant to be a **release** also gets a tag:

```bash
git tag -a v0.1.0 -m "First tagged release: auth, persistence, per-story rewrite"
git push origin v0.1.0
```

Annotated (`-a`), not lightweight — an annotated tag carries a tagger, a date and a message,
and is the object a release is cut from. The tag goes to **`origin`**, which is the team
repository and where history lives. Do not tag on `fork`; the fork is a deploy target, not a
record.

Then commit the changelog and push it the normal way, which is both remotes:

```bash
git push origin dev && git push fork dev:main
```

Still open, and team-owned rather than fixable here:

- [x] Resolve `origin/main` — brought up to date 2026-09-04. It was a strict ancestor of
      `dev`, so this was a fast-forward with nothing to merge and nothing to lose:
      `git push origin origin/dev:main`. **It does not stay current on its own**; nothing
      deploys from it and nothing updates it.
- [x] Cut the first tag. `v0.1.0`, 2026-09-04, at `40dd493`. The next one is a judgement
      call about what counts as a release, not a repeat of this step.
- [ ] Update `HANDOFF.md` §1.2 with the new branch heads when they move.

---

## Related

- [`runbook.md`](runbook.md) — what to do when the deployed site misbehaves, one section
  per symptom. Read it *after* something breaks; read this one before.
- [`../CHANGELOG.md`](../CHANGELOG.md) — what is deployed and what was verified live.
- [`local-development.md`](local-development.md) — running it on your machine, and the full
  schema-application notes.
- [`database-and-auth-design.md`](database-and-auth-design.md) — what the schema is and why.
- [`project-plan.md`](project-plan.md) §14 — the Module 14 checkboxes this document backs.
- [`decision-log.md`](decision-log.md) entry 50 — the provider-ordering diagnosis in full.
