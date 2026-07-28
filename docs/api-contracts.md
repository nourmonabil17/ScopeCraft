# API Contracts (Frozen — Session 2)

Owner: Nour (Integration Lead). Any change here requires team agreement.

## `POST /api/scopecraft`

### Request
```json
{ "idea": "string, min 5 chars", "constraints": "string, optional" }
```

### Success — 200
Full `ScopeCraftResponse` (see `src/lib/scopecraft/schema.ts`), plus header `X-Provider-Used: gemini|groq`.

### Client error — 400
```json
{ "error": true, "code": "INVALID_INPUT", "message": "..." }
```

### Provider error — 502
```json
{ "error": true, "code": "PROVIDER_ERROR", "message": "..." }
```

## Ownership boundaries
- **Youssef** owns: schema shape, validation rules, provider logic, deterministic tools.
- **Joe** owns: how the response is rendered, all UI states (idle/loading/success/error).
- **Yasmin** owns: taxonomy values (impact/likelihood/MoSCoW), evaluation cases, source register.
- **Nour** owns: this document, and approves any breaking change to the above.
