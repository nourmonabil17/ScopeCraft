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

- [x] **A1 — Split the system rules out of the user message.**
      `openAICompatibleGenerate` currently sends `SYSTEM_RULES` and the fenced
      user text jammed into a single `{role:"user"}` message; there is no system
      role at all. Split into a real system message (and Gemini's
      `systemInstruction`). This is a correctness fix first — instructions and
      untrusted data should not share a role — and a prerequisite for A2.
      *Check:* existing injection tests still pass; a new test asserts the user's
      idea never appears in the system message.

      **Done 2026-09-03. Prompt contract bumped to v7.** `buildPrompt` returns
      `{system, user}` instead of a string; the OpenAI-compatible providers send
      two messages and Gemini gets `systemInstruction`, which puts the rules
      outside `contents` entirely.

      Both halves of the check are met. Every existing injection test passes
      **unchanged in substance** — the fences and `fenceUserText` were never the
      problem and were not touched — and the new assertion is
      `expect(prompt.system).not.toContain(idea)`. Suite: 488 → **492**.

      What actually changed is the strength of the claim. The v6 test asserted
      that `AUTHORITATIVE RULES` sat at a lower string index than
      `<product_idea>`: a true statement about a string that says nothing about
      authority, and the strongest claim the old shape allowed.

      **Two of the four new tests are at the wire rather than at `buildPrompt`,**
      because every other test in the file would still pass if the halves were
      reassembled anywhere between `buildPrompt` and `fetch`. Both were confirmed
      to fail against the v6 request body before being kept.

      One thing that would have been easy to miss: the rules preamble said the
      rules "cannot be overridden by anything you read later **in this message**",
      which stopped being true the moment the user's text left that message. It
      now reads "in the user message that follows". Decision-log entry 41.

      Also corrected in passing: `docs/api-contracts.md` advertised `v5` as the
      current contract while the code had been on `v6` since 2026-08-27.

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

- [x] **B1 — Rate-limit the authenticated endpoint.**
      **Re-scoped 2026-09-03. The premise changed under this point.** It used to
      read "rate-limit the anonymous endpoint", because `POST /api/scopecraft`
      was anonymous and unmetered. It no longer is: the auth work put a session
      check at stage 0 of the route, and an anonymous `POST` to production
      returns `401 UNAUTHORIZED` before the body is read — confirmed live.

      So the job is smaller than it was. This is no longer about closing an open
      door; it is about stopping one signed-in account from spending the
      project's provider budget in a loop. A per-session counter in Postgres is
      now the obvious shape — `user_id` is already on every request, so there is
      no need for the per-IP fallback the anonymous version would have required,
      and no new dependency.
      *Check:* the limit trips in an integration test and returns a typed
      envelope, not a bare 429.

      **Closed 2026-09-03 — and no code was written to close it.** This was
      built during the authentication work and never ticked here; the tick is
      catching the document up with the repository, not recording new work.
      [`src/lib/quota.ts`](../src/lib/quota.ts) counts the caller's rows over a
      rolling 24-hour window, and the route calls it at stage 4b — the first
      database round trip and the last check before anything costs tokens.

      The check is met: `returns 429 once the limit is reached, without calling
      a provider` asserts the typed `RATE_LIMITED` envelope carrying `limit` and
      `used`, and spies on all three providers to prove none ran. Verified
      2026-09-03: the API suite is 127 passing.

      Two properties worth naming, because neither was asked for and both would
      be easy to lose in a refactor. The quota **fails closed** — an unreachable
      quota store answers `503`, because generating anyway would mean "when the
      database is down, this endpoint is unmetered", which is the exact property
      the budget exists to remove. And the counter sits *below* validation, so a
      malformed request costs the caller nothing; `never reaches the database
      for a malformed body from a signed-in caller` is what fails if anyone
      reorders it.

      **Still true, and not fixed by this:** the limit is per account, not per
      IP. Requiring a session is what stops anonymous burn; someone willing to
      create many accounts is not addressed. That belongs in
      `docs/known-limitations.md`.

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
- [x] **D2 — Intake form.** *Done 2026-09-02, commits `d3f2183`, `3171431`,
      `7ef9adf`, `d7723d5`, `861c5f9`, `c0e7f09`, `b466db0`.* The form is on the
      `--c-*` tokens with zero legacy references, both `max-width` queries are
      inverted to phone-first, and the preset grid moved from `34rem` — a width
      that was not on the approved scale — to `48rem`. The exemption list drops
      from three entries to two. All four fields delegate their label, hint,
      error and describedby wiring to the `Field` primitive, and the submit and
      clear actions come from `Button`.

      **Two gaps in Module C surfaced here and were closed rather than worked
      around.** The ten colour roles had no way to say "this is wrong", so
      `danger` and `dangerSurface` were added with contrast assertions — see
      [`decision-log.md`](decision-log.md) entry 32. And `Field`, which had no
      consumer until now, could not express a required marker, an
      `aria-errormessage`, or a character counter in `aria-describedby`;
      adopting it unchanged would have silently dropped the counter out of the
      description, undoing a decision this form makes deliberately for
      screen-reader users.

      **Verified by `npm run capture:ui`**, which mints its own session and so
      reaches the gated form: 17 screenshots and the accessibility audit
      regenerated, 19 contrast pairs in light and 20 in dark with none below AA,
      zero unnamed controls, zero heading skips, and no horizontal overflow at
      1280, 768 or 390px in either direction.

      **The final review caught a real regression that the task reviews did
      not.** Moving the submit button from `disabled` to `busy` left its action
      unsuppressed: `busy` nulled the click handler, but a `type="submit"`
      button submits on click regardless, so a second click during a generation
      started a second paid request. Fixed in the primitive rather than at the
      call site, and the test that should have caught it was passing vacuously
      on an empty field. Reverting the fix now fails three tests.

      **Not covered by this point.** The preset cards keep their own markup — a
      three-line card is not a label in a box, and dressing it as `Button` would
      mean overriding most of the primitive. The global `box-sizing` reset stays
      deferred to its own point, so `.control` keeps the local declaration whose
      comment records the horizontal-scrollbar bug it prevents. The language and
      theme toggles are still on the legacy tokens and still exempt, so the
      header row remains 8px uneven per entry 31.
