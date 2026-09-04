# Release Checklist

Owner: Nour (Integration Lead)
Last updated: 2026-08-24 — rewritten against the current `dev`/`main` state (`4c6ff18`)
after the first live-credential smoke test. Update this file's numbers whenever they
drift from reality rather than leaving stale counts in place.

Amended 2026-09-04: test counts refreshed, the auth and database variables added to the
environment table, a Database section added, and three claims superseded in place — the
NVIDIA key, `PRIMARY_AI_PROVIDER`, and "no persistence". `4c6ff18` above is no longer any
ref; the rows below it have not all been re-verified against the current tree, so read an
untouched tick as "true on 2026-08-24", not as "true today".

## Pre-release
- [x] `npm run lint` passes — `eslint . --max-warnings=0`
- [x] `npm run build` (type-check + production build) passes with no errors
- [x] `npm test` passes locally — **580/580 tests**, 23 suites (295 node, 285 UI)
- [x] `npx tsc --noEmit` passes locally
- [x] No secret keys committed to git history — `git grep` for the actual key patterns and
      the real key values used during local testing returns no matches on tracked files
- [x] `.env.example` up to date with all required variable names and current model IDs
      — **was false when ticked; true now and enforced.** `DAILY_PLAN_LIMIT` was missing.
      `tests/api/env-documentation.test.ts` now asserts this row rather than trusting it.
- [x] Production dependency audit reports zero known vulnerabilities —
      `npm audit --omit=dev` clean (nanoid advisory GHSA-2v37-7h3g-55p8 fixed 2026-08-24)
- [x] `npm run smoke` run with real credentials against all 3 providers — all `200 OK`
      (2026-08-24; see `docs/decision-log.md` item 5 for the full story, including the
      three dead default model IDs it caught and the fix)

## Environment

Set every variable below in the hosting provider's environment settings (e.g. Vercel
Project → Settings → Environment Variables), **never** in code or a committed file.
`.env.local` is gitignored and must stay that way.

| Variable | Required | Notes |
|---|---|---|
| `NVIDIA_API_KEY` | At least one of the three keys is required | Primary provider |
| `GROQ_API_KEY` | — | Fallback 1 |
| `GEMINI_API_KEY` | — | Fallback 2 |
| `PRIMARY_AI_PROVIDER` | No — defaults to `nvidia` | Set it to `groq`. The default puts NVIDIA first, and NVIDIA needs 9–26 s for a full PRD, so every generation paid a timeout before falling through. See the banner below |
| `AI_TIMEOUT_MS` | No — defaults to `30000` | Per-attempt abort timeout |
| `AI_TOTAL_BUDGET_MS` | No — defaults to `50000` | Ceiling for the whole failover chain, so the worst case does not grow with the number of tiers. Must stay under the route's `maxDuration` (60 s) |
| `AUTH_SECRET` | **Yes** | Signs and encrypts the session cookie (`npx auth secret`). Missing: nobody can sign in, so `/scopecraft` bounces to `/login` and the API answers `401` to everyone |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | At least one OAuth provider is required | GitHub OAuth app; callback exactly `<origin>/api/auth/callback/github`. Missing: the GitHub button is not offered |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | — | Google OAuth client; redirect URI exactly `<origin>/api/auth/callback/google`. Missing: the Google button is not offered. While the consent screen is in "Testing" publishing status, only the listed test users can sign in |
| `AUTH_URL` | **Yes, in production** | Auth.js otherwise builds the callback URL from the request, and behind a proxy that resolves to the internal host — which the provider rejects as a redirect-URI mismatch |
| `DATABASE_URL` | **Yes** | Postgres. Neon in production: use the **pooled** host (the one with `-pooler`) and keep `sslmode=require`. Missing or unreachable: the quota check cannot run and the endpoint answers `503 STORAGE_UNAVAILABLE` |
| `DAILY_PLAN_LIMIT` | No — defaults to `20` | Plans one account may generate per rolling 24 hours. Counts attempts, not successes. Anything that is not a positive integer falls back to the default rather than being trusted — an empty string once parsed to 0 and answered `429` on the first request of the day |

