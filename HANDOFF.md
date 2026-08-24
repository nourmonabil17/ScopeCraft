# ScopeCraft — Session Handoff

**Written:** 2026-08-24 · **Repo state at:** `8846f52` (team `dev`)
**Purpose:** pick this project up in a fresh chat without re-deriving context.

---

## 1. Read this first — three things that will waste your time otherwise

### ⚠️ 1.1 The live site deploys from a FORK, not the team repo

This is the single biggest trap in the project. There are **two** GitHub repos:

| Repo | Role |
|---|---|
| `nourmonabil17/ScopeCraft` | **Team repo.** `origin`. Where work belongs. Not a fork. |
| `mr-h12/ScopeCraft` | **Your personal fork.** ← **Vercel deploys from this, branch `main`** |

**Pushing to the team repo alone will never update the live site.** This already cost
a full debugging cycle: work was pushed to the team repo, Vercel was redeployed, and
nothing changed — because Vercel was faithfully rebuilding the fork's stale `main`.

To ship to production you must push to **`fork main`**:

```bash
git push fork main:main
```

The deploy triggers automatically and goes live in roughly 25 seconds.

> **Better long-term fix:** repoint the Vercel project at `nourmonabil17/ScopeCraft`
> so the team repo is the single source of truth. Must be done by whoever owns the
> Vercel project — it is **not** the `mohanad3` account the assistant's Vercel tools
> are connected to (see §1.3).

### ⚠️ 1.2 The original working directory is unusable — use the clean clone

The folder the session starts in contains only handbook CSVs, and its **name contains a
literal `[` character**, which silently breaks Jest's `<rootDir>` glob matching —
`npm test` reports "0 tests found" while 90 files sit right there.

- **Handbook CSVs (read-only reference):**
  `~/Downloads/Team10_ScopeCraft_HANDBOOK-5-SESSION PLAN,...,Team10[..`
- **✅ Actual code — work here:** `~/Downloads/ScopeCraft`

### ⚠️ 1.3 Vercel MCP tools are connected to the WRONG account

The assistant's Vercel tools authenticate as team `mohanad3` (hobby plan), which
**cannot see or deploy** `scope-craft-nine.vercel.app`. Four deployment attempts
through those tools were created and then silently reverted within seconds —
`list_projects` returns empty. Do not retry that path; use `git push fork main:main`.

---

## 2. What this project is

**ScopeCraft** — turns a raw product idea into a validated 11-field PRD, user stories,
risks, and a capacity-bounded sprint plan. Next.js 16 (App Router), React 19,
TypeScript, Zod. Team 10, four members.

- **Live:** https://scope-craft-nine.vercel.app/scopecraft
- **Core design rule:** *the model writes prose, the code does the arithmetic.*
  `priority`, `effort`, `sprint`, `sprint_plan`, `moscow` are recomputed server-side and
  **overwrite** whatever the model returned. The same pure functions run client-side
  (`src/lib/scopecraft/client-recalc.ts`) so board edits never re-invoke the AI.

---

## 3. Current state

### Branch heads (verify before trusting — these drift)

| Ref | Commit |
|---|---|
| team `dev` | `d856fb4` ← newest |
| team `main` | `4fea03b` |
| fork `main` | `4fea03b` ← **what production serves** |
| fork `dev` | `4fea03b` |

**`d856fb4` (doc corrections) is on team `dev` only.** It is not on any `main` and is
therefore **not live**. Propagating it is a pending decision, not an oversight.

### Verified green

- **242 tests passing**, 8 suites (131 backend/evaluation, 111 UI)
- `npm run lint` (`--max-warnings=0`), `npx tsc --noEmit`, `npm run build` all clean
- Client-bundle secret scan clean; `npm audit --omit=dev` → 0 vulnerabilities
- **All three AI providers verified live** (`npm run smoke`, 2026-08-24)

### Local-only, never committed