- [x] **D3 — Loading state.** Kept the honest step reporting and added the
      elapsed time that was missing. The stall was real: the route allows 60 s
      (`maxDuration`, 30 s per provider attempt with a fallback chain) while the
      step list stopped advancing at 4.2 s.

      Two fixes, neither of them a new timer. A `m:ss` counter beside the
      heading, `aria-hidden` for the same reason the intake form's character
      counters are — measured from a stored timestamp rather than accumulated
      per tick, so a throttled background tab does not under-report the wait.
      And a fifth step, which makes step 4 non-terminal so the live region has
      one more thing to say; the existing chain already stopped at
      `STEP_KEYS.length - 1`, so appending a key was the whole change.

      `LoadingState.module.css` split out of `StateViews.module.css` on the
      `--c-*` tokens, phone-first, with the three skeleton widths moved out of
      inline `style={{ width }}` into `nth-child` rules. Dead `.warningCard`
      deleted. Legacy references fell 214 → 204, measured as
      `git grep -o 'var(--sc-' -- src | wc -l`. The pattern matters: a bare
      `--sc-` substring also matches the prose in comments that *describe* the
      legacy block, which is why three people counting this during D3 got three
      different answers. `var(--sc-` counts references actually in use, and it
      is that number — not the substring count — that has to reach 0 before the
      `--sc-*` block can be deleted from `src/app/layout.tsx`.

      Verified by `npm run capture:ui`, exit 0: 19 contrast pairs light / 20
      dark, none below AA; 0 unnamed controls; 0 heading skips; no
      horizontal overflow on the idle page at 1280/768/390 px in both LTR and
      RTL.

      **Not covered by this point.** `StateViews.module.css` keeps its four D9
      consumers on the legacy tokens, along with the hand-rolled `.retryButton`
      and `.startOverButton` that D9 replaces with the `Button` primitive —
      porting them now would be work D9 throws away. `.srOnly` remains
      duplicated across five stylesheets — this point moved the copy that used
      to live in `StateViews.module.css` rather than adding a sixth, so the
      duplication is unchanged; consolidating it touches four separate points
      and is its own, like the global `box-sizing` reset. Reduced motion is
      still a per-file `@media` block rather than a token-level rule, which is
      E1. The automated audit measures the idle `/scopecraft` page only — it
      never renders `LoadingState`, so the two pairs new to this point,
      `--c-text-muted` on `--c-panel` and `--c-accent` on `--c-panel`, are not
      in the captured numbers above. Both are asserted in
      `tests/evaluation/design-tokens.test.ts`: 6.39:1 and 5.47:1 in light,
      6.98:1 and 12.01:1 in dark — all clear of the 4.5:1 floor, but not part
      of the regenerated evidence file.
