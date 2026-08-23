# Dependency Security Review

Date: 2026-08-24

## Production dependencies

- Upgraded Next.js from 14.2.35 to 16.2.12.
- Upgraded React and React DOM from 18.3.1 to 19.2.0.
- Pinned patched transitive releases with npm overrides:
  - `postcss` 8.5.24
  - `sharp` 0.35.3
- Ran `npm audit fix` (2026-08-24) to resolve a high-severity advisory pulled
  in transitively via `nanoid <3.3.18`
  ([GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) —
  custom generators can loop indefinitely when size is zero). The fix
  installed a patched `nanoid` release with no major-version bump and no
  application code changes required.
- `npm audit --omit=dev` result (post-fix): zero known vulnerabilities.

## Development dependencies

The full audit (`npm audit`, all deps) reports two further high-severity
advisories confined to development-only ESLint tooling chains:
`brace-expansion` (via `@typescript-eslint/typescript-estree`) and `js-yaml`
(via `@eslint/eslintrc`). Neither ships in the production bundle — both are
absent from `npm audit --omit=dev`. The fixes npm proposes for these are
incompatible major-version changes to the ESLint toolchain, so no forced
audit fix was applied. Revisit when the ESLint/TypeScript-ESLint ecosystem
offers a compatible upgrade path.

## Provider lifecycle review

Model IDs are defined once, in code, at `src/lib/ai/models.ts` — that file is
the source of truth, not this document, and this table is only as fresh as
its last live verification.

**Live-verified 2026-08-24** via `npm run smoke` with real credentials for
all three providers, each confirmed with a real `200 OK`:

- NVIDIA NIM uses `meta/llama-3.1-8b-instruct`.
- Groq uses `openai/gpt-oss-120b`.
- Gemini uses `gemini-3.5-flash-lite`.

The prior defaults (`deepseek-ai/deepseek-v4-flash-0731`,
`llama-3.3-70b-versatile`, `gemini-1.5-flash`) were all dead: Groq and Gemini
returned `404` (retired model, valid credential), and NVIDIA's model hung to
a full timeout instead of erroring — see `docs/decision-log.md` item 5 for
the full diagnosis. A previous version of this document briefly claimed
`models.ts` should be trusted over this table without anyone having actually
run a live check — that was an error; neither source is trustworthy on its
own without a recent `npm run smoke` run to back it up.

All three are overridable per-environment via `NVIDIA_MODEL`, `GROQ_MODEL`,
and `GEMINI_MODEL` without a code change. Provider model IDs should be
reviewed before each release because hosted model availability changes
independently of this repository — run `npm run smoke` rather than trusting
either this document or `models.ts` from memory.
