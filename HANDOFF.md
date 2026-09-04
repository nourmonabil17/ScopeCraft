# ScopeCraft — Session Handoff

**Rewritten:** 2026-08-24 · **Last updated:** 2026-09-04 · **Repo state at:** `31ed8ae`
**Purpose:** pick this project up in a fresh chat without re-deriving context.

Several claims below were true when written and are not any more. Where that happened the
old text is struck through rather than deleted, because the drift is part of the record.

---

## 1. Read this first — six things that will waste your time otherwise

### ⚠️ 1.1 The live site deploys from a FORK, not the team repo

The single biggest trap. There are **two** GitHub repos:

| Repo | Role |
|---|---|
| `nourmonabil17/ScopeCraft` | **Team repo.** `origin`. Where work belongs. |
| `mr-h12/ScopeCraft` | **Personal fork.** ← **Vercel deploys from this, branch `main`** |

**Pushing to the team repo alone never updates the live site.** This cost a full debugging
cycle once already. To ship:

```bash
git push fork dev:main
```

Live in roughly 25 seconds. Repointing Vercel at the team repo is an open decision and must
be done by whoever owns the Vercel project.

### ⚠️ 1.2 `main` is **seventeen** commits behind `dev`

~~five commits behind~~ — **as of 2026-09-04 the gap is 17.** `dev` and `fork main` are at
`31ed8ae`; **team `main` is at `a98910b`** and **local `main` is at `141669a`**, so those two
have drifted from each other as well. Production is current because it serves the *fork's*
`main`, which tracks `dev`. The team repo's `main` is stale. Merging `dev` → `main` is a
pending decision, not an oversight — do not "fix" it silently.

### ⚠️ 1.3 The handbook folder breaks Jest if you work inside it

The handbook CSVs live in a directory whose name contains a literal `[`, which silently
breaks Jest's `<rootDir>` globs — `npm test` reports "0 tests found" while 90 files sit
right there.

- **Handbook CSVs (read-only reference):** `~/Downloads/ScopeCraft/Team10_ScopeCraft_HANDBOOK-…[..`
- **✅ Work here:** `~/Downloads/ScopeCraft`

The folder is now gitignored along with `.DS_Store` and `.claude-flow/`, so a stray
`git add -A` can no longer sweep them in. (It swept three `.DS_Store` files in once.)

### ⚠️ 1.4a Nothing runs without the `AUTH_*` variables

`/scopecraft` is behind a GitHub sign-in as of `fd840e7`. Without `AUTH_SECRET`,
`AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` in `.env.local`, every visit redirects to `/login`
and the sign-in button fails — which looks exactly like a broken build. Set them first; see
README → Authentication for the two-minute GitHub OAuth app setup.

~~**These are almost certainly not set in Vercel yet.** Production will bounce to `/login`
and stay there until they are.~~ **Superseded 2026-09-03, verified again 2026-09-04.** Auth is
fully deployed and working in production. `/login` returns `200`, `/scopecraft` `307`s to it
when signed out, `/api/auth/providers` lists **both GitHub and Google**, a sign-in without a
CSRF token is rejected, and a real browser sign-in on the live site succeeded — four
generations were driven through that session. Do not plan work around this being broken.

`npm run capture:ui` needs the *same* `AUTH_SECRET` the server under capture was started
with — it mints its own session cookie rather than bypassing auth. A mismatch fails the run
with that exact diagnosis in the error message.

### ⚠️ 1.4 Vercel MCP tools are connected to the WRONG account

They authenticate as team `mohanad3` (hobby plan), which **cannot see or deploy**
`scope-craft-nine.vercel.app`. Four attempts were created and silently reverted;
`list_projects` returns empty. Don't retry that path — use `git push fork dev:main`.

### ⚠️ 1.5 A pending history rewrite

Eleven commits carry a `Co-Authored-By: Claude …` trailer that Yousef wants removed. **It has
not been done.** It needs one command run by a human (a history rewrite is blocked in
automated mode):