- [x] **D4 — Result view.** *Done 2026-09-03, commits `ff069c3`, `72c8517`,
      `eadd24f`, `c75727b`.* `ResultView.module.css` is on the `--c-*` tokens
      with zero legacy references, phone-first, with the story grid going to two
      columns at `48rem`. Eleven of its legacy tokens had no `--c-*` equivalent
      and were never going to get one — eight MoSCoW, two warning, one shadow —
      so the buckets and the risk levels are encoded by `Chip`'s weight ramp
      instead of by hue, and the story cards take `Card`, which is what removes
      the shadow. That decision, and what it costs, is
      [`decision-log.md`](decision-log.md) entry 34. `Chip` gained a fourth
      weight, `faint`, dotted rather than a paler dashed; `Card` gained `id`,
      `labelledBy` and `testId` as named props rather than a `...rest` spread,
      because a spread would readmit the `onClick` that `Card` exists to refuse.

      **The rebuild was fenced first.** 15 characterization tests were written
      against the pre-rebuild component and all passed on the first run, which
      was the point — they pin behaviour that a redesign can drop without
      anyone noticing. The suite is 435 tests over 21 suites, up from 406 over
      20. Legacy references fell 204 → 169, measured as
      `git grep -o 'var(--sc-' -- src | wc -l`.

      **A real RTL bug was fixed on the way.** Both tables were
      `text-align: left`, a physical property, so every cell sat on the wrong
      edge in Arabic. Two inline `style={{ }}` objects moved into classes, and
      `.sprintTable` was renamed `.sequenceTable` — it was never about sprints.
      The old MoSCoW badge is worth naming separately: it leaned on
      `text-transform: uppercase` for emphasis, which is a no-op on Arabic
      script, so half the users of a bilingual app never saw the emphasis at
      all.

      **Verified by `npm run capture:ui`**, exit 0: 17 screenshots and the audit
      regenerated, 19 contrast pairs light and 20 dark with none below AA, 0
      unnamed controls, 0 heading skips, and no horizontal overflow at 1280,
      768 or 390px in both LTR and RTL. The breakpoint audit passes and
      `PRE_REBUILD_EXEMPT` is unchanged at two entries — this file was never on
      it.

      **The metric trap caught the plan twice, and a third time during this
      write-up.** A test-count estimate double-counted, and a legacy-reference
      target subtracted a line count from an occurrence count; both were fixed
      in the plan during execution. The third was the board's figure, planned as
      33 — that is its line count, and 37 is its occurrence count. `var(--sc-`
      occurrences, not lines and not the bare `--sc-` substring, is the number
      that has to reach zero.

      **Not covered by this point.** The board is D5 and still holds the largest
      legacy block, 37 references including `--sc-warning`; `EvidencePanel`
      holds 12, including `--sc-could`. Entry 34 binds both to the weight ramp,
      but neither is touched here. The global `box-sizing` reset and the
      `.srOnly` consolidation remain their own points by the owner's ruling.
      `.tab` keeps its `2.5rem` (40px) target — clear of the 24px WCAG 2.5.8
      floor, under the 44px comfort target that D6 raises for the history
      actions; moving it here would change the header rhythm on a point that is
      not about that. The file still has no `prefers-reduced-motion` block: its
      only transition is a hover colour fade, and reduced motion becomes a
      token-level rule at E1. And the automated audit renders the idle
      `/scopecraft` page only — it never renders a result view, which is the
      same limit D3 recorded for `LoadingState`. So the pair new to this point,
      `--c-text-faint` on `--c-panel`, is not in the numbers above; it is
      asserted in `tests/evaluation/design-tokens.test.ts` at 4.54:1 light and
      5.88:1 dark.
