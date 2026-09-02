# ScopeCraft — upgrade checklist

**Status:** open · **Started:** 2026-09-02 · **Owner:** Yousef Mohmed Hasabo

Everything on this page came out of the review session of 2026-09-02. It is the
working list for the post-deployment upgrade: the frontend rebuild the owner
asked for, plus the backend and AI-layer findings that came out of reading the
code at commit `ec3a984`.

This document is **not** a replacement for [`project-plan.md`](project-plan.md).
That file remains the master checklist for the graded deliverable. This one
tracks the upgrade work on top of a system that is already deployed and working.

---

## How we work this list

1. Work happens **one point at a time**, in order, top to bottom.
2. Before starting a point, the point is **proposed** — what will change, which
   files, what the check will be.
3. **The owner accepts the point before any code is written.** No point begins
   on assumption.
4. When the point is done, it gets a **full review**: what changed, what was
   verified and how, what was left out, and what it cost elsewhere in the repo
   (tests, docs, numbers that drift).
5. Only after that review does the next point get proposed.
6. A point that turns out to be wrong, unnecessary, or more expensive than it is
   worth gets **struck out with the reason recorded**, not silently dropped.

Boxes are ticked only against verified work — the standing rule from
`CLAUDE.md` §2 applies to this file exactly as it does to every other.

### Gates every point must pass before it is called done

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Plus `npm run capture:ui` for any point that changes the UI.

---

## Skills to be used, and where

The owner asked that the relevant design and frontend skills be used rather than
improvised over. These are the ones that apply, and the stage each belongs to:

| Stage | Skill | Why |
|---|---|---|
| Design direction, before any rewrite code | `superpowers:brainstorming` | In progress now — produces the spec |
| Turning the approved spec into ordered work | `superpowers:writing-plans` | Produces the implementation plan |
| Authoring the new visual layer | `taste-skill:taste-skill` | Anti-templated frontend direction |
| Reviewing each rebuilt view | `web-design-guidelines` | Web Interface Guidelines compliance |
| Re-earning the a11y rubric row | `design:accessibility-review` | WCAG 2.2 AA is a graded row |
| Token and component consistency | `design:design-system` | Keeps 47 files from drifting apart |
| Executing multi-task modules | `superpowers:subagent-driven-development` | Per-task implement + review loop |
| Verifying before any "done" claim | `superpowers:verification-before-completion` | Evidence before assertions |

---

## Module A — AI and prompt layer

The three findings from reading [`providers.ts`](../src/lib/ai/providers.ts) and
[`service.ts`](../src/lib/scopecraft/service.ts).

- [ ] **A1 — Split the system rules out of the user message.**
      `openAICompatibleGenerate` currently sends `SYSTEM_RULES` and the fenced
      user text jammed into a single `{role:"user"}` message; there is no system
      role at all. Split into a real system message (and Gemini's
      `systemInstruction`). This is a correctness fix first — instructions and
      untrusted data should not share a role — and a prerequisite for A2.
      *Check:* existing injection tests still pass; a new test asserts the user's
      idea never appears in the system message.

- [ ] **A2 — Let provider-side prompt caching actually engage.**
      Once A1 lands, the system prefix is stable and byte-identical across every
      request, which is the condition Groq's automatic prefix caching and
      vLLM-backed NIM KV reuse both need. No SDK, no new dependency — the work is
      keeping the prefix stable and confirming it. *Check:* two identical
      back-to-back live calls, cached-token counts recorded in evidence.
      **Not in scope:** Gemini explicit context caching. `SYSTEM_RULES` is ~230
      tokens, well under Gemini's ~1024-token cache minimum, so it would buy
      nothing. Recorded here so it is not re-proposed later.

- [ ] **A3 — Cache identical requests at the application layer.**
      Hash `(idea + constraints + team_capacity_points)` and check it before
      calling any provider. This is the one that actually saves money and kills
      the 50 s wait for a repeat. Uses Postgres, which is already a dependency.
      *Check:* a repeat request returns without a provider call, proven by the
      provider counter, not by timing.

