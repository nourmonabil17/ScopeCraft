# Known limitations

**Owner:** Yousef Mohmed Hasabo · **Last reviewed:** 2026-09-03 · **Commit:** see `git log` for this file
**19 entries: 11 Accepted · 7 Open · 1 Closed.**

Every limitation this project knows about, in one place, because the release gate asks for
bounded limitations rather than a clean sales pitch. Until now they were spread across the
README, `architecture.md`, `security-review.md`, the decision log and the project plan, which
means nobody could answer "what does this not do" without reading five documents.

Nothing here is a surprise found by a reviewer. Everything here was found by the team, written
down, and either accepted with a reason or left open with an owner. **A gap named out loud is
worth more at a defence than a gap an examiner finds.**

---

## How to read this

Each entry carries one of two states, and the distinction is the whole point of the document:

| State | Meaning |
|---|---|
| **Accepted** | A deliberate trade-off. Someone weighed it, chose it, and signed it. It is not going to be fixed, and the reason is recorded. |
| **Open** | A real gap with no decision yet, or a decision that has not been executed. It has an owner and a next step. |
| **Closed** | It was Open, and it has been fixed. Kept, with its number, so the record of what was once true is not quietly deleted. |

An **Accepted** entry that turns out to have no reasoning behind it is a bug in this document.
An **Open** entry that has sat unowned for a month should either become Accepted or get done.

### Summary

| # | Limitation | State |
|---|---|---|
| 1 | Abuse is bounded per account, not per IP | Accepted |
| 2 | Sessions cannot be revoked server-side | Accepted |
| 3 | CSP `script-src` carries `'unsafe-inline'` | Accepted |
| 4 | CSP `style-src` carries `'unsafe-inline'` | Accepted |
| 5 | ~~System rules and untrusted input share one message role~~ | **Closed 2026-09-03** |
| 6 | Container image carries 16 base-image CVEs; the fix is unverified | **Open** |
| 7 | HSTS comes from Vercel, not from this application | Accepted |
| 8 | Off-domain requests are refused by the model, after tokens are spent | Accepted |
| 9 | The pre-provider heuristic is ASCII-only and never fires on Arabic | **Open** |
| 10 | Estimate quality is the model's; only the arithmetic is guaranteed | Accepted |
| 11 | No delivery dates are derived from story points | Accepted (non-goal) |
| 12 | `NVIDIA_API_KEY` appears unset in production | **Open** |
| 13 | There has been no screen-reader run | **Open** |
| 14 | There has been no test on a real mobile device | **Open** |
| 15 | React hydration error #418 on returning visits | **Open** |
| 16 | No test-coverage threshold | Accepted |
| 17 | `db:check` asserts the index exists, not that the planner uses it | Accepted |
| 18 | Evidence capture needs live credentials and a database | Accepted |
| 19 | Unstyled page in Safari over `http://localhost` | **Open** (local only) |

---

## Security and abuse

### 1. Abuse is bounded per account, not per IP — *Accepted*

`POST /api/scopecraft` requires a session, and a rolling 24-hour per-account budget returns
`429 RATE_LIMITED` once it is spent. Requiring a session is what stops anonymous quota burn.

**What is not addressed:** someone willing to create many GitHub or Google accounts. Nothing in
this system makes that expensive.

**Why accepted:** the durable per-IP layer worth having is an edge-middleware token bucket
backed by a store that survives serverless cold starts (Upstash Redis or equivalent). That is a
new dependency and a new piece of infrastructure to buy protection against an attacker who is
not in this project's threat model — a graded student project with a personal provider budget.
The session requirement removes the case that actually happens, which is an unmetered endpoint
found by a crawler.

**If it were to be fixed,** this is the first item on the production upgrade path in the README,
and it goes in Next middleware rather than in the route, so it costs nothing per request in the
normal case.

### 2. Sessions cannot be revoked server-side — *Accepted*

Sessions are JWTs. A JWT is valid until it expires; there is no server-side record to delete.

**What this means concretely:** if a session token leaks, it cannot be killed individually.
Rotating `AUTH_SECRET` invalidates **every** session at once, and that is the only lever.

**Why accepted:** the alternative is a database-backed session table, a read on every request,
and a second thing to keep consistent with the JWT. For an application where the worst outcome
of a stolen session is somebody spending twenty plan generations, a per-request database read is
the more expensive mistake.

### 3. CSP `script-src` carries `'unsafe-inline'` — *Accepted*