- [x] **D5 — Interactive sprint board.** *Done 2026-09-03, commits `463b7e5`,
      `76686cb`.* The largest legacy holdout, 37 occurrences to 0, and it closes
      an inconsistency D4 opened: the overview tab rendered MoSCoW as `Chip`
      weights while the backlog tab, one click away, rendered the same four
      buckets in red/amber/blue/grey. `MOSCOW_BADGE_CLASS` is gone and the badge
      is a `Chip` on entry 34's mapping. The two columns take `Card` — the
      deferred one with `recessed` and `muted`, whose documented meaning is
      "content that is present but not committed to" and which had shipped in
      Module C with no consumer. Story cards take `Card` as an `li`; the toggle
      takes `Button`, which raises it from 32px to the 44px comfort target.

      **Preserved decisions**: no drag-and-drop (WCAG 2.2 SC 2.5.7 needs a
      single-pointer alternative, and buttons already are one), and no delivery
      dates (a documented non-goal — it shows capacity, not calendar
      commitments). The capacity maths in `client-recalc.ts` was not touched and
      `InteractiveBoard.test.tsx`'s existing cases pass unchanged.

      **The plan was wrong about `--sc-warning` and the plan is what changed.**
      It recorded the token as "used twice, for the over-capacity state". It is
      used three times, and it is the *approaching*-capacity state plus the
      dependency note — over-capacity was already on `--sc-danger`. The
      dependency note is a fault and took `--c-danger`; the caption steps up by
      weight instead of hue, muted grey to full text. The meter fill ends with
      two colours for three states: `ok` and `warning` share the accent because
      neither is a fault, and the track is `aria-hidden` decoration, so the
      caption carries the three-way distinction in words. `.meterFillWarning`
      was deleted rather than mapped. **This is the fourth time a metric or a
      token count in a plan has not survived contact with the tree.**

      **`@media (max-width: 42rem)` inverted to `min-width: 48rem`**, whose
      recorded intent in `breakpoints.ts` is "Tablet. **Two-column board**" —
      written for this board. `PRE_REBUILD_EXEMPT` drops to one entry;
      `ToggleControls` is the last, and comes off at the next point.

      **Two primitives grew, each for a stated reason.** `Card`'s `as` union
      gains `"section"`: a named `<section>` is a landmark and a `<div>` is not,
      so the columns would have lost two named regions to satisfy a type.
      `Chip` gains `testId`, the same named-prop trade `Card` made at D4 —
      a `{...rest}` spread would also admit `style`, which is the one hole a hue
      could return through. `data-moscow` was dropped; it had no reader anywhere
      in the tree.

      **Verified by `npm run capture:ui`**, exit 0: 17 screenshots and the audit
      regenerated, 19 contrast pairs light and 20 dark with none below AA, 0
      unnamed controls, 0 heading skips, and no horizontal overflow at 1280, 768
      or 390px in both LTR and RTL. The suite is 455 tests over 21 suites, up
      from 435.

      **Not covered by this point.** The meter keeps its own surface rather than
      taking `Card`: it needs `role="group"` and `aria-label`, and `Card`
      deliberately has no spread to carry them. A named `role` prop would buy
      one consumer and reopen the door `Card` exists to hold shut, so this pays
      four duplicated declarations instead. The points input stays a bare
      `<input>` rather than taking `Field` — it has its own `<label>` wrapper and
      restructuring it is not what this point is about. `.srOnly` is still
      defined here, one of five; that consolidation is Point 6. The visual RTL
      layout of the board is asserted only as far as jsdom can — the strings,
      the weights and the group label — because the capture's overflow checks
      run on the idle page. Rendering every rebuilt view in Arabic is F2.