```bash
git branch -f backup-before-strip dev && FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter 'sed "/^Co-Authored-By: Claude/d"' -- --all && git push --force origin dev && git push --force fork dev:main
```

**Consequences to expect:** ~21 commits get new SHAs (every descendant of the earliest
affected commit), three merge commits are rewritten including the PR #1 and PR #3 merges,
and **nine documents hardcode SHAs that will go stale** — `HANDOFF.md`,
`docs/youssef-ai-backend-checklist.md`, `docs/evidence/curl-evidence.md`,
`docs/evidence/provider-fallback-log.md`, `docs/evidence/ui/ui-evidence.md`,
`docs/evidence/ui/accessibility-checklist.md`, `docs/evidence/cache-evidence.md` (added
2026-09-04, so the count is now **ten**), and the three `docs/evidence/raw/*` captures.
Fix those in a follow-up commit after the rewrite.

### 🔴 1.6 The production database password is exposed and NOT rotated

The `neondb_owner` password on the production Neon branch (`ep-ancient-darkness-ayos140f`)
has been pasted in plaintext **twice** — once in an earlier session, and again on 2026-09-04
when a stray pasted fragment ran as a command and zsh echoed the whole connection string in
its error. It is in terminal scrollback and in assistant transcripts. It is **not** in
`~/.zsh_history` (checked, `grep -c 'npg_'` returned 0), though that check ran before the
shell had necessarily flushed — re-check from a fresh terminal.

The production `DATABASE_URL` verified working on 2026-09-04 is still this old password.

**Fix, in this order — the order matters:**

1. Neon console → production branch → Roles → reset `neondb_owner`
2. Vercel → Settings → Environment Variables → `DATABASE_URL` ← the whole new **pooled**
   string (host contains `-pooler`). Resetting without this step takes production down.
3. Vercel → Deployments → Redeploy. A running deployment does not pick up an env change.
4. `npm run db:check` to confirm `.env.local` still connects — it is not known whether Neon
   scopes that role's password per branch.

If those Vercel variables are managed by a Neon integration, resync rather than hand-editing,
or the edit is overwritten on the next sync.

---

## 2. What this project is

**ScopeCraft** — turns a raw product idea into a validated 11-field PRD, user stories with
testable acceptance criteria, risks, and a capacity-bounded sprint plan. Next.js 16 (App
Router), React 19, TypeScript strict, Zod 4. Team 10, four members.

- **Live:** https://scope-craft-nine.vercel.app/scopecraft
- **Core design rule:** *the model writes prose, the code does the arithmetic.*
  `priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are recomputed server-side and
  **overwrite** whatever the model returned. The same pure functions run client-side
  (`src/lib/scopecraft/client-recalc.ts`) so board edits never re-invoke the AI.

---

## 3. Current state

### Branch heads (verify before trusting — these drift)

| Ref | Commit |
|---|---|
| team `dev` | `31ed8ae` ← newest |
| fork `main` | `31ed8ae` ← **what production serves** |
| team `main` | `a98910b` ← **17 behind, see §1.2** |
| local `main` | `141669a` ← drifted from team `main` too |

### Verified green

- **508 tests**, 21 suites (242 node: API · tools · evaluation — 266 UI)
- **Six runtime dependencies**: `next`, `next-auth`, `postgres`, `react`, `react-dom`, `zod`.
  That number is a feature. Walk the ladder in `CLAUDE.md` §4 before adding a seventh
- `npm run lint` (`--max-warnings=0`), `npx tsc --noEmit`, `npm run build` all clean
- Client-bundle secret scan clean; git history scan clean (0 hits, all branches)
- All three providers reachable (`npm run smoke`)
- **Production verified end-to-end**, not just locally: a real idea returns `200` with 13
  top-level fields and `committed_points <= capacity_points`; an out-of-domain request
  returns `422 OUT_OF_DOMAIN`
- Security headers live: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`; `X-Powered-By` absent
- **Sign-in works end to end, in production**: `/login` `200`, `/scopecraft` `307`s to it,
  both GitHub and Google listed by `/api/auth/providers`, a real browser sign-in succeeded.
  `npm run capture:ui` passes through the real gate with a minted session, all six RTL/LTR
  overflow checks green
