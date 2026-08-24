# API Evidence — `POST /api/scopecraft`

**Owner:** Yousef Mohmed Hasabo (AI & Backend Engineer)
**Satisfies:** the *"Postman/curl evidence"* row of the Individual Acceptance & Review tracker.
**Captured:** 2026-08-24 11:27:57 UTC, at commit `d05710d`, against a **production build**
(`npm run build && npx next start`) with all three provider credentials live.

**Raw, unedited capture:** [`raw/curl-transcript.txt`](raw/curl-transcript.txt) — full status
lines, all response headers and all response bodies. This page is a reading guide to it.

## How to reproduce

```bash
npm run build
npm run capture:evidence
```

[`scripts/capture-evidence.sh`](../../scripts/capture-evidence.sh) boots the production server
six times, each with a different provider environment, drives the requests below through it
with `curl`, and writes both this evidence and the
[provider fallback log](provider-fallback-log.md). It exits non-zero if any response deviates
from the contract in [`api-contracts.md`](../api-contracts.md), so it doubles as a
contract regression check. It is deliberately not part of `npm test`: it needs real
credentials and makes real, billable calls.

The request payload used throughout is committed as
[`raw/request-valid.json`](raw/request-valid.json), so every command below can be pasted into
a shell verbatim.

## Results

All eleven cases behaved exactly as documented, first run.

| # | Case | Sent | Status | `code` | Provider called? |
|---|---|---|---|---|---|
| 1 | Valid request | well-formed idea, capacity 30 | `200` | — | yes (`x-provider-used: nvidia`) |
| 2 | Malformed JSON | truncated object | `400` | `INVALID_JSON` | **no** |
| 3 | Oversized body | ~20 KB, over the 16 KB cap | `413` | `PAYLOAD_TOO_LARGE` | **no** |
| 4 | Schema violation | `idea:"hi"`, capacity `900` | `422` | `VALIDATION_ERROR` | **no** |
| 5 | Unintelligible idea | consonant noise | `422` | `CLARIFICATION_REQUIRED` | **no** |
| 6 | Wrong method | `GET` | `405` | — | **no** |
| 7 | Failover, one hop | NVIDIA credential invalid | `200` | — | yes (`x-provider-used: groq`) |
| 8 | Failover, two hops | NVIDIA + Groq invalid | `200` | — | yes (`x-provider-used: gemini`) |
| 9 | Chain exhausted | all three invalid | `502` | `PROVIDER_ERROR` | yes, all three |
| 10 | Nothing configured | no credentials present | `502` | `PROVIDER_ERROR` | none attempted |
| 11 | Deadline exceeded | `AI_TIMEOUT_MS=1` | `504` | `TIMEOUT` | yes, all three aborted |

Cases 7–11 are analysed in [provider-fallback-log.md](provider-fallback-log.md), which carries
the server-side log for each.

---

## 1 — Valid request returns a schema-conforming plan

```bash
curl -sS -D - -o 200-response.json -X POST http://127.0.0.1:3100/api/scopecraft \
    -H 'Content-Type: application/json' \
    --data-binary @request-valid.json
```

```http
HTTP/1.1 200 OK
content-type: application/json
x-prompt-version: v5
x-provider-used: nvidia
```

A `200` carries exactly `content-type`, `x-provider-used` and `x-prompt-version` — no
provider URL, no model ID, no credential. Full body:
[`raw/200-response.json`](raw/200-response.json). Structural check from the capture:

```
  top-level keys        : 13 (problem, target_user, goals, non_goals, requirements,
                          user_stories, acceptance_criteria, risks, priority, effort,
                          sprint, sprint_plan, moscow)
  user_stories          : 3
  every story has AC    : true
  capacity_points       : 30
  committed_points      : 19
  committed <= capacity : true
  every story scheduled : true
```

> The counts above describe **this committed capture**. Re-running the script calls the live
> models again, so story and risk counts will differ; the structural invariants
> (`every story has AC`, `committed <= capacity`, `every story scheduled`) hold on every run
> and are what the script asserts.

