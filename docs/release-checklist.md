# Release Checklist

Owner: Nour (Integration Lead)

## Pre-release
- [ ] `npm run lint` passes
- [ ] `npm run build` (type-check + production build) passes with no errors
- [ ] `npm test` passes
- [ ] No secret keys committed to git history (`git log -p | grep -i api_key` clean)
- [ ] `.env.example` up to date with all required variable names

## Environment
- [ ] `GEMINI_API_KEY` set in hosting provider's environment (e.g. Vercel), not in code
- [ ] `GROQ_API_KEY` set in hosting provider's environment
- [ ] No env variable containing a secret is prefixed `NEXT_PUBLIC_` (that would expose it to the browser)

## Deployment
- [ ] Preview URL tested end-to-end (submit idea → see structured plan)
- [ ] Production URL tested end-to-end
- [ ] Rollback plan: previous deployment can be re-promoted in hosting dashboard within 5 minutes

## Known limitations (update before each release)
- Single default team capacity profile (not per-team configurable yet)
- No persistence — results are not saved between sessions
