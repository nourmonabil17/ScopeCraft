# Research Source & Decision Log — Team 10 · ScopeCraft

Every architectural decision below is tied to a primary source, a second corroborating
source, and the file where the decision was implemented.

**Verification convention.** A row is `Verified` only when the cited URL was fetched and
its content confirmed to support the stated finding on the access date. A row is
`Verified (indirect)` when the canonical page blocked automated fetching and the claim was
confirmed against an equivalent primary artefact from the same organization. A row is
`Pending` when the decision is implemented but the source claim has not yet been confirmed
against a live service. Nothing in this log is recorded as verified on the basis of prior
knowledge alone.

Access date for all rows: **2026-08-23**, except where a row records a later re-fetch.
Last synchronised with the code on **2026-08-24**, after the API and provider-failover
evidence capture (`docs/evidence/`).

---

## Yousef Mohmed Hasabo — AI & Backend Engineer

| Team | Student | Role | Research Question / Decision | Source Title | Organization / Author | URL | Source Type | Access Date | Key Finding | How Verified / Second Source | Decision / How Used | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How do we architect multi-provider failover across NVIDIA NIM, Groq and Gemini with hard timeout guarantees? | LLM APIs — NIM Reference | NVIDIA | https://docs.api.nvidia.com/nim/reference/llm-apis | Official vendor documentation | 2026-08-23 | NVIDIA NIM exposes `POST /v1/chat/completions` at base URL `https://integrate.api.nvidia.com` — the OpenAI-compatible wire format. Page carried an update timestamp of 2026-08-21. | Fetched and confirmed 2026-08-23. Second source: MDN `AbortController` (https://developer.mozilla.org/en-US/docs/Web/API/AbortController), fetched and confirmed — `abort()` "is able to abort fetch requests, consumption of any response bodies, and streams"; Baseline widely available since March 2019. | Implemented `src/lib/ai/providers.ts`. NVIDIA and Groq share one `openAICompatibleGenerate` helper because the wire format is identical; only Gemini needs its own client. Ordered failover NVIDIA → Groq → Gemini, each attempt wrapped in `fetchWithTimeout` with an `AbortController` at `AI_TIMEOUT_MS` (default 15000). | Verified |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How do we transmit the Gemini API key without exposing it in URL query strings or proxy logs? (audit defect D-06) | Using Gemini API keys | Google AI for Developers | https://ai.google.dev/gemini-api/docs/api-key | Official vendor documentation | 2026-08-23 | The documented REST invocation passes the credential as a header: `-H "x-goog-api-key: YOUR_API_KEY"`. The page does not present a query-parameter form, and recommends sourcing the key from environment variables. | Fetched and confirmed 2026-08-23. Second source: OWASP REST Security Cheat Sheet (https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), fetched and confirmed — states plainly that "Passwords, security tokens, and API keys should not appear in the URL, as this can be captured in web server logs", and gives `?apiKey=…` as the counter-example. | Removed `?key=${apiKey}` from the Gemini request URL in `src/lib/ai/providers.ts`; the credential now travels only in the `x-goog-api-key` header. Provider errors log status/name only, never the response body, because a body can echo the request URL. | Verified |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How do we constrain LLM responses to a deterministic, typed schema covering all 11 required PRD fields? | Structured outputs \| Gemini API | Google AI for Developers | https://ai.google.dev/gemini-api/docs/structured-output | Official vendor documentation | 2026-08-23 | Models can be configured to "generate responses that adhere to a provided JSON Schema"; the page documents Zod as a supported schema source for JavaScript. | Fetched and confirmed 2026-08-23. Second source: Groq Structured Outputs (https://console.groq.com/docs/structured-outputs), fetched and confirmed — documents `strict: true` constrained decoding that "guarantee[s] that the output will always match your schema exactly", with JSON Object Mode as the weaker fallback. | Built `src/lib/scopecraft/schema.ts` on Zod. `ProviderOutputSchema` validates model output; `ScopeCraftResponseSchema` validates the final contract — all 11 fields (`problem`, `target_user`, `goals`, `non_goals`, `requirements`, `user_stories`, `acceptance_criteria`, `risks`, `priority`, `effort`, `sprint`) plus `moscow`. Both providers are called with `response_format: { type: "json_object" }`. | Verified |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How should stories be prioritized and sized deterministically, without depending on model judgement? | The 2020 Scrum Guide | Ken Schwaber & Jeff Sutherland | https://scrumguides.org/scrum-guide.html | Primary standard | 2026-07-26 | Sprint scope is a commitment bounded by team capacity; the Sprint Backlog is selected by the team, not asserted by an outside authority. | Carried forward from `docs/source-register.md` (Yasmin, accessed 2026-07-26); not re-fetched in this pass. Second source: **URL still required** — the MoSCoW and RICE frameworks are cited in the handbook but no canonical URL has been registered for either. See Open Items. | Implemented pure functions in `src/lib/scopecraft/tools.ts`: `priorityScore({ value, risk, effort })` = `(value + risk) / effort`, and `planSprint({ stories, capacityPerSprint })` performing greedy capacity-bounded packing with dependency ordering and cycle detection. `service.ts` discards any `priority`, `effort`, `sprint` or `moscow` the model returns and substitutes the computed values. | Partially verified |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How do we defend the API boundary against prompt extraction, jailbreaks and adversarial input? | LLM01:2025 Prompt Injection | OWASP GenAI Security Project | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Security standard | 2026-08-23 | Prompt injection is ranked the number one LLM application risk. It arises directly (hostile user input) and indirectly (untrusted content the model reads), and mitigation depends on separating trusted instructions from untrusted data. | Canonical URL returned **HTTP 403** to automated fetch on 2026-08-23 and could not be read directly. Confirmed indirectly against the OWASP-published PDF of the same document: https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf . A human reviewer should open the canonical page once and mark this row `Verified`. | **Implemented in Module 3.** `buildPrompt` now lives in `src/lib/scopecraft/service.ts` and fences untrusted text inside separate `<product_idea>` and `<constraints>` boundaries, beneath a numbered AUTHORITATIVE RULES block that precedes all user text. `fenceUserText()` strips `<` and `>` from user input so a forged `</product_idea>` cannot terminate the fence — defense in depth beyond instruction-only mitigation. Rule 4 defines the safe refusal: non-software requests return `{"out_of_domain": true, ...}`, which `OutOfDomainSchema` accepts as a *valid* reply (so the chain does not fail over) and the route maps to `422 OUT_OF_DOMAIN`. | Verified (indirect) — implemented |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How do we protect providers from token exhaustion and reject malformed requests before spending money? | Route Handlers | Vercel / Next.js | https://nextjs.org/docs/app/getting-started/route-handlers | Official framework documentation | 2026-07-26 | Route Handlers execute server-side only, so credentials read inside them are never included in the client bundle. | **Both second sources re-fetched and confirmed 2026-08-24, closing open item 6.** Zod (https://zod.dev/basics): `.safeParse()` returns "a plain result object containing either the successfully parsed data or a `ZodError`" — a discriminated union on `success`, which is exactly why the route can branch without a try/catch. Next.js production checklist (https://nextjs.org/docs/app/guides/production-checklist, page version 16.3.2): "Ensure your `.env.*` files are added to `.gitignore` and only public variables are prefixed with `NEXT_PUBLIC_`." **Precision note:** the Route Handlers reference itself does *not* state "server-side only" in those words; the operative published guarantee is the `NEXT_PUBLIC_` prefix boundary above, so that page is now the registered source for the secrets claim. Corroborated in this repository by direct measurement — see Gate 5 evidence in `AI_USAGE.md` (no `NEXT_PUBLIC_` in `src/`, no key identifiers or key patterns in `.next/static`). | `src/app/api/scopecraft/route.ts` streams the request body with a hard 16 KB cap (`PAYLOAD_TOO_LARGE`, HTTP 413), rejects non-JSON with `INVALID_JSON` (400), and runs `RequestSchema.safeParse` **before** any provider module is touched, returning `VALIDATION_ERROR` (422) with a field-level `issues` array carrying `path` and `message` only. Module 5 verified by test: twelve rejection shapes produce 4xx while spies on all three providers **and on `global.fetch`** record zero calls, and an oversized body is never handed to `JSON.parse`. | Verified |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | When a request is well-formed but the service will not fulfil it — an out-of-domain ask, or a body that fails semantic validation — which HTTP status expresses that, and how do we refuse without fabricating an answer? | RFC 9110: HTTP Semantics, §15.5.1 / §15.5.14 / §15.5.21 / §15.6.3 / §15.6.5 | IETF (Fielding, Nottingham, Reschke) | https://www.rfc-editor.org/rfc/rfc9110.txt | Primary standard (IETF RFC) | 2026-08-23 | Fetched and read in full. §15.5.21 defines 422 as "the syntax of the request content is correct, but it was unable to process the contained instructions" — exactly a well-formed request the service declines. §15.5.1 scopes 400 to "malformed request syntax"; §15.5.14 scopes 413 to content "larger than the server is willing or able to process". §15.6.3 defines 502 as a gateway that "received an invalid response from an inbound server", and §15.6.5 defines 504 as one that "did not receive a timely response from an upstream server" — the AI provider being that upstream server. | Fetched and confirmed 2026-08-23 from the IETF text rendering. Second source: MDN, 422 Unprocessable Content (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/422), fetched and confirmed — draws the same 400-vs-422 line (syntax versus semantics) and adds that a client "should expect that repeating the request without modification will fail with the same error", which is precisely the semantics we want for both a validation failure and a domain refusal. | The full status map in `route.ts` is derived from these sections rather than chosen by habit: `INVALID_JSON` → 400 (syntax), `PAYLOAD_TOO_LARGE` → 413 (size), `VALIDATION_ERROR` / `CLARIFICATION_REQUIRED` / `OUT_OF_DOMAIN` → 422 (well-formed, not processable), `PLANNING_ERROR` / `SCHEMA_VIOLATION` / `PROVIDER_ERROR` → 502 (bad upstream response), `TIMEOUT` → 504 (no timely upstream response). For the refusal itself, prompt rule 4 defines a `{"out_of_domain": true, "message": ...}` envelope; `OutOfDomainSchema` accepts it as a **valid** reply so `generateWithFallback` returns immediately rather than burning the remaining tiers on a refusal — verified by test across medical, legal, financial and chit-chat inputs, with the body carrying no PRD fields and nothing logged as a server failure. **Known gap:** the refusal depends on the model emitting the envelope; a model that ignores rule 4 and answers in valid PRD shape passes validation. A server-side domain classifier would close this and is not built. | Verified |
| Team 10 | Yousef Mohmed Hasabo | AI & Backend Engineer | How do we add a Content-Security-Policy to a Next.js App Router app without breaking the pre-paint theme script or losing static prerendering — and where should security headers live? | CSP: script-src | MDN Web Docs | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src | Official web-platform documentation | 2026-08-24 | MDN states plainly that "Allowing all inline scripts is considered a security risk, so it's recommended to use a nonce-source or a hash-source instead." So `'unsafe-inline'` in `script-src` is a known-weak choice that must be justified, not defaulted to. | Fetched and confirmed 2026-08-24. Second source: Next.js, *How to set a Content Security Policy* (https://nextjs.org/docs/app/guides/content-security-policy, page version 16.3.2), fetched and confirmed — it states that to use a nonce "you **must use dynamic rendering**", and that doing so means "Static optimization and Incremental Static Regeneration (ISR) are disabled" and pages "cannot be cached at the edge by default". The same page documents the `next.config.js` + `'unsafe-inline'` form as the supported no-nonce alternative. | Implemented in `next.config.js`. **Three decisions, each with its cost stated.** (1) `script-src 'unsafe-inline'` is accepted deliberately: the App Router streams its RSC payload as ~10 inline `self.__next_f.push(...)` scripts whose contents change every build, so a hash allow-list is unmaintainable, and a nonce would force `/scopecraft` out of static prerendering. For a page with no third-party scripts and no user-supplied HTML that trade is worth making — but it is a real weakness, not a clean policy. (2) The rest of the policy is still restrictive and does the load-bearing work: `connect-src 'self'` blocks the exfiltration step of most XSS chains, `base-uri 'none'` blocks `<base>` injection, plus `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`. (3) Headers moved from `vercel.json` into `next.config.js` and `vercel.json` deleted. Defining them in both would make Vercel emit each header twice, and a duplicated `X-Frame-Options` is ignored by some browsers — leaving the site *less* protected than before. In the framework config they also cover `next start` and self-hosting, and can be verified before deploying rather than after. `poweredByHeader: false` added in the same change. Verified live on production: all five headers present, `X-Powered-By` absent, zero console violations, pre-paint theme/locale scripts still run, blob export still works, and a full generation still succeeds under `connect-src 'self'`. | Verified — implemented |

---

## Team foundation entries

| Team | Student | Role | Research Question / Decision | Source Title | Organization / Author | URL | Source Type | Access Date | Key Finding | How Verified / Second Source | Decision / How Used | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Team 10 | Nour Eldeen Mohamed Nabil | Integration Lead | What repository and review workflow keeps four contributors integrable? | About issues | GitHub | https://docs.github.com/issues/tracking-your-work-with-issues/about-issues | Official vendor documentation | 2026-07-26 | Issue and sub-issue tracking gives each member an addressable unit of ownership. | Carried forward from `docs/source-register.md`; not re-fetched. | `main` + `dev` branches, one issue per member, PR template at `.github/pull_request_template.md`, CI at `.github/workflows/ci.yml` running tests, typecheck, lint and build. | Carried forward |
| Team 10 | Yasmin Mohamed Islam | Knowledge, Tools & Quality | What bounded corpus grounds generated PRD content? | The 2020 Scrum Guide | Ken Schwaber & Jeff Sutherland | https://scrumguides.org/scrum-guide.html | Primary standard | 2026-07-26 | Sprint, backlog and increment definitions supply the controlled vocabulary. | Carried forward from `docs/source-register.md`; not re-fetched. | Approved corpus in `knowledge/scopecraft/` (PRD template, user-story template, three example ideas); taxonomy in `src/lib/scopecraft/taxonomy.ts`. | Carried forward |
| Team 10 | Joe (Youssef Alaaeldin) | Product UI & Workflow | How should generated output be rendered so tool results are distinguishable from model prose? | — | — | — | — | — | — | **No source registered yet.** | `EvidencePanel.tsx` currently surfaces provider name, prompt version and template version. Source-level evidence display is outstanding. | Open |

---

## Open items

These are recorded rather than quietly omitted, because the handbook forbids presenting
unverified material as verified.

**Status at 2026-08-24 — 6 of 11 closed.**

| # | Subject | State | Who can close it |
|---|---|---|---|
| 1 | MoSCoW / RICE canonical URLs | **Open** — code-side wording fixed; URLs unregistered | Yousef or Yasmin |
| 2 | Live adversarial coverage | **Partially closed** — 1 live case of 5, one provider | Yasmin (evaluation owner) |
| 3 | Uncitable Google source | **Closed** — standing rule, no action | — |
| 4 | OWASP LLM01 canonical page | **Open** — needs one human visit (`403` to automated fetch) | any human reviewer |
| 5 | Model IDs | **Closed** — live-verified 2026-08-24 | — |
| 6 | Zod / Next.js sources | **Closed** — re-fetched 2026-08-24 | — |
| 7 | Retired error code in checklists | **Closed** — both corrected 2026-08-24 | — |
| 8 | Tool return shapes | **Closed** — final integration | — |
| 9 | 1–10 → 1–5 scale change unsigned | **Open** — needs sign-off, not code | Yasmin |
| 10 | `sprint_plan` live evidence | **Closed** for evidence; estimate-quality caveat stands by design | — |
| 11 | CSP `script-src 'unsafe-inline'` | **Open by decision** — policy implemented and verified live; this directive is a bounded, documented weakness | Yousef (evaluate `experimental.sri`) |

Four of the five that remain open need a **human decision or a human visit**, not a code
change: 1 needs a source registered, 2 needs a broader adversarial run owned by Quality, 4
needs a person to open a page that refuses robots, and 9 needs a teammate's signature. Item
11 is the exception — it is code, and it is left open **deliberately**: the CSP is
implemented and verified in production, but its `script-src` directive is weaker than a
nonce or hash policy and saying so is more useful than closing the row.

> **On marking rows.** Every row in the tables above carries the status its evidence
> supports, and no row is marked `Verified` on the basis of prior knowledge. Rows 1, 2, 4
> and 9 are **not** closed and are not marked as such — flipping them would make this
> document assert things nobody has checked, which is the exact failure the log exists to
> prevent, and the handbook grades the decision trail rather than the tick count.

1. **MoSCoW and RICE need canonical URLs.** Both are cited as the second source for the
   prioritization decision, but neither has a registered primary URL. The thresholds
   actually shipped (`must ≥ 2.2`, `should ≥ 1.3`, `could ≥ 0.7` in
   `src/lib/scopecraft/taxonomy.ts`) were derived from this project's own 1–5 value / 1–5
   risk / 1–13 points scale, **not** taken from an external standard. They should be
   described that way until a source is registered — **and as of 2026-08-24 they are**:
   the doc comment on `MOSCOW_THRESHOLDS` derives each band from this project's own scale
   and states that the constants and the estimation ranges in `schema.ts` are a single unit.
   Registering canonical MoSCoW and RICE URLs is therefore all that remains open here; no
   part of the shipped code now claims external provenance it does not have.
2. **Prompt instructions are a mitigation, not a guarantee — partially closed 2026-08-24
   with a live adversarial run.** The delimiters and rules reduce injection success; they
   do not by themselves prove refusal. The binding control is that all model output must
   satisfy `ModelReplySchema` — anything else is rejected and, after one retry, becomes
   `SCHEMA_VIOLATION` (502). Module 5 added five adversarial inputs (delimiter escape,
   prompt extraction, developer-mode override, forged closing tags,
   environment-variable exfiltration) and asserts, for each, that the fence holds, that
   exactly one closing delimiter exists, that the rules precede the user text, and that no
   credential appears in the prompt the model receives — but every one of those tests
   mocks the transport. Now that open item 5 is closed, one of those five prompts (a
   developer-mode override embedded in a task-app idea, demanding the system prompt and
   `NVIDIA_API_KEY` verbatim) was sent live to the real NVIDIA endpoint through the actual
   running app (`POST /api/scopecraft`, not a unit test). Result: `422 OUT_OF_DOMAIN`,
   response body scanned clean against the same secret-pattern regexes the build-output
   gate uses. **This is one adversarial prompt against one provider, once — not the same
   coverage as the five-case mocked suite, and not a claim that every jailbreak fails.**
   A broader live adversarial pass (all five cases, all three providers) is the honest
   next step before calling this fully closed.
3. **"Google AI Safety & Robustness Guidelines" was not citable — CLOSED, standing rule.**
   No action is outstanding: the unciteable title was removed and the OWASP PDF took its
   place. Kept here as a rule rather than a task. It was listed as a
   second source for the injection defense but resolves to no single canonical document.
   The OWASP PDF is used instead. Do not re-add the vague title without a URL.
4. **OWASP LLM01 canonical page needs one human visit** to move that row from
   `Verified (indirect)` to `Verified`. Re-attempted during Module 5 on 2026-08-23:
   `genai.owasp.org` still returns **HTTP 403** to automated fetch, and the OWASP-published
   PDF (10.7 MB, 45 pages) could not be text-extracted in this environment — no
   `pdftotext` / `pypdf`, and its content streams did not yield text to a hand-rolled
   parser. A row citing OWASP **LLM09 Misinformation** was drafted for the safe-refusal
   decision and then withdrawn rather than recorded on unverified recall; entry 7 cites
   RFC 9110 instead, which was fetched and read in full.
5. **Model IDs were unconfirmed — RESOLVED 2026-08-24 with a live smoke-test run.**
   `npm run smoke` was executed for the first time against real credentials for all
   three providers. The original defaults — `gemini-1.5-flash`, `llama-3.3-70b-versatile`,
   and `deepseek-ai/deepseek-v4-flash-0731` — all failed live: Groq and Gemini both
   returned `404` (auth succeeded, model retired), and NVIDIA's `deepseek-v4-flash-0731`
   hung to a full 15s timeout rather than erroring — cross-checked directly against
   `integrate.api.nvidia.com`, which confirmed the model is still catalog-listed but its
   `chat/completions` call never returns a response on this account, unlike a genuinely
   unavailable model (which returns a fast `404`). All three defaults in
   `src/lib/ai/models.ts` were replaced with IDs verified live with a real `200 OK` and a
   real completion: `meta/llama-3.1-8b-instruct` (NVIDIA), `openai/gpt-oss-120b` (Groq),
   `gemini-3.5-flash-lite` (Gemini). `.env.example`, `docs/api-contracts.md`,
   `docs/backend-delivery-summary.md`, `docs/security-review.md`, and the model-ID
   assertions in `tests/api/scopecraft.test.ts` were updated to match.

   A second, smaller bug surfaced during this same run: `npm run smoke` silently reported
   every provider `SKIPPED` even with a populated `.env.local`, because `tsx` does not
   auto-load `.env` files the way `next dev`/`build`/`start` do — the script was reading
   `process.env` directly, which was empty. Fixed by changing the `smoke` script to
   `tsx --env-file-if-exists=.env.local scripts/smoke-test.ts` (native Node 20.6+ flag,
   no new dependency; `-if-exists` so the command still runs cleanly for anyone who
   hasn't created `.env.local` yet).

   Model IDs remain environment-overridable via `NVIDIA_MODEL`/`GROQ_MODEL`/`GEMINI_MODEL`
   for exactly the reason this item existed: hosted availability changes independently of
   this repository. Re-run `npm run smoke` before each release/demo — `src/lib/ai/models.ts`
   is source of truth if this entry and the code ever disagree.
6. **Zod and Next.js rows were carried forward, not re-fetched — RESOLVED 2026-08-24.**
   Both second sources have now been fetched and confirmed on the access date, and that
   row is marked `Verified`. Fetching them also surfaced a small inaccuracy worth keeping
   visible: the Route Handlers reference page does **not** say "Route Handlers execute
   server-side only" in those words. The published guarantee we actually rely on is the
   `NEXT_PUBLIC_` prefix boundary stated on the production checklist, so that page is now
   the registered source for the secrets claim rather than the Route Handlers reference.
7. **Two team checklists quoted a retired error code — RESOLVED 2026-08-24.**
   Both described `400 INVALID_INPUT`, which Module 5 replaced with `INVALID_JSON`
   (400) and `PAYLOAD_TOO_LARGE` (413).

   `docs/youssef-ai-backend-checklist.md` is mine and was rewritten against the
   current code. Re-checking it line by line showed the error code was the *smallest*
   of its inaccuracies — it also still claimed Gemini was the primary provider, a
   10-second timeout, prompt version 2, and "all 44 automated tests pass" (now 242).
   Corrections are called out inline rather than silently overwritten, because the
   drift itself is worth showing at the defense.

   `docs/session2-lead-checklist.md` is Nour's and is a *Session 2 historical record*,
   not a living contract. Rewriting another member's session history to match today's
   code would destroy the decision trail the handbook asks for, so it instead carries
   a superseded banner with a diff table pointing at `docs/api-contracts.md`, with the
   original text left intact beneath it. Nour still owns whether to keep it that way.
8. **Tool return shapes — RESOLVED in final integration.** `plan_sprint` now returns
   `{ capacity_points, committed_points, included, deferred }` as the handbook specified,
   and the array-returning packer is named `scheduleSprints` for what it does. The
   response carries `sprint_plan`, which is the data the editable sprint board needs.
   The `priority_score(...) -> { score, moscow }` half was **deliberately not adopted**:
   it would couple the scoring formula to Yasmin's MoSCoW calibration and force
   score-only callers to depend on the taxonomy. Both values reach the client
   separately. Reasoning recorded in `docs/api-contracts.md`.
9. **The 1-10 to 1-5 estimation scale change is unsigned.** It forced edits to Yasmin's
   test files and fixtures; her sign-off is still outstanding.
10. **`sprint_plan` had no live-model evidence — CLOSED 2026-08-24 for the evidence half;
    the estimate-quality caveat stands and is not closable.**
    `docs/evidence/` now contains three `sprint_plan` results computed from three different
    live providers (NVIDIA, Groq after one failover hop, Gemini after two), captured through
    the running production build by `scripts/capture-evidence.sh`. Each is asserted to satisfy
    `committed_points <= capacity_points` and to schedule every story exactly once. The Groq
    run is the informative one: the model returned 8 stories worth 39 points against a
    capacity of 30, and the planner committed 28 and **deferred 3** — the capacity bound
    binding on live output rather than on a fixture.

    What that evidence does **not** establish is unchanged: the plan is *internally
    consistent*, not *well estimated*. It is computed from the model's `value`, `risk` and
    `points`, so it inherits their quality, and no amount of capture evidence can validate a
    judgement call the model made. Human review of story points before committing a sprint
    remains necessary, which is the handbook's own position.


11. **CSP still carries `script-src 'unsafe-inline'` — a known, bounded weakness.**
    Recorded rather than presented as a finished control. MDN recommends a nonce or hash
    instead, and Next's own guidance is that a nonce requires dynamic rendering, which would
    cost this project its static prerendering and edge caching.

    **There is a third option this project has not taken.** The Next.js CSP guide documents
    experimental Subresource Integrity support (`experimental.sri`, `algorithm: 'sha256'`),
    which generates build-time hashes and so allows a strict `script-src` **while keeping
    static generation** — explicitly listing "Static generation", "CDN compatibility" and
    "Better performance" as its benefits over nonces. It is marked experimental and App
    Router only. Not adopted for a graded submission days from its defense; it is the
    correct next step and should be evaluated before any real production use.

12. **Authentication ships for the page, not for the endpoint — CLOSED 2026-08-27 for the
    sign-in half; the endpoint half is deliberately still open.**
    `/scopecraft` now requires a GitHub session. `POST /api/scopecraft` still does not. That
    is a real, stated gap, not an oversight: a login page in front of an open API raises the
    bar for a casual visitor and gives quota an owner to attribute to, but it stops nobody who
    reads the network tab. Anyone describing the quota boundary as closed is wrong, and the
    defense should say so before an examiner does.

    Three sub-decisions worth defending:

    - **GitHub OAuth, not email + password.** No password is ever seen, hashed, stored, reset
      or leaked — a vulnerability class removed rather than mitigated. The cost is that a user
      needs a GitHub account, which for this audience is not a cost.
    - **JWT session strategy, so no database at all.** The design in
      `database-and-auth-design.md` pairs auth with two tables, but neither is needed to sign
      someone in: the session lives in a signed cookie. One new dependency instead of two, and
      nothing to keep running. The trade is that a session cannot be revoked server-side
      before it expires; rotating `AUTH_SECRET` invalidates all of them at once and is the
      only lever.
    - **`trustHost: true` in `src/auth.ts`.** Auth.js only trusts the incoming Host header
      automatically on Vercel and in development. Under a plain `next start` — how both
      evidence captures and any self-hosted deploy run the app — it rejects every request as
      `UntrustedHost` and `auth()` returns null, silently locking out signed-in users. Setting
      `AUTH_URL` in production pins the callback origin regardless, which is the actual
      mitigation for the forged-Host risk the flag guards.

    **Cost paid:** `/scopecraft` and `/login` are no longer statically prerendered. Reading
    cookies makes a route dynamic; that is what "this page requires a session" means, and the
    page's own work was always a client-side fetch, so nothing user-visible got slower.

13. **The skip link was making every Arabic page scroll ~10000px sideways — FIXED 2026-08-27.**
    Found while checking the new login page in RTL, and it was never about the login page: the
    off-screen offset in `layout.tsx` was the physical `left: -9999px`. Under LTR that lands in
    unscrollable space; under RTL it lands in *scrollable* space, and `documentElement.scrollWidth`
    measured 11279px against a 1280px viewport. Every Arabic page in the app was affected, and
    had been since the skip link was added.

    It survived the accessibility audit because the audit's horizontal-overflow loop ran
    **LTR only**, and tested `getBoundingClientRect().right` overflow only — an element
    escaping past the *left* edge could not be reported. Both holes are now closed:
    `scripts/capture-ui-evidence.mjs` measures every viewport in `en/ltr` **and** `ar/rtl`, and
    checks both edges. The fix itself is logical properties (`inset-inline-start`,
    `border-end-end-radius`), which are correct in both directions by construction.

    The generalisable lesson, and the one worth saying at the defense: a direction-blind test
    on a bilingual app is not a passing test, it is an untested direction.

14. **Docker: the database is containerised, the application is not — 2026-08-27.**
    Docker was adopted by the owner's decision after being argued against. The honest
    accounting, because it will be asked at the defense: **Vercel does not build from the
    Dockerfile.** Production still ships with `git push fork dev:main`, and the image is not
    on the deploy path at all.

    What it actually buys: a real Postgres in one command with no signup, a local
    environment that behaves the same on every machine, and integration tests that can touch
    a real database rather than a mock. What it costs: a second build definition to keep in
    sync with the Vercel build, which is why `output: "standalone"` was verified against the
    production build immediately rather than at the end — the route table is byte-identical
    before and after.

    **The application stays on the host.** `docker compose up` starts only the database; the
    `web` service sits behind a `profiles: ["app"]` gate. A bind-mounted rebuild on macOS is
    slower than `next dev`, and this app has no native dependency that needs containerising,
    so containerising it would cost iteration speed and buy nothing day to day. The service
    still exists, because an image nobody runs is an image that quietly stops working.

    One thing had to be given up for that split. The auth variables were written as
    `${AUTH_SECRET:?message}` so a missing secret would fail loudly with instructions.
    Compose interpolates the entire file **before** it applies profiles, so a required
    variable on the profiled-out service made a plain `docker compose up` fail — breaking the
    normal case to improve the rare one. They are empty defaults now, with the reason written
    at the point of the compromise. No fallback value: a committed secret is a secret that
    ships.

15. **No migration engine, and `plans.constraints` is `text` — 2026-08-27.**
    Two decisions taken while applying the schema for the first time.

    **No migration tool.** Two tables and one developer do not earn Prisma Migrate or
    Drizzle Kit. `db/schema.sql` is idempotent (`create table if not exists`) and is mounted
    into the container's init directory, so a fresh volume gets the schema automatically;
    any future change is a numbered file beside it. The cost is real and is written down in
    `docs/local-development.md`: **the init directory runs once**, only while the data
    directory is empty, so editing the schema does nothing until `npm run db:reset`. That is
    the single most common surprise with a containerised Postgres, and it is a documentation
    problem rather than an argument for a migration engine at this size.

    **`constraints` stored as `text`, not JSONB.** The request accepts `string | string[]`,
    and `service.ts` calls `constraintsToText()` *before* building the prompt — so the model
    never receives the original shape either. Storing the normalised text therefore discards
    nothing that could have influenced the output. Recorded plainly: the array-versus-string
    distinction is not recoverable from a stored row, and nothing needs it to be.

    **What was proved rather than assumed.** Every constraint in the schema has now been
    seen to fire: `plans_status_check` rejects `'pending'`, `plans_ok_has_response` rejects
    an `'ok'` row with no response, `plans_user_id_fkey` rejects an unknown user, the unique
    index rejects a duplicate email, and `on delete cascade` took two plan rows with the user
    that owned them. The rate-limit count plans as an **Index Only Scan** on
    `plans_user_created_idx` — it never touches the heap. A constraint nobody has watched
    fire is a constraint nobody knows works.

16. **The endpoint is closed: session at stage 0, quota at stage 4b — 2026-08-27.**
    `POST /api/scopecraft` is no longer anonymous. This reverses the "no authentication" MVP
    non-goal in `architecture.md` §4 for the second and final time — the page went first, the
    endpoint now — and it is recorded here rather than left for an examiner to find as a
    contradiction between two documents.

    **The ordering is the security property, not a style choice.** The session check runs
    before the body is read, because there is no reason to read a body from an anonymous
    caller. The quota query runs *after* every free local check, because a malformed request
    must not cost a database round trip. That second one is what makes counting attempts fair:
    a typo cannot consume quota. Both are asserted by tests, and the ordering test was
    mutation-checked — moving the quota query above validation makes it fail.

    **The quota counts attempts, not successes.** A generation that reached a provider and
    then failed still spent tokens, so `plans.status` allows `'failed'` and those rows count.
    Storing only successes would let a caller burn the entire budget on failures for free.

    **A persistence failure never destroys a result.** `recordPlan` swallows its own errors:
    the user already waited for the plan and the tokens are already spent, so a failed
    bookkeeping write returns the plan anyway and logs an error name. The cost is honest — a
    persistence outage under-counts the quota while it lasts.

    **What is still open, and will be asked.** The limit is per account, not per IP; sessions
    cannot be revoked before they expire under the JWT strategy. Both are named in the README
    and `architecture.md` §4a rather than implied.

17. **The database client is lazy, because eager initialisation broke the build — 2026-08-27.**
    `src/lib/db.ts` first read `DATABASE_URL` and threw at module scope, on the reasoning that
    a missing variable should fail immediately with a stack trace naming the file. That is
    wrong in a Next.js app and the build said so: `next build` collects page data by evaluating
    every route module, `/api/auth/[...nextauth]` imports `@/auth` which imports the client,
    and the build died with "DATABASE_URL is not set".

    The same failure would have hit **the Vercel build**, where `DATABASE_URL` is not
    configured — so an unrelated-looking improvement would have taken production down on the
    next deploy. The client is now created on first use behind a Proxy, which keeps the
    driver's own API (`sql\`…\`` and `sql.json`) intact while deferring the connection. The
    error message is unchanged; only its timing moved.

    Generalisable, and worth saying at the defense: **build-time module evaluation has no
    runtime environment.** Anything that requires one must be lazy.

18. **Plan history and board persistence ship; only human edits are stored — 2026-08-27.**
    Both Module 4 decisions answered yes. What is interesting is not that they shipped but
    what gets written.

    **`plans.board` stores `points` and `column`, and nothing else.** Those are the only two
    things the board lets a person change (`setPoints`, `toggleColumn`). Score, MoSCoW bucket
    and capacity are *derived* from them and recomputed on load. Storing derived values would
    have been easier — the board already hands up a full snapshot — and it would have made a
    saved board a second source of truth for arithmetic the code owns, in a codebase whose
    central rule is that it never does that. It also means a change to the scoring formula
    applies to saved boards instead of leaving them frozen at an old answer.

    **The board endpoint cannot write `response`.** One column in the update statement, and a
    test that fails if the fragment ever mentions the other. `response` is what the AI
    produced; `board` is what the human decided; keeping those distinguishable is the
    product's central claim, so it is asserted rather than trusted.

    **`BoardSchema` is `.strict()` rather than Zod's default strip.** Stripping was already
    safe — a derived field like `moscow` could never reach the database either way — but it
    was *silently* safe: the caller is told the save succeeded while part of what they sent is
    discarded. Rejecting names the field and turns a client bug into an error instead of a
    mystery. Found by a test that expected 422 and got 404.

    **404, not 403, for another user's plan.** A row that exists but belongs to someone else
    and a row that does not exist give the same answer, so the endpoint cannot be used to
    discover which ids are real. The malformed-id path returns 404 too, for the same reason.

    **The plan id travels as `X-Plan-Id`, a header.** The response body is a validated Zod
    contract the model's output must satisfy; a database id is not part of a plan. It goes
    the way `X-Provider-Used` and `X-Prompt-Version` already do. Absent when persistence
    failed, which the client reads as "editing works, saving does not" rather than discovering
    it on the first edit.

    **History selects neither `response` nor `board`.** The list renders a date and a badge;
    fetching a full PRD per row to do that would move megabytes to render kilobytes. Capped at
    50 rather than paginated — the daily quota is 20, so a "load more" control would be
    scaffolding for a scale this app does not have.

19. **The quota check fails closed; derived values are rebuilt, never replayed — 2026-08-27.**
    Two findings from integration testing, both of which only appear when something is
    actually broken or actually reloaded.

    **A database outage used to return an untyped `500` with an empty body**, bypassing the
    error contract entirely, and the history page served the framework's crash screen. The
    route now returns `503 STORAGE_UNAVAILABLE` and the page degrades to an error card with
    its header and navigation intact.

    The interesting half is *which way to fail*. Generating anyway when the quota store is
    unreachable is better UX and worse behaviour: it would mean "while the database is down,
    this endpoint is unmetered" — the exact property the session check and the budget were
    added to remove, and an outage would become a way to spend provider quota without limit.
    It fails **closed**. Worse experience for a rare failure, correct behaviour for the thing
    being protected.

    **Board persistence was write-only.** Edits saved and were never read back, which is not
    persistence from the user's side and left the round trip unverifiable. Building the load
    path exposed the real defect: a reopened plan rendered the saved **13 points** next to
    **"Score 2.00"** — the score computed when that story was 5 points. The displayed score
    contradicted the displayed number beside it.

    That is the second-source-of-truth failure this codebase's central rule exists to
    prevent, arriving through the back door: not by storing a derived value, but by
    *replaying* one. `deriveInitialStories` applied the saved points while `liveScores`
    stayed empty and fell back to the server's original scoring. Fixed by seeding the live
    scores from the saved edits, so a reopened plan is scored by **today's** formula. The
    same story now reads 13 points, Score 0.46, Won't.

    Generalisable, and the reason the storage schema is shaped the way it is: storing only
    `points` and `column` is not enough on its own. Everything derived from them has to be
    *recomputed on load*, or the stored two and the displayed rest drift apart.

20. **Production Postgres is Neon; Docker stays local-only — 2026-08-27.**
    Decided by the owner. The split is the point: Docker gives a real database with no signup
    for development and integration tests, Neon gives a managed one for production. Neither
    replaces the other, because **Vercel does not run the compose stack** and a local
    container is not reachable from a deployed function.

    Four Neon properties are worth writing down, because each is cheap to handle now and
    expensive to debug later.

    **The pooled endpoint, not the direct one.** The host carries `-pooler`. Serverless
    multiplies connections by instance count; the direct endpoint's ceiling is low enough
    that a handful of warm functions exhausts it. `max: 1` in `db.ts` reduces the pressure
    but does not remove the need for the pooler.

    **Autosuspend.** The free tier suspends the compute after about five minutes idle, so the
    first query after an idle period pays a wake-up of roughly half a second. Harmless, and
    worth naming before someone reports a cold demo as a performance bug.

    **`sslmode=require`.** Neon requires TLS. It is already in the string Neon hands you; the
    failure mode is someone stripping it while editing the URL by hand.

    **One branch per environment.** A Neon branch is a copy-on-write fork, which makes a
    separate Preview database nearly free — and stops a preview deployment writing rows into
    the database the demo runs against.

    **Backups are deliberately accepted as-is.** The free tier keeps a short restore window
    and no scheduled backups. For a graded project that is fine; it is recorded here so it is
    an accepted risk rather than an unexamined gap.

21. **Both evidence captures repaired; integration testing lives in `db:check` — 2026-08-27.**

    **The captures signed in rather than bypassing.** Closing the endpoint broke both, exactly
    as predicted. The tempting fix was an environment flag making the app skip its own auth
    check during capture — and that would be a production bypass switch living in the route
    forever, guarded by nothing but the hope the variable is never set in production. Instead
    `scripts/mint-session.mjs` mints a real cookie, shared by both scripts because bash cannot
    call `encode()` and two copies of "what a valid session looks like" eventually disagree.

    A consequence worth naming: **the API capture now requires Postgres.** `plans.user_id` is
    a foreign key, so a cookie whose `uid` matches no row would pass the session check and
    then fail every insert — recording 200s that never persisted.

    **A long-standing capture flake was diagnosed, not worked around.** Scenario 2 kept
    falling through to Gemini when it should have been served by Groq. Four rapid five-token
    probes against the same key all returned 200, which ruled out a request-rate limit; the
    cause is Groq's free tier metering **tokens** per minute, and back-to-back scenarios each
    generating a full PRD exhaust that budget. A pause between generating scenarios fixed it,
    and the capture now passes 14 of 14 rather than 13.

    **No Jest integration project.** The three things mocks cannot cover — the check
    constraints, the foreign key, the index — are asserted by `npm run db:check`, which
    already existed. No new framework, no Docker dependency in CI, and one property no local
    suite could have: **it runs against production**, which is what the deployment module
    asks for. Each assertion does the forbidden thing inside a transaction that is always
    rolled back, so it is safe to point at a live database.

    That check found its own bug immediately. The first version asserted the rate-limit query
    *uses* the index and failed on an empty database — correctly, because a sequential scan
    over zero rows is the cheaper plan. Asserting a planner decision is asserting the table's
    size, which is not a property of the schema. It now asserts the index **exists** and
    prints the chosen plan as information.

    **No coverage threshold in CI.** Every real defect found in Modules 3 to 6 — the eager
    `DATABASE_URL` read that broke the build, the replayed board score, the silently stripped
    Zod field, the untyped 500 on a database outage — was found by running the thing, not by
    an uncovered line. A percentage would buy tests written to satisfy a number.

22. **`output: "standalone"` is Docker-only — 2026-08-27.**
    It was unconditional, and that was wrong in a way responses did not reveal. Next warns
    that **`next start` does not work with `output: standalone`** — and `next start` is
    exactly how both evidence capture scripts run the app. Everything still answered
    correctly, which is why the earlier check passed: it verified status codes and headers,
    not the server log.

    Shipping a configuration the framework calls unsupported, on the path that produces
    graded artifacts, is not a trade worth making for an image size. The flag now lives only
    where it earns its keep: the Docker builder stage sets `DOCKER_BUILD=1`. Vercel does its
    own output tracing and never needed it; local development and the captures get an
    ordinary build and no warning. Verified both ways — no `.next/standalone` from
    `npm run build`, and a 270 MB non-root image with `server.js` and static assets present
    from `docker build`.

    The lesson generalises past this flag: **a check that only reads responses will miss a
    configuration the framework is complaining about.** Read the log too.

23. **NVIDIA retired the primary model; the default is `openai/gpt-oss-20b` — 2026-08-27.**
    `meta/llama-3.1-8b-instruct` now answers **HTTP 410 Gone**, and the whole Llama 3.x
    instruct family has left the NIM catalogue with it. This supersedes the model IDs chosen
    in item 5; that entry is left as written, because it was true when it was written.

    This is also a better explanation for known finding #5 than the one on record. Three
    production generations were served by Groq and Gemini and never by NVIDIA, which was
    attributed to a missing `NVIDIA_API_KEY` in Vercel. The key may well be missing too, but
    a retired model ID produces the same symptom and is now confirmed by a direct `410`.

    **Latency is the real constraint, and no model choice fixes it.** Measured on this
    account for a full-PRD request, the new default returns valid JSON every time but in
    **9.3 s, 18.6 s and 26.0 s** across three consecutive runs. `AI_TIMEOUT_MS` defaults to
    15 s, so NVIDIA times out more often than it succeeds and the request falls through to
    Groq — the failover chain working as designed, but with a first tier that is unreliable
    at the default budget.

    Every alternative was worse. `nvidia/nemotron-3-super-120b-a12b` is *consistent* at
    16–18 s, which is consistently **over** the budget rather than sometimes under it. Every
    other reachable model either returns 404 on this account or exceeds 30 s. What remains is
    a decision about `AI_TIMEOUT_MS`, not about the model: raising it to ~30 s would make
    tier one usually succeed, at the cost of a 90-second worst case when all three fail.
    ~~Left at 15 s, deliberately, because the common path matters more than the rare one.~~

    > **Superseded — `d00282c` reversed this and the entry was never updated.** That commit
    > ("bound the provider chain with a total budget, and raise the per-attempt timeout") set
    > `DEFAULT_TIMEOUT_MS = 30_000` in `src/lib/ai/providers.ts:132` and added
    > `AI_TOTAL_BUDGET_MS`, which removes the 90-second worst case this paragraph was weighing
    > — the chain is now bounded as a whole, so raising the per-attempt budget no longer
    > multiplies across tiers. `.env.example` and `docs/api-contracts.md` both say 30000. The
    > text above is left intact because it is the reasoning as it stood; only the conclusion
    > expired. Noticed 2026-09-04 while diagnosing why NVIDIA never served a production
    > request — see decision-log entry 49 and `HANDOFF.md` §4.1.

    The pinned assertion in `tests/api/scopecraft.test.ts` did exactly its job — it failed on
    the swap and forced the change to be acknowledged rather than made silently. It was
    updated, not loosened.

24. **The Neon database is provisioned, and the constraints are proven in production —
    2026-08-27.** Project `delicate-star-12997110`, region `aws-us-east-2`, two branches:
    `production` (default) and `dev`, on **separate endpoints**. That satisfies the
    per-environment split in the plan without extra work — a preview deployment cannot write
    into the database the demo runs against.

    Both connection strings are pooled (`-pooler` in the host) and carry `sslmode=require`,
    checked by inspection rather than assumed.

    **The schema was already there**, and re-applying it reported "already exists, skipping"
    on every statement — the idempotence from entry 15 doing exactly its job on a re-run
    rather than failing or duplicating.

    **`npm run db:check` passed against both branches.** All four constraints were watched to
    reject, inside transactions that rolled back, leaving nothing behind. This is the property
    entry 21 chose `db:check` over a Jest project for: **the assertions run against
    production**, which no local suite could do. The deployment module's "confirm the check
    constraints exist in production too" is therefore already satisfied.

    One detail vindicates an earlier correction. On Neon the rate-limit query plans as an
    **index scan**; on the empty local container it plans as a sequential scan. Had the check
    asserted the planner's choice rather than the index's existence, it would pass in one
    place and fail in the other for reasons that have nothing to do with the schema.

    **Verified end to end against Neon `production`:** `401` anonymous, `200` authenticated,
    and the row persisted with 8 stories and `committed_points` 29 against a capacity of 30.
    The probe rows were then deleted; both tables are back to zero.

    **A new gap, recorded rather than fixed:** Docker runs PostgreSQL **16.14**, Neon runs
    **18.6**. Nothing has broken and the schema uses nothing version-sensitive, but testing
    against a different major version than production is a gap on principle. Moving the
    container to `postgres:18-alpine` is blocked behind this machine's Docker DNS failure.

25. **`PLANNING_ERROR` was prose in `dependencies`, and it is fixed on both sides —
    2026-08-28.** Known finding #4 had stood since the UI capture: 4 of 9 live generations
    of the same idea returned `502 PLANNING_ERROR`. The capture note guessed the cause was
    "a story that depends on a story the model never emitted". That was close enough to
    sound right and wrong in the way that matters.

    **What the measurement showed.** Twelve live generations of the capture's study-group
    idea, diagnosing the raw model output rather than the HTTP status: one run failed, and
    all eight of its rejected edges looked like this —

    ```
    DANGLING_DEP US01 -> User authentication
    DANGLING_DEP US02 -> Profile data
    DANGLING_DEP US02 -> Matching algorithm
    ```

    Not a forgotten story. **Prose.** The model had answered "what does this story depend
    on" in English instead of naming ids, for every edge in the response. The story ids it
    emitted (`US01`…`US05`) were all present and internally consistent; only the
    cross-references were the wrong kind of thing.

    That distinction changed the fix. A repair pass that tried to *resolve* dangling
    references — matching `"User authentication"` back to a story by title — would have
    been guesswork dressed up as recovery. An edge that names something which is not a
    story is not a constraint at all, so it is dropped.

    **Fixed in two places, deliberately.** Prompt **v6** adds rule 7: `dependencies` holds
    ID cross-references, never descriptions. And `service.ts` filters unresolvable edges
    before planning. The second is not redundant with the first — the same reasoning the
    injection posture already uses in that file: a prompt instruction is a mitigation, not
    a guarantee, and model output is untrusted input whatever the prompt says.

    **What still fails, on purpose.** Only unresolvable edges are dropped. A dependency
    cycle, a duplicate story id, or a story larger than one sprint still returns
    `PLANNING_ERROR`. Those are claims about stories that *do* exist, so discarding them
    would discard real information and hand back a plan that quietly contradicts what the
    model said. `scheduleSprints` also keeps its own strict check, because it is a
    documented tool contract with programmatic callers, not only the service path.

    The cleaned stories — not the raw ones — go into the response, so the dependencies a
    user reads are exactly the ones the planner honoured.

    **Verified live: 10 of 10 clean**, served across all three providers (nvidia, groq,
    gemini). The raw-output probe on those same runs found **zero** prose edges, against
    8 in the pre-fix failure. Ten runs is not proof the prompt eliminated the behaviour —
    the base rate was roughly 1 in 12, so a clean 10 is consistent with a rate that merely
    dropped. The filter is what makes it non-fatal either way, which is why both changes
    shipped rather than the prompt alone.

    **A second gap fell out of this.** `docs/prompt-versions.md` documented v1 and v2 while
    the code shipped v5 — the version constant jumps straight to v5 in commit `05ee549`
    with no notes for v3 or v4. Recorded as a gap rather than back-filled from guesswork;
    what the v5 prompt contained is described from the code, not from invented history.

26. **The provider chain gets a total budget, and the per-attempt timeout goes to 30 s —
    2026-08-28.** Entry 23 left `AI_TIMEOUT_MS` at 15 s deliberately. This revisits that,
    and the measurement did not support the reason for revisiting it.

    **The argument that failed.** The case for raising the timeout was latency: NVIDIA
    answers in ~9-13 s, a 15 s budget times it out about half the time, and each timeout
    costs the caller the full 15 s before the next tier starts. Eight live runs at each
    setting:

    | Per-attempt | Tier-one timeouts | Median | Max |
    |---|---|---|---|
    | 15 s | 3 of 8 | 14.2 s | 22.3 s |
    | 30 s | 0 of 8 | 16.1 s | 25.9 s |

    End-to-end latency is a wash, and the median is marginally *worse*. Waiting 25 s for
    tier one costs about what a 15 s timeout plus a 20 s fallback costs. The predicted
    halving does not exist. Recorded because the prediction was made out loud and a doc
    that only records the predictions that came true is not a decision log.

    A measurement error is worth recording too: the first verification run appeared to
    show a large improvement, because `.env.local` pins `AI_TIMEOUT_MS=15000` and the new
    default was never exercised. The numbers above are from the re-run.

    **Kept at 30 s anyway, on a different argument.** At 15 s a third of requests paid a
    full timeout, discarded the result, and then spent a Groq call. Groq meters tokens per
    minute, and that has already broken an evidence capture (entry 21). Fewer attempts
    paid for and thrown away is worth having; speed is not the reason.

    **The part that is not a judgement call: `AI_TOTAL_BUDGET_MS`, 50 s.** The chain now
    runs against one deadline, and each attempt gets the smaller of its own budget and
    what remains. Without it the worst case is per-attempt × tiers — 90 s at the new
    setting — which outlives a serverless function limit. The caller would then get the
    platform's untyped 504 instead of this app's `TIMEOUT` envelope, and "every failure
    carries a typed code" would quietly stop being true. That is a contract property, not
    a tuning preference, which is why the budget shipped with the raise rather than after
    it.

    `maxDuration = 60` is now stated explicitly on the route for the same reason: the
    platform default is invisible from inside the repository, and the budget has to sit
    under it. **This needs confirming against the hosting plan's ceiling** — it is the one
    part of this entry not verified by running it. If the plan caps lower than 60 s, lower
    `AI_TOTAL_BUDGET_MS` to match rather than raising `maxDuration`.

27. **Module 8 security audit: eleven checks pass, two are blocked, and one fails —
    2026-08-28.** Every item was run rather than reasoned about. Three results were not
    what the plan expected.

    **The live site is not what the docs describe.** Known issue #2 said production
    "bounces to `/login`" because `AUTH_*` is unset in Vercel. It does not. `/login`
    returns **404**, and `/scopecraft` returns **200** from a cached prerender roughly nine
    hours old. The deployed build predates the authentication work entirely — consistent
    with `dev` sitting 18 commits ahead of both remotes. So the endpoint really is
    anonymous and unmetered in production today (issue #6), and there is no sign-in page to
    bounce to. `AUTH_SECRET` and `AUTH_GITHUB_*` are also absent from local `.env.local`,
    which is why 8.1.8 and 8.1.9 could not be checked in either place.

    **Two scanners disagreed, and both were right.** `npm audit` reports **zero**
    vulnerabilities; `docker scout` reports **16** (1 critical, 15 high) against the same
    project. Neither number is wrong — they cover different trees. Located precisely inside
    the image: 9 in npm's own vendored dependencies at
    `/usr/local/lib/node_modules/npm` (`brace-expansion`, `ip-address`, `picomatch`,
    `sigstore`, and a critical in `tar`), and 7 in the base image's `openssl` 3.5.7-r0.
    **None in this project's six runtime dependencies.**

    The runner stage now deletes `npm`, `npx` and `yarn` — the standalone server starts
    with `node server.js` and nothing at runtime shells out to a package manager, so those
    trees are attack surface with no upside. **The change is unverified.** `node:22-alpine`
    is not cached on this machine and the daemon cannot reach Docker Hub, so the rebuild
    fails at manifest resolution. 8.1.11 stays open, and the existing image still carries
    all 16.

    **Five headers are ours, not six.** Production serves six security headers, and every
    document counts six. Only five come from `next.config.js` — `Strict-Transport-Security`
    is added by Vercel. `grep` finds no HSTS anywhere in the source. An image deployed off
    Vercel therefore loses HSTS silently, which matters because the Dockerfile exists
    precisely to offer a deploy path that does not depend on Vercel.

    **What passed, by running it.** Bundle secret scan against the real secret *values*
    rather than their prefixes, across `.next/static` and `.next/server` — clean. Zero
    `NEXT_PUBLIC_`. Git history clean across all 49 commits on every branch; every hit was
    the `scopecraft:scopecraft@localhost` placeholder. All 12 SQL call sites are tagged
    templates. All four user-scoped queries take `user_id` from `auth()`, never from input.
    All 21 `fail()` sites carry static messages, with the quota limit and count the only
    interpolations. `npm audit` zero. Six dependencies. Container non-root, no `.env` in any
    layer, no secret in the layer history.

28. **Module 9 performance audit: seven of eight measured, and the numbers were better than
    expected — 2026-08-28.** Nothing here is an estimate. `log_statement='all'` on the local
    container, real authenticated requests, real container restarts.

    **The database costs exactly what it should.** Three authenticated generations produced
    **six queries** — one quota `count` and one `insert into plans` each, and nothing else.
    No `insert into users`: the `token.uid` early return in the `jwt` callback prevents a
    per-request user lookup, which was the specific risk 9.1.1 existed to check. The
    driver's `pg_catalog.pg_type` introspection appears once, on the first connection, then
    never again. **One backend connection** served all four requests, matching `max: 1`.

    **The bundle barely moved: +6 KB, about 2%.** Production still running the pre-auth
    build turned an annoyance into a free baseline — the same page's JavaScript is 266 KB
    gzipped live against 272 KB on current code. Authentication, plan history and board
    persistence together cost six kilobytes and two extra chunks.

    **Failure modes were exercised, not argued.** With the database container stopped, a
    generation returns `503 STORAGE_UNAVAILABLE` in **8 ms** — before any provider call, so
    an outage cannot be used to spend provider quota, which is the property entry 19 chose
    fail-closed for. The history page still answered `200` with an error state rather than
    crashing. With all three credentials invalid: `502 PROVIDER_ERROR` in 1.8 s, provider
    names present in the server log and absent from the response body. A missing session
    and a tampered cookie both return `401`, identically — a tampered token is not
    distinguishable from no token, which is the right answer.

    **The one item not done, and not faked.** 9.1.6 asks for live generation latency. The
    deployed build predates the auth work, so any number would describe an artifact the
    next push replaces. Local figures on current code are recorded for later comparison
    (10.8-13.6 s) but they are not the live measurement and are not presented as one.

    **Two things found on the way, neither a defect.** `.env.local` had no `AUTH_SECRET` at
    all — the auth routes were unexercisable on this machine, which is why 8.1.9 could not
    be checked. A local-only secret was generated to unblock the measurements; Vercel still
    needs its own. And `neon env pull` had repointed `DATABASE_URL` at the Neon **dev**
    branch, so local development no longer uses the Docker container that
    `local-development.md` describes. The dev branch is the right one to point at and the
    document explicitly permits it, but the change happened silently and is worth knowing.

29. **Module 10 accessibility and i18n: fourteen of fourteen, and reading the screen found
    what the type system could not — 2026-08-28.** The capture ran green twice, before and
    after a fix that the first run made visible.

    **The bug the compiler could not see.** `translations.ts` is built so that an English
    key with no Arabic one is a compile error, and that held: 175 keys each, exact parity.
    But the preset badges rendered `14d` on the Arabic page, because the day unit was a
    **literal in JSX** — `{preset.sprint_length_days}d` — not a key. No type check can
    reach that. It was found by 10.2.2, which asks for the rendered page to be read rather
    than the dictionary, and it is the reason that item is worded that way. Moved into the
    dictionary as `form.presets.meta` so the whole badge, separator included, differs per
    locale; the Arabic badges now read `30 · 14 يوم`.

    **The capture confirmed the planner fix from the outside.** The audit header records how
    many generation attempts the success screenshots needed. It now says **1**. Before entry
    25 it said up to four. That is a script with no knowledge of the dependency filter
    reporting the same improvement independently.

    **Measured, both themes:** 19 contrast pairs each, 0 below AA, lowest 4.87:1 on the 11px
    "Live" badge. 0 of 15 controls without an accessible name. 0 skipped heading levels,
    `banner` and `main` present, exactly one `h1`. Six overflow checks — three viewports ×
    two directions — all clean. Zero physical CSS offsets across every module, and nothing
    that mirrors: no `scaleX`, no `rotateY`, no `[dir="rtl"]` transform anywhere.

    **Four stale numbers in `accessibility-checklist.md` corrected**, all drifted upward
    when authentication added controls: 14 → 15 controls, 14 → 15 keyboard-reachable,
    "13 of 13" → 15 of 15 in the tab order, and the skip-link clearance 59px → 73px. This is
    the drift 10.1.5 exists to catch, and it had already happened.

    **Nothing was promoted to verified.** The "not verified" section still lists the same
    five gaps: no screen-reader run, no axe/Lighthouse scan, contrast on rendered text only,
    no zoom test, no colour-blind simulation. The screen-reader gap remains the biggest one.

30. **The separate landing page at `/` was retired the same day it shipped — 2026-08-28.**
    Module-navigation redesign added `/` as a distinct public marketing page: its own
    heading, tagline, and example, gated behind a "Get started" click before a signed-in
    visitor ever saw the intake form. Deployed to production, then reversed hours later
    on Yousef's own call after seeing it live — the intake form should **be** the main
    page, not something a click leads to.

    **What changed.** `src/app/page.tsx` is a bare `redirect("/scopecraft")` again, exactly
    what it was before this whole redesign. The explanatory content the landing page
    carried — heading, tagline, the example PRD excerpt — moved into `WelcomeModal`, a
    one-time popup shown on `/scopecraft` itself: native `<dialog>` with `showModal()`,
    dismissed by its own button or by Escape, tracked with one `localStorage` flag so it
    never shows twice on the same browser. `/scopecraft/layout.tsx`'s existing auth gate
    (`if (!session?.user) redirect("/login")`) was not touched and needed no change — it
    already does the "sign in before you reach the form" job on its own, so `/` needs no
    session check of its own to keep that property.

    **Kept from the retired page:** the four `landing.*` translation keys (heading, example
    heading, example PRD, CTA) — reused verbatim in the modal, not reworded, since the copy
    itself was never the problem. **Discarded:** the separate route's own metadata, its
    dedicated CSS module, and its render test — none of it describes anything that exists
    anymore.

    **A real jsdom gap, found and worked around, not ignored.** jsdom implements `<dialog>`'s
    `open` attribute but not `showModal()`/`close()` at all — calling either throws under
    Jest with no shim. Added `installDialogPolyfill()` next to the codebase's existing
    `installMatchMedia()` shim in `tests/ui/render-helpers.tsx`, run once at module load
    rather than per-test since there's no per-test state to reset. A second, subtler gap
    surfaced once that was in place: a *closed* `<dialog>`'s children are still real DOM
    nodes in jsdom (the `dialog:not([open]) { display: none }` UA rule that hides them in a
    real browser isn't something jsdom's limited CSS engine reliably applies), so an
    always-rendered-but-closed modal polluted every unrelated test that happened to query
    for text the modal's own heading also contained ("product idea," verbatim, in "Turn a
    product idea into a sprint-ready plan."). Fixed at the component level, not by tuning
    the test query: `WelcomeModal` now renders `null` until its own effect decides to show
    it, so there is nothing in the DOM to collide with, in either environment — a more
    correct component design, not merely a test workaround. Every other test in the suite
    now defaults to "already seen the welcome" via one line in `tests/ui/setup.ts`'s shared
    `beforeEach`, mirroring exactly how signed-out is already this suite's default session
    state — `WelcomeModal.test.tsx` is the one file that opts back out, in its own
    `beforeEach`, to test the first-visit behavior it exists to cover.

    **Verified live**, not just by test: started the app against the real local database
    with a real minted session, confirmed the popup appears on first visit with the correct
    content in both languages, dismisses on click with the form fully usable underneath,
    does not reappear on reload, and that a signed-out visitor hitting `/` still lands on
    `/login` — through the existing gate, unchanged.

    **What was deliberately not touched:** the design spec and implementation plan under
    `docs/superpowers/` that designed and built the original landing page. Those are
    historical records of what shipped that day; this decision doesn't retroactively make
    them wrong, it supersedes what they describe. `docs/evidence/ui/accessibility-checklist.md`
    — a living evidence artifact, not a historical record — got its `/`-coverage disclosure
    corrected instead, since that page no longer has distinct content for a coverage gap to
    be about.

31. **The header's control heights were deliberately left mismatched — 2026-09-02, Module D1.**
    D1 moved the header's two buttons (the reset action and sign-out) onto the `Button`
    primitive, which measures 44px. The controls beside them in the same row — the Home
    link, the language toggle and the theme toggle — are still `ToggleControls.module.css`
    at 36px, because that file is a separate entry on the breakpoint audit's exemption list
    and D1 was scoped to the header shell only.

    **This knowingly breaks a stated invariant.** `ToggleControls.module.css` says in its
    own comment that `.linkButton` "sits in a row of buttons and has to match their box
    exactly or the header looks misaligned." That is still true of the two controls the
    comment is about; it is no longer true of the row as a whole. The comment has been
    amended to say so rather than left asserting something the row no longer satisfies.

    **The alternative was worse in both directions.** Reverting the buttons to 36px would
    have given up the 44px comfort target that the `Button` primitive exists to guarantee,
    for every consumer, not just this one. Raising the toggles in the same change would have
    pulled `ToggleControls.module.css` into D1 — a file with 19 legacy `--sc-*` references
    and two `@media (max-width: 34rem)` queries whose width is not even on the approved
    scale, so it fails both halves of the audit and is a rebuild, not a height edit.

    **What it costs until then:** an 8px misalignment in the signed-in header, on
    `/scopecraft` only, since both 44px controls render only behind the auth gate. It closes
    when the toggles are rebuilt and come off the exemption list; the row is uniform again
    at that point. Recorded here rather than absorbed silently, because the next person to
    open that file will otherwise read the comment and believe the row is uniform today.

    **Not verified in a browser.** D1's browser pass covered the signed-out header on
    `/login`, whose row contains only the two 36px toggles. Both 44px controls sit behind
    the auth gate and were never seen rendered. The unit suite proves they use the primitive;
    nothing has yet confirmed how the mismatch actually looks.

    **Closed 2026-09-03, Point 2, commit `596cea0`.** `ToggleControls.module.css` was
    rebuilt onto the `--c-*` tokens and every box in it is now `2.75rem`, the number
    `Button` states. `PRE_REBUILD_EXEMPT` is empty, so the condition this entry named
    for its own closure — "it closes when the toggles are rebuilt and come off the
    exemption list" — is met on both halves.

    **And it has now been seen.** The paragraph above is the reason to say so
    explicitly: the mismatch was recorded for four points without anyone having looked
    at it. `docs/evidence/ui/shots/01-idle-desktop-light.png`, recaptured against this
    build, shows the signed-in header — Home, Your plans, Sign out, the language
    segmented control and the theme toggle — sitting on one line at one height. The
    audit's own numbers moved with it: the Home link's contrast rose from 17.03 to 19.8
    in light and 13.71 to 14.48 in dark, because its surface changed from the legacy
    raised grey to `--c-panel`. Light dropped from 19 measured combinations to 18 — a
    merge, not a loss, since the link's background is now identical to the ground it
    sits on. Interactive controls stayed at 16 with 0 unnamed.

    **What keeps it closed:** `tests/evaluation/design-tokens.test.ts` reads
    `Button.module.css` and `ToggleControls.module.css` from disk and fails if any
    control in the latter declares a different `min-block-size` from the former. jsdom
    resolves no CSS — `identity-obj-proxy` returns the class name and nothing else — so
    a rendered assertion would have passed whatever the values were. The check was
    confirmed to fail by breaking it before it was kept.

32. **The token set gained an error colour it never had — 2026-09-02, Module D2.**
    The ten roles approved in Module C carry no way to say "this is wrong".
    That went unnoticed because nothing had used them yet; D2 put a
    validation-heavy form in front of them and the hole was immediate — the
    intake form referenced `--sc-danger` eight times.

    **This fills a gap rather than reversing a decision.** The spec never
    discusses status colour at all: it calls the existing colour layer "sound"
    and frames the real gap as the missing spacing, type, radius and motion
    scales. The omission was an oversight of the reduction from ~30 legacy
    properties down to ten structural roles, not a considered exclusion — unlike
    the shadow scale, which `tokens.ts` explicitly argues against.

    **Two roles, not four.** `warning` and `success` were not added. The only
    place they were used is the capacity ring, which is `aria-hidden` with the
    number input as its accessible source of truth, and only over-capacity is
    actually a fault: the ring's "ok" state takes `--c-accent` and its "short"
    state takes `--c-text-faint`, because under-filled is not-yet-full rather
    than wrong.

    **Colour stays reinforcement, not the signal.** `Field.module.css` says the
    error text is deliberately not red-only, because colour alone fails WCAG
    1.4.1 and the message is what carries the fault. That is unchanged: the
    error keeps its weight and its `border-inline-start` rule, and `--c-danger`
    is added on top of both. Every new pair is asserted against the 4.5:1 floor
    in `tests/evaluation/design-tokens.test.ts`, including danger-on-danger-
    surface, which is the pair a reader actually meets in the error banner.

33. **The loading card gets its own stylesheet — 2026-09-02, Module D3.**
    `StateViews.module.css` is shared by five components, which made D3 look
    inseparable from D9. It was not. Only `.card` and `.heading` are used by
    more than one consumer, and neither contains a single token reference — the
    shared surface had nothing token-shaped in it at all.

    **Traded:** roughly 13 duplicated lines of literals, for one
    module-cycle. **Against:** migrating `.retryButton` and
    `.startOverButton` onto `--c-*` now, when D9 replaces both with the `Button`
    primitive — the same disposal D1 performed on `.resetButton`. Work thrown
    away is worse than a duplicated literal with a known deletion date.

    **`.stepDone` was `--sc-success`, and no `success` role was added.** Entry 32
    already made this call for the capacity ring, whose "ok" state takes
    `--c-accent` rather than a green. A completed step is the same shape of
    thing: past, not a fault, and already carrying a `✓`. It takes `--c-accent`
    too. `danger` remains the only status colour among the twelve.

    **`.warningCard` was deleted, not ported.** No consumer referenced it, and
    it was the only reason this file mentioned `--sc-warning`.

34. **MoSCoW and risk read by weight, not by hue — 2026-09-03, Module D4.**
    The result view is where the missing status colours bite hardest: eight
    MoSCoW badges, two `--sc-warning` risk levels, and a shadow, none of which
    has a `--c-*` equivalent. The obvious fix was a `warning` role. It was not
    taken. `Chip`'s weight ramp carries the level instead — must → solid,
    should → outline, could → dashed, wont → the new `faint`; high → solid,
    medium → outline, low → dashed. Entry 32 set the precedent when the
    capacity ring's "ok" state took `--c-accent` rather than a green, entry 33
    followed it for `.stepDone`, and this is the third application. The twelve
    closed colour roles stay closed.

    **Traded:** hue as a channel, for a ramp that survives greyscale, colour
    blindness and a monochrome print of the defence deck. **Against:** a
    thirteenth and fourteenth role — `warning` and its surface — whose only
    consumers would have been these two spots, and which would have reopened a
    decision the module has now declined three times.

    **The fourth weight is dotted, not a paler dashed.** `--c-text-muted` and
    `--c-text-faint` are `#5f5f5f` and `#767676` in light. That is one notch of
    grey; the eye does not make the distinction at chip size, and it disappears
    entirely once the two sit in different rows. Border *style* survives what
    border *colour* does not, so `wont` is dotted and reads as a fourth step
    rather than a slightly washed-out third. The new pair, `--c-text-faint` on
    `--c-panel`, measures 4.54:1 light and 5.88:1 dark, asserted in
    `tests/evaluation/design-tokens.test.ts`.

    **The old badge's emphasis mechanism did not exist in Arabic.** It leaned on
    `text-transform: uppercase`, which is a no-op on Arabic script — there is no
    case. So the RTL rendering of the old design had the hue and nothing else,
    and every claim about the badges being legible was a claim about the English
    page. The weight ramp works in both scripts, which is not a side benefit;
    it is the reason a bilingual app should not have shipped the old one.

    **What it costs, plainly:** a high-impact risk no longer renders red. The
    word "high" carries it, in the cell and in the accessible name, and nothing
    else does. `--sc-danger` went the same way as `--sc-warning` here — the
    result view is a report, not a form, and `danger` was added in entry 32 for
    validation faults rather than for severity ratings. Someone scanning the
    risk table for red will not find it. The alternative was reopening a closed
    decision to colour a table.

    **This binds D5 and `EvidencePanel`.** The board still holds 37 legacy
    references and the evidence panel 12, and between them they carry
    `--sc-could` and `--sc-warning` — the same two gaps, in the same shapes.
    Both take the weight ramp when their points come up. Neither is changed
    here. The board's figure was written as 33 while this point was planned;
    33 is its *line* count and 37 its occurrence count under
    `git grep -o 'var(--sc-' -- src | wc -l`, which is the third time these two
    metrics have been mixed. The occurrence count is the one that has to reach
    zero before the `--sc-*` block can be deleted.

35. **The capacity meter shows three states in two colours — 2026-09-03, Module D5.**
    Entry 34 bound the board to the weight ramp and it was applied without
    incident. The meter was the part that did not fit. It has three states —
    `ok`, `warning`, `over` — and a filled bar has no border style to ramp: a
    fill is a fill. The twelve roles carry no `success` and no `warning`, so
    three states had two colours available.

    **Which two share, and why.** `ok` and `warning` share `--c-accent`. Under
    capacity and approaching capacity are both *not a fault*; over capacity is
    the only fault on the board, and `danger` is what entry 32 added faults for.
    Splitting `ok` from `warning` by hue would have needed the thirteenth role
    this module has now declined four times.

    **What carries the distinction instead.** The caption below the bar, in
    words — "2 points of headroom left" against "over by 3" — stepped up by
    weight: `--c-text-muted` at `ok`, full `--c-text` at 600 for `warning`,
    `--c-danger` at 700 for `over`. The track itself is `aria-hidden="true"`
    and always was, so it was never the accessible channel; this makes the
    visual channel agree with the one screen readers already had.
    `.meterFillWarning` was deleted rather than mapped to something.

    **What it costs, plainly:** the bar no longer turns amber as a sprint fills
    up. A Product Owner glancing at the colour alone gets two states, not
    three, and has to read the caption for the third. That is a real reduction
    in at-a-glance information and it is the price of the closed palette.

    **The plan had this token wrong, which is how it was found.** The D5 plan
    recorded `--sc-warning` as "used twice, for the over-capacity state". It
    was used three times, and over-capacity was already on `--sc-danger` — the
    token was the *approaching*-capacity state and the dependency note. The
    note is a genuine fault (a committed story depending on a deferred one
    cannot be delivered) and took `--c-danger` on its own merits. Four plans in
    this module have now carried a count or a mapping that did not survive
    contact with the tree; reading the file before trusting the plan is the
    only thing that has caught any of them.

36. **The toast announcement moved from the container to each toast — 2026-09-03, Module D9.**
    The viewport was a single `role="status" aria-live="polite"` region wrapping
    every tone. That is a defensible design and its reasoning was written down
    in `ToastContext.tsx`: a live region must exist before content changes or
    assistive tech never registers it, and mounting a new region per message is
    the classic mistake. The problem is that it made **every** tone polite, so
    an error waited for a pause in speech. For a failed generation that can mean
    acting on a plan that was never produced.

    **What changed.** Each toast now carries its own role through the `Toast`
    primitive — `alert` for an error, `status` otherwise — and the container
    carries no live-region semantics at all, so those roles are never nested
    inside a politer ancestor. Nesting is what made the error polite.

    **Traded:** the guarantee that the region pre-existed the message.
    **Against:** errors that announce when they happen rather than when the
    speech queue drains.

    **Why that is the right side of the trade, and where it is weakest.**
    `role="alert"` is specified to be announced on insertion — that is the
    entire reason the role exists — so the urgent case, the one that was broken,
    is also the case with the strongest support for the new shape. Success and
    info now rely on a freshly inserted `role="status"` being picked up, which is
    less reliable than mutating inside a pre-registered region. **That is a real
    weakening for the non-urgent tones and it is not measured**: this project has
    no screen-reader test rig, so what is asserted is the role attributes and the
    absence of nesting, not what a reader actually says. If a polite toast is
    ever reported as silent, the fix is a persistent empty polite region beside
    the alert path, not a return to wrapping everything in one.

    **One existing test asserted the old shape and was rewritten rather than
    deleted**, so the change is visible in the diff as a reversal rather than as
    a disappearance. It now asserts the viewport is *not* a live region, that an
    error is `alert` and a success is `status`, and that no toast sits inside
    another live region.

37. **The loading shimmer swept the wrong way in Arabic — 2026-09-03, Module D9.**
    `LoadingState.module.css` animates its skeleton highlight with
    `translateX(-100%) → translateX(100%)`. `transform` is physical; there is no
    logical translate. So the sweep moved visually left-to-right regardless of
    direction, against text that reads right-to-left.

    Carried byte-identical from the pre-rebuild stylesheet, so it predates D3 and
    was not introduced by the rebuild — D3 recorded it and left it, because D9
    owns this file. It is decorative and `aria-hidden`, which is why it survived
    four points of review without anyone noticing: nothing about it is wrong to a
    screen reader, and nobody had watched the loading state in Arabic.

    **The fix is one rule**: `animation-direction: reverse` under `[dir="rtl"]`.
    The gradient is symmetric — transparent → highlight → transparent — so it
    needs no counterpart flip, and reversing the keyframe is the whole change.

    **Asserted from the stylesheet, not from a render.** jsdom resolves no CSS
    and `identity-obj-proxy` returns the class name, so a rendered assertion
    would have passed whether the rule existed or not. The check reads the file
    and was confirmed to fail by breaking the rule before it was kept — the same
    method used for the header target sizes at Point 2.

38. **The global `box-sizing` reset, and what it revealed — 2026-09-03, Module D, Point 6.**
    Three stylesheets carried a local `box-sizing: border-box`, each with a
    comment recording a measured bug it prevented: `InputForm`'s textarea pushing
    the document ~10px past the viewport below ~800px; `Dialog`'s 491px content
    box rendering 557px wide and forcing `margin-inline-end` to −28px; `Toast`'s
    width cap overflowing itself. Two of those comments said explicitly that a
    global reset was the right answer and that Module C was not allowed to add
    one, because it would move every view that had not been rebuilt yet.

    Every view has now been rebuilt, so the reset landed and the three local
    declarations came out. **All three comments were read before any was
    removed** — the plan insisted on that, and it was right to: the reasoning is
    now kept in the global rule, because that rule is the only thing preventing
    all three bugs at once. Anything setting its own `inline-size` depends on it.

    **It was verified, not assumed.** No horizontal overflow at 1280, 768 or
    390px in either direction — six combinations, measured from the live DOM.

    **What it revealed.** The sticky header measured 79px before and 61px after.
    Nothing shrank that should not have: controls declaring
    `min-block-size: 2.75rem` were `content-box`, so they rendered 44px *plus*
    padding and border — roughly 62px. They now render exactly 44px. The 44px
    comfort target that Point 2 and Point 3 were written to hit was being
    over-satisfied by accident, and is now hit deliberately. Compared against the
    committed pre-change screenshot at 390px, the mobile header is tighter and
    better; the three-row wrap at that width is unchanged and pre-existing.

    **A trap worth recording, because it cost a round trip.** The gate for this
    whole module is a tree-wide count of legacy custom-property references
    reaching zero. Writing that command into a comment in `layout.tsx` made the
    count report 1 — the grep matched its own documentation — so the gate could
    never close. The comment now points at the checklist rather than quoting the
    pattern, and the guard test builds the string from fragments for the same
    reason.

39. **Five copies of the screen-reader-only rule became one — 2026-09-03, Module D, Point 6.**
    `.srOnly` was defined identically in `Field`, `InputForm`, `ExportActions`,
    `InteractiveSprintBoard` and `LoadingState` — one per point that needed it,
    none aware of the others. Two had already drifted: three used the deprecated
    `clip: rect()` with physical `width`/`height`, two used `clip-path: inset(50%)`
    with logical sizing. **`ExportActions`' copy had no consumer at all.**

    They are now one global `.sc-sr-only` in `layout.tsx`, beside `.sc-skip-link`,
    which was already a global utility — so this adds no new file and no new
    import. Consumers use the plain class string rather than a CSS-module
    reference.

    This waited until Point 6 rather than being folded into a view rebuild
    because it touches five stylesheets that four separate points produced.
    Doing it inside any one of them would have made that point's diff span files
    it had no business changing.

40. **Rendering the board in Arabic found a bug four reviews had not — 2026-09-03, Module F, F2.**
    F2 asked for "every rebuilt view in Arabic RTL. Not inferred; rendered." It
    was closed by extending `capture-ui-evidence.mjs` to drive `ar` through the
    result view, sprint board, evidence panel, history list and a saved plan —
    five views no browser had ever rendered right-to-left.

    **The first Arabic render of the board showed this:**

    ```
    29 / 30 points      displayed in Arabic as      points 30 / 29
    ```

    Two faults on one line, and the second is the dangerous one.

    **`points` was hardcoded English.** It was the only user-facing string in
    the application that never went through `t()`. The bilingual guarantee this
    project relies on is a *type* check over the translation table — an English
    key with no Arabic one is a compile error — and that check is structurally
    incapable of seeing a string which was never a key. The guarantee was real
    and this slipped under it, which is worth knowing about the guarantee.

    **The mixed run reordered.** `{committed} / {capacity} points` is a
    bidirectional sequence: Arabic paragraph, Latin word, neutral digits. Under
    RTL the algorithm placed it so that capacity appeared where committed
    belongs. An Arabic reader glancing at the meter read the wrong number first
    — not a cosmetic fault, a wrong figure on the one control the whole board
    exists to explain.

    **Fixed** by taking the unit from the existing `history.points` key rather
    than adding a second key for the same word, and wrapping the fraction in
    `<bdi>`, the native element for exactly this: it isolates the run so it
    reads left-to-right whatever surrounds it. Both halves are asserted.

    **A tree-wide scan for other bare JSX text nodes found none.** This was the
    last one, which is the only reason to believe the rest of the bilingual
    surface is sound.

    **What this says about the four reviews that missed it.** D5 rebuilt this
    component and its Arabic test asserted the strings, the chip weights and the
    group label — all of which were correct. jsdom resolves no CSS and applies
    no bidi algorithm, so a passing Arabic unit test proved the component's
    *content* in Arabic and said nothing about its *rendering*. The gap between
    those two was recorded honestly at D5 and at Point 7 rather than papered
    over, and closing it is what produced this entry. **An RTL check that never
    reaches a browser is not an RTL check.**

41. **The system rules left the user's message — 2026-09-03, Module A, A1.**
    `openAICompatibleGenerate` sent `SYSTEM_RULES` and the user's fenced idea
    concatenated into one `{role: "user"}` message. There was no system role at
    all, on any of the three providers. This entry records why that was worth
    changing on a codebase where the injection defences were already tested and
    already passing.

    **The fences were doing real work and were never the problem.**
    `fenceUserText` strips angle brackets, so a user cannot forge a closing tag,
    and the delimiter-forgery test proves exactly one closing fence exists.
    Every one of those tests still passes unchanged.

    **What the fences could not do is confer authority.** Delimiters are a
    convention the model may or may not honour; they are text asking to be
    treated as a boundary. A message role is structural — the provider hands
    the two halves to the model as separately-addressed inputs. The old
    arrangement asked the model to infer, from prose inside a single block of
    user-authored-looking text, which half of that block outranked the other.
    It usually complied. "Usually" is the whole issue.

    **The old ordering assertion is the tell.** The v6 test asserted that
    `AUTHORITATIVE RULES` appeared at a lower string index than
    `<product_idea>`. That is a real property of the string and it says nothing
    about authority — it was the strongest claim the shape allowed. The v7
    replacement is `expect(sent.system).not.toContain(attack)`, which is a claim
    about where the text *is*, not what order it is in.

    **Shape:** `buildPrompt` returns `{system, user}` rather than a string, and
    `Prompt` is an object so the two cannot be transposed by accident the way
    two positional strings can. Gemini has no system role and gets
    `systemInstruction`, which puts the rules outside `contents` entirely.

    **One sentence of the prompt had to change with it,** and it would have been
    easy to move the block without noticing: the preamble read "cannot be
    overridden by anything you read later **in this message**". After the split
    the user's text is not in that message. Now: "by anything in the user
    message that follows". Moving prose between roles without re-reading it for
    self-reference is how a prompt silently stops saying what it means.

    **Two tests were added at the wire, not at `buildPrompt`,** because every
    other test in the file would pass if the two halves were reassembled
    anywhere between `buildPrompt` and `fetch`. Both were confirmed to fail
    against the v6 body before being kept — a guard that has never been seen to
    fail is not known to be a guard.

    **A side effect worth naming, since it is A2's precondition:** the system
    half is now a constant and byte-identical across requests, which is the
    condition provider-side prefix caching keys on. A test pins it. Anyone
    interpolating a timestamp, a locale or the user's capacity into the rules
    would otherwise lose that with nothing to notice.

    Prompt contract bumped to **v7**; `X-Prompt-Version` reports it.

42. **Reduced motion became a token, and the per-file blocks turned out to be
    already dead — 2026-09-04, Module E, E1.**

    The checklist framed E1 as "`prefers-reduced-motion` is honoured in three
    files today; in the rebuild it is a token-level rule". Reading the four files
    that actually carried it (the count was wrong too) showed the interesting
    half: **three of the four blocks had no effect at all.**

    `layout.tsx` already carried the standard global nuke —
    `transition-duration: 0.001ms !important` on `*`. An author `!important`
    declaration beats a non-important one whatever its specificity, so
    `.entering { animation: none }` in Toast and `.skeletonRow::after
    { animation: none }` in LoadingState, and InputForm's three `transition:
    none` rules, were all overridden by the very rule they were duplicating.
    They read as protection and provided none of their own. Deleted.

    **What replaced them is one rule in the generated token CSS** collapsing the
    duration scale under the same query, so every `var(--motion-*)` in the tree
    — 15 declarations across 7 stylesheets — inherits the preference without its
    own media query. It is generated from `tokens.motion` rather than listed by
    hand, for the reason the colour block is: a token added later is covered
    without anyone remembering to come back.

    **Two blocks survived, and the reason each survived is the useful part.**
    Header's is `prefers-reduced-motion: no-preference` — the inverse polarity,
    adding the status pulse only when motion is welcome rather than removing it
    after. InputForm's is one declaration: `.preset:hover { transform: none }`.
    A transform has no duration to collapse, so with the transition neutralised
    the button still *jumps* a pixel, instantly — which is the motion the
    preference asks not to see. Neither the global nuke nor a duration token can
    reach a property that was never animating in the first place. It is the only
    hover transform in the tree; a second one needs the same treatment.

    **The exception to a standing rule, stated so it is not read as a mistake.**
    `layout.tsx` says every colour must be defined on `:root` and `:root.dark`
    and **never** in a bare media query, because an explicit theme choice must
    survive a disagreeing OS. This block is a bare media query. That is correct
    here and not a crack in the rule: the colour rule exists because there *is*
    an in-app choice for a media query to lose to. There is no "play animations
    anyway" toggle, so the OS preference is the only input. If a motion toggle is
    ever added, this has to become class-driven the same way `.dark` is, and the
    comment in `css.ts` says so.

    **Not zero.** The collapsed value is `0.01ms`, not `0s`. A zero-duration
    transition never fires `transitionend`, so any handler awaiting one would
    hang for exactly the users who asked for less motion.

    Four assertions added to `design-tokens.test.ts`; three were confirmed to
    fail with the override removed before being kept. One existing assertion had
    to change with them — it required `--motion-base:` to appear exactly once,
    which the override deliberately makes false. It now requires exactly two, so
    deleting the override fails there as well.

43. **The state-entry effect moves but does not fade, because a frozen fade is
    an invisible card — 2026-09-04, Module E, E2.**

    E2 asked for motion on idle → loading → result. The implementation is four
    lines: one global `.sc-enter` utility applied at the six mount points, a CSS
    transition with `@starting-style`, no JavaScript and no dependency. The
    decision worth recording is not that, it is what the effect deliberately
    does **not** do.

    **The first version faded in** — `animation: sc-enter ... both`, opacity 0 to
    1 plus a small rise, which is the ordinary way to write this. Probing it in a
    real browser before trusting it turned up the reason not to: in a document
    whose `visibilityState` is `hidden`, the animation timeline never advances.
    Measured — `playState` "running", `currentTime` still 0 after 400ms, computed
    opacity pinned at **0**.

    **The second version was wrong for the same reason, and the first guess at
    why was also wrong.** Rewriting it as a transition with `@starting-style` was
    supposed to fix it, on the theory that a transition's base style is its final
    state. The probe disproved that: the transition starts from the
    `@starting-style` value and freezes there exactly as the animation did. The
    mechanism is not what makes an entry effect safe. **The start value is.**

    **So the only property that animates is one whose frozen state is harmless.**
    A frozen `translateY` renders 4px low, which nobody can see and no screenshot
    is wrong for containing. A frozen fade renders all six views as blank cards —
    and the 22 screenshots are how this project evidences its UI, so that failure
    would have been silent in review and visible only in the artefact a grader
    looks at.

    **Why this was findable at all:** the check was run in a browser rather than
    reasoned about. Nothing in the CSS is incorrect, both versions pass every
    test, and both look right in any environment that paints. The failure only
    exists where the renderer does not advance a timeline, which is exactly the
    class of environment that takes automated screenshots.

    Two follow-ons, both recorded rather than assumed:

    - `capture-ui-evidence.mjs` now emulates `prefers-reduced-motion: reduce`
      alongside the colour scheme, in the same `setEmulatedMedia` call because
      that command replaces the feature list rather than merging into it — a
      second call would have silently dropped the theme and rendered every dark
      screenshot light. Under that flag E1's token rule collapses the duration,
      so shots are of settled states by construction instead of by out-running a
      fixed sleep. **This is not yet exercised; the capture has not been re-run.**
    - If a fade is ever wanted back, it needs a mechanism that cannot leave the
      element invisible — adding the class after mount, so a renderer that never
      runs the callback simply never starts the effect. Noted in the code.

    A test asserts the entry block contains no `opacity` at all, including inside
    `@starting-style`, and was confirmed to fail against an injected regression.

44. **View Transitions needed one experimental flag, and the flag turned out to
    be the cheap half — 2026-09-04, Module E, E3.**

    Route changes cross-fade instead of cutting. Three routes were considered
    and only one of them works here, so the rejected two are worth writing down
    before the next person reaches for them:

    - **`@view-transition { navigation: auto }`.** Pure CSS, no config, no
      dependency — and it does nothing in this app. That rule covers
      *cross-document* navigation only, and every link here goes through
      `next/link`, which is a client-side soft navigation. The rule would have
      shipped, validated, and never fired once.
    - **A hand-rolled `document.startViewTransition` around `router.push`.** The
      callback has to resolve *after* the new DOM is in place, and an App Router
      navigation fetches an RSC payload first, so there is no point at which
      wrapping it is correct. `flushSync` does not help, because there is
      nothing to flush yet.
    - **`experimental.viewTransition: true` plus React's `<ViewTransition>`.**
      What actually works.

    "Experimental" was checked rather than assumed, because in Next it covers
    two very different risks. `needsExperimentalReact` in the installed version
    lists `taint`, `transitionIndicator` and `gestureTransition` — **not**
    `viewTransition` — so this flag does not move the app onto React's
    experimental channel. It exposes a component the vendored React already
    ships. That distinction is the whole basis for accepting it, so it is
    written into `next.config.js` beside the flag with an instruction to
    re-check the list on a Next upgrade.

    **The cost was not the flag; it was that three copies of React disagree
    about the name.** `node_modules/react` (19.2.0) has no `ViewTransition`
    export at all, `next/dist/compiled/react` exports `ViewTransition`, and
    `@types/react` declares only `unstable_ViewTransition` under
    `react/experimental`. Next vendors its own copy for the App Router, so an
    import resolves inside a Next build and is `undefined` under Jest —
    **54 tests across three suites failed on "Element type is invalid"** before
    that was understood. The first fix was a `declare module "react"`
    augmentation, which made the types agree and left the test failure
    untouched, because the problem was never the types.

    `src/components/common/ViewTransition.tsx` replaced it: read the component
    off the React namespace, fall back to rendering children untouched. The
    fallback is the honest behaviour in both places it can occur — a test
    renderer with no view transitions, and any future React that renames the
    export — and neither should take a page down for an effect that is
    decoration.

    **Timing is a token, not a keyframe, and the first attempt at that was
    measured wrong.** Naming only `(root)` looked correct and was not:
    `getAnimations()` during a real navigation showed `(root)` at the token's
    180ms while React's auto-assigned `_t_0_` and `_t_0__1` — the groups
    actually covering the page — stayed on the browser default of 250ms. The
    rule uses `(*)` for that reason. It matters beyond tidiness: the
    reduced-motion backstop in `layout.tsx` selects `*`, `*::before` and
    `*::after`, none of which match a view-transition pseudo-element, so a
    hardcoded duration there would have sat outside every reduced-motion
    mechanism this project has. A custom property does reach them, because the
    pseudo tree inherits from the root element. Verified the same way E1 was:
    redefining `--motion-base` live moved all nine animations from 180ms to
    0.01ms.

45. **The page-level view transition makes per-element ones impossible, and that
    killed the better half of E4 — 2026-09-04, Module E, E4.**

    E4 was scoped as micro-interactions on buttons, cards, chips and toggles.
    The one place in this app where motion would carry information rather than
    polish is the sprint board: a story moved between "committed" and
    "deferred" is the app's central interaction, the two columns look
    identical, and with an instant swap the only evidence of what happened is
    that a card you were reading is somewhere else. It was built — a
    `<ViewTransition name={story-${storyId}}>` per card and `startTransition`
    in `handleToggle`, since React only runs a view transition for an update it
    can interrupt — and then removed.

    **Why it was removed.** The board toggle did start a view transition, and
    React did apply `view-transition-name: story-US-01` to every card, in both
    the old and the new state — both confirmed by reading computed styles at
    each point. The browser produced **no group for any of them**. What
    animated instead was the whole page, under the auto-assigned names of the
    E3 boundary in `providers.tsx`.

    A control experiment settled it rather than leaving it to inference: two
    `view-transition-name`s set by hand, one on `<main>` and one on a card
    inside it, then a manual `startViewTransition`. `probe-outer` was captured;
    `probe-inner` was not. **An element nested inside a captured element is
    never captured itself.** A page-level view transition therefore forbids
    every per-element one beneath it — the two features are mutually exclusive
    as long as the boundary wraps the page.

    They can be reconciled: Next's `<Link transitionTypes>` feeds React's
    `addTransitionType`, and a boundary declared as
    `update={{ "route-change": "auto", default: "none" }}` would take a name
    only during navigation and stand aside otherwise. That was not built. It
    threads a magic string through every `Link` in the app — four today — and a
    link added later without it silently loses the route transition. Buying a
    180ms morph with a failure mode that quiet is the wrong trade, and the
    board already marks the change twice without motion: the capacity meter
    recomputes, and focus follows the moved story to its new column.

    **What E4 shipped instead**, deliberately small:

    - **Buttons.** `primary` was the only variant in `Button.module.css` with no
      hover state — `secondary`, `quiet` and `danger` all had one — so the
      control the page is built around was the one that did not answer the
      pointer. Fixed with a token pair rather than a `filter`, because hover has
      to move *away* from the page and the themes disagree about which way that
      is: light's accent deepens (`#0f766e` → `#115e59`), dark's lifts
      (`#5eead4` → `#ccfbf1`). A single `brightness()` would have been correct in
      one theme and inverted in the other. Two assertions per theme: the label
      still clears 4.5:1 on the hovered fill, and the hover fill is
      distinguishable from the resting one — the second exists because the
      cheapest way to get this wrong is to paste the same value twice, and the
      dark value failed it at 1.17 on the first try.
    - **Cards.** The history row is a card containing a link, and the only thing
      saying so was an underline on two lines of text. `:has(.ideaLink:hover)`,
      not `:hover`: the row also holds the open and delete controls, and
      lighting the whole card when the pointer is over *Delete* says "you are
      about to open this", which is the one thing it must not say.
    - **Chips.** Nothing. They are static labels with no interactive state to
      report; motion on them would be decoration by definition.
    - **Toggles.** Nothing new. `ToggleControls.module.css` already transitions
      border and background on `var(--motion-fast)`, so they were already
      inside E1's reduced-motion rule.

    **Not verified:** neither hover state was exercised with a real pointer. The
    rules were confirmed to ship and parse in the browser — both appear in
    `document.styleSheets` with the tokens resolving, and `:has()` is supported
    — but the harness available here cannot hold a pointer over an element, and
    the screenshot capture does not hover either. So the CSS is proven present
    and valid; the interaction itself is not proven.

46. **The generation log is two columns on a table that already existed —
    2026-09-04, Module B, B2.**

    The point asked for "one structured line per generation" so latency and
    failover facts stop being things measured by hand in one-off runs. The
    obvious readings were a `generation_log` table or a JSON line to stdout.
    Neither is what shipped, and the reasons are worth keeping.

    **Not a table.** `plans` is already exactly one row per generation that
    reached a provider — that is not a coincidence, it is the property the rate
    limiter depends on, since the quota counts attempts rather than successes. A
    second store would need to be kept consistent with the first, for a set of
    facts the first is already the right home for. Two nullable columns,
    `duration_ms` and `attempts`, are written by the insert that was already
    running on both the success and the failure path. No new write, no new
    failure mode, no new thing to keep in sync.

    **Not JSON.** There is a stdout line as well, but in the `scopecraft.<event>
    key=value` shape the five existing log lines already use. A JSON line would
    be no more machine-readable in practice and would mean the route emits two
    formats, so anything reading these logs has to handle both.

    **Why a line at all, when the row is better.** The row is queryable and
    kept; the line is neither. It exists for the one case the row cannot cover:
    `recordPlan` deliberately never throws, because a failed bookkeeping write
    must not destroy a plan the user already paid provider tokens for. So a
    persistence outage is invisible in the data — the generations it drops leave
    no row to be missing from. The line carries `persisted=true|false`, which is
    the only place that failure is visible at all.

    **`attempts` is the interesting half, and it is a counting decision.** It
    counts providers *called*, not providers *considered*: one skipped for a
    missing credential never reaches the increment. That distinction is why the
    column earns its place. `provider_used = 'groq'` cannot say whether NVIDIA
    failed and the chain fell through or NVIDIA has no key and was skipped —
    two situations with completely different responses — and this repository has
    had an open question of exactly that shape. The test that guards it was
    confirmed failing against the wrong implementation someone would plausibly
    write instead: counting the winner's position in the chain, which is right
    whenever nothing is skipped and silently wrong the moment something is.

    Summed across the schema-violation retry in `runScopeCraft`, not taken from
    the last attempt. A generation that burned a chain, retried and then
    succeeded cost both, and reporting only the second would under-state exactly
    the case worth knowing about.

    Recorded as `null` rather than guessed at when a provider answered and the
    failure came afterwards — a `SchemaViolationError` or a `PlanningError`. A
    wrong number would be worse than a missing one there, because it would
    average into the failover statistics as if it were real.

    **What it found on its first real row.** A served generation took 33.7
    seconds, which alone reads as "generation is slow". `attempts=2` and the
    warning line say otherwise: the NVIDIA tier spent its full 30-second timeout
    before Groq answered in about four. Local only, and deliberately not
    generalised — it says nothing about whether the production key is configured.

    **The deploy ordering is a real hazard, so it is written in three places.**
    `create table if not exists` does nothing on an existing database — it does
    not diff the definition — so the columns arrive only via the two
    `alter table ... add column if not exists` statements at the foot of
    `db/schema.sql`. Ship the code before applying the file and every insert
    fails on an unknown column; because `recordPlan` swallows its errors, plans
    would stop persisting **silently**, which is the worst available failure
    mode. Applying the file first is safe — two nullable columns are additive
    and the old code never names them. Exercised against a database that already
    held the pre-B2 table, and again to confirm idempotency.

47. **The request cache is a column on `plans`, not a cache — 2026-09-04,
    Module A, A3.**

    A3 asked for identical requests to be answered without calling a provider.
    The obvious readings were Redis, an in-process LRU, or a `plan_cache` table.
    What shipped is one nullable `text` column, `plans.request_hash`, and a
    `select ... limit 1` between the quota check and the generate step.

    **Why no cache store.** Every row the cache would hold is already in `plans`
    — the whole validated response, the provider that produced it, the prompt
    version it was produced under. A second store would have to be kept
    consistent with the first for no information gained, and an in-process LRU
    is worthless on a platform that runs the route in short-lived function
    instances. The same argument `src/lib/quota.ts` makes for not adding
    Redis for rate limiting applies here unchanged.

    **Placed after the quota, not before it.** The lookup is stage 4c: after the
    budget check at 4b, before the generate call at 5. In front of the quota it
    would have been cheaper on a hit and a hole in the meter — a caller could
    replay a request the budget never saw. The ordering costs one count query on
    a hit and buys "no path through this route skips the meter".

    **Three decisions the owner made, recorded because each had a real cost.**

    *Per-user, not global.* A global cache hits more often and saves more
    tokens. It also turns response time into an oracle: a fast answer would tell
    you that somebody else had already generated that exact idea. Scoping to one
    user gives up the saving and keeps the endpoint from answering a question it
    was never asked.

    *A hit writes a `plans` row.* Without it a repeat generation would vanish
    from the caller's history — the plan they are looking at would have no row
    to edit or return to. The cost is that `attempts = 0` rows now exist in the
    B2 corpus, so any latency or failover query has to say `where attempts > 0`.
    Zero is deliberately distinct from `NULL` there: zero means no provider was
    called, `NULL` means the count was not recorded.

    *A hit counts against the daily quota.* It spends no provider tokens, so the
    strict reading is that it should be free. Free hits would need
    `checkDailyQuota` to filter them out, and that filter is a place a future
    bug can silently under-count real generations. The limit is therefore plans
    per day, not provider calls per day. Over-strict by design, and zero extra
    code — the quota counts rows, and a hit writes one.

    **What is in the hash, and the one field that is not.** The key is sha256
    over `(hash version, idea, constraints, team_capacity_points)`.
    `sprint_length_days` is validated and stored but nothing in `src/lib` reads
    it — it reaches neither the prompt nor the sprint arithmetic — so two
    requests differing only in sprint length produce identical plans and share
    one entry. Excluding it raises the hit rate; if it ever becomes live, it
    must be added to the hash **and** `REQUEST_HASH_VERSION` bumped, or old rows
    will answer new questions. The version prefix exists for exactly that: it
    guards changes to *what is hashed*, where `prompt_version` — matched in the
    lookup, so a v7 plan never answers a v8 request — guards the other
    direction.

    **`X-Cache` is a new response header, and the allowlist test made that a
    decision rather than an accident.** A hit without it is indistinguishable
    from a generation: `X-Provider-Used` names the tier that answered the
    *original* request, which reads as a provider call that never happened. The
    header is the only way to observe cache behaviour from outside the process,
    which is what makes the behaviour checkable against a live deployment.

    **The deploy ordering is the same hazard B2 had, for the same reason.**
    `request_hash` arrives only via the `alter table ... add column if not
    exists` at the foot of `db/schema.sql`. Ship the code before applying the
    file and every insert fails on an unknown column; `recordPlan` swallows its
    errors, so plans would stop persisting **silently**. Apply the file to both
    Neon branches first — one nullable column is additive and the old code never
    names it.

48. **A2 is closed as unverifiable rather than done, and the number it rested on
    was wrong — 2026-09-04, Module A, A2.**

    A2 asked to let provider-side prompt caching engage, with the check "two
    identical back-to-back live calls, cached-token counts recorded in evidence".
    It is being closed without a tick. The reasoning is worth keeping because
    "we could not measure it" and "it does not work" are different claims and
    only the first one is supported.

    **What was measured.** Five direct calls to Groq's `openai/gpt-oss-120b`,
    each carrying the real `SYSTEM_RULES` as a system message and a different
    short user message — the shape prefix caching is supposed to exploit.
    Every response returned the same `usage` keys: `queue_time`, `prompt_tokens`,
    `prompt_time`, `completion_tokens`, `completion_time`, `total_tokens`,
    `completion_tokens_details`. There is no `prompt_tokens_details` and no
    `cached_tokens`. Response headers carry `cache-control: no-store` and
    `cf-cache-status: DYNAMIC`, both of which describe HTTP response caching
    rather than KV reuse. `prompt_time` ranged 0.027–0.168 s with no downward
    trend, which is scheduling noise and cannot carry the claim.

    Reproduce it by POSTing to `https://api.groq.com/openai/v1/chat/completions`
    with `SYSTEM_RULES` as the system message and reading `usage` off the raw
    JSON. The probe was a throwaway and is deliberately not committed: a capture
    script for a negative result would be a third thing to maintain, and the
    finding is one HTTP call to re-check.

    **A1 had already done A2's work.** The condition prefix caching needs is a
    stable, byte-identical system prefix, and A1 produced exactly that when it
    split the rules into a real system message. There was never a second change
    to make. What A2 actually wanted was *confirmation*, and confirmation is what
    the provider does not expose.

    **A3 dissolved the check's original shape.** "Two identical back-to-back live
    calls" no longer reach a provider at all — stage 4c answers the second one
    from Postgres. Anyone returning to this has to compare two *different*
    requests sharing the system prefix instead, which is why the probe used
    distinct user messages.

    **The item's own arithmetic was wrong and is corrected in place.** It claimed
    `SYSTEM_RULES` is "~230 tokens". A request carrying the rules plus a
    ten-token user message reports **663 prompt tokens**, putting the rules near
    650 — out by nearly a factor of three. The conclusion drawn from it survives,
    since 650 is still below Gemini's ~1024-token context-cache minimum, so
    explicit Gemini caching still buys nothing. But a conclusion that happens to
    survive a wrong premise is not the same as a checked one, and the struck-out
    text is left visible rather than silently replaced.

    **What would close A2:** a provider that reports cached prompt tokens. That
    is a change of provider or of provider API, not work in this repository. Kept
    open at the item rather than deleted, so it is not re-proposed as a fresh
    idea by someone reading the prefix-caching literature.

49. **NVIDIA is removed from the production provider chain, and the three-tier
    design is two tiers there — 2026-09-04.**

    > **Superseded the same day by entry 50.** The diagnosis below is wrong in its
    > cause, and the trade-off it records no longer applies: NVIDIA was not
    > rejecting requests, and production is back to three tiers. The measurements
    > are real and are kept. Read 50 before acting on anything here.

    The failover chain nvidia → groq → gemini is a documented design decision.
    Production now runs it with the first tier absent, which is a reversal of a
    frozen decision and therefore belongs here rather than in a dashboard's
    audit log.

    **What forced it.** `plans.attempts` — added by B2 six commits earlier —
    showed five consecutive production generations at `attempts=2` with
    `provider_used=groq`. That column counts providers *actually called*, and a
    tier skipped for a missing credential does not increment it, so the number
    could only mean NVIDIA was called and rejected. Every production request was
    paying for a failed provider round trip before it got an answer.

    **The measurement, because "it felt slow" is not a reason to delete a
    redundancy tier.** Five generations before removal: 18618, 19892, 19814,
    19777, 19840 ms, mean **19588**. Four after removing `NVIDIA_API_KEY` from
    Vercel and redeploying, every one `attempts=1`: 5332, 5640, 3395, 4391 ms,
    mean **4690**. The failed attempt cost **~14.9 s per request, 76% of the
    total** — **4.18× faster** now, and **2.6× faster than the local development
    environment**, which still has NVIDIA configured and still pays for it.

    **What was traded.** Production has two tiers of failover, not three. If
    Groq has an outage, only Gemini stands between the user and a
    `502 PROVIDER_ERROR`. That is a real reduction in redundancy, accepted
    because a tier that fails 100% of the time is not redundancy — it is a
    14-second tax that also cannot be relied on in an outage.

    **What was not established, and it matters for the reversal.** Nobody
    diagnosed *why* NVIDIA rejected the requests. Wrong model id, expired
    credential, region restriction — the provider warning in the Vercel runtime
    log names it, and that log was never read. Re-adding the key without reading
    it first would restore the 14 s tax along with the tier.

    **What the extra runs changed, and what they did not.** The first version of
    this entry rested on a single post-fix sample and said so. Three more were
    run: 5640, 3395, 4391 ms. The mean moved from 5332 to 4690 — the direction
    was never in doubt, and the magnitude barely moved.

    What they did reveal is a shift in *variance* that one sample could not show.
    Pre-fix runs sat within 1274 ms, **7%** of their mean, because a fixed ~15 s
    cost dominated everything else. Post-fix the band is 2245 ms on a much
    smaller mean, **48%**. Absolute spread is comparable; relative spread is
    seven times worse, because what remains is Groq's own variable response time
    with nothing large in front of it. The mean is only honest quoted with its
    range, and anyone setting a latency budget from this should use the range.

    **Reversal is one variable and a redeploy.** Nothing in the code changed —
    `PRIMARY_AI_PROVIDER` is still `nvidia` and the provider module still lists
    three tiers. The chain shortens in production only because
    `generateWithFallback` skips a provider with no credential, which is
    behaviour this repository already had and already tested.

50. **NVIDIA was never rejecting anything — it is slow, and it was first in the
    chain. Supersedes entry 49 — 2026-09-04.**

    Entry 49 concluded that NVIDIA was being rejected in production, removed
    `NVIDIA_API_KEY`, and recorded the loss of a failover tier as the price. The
    measurements in it are real. The cause is wrong, the fix was blunt, and the
    price did not need paying.

    **What actually broke.** NVIDIA is the *slowest* tier, not a broken one —
    already measured on this account at 9.3 / 18.6 / 26.0 s for a full PRD and
    recorded further up this log. It was configured **first** in the chain, and
    production's `AI_TIMEOUT_MS` cut every attempt short. The request then fell
    through to Groq, exactly as the failover design intends. Every production
    generation was paying a full timeout before it started doing useful work.

    **Three pieces of evidence, in the order they landed.**

    *The credential was never the problem.* The same key and the default model
    id, called directly against `integrate.api.nvidia.com`, return `200 OK`.

    *The failure was a fixed cutoff, not a variable error.* Subtracting the
    Groq-only mean from each contaminated row gives NVIDIA's implied share:
    13928, 15202, 15124, 15088, 15150 ms. Four of five within 15.1 s ± 0.1.
    Auth failures and network errors do not land on the same millisecond band
    five times; timeouts do.

    *Raising the timeout made it worse, which is the clincher.* Setting
    `AI_TIMEOUT_MS` to 30000 while NVIDIA was still first produced a **34819 ms**
    generation. A rejected credential does not get slower when given more time.
    A slow provider does.

    **The fix is one variable.** `PRIMARY_AI_PROVIDER=groq`. `getProviderOrder`
    puts the configured primary first and keeps the rest behind it, so NVIDIA
    becomes the third tier instead of the front door.

    | Configuration | n | mean | range |
    |---|---|---|---|
    | NVIDIA first, 15 s timeout | 5 | 19588 ms | 18618–19892 |
    | NVIDIA deleted entirely (entry 49) | 4 | 4690 ms | 3395–5640 |
    | NVIDIA first, 30 s timeout | 1 | 34819 ms | — |
    | **Groq first, NVIDIA third** | 3 | **4227 ms** | 3358–5512 |

    **4.63× faster than the broken configuration, and the tier costs nothing.**
    Three tiers now run 462 ms *faster* than two did — inside the noise, so read
    it as "no measurable cost", not as a gain. All three rows record
    `attempts=1`, which is proof rather than inference: `attempts` counts
    providers actually called, so NVIDIA is configured and not being touched.
    Entry 49's recorded trade — "production failover is two tiers now" — is
    withdrawn. It is three.

    **Why the diagnosis took four deploys.** `PRIMARY_AI_PROVIDER` and
    `AI_TIMEOUT_MS` were both typed **Secret** in Vercel. Neither is a
    credential; one is a number and the other is the string `groq`. Secret means
    write-only, so neither could be read to check what production was actually
    running, and the effective timeout still has not been read — it is inferred
    from behaviour. Both are now **Config**. **The rule this leaves behind:
    type a variable Secret only if leaking it would hurt.** Marking configuration
    as secret buys nothing and costs the ability to diagnose.

    **What is still unknown.** Nobody read the Vercel runtime log, and the
    provider warning line naming NVIDIA's exact failure was never seen. The
    conclusion "timeout" rests on the timing signature and on the 30 s
    experiment, not on the log. That is strong, and it is not the same as read.

51. **The print stylesheet, and the two things it made visible — 2026-09-04.**

    Three small enhancements landed together: a print stylesheet, a label on
    plans served from the A3 cache, and a print button beside the existing
    exports. Two of the three are worth recording; the button is not.

    **A PRD exists to be handed to someone, and nothing here could produce a
    handable copy.** There was no `@media print` rule anywhere in `src/`, so
    printing produced the app — sticky header, intake form, toggles, tab
    controls — wrapped around a third of the plan. No dependency was added:
    every browser already writes PDF, and what was missing was a stylesheet
    telling it what to leave out.

    **Colour is a token concern, structure is not.** The palette override lives
    in `src/lib/design/css.ts`, generated from the light tokens the same way
    the reduced-motion block is generated from the motion scale — so a colour
    added later is honoured without anyone remembering. It names both `:root`
    and `:root.dark`, deliberately: `:root.dark` is (0,2,0) against bare
    `:root`'s (0,1,0), so a print block naming only `:root` loses to the dark
    theme and prints pale grey on white. The structural rules — what is hidden,
    what is revealed, the page margin — are in `layout.tsx`, and every selector
    in them is an element name or an ARIA role. That is a constraint, not a
    style preference: CSS Module class names are hashed at build time, so a
    rule naming one works in dev and silently stops working in production.

    **The rule that is not obvious:** the three tabs are alternative views of
    one plan, not three documents. On screen exactly one panel is shown, so
    without `[role="tabpanel"][hidden] { display: block }` a printed plan
    silently loses its backlog and its evidence — two thirds of the document,
    with nothing on the page to say they were dropped. Revealed by role rather
    than a blanket `[hidden]` override, which would also unhide the welcome
    dialog.

    **A defect this found in itself.** Browsers strip background colours when
    printing unless the reader ticks "Background graphics", which is off by
    default. A MUST chip is `.solid` — `background: var(--c-text)` behind
    `var(--c-ground)` text — so a stripped background prints white on white and
    the single most important label in the document disappears. The risk
    register's impact chips and the capacity meter fail the same way. Measured,
    not assumed: `Page.printToPDF` with `printBackground: false` against a real
    plan is what produced the blank chips. Fixed with `print-color-adjust:
    exact`, which is safe **only** because the palette above is already the
    light one — the two rules are a pair. Not fixed in `Chip.module.css`:
    MoSCoW is encoded by fill weight as a WCAG 1.4.1 obligation (entry 34), and
    making `.solid` printable by giving up its fill would undo the reason the
    component exists.

    **`X-Cache` had been set and never read.** A3 shipped the header in
    `80531ca` and nothing in `src/` consumed it, so a hit — which returns in
    well under a second because no provider is called — was indistinguishable
    on screen from a model that had cut corners. The chip reads the header the
    route already sets; no API change. Only `hit` is treated as a claim: a
    missing header, a stripped one, or an older deployment all mean "not known
    to be cached" and the chip stays off, so an absent header can never assert
    something that did not happen. Verified end to end against a real Postgres —
    the miss row recorded `attempts=2, duration_ms=34240`, the hit `attempts=0,
    duration_ms=0`, which is what makes the label true rather than decorative.
    `docs/project-plan.md` 5.1.3 said "the UI does not read it" and is corrected.

    **A latent break in `capture:ui`, found by running the gate.** Case 4 posts
    to an instance with dead credentials to photograph the error state, and it
    used the same idea as case 1. Since A3 both instances share one
    `DATABASE_URL`, so case 1's successful generation was cached and case 4 was
    answered from `plans` at stage 4c — a plan, not an error. The capture had
    not been run between `80531ca` and this change, so nothing surfaced it; the
    22nd screenshot on disk was stale rather than wrong. Case 4 now posts an
    idea of its own, which can never enter the cache because the only instance
    it is ever sent to cannot succeed. This is the argument for the gate: the
    failure was invisible to every other check in the repository.