`.env.local` holds real NVIDIA / Groq / Gemini keys. It is gitignored and verified
absent from tracked files. **Do not commit it.** `npm run smoke` reads it via
`tsx --env-file-if-exists`.

---

## 4. What was done in the last session

1. **Recovered the repo** — the previous local checkout no longer existed; re-cloned.
2. **First-ever live provider test.** Caught a real production bug: **all three default
   model IDs were dead.** Groq/Gemini returned `404` (retired), NVIDIA hung to timeout.
   Replaced with live-verified IDs: `meta/llama-3.1-8b-instruct`,
   `openai/gpt-oss-120b`, `gemini-3.5-flash-lite`.
3. **Fixed `npm run smoke`** silently reporting `SKIPPED` with valid keys (`tsx` doesn't
   auto-load `.env`).
4. **Patched high-severity `nanoid`** advisory.
5. **Added** `docs/contribution-matrix.md`, `vercel.json` (security headers), rewrote
   `docs/release-checklist.md`, updated `README.md`.
6. **Major frontend upgrade** — dark/light/system theming, full EN/AR bilingual + RTL,
   tabbed PRD view, toast system, header, capacity slider, progress ring. 201 → 242 tests.
7. **Kept `ScopeCraft` and `System` untranslated** in Arabic (brand name / OS setting).
8. **Diagnosed and fixed the fork-vs-team deploy problem**; live site now current.
9. **Corrected stale `INVALID_INPUT` docs** (see §6 for the nuance).

---

## 5. What's left — by person

> All three tracking sheets (Acceptance & Review, Milestone Tracker, Submission
> Checklist) are **100% "Not Started"**. They are graded artifacts and nobody has
> filled them in. This is the largest remaining gap and it is **not code**.

### Nour Eldeen Mohamed Nabil — Integration Lead
- [ ] **PR #2 is still OPEN** (`youssef72003`) — this currently *fails* the written
      criterion *"every member has at least one identifiable contribution merged
      through review."* Highest-priority item in the project.
- [ ] **No git tag exists** — checklist requires a "tagged release"
- [ ] Milestone Tracker: all 5 sessions "Not Started", 0%
- [ ] Submission Checklist: all 16 rows "Not Started"
- [ ] Production smoke tests — 17 unchecked boxes in `docs/release-checklist.md`
- [ ] Decide: repoint Vercel at the team repo (§1.1)
- [x] Architecture, branch rules, contracts, release checklist, contribution matrix

### Yousef Mohmed Hasabo — AI & Backend Engineer *(complete)*
- [x] Schema, validation, 4xx safety, 3-tier fallback, deterministic tools, tests,
      safe logging — all done and **live-verified**
- [x] AI_USAGE section — **only member who filled it in**
- [x] Stale error-code docs corrected (`d856fb4`)
- [x] **Evidence artifacts — closed.** `docs/evidence/` now holds the required
      *"Postman/curl evidence"* and *"provider fallback/error log"*, captured from a
      production build against live providers by `scripts/capture-evidence.sh`
      (`npm run capture:evidence`). Eleven cases including a real one-hop failover to
      Groq and a two-hop failover to Gemini. This was his last hard gap.
- [x] Decision-log items closed where genuinely resolved — now **6 of 10 closed**
      (see §7). The four that remain need a human, not code.
- [x] Backend defense prep — `docs/defense-prep-backend.md`

> **Nothing on Yousef's acceptance row is now unevidenced.** His self-check can be
> moved to *Ready for Review* with `docs/evidence/` as the Evidence Link.

### Joe / Youssef Alaaeldin — Product UI & Workflow Engineer
- [x] 7 UI states, structured rendering, evidence panel, a11y, responsive — all built
- [ ] **Zero screenshots or recordings committed** — `find` for `*.png/mp4/gif/mov`
      returns nothing. Required evidence.