This is a real weakness and is documented as one in `next.config.js` rather than glossed.

**Why it cannot simply be removed:** the App Router streams its RSC hydration payload as roughly
ten inline `self.__next_f.push(...)` scripts whose contents change on every build, so a hash
allow-list is unmaintainable. A nonce must be minted per request, which would force `/scopecraft`
out of static prerendering into dynamic rendering and lose its caching.

**What the rest of the policy still buys, even with the hole** — this is why the trade is
defensible rather than a shrug:

| Directive | What it still blocks |
|---|---|
| `connect-src 'self'` | An injected script cannot POST the user's data to an attacker-controlled host — the exfiltration step of most real XSS chains |
| `base-uri 'none'` | `<base href>` injection, a common way to turn one injection point into full script hijacking |
| `object-src 'none'` | Plugin vectors |
| `form-action 'self'` | A planted form cannot post credentials off-site |
| `frame-ancestors` | Clickjacking, alongside `X-Frame-Options` |

The page has no third-party scripts, no user-supplied HTML, and no `dangerouslySetInnerHTML`
carrying user data. `'unsafe-eval'` is added **in development only**, never in production.

### 4. CSP `style-src` carries `'unsafe-inline'` — *Accepted*

The theme tokens ship as an inline `<style>` in the root layout and must stay inline: they have
to apply before first paint, or the page flashes the wrong theme on every load. Trading a style
CSP directive for a visible flash on every page load is not a trade worth making.

### 5. System rules and untrusted input share one message role — *Closed 2026-09-03*

**This entry is kept rather than deleted**, because it was true for the whole life of the
project until this date and a limitations document that silently drops what it used to say is
not a record of anything.

**What was true:** `openAICompatibleGenerate` sent `SYSTEM_RULES` and the user's fenced idea
concatenated into a single `{role: "user"}` message. There was no system role at all, on any of
the three providers. Instructions and untrusted data sharing a role is the condition prompt
injection exploits; the fences made it harder but could not confer authority, because a
delimiter is a convention the model may honour while a role boundary is structural.

**What is true now:** `buildPrompt` returns `{system, user}`. The OpenAI-compatible providers
send two messages; Gemini gets `systemInstruction`, which places the rules outside `contents`
entirely. Prompt contract **v7**. Two of the four new tests assert the separation *at the wire*,
because the others would pass if the halves were reassembled after `buildPrompt`, and both were
confirmed to fail against the old request body before being kept.

Decision-log entry 41; `docs/prompt-versions.md` for the contract change.

### 6. The container image carries 16 base-image CVEs, and the fix is unverified — *Open*

`npm audit` and an image scan disagree, and both are right about different trees:

| Scanner | Scope | Result |
|---|---|---|
| `npm audit --omit=dev` | the six runtime dependencies | 0 vulnerabilities |
| `npm audit` | runtime + dev | 0 vulnerabilities |
| `docker scout cves` | everything in the image | 16 (1 critical, 15 high) |

**None of the 16 are in this project's dependencies.** Nine are in npm's own vendored tree at
`/usr/local/lib/node_modules/npm` and seven are in `openssl`, both from the `node:22-alpine`
base image.

**The state to be honest about:** the runner stage now deletes `npm`, `npx` and `yarn`, because
the standalone server starts with `node server.js` and nothing shells out to a package manager
at runtime. **That change has never been verified** — the base image is not cached on the
development machine and the Docker daemon cannot reach Docker Hub. So the CVE count after the
change is unmeasured, and the existing local image still carries all 16.

**Owner:** Yousef. **Next step:** rebuild once the daemon has network, then
`docker scout cves scopecraft:local --only-severity critical,high`. The `openssl` findings need
a base image that has picked up the patched Alpine package.

**Scope note:** this affects the container path only. **Vercel does not build from the
Dockerfile**, so the live site is not exposed to this.

### 7. HSTS comes from Vercel, not from this application — *Accepted*

Six security headers are present in production, but only **five** come from `next.config.js`.
`Strict-Transport-Security` is added by Vercel — `grep` finds no HSTS anywhere in the source.

**What this means:** an image deployed anywhere other than Vercel serves five headers, not six,
and loses HSTS silently. Any document claiming "all six headers are configured" is describing
the Vercel deployment, not the application.

**Why accepted:** the live deployment is Vercel, and HSTS is correct there. It is recorded so
that a future non-Vercel deploy does not lose it without noticing.