---

## Module B — Backend and API

- [ ] **B1 — Rate-limit the anonymous endpoint.**
      `POST /api/scopecraft` is anonymous and unmetered. This is documented and
      deliberate for the MVP (known issue #6), so this point is about closing it
      *knowingly*, not about calling the current state a bug. Per-IP or
      per-session counter in Postgres, no new dependency.
      *Check:* the limit trips in an integration test and returns a typed
      envelope, not a bare 429.

- [ ] **B2 — Structured generation logging.**
      `provider_used` and `prompt_version` are already persisted per plan, but
      every latency and failover fact this project has recorded was measured by
      hand in one-off runs. Log one structured line per generation so the numbers
      come from the system instead of from an afternoon of manual curling.
      *Check:* a query returns real rows after a real generation.

*Not a point:* CI. `.github/workflows/ci.yml` already runs tests, typecheck,
lint and build on every push and PR to `main` and `dev`. Earlier notes in this
repo claiming there is no CI pipeline are stale and should be corrected when
Module H is reached.

---

## Module C — Frontend rebuild: foundations

The owner's decision, recorded 2026-09-02: **a full ground-up rewrite**, not a
restyle. All 47 frontend files are replaced. Explicitly **dependency-free** — no
Tailwind, no component library, no motion library. `src/lib/i18n/translations.ts`
and `src/context/*` survive the rewrite; they are not part of the visual layer.

What the rewrite must re-earn rather than inherit: WCAG 2.2 AA, EN/AR RTL
correctness, and test coverage. These are graded rows, not nice-to-haves.

- [x] **C1 — Design direction locked.** *Done 2026-09-02.* Direction A
      (technical editorial) with direction C's dark palette, approved by the owner
      after two rounds of mockups. Written up in
      [`specs/2026-09-02-frontend-rebuild-design.md`](superpowers/specs/2026-09-02-frontend-rebuild-design.md),
      including the two decisions taken inside the owner's instruction: the teal
      accent is shared across both themes rather than dark-only, and MoSCoW is
      encoded by fill weight rather than hue so it does not depend on colour.
- [ ] **C2 — Design tokens.** One token layer — colour, type scale, spacing,
      radius, elevation, motion durations — defined once, in both themes, with
      contrast measured rather than assumed.
- [ ] **C3 — Responsive system.** The real gap: **nine CSS modules currently
      have zero media queries**, including `ResultView`, `HistoryList` and the
      main `page.module.css`. Only three breakpoints exist in the entire app
      (30 / 34 / 42 rem), all narrow-phone patches. Define a real scale and
      apply it everywhere. Logical properties only — never `left`/`right`.
- [ ] **C4 — Primitives.** Button, card, chip, field, dialog, toast — built once
      as the vocabulary every view is then written in.

---

## Module D — Frontend rebuild: views

One point per view. Each is rebuilt, then reviewed against
`web-design-guidelines` and `design:accessibility-review` before the next starts.

- [ ] **D1 — App shell and header.** Nav, Home, language and theme toggles, skip
      link first in tab order.
- [ ] **D2 — Intake form.** The main page. Presets, validation, submit states.
- [ ] **D3 — Loading state.** Must keep the honest step reporting that exists
      today, and add what is missing: elapsed time. The current component stops
      advancing at step 4 and then sits still for up to 50 s.
- [ ] **D4 — Result view.** The peak moment of the whole product. Largest single
      point in this module.
- [ ] **D5 — Interactive sprint board.** Rebuilt visual, **preserved decisions**:
      no drag-and-drop (WCAG 2.2 SC 2.5.7 needs a single-pointer alternative, and
      buttons already are one), and no delivery dates (a documented non-goal —
      it shows capacity, not calendar commitments).
- [ ] **D6 — History list.** Cards, stats strip, duplicate and delete. Fix the
      32 px action-button targets while here — they clear the 24 px WCAG 2.5.8
      floor but sit under the 44 px comfort target.
- [ ] **D7 — Saved plan view.**
- [ ] **D8 — Login and welcome modal.**
- [ ] **D9 — Error, empty, refusal and validation states.** The end of the
      peak-end rule: a failed generation is an ending too.

---

## Module E — Motion and polish

Scope confirmed by the owner: motion and polish is the whole of "more
interactive" — not drag-and-drop, not inline editing of story text, not
side-by-side plan comparison. Those were offered and not chosen; they are
recorded here so they are not quietly added later.

- [ ] **E1 — Motion tokens and reduced-motion.** `prefers-reduced-motion` is
      honoured in three files today. In the rebuild it is a token-level rule, not
      a per-file afterthought.
- [ ] **E2 — State transitions.** Idle → loading → result, and the skeleton to
      content handoff.
- [ ] **E3 — View Transitions API** for route changes. Native, no dependency.
- [ ] **E4 — Micro-interactions.** Buttons, cards, chips, toggles. Restraint is
      the point: motion that explains a change, not motion that decorates.

---

## Module F — Verification

- [ ] **F1 — Accessibility re-audit.** Full WCAG 2.2 AA pass on the rebuilt UI.
      Contrast measured. Every interactive control has an accessible name.
- [ ] **F2 — Bilingual re-verification.** Every view checked in Arabic RTL, not
      just English. A check that runs LTR only is not a passing check.
- [ ] **F3 — Responsive verification.** Real widths, both directions, evidence
      captured.
- [ ] **F4 — Test suite restored.** The rewrite replaces the components the
      current 292 tests point at. Coverage is re-earned, and the real number is
      recorded here when it is known.
- [ ] **F5 — UI evidence re-captured.** `npm run capture:ui`, and the screenshot
      count corrected wherever it appears.

---

## Module G — Deploy

- [ ] **G1 — Ship.** `git push origin dev && git push fork dev:main`. Vercel
      builds from the **fork**, branch `main` — pushing to origin alone changes
      nothing live.
- [ ] **G2 — Verify live.** Against the real URL, both languages, both themes,
      phone and desktop widths. Not against localhost.

---

## Module H — Documentation

- [ ] **H1 — Reconcile `project-plan.md`.** It is out of date in both
      directions: Module 0.2's OAuth and environment-variable items are done but
      unticked, Module 12's "no CI" is wrong, and neither the navigation redesign
      nor its same-day reversal appear anywhere in it.
- [ ] **H2 — Decision-log entries** for the rewrite decision, the
      dependency-free constraint, and the motion-only interactivity scope.
      Currently at 30 entries.
- [ ] **H3 — Drifting numbers.** Test count, screenshot count, dependency count,
      branch heads, commit SHAs — each appears in roughly six files and all five
      move during this work.
- [ ] **H4 — `frontend-architecture.md`.** Does not exist. The backend has three
      architecture documents and the frontend has none, which is the single
      largest gap in the document register. A ground-up rewrite is the right
      moment to write it. Formally Joe's row in the contribution matrix —
      **coordinate before writing**, do not author it on his behalf.

---

## Deliberately not doing

Recorded so they are not re-proposed:

- **Drag-and-drop on the sprint board** — would break WCAG 2.2 SC 2.5.7 unless a
  single-pointer alternative is kept, and that alternative is what already exists.
- **Delivery dates from story points** — documented product non-goal.
- **Serial-position reordering of any data view** — sprint and priority order must
  reflect the computed result, not a memorability trick.
- **Zeigarnik-style "unfinished plan" nudges** — engagement pressure dressed as UX,
  and against this project's plain-prose rule.
- **A dependency-graph visualisation of story dependencies** — real value, but an
  SVG layout problem far out of proportion to it.
- **Gemini explicit context caching** — see A2.
