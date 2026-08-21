# Release Checklist

Owner: Nour (Integration Lead)

## Pre-release
- [x] `npm run lint` passes
- [x] `npm run build` (type-check + production build) passes with no errors
- [x] `npm test` passes locally (44/44 tests)
- [x] `npx tsc --noEmit --incremental false` passes locally
- [ ] No secret keys committed to git history (`git log -p | grep -i api_key` clean)
- [ ] `.env.example` up to date with all required variable names
- [x] Production dependency audit reports zero known vulnerabilities

## Environment
- [ ] `GEMINI_API_KEY` set in hosting provider's environment (e.g. Vercel), not in code
- [ ] `GROQ_API_KEY` set in hosting provider's environment
- [ ] No env variable containing a secret is prefixed `NEXT_PUBLIC_` (that would expose it to the browser)

## Deployment
- [ ] Preview URL tested end-to-end (submit idea → see structured plan)
- [ ] Production URL tested end-to-end
- [ ] Rollback plan: previous deployment can be re-promoted in hosting dashboard within 5 minutes

## Known limitations (update before each release)
- UI uses the default capacity of 10; API clients may provide
  `capacity_per_sprint` from 1–100
- No persistence — results are not saved between sessions
- Provider requests time out after 10 seconds
- Both `GEMINI_API_KEY` and `GROQ_API_KEY` are required for full fallback coverage
