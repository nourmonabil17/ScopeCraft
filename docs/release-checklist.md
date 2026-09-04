# Release Checklist

Owner: Nour (Integration Lead)
Last updated: 2026-08-24 — rewritten against the current `dev`/`main` state (`4c6ff18`)
after the first live-credential smoke test. Update this file's numbers whenever they
drift from reality rather than leaving stale counts in place.

## Pre-release
- [x] `npm run lint` passes — `eslint . --max-warnings=0`
- [x] `npm run build` (type-check + production build) passes with no errors
- [x] `npm test` passes locally — **245/245 tests**, 8 suites (131 node, 114 UI)
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
| `PRIMARY_AI_PROVIDER` | No — defaults to `nvidia` | Set explicitly as `"nvidia"` for clarity in the hosting dashboard |
| `AI_TIMEOUT_MS` | No — defaults to `30000` | Per-attempt abort timeout |
| `AI_TOTAL_BUDGET_MS` | No — defaults to `50000` | Ceiling for the whole failover chain, so the worst case does not grow with the number of tiers. Must stay under the route's `maxDuration` (60 s) |

- [ ] **`NVIDIA_API_KEY` set in hosting provider's environment — evidence says NO.**
      Three consecutive production generations on 2026-08-24 were served by `groq` and
      `gemini`, never `nvidia`. A provider with no credential is *skipped* rather than
      failed, so the chain starting at Groq is the signature of a missing NVIDIA key.
      Users are unaffected (failover works), but the deployed environment does not match
      `.env.example`. **Verify in the Vercel dashboard and set it.**
- [x] `GROQ_API_KEY` set in hosting provider's environment — confirmed by a production
      generation served with `x-provider-used: groq`
- [x] `GEMINI_API_KEY` set in hosting provider's environment — confirmed by a production
      generation served with `x-provider-used: gemini`
- [ ] `PRIMARY_AI_PROVIDER="nvidia"` set explicitly — cannot be confirmed from outside, and
      the observed order is consistent with it being unset. Check the dashboard.
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

- **No persistence.** Results are not stored; refreshing loses the generated plan.
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