- **`POST /api/scopecraft` is gated**: anonymous callers get `401 UNAUTHORIZED` before the
  body is read. This was anonymous until 2026-09-03 and several docs still said so
- **Live generation latency measured**: four production generations at 21.47 / 21.61 /
  20.58 / 19.03 s (mean **20.67 s**) against a local mean of 12.30 s — 1.68× slower
- **The request cache is live**: a repeat request returns in ~0.6 s without calling a
  provider, verified on both the dev branch and production

### Local-only, never committed

`.env.local` holds real NVIDIA / Groq / Gemini keys. Gitignored and verified absent from
tracked files and from all of git history. **Do not commit it.**

---

## 4. Open findings — real issues, none of them blocking

~~Three things~~ **Five things** were found by testing rather than reading. All are
documented; none is fixed. 4.1 is one query away from being closed or killed — see §9.

### 4.1 `NVIDIA_API_KEY` appears to be unset in production

Three consecutive production generations were served by **Groq and Gemini, never NVIDIA** —
the configured primary. A provider with no credential is *skipped* rather than failed, so
that pattern is the signature of a missing key in the Vercel environment. Failover works and
users are unaffected, but the deployed environment does not match `.env.example`.

**Latency evidence added 2026-09-04, pointing the same way.** Four fresh live generations at
21.47 / 21.61 / 20.58 / 19.03 s, every one served by `groq`. Locally, when NVIDIA *is*
configured it burns a full ~30 s timeout before Groq answers — the committed capture shows
one generation at 33.1 s with `attempts=2` (`docs/evidence/raw/cache-transcript.txt`). No live
generation came within 8 s of that ceiling. A **skipped** tier costs nothing; a **failing**
tier costs its timeout, and production is not paying one.

**Still not proven — do not write it up as proven.** `attempts` is not a response header,
production's `AI_TIMEOUT_MS` is not visible from outside, and no production row has ever been
read. **One query settles it.** Four rows now exist carrying the answer, plan ids `cb53652a`,
`642d5816`, `e1aa6cad`, `5e601422`:

```sql
select left(id::text,8), provider_used, attempts, duration_ms
from plans order by created_at desc limit 4;
```

`attempts=1` → NVIDIA was never called, the key is absent, finding closed. `attempts=2` → it
*was* called and failed fast, which is a different problem and this finding is wrong. Needs
the production `DATABASE_URL`, so do it in the same sitting as the rotation in §1.6.

### 4.2 React hydration error #418 on returning visits

Any client-persisted preference that differs from the server default triggers it — verified
with `locale=ar` **and, separately**, with `theme=dark, locale=en`, so it is not locale-specific.
`/scopecraft` is statically prerendered in English with the default theme; a returning visitor
renders different text than the HTML it hydrates against.

`suppressHydrationWarning` is already on both `<html>` and `<body>` and **does not fix it** —
that attribute is one level deep and covers an element's own attributes, not descendant text.
The fix is to make the first client render match the server render and switch after mount,
which trades the console error for a brief flash of the default. **That is a UX decision and
was deliberately left to the owner.** React recovers by client-rendering, so users see the
correct language; it is an error in the console, not a broken page.

### 4.3 `PLANNING_ERROR` is intermittent

**4 of 9** live generations of the same idea returned `502 PLANNING_ERROR` — the model
referencing a story it never emitted. The deterministic planner is doing its job (an invalid
plan is never rendered) but the user sees a failure. Both capture scripts now retry and record
how many attempts the committed evidence took. The likely fix is a repair pass that drops
dangling dependencies before planning instead of failing the request.

