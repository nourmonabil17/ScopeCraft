# Cache Evidence — `POST /api/scopecraft`, Module A3

**Owner:** Yousef Mohmed Hasabo (AI & Backend Engineer)
**Satisfies:** the A3 check in [`upgrade-checklist.md`](../upgrade-checklist.md) — *"a repeat
request returns without a provider call, proven by the provider counter, not by timing."*
**Captured:** 2026-09-04 00:31:00 UTC, at commit `80531ca`, against a **production build**
(`next start`) talking to the live Neon **dev** branch and live providers.

**Raw, unedited capture:** [`raw/cache-transcript.txt`](raw/cache-transcript.txt). This page
is a reading guide to it.

## How to reproduce

```bash
npm run build
set -a; . ./.env.local; set +a
npm run capture:cache
```

[`scripts/capture-cache-evidence.sh`](../../scripts/capture-cache-evidence.sh) boots the
production build once, mints a real session with
[`mint-session.mjs`](../../scripts/mint-session.mjs), sends the same request twice, then reads
back the two rows it wrote. It exits non-zero unless the first response is a `miss` and the
second a `hit`, so it is a regression check as well as a capture. Like the other captures it
is deliberately outside `npm test`: it needs real credentials and makes a real, billable call.

The idea carries a per-run timestamp. Nothing evicts a cached row, so a fixed idea would be a
hit on the *first* request of the second run and the capture would prove nothing.

## Results

| | Run 1 | Run 2 |
|---|---|---|
| Request | identical | identical, byte for byte |
| `x-cache` | `miss` | `hit` |
| `x-provider-used` | `groq` | `groq` — the tier that answered *run 1* |
| `x-plan-id` | `f41975b0…` | `8ea508c8…` — a **different** row |
| Elapsed (wall clock) | **35.86 s** | **0.62 s** |
| `duration_ms` (row) | 33093 | 0 |

### The proof is the row, not the clock

The checklist asks for this explicitly, because a fast second response could just be a fast
provider. The two rows the runs wrote:

```
f41975b0  status=ok  provider=groq  attempts=2  duration_ms=33093  request_hash=36a8ab08fd7c5487...
8ea508c8  status=ok  provider=groq  attempts=0  duration_ms=0      request_hash=36a8ab08fd7c5487...
```

`attempts` counts providers actually **called**. `2` on run 1 — NVIDIA spent its timeout, Groq
answered — and `0` on run 2. Zero is distinct from `NULL`, which means "not recorded". A
`duration_ms` of `0` is the generate step not running at all, since that clock brackets only
the provider chain and the deterministic tools.

The 2.8 s between run 1's wall clock (35.86 s) and its `duration_ms` (33.09 s) is everything
the generate clock deliberately excludes: the session check, validation, the quota query, the
cache lookup, the insert, and the loopback round trip.

The server's own log lines say the same thing without touching the database:

```
scopecraft.generation status=ok duration_ms=33093 attempts=2 provider=groq prompt=v7 code=none persisted=true
scopecraft.generation status=ok duration_ms=0     attempts=0 provider=groq prompt=v7 code=none persisted=true
```

### Both rows share one `request_hash`, and a hit gets its own row

`request_hash` is identical on both, which is the key doing its job. The `x-plan-id` values
differ because a hit writes a **new** row rather than returning the cached row's id — the
board is saved against the plan the caller is looking at, so an edit made after a hit cannot
overwrite the original plan's board. Both rows count toward the daily quota, which is the
recorded decision: the limit is plans per day, not provider calls per day.

## One finding: a hit is not byte-identical to the miss

```
bytes identical         : no
same data               : yes
sizes                   : 5827 / 5827 bytes
top-level key order run1: problem,target_user,goals,non_goals,requirements,user_stories,…
top-level key order run2: goals,risks,effort,moscow,sprint,problem,priority,non_goals,…
```

Same data, same length, different key order. The cached plan makes a round trip through a
`jsonb` column, and Postgres does not preserve object key order in that type — it stores keys
sorted by length, then bytewise, which is exactly the run-2 ordering above.

This is harmless for any JSON client, and `plans.response` compares equal in the database
(`stored response identical: true`). It is recorded because it is real and would otherwise
look like a bug to whoever finds it next: **a client that depends on key order would see a hit
and a miss differently.** Nothing in this codebase does, and the response is a validated Zod
contract where order is not part of the contract.

## What this capture does not show

- **Production.** This ran against the Neon **dev** branch. The production branch has the
  `request_hash` column applied and runs the same commit, but no live signed-in generation has
  been captured there.
- **A second user.** The cache is scoped per user by `user_id`. That scoping is covered by the
  route's query, not by this capture, which uses one session throughout.
- **Prompt-version rejection.** The lookup filters on `prompt_version = PROMPT_VERSION`, so a
  v7 row cannot answer a v8 request. Only one prompt version existed during this capture.
