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
- [x] **C2 — Design tokens.** *Done 2026-09-02, commits `9c42999` and
      `75aa4d8`.* Tokens live as typed data in `src/lib/design/tokens.ts` and are
      generated into CSS custom properties by `src/lib/design/css.ts`, so the
      values the contrast test asserts against are provably the values that ship.
      Contrast is executable: 18 tests assert every light/dark pair against its
      WCAG floor, and writing them moved four values that had been chosen by eye
      and did not actually pass. Verified in a browser in both themes.
      **No elevation scale**, deliberately — direction A expresses elevation as a
      hairline rule in light and a lighter fill in dark, never a shadow, so a
      shadow token would exist only to be reached for. The checklist asked for
      one; the direction answers it differently.
      The new `--c-*` block coexists with the old `--sc-*` one, which is still
      referenced 250+ times by views Module D rebuilds. `grep -r "--sc-" src`
      returning nothing is now an exact measure of migration progress.
- [x] **C3 — Responsive scale defined and enforced.** *Done 2026-09-02, commit
      `f5c5061`.* Four breakpoints — 30/48/64/80rem — in
      `src/lib/design/breakpoints.ts`, enforced by
      `tests/evaluation/breakpoint-audit.test.ts`.
      **Scope corrected from what this line originally said.** It read "define a
      real scale and apply it everywhere"; applying it to views is Module D's
      work, one view at a time, and this point covers only defining and enforcing
      the scale. Ticking it for the applied half would have been a false tick.
      A custom property cannot appear in a media-query condition and
      `@custom-media` needs a PostCSS plugin, so the scale cannot be enforced by
      CSS. The test is the enforcement instead, and it audits direction as well
      as value: every media query in the app today is a max-width phone patch, so
      max-width fails even with an approved number. Both halves were proven to
      fire, not assumed. Four stylesheets are exempt, frozen at four by their own
      test; that list reaching zero is a Module D exit condition.
- [x] **C4 — Primitives.** *Done 2026-09-02.* Six built, each with its own
      tests and each verified in a browser in both themes and both directions:
      Button `6d8c13d`, Card `3cf2efa`, Chip `f911bcc`, Field `ce21675`,
      Dialog `d0c8851`, Toast `feff210`.
      Each carries one rule worth keeping: Button separates `busy` from
      `disabled` so a control does not vanish from the tab order mid-request;
      Card has no `onClick` at all; Chip has no colour prop, and rendering it
      under `filter: grayscale(1)` produced a row identical to the original
      because there is no hue to lose; Field sets `aria-invalid` to true or
      omits it, never false; Dialog renders `null` when closed; Toast routes
      errors through `role="alert"` rather than the polite region.
      **Two bugs the unit tests could not have caught, both found in the
      browser.** Dialog rendered 557px wide inside a 529px viewport because
      `inline-size` is content-box and the padding was added on top of the cap —
      fixed with `box-sizing: border-box`. And expanding the Toast task against
      the real `common/Toast.tsx` showed the sketch had assumed two tones where
      the context emits three, and had called for a second live region that
      would have announced every toast twice.

---

## Module D — Frontend rebuild: views

One point per view. Each is rebuilt, then reviewed against
`web-design-guidelines` and `design:accessibility-review` before the next starts.

- [x] **D1 — App shell and header.** *Done 2026-09-02, commits `0654aa0`,
      `d8810bc` and `5b7332d`, merged as `910516f`.* `Header.module.css` is on the
      `--c-*` tokens with zero legacy references, and both its `max-width: 30rem`
      queries are inverted to phone-first `min-width`, which took it off
      `PRE_REBUILD_EXEMPT` — four entries down to three. The reset and sign-out
      actions now come from the `Button` primitive, which deleted `.resetButton`
      rather than migrating it; both consumers moved together, since `UserMenu`
      imported the same class.

      **Verified on production**, measured rather than eyeballed: header
      `--c-panel` on a `--c-rule` hairline with `backdrop-filter: none`, badge
      `--c-text-muted` on `--c-panel-recessed`, dot `--c-accent`, mark 32 px at
      `--radius-md`, in both themes. The breakpoint flips at exactly 479 → 480 px.
      In Arabic the bar mirrors, does not scroll sideways, and the badge reads
      `مباشر` with `letter-spacing: normal` — the tracking that was breaking
      Arabic's cursive joins is gone. Skip link is still first in the DOM and
      still reveals on focus.

      **Two things this point does not cover, named rather than implied.** The
      nav, Home, language and theme toggles in the wording above were *not*
      rebuilt: they live in `ToggleControls.module.css`, which keeps its own
      exemption entry, 19 legacy `--sc-*` references and two
      `@media (max-width: 34rem)` queries whose width is not on the approved
      scale. Scoping them out was the owner's call, and it leaves the header row
      8 px uneven — 44 px buttons beside 36 px toggles — which is a taken
      decision, recorded in [`decision-log.md`](decision-log.md) entry 31.
      Second, the signed-in header has never been seen rendered: both 44 px
      buttons sit behind the auth gate, so the browser pass covered `/login`,
      whose row contains only the toggles this work never touched. Ticked on the
      owner's instruction with that gap open.
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
