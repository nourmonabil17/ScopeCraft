# UI completion — D5 through D9 and the `--sc-*` deletion

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Take `git grep -o 'var(--sc-' -- src | wc -l` from **169 to 0**, delete the
legacy `--sc-*` block from `src/app/layout.tsx`, and empty `PRE_REBUILD_EXEMPT`.

**Budget:** ~10h of agent working time. This plan is ordered so that stopping after
any point leaves the app coherent and shippable.

**Why this and not the graded documents.** Twelve documents in `project-plan.md`'s
register are missing, two of them graded (`known-limitations.md`, `demo-script.md`).
The owner chose the UI rebuild. That choice is recorded here so it is a decision, not
an omission — see "What this plan does not do".

---

## The cadence change, stated up front

D4 cost ten subagent round trips for one point: five implementers, five reviews.
At that rate six points do not fit in ten hours.

This plan runs **one implementer plus one review per point**. The trade is real:
a defect now surfaces at the point's review rather than at a task boundary inside
it, so a bad point costs a whole re-dispatch instead of a fifth of one. That is
the right bet here because every point below is the *same shape of work* — a
stylesheet moves onto `--c-*`, a component adopts a primitive — and D1 through D4
have already proven the pattern four times.

**The four gates still run before every commit.** That is not what is being cut.

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

---

## Global constraints

Every point inherits these. They come from `CLAUDE.md` and have each already caught
a real bug in this project.

- **Commit author** `Yousef mohmed hasabo <yousefhasabo94@gmail.com>`.
  **Never a `Co-Authored-By` trailer** — verify with
  `git log -1 --format=%B | grep -i co-authored` after every commit.
- **No mention of Claude, Anthropic or any model name** anywhere.
- **The twelve colour roles are closed.** `ground`, `panel`, `panelRecessed`, `rule`,
  `ruleStrong`, `text`, `textMuted`, `textFaint`, `accent`, `accentContrast`,
  `danger`, `dangerSurface`. No `success`, no `warning`, no shadow scale.
  **Do not edit `tokens.ts`.** Never hand-edit `css.ts` — it is generated.
- **Logical CSS properties only.** `padding-inline`, `margin-block`, `min-block-size`,
  `inline-size`, `border-block-end`, `text-align: start`.
- **Breakpoints `30rem` / `48rem` / `64rem` / `80rem`, `min-width` only.**
  `max-width` fails the audit even at an approved number.
- **Bilingual.** Every new string needs `en` and `ar`. A check that runs LTR only is
  not a passing check.
- **Counting.** `git grep -o 'var(--sc-' -- src | wc -l` counts **occurrences**.
  `git grep -c` counts **lines**. They are different numbers and must never be
  subtracted from one another — this has now confused people three times.

---

## The remaining surface, measured

| Occurrences | File | Point |
|---:|---|---|
| ~~37~~ **0** | `InteractiveSprintBoard.module.css` | 1 ✅ |
| ~~19~~ **0** | `ToggleControls.module.css` | 2 ✅ |
| ~~26~~ **0** | `HistoryList.module.css` | 3 ✅ |
| ~~2~~ **0** | `SavedPlanView.module.css` | 3 ✅ |
| ~~16~~ **0** | `LoginCard.module.css` | 4 ✅ |
| ~~11~~ **0** | `WelcomeModal.module.css` | 4 ✅ |
| ~~13~~ **0** | `StateViews.module.css` | 5 ✅ |
| ~~13~~ **0** | `common/Toast.module.css` | 5 ✅ |
| 12 | `EvidencePanel.module.css` | 6 |
| 8 | `page.module.css` | 6 |
| 7 | `ExportActions.module.css` | 6 |
| 3 | `BackLink.module.css` | 6 |
| 2 | `layout.tsx` | 6 |
| **169** → **32** | | Points 1–5 done |

The only three non-approved media queries left were `ToggleControls` (`max-width: 34rem`
×2) and `InteractiveSprintBoard` (`max-width: 42rem`) — which was exactly the two-entry
`PRE_REBUILD_EXEMPT` list. Point 1 cleared the board's; `PRE_REBUILD_EXEMPT` is down to
one entry and Point 2 empties it.

---