- [ ] Responsive-views evidence
- [ ] Accessibility checklist as a document
- [ ] **AI_USAGE section is a placeholder** (`_To be completed by Joe._`)
- [ ] User-journey defense prep

### Yasmin Mohamed Islam — Knowledge, Tools & Quality Engineer
- [x] Source register, corpus, taxonomy, tool rules, 10 evaluation cases, injection tests
- [ ] Coverage gaps + prohibited use cases as **one document** the rubric can point at
- [ ] Sign-off on the 1–10 → 1–5 estimation scale change (it touched her fixtures)
- [ ] **AI_USAGE section is a placeholder**
- [ ] Evaluation/safety defense prep

### Whole team
- [ ] Three-minute demo · [ ] Individual defense · [ ] Signed-off known limitations

---

## 6. Judgement calls made — don't undo these by accident

**The "5 stale docs" was wrong — only 2 were.** A raw `grep INVALID_INPUT docs/`
returns 5 files, but 3 are *correct historical notes* describing the Module 5
migration ("the former catch-all `INVALID_INPUT` is gone"). Rewriting those would
destroy the decision trail the handbook grades. Only two actually asserted it as
current behaviour, and only those two were changed.

**`docs/session2-lead-checklist.md` was NOT rewritten.** It is Nour's file *and* a
Session 2 historical record. It now carries a superseded banner with a diff table
pointing at `docs/api-contracts.md`, original text intact beneath. Rewriting another
member's session history to match today's code would erase the trail. Nour owns
whether to keep it that way.

**Canonical sources when docs disagree:**
- API contract → `docs/api-contracts.md`
- Model IDs → `src/lib/ai/models.ts` (but re-run `npm run smoke`; it has gone stale once)

---

## 7. Decision log — 10 numbered items, 6 resolved

`docs/decision-log.md` now opens its Open Items section with a status table; read that
rather than re-deriving this.

Resolved: **3** (uncitable Google source — standing rule, no action), **5** (model IDs),
**6** (Zod / Next.js sources re-fetched 2026-08-24), **7** (stale checklists),
**8** (tool shapes), **10** (`sprint_plan` — three live captures now exist; the
estimate-quality caveat stands by design and is not closable).
Partially closed: **2** (injection — one live case, not full coverage; Yasmin's to close).
Still open: **1** (MoSCoW/RICE URLs), **4** (OWASP page needs a human visit — returns 403
to automated fetch), **9** (Yasmin's unsigned scale change).

**All three genuinely-open items need a human decision or a human visit, not a code
change.** Item 6's closure also corrected a small inaccuracy: the Next.js Route Handlers
reference does not actually say "server-side only" in those words, so the production
checklist's `NEXT_PUBLIC_` line is now the registered source for that claim.

---

## 8. Commands

```bash
cd ~/Downloads/ScopeCraft

npm test                 # 242 tests
npm run lint             # --max-warnings=0
npx tsc --noEmit
npm run build
npm run smoke            # live provider check — needs .env.local
npm run capture:evidence # re-capture docs/evidence/ (needs a build first; real calls)
npm run dev              # localhost:3000/scopecraft

# secret scan (gate 5, run after build)
grep -rqE "AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|nvapi-[0-9A-Za-z_-]{20,}" .next/static && echo "LEAK" || echo "CLEAN"

# ship to production
git push fork main:main
```

**Git identity:** commits must be `Yousef mohmed hasabo <yousefhasabo94@gmail.com>`.
An earlier session began using a different persona from a task script and was
corrected — do not reintroduce it. GitHub auth is `gh` as `mr-h12`.

---

## 9. Suggested next step

**Merge or close PR #2.** It is the only outstanding item that currently *fails* a
written acceptance criterion, and it belongs to a teammate, so it likely needs a human
decision before anything else can be called done.

After that, the cheapest high-value wins are the three placeholder AI_USAGE sections
(~15 min each, currently blocking a "Yes/Required" submission row) and Joe's
screenshots — the only fully missing evidence category in the project.