---

## AI behaviour and output quality

### 8. Off-domain requests are refused by the model, after tokens are spent — *Accepted*

A request like "plan my wedding" is refused, but the refusal is a **model judgement** returned as
an `out_of_domain` envelope at stage 5 — which means the provider call has already happened and
the tokens are already spent.

The pre-provider check, `getClarification`, is **not** a domain classifier. It is a gibberish
detector: it fires when every long token in the input looks unpronounceable. A well-formed
sentence about the wrong subject passes it, correctly.

**Why accepted:** a real domain classifier that runs before the provider is either a second model
call — which costs what it saves — or a keyword list, which would reject legitimate product ideas
in unanticipated domains. The refusal envelope is schema-validated and tested, so the behaviour is
correct; only its cost is imperfect.

### 9. The pre-provider heuristic is ASCII-only and never fires on Arabic — *Open*

`getClarification` tokenises with `/[a-z]+/g`. Arabic text produces **zero** tokens, the function
returns `null` before any check runs, and the request goes straight to a provider.

Verified 2026-09-03:

| Input | Tokens found | Heuristic |
|---|---|---|
| English gibberish | 2 | runs |
| Arabic gibberish | 0 | **skipped** |
| A real Arabic product idea | 0 | **skipped** |

**Why it matters:** this is a bilingual application, and the cheap guard that protects the
provider budget from nonsense only protects one of its two languages. An Arabic-speaking user
submitting keyboard mash pays for a full generation.

It is honest to say the impact is bounded — the model still refuses nonsense, so the user gets a
correct answer, just an expensive one — and equally honest to say this was never a decision.
Nobody chose to make the heuristic English-only; it was written in English and never revisited.

**Owner:** Yousef. **Next step:** either widen the token class to cover Arabic script and
recheck the vowel-ratio rule, which does not transfer to an abjad and would need a different
signal, or delete the heuristic and accept that stage 5 is the only gibberish guard. Deleting it
is the honest option if a bilingual version cannot be made to work, because a guard that covers
half the users is a guard that reads as complete and is not.

### 10. Estimate quality is the model's; only the arithmetic is guaranteed — *Accepted*