## Point 0 — Close out D4 (30 min)

D4's five tasks are committed on `feat/d4-result-view` (7 commits) and individually
reviewed. Its final whole-branch review was interrupted and the branch is unmerged.

- [x] Run the final whole-branch review over `757cea5..HEAD`. Nothing Critical or
      Important. No orphan classes, no stale tokens, authorship and trailers clean.
- [x] Address anything Critical or Important; park Minors in the ledger. The one
      deferred Minor was **closed rather than parked** — see below.
- [x] Merge to `dev` with a merge commit, matching D1–D3 — `70aa590`.
- [x] **Do not push.** Shipping is Point 7.

One deferred Minor was on the ledger: `tests/ui/ResultView.test.tsx` used
`toBeGreaterThanOrEqual` where the fixture makes counts deterministic. Rather than
assume the fixture, the assertions were tightened and run: high=1, medium=2, low=3 and
`Scenario:`=5 all pass exactly. Closed in `1fff2b2` — a floor of `>= 1` would have
passed with four of the five criteria missing, which is the failure the test exists to
catch.

---

## Point 1 — D5, the interactive sprint board (2h)

**The largest holdout, and it closes an inconsistency D4 opened.** Right now the
overview tab renders MoSCoW as `Chip` weights while the backlog tab, one tab away,
renders the same four buckets in red/amber/blue/grey. Same data, two visual
languages. That is worse than either state alone.

**Files:** `InteractiveSprintBoard.tsx`, `InteractiveSprintBoard.module.css`,
`tests/ui/InteractiveBoard.test.tsx`, `tests/evaluation/breakpoint-audit.test.ts`.

**What changes:**
- The stylesheet moves onto `--c-*`, phone-first. 37 → 0.
- `MOSCOW_BADGE_CLASS` (`InteractiveSprintBoard.tsx:66-70`) is deleted and the badge
  becomes `<Chip weight={...}>` on the **same mapping D4 fixed**: must→solid,
  should→outline, could→dashed, wont→faint. Decision-log entry 34 already binds this.
- `@media (max-width: 42rem)` at line 92 inverts to phone-first `min-width: 48rem`.
  42rem is not on the approved scale; 48rem is, and its documented intent is
  "Tablet. **Two-column board**" — which is what this query is for.
- ~~`--sc-warning` (used twice, for the over-capacity state) has no `--c-*` equivalent.
  It takes `--c-danger`: over capacity is a fault, not a caution, and `danger` is the
  only status colour among the twelve.~~
  **Corrected during execution.** `--sc-warning` is used **three** times and is the
  *approaching*-capacity state plus the dependency note — over capacity was already on
  `--sc-danger`. The note took `--c-danger` on its own merits; the caption steps up by
  weight, not hue; and the meter fill ends with two colours for three states, `ok` and
  `warning` sharing the accent because neither is a fault. `.meterFillWarning` was
  deleted rather than mapped. Recorded as decision-log entry 35.
- The two deferred/included columns take `Card` with `recessed` and `muted` — the
  props exist for exactly this and have had no consumer.
- `PRE_REBUILD_EXEMPT` drops to 1 entry; its `toHaveLength` assertion updates.

**Preserved, explicitly:** no drag-and-drop (WCAG 2.2 SC 2.5.7 needs a
single-pointer alternative and the buttons already are one), and no delivery dates
(a documented non-goal — the board shows capacity, not calendar commitments).

**Check:** `InteractiveBoard.test.tsx` passes unchanged; capacity maths untouched;
breakpoint audit passes with one exemption left.

**Done 2026-09-03, commits `463b7e5`, `76686cb`.** All three checks met. Beyond the
list above: story cards also took `Card` (leaving them hand-rolled would have rebuilt
the very inconsistency this point exists to close), the toggle took `Button` — 32px to
44px for free — `Card`'s `as` union gained `"section"` so the columns kept their two
named landmarks, and `Chip` gained `testId`. `data-moscow` was dropped; nothing read
it. Suite 435 → 455; capture re-run at exit 0. Written up in
[`upgrade-checklist.md`](../../upgrade-checklist.md) under D5.

---

## Point 2 — ToggleControls (45 min)

Small, but it is the **last** file blocking the exemption list reaching zero.

