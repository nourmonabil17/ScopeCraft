# Release Checklist

Owner: Nour (Integration Lead)
Last updated: 2026-08-24 — rewritten against the current `dev`/`main` state (`4c6ff18`)
after the first live-credential smoke test. Update this file's numbers whenever they
drift from reality rather than leaving stale counts in place.

## Pre-release
- [x] `npm run lint` passes — `eslint . --max-warnings=0`
- [x] `npm run build` (type-check + production build) passes with no errors
- [x] `npm test` passes locally — **201/201 tests**, 6 suites (131 backend, 70 frontend)
- [x] `npx tsc --noEmit` passes locally
- [x] No secret keys committed to git history — `git grep` for the actual key patterns and
      the real key values used during local testing returns no matches on tracked files
- [x] `.env.example` up to date with all required variable names and current model IDs
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
| `AI_TIMEOUT_MS` | No — defaults to `15000` | Per-attempt abort timeout; total worst-case latency is roughly 3× this across the failover chain |

- [ ] `NVIDIA_API_KEY` set in hosting provider's environment
- [ ] `GROQ_API_KEY` set in hosting provider's environment
- [ ] `GEMINI_API_KEY` set in hosting provider's environment
- [ ] `PRIMARY_AI_PROVIDER="nvidia"` set explicitly
- [ ] `AI_TIMEOUT_MS=15000` set explicitly
- [ ] No env variable containing a secret is prefixed `NEXT_PUBLIC_` (that prefix inlines
      the value into the client bundle and permanently leaks it to every visitor)
- [ ] `vercel.json` security headers (`X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`) confirmed present in the deployed response headers, not just the
      repo file

## Deployment

- [ ] Vercel project created and linked to this repository
- [ ] Preview deployment (from a PR or `dev`) tested end-to-end: submit a real idea → see
      a structured plan with all 11 fields and a valid `sprint_plan`
- [ ] Preview deployment tested for the refusal path: submit an out-of-domain idea → see
      `422 OUT_OF_DOMAIN`, not a fabricated answer
- [ ] Production URL (promoted from `main`) tested end-to-end the same way
- [ ] Record the live URL in `README.md` once confirmed — do not publish a placeholder as
      if it were live
- [ ] `npm run smoke` re-run with the production environment's actual keys if they differ
      from the ones used in local verification — a key that works locally is not proof the
      same key is correctly set in the hosting dashboard

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
