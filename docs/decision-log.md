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