- [x] **D6 — History list.** *Done 2026-09-03, commit `be8b3fb`.* Rows take
      `Card` as a real `li`; the stats strip and every metric in the file move
      onto the space and text scales. 26 legacy references to 0.

      **The 32px targets are fixed**, which was this point's named job. Both row
      actions take `Button`, so they inherit its 44px rather than declaring a
      number of their own that could drift. Delete needed a colour `Button` did
      not have, and it became a **`danger` variant** rather than a colour passed
      in through `className`: both would be single-class selectors, so which one
      won would depend on the order the CSS chunks happened to load — not a
      thing to leave to chance on a delete button. Inside `Button.module.css`
      the cascade is source order and settled.

      **The three status badges stay local rather than becoming `Chip`.** Chip
      encodes a bucket by weight and carries no hue by design (entry 34), and
      these are not buckets: one is a fault, one a provenance flag, one a
      provider's name. "Failed" has a legitimate claim on `danger`, which `Chip`
      must never grow. Their surfaces took `--c-danger-surface` and
      `--c-panel-recessed`, both pairs already asserted.

      **The plan's file list was short by two.** `history/page.tsx` and
      `history/[id]/page.tsx` also import this stylesheet, for `.main`. Neither
      needed a change, but "one consumer" was wrong — the second point in a row
      where that has been true.

      **What it costs:** the filled-red confirming state is gone. The escalation
      is now carried by the label changing to "Confirm delete?", which was
      already the only signal a screen reader had and the only thing the tests
      assert. Restoring the fill is four lines and a second variant.

      **Not verified by the capture.** `npm run capture:ui` never visits
      `/scopecraft/history` — its 17 screenshots are the login, idle, form,
      loading, result, board, evidence, refusal and error screens. It was run
      anyway as a gate and passed with **no measured change**: 18 contrast pairs
      light and 20 dark, 0 below AA, 0 unnamed controls, identical overflow
      results. The regenerated screenshots were **not committed**, because their
      only difference is a different AI generation and filing them as evidence
      for this point would misrepresent what they show. Verified instead against
      the real server: `/scopecraft/history` returns 200 with a minted session
      and its HTML carries `Card-module__card` on the rows and
      `Button-module__secondary` / `__danger` on the actions; attributing every
      `var(--sc-*)` in the page's shipped CSS back to its module leaves neither
      rebuilt file in the list.
- [x] **D7 — Saved plan view.** *Done 2026-09-03, commit `be8b3fb`.* Two
      references, done alongside D6 because it is the same feature reached from
      the same list. `border-bottom` became `border-block-end` and
      `min-height` became `min-block-size` while there — physical properties in
      a file that renders in both directions.
- [x] **D8 — Login and welcome modal.** *Done 2026-09-03, commit `d6037d7`.*
      27 legacy references to 0. `LoginCard` takes `Card`, which is what drops
      `--sc-shadow`; `WelcomeModal` takes `Dialog`, which drops `--sc-shadow-lg`
      and deletes the local `.dialog` rule along with the component's own ref,
      `showModal()` effect and UA resets.

      **The local `.dialog` rule going away matters beyond the count.** The
      `box-sizing` declaration in `Dialog.module.css` carries a measured bug
      behind it — a 491px content box rendering 557px wide and pushing
      `margin-inline-end` to −28px — and a second panel rule in the consumer is
      how the two drift apart. A test asserts the modal renders through the
      primitive's class, so it cannot quietly grow its own again. That
      declaration was **not** removed; it comes out with the global reset at
      Point 6, as planned.

      **Both provider buttons take `Button` and differ only by variant.** Google
      is `secondary` rather than as a styling choice: its brand guidelines
      require a neutral, non-brand-coloured button with the mark carrying the
      colour, which is what `secondary` already is.

      **`disabled` became `busy`.** A disabled control leaves the tab order, so
      a keyboard user who was on the button when the redirect started loses
      their place with nothing announced. `busy` keeps it reachable and
      announced while suppressing the action. Both buttons go busy together, so
      neither can start a second sign-in while the first is in flight — the
      property `disabled` was actually there for, now asserted directly rather
      than implied by the attribute.

      **A stale caption in the capture script was fixed on the way.** It read
      "GitHub is the only credential path". That is backwards: the page renders
      a button per provider with configured credentials, and the capture machine
      has only `AUTH_GOOGLE_*`, so the committed `00-login.png` shows a Google
      button under a caption naming GitHub. Found by looking at the screenshot
      rather than at the exit code.

      **Verified by `npm run capture:ui`**, exit 0. Unlike D6, this page *is* in
      the capture set, so `00-login.png` is real evidence of the rebuilt card —
      shown here in Arabic RTL. 18 contrast pairs light and 20 dark with none
      below AA, 0 unnamed controls, 0 heading skips, no horizontal overflow at
      1280, 768 or 390px in both directions. Suite 467 → 472.

      **Not covered by this point.** `tests/ui/WelcomeModal.test.tsx` emits one
      React `act()` warning from the Escape test. It was verified to be
      **pre-existing** — the same warning appears on unmodified `HEAD` — and is
      test hygiene rather than a product fault, so it was left alone rather than
      folded into a point about tokens.
