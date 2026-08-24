# Session 2 — Integration Lead Checklist (Nour's role)

> ## ⚠️ The contract in §1 is SUPERSEDED — do not build against it
>
> This is a **Session 2 historical record**, kept as-is so the decision trail stays
> intact. The API contract it froze has since changed in three ways, and anyone
> coding against §1 today would get it wrong:
>
> | Session 2 froze | Current contract |
> |---|---|
> | `idea` min **5** chars | min **20** chars |
> | one client error `400 INVALID_INPUT` | `400 INVALID_JSON` (syntax), `413 PAYLOAD_TOO_LARGE` (size), `422 VALIDATION_ERROR` (semantics, with `issues[]`) |
> | `X-Provider-Used: gemini\|groq` | `X-Provider-Used: nvidia\|groq\|gemini` |
>
> Four further codes were added after Session 2: `CLARIFICATION_REQUIRED` (422),
> `OUT_OF_DOMAIN` (422), `SCHEMA_VIOLATION` (502), `PLANNING_ERROR` (502).
>
> **Canonical contract: [`docs/api-contracts.md`](./api-contracts.md).** If that file
> and this one disagree, that file is right.
>
> _Superseded note added 2026-08-24 by Yousef (AI & Backend) — the change originated
> in the backend Module 5 error-taxonomy split. Flagged to Nour as the file's owner;
> the original text below is unmodified._

## 1. Freeze the API Contract
Everyone builds against this from now on — changing it requires team agreement:

- **Endpoint:** `POST /api/scopecraft`
- **Request:** `{ idea: string (min 5 chars), constraints?: string }`
- **Success (200):** full `ScopeCraftResponse` JSON (see `src/lib/scopecraft/schema.ts`)
- **Client error (400):** `{ error: true, code: "INVALID_INPUT", message }`
- **Provider error (502):** `{ error: true, code: "PROVIDER_ERROR", message }`
- **Provider timeout (504):** `{ error: true, code: "TIMEOUT", message }`
- Response includes header `X-Provider-Used: gemini|groq` so UI/QA can see which provider answered.
- User stories may include optional `dependencies: string[]`.

📌 Post this contract in the team channel — Joe builds the UI against it, Yasmin writes edge-case tests against it.

## 2. Merge Review Checklist (for every PR into `dev`)
- [ ] Does it match the frozen contract above? (no silently-renamed fields)
- [ ] Are secrets (`GEMINI_API_KEY`, `GROQ_API_KEY`) only in `.env.local`, never committed?
- [ ] Do the Session 2 tests pass (`npm test`)?
- [ ] Does it handle the provider-error case gracefully (no raw stack trace shown to user)?

## 3. Branch Sync
- Confirm `dev` still builds after merging Youssef's provider work + Joe's UI work together
- Resolve any schema-shape mismatches between backend and frontend immediately — don't let them pile up

## 4. Session 2 Checkpoint
- [ ] API contract frozen and shared with team
- [x] Youssef's provider + fallback code merged locally and covered by tests
- [ ] Joe's UI wired to real (not stub) endpoint
- [ ] Yasmin's edge-case tests passing against the real endpoint
- [x] `.env.example` file added to repo (key names only, no real keys)