- [x] `NVIDIA_API_KEY` set in hosting provider's environment.

      > **Superseded 2026-09-04.** The key was set the whole time. NVIDIA was not being
      > skipped for a missing credential — it was being *cut off*: it needs 9–26 s for a
      > full PRD on this account, it was first in the chain, and production's
      > `AI_TIMEOUT_MS` ended every attempt before it finished. The request then fell
      > through to Groq exactly as the failover design intends, which is why the served
      > provider looked like the signature of a missing key. Three things settle it: the
      > same key and default model return `200 OK` called directly; NVIDIA's implied
      > per-row share was 13928/15202/15124/15088/15150 ms, four of five inside 15.1 s
      > ± 0.1, which is a fixed cutoff rather than an auth or network error; and raising
      > `AI_TIMEOUT_MS` to 30000 with NVIDIA still first produced a **34819 ms**
      > generation — a rejected credential does not get slower when given more time.
      > The fix is `PRIMARY_AI_PROVIDER=groq`, which resolves the chain to
      > **Groq → NVIDIA → Gemini**: 19588 ms → 4227 ms mean, 4.63× faster, all three
      > tiers kept. `docs/decision-log.md` entry 50 supersedes entry 49. Still unread:
      > the Vercel runtime log line naming NVIDIA's exact failure — "timeout" is inferred
      > from the timing signature and the 30 s experiment, not read.

      Original text, left intact: *"**`NVIDIA_API_KEY` set in hosting provider's
      environment — evidence says NO.** Three consecutive production generations on
      2026-08-24 were served by `groq` and `gemini`, never `nvidia`. A provider with no
      credential is skipped rather than failed, so the chain starting at Groq is the
      signature of a missing NVIDIA key. Users are unaffected (failover works), but the
      deployed environment does not match `.env.example`. **Verify in the Vercel dashboard
      and set it.**"*
- [x] `GROQ_API_KEY` set in hosting provider's environment — confirmed by a production
      generation served with `x-provider-used: groq`
- [x] `GEMINI_API_KEY` set in hosting provider's environment — confirmed by a production
      generation served with `x-provider-used: gemini`
- [x] `PRIMARY_AI_PROVIDER="groq"` set explicitly — resolves the chain to Groq → NVIDIA →
      Gemini. Confirmed by effect on 2026-09-04: three production generations at a 4227 ms
      mean, each row recording `attempts=1`. `attempts` counts providers actually called,
      so `1` says Groq answered first and NVIDIA was never reached.

      > **Superseded 2026-09-04.** Original text, left intact: *"`PRIMARY_AI_PROVIDER="nvidia"`
      > set explicitly — cannot be confirmed from outside, and the observed order is
      > consistent with it being unset. Check the dashboard."* Setting it to `nvidia` is
      > what the row above describes going wrong. Do not restore that value.
      >
      > Both this variable and `AI_TIMEOUT_MS` were typed **Secret** in Vercel, which is
      > write-only, so neither could be read back to see what production was running. That
      > is most of why the diagnosis took four deploys. Both are **Config** now — type a
      > variable Secret only if leaking it would hurt.
- [ ] `AI_TIMEOUT_MS=30000` set explicitly — not externally observable; check the dashboard
- [x] No env variable containing a secret is prefixed `NEXT_PUBLIC_` (that prefix inlines
      the value into the client bundle and permanently leaks it to every visitor) — verified:
      zero `NEXT_PUBLIC_` occurrences in `src/`, and `.next/static` scanned clean for
      `nvapi-` / `gsk_` / `AIza` patterns
