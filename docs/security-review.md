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

> **Resolved as of 2026-08-28.** `npm audit` across all dependencies now reports
> **zero** vulnerabilities, so the two advisories described below no longer
> apply. The paragraph is kept because the reasoning — why a forced `audit fix`
> was refused rather than applied — is the part worth carrying forward.

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

- NVIDIA NIM uses `openai/gpt-oss-20b`.
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


---

## Container image (added 2026-08-28)

`npm audit` and an image scan disagree, and both are right about different
trees. Against `scopecraft:local`, built from the `Dockerfile` at
`d00282c`:

| Scanner | Scope | Result |
|---|---|---|
| `npm audit --omit=dev` | the six runtime dependencies | **0 vulnerabilities** |
| `npm audit` | runtime + dev dependencies | **0 vulnerabilities** |
| `docker scout cves` | everything in the image | **16 (1 critical, 15 high)** |

None of the 16 are in this project's dependencies. Located inside the image:

- **9 in npm's own vendored tree** at `/usr/local/lib/node_modules/npm` —
  `brace-expansion`, `ip-address`, `picomatch`, `sigstore` and `tar`, plus a
  critical in `tar`. These ship with the `node:22-alpine` base image.
- **7 in `openssl` 3.5.7-r0**, an Alpine `apk` package from the same base image.

**Change made, and not yet verified.** The runner stage now deletes `npm`, `npx`
and `yarn`: the standalone server starts with `node server.js` and nothing at
runtime shells out to a package manager, so their dependency trees are attack
surface with no upside. **The rebuild could not be run** — `node:22-alpine` is
not cached on this machine and the Docker daemon cannot reach Docker Hub
(`context deadline exceeded` resolving the manifest; the same proxy/DNS failure
recorded against `npm ci` in the container). So the CVE count after the change
is unmeasured, and the existing `scopecraft:local` image still carries all 16.

Re-run once the daemon has network:

```bash
docker build --network=host -t scopecraft:local .
docker scout cves scopecraft:local --only-severity critical,high
```

The `openssl` findings will not be fixed by that change. They need a base image
that has picked up the patched Alpine package, which the same rebuild would pull.

## Security headers: five are ours, the sixth is the platform's

Verified against production on 2026-08-28, six headers are present:
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. `X-Powered-By` is
absent.

Only **five** of those come from `next.config.js`. `Strict-Transport-Security`
is added by Vercel, not by this application — `grep` finds no HSTS anywhere in
the source. That matters for the container path: **an image deployed anywhere
other than Vercel serves five headers, not six**, and loses HSTS silently. Any
document that says "all six headers are configured" is describing the Vercel
deployment, not the application.