**Files:** `ToggleControls.module.css`, `LanguageToggle.tsx`, `ThemeToggle.tsx`,
`tests/evaluation/breakpoint-audit.test.ts`.

**What changes:** 19 → 0. Both `@media (max-width: 34rem)` queries (lines 88, 141)
invert to `min-width: 48rem` — 34rem is not on the approved scale in either
direction. `PRE_REBUILD_EXEMPT` becomes `[]` and its `toHaveLength(2)` becomes
`toHaveLength(0)`.

This also closes the **8px header mismatch** recorded in decision-log entry 31: the
toggles were the last thing in the header still on legacy spacing, which is why the
row sits uneven.

**Check:** breakpoint audit passes with an empty exemption list. `ThemeAndLocale.test.tsx`
passes unchanged.

**Done 2026-09-03, commits `596cea0`, `de15d2c`.** Both checks met; the exemption list
is `[]` and its assertion was kept rather than deleted, so the list cannot quietly
reopen. `Header.tsx` and `HistoryLink.tsx` were also consumers of this stylesheet — the
plan listed only the two toggles — but both use `.linkButton` through `className`, so
neither needed a component change.

Two things the plan did not anticipate. The controls **stay hand-rolled** rather than
adopting `Button`: two of the four are not buttons (`.linkButton` is an `<a>`,
`.segment` is a `role="radio"`), and promoting only the one real button would have
recreated the mismatch this point exists to remove — so the invariant is enforced by a
test that reads both stylesheets instead. And the condensed labels **must stay visually
hidden rather than `display: none`**: `.segmentShort` is `aria-hidden`, so the full
label is the only thing naming its radio, and removing it from the layout would leave
the language control nameless on every phone.

Entry 31 is closed, and the header was **looked at** for the first time — that entry had
recorded the mismatch for four points while explicitly noting nobody had seen it.

---

## Point 3 — D6 and D7, history and saved plan (1h 30m)

Grouped because `SavedPlanView` is 2 occurrences and is the same feature.

**Files:** `HistoryList.module.css` (26), `HistoryList.tsx`,
`SavedPlanView.module.css` (2), `tests/ui/HistoryList.test.tsx`.

**What changes:** 28 → 0. Cards become the `Card` primitive. The stats strip moves
onto the space scale.

**One real fix while here:** the duplicate and delete action buttons are **32px**
targets. They clear the 24px WCAG 2.5.8 floor but sit under the 44px comfort target.
Raise to 44px. This is named in the checklist as D6's job, so it is in scope, not creep.

**Check:** `HistoryList.test.tsx` passes; duplicate and delete still work; the 44px
target asserted in the test rather than left to the eye.

**Done 2026-09-03, commit `be8b3fb`.** All three checks met. The 44px is asserted in
two halves, because jsdom resolves no CSS: `HistoryList.test.tsx` proves both actions
carry the `Button` class, and `design-tokens.test.ts` proves `Button` declares exactly
one target size and that it is `2.75rem`.

Delete needed a colour `Button` did not have, and it became a **`danger` variant**
rather than a `className` override — both would be single-class selectors, so the winner
would depend on CSS chunk load order. The confirming state reuses that variant instead
of gaining a second one; the escalation is the label change, which was already the only
signal a screen reader had. **The filled-red confirm is gone**, restorable in four
lines.

The status badges **stay local rather than becoming `Chip`** — they are a fault, a
provenance flag and a provider name, not buckets, and "Failed" has a claim on `danger`
that `Chip` must never grow.

**The plan's file list was short by two again:** `history/page.tsx` and
`history/[id]/page.tsx` also import this stylesheet for `.main`. Neither needed a
change. That is the second consecutive point where the listed consumers were incomplete
— worth assuming for Points 4 through 6 rather than rediscovering.

**The capture cannot see this page.** It never visits `/scopecraft/history`. It was run
as a gate and passed with no measured change, and the regenerated screenshots were
deliberately **not committed** — their only difference is a different AI generation.
Verified against the real server instead: 200 with a minted session, `Card` and `Button`
classes present in the server-rendered HTML, and a per-module attribution of every
`var(--sc-*)` in the page's shipped CSS showing neither rebuilt file.

