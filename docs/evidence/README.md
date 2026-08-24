# Evidence — AI & Backend module

**Owner:** Yousef Mohmed Hasabo (AI & Backend Engineer)

This folder holds the captured evidence for the AI & Backend row of the
**Individual Acceptance & Review** tracker. Everything here is real output from a production
build talking to live providers — nothing is illustrative, hand-written, or transcribed.
Regenerate it all with:

```bash
npm run build
npm run capture:evidence
```

## Contents

| File | What it is |
|---|---|
| [`curl-evidence.md`](curl-evidence.md) | Reading guide to the eleven `curl` cases: valid request, and every 4xx rejection path |
| [`provider-fallback-log.md`](provider-fallback-log.md) | The three-tier failover chain and every safe provider-failure path, with the server's own logs |
| [`raw/curl-transcript.txt`](raw/curl-transcript.txt) | Unedited capture — commands, status lines, all headers, all bodies |
| [`raw/provider-fallback.log`](raw/provider-fallback.log) | Unedited server `console` output, one section per scenario |
| [`raw/200-response.json`](raw/200-response.json) | Full `200` body served by NVIDIA (primary) |
| [`raw/200-response-groq.json`](raw/200-response-groq.json) | Full `200` body served by Groq after one failover hop |
| [`raw/200-response-gemini.json`](raw/200-response-gemini.json) | Full `200` body served by Gemini after two failover hops |
| [`raw/request-valid.json`](raw/request-valid.json) | The request payload used throughout, so the commands run verbatim |

## Acceptance criteria → evidence

| Criterion | Where it is evidenced |
|---|---|
| Valid input returns a response conforming to the documented typed schema | [curl-evidence](curl-evidence.md#1--valid-request-returns-a-schema-conforming-plan) · [`raw/200-response.json`](raw/200-response.json) |
| Invalid/malformed input returns a safe 4xx and does not call the provider | [curl-evidence](curl-evidence.md) cases 2–6 (`400`, `413`, `422`, `422`, `405`) |
| Provider secrets stay server-side, absent from client bundles and history | Secret scan in every capture run (reported `CLEAN`) · [`security-review.md`](../security-review.md) |
| **Groq/Gemini fallback or a documented safe provider-failure path is demonstrated** | [provider-fallback-log](provider-fallback-log.md) scenarios 2 and 3 — live one-hop and two-hop failover |
| Grounding and tool arguments validated; tool logic deterministic | [`tests/api/tools.test.ts`](../../tests/api/tools.test.ts) · [`api-contracts.md`](../api-contracts.md#deterministic-tool-contracts) |
| Normal, not-found, timeout/provider-error and tool-failure tests included | [provider-fallback-log](provider-fallback-log.md) scenarios 4–6 · [`tests/api/scopecraft.test.ts`](../../tests/api/scopecraft.test.ts) |
| Server logs are useful but expose no secrets or unnecessary user data | [provider-fallback-log — what the log does *not* contain](provider-fallback-log.md#what-the-log-does-not-contain) |
| Stories have testable acceptance criteria; sprint plan respects capacity | Structural check in [curl-evidence](curl-evidence.md#1--valid-request-returns-a-schema-conforming-plan); the Groq failover run committed 28 of 30 points and deferred 3 stories |

## What is *not* here, and why

`SCHEMA_VIOLATION`, `PLANNING_ERROR` and `OUT_OF_DOMAIN` cannot be forced from outside the
process — they need a provider to return specific malformed or refusing content on demand.
They are covered by unit tests instead; see the coverage note at the end of
[provider-fallback-log.md](provider-fallback-log.md#coverage-note).

Screenshots and recordings of the browser UI are a separate deliverable and belong to the
Product UI & Workflow row, not this one.