The core design rule of this project is **the model writes prose, the code does the arithmetic**.
`priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are recomputed server-side and
overwrite whatever the model returned.

**What that guarantees:** the same estimates always produce the same plan — the planner is pure,
with no clock and no randomness. The model cannot inflate a priority or overcommit a sprint.

**What it does not guarantee:** that the estimates going *in* are good. `value`, `risk` and story
points are the model's judgement about a product idea it saw for the first time. The ranking is
provably consistent with those numbers; the numbers themselves are an opinion.

**Why accepted:** this is the product. Making the estimates authoritative would require domain
data this project does not have. Saying so plainly is better than implying the output is a
forecast.

### 11. No delivery dates are derived from story points — *Accepted, product non-goal*

The sprint packer is capacity-bounded and reports sprint numbers, never calendar dates. Story
points measure relative size, not duration; converting them to dates requires a measured team
velocity that a five-week student project does not have. Presenting a date derived from a
model's estimate would be the single most misleading thing this application could do.

### 12. `NVIDIA_API_KEY` appears unset in production — *Open*

Three production generations were served by Groq and Gemini, never NVIDIA. **A missing key is
skipped rather than raising**, which is exactly this signature — so the provider chain is
behaving correctly and the environment is probably incomplete.

Recorded from the earlier investigation and **not re-verified as part of this document.**

**Owner:** Yousef. **Next step:** check the Vercel environment for Production and Preview.
The consequence today is a shorter failover chain, not an outage.

---

## Accessibility and internationalisation

### 13. There has been no screen-reader run — *Open*

This is the most significant open gap in the project and it is stated first among the
accessibility items deliberately.

**What has been done:** contrast is measured, not assumed — `npm run capture:ui` reports 38
pairs with 0 below WCAG 2.2 AA, and the pairs are pinned in `tests/evaluation/design-tokens.test.ts`
so a token change fails a test. Every interactive control has an accessible name. The skip link
is first in the tab order. Live regions distinguish `role="alert"` from `role="status"`.

**What that is not:** a screen-reader pass. No part of this application has been listened to with
VoiceOver, NVDA or JAWS. Automated contrast and accessible-name checking finds the errors it can
see in a DOM; it cannot tell you that an announcement arrives at the wrong moment, that a live
region interrupts itself, or that the sprint board is incomprehensible read linearly.

**Do not let any document imply otherwise.** "WCAG 2.2 AA" here means the measurable subset has
been measured.

**Owner:** Yousef. **Next step:** one VoiceOver pass over `/login`, `/scopecraft` and the result
view in both languages, recorded in `docs/qa-test-plan.md` — who ran it, on what, when, and what
they found. An unrecorded manual test did not happen.

### 14. There has been no test on a real mobile device — *Open*

Responsive behaviour is verified at 1280 / 768 / 390px in both text directions, measured from the
live DOM, with no horizontal overflow in any of the six combinations. That is emulation. Touch
target sizes, the sticky header against a real browser chrome, and iOS Safari's viewport
behaviour have not been checked on hardware.

**Owner:** Yousef. **Next step:** open the live URL on a phone, both languages. Half an hour.

### 15. React hydration error #418 on returning visits — *Open*

A console error appears on returning visits. It **reproduces on unmodified production** and
predates the frontend rebuild, so it is not a regression from recent work.

**Why it is still open rather than fixed:** the available fix trades the console error for a
visible language flash on load. That is a worse experience for every user in exchange for a
cleaner console for developers.

**Owner's decision, explicitly not taken unilaterally.** No user-visible symptom exists today.

---

## Testing and evidence

### 16. No test-coverage threshold — *Accepted*

503 tests across 21 suites, and no coverage percentage is enforced.

**Why accepted:** on a project this size a coverage number produces tests written to satisfy the
number rather than to catch a defect. Every real bug found during the backend modules — the eager
`DATABASE_URL` read, the replayed board score, the silent Zod strip, the untyped 500 on a database
outage, the Arabic capacity meter — was found by running the thing, not by an uncovered line.

Recorded as a deliberate omission rather than an oversight.

### 17. `db:check` asserts the index exists, not that the planner uses it — *Accepted*

The first version of the check asserted the query plan and failed on an empty database —
**correctly**, because a sequential scan over zero rows is genuinely the cheaper plan. Asserting a
planner decision means asserting the table's size, which is not a property of the schema.

So the check verifies the index is present and leaves plan selection to Postgres.

### 18. Evidence capture needs live credentials and a database — *Accepted*

`npm run capture:ui` drives headless Chrome over the DevTools Protocol, mints its own session, and
performs **real** generations against **real** providers. `npm run capture:evidence` needs Postgres
and says so when it is missing.

**The consequence:** evidence cannot be regenerated in CI or by a reviewer without credentials, so
the committed artefacts are the record. **Every artefact in `docs/evidence/` is real captured
output from a real run.** Where something could not be captured, the document says it was not
captured rather than describing what it would have shown.

A related operational note: the quota is a rolling 24-hour window, so a capture run can be blocked
by the day's own generations. `DAILY_PLAN_LIMIT` exists for that and raising it locally does not
make the captured generations less real.

---

## Platform

### 19. Unstyled page in Safari over `http://localhost` — *Open, local only*

Safari renders the local development page without styles. The leading suspect is
`upgrade-insecure-requests` in the CSP rewriting the stylesheet request to `https://` on an origin
that serves no TLS.

**Scope:** local development over plain HTTP. On the deployed site everything is already HTTPS, so
the directive is a no-op and the live site is unaffected. Chromium is unaffected locally.

**Owner:** Yousef. **Next step:** confirm in the Safari Web Inspector, then make
`upgrade-insecure-requests` production-only if confirmed.

---

## Related documents

- [`README.md`](../README.md) — the bounded-exposure table and the production upgrade path
- [`docs/security-review.md`](security-review.md) — dependency, container and header review
- [`docs/architecture.md`](architecture.md) — the request pipeline and its ordering guarantees
- [`docs/decision-log.md`](decision-log.md) — every trade-off, with what was traded and why
- [`docs/upgrade-checklist.md`](upgrade-checklist.md) — the open work that would close several of these

---

## Sign-off

The **Accepted** entries above are trade-offs the project owner has weighed and chosen. The
**Open** entries are real gaps with a named owner and a next step; none of them is presented as
resolved.

This document is the single place to look for what ScopeCraft does not do. If a limitation is
found that is not listed here, that is a defect in this document and it should be added.

| Role | Name | Date |
|---|---|---|
| Project owner | Yousef Mohmed Hasabo | 2026-09-03 |
