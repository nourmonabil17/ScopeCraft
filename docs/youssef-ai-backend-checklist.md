# ScopeCraft — My AI & Backend Checklist

**Name:** Youssef  
**Role:** AI & Backend Engineer  
**Date:** July 29, 2026

## Backend implementation

- [x] I created typed request and response models.
- [x] I added complete runtime validation for AI responses.
- [x] I validated all required and nested response fields.
- [x] I reject missing, unknown, and incorrectly typed fields.
- [x] I reject malformed provider JSON.
- [x] I removed unsafe TypeScript casting.
- [x] I added valid and invalid request examples.

## API endpoint

- [x] I implemented and tested `POST /api/scopecraft`.
- [x] Valid requests return HTTP `200`.
- [x] Invalid input returns HTTP `400 INVALID_INPUT`.
- [x] Ambiguous input returns HTTP `422 CLARIFICATION_REQUIRED`.
- [x] Provider failure returns HTTP `502 PROVIDER_ERROR`.
- [x] Provider timeout returns HTTP `504 TIMEOUT`.
- [x] Invalid input never contacts an AI provider.
- [x] I added provider and prompt-version response headers.

## AI providers

- [x] I implemented Gemini as the primary provider.
- [x] I implemented Groq as the fallback provider.
- [x] Invalid Gemini responses trigger Groq fallback.
- [x] Missing API keys are detected before network requests.
- [x] I added a 10-second provider timeout.
- [x] I added request cancellation using `AbortController`.
- [x] I updated Gemini to `gemini-3.5-flash-lite`.
- [x] I updated Groq to `openai/gpt-oss-120b`.
- [ ] Test Gemini using a protected real API key.
- [ ] Test Groq using a protected real API key.
- [ ] Confirm live fallback behavior.

## Prompt security

- [x] I upgraded the prompt to version 2.
- [x] I require strict JSON output.
- [x] I mark user content as untrusted.
- [x] I added prompt-injection protection.
- [x] I prohibit system-prompt and credential disclosure.
- [x] I added prompt-version tracking.
- [x] I added prompt-injection tests.

## Deterministic planning

- [x] I added validated story value, risk, and effort.
- [x] I removed the hardcoded risk value.
- [x] I recalculate priority values in backend code.
- [x] I recalculate effort values in backend code.
- [x] I recalculate the sprint plan in backend code.
- [x] I ensure priority and sprint scores always match.
- [x] I added configurable sprint capacity.
- [x] I prevent stories from exceeding sprint capacity.
- [x] I prevent negative remaining capacity.

## Story dependencies

- [x] I added optional story dependencies.
- [x] I schedule prerequisites before dependent stories.
- [x] I reject missing dependencies.
- [x] I reject duplicate story IDs.
- [x] I reject self-dependencies.
- [x] I reject circular dependencies.

## Ambiguous input

- [x] I added conservative gibberish detection.
- [x] I added HTTP 422 clarification responses.
- [x] I return two clarification questions.
- [x] Ambiguous input never reaches Gemini or Groq.
- [x] Legitimate concise ideas remain accepted.

## Backend testing

- [x] I added request-validation tests.
- [x] I added response-validation tests.
- [x] I added real API-route tests.
- [x] I added provider-fallback tests.
- [x] I added missing-key tests.
- [x] I added timeout and cancellation tests.
- [x] I added deterministic-scoring tests.
- [x] I added sprint-capacity tests.
- [x] I added dependency tests.
- [x] I added malformed-output tests.
- [x] I added prompt-injection tests.
- [x] I automated all ten evaluation cases.
- [x] All 44 automated tests pass.

## Quality and security

- [x] TypeScript validation passes.
- [x] ESLint passes with zero warnings or errors.
- [x] The Next.js production build passes.
- [x] The production dependency audit reports zero known vulnerabilities.
- [x] No real API keys are committed.
- [x] Backend CI checks are configured.

## Git status

- [x] I created branch `feature/backend-safety-ci`.
- [x] I created commit `5e062c5`.
- [ ] Push the feature branch to GitHub.
- [ ] Confirm remote GitHub Actions checks pass.
- [ ] Complete the backend pull-request review.
- [ ] Merge the work through `dev`.

## Final result

My local AI and backend implementation is complete and verified. The remaining
tasks require protected provider credentials and GitHub integration access.