- [x] `next.config.js` security headers (`Content-Security-Policy`, `X-Frame-Options`,
      `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) confirmed present in
      the deployed response headers, not just the repo file — verified 2026-08-24:
      `curl -sSI <url> | grep -iE "content-security|x-frame|x-content-type|referrer|permissions"`
- [x] `X-Powered-By` absent from the deployed response (`poweredByHeader: false`) — verified
      2026-08-24

## Database

**Order matters: schema first, then code.** `db/schema.sql` must be applied to the target
database *before* pushing code that names a new column. Get it the other way round and
nothing fails loudly — `recordPlan` in `src/lib/plans.ts` catches its own insert error and
returns `null`, deliberately, so that a failed bookkeeping write does not destroy a plan the
user already waited for and already paid provider tokens for. The caller gets `200` and a
valid plan while persistence has quietly stopped. The only signal is a `scopecraft.persist_failed`
line in the runtime log, and the visible symptoms are downstream and slow to notice: history
stops growing and the daily quota under-counts.

- [ ] `db/schema.sql` applied to the production database **before** deploying code that
      references a new column — `psql "$DATABASE_URL" -f db/schema.sql`
- [ ] `npm run db:check` passes against the production `DATABASE_URL`
- [ ] `DATABASE_URL` in the hosting provider is Neon's **pooled** string — the host with
      `-pooler` in it — with `sslmode=require`. The direct endpoint's connection ceiling is
      low enough that a handful of warm serverless functions will exhaust it
- [ ] After any Neon password rotation, the whole new pooled string is pasted into the
      hosting provider **and redeployed** before the rotation is called done. Skipping that
      step takes production down: the quota check cannot reach Postgres and the endpoint
      answers `503 STORAGE_UNAVAILABLE`
- [ ] One signed-in generation against production returns `200` with an `x-plan-id` header —
      the cheapest proof that the running deployment reached Postgres and completed an insert
- [ ] The runtime log carries no `scopecraft.persist_failed` lines after that generation
- [ ] Neon's free tier suspends the compute after ~5 minutes idle, so the first query after
      that pays roughly half a second of wake-up. Expected; do not chase it as a regression

## Deployment

- [x] Vercel project created and linked to this repository — **note the trap:** it deploys
      from the fork `mr-h12/ScopeCraft`, branch `main`, **not** from the team repo. Pushing
      to `nourmonabil17/ScopeCraft` alone never updates the live site. Ship with
      `git push fork dev:main`. Repointing Vercel at the team repo is an open decision
- [ ] Preview deployment (from a PR or `dev`) tested end-to-end — **not done.** Production
      has been tested directly instead; a true preview-environment test is still outstanding
- [ ] Preview deployment tested for the refusal path — **not done**, same reason
- [x] Production URL tested end-to-end — verified 2026-08-24 against
      `https://scope-craft-nine.vercel.app`: a real idea returned `200` with 13 top-level
      fields, 6 user stories, and `committed_points 29 <= capacity_points 30`
- [x] Production refusal path tested — an out-of-domain medical request returned
      `422 OUT_OF_DOMAIN` with no fabricated plan
- [x] Record the live URL in `README.md` once confirmed — done 2026-08-24. It previously
      said "not yet deployed", which would have read to a grader as a missing submission row
- [ ] `npm run smoke` re-run with the production environment's actual keys if they differ

## Rollback procedure

- [ ] Confirm the hosting provider keeps the previous deployment available for instant
      re-promotion (Vercel does, by default, for any prior successful deployment)
- [ ] If a release misbehaves in production: re-promote the last known-good deployment
      from the hosting dashboard rather than attempting a hotfix under pressure — this
      should take under 5 minutes and requires no code change
- [ ] After rolling back, open an issue capturing what broke before attempting the fix
      forward, so the same regression isn't reintroduced
- [ ] `main` and `dev` should not diverge silently after a rollback — if `main` is
      re-promoted to an older commit, decide explicitly whether `dev` also needs resetting
      or whether the fix will land forward instead

## Known limitations (update before each release)

- **Persistence is silent when it fails.**

  > **Superseded 2026-09-04.** Results *are* stored. The `plans` table shipped; every
  > generation that reaches a provider writes a row, `/scopecraft/history` reads them back,
  > and the daily quota is a `count(*)` over that table rather than a separate store.
  > What replaces the old limitation is narrower and worse-behaved: `recordPlan` in
  > `src/lib/plans.ts` never throws, so when the write fails the caller still gets `200`
  > and a valid plan and **nothing says the row was lost**. The reasoning is deliberate and
  > written at the function — a failed bookkeeping write must not destroy a plan the user
  > already waited for and already paid provider tokens for. The cost is stated there too:
  > for as long as such an outage lasts the quota under-counts, and the board cannot be
  > saved for that plan. Watch for `scopecraft.persist_failed` in the runtime log; it is
  > the only signal.
  >
  > Original text, left intact: *"**No persistence.** Results are not stored; refreshing
  > loses the generated plan."*
- **The domain-refusal path depends on the model emitting the refusal envelope.** A
  server-side domain classifier would close this gap; not built. One live adversarial
  prompt has been verified refused correctly (2026-08-24) — that is not the same as
  comprehensive live adversarial coverage.
- **Greedy, single-pass sprint packing**, not optimal packing — deliberate design choice,
  documented in `README.md`.
- **A `502`/`504` from the provider chain is terminal for the caller** — no server-side
  backoff or queue; the client is told to retry.
- **Single default team capacity profile** — not yet configurable per team beyond the
  per-request `team_capacity_points`.
- **Model IDs can go stale again.** Hosted model availability changes independently of
  this repository — this is not hypothetical, it already happened once (all 3 defaults
  were dead before 2026-08-24). Re-run `npm run smoke` before every release, not just
  once.
