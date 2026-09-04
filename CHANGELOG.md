# Changelog

What is deployed, when it went out, and what was checked **against the live site** after it
did. Newest first.

**This record starts on 2026-09-04.** Deploys before that date were not recorded at the time
and are not reconstructed here — a guessed history is worse than an admittedly short one.
Every entry below cites evidence that exists in this repository or was captured against
production.

The deployed commit is whatever `fork/main` points at:

```bash
git ls-remote fork main
```

Vercel builds from the **fork**, branch `main`. See [`docs/deployment.md`](docs/deployment.md).

---

## `a0d63f5` — 2026-09-04

**Deployed.** A rewrite could produce a dependency cycle the model could not see.

- `fix(rewrite)` — `buildStoryPrompt` never showed the model the *existing* dependency
  edges. Rewriting a story that others depended on, it would name one of them back — a
  resolvable edge, so the existing filter passed it — and `scheduleSprints` then rejected
  the whole plan with `502 PLANNING_ERROR`. Measured at 1 in 3 live rewrites. Prompt
  `s2` now sends the edges; `dropCyclicDependencies()` enforces it regardless of what the
  model returns. Prompt rule 6 also rejects paraphrase-as-rewrite, which is why the button
  appeared to "do nothing" on success.
- `fix(quota)` — `DAILY_PLAN_LIMIT` fell back to `NaN` on a non-numeric value, and
  `used >= NaN` is false forever, so the meter disappeared silently.
- `ci` — the client-bundle secret scan and `npm audit --omit=dev` now run in CI instead of
  being a grep somebody was asked to remember. Cheap gates reordered ahead of the suite.
- `docs` — [`docs/deployment.md`](docs/deployment.md) created; four documents corrected that
  had stopped being true.
- `test(db)` — `scripts/db-check.ts` gained its first *positive* assertion: that
  `plans.derived_from` still accepts a dead parent, i.e. that the deliberately absent foreign
  key has not been helpfully re-added.

**Verified after deploy:** six consecutive live rewrites succeeded, zero edges dropped.
CI green on its first run with the new steps (`Tests, types, and production build`, 1m51s,
plus `Scan the client bundle for leaked credentials`). 580 tests across 23 suites.

## `3d4bc9c` — 2026-09-04

**Deployed, database first.** Rewrite one story instead of regenerating the whole plan.

`db/schema.sql` was applied to the production Neon branch **before** the push, because the
code names a column the database did not yet have and `recordPlan` swallows an insert
failure — the deploy would have returned `200` with a plan and stopped persisting silently.
`npm run db:check` against production returned six `OK` lines beforehand.

**Verified after deploy:** `POST /api/scopecraft/[id]/story/[storyId]` went from `404` to `401` within
roughly 30 seconds of the push — `401` being correct for an unauthenticated caller, and
proof the new route was live.

## `8aec7d6` — 2026-09-04

**Deployed.** A second opinion on the same idea, and a plan you keep.

`bypass_cache` asks a provider again for an identical request, which the cache would
otherwise answer verbatim. It is deliberately *not* part of the cache key, so both plans
file under one `request_hash` and that shared hash is what pairs them for comparison. It is
read at stage 4c — after the daily budget — so a bypass cannot generate without being
counted; a test asserts a bypass over quota answers `429` having called nobody.

**Verified:** covered by tests, including the ordering bug the change exposed. Not separately
re-verified against production beyond the deploy completing.

## `7ca1b65` — 2026-09-04

**Deployed.** Groq first. Mean generation time 19,588 ms → 4,227 ms — **4.63× faster**.

NVIDIA was first in the chain and needs 9–26 s for a full PRD, which did not fit inside
production's `AI_TIMEOUT_MS`; every request was cut off and fell through to Groq exactly as
designed, paying the full timeout first. Fixed with `PRIMARY_AI_PROVIDER=groq`. All three
tiers kept — three tiers measured 462 ms slower than two, inside the noise.

**Verified after deploy:** `attempts=1` on every production row, which is the proof that
NVIDIA is still configured and no longer being called. Measurements in
[`docs/decision-log.md`](docs/decision-log.md) entry 50, which supersedes entry 49.

**This took three deploys to diagnose, and two of them concluded the wrong thing** — first
"the key is probably unset", then "the key is set and being rejected". The tell was in the
timing: durations clustered within 100 ms of the timeout are a cutoff, not an auth failure.
A rejected credential does not get slower when given more time.