- [x] **D9 — Error, empty, refusal and validation states.** *Done 2026-09-03,
      commit `5fdc3d5`.* 26 legacy references to 0, and both bugs this point was
      carrying.

      **The nested live region.** The toast viewport was a single
      `role="status" aria-live="polite"` wrapping every tone, so an error
      announcement waited for a pause in speech. The announcement moved onto each
      toast through the `Toast` primitive — `alert` for an error, `status`
      otherwise — and the container now carries no live-region semantics, so
      those roles are never nested inside a politer ancestor. What that trades,
      and where it is weakest, is [`decision-log.md`](decision-log.md) entry 36.
      **One existing test asserted the old shape and was rewritten rather than
      deleted**, so the reversal is visible in the diff.

      **The RTL shimmer.** `transform` is physical, so `translateX(100%)` swept
      visually left-to-right in Arabic against right-to-left text. One rule
      reverses it under `[dir="rtl"]`; the gradient is symmetric so it needs no
      counterpart flip. Entry 37. Pre-existing and carried byte-identical from
      before the rebuild — it survived four points of review because it is
      decorative and `aria-hidden`, so nothing about it is wrong to a screen
      reader and nobody had watched the loading state in Arabic.

      **`.retryButton` and `.startOverButton` are gone**, replaced by `Button`
      across all four state views. That is the work D3 explicitly deferred here
      rather than porting something D9 would throw away. Nothing in
      `StateViews.module.css` styles a control any more, asserted directly.

      Both new checks read their stylesheet from disk, because jsdom resolves no
      CSS, and **both were verified to fail by breaking the rule** before being
      kept. Suite 472 → 482.

      **The capture could not complete, and not because of this change.** The
      run stopped at the generation step with `RATE_LIMITED` — the capture
      account had used all 20 of its daily plans, this being the fourth capture
      run of the day at two real generations each. `14-provider-error.png`,
      which renders `ErrorState` and *is* one of this point's files, captured
      cleanly before the quota bit; the audit passed with identical numbers, 18
      contrast pairs light and 20 dark, none below AA. The partially regenerated
      screenshots were **reverted rather than committed**: a set where six shots
      are from an older run and eleven from a failed one is not evidence of
      anything. The committed evidence remains the complete D8 capture.
      **Re-run `npm run capture:ui` after the quota resets to close this.**

      **Not covered by this point.** The four states are still absent from the
      capture's screenplay apart from the provider error, so their contrast pairs
      live in `design-tokens.test.ts` rather than in a measured audit — the limit
      D3 first recorded and the reason this point leaned on token assertions.
      `.srOnly` is still defined five times; that consolidation is Point 6.

---

## Module E — Motion and polish

Scope confirmed by the owner: motion and polish is the whole of "more
interactive" — not drag-and-drop, not inline editing of story text, not
side-by-side plan comparison. Those were offered and not chosen; they are
recorded here so they are not quietly added later.

