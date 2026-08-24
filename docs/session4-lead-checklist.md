# Session 4 — Integration Lead Checklist (Nour's role)

> **Status note added 2026-08-24 (Yousef).** Boxes are **yours to tick** — this only supplies
> the evidence:
>
> - Production build clean; `/scopecraft` still statically prerendered.
> - Environment variables: documented in `.env.example` and `docs/release-checklist.md`.
>   **One discrepancy found** — three consecutive production generations were served by Groq
>   and Gemini, never NVIDIA, which is the signature of `NVIDIA_API_KEY` being unset in the
>   hosting environment. Worth checking the dashboard before you sign this off.
> - No secret is prefixed `NEXT_PUBLIC_`: verified, zero occurrences in `src/`, and
>   `.next/static` scanned clean for key patterns.
> - Production URL completes the main journey **and** the refusal path — both verified live.
>   A **preview**-environment test has not been done; production was tested directly.
> - Rollback plan: documented in `docs/release-checklist.md`.
> - Known limitations: updated in `README.md`, now including the unauthenticated-endpoint and
>   rate-limiting boundary.

## 1. Release branch & environment
- Create a `release` branch from `dev` once Session 3 checkpoint is met
- Configure environment variables on the hosting provider (e.g. Vercel): `GEMINI_API_KEY`, `GROQ_API_KEY`
- Confirm no secret is prefixed `NEXT_PUBLIC_` (would leak to browser)

## 2. Production build
- [x] `npm run lint` clean
- [x] `npm run build` (type-check + build) clean
- [x] `npm test` clean
- [x] Youssef's 10-second timeout, fallback, missing-key handling, and controlled
  502/504 responses covered by automated tests
- [ ] Review Joe's accessibility/responsive polish
- [x] All ten of Yasmin's evaluation cases run offline, including controlled
  clarification for ambiguous input and prompt-injection safeguards

## 3. Deployment & rollback
- Deploy to preview URL, test full journey
- Promote to production URL, test full journey again
- Document rollback plan: how to re-promote the previous deployment within 5 minutes

## 4. Session 4 Checkpoint (`docs/release-checklist.md`)
- [ ] Production build clean, no unresolved errors
- [ ] Environment variables documented and set correctly
- [ ] Preview + production URLs both complete the main user journey
- [ ] Rollback plan documented
- [ ] Known limitations section updated