---

## Point 4 — D8, login and welcome modal (1h)

**Files:** `LoginCard.module.css` (16), `LoginCard.tsx`, `WelcomeModal.module.css` (11),
`WelcomeModal.tsx`, `tests/ui/Auth.test.tsx`, `tests/ui/WelcomeModal.test.tsx`.

**What changes:** 27 → 0. `LoginCard` drops `--sc-shadow` and takes `Card`.
`WelcomeModal` moves onto the `Dialog` primitive if it is not already there.

**Watch:** `WelcomeModal` keeps its own `box-sizing: border-box` until Point 6.
`Dialog.module.css:17` has a comment recording the `margin-inline-end: -28px` bug that
declaration prevents — do not remove it early.

**Check:** the dialog still traps focus and closes on Escape;
`installDialogPolyfill()` still supplies `showModal`/`close` in jsdom.

**Done 2026-09-03, commit `d6037d7`.** Both met — the Escape test passes unchanged
through `Dialog`'s own `close` handler, and the polyfill needed no change.

The **watch held**: `Dialog.module.css`'s `box-sizing` was not touched, and the local
`.dialog` rule in `WelcomeModal.module.css` was deleted rather than ported, so there is
now exactly one panel rule instead of two that could drift. A test pins the modal to the
primitive's class.

Beyond the plan: both provider buttons took `Button` (Google as `secondary`, which its
brand guidelines require) and moved from `disabled` to **`busy`** — a disabled control
leaves the tab order, and `busy` keeps it reachable while still blocking a second
sign-in. The CTA took `Button` too.

**A stale caption in `capture-ui-evidence.mjs` was fixed on the way**: it claimed
"GitHub is the only credential path" while the committed shot shows a Google button,
because this machine has only `AUTH_GOOGLE_*`. Found by looking at the screenshot rather
than the exit code.

---

## Point 5 — D9, states and toast (1h 30m)

**Files:** `StateViews.module.css` (13), `ErrorState.tsx`, `EmptyState.tsx`,
`DomainRefusalState.tsx`, `ValidationErrorState.tsx`, `common/Toast.module.css` (13),
`common/Toast.tsx`, `LoadingState.module.css`.

**What changes:** 26 → 0. `.retryButton` and `.startOverButton` are hand-rolled and
become the `Button` primitive — D3 explicitly deferred them here rather than porting
work D9 throws away. `--sc-shadow-lg` on the toast goes the way of every other shadow.

**Two carried-forward bugs land here:**

1. **The nested live region.** `src/components/common/Toast.tsx:29-33` wraps every
   tone in one `role="status" aria-live="polite"`, so an **error waits for a pause in
   speech**. Re-implement the viewport's insides with the `Toast` primitive, leaving
   **exactly one** live region in the tree, and give an error tone `role="alert"`.
2. **The shimmer sweeps left-to-right in Arabic.** `LoadingState.module.css` uses
   `linear-gradient(90deg, …)` and `translateX`, carried byte-identical from the old
   file. Decorative and `aria-hidden`, pre-existing, not introduced by D3 — but this
   is the point that touches the file.

**Check:** an error toast announces immediately; one live region in the tree asserted
by test; RTL shimmer verified in an `ar` render.

**Done 2026-09-03, commit `5fdc3d5`.** Both bugs fixed; entries 36 and 37.

Two notes where the check as written did not survive contact:

**"One live region in the tree" is not literally achievable** alongside "give an error
tone `role=\"alert\"`" — the viewport plus an alert is two. The intent was clearly
*no nesting*, and that is what was built: the viewport carries no live-region semantics
and each toast carries its own role. Asserted as "no toast sits inside another live
region", which is the property that actually matters.

**The RTL shimmer could not be "verified in an `ar` render".** jsdom resolves no CSS and
`identity-obj-proxy` returns the class name, so a rendered assertion would pass whether
the rule existed or not. It is asserted from the stylesheet instead, and the assertion
was verified to fail by breaking the rule — the method Point 2 used for target sizes.

**The capture could not complete**, for a reason unrelated to this point: the capture
account hit its own `RATE_LIMITED` ceiling of 20 plans/day, this being the fourth run of
the day at two generations each. The partial evidence was reverted rather than committed.
Re-run after the quota resets.

