# Session 2 — Integration Lead Checklist (Nour's role)

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
