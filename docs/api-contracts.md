# API Contracts (Frozen — Session 2)

Owner: Nour (Integration Lead). Any change here requires team agreement.

## `POST /api/scopecraft`

### Request
```json
{
  "idea": "string, min 5 chars",
  "constraints": "string, optional",
  "capacity_per_sprint": "integer 1-100, optional; defaults to 10"
}
```

### Success — 200
Full `ScopeCraftResponse` (see `src/lib/scopecraft/schema.ts`), plus headers
`X-Provider-Used: gemini|groq` and `X-Prompt-Version: v2`.

Each item in `user_stories` may include:
```json
{
  "dependencies": ["US-1"],
  "value": 8,
  "risk": 5,
  "effort": 3
}
```
`dependencies` is optional for backward compatibility. When present, it must be
an array of unique story IDs, cannot contain the story's own ID, and the planner
rejects missing or circular dependencies.

`value` and `risk` are required integers from 1–10. `effort` is a required
positive integer. The provider supplies these estimates, but it does not control
the calculated output: the backend recalculates the top-level `priority` and
`effort` maps and every sprint item. Therefore each `priority[story_id]` always
matches its sprint item's `priority_score`.

### Client error — 400
```json
{ "error": true, "code": "INVALID_INPUT", "message": "..." }
```

### Provider error — 502
```json
{ "error": true, "code": "PROVIDER_ERROR", "message": "..." }
```

### Clarification required — 422
```json
{
  "error": true,
  "code": "CLARIFICATION_REQUIRED",
  "message": "Please clarify the product idea before generating a plan.",
  "questions": [
    "What problem should the product solve?",
    "Who is the intended user?"
  ]
}
```

Strongly gibberish-like multiword input is stopped before any provider request.
The check is conservative and does not reject an idea merely for being concise
or unfamiliar.

This response covers provider failures, malformed provider JSON, invalid
provider response shapes, and the absence of all usable provider credentials.

### Provider timeout — 504
```json
{
  "error": true,
  "code": "TIMEOUT",
  "message": "The AI provider timed out. Please try again shortly."
}
```

Each provider request has a 10-second timeout and is cancelled when that timeout
expires. Gemini failure triggers the Groq fallback. A timeout from the final
provider is returned as HTTP 504.

## Provider environment
- `GEMINI_API_KEY` enables Gemini.
- `GROQ_API_KEY` enables Groq.
- Gemini currently uses `gemini-3.5-flash-lite`.
- Groq currently uses `openai/gpt-oss-120b`.
- A missing key is detected before any network request is made.
- If Gemini is unavailable or its key is missing, the service attempts Groq.
- If neither provider can complete the request, the endpoint returns the
  controlled 502 response above. Secrets must never use the `NEXT_PUBLIC_`
  prefix or be committed to the repository.

## Ownership boundaries
- **Youssef** owns: schema shape, validation rules, provider logic, deterministic tools.
- **Joe** owns: how the response is rendered, all UI states (idle/loading/success/error).
- **Yasmin** owns: taxonomy values (impact/likelihood/MoSCoW), evaluation cases, source register.
- **Nour** owns: this document, and approves any breaking change to the above.