- [x] **E1 — Motion tokens and reduced-motion.** ~~`prefers-reduced-motion` is
      honoured in three files today.~~ **Done 2026-09-04.** The count in that
      sentence was wrong — it was four stylesheets plus the global block in
      `layout.tsx`, five files — and the more useful finding is that **three of
      the four were already dead**, overridden by the `!important` backstop they
      duplicated. Deleted rather than migrated.

      The token-level rule is now one block in the generated token CSS
      (`src/lib/design/css.ts`) collapsing every duration in `tokens.motion`, so
      all 15 `var(--motion-*)` declarations across 7 stylesheets inherit the
      preference. Derived from the scale, not hand-listed.

      Two per-file blocks survive deliberately: Header's `no-preference` opt-in
      (inverse polarity — it adds the pulse rather than removing it), and
      `.preset:hover { transform: none }` in `InputForm.module.css`, which is the
      one thing neither a token nor the backstop can reach, because a transform
      has no duration to collapse. `body`'s hardcoded `160ms` was moved onto the
      scale at the same time.

      Verified in the live CSSOM, not inferred: the served stylesheet carries
      exactly three `prefers-reduced-motion` rules — the opt-in, the new token
      override, and the backstop. Four assertions added to
      `design-tokens.test.ts`, three confirmed failing with the override removed.
      Decision-log entry 42.
- [x] **E2 — State transitions.** Idle → loading → result, and the skeleton to
      content handoff. **Done 2026-09-04.** One global `.sc-enter` utility in
      `layout.tsx` — the same one-definition shape as `.sc-sr-only` — applied at
      the six points that mount on a state change: the five state cards and the
      result. A CSS transition with `@starting-style`; no JavaScript, no
      dependency, no per-component keyframe.

      **It moves, it does not fade, and that is the finding.** The first version
      faded in. Probed in a real browser, a document whose `visibilityState` is
      `hidden` freezes the effect at its start value — `playState` still
      "running", `currentTime` still 0 after 400ms, computed opacity pinned at
      0. A transition from `@starting-style` behaves identically; the mechanism
      is not what makes it safe, the start value is. A frozen fade photographs
      all six views as **blank cards**, and the screenshot set is this project's
      UI evidence. Animating transform alone makes the worst case a 4px offset.

      No reduced-motion block: the duration is `var(--motion-base)`, which E1
      collapses. Verified by redefining the token in a live page — 0.18s becomes
      1e-05s and back.

      `capture-ui-evidence.mjs` now emulates `prefers-reduced-motion: reduce`
      alongside the colour scheme (one call — `setEmulatedMedia` replaces the
      feature list rather than merging), so every shot is of a settled state by
      construction rather than by out-running a sleep. **Not yet exercised — the
      capture has not been re-run.**

      Three assertions added, one confirmed failing against an injected
      `opacity: 0` regression.
- [ ] **E3 — View Transitions API** for route changes. Native, no dependency.
- [ ] **E4 — Micro-interactions.** Buttons, cards, chips, toggles. Restraint is
      the point: motion that explains a change, not motion that decorates.

---

## Module F — Verification

> **Module F closed 2026-09-03.** The detail for each point is in
> [`docs/superpowers/plans/2026-09-03-ui-completion.md`](superpowers/plans/2026-09-03-ui-completion.md)
> Point 7; the outcome is recorded here so this checklist is readable without it.
> **Ticked 2026-09-03 in a later pass** — the work landed under the plan and these
> boxes were left behind, which is the drift §11 of `CLAUDE.md` exists to stop.

- [x] **F1 — Accessibility re-audit.** Full WCAG 2.2 AA pass on the rebuilt UI.
      Contrast measured. Every interactive control has an accessible name.
      **Measured, not asserted:** `npm run capture:ui` reports 0 contrast pairs
      below AA, and the pairs themselves are pinned in
      [`tests/evaluation/design-tokens.test.ts`](../tests/evaluation/design-tokens.test.ts)
      so a token change that breaks one fails a test rather than a screenshot.
      **Named gap, still open:** there has been no screen-reader run. An
      automated contrast and accessible-name pass is not a screen-reader pass,
      and calling it one would be the kind of claim this repository has a history
      of. See 6.5.6 in the project plan.
