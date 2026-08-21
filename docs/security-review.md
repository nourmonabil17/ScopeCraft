# Dependency Security Review

Date: 2026-07-29

## Production dependencies

- Upgraded Next.js from 14.2.35 to 16.2.12.
- Upgraded React and React DOM from 18.3.1 to 19.2.0.
- Pinned patched transitive releases with npm overrides:
  - `postcss` 8.5.24
  - `sharp` 0.35.3
- `npm audit --omit=dev` result: zero known vulnerabilities.

## Development dependencies

The full audit still reports advisories in development-only Jest and ESLint
dependency chains. They are not included in the production deployment bundle.
The automated fixes proposed by npm are incompatible major-version changes, so
no forced audit fix was applied. Revisit these when the Jest/TypeScript and
Next.js ESLint ecosystems provide compatible upgrade paths.

## Provider lifecycle review

- Gemini uses `gemini-3.5-flash-lite`.
- Groq uses `openai/gpt-oss-120b`.

Provider model IDs should be reviewed before each release because hosted model
availability changes independently of this repository.