`every story has AC` and `committed <= capacity` are the two shared acceptance criteria
(*"generated stories must have testable acceptance criteria; the sprint plan must respect
configured capacity"*), asserted here against a live response rather than a fixture.

## 2 — Malformed JSON is rejected before anything else

```bash
curl -sS -i -X POST http://127.0.0.1:3100/api/scopecraft \
    -H 'Content-Type: application/json' \
    -d '{"idea": "A study group matching app for students",'
```

```http
HTTP/1.1 400 Bad Request
```
```json
{"error":true,"code":"INVALID_JSON","message":"Request body must be valid JSON."}
```

## 3 — Oversized body is rejected on the size cap

```bash
python3 -c 'import json;print(json.dumps({"idea":"A study group matching app. "+"padding "*2600}))' > oversize.json
curl -sS -i -X POST http://127.0.0.1:3100/api/scopecraft \
    -H 'Content-Type: application/json' \
    --data-binary @oversize.json
```

```http
HTTP/1.1 413 Payload Too Large
```
```json
{"error":true,"code":"PAYLOAD_TOO_LARGE","message":"Request body is too large."}
```

The cap fires before `JSON.parse`, so an oversized body is never held in memory as a parsed
object. A declared `Content-Length` over the cap is rejected before the stream is read at all.

## 4 — Schema violation returns field-level issues and echoes nothing back

```bash
curl -sS -i -X POST http://127.0.0.1:3100/api/scopecraft \
    -H 'Content-Type: application/json' \
    -d '{"idea":"hi","team_capacity_points":900}'
```

```http
HTTP/1.1 422 Unprocessable Entity
```
```json
{"error":true,"code":"VALIDATION_ERROR",
 "message":"Some fields need attention before a plan can be generated.",
 "issues":[{"path":"idea","message":"Too small: expected string to have >=20 characters"},
           {"path":"team_capacity_points","message":"Too big: expected number to be <=500"}]}
```

Both failures are reported in one response. Note what is **absent**: neither `"hi"` nor `900`
appears anywhere in the body. Only Zod's `path` and `message` are forwarded; `received` and
`input` are dropped, so a rejected request can never reflect user data back to the caller.

## 5 — An unintelligible idea asks for clarification instead of inventing a plan

```bash
curl -sS -i -X POST http://127.0.0.1:3100/api/scopecraft \
    -H 'Content-Type: application/json' \
    -d '{"idea":"qwrtplkj zxcvbnmk hjklzxcv bnmqwrtp lkjhgfds"}'
```

```http
HTTP/1.1 422 Unprocessable Entity
```
```json
{"error":true,"code":"CLARIFICATION_REQUIRED",
 "message":"Please clarify the product idea before generating a plan.",
 "questions":["What problem should the product solve?","Who is the intended user?"]}
```

This is a local heuristic, not a model call — the check runs before any provider module is
touched, so an unusable request costs zero tokens.

## 6 — Only `POST` is routed

```bash
curl -sS -i -X GET http://127.0.0.1:3100/api/scopecraft
```

```http
HTTP/1.1 405 Method Not Allowed
```

---

## What this evidence establishes

- **Valid input conforms to the documented typed schema** — case 1, verified structurally
  against the live response, not a fixture.
- **Invalid input returns a safe 4xx and does not call the provider** — cases 2–6 return
  `400`, `413`, `422`, `422`, `405`. The ordering guarantee (size cap → parse → schema →
  clarification, all before any provider import) is additionally asserted by unit tests that
  spy on all three providers and on `global.fetch` and require zero calls.
- **Errors are user-safe** — every failure body is exactly `{error, code, message}` plus, where
  useful, `issues` or `questions`. No provider name, model ID, stack trace, request payload or
  credential appears in any response in the transcript.
- **Secrets stay server-side** — the capture script scans every file it writes for
  `nvapi-`, `gsk_` and `AIza` credential patterns and aborts on a hit. The run reported
  `CLEAN`.