*Aside, not acted on:* tripping that limiter is live proof that **Module B's B1 is at
least partly built already** — `src/lib/quota.ts` enforces 20/day and the endpoint
returns a typed `RATE_LIMITED` envelope, not a bare 429. B1 is still unticked. Not this
plan's to tick, but worth checking before it is worked.

**Note:** `npm run capture:ui` **never renders any of these states** — it audits the
idle `/scopecraft` page only. Every new contrast pair must be asserted in
`tests/evaluation/design-tokens.test.ts` instead. This is the point where that limit
bites hardest.

---

## Point 6 — The tail, then the deletion (2h)

**Files:** `EvidencePanel.module.css` (12), `page.module.css` (8),
`ExportActions.module.css` (7), `BackLink.module.css` (3), `layout.tsx` (2), plus the
five `.srOnly` definitions and three `box-sizing` declarations.

**What changes:** 32 → **0 tree-wide.** Then, and only then:

- [ ] **Delete the `--sc-*` block** from `src/app/layout.tsx` — the whole point of
      the preceding six. Gate: `git grep -o 'var(--sc-' -- src | wc -l` returns `0`.
- [ ] **Consolidate `.srOnly`.** Defined five times: `Field`, `InputForm`,
      `ExportActions`, `InteractiveSprintBoard`, `LoadingState`. One definition,
      in the generated token CSS or a single shared module. This touches four points'
      output, which is why it waits until they are all done.
- [ ] **Add the global `box-sizing: border-box` reset** and remove the three local
      declarations in `InputForm.module.css:53`, `Dialog.module.css:17`,
      `Toast.module.css:17`. Each carries a comment recording the bug it prevents —
      read all three before removing any, and keep the reasoning in the global rule.

`EvidencePanel` uses `--sc-could`, the last MoSCoW token in the tree. It takes a
`Chip`, same as everywhere else.

**Check:** the count is 0; the app renders identically in both themes and both
directions; no horizontal overflow appears anywhere from the box-sizing change.

---

## Point 7 — Verify and ship (1h 30m)

- [ ] **F5 / F1** — `npm run capture:ui`. Build first, two servers (3200, and 3201
      with bogus AI keys), env loaded as `set -a; . ./.env.local; set +a` —
      `export $(grep ...)` breaks because `DATABASE_URL` contains an `&`.
- [ ] **F2** — every rebuilt view in Arabic RTL. Not inferred; rendered.
- [ ] **F3** — 1280 / 768 / 390px, both directions.
- [ ] **F4** — full suite green; record the real number.
- [ ] **H3** — the stale-number sweep. Test count, screenshot count, dependency count
      and branch heads appear in ~6 files each. ~15 documents currently carry test
      counts between 130 and 293.
- [ ] **H2** — decision-log entries for the `--sc-*` deletion, the box-sizing reset,
      and the `.srOnly` consolidation.
- [ ] **G1 — Ship.** `git push origin dev && git push fork dev:main`.
      **Vercel builds from the FORK.** Pushing to `origin` alone never updates the
      live site.
- [ ] **G2 — Verify live** against `https://scope-craft-nine.vercel.app`, both
      languages, both themes.

---

## What this plan does not do

Named so each is a decision rather than an omission.

- **Module A** (system/user role split, prompt caching, request cache) — an AI-layer
  correctness improvement on a working pipeline.
- **Module B** (rate limiting, structured logging).
- **Module E** (motion tokens, View Transitions, micro-interactions). E1's
  `prefers-reduced-motion` stays a per-file `@media` block in four files rather than
  becoming a token-level rule.
- **The twelve missing documents**, including the two graded ones —
  `docs/known-limitations.md` and `docs/demo-script.md` — and
  `docs/frontend-architecture.md`, which the register calls the biggest gap.
  **If time runs short, cut Point 6's consolidation work before cutting these.**
- **`AI_USAGE.md`'s three placeholder sections.** They belong to Nour, Joe and Yasmin
  and blocking a Required rubric row does not change that. Not ours to write.
- **React hydration error #418.** Reproduces on unmodified production; the fix trades
  a console error for a language flash. The owner's call, not a side effect of this work.