---

### 4.4 A cache hit is not byte-identical to the generation it replays

The plan round-trips through a `jsonb` column and Postgres does not preserve object key order
in that type. Same data, same byte count, different key order — reproduced on both the dev and
production branches, so it is a property of the column type rather than a local quirk.
Harmless to any JSON client and outside the Zod contract, but a consumer comparing raw
response text would see a hit and a miss as different. Measured in
`docs/evidence/cache-evidence.md`.

### 4.5 The production form submitted nothing under an automated click

Driving `/scopecraft` in an automated browser on 2026-09-04 filled the textarea and updated
the character counter, but four attempts — coordinate click and element-reference click on the
`type=submit` button — produced **no `POST /api/scopecraft`** in the network log. The API is
fine: the same session generated twice from the page's own `fetch`. `npm run capture:ui` fills
and submits this same form successfully, which makes an automation artifact the likelier
cause than an app bug — **that is an inference, not a result, and it was not diagnosed.**

Do not report the form as broken for users on this basis, and do not report it as fine
either. If anyone ever reports a dead Generate button, start here rather than treating it as
new.

---

## 5. What's left — by person

> The three tracking sheets (Acceptance & Review, Milestone Tracker, Submission Checklist) are
> **Google Sheets** and can only be filled in by a human. They are graded artifacts and remain
> the largest non-code gap.

### Nour Eldeen Mohamed Nabil — Integration Lead
- [ ] **PR #2 is still OPEN** (`youssef72003`) — currently *fails* the written criterion
      *"every member has at least one identifiable contribution merged through review."*
      Highest-priority item in the project.
- [ ] **No git tag exists** — the checklist requires a "tagged release" (`git tag -l` is empty)
- [ ] Decide: merge `dev` → team `main` (§1.2), and repoint Vercel at the team repo (§1.1)
- [ ] Check `NVIDIA_API_KEY` in the Vercel dashboard (§4.1)
- [ ] Sign off Session 3 / Session 4 lead checklists — both carry a factual status note with
      the evidence already gathered, so the review should be quick
- [ ] AI_USAGE section (scaffolded with git-verified facts, needs his own words)
- [x] Architecture, branch rules, contracts, release checklist, contribution matrix

### Yousef Mohmed Hasabo — AI & Backend Engineer *(complete)*
- [x] Schema, validation, 4xx safety, 3-tier fallback, deterministic tools, safe logging
- [x] **Evidence artifacts** — `docs/evidence/` holds the required curl evidence and provider
      fallback/error log, captured live. Regenerate: `npm run capture:evidence`
- [x] **Defense prep** — `docs/defense-prep-backend.md` (trace, modify-map, failure matrix)
- [x] AI_USAGE section — the only complete one; corrected on 2026-08-24 where it had gone
      stale (it claimed no live provider call had ever been made, which was no longer true)
- [x] Security review + CSP, `poweredByHeader: false`, headers consolidated into
      `next.config.js` (`vercel.json` deleted — defining them twice double-emits headers)
- [x] **Authentication** — GitHub *and* Google OAuth, JWT session, `/login`, `/scopecraft`
      gated. ~~The database half of that document is still design only, and **the API
      endpoint is still anonymous**~~ — **both halves closed since.** The database shipped
      (`users`, `plans`, real Neon branches) and `POST /api/scopecraft` answers `401` to an
      anonymous caller before reading the body, verified live twice
- [x] **Persistence and quota** — `plans` row per generation, `DAILY_PLAN_LIMIT` counted over
      a rolling 24 h, failing **closed** when the store is unreachable
- [x] **B2 — generation telemetry.** `plans.duration_ms` and `plans.attempts`, plus one
      `scopecraft.generation` logfmt line per generation. `attempts` counts providers actually
      *called*, so a skipped tier does not increment it — that distinction is what §4.1 turns on
