# Session 4 — Integration Lead Checklist (Nour's role)

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