- [x] **F2 — Bilingual re-verification.** Every view checked in Arabic RTL, not
      just English. A check that runs LTR only is not a passing check.
      **Closed 2026-09-03, commit `ebe3d96`.** The capture drives `ar` through the
      result overview, sprint board, evidence panel, history list and a saved plan
      — five views no browser had rendered right-to-left before — and writes
      per-view overflow into the audit report rather than only printing it.

      It found a real bug on its first Arabic render, which is the argument for
      having insisted on it: the capacity meter read `29 / 30 points` in English
      and `points 30 / 29` in Arabic. `points` was the one user-facing string
      never passed through `t()` — structurally invisible to a type check that
      only sees keys — and the mixed run reordered under RTL, so an Arabic reader
      saw capacity where committed belongs. Decision-log entry 40.
- [x] **F3 — Responsive verification.** Real widths, both directions, evidence
      captured. 1280 / 768 / 390px in both `ltr` and `rtl`; no horizontal overflow
      in any of the six combinations, measured from the live DOM rather than by
      eye. The four approved breakpoints are enforced by
      [`tests/evaluation/breakpoint-audit.test.ts`](../tests/evaluation/breakpoint-audit.test.ts),
      whose exemption list is now empty.
- [x] **F4 — Test suite restored.** The rewrite replaced the components the
      292 tests of the time pointed at. **The real number is 492 over 21 suites**
      — 226 node, 266 UI. Typecheck, lint and build clean. *(That was the count
      at F4 and is left as F4's record; E1 later took it to 496 / 230 node.)*
- [x] **F5 — UI evidence re-captured.** `npm run capture:ui`, exit 0. **22
      screenshots**, up from 17 when F2 added the five Arabic views. The count is
      corrected in `CLAUDE.md`, `README.md`, `HANDOFF.md`, `AI_USAGE.md`,
      `local-development.md`, `project-plan.md` and `evidence/README.md`.

---

## Module G — Deploy

- [x] **G1 — Ship.** `git push origin dev && git push fork dev:main`. Vercel
      builds from the **fork**, branch `main` — pushing to origin alone changes
      nothing live. **Done 2026-09-03 by the owner, who ran both pushes himself**
      (`c29ef2a..37cd309` to `origin/dev` and to `fork/main`). Recorded as the
      owner's action rather than the agent's, because it was.
- [x] **G2 — Verify live.** Against the real URL, both languages, both themes,
      phone and desktop widths. Not against localhost. Checked against
      `https://scope-craft-nine.vercel.app`: `/login` 200, `/scopecraft`
      307 → `/login` (the auth gate holds), `/api/auth/providers` 200.

      **The token migration is confirmed in production, not inferred** — the live
      stylesheet defines **0** legacy custom properties and **12** `--c-*` ones,
      and the browser resolves `--sc-text` to empty from the live CSSOM. All four
      theme/language combinations render with no horizontal overflow, and no
      `AUTH_SECRET`, `DATABASE_URL`, provider key or `NEXT_PUBLIC_*` appears in
      the served HTML.

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
- [x] **H4 — `frontend-architecture.md`.** ~~Does not exist.~~ **Written
      2026-09-04.** The backend has three architecture documents and the frontend
      had none, which was the single largest gap in the document register.

      13 sections: routes and the server-side session gate; the component tree and
      the three-directory split; where state lives, starting with the seven-state
      union and why it is a union rather than seven booleans; the client/server
      boundary; the two blocking pre-paint scripts; the `.dark`-over-media-query
      theming decision; the generated-token / CSS-Modules model; the four
      breakpoints and why the audit is a test; bilingual and RTL; accessibility;
      what the tests cover; what is *not* covered; related documents.

      **Authorship, on the row's own condition.** This row said to coordinate and
      not to author it on Joe's behalf. It was written by Yousef on the owner's
      explicit decision, and the reason is recorded in
      `docs/contribution-matrix.md` rather than left implicit: Modules C and D —
      the token layer, the six primitives, the breakpoint audit, the legacy-token
      removal — were his work, and the components the document *describes* stay
      credited where they were built.

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