- [x] **A3 — application-layer request cache.** `plans.request_hash`, lookup at stage 4c
      between the quota and the generate call. Per user, `attempts = 0` on a hit, counts
      against the quota. Evidence: `docs/evidence/cache-evidence.md`, dev **and** production
- [x] **Module A closed** — A1 and A3 done and evidenced; **A2 closed as *unverifiable*, not
      as done.** Groq reports no cached-token count, so A2's own check cannot be run. A1 had
      already satisfied its prerequisite. Decision-log entry 48
- [x] **Live latency** — project plan 9.1.6, four timed production generations
- [ ] *Optional:* broader live adversarial pass (5 cases × 3 providers); a server-side domain
      classifier. Both documented as known gaps, neither required

### Joe / Youssef Alaaeldin — Product UI & Workflow Engineer
- [x] 7 UI states, structured rendering, evidence panel, responsive
- [x] **Screenshots — done.** ~~17~~ **22** in `docs/evidence/ui/shots/`, all seven states captured live,
      plus the sign-in screen, three widths, both themes, Arabic RTL. Regenerate:
      `npm run capture:ui` (needs `AUTH_SECRET` — see §1.4a)
- [x] **Accessibility checklist** — `docs/evidence/ui/accessibility-checklist.md`, WCAG 2.2 AA,
      every row measured or test-backed, plus a machine-readable `accessibility-audit.txt`
- [ ] **AI_USAGE section is a placeholder** ← the only gap left on this row
- [ ] Review PR #3 and the accessibility pass (both authored by Yousef, declared in AI_USAGE)
- [ ] User-journey defense prep

### Yasmin Mohamed Islam — Knowledge, Tools & Quality Engineer
- [x] Source register, corpus, taxonomy, tool rules, 10 evaluation cases, injection tests
- [ ] **AI_USAGE section is a placeholder.** Note: her artifacts all entered in Nour's scaffold
      commit `9c67f42`, so **git cannot show her authorship** — she has to state it herself
- [ ] Sign-off on the 1–10 → 1–5 estimation scale change (it rewrote her fixtures)
- [ ] Coverage gaps + prohibited use cases as one document the rubric can point at
- [ ] Evaluation set has no explicit **ambiguous** or **tool-failure** category
- [ ] Evaluation/safety defense prep

### Whole team
- [ ] Three-minute demo · [ ] Individual defense · [ ] Signed-off known limitations

---

## 6. Judgement calls made — don't undo these by accident

**Stale docs get a banner, not a rewrite.** `docs/session2-lead-checklist.md` and
`docs/scopecraft-completion-checklist.html` are dated historical records. Both carry a
superseded banner with a diff table pointing at current sources, original text intact beneath.
Rewriting content under an old date would falsify the record, and the drift is part of the
decision trail the handbook grades.

**Open decision-log items are not marked verified.** Items 1, 2, 4 and 9 are genuinely open
(a missing source URL, incomplete adversarial coverage, a page that 403s robots, a teammate's
signature). Flipping them would make a graded honesty document assert things nobody checked.

**Teammates' sign-off boxes are left unticked.** The Session 3/4 lead checklists are Nour's
review. Each has a factual status note; the ticking is hers.

**`script-src 'unsafe-inline'` in the CSP is deliberate.** The App Router streams ~10 inline
RSC scripts whose contents change every build, so hashes are unmaintainable and a nonce would
force the page out of static prerendering. Documented in `next.config.js` and decision-log
item 11, which records `experimental.sri` as the upgrade path that keeps static generation.

**Canonical sources when docs disagree:**
- API contract → `docs/api-contracts.md`
- Model IDs → `src/lib/ai/models.ts` (but re-run `npm run smoke`; it has gone stale once)

---

## 7. Decision log — 48 numbered entries; 11 open items, 6 closed

