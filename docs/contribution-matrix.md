# Contribution Matrix — ScopeCraft (Team 10)

Owner: Nour Eldeen Mohamed Nabil (Integration Lead / Solution Architect)
Date: 2026-08-24

This matrix documents each member's verified deliverables — verified meaning present in
the repository, passing its own tests, and (where applicable) confirmed against a live
run rather than a mock. It is not a self-report; every row below was checked against the
actual `dev`/`main` branch (`4c6ff18`) before being written down.

---

## Nour Eldeen Mohamed Nabil — Integration Lead / Solution Architect

| Deliverable | Location | Verified |
|---|---|---|
| System architecture & module ownership | `docs/architecture.md` | Present; module boundaries match the actual `src/` layout |
| CI/CD pipeline | `.github/workflows/ci.yml` | `actions/checkout@v5`, `actions/setup-node@v5`, Node 22; runs test/typecheck/lint/build on every push and PR to `main`/`dev` |
| Repository branching rules | `docs/architecture.md` §5 | `main` protected/deployable, `dev` integration branch, PR-before-merge policy documented |
| Deployment security headers | `next.config.js` | `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, plus `poweredByHeader: false`. Applied to all routes. Moved here from `vercel.json` on 2026-08-24 so they also cover `next start` and self-hosted deployments, and can be verified before a deploy |
| Release documentation | `docs/release-checklist.md` | Rewritten 2026-08-24 to match current test count, provider list, and timeout; pre-flight, environment, deployment, and rollback sections |
| Contribution matrix | `docs/contribution-matrix.md` | This document |

**Known deviation, stated plainly:** the documented branch policy in `docs/architecture.md`
§5 requires every merge to `main`/`dev` to go through a reviewed pull request. In practice,
the backend integration work in this repository's history was merged directly
(fast-forward, no PR) rather than through review — the frontend work did go through PR #3.
This is a real gap between the documented process and what happened, not a resolved item;
flagging it here rather than writing a matrix that implies otherwise.

---

## Yousef Mohmed Hasabo — AI & Backend Engineer

| Deliverable | Location | Verified |
|---|---|---|
| 3-tier provider failover (NVIDIA → Groq → Gemini) | `src/lib/ai/providers.ts`, `src/lib/ai/models.ts` | Live-verified 2026-08-24 — `npm run smoke` returns `200 OK` on all three providers |
| Zod runtime schemas for all 11 PRD fields | `src/lib/scopecraft/schema.ts` | `RequestSchema`, `ProviderOutputSchema`, `ScopeCraftResponseSchema` enforced on every request and response |
| Deterministic Agile tools | `src/lib/scopecraft/tools.ts` | `priorityScore`, `scheduleSprints`/`planSprint`, `summarizeSprintPlan` — pure functions, no I/O, model output for these fields is discarded server-side |
| OWASP LLM01 prompt-injection defense | `src/lib/scopecraft/service.ts` | XML fencing (`<product_idea>`, `<constraints>`), `fenceUserText()` delimiter-forgery neutralization, safe-refusal envelope (`422 OUT_OF_DOMAIN`) |
| API & backend test suite | `tests/api/scopecraft.test.ts` (107), `tests/api/tools.test.ts` (14), `tests/evaluation/scopecraft.evaluation.test.ts` (10) | **131 tests, all passing** |
| Live end-to-end verification | — | 2026-08-24: real `POST /api/scopecraft` with a genuine product idea returned a coherent 11-field PRD with a valid `sprint_plan`; a live prompt-injection attempt was refused `422 OUT_OF_DOMAIN` with no credential in the response body |
| Dependency security | `package-lock.json` | `npm audit fix` resolved a high-severity `nanoid` advisory (GHSA-2v37-7h3g-55p8); `npm audit --omit=dev` reports zero vulnerabilities |

---

## Joe / Youssef Alaaeldin — Product UI & Workflow Engineer

| Deliverable | Location | Verified |
|---|---|---|
| 7 UI state machine | `src/app/scopecraft/page.tsx` | Discriminated union: `idle`, `loading`, `success`, `empty`, `validation_error`, `domain_refusal`, `provider_error` |
| Intake wizard with presets | `src/components/scopecraft/InputForm.tsx`, `presets.ts` | Client-side pre-validation, 3 named starter presets |
| WCAG 2.2 AA accessibility | `InputForm.tsx`, `StateViews.module.css`, and related components | Labeled controls, `aria-describedby`/`aria-invalid`/`aria-errormessage`, visible focus rings, `role="alert"` vs `role="status"` distinction |
| Interactive sprint board with live client recalculation | `InteractiveSprintBoard.tsx`, `src/lib/scopecraft/client-recalc.ts` | Zero network calls — story toggling and point edits recompute capacity client-side using the same pure functions as the backend |
| Evidence panel & export actions | `EvidencePanel.tsx`, `ExportActions.tsx`, `export-format.ts` | Cites verified sources from `docs/source-register.md`; Markdown copy and JSON backlog download, both board-aware |
| UI test suite | `tests/ui/InputForm.test.tsx` (38), `tests/ui/InteractiveBoard.test.tsx` (19), `tests/ui/StateTransitions.test.tsx` (13) | **70 tests, all passing** |

---

## Yasmin Mohamed Islam — Knowledge, Tools & Quality Engineer

| Deliverable | Location | Verified |
|---|---|---|
| Approved grounding corpus | `knowledge/scopecraft/` | PRD template, user-story template, 3 seed product ideas, plus the default team capacity profile in `src/lib/scopecraft/tool-rules.ts` |
| Primary source register | `docs/source-register.md` | 3 sources with URL, access date, and specific claim used — Scrum Guide, GitHub Issues docs, Gemini structured-output docs |
| 10-case evaluation matrix | `tests/evaluation/scopecraft-cases.json`, `tests/evaluation/scopecraft.evaluation.test.ts` | 5 normal, 1 clarification/ambiguous, 2 invalid-input, 2 prompt-injection cases — all 10 passing, `tests/evaluation/report.md` documents category breakdown |
| MoSCoW taxonomy calibration | `src/lib/scopecraft/taxonomy.ts` | Bands (`must ≥ 2.2`, `should ≥ 1.3`, `could ≥ 0.7`) calibrated to the project's own 1–5/1–5/1–13 scale |

---

## Combined verification summary

| Gate | Result |
|---|---|
| Tests | **201/201 passing** (131 backend, 70 frontend) |
| Lint | Clean — `eslint . --max-warnings=0` |
| Types | Clean — `tsc --noEmit` |
| Build | Clean — 4 routes, `/api/scopecraft` dynamic |
| Dependency audit | 0 vulnerabilities (production and dev) |
| Live provider connectivity | All 3 providers reachable and verified with real `200 OK` responses (2026-08-24) |
| Git parity | `main` and `dev` in sync at `4c6ff18` (local and remote) |
| Deployment | Not yet live — see `docs/release-checklist.md` |

---

## Addendum — 2026-09-04: authorship of `docs/frontend-architecture.md`

Recorded here rather than folded into the tables above, which are Nour's dated record from
2026-08-24 and are left intact.

**`docs/frontend-architecture.md` was written by Yousef Mohmed Hasabo.**

The frontend row in this matrix is Joe's, and Module H4 of `docs/upgrade-checklist.md` says the
document must not be authored on his behalf without coordination. It is written by Yousef
anyway, deliberately, for two reasons stated so the credit is not ambiguous:

1. The September rebuild the document describes — the design-token layer (`src/lib/design/`),
   the six `src/components/ui/` primitives, the breakpoint audit, the token migration that
   removed the legacy custom-property layer — was Yousef's work, under Modules C and D of the
   upgrade checklist. Documenting it is part of that work, not a claim over Joe's.
2. Scope for this project assigns Yousef the whole surface, frontend and documentation included.

**What is *not* reassigned by this note.** The components the document describes remain credited
where they were built: the seven-state union, `InputForm`, `ResultView`,
`InteractiveSprintBoard`, `EvidencePanel` and `ExportActions` are Joe's, as the tables above and
the file headers in `src/` both record. This addendum covers the authorship of one document.