~~13 items, 8 closed~~ — that count was never right against the log itself. `docs/decision-log.md`
now holds **48 numbered entries** (the reasoning record) and a separate **Open Items** table of
**11 rows, 6 closed**. Read that table rather than re-deriving it. Its own status line is dated
2026-08-24 and has not been re-audited since, so treat the per-row states as of that date.

**Closed:** 3 (uncitable source), 5 (model IDs), 6 (Zod/Next sources), 7 (stale checklists),
8 (tool shapes), 10 (`sprint_plan` evidence), 13 (RTL skip-link overflow).
**Half-closed by design:** 12 (auth — the page is gated, the endpoint is not).
**Partially closed:** 2 (injection — one live case, not coverage).
**Open:** 1 (MoSCoW/RICE URLs), 4 (OWASP page 403s automated fetch), 9 (Yasmin's sign-off),
11 (CSP `unsafe-inline`, open **by decision**).

Four of the five need a human decision or a human visit, not code.

---

## 8. Commands

```bash
cd ~/Downloads/ScopeCraft

npm test                 # 508 tests, 21 suites
npm run lint             # --max-warnings=0
npx tsc --noEmit
npm run build
npm run smoke            # live provider check — needs .env.local
npm run db:check         # is Postgres reachable? prints host + database, never a credential
npm run dev              # localhost:3000/scopecraft

# regenerate evidence (both make real, billable provider calls)
npm run build && npm run capture:evidence     # API + failover evidence, port 3100
npm run capture:ui                            # 22 screenshots + a11y audit
                                              # needs servers on 3200 (good keys)
                                              # and 3201 (deliberately invalid keys)
                                              # and AUTH_SECRET matching both — see §1.4a
set -a; . ./.env.local; set +a                # then:
npm run capture:cache                         # A3 cache: miss then hit, port 3202
                                              # exits non-zero unless the pair is miss/hit

# secret scan (run after build)
grep -rqE "AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|nvapi-[0-9A-Za-z_-]{20,}" .next/static && echo "LEAK" || echo "CLEAN"

# apply the schema to a database (idempotent; re-run is how you migrate)
#   NOTE: do this BEFORE shipping code that names a new column. recordPlan swallows
#   its errors, so an unknown column stops persistence *silently*.
psql "$DATABASE_URL" -f db/schema.sql          # no psql on this machine — see §1.6 step 4

# ship to production — BOTH, or the live site does not change
git push origin dev && git push fork dev:main
```

**Four gates before every commit**, no exceptions: `npm run typecheck && npm run lint &&
npm test && npm run build`. Plus the secret scan above if the build changed, and
`npm run capture:ui` if UI changed.

**Git identity:** commits must be `Yousef mohmed hasabo <yousefhasabo94@gmail.com>`.
GitHub auth is `gh` as `mr-h12`. **Do not add a `Co-Authored-By` trailer** — see §1.5.

---

## 9. Suggested next step

**1. Rotate the production database password (§1.6).** It is exposed, it is not rotated, and
it is the only item here with a security cost that grows the longer it waits. Everything else
can slip a day; this should not.

**2. In the same sitting, run the one query in §4.1.** You will already have the production
`DATABASE_URL` open. Four rows are sitting there with `attempts` on them, and reading it
closes or kills a finding that has been open for weeks. Two minutes.

**3. Merge or close PR #2** (`youssef72003`, still open, confirmed 2026-09-04). It is the only
outstanding item that currently *fails* a written acceptance criterion, and it belongs to a
teammate, so it needs a human decision.

~~Set the `AUTH_*` variables in Vercel~~ — **done, verified live.** See §1.4a.

After that, in value order: the three placeholder AI_USAGE sections (~15 min each, blocking a
Required submission row — **their authors must write them, not you**), a git tag (`git
ls-remote --tags` is still empty), and the four documents the project plan lists as missing —
`docs/runbook.md` first, since every row of the known-issues table in `CLAUDE.md` §9 is
already a runbook entry in disguise.
