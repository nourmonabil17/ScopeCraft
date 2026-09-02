# D3 — Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the loading state onto the `--c-*` design tokens and close the
~45-second dead air between the last progress step and the response arriving.

**Architecture:** Two independent halves. The stylesheet half extracts a
`LoadingState.module.css` from the shared `StateViews.module.css`, leaving the
four D9 states untouched on the legacy tokens. The behaviour half adds a visible
elapsed-time counter (`aria-hidden`, per the character-counter precedent) and a
fifth progress step, so the existing `role="status"` region has one more thing to
say before it falls silent. No new timer is introduced for the step list — the
existing `setTimeout` chain simply gains one more destination.

**Tech Stack:** Next.js App Router, React client component, CSS Modules,
Jest + Testing Library (jsdom project).

## Global Constraints

Copied from `CLAUDE.md` and `docs/upgrade-checklist.md`. Every task's
requirements implicitly include this section.

- **Commit author** is `Yousef mohmed hasabo <yousefhasabo94@gmail.com>`. Use
  `git -c user.name=... -c user.email=... commit` if local config disagrees.
- **Never add a `Co-Authored-By` trailer.** Verify after every commit with
  `git log -1 --format=%B | grep -i co-authored` — it must print nothing.
- **No mention of Claude, Anthropic, or any model name** in commit messages,
  code comments, or user-facing text.
- **Work from** `/Users/yousefhasabo/Downloads/ScopeCraft`. Never from the
  handbook CSV folder — the literal `[` in its name silently breaks Jest globs.
- **Logical CSS properties only.** `inline-size` not `width`, `block-size` not
  `height`, `margin-block` not `margin-top`, `padding-inline` not
  `padding-left`. A physical `left: -9999px` once made every Arabic page scroll
  ~10000px sideways.
- **Bilingual.** Every new user-facing string needs both an `en` and an `ar`
  entry in `src/lib/i18n/translations.ts`. `ar` is typed
  `Record<TranslationKey, string>` and `en` is the source of `TranslationKey`,
  so a missing Arabic entry is a compile error. Do not work around it.
- **No new dependencies.** Nothing in this plan needs one.
- **Four gates before every commit:** `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run build`. A commit that breaks any gate does not get made.
- **`npm run capture:ui` is the fifth gate** for anything touching UI. Task 4
  runs it once for the whole point rather than per-task.
- **Approved token scales only.** Colours `--c-*`; spacing `--space-0..8`
  (4px base: 0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4rem); type
  `--text-xs|sm|base|lg|xl|2xl` (0.6875, 0.8125, 0.9375, 1.125, 1.375,
  1.75rem); radius `--radius-none|sm|md` (0, 2px, 4px); motion
  `--motion-fast|base|slow|ease`.
- **The twelve colour roles are closed for this point:** `ground`, `panel`,
  `panelRecessed`, `rule`, `ruleStrong`, `text`, `textMuted`, `textFaint`,
  `accent`, `accentContrast`, `danger`, `dangerSurface`. There is deliberately
  no `success`, no `warning`, and no shadow scale. **Do not add a role.** If you
  believe one is needed, stop and report rather than editing `tokens.ts`.
- **Never hand-edit `src/lib/design/css.ts`.** It is generated from
  `tokens.ts` by `Object.entries` + a `kebab()` helper.
- **Theming is a `.dark` class on `<html>`**, not `prefers-color-scheme`.
  Colours go on `:root` / `:root.dark`, never inside a bare media query.
- **Do not touch** `src/app/layout.tsx`'s `--sc-*` block. It is deleted in a
  later point, only once `grep -ro -- '--sc-' src | wc -l` returns 0.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/common/LoadingState.module.css` | **Create** | Every rule the loading card needs, on `--c-*`. Owns the skeleton, the step list, the elapsed counter, and its own `.card`/`.heading`/`.srOnly`. |
| `src/components/common/StateViews.module.css` | **Modify** (deletions only) | Loses the loading-only rules and the dead `.warningCard`. Keeps `.card`, `.heading` and the D9 rules for its four remaining consumers. |
| `src/components/common/LoadingState.tsx` | **Modify** | Imports the new stylesheet. Gains the elapsed counter and a fifth step key. Loses its three inline `style={{ width }}` props. |
| `src/lib/i18n/translations.ts` | **Modify** | One new key, `state.loading.step5`, in both `en` and `ar`. |
| `tests/ui/StateTransitions.test.tsx` | **Modify** | One added assertion in the existing page-flow test, plus a new isolated `describe` that renders `LoadingState` directly under fake timers. |
| `docs/upgrade-checklist.md` | **Modify** | Tick D3, record what the point did and did not cover. |
| `docs/decision-log.md` | **Modify** | One entry: why the loading card got its own stylesheet, and why `stepDone` uses `accent` rather than a new `success` role. |

### Why the split, and why now

`StateViews.module.css` is shared by five components. Only two of its rules —
`.card` and `.heading` — are used by more than one, and **neither contains a
single token reference**; they are pure literals. So the shared surface has
nothing token-shaped in it, and splitting costs roughly 13 duplicated lines of
literals that vanish when D9 deletes the old file.

Migrating the whole file instead would mean restyling `.retryButton` and
`.startOverButton` onto `--c-*` — two hand-rolled buttons that D9 replaces with
the `Button` primitive, exactly as D1 did with `.resetButton`. That work would be
thrown away.

---

## Task 1: Extract the loading stylesheet

**Files:**
- Create: `src/components/common/LoadingState.module.css`
- Modify: `src/components/common/StateViews.module.css` (delete lines 19-23,
  41-46, 72-135, 187-197)
- Modify: `src/components/common/LoadingState.tsx:24` (import) and `:59-61`
  (inline widths)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the class names `card`, `loadingCard`, `heading`, `skeletonStack`,
  `skeletonRow`, `stepList`, `stepDone`, `stepCurrent`, `stepPending`, `srOnly`,
  and `elapsed`. Task 2 uses `styles.elapsed`. Every other name keeps the
  spelling it already has in `LoadingState.tsx`, so no call site changes.

### Token mapping — use exactly these

| Old | New | Note |
|---|---|---|
| `border-radius: 0.625rem` | `var(--radius-md)` | 10px → 4px. Direction A is sharp. |
| `padding: 1.25rem` | `padding-block: var(--space-4); padding-inline: var(--space-4)` | 1.25rem is not on the scale. Rounds down to 1rem, matching `.errorBanner` and `.presetGroup` in `InputForm.module.css`. |
| `margin: 1.5rem 0` | `margin-block: var(--space-5)` | Inline margin was already 0; the logical property expresses that without repeating it. |
| `gap: 0.75rem` | `var(--space-3)` | Exact. |
| `gap: 0.5rem` | `var(--space-2)` | Exact. |
| `gap: 0.375rem` | `var(--space-2)` | Not on the scale. Rounds up to 0.5rem. |
| `font-size: 1rem` | `var(--text-base)` | 0.9375rem, matching `.errorBannerTitle`. |
| `font-size: 0.8125rem` | `var(--text-sm)` | Exact. |
| `height: 0.75rem` | `block-size: var(--space-3)` | Logical property. Exact value. |
| `var(--sc-border)` | `var(--c-rule)` | |
| `var(--sc-border-strong)` | `var(--c-rule-strong)` | |
| `var(--sc-surface-raised)` | `var(--c-panel)` | |
| `var(--sc-surface-subtle)` | `var(--c-panel-recessed)` | |
| `var(--sc-text)` | `var(--c-text)` | |
| `var(--sc-text-muted)` | `var(--c-text-muted)` | |
| `var(--sc-success)` | `var(--c-accent)` | **There is no `success` role and none is being added.** A completed step is past, not a status to act on; the accent plus the `✓` glyph distinguishes it from pending without widening the palette. |
| `border-radius: 999px` | unchanged | A pill is a pill. `InputForm.module.css:259` keeps 999px for the same reason. |

- [ ] **Step 1: Create the new stylesheet**

Create `src/components/common/LoadingState.module.css` with exactly this content:

```css
/* src/components/common/LoadingState.module.css
 *
 * Module D3. Split out of StateViews.module.css, which still serves the four
 * D9 states (empty, error, validation error, domain refusal) on the legacy
 * --sc-* tokens.
 *
 * The two files share nothing token-shaped. The .card and .heading rules both
 * carry are pure literals, so the ~13 duplicated lines cost nothing and
 * disappear when D9 deletes the old file. The alternative — migrating all five
 * states here — would have meant restyling the retry and start-over buttons
 * that D9 replaces with the Button primitive, exactly as D1 did with
 * .resetButton.
 */

.card {
  border-radius: var(--radius-md);
  padding-block: var(--space-4);
  padding-inline: var(--space-4);
  margin-block: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.loadingCard {
  composes: card;
  border: 1px solid var(--c-rule);
  background: var(--c-panel);
}

.heading {
  margin: 0;
  font-size: var(--text-base);
  font-weight: 700;
}

/* The elapsed counter sits inside the heading line. Muted and unbolded so it
   reads as an annotation rather than a second heading, and tabular so the line
   does not jitter sideways every time a digit changes width. */
.elapsed {
  color: var(--c-text-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.skeletonStack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeletonRow {
  block-size: var(--space-3);
  border-radius: 999px;
  background: var(--c-panel-recessed);
  overflow: hidden;
  position: relative;
}

/* Three rows of decreasing length read as a paragraph of text that has not
   arrived yet. These were inline style={{ width }} props on the component
   until D3 — physical `width`, and presentation the component had no reason
   to carry. */
.skeletonRow:nth-child(1) {
  inline-size: 90%;
}

.skeletonRow:nth-child(2) {
  inline-size: 75%;
}

.skeletonRow:nth-child(3) {
  inline-size: 60%;
}

.skeletonRow::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--c-rule-strong) 35%, transparent),
    transparent
  );
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

/* Carried across from StateViews.module.css unchanged. Making reduced-motion a
   token-level rule rather than a per-file afterthought is E1's job, not D3's. */
@media (prefers-reduced-motion: reduce) {
  .skeletonRow::after {
    animation: none;
  }
}

.stepList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

/* Done is the accent, not a success green — the palette has twelve roles and
   `success` is deliberately not one of them. A finished step is past, not a
   status the user has to act on, and the ✓ glyph already separates it from
   pending. See docs/decision-log.md. */
.stepDone {
  color: var(--c-accent);
}

.stepCurrent {
  color: var(--c-text);
  font-weight: 600;
}

.stepPending {
  color: var(--c-text-muted);
}

/* Visible only to screen readers. This is the sixth copy of this rule in the
   codebase (Field, InputForm, ExportActions, InteractiveSprintBoard,
   StateViews and here). Consolidating them into one utility touches five
   stylesheets across four separate points, so it is its own point — like the
   global box-sizing reset — rather than smuggled into a view rebuild.
   Copied from the D2 version, which uses logical properties and clip-path
   rather than the deprecated clip: rect() the StateViews copy still has. */
.srOnly {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}
```

- [ ] **Step 2: Delete the loading rules from `StateViews.module.css`**

Delete these four blocks. Delete nothing else — the four D9 consumers still
need every remaining rule.

1. `.loadingCard` (lines 19-23).
2. `.warningCard` (lines 41-46). **Dead code.** Grep proves no consumer
   references it: `grep -rn "warningCard" src` returns only the definition. It
   is also the only reason this file mentions `--sc-warning`.
3. `.skeletonRow`, `.skeletonRow::after`, `@keyframes shimmer`, the
   `@media (prefers-reduced-motion: reduce)` block, `.skeletonStack`,
   `.stepList`, `.stepDone`, `.stepCurrent`, `.stepPending` (lines 72-135).
4. `.srOnly` (lines 187-197).

Then update the file's header comment, which currently names five consumers:

```css
/* src/components/common/StateViews.module.css
 *
 * Shared styling for EmptyState, ErrorState, ValidationErrorState and
 * DomainRefusalState (owner: Joe). One file because all four are small,
 * structurally similar "here is the current status" cards and splitting them
 * into four near-identical stylesheets would be pure duplication with nothing
 * gained.
 *
 * LoadingState was the fifth until D3, when it moved to its own
 * LoadingState.module.css on the --c-* tokens. The rules left here are still
 * on the legacy --sc-* block and are rebuilt in D9, which deletes this file.
 */
```

- [ ] **Step 3: Point the component at the new stylesheet and drop the inline widths**

In `src/components/common/LoadingState.tsx`, change the import on line 24:

```tsx
import styles from "./LoadingState.module.css";
```

and replace the skeleton stack (lines 58-62) with:

```tsx
      <div className={styles.skeletonStack} aria-hidden="true">
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
      </div>
```

- [ ] **Step 4: Run the gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all pass, **399** tests across 20 suites — up one from the 398
baseline even though this task writes no test.
`tests/evaluation/breakpoint-audit.test.ts` is an `it.each` over every
stylesheet under `src`, so a new stylesheet adds a case. That case is a real
check: it proves `LoadingState.module.css` uses only approved breakpoints and
no `max-width`. No test asserts computed style —
`*.module.css` maps to `identity-obj-proxy`, so `styles.foo === "foo"` and this
task changes no class name the component uses. If a test fails, a class name was
renamed or dropped; compare against the `styles.` names listed under
**Interfaces** above.

- [ ] **Step 5: Verify the legacy-token count actually fell**

```bash
grep -ro -- '--sc-' src | wc -l
```

Expected: `263`, down from 271. Ten `var(--sc-*)` uses are removed (7 loading
rules moved to the new file, 3 in the dead `.warningCard`), but the two header
comments this plan mandates each contain the literal string `--sc-*`, and this
grep counts substrings rather than uses. To count real uses instead:
`grep -ro -- 'var(--sc-' src | wc -l`.

```bash
grep -c -- '--sc-' src/components/common/StateViews.module.css
```

Expected: `14` by substring — 13 real `var(--sc-*)` uses plus one mention in
the rewritten header comment. Confirm the 13 with
`grep -o -- 'var(--sc-' src/components/common/StateViews.module.css | wc -l`.

If either number differs, do not adjust the expectation — find out why. A count
that fell further means something still in use was deleted.

- [ ] **Step 6: Verify no physical properties were introduced**

```bash
grep -nE '(^|[^-])(width|height|left|right|margin-(left|right|top|bottom)|padding-(left|right|top|bottom)):' src/components/common/LoadingState.module.css
```

Expected: no output. `inline-size`, `block-size`, `margin-block`,
`padding-block` and `padding-inline` are the only forms used.

- [ ] **Step 7: Commit**

```bash
git add src/components/common/LoadingState.module.css src/components/common/StateViews.module.css src/components/common/LoadingState.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "refactor(ui): give the loading state its own stylesheet on the new tokens

Splits the loading rules out of StateViews.module.css, which keeps serving the
four D9 states on the legacy tokens until they are rebuilt. The two files share
only .card and .heading, and neither holds a token reference, so the split costs
13 duplicated lines of literals rather than a divided token surface.

Drops the dead .warningCard along the way — no consumer referenced it, and it
was the only reason this file mentioned --sc-warning.

The three skeleton widths move from inline style={{ width }} into nth-child
rules, which removes a physical property and presentation the component had no
reason to carry."
git log -1 --format=%B | grep -i co-authored
```

The final `grep` must print nothing. If it prints a trailer, amend the commit to
remove it before continuing.

---

## Task 2: Elapsed-time counter

**Files:**
- Modify: `src/components/common/LoadingState.tsx`
- Test: `tests/ui/StateTransitions.test.tsx`

**Interfaces:**
- Consumes: `styles.elapsed` and `styles.heading` from Task 1.
- Produces: a `data-testid="elapsed-time"` element and a module-scope
  `formatElapsed(ms: number): string` returning `m:ss`. Task 3 does not use
  either, but the tests it adds run in the same `describe` block created here.

### Why this shape

The counter is `aria-hidden`. A per-second live region is precisely the mistake
the intake form's character counters were kept out of — see the note at
`src/components/scopecraft/InputForm.tsx:16-17`. The step list carries the
announcement; the counter carries the visual proof that something is still
happening.

Elapsed time is derived from a stored timestamp rather than accumulated by an
incrementing counter. A backgrounded tab has its timers throttled, so a counter
that ticks once per throttled fire under-reports the wait by however long the
user was away. `Date.now() - startedAt` is right regardless.

Digits are Western in both locales. That matches every other count in this
codebase — the character counters and `form.presets.meta` render `String(n)`,
and `Intl` is used only for dates, in `HistoryList.tsx:132` and
`SavedPlanView.tsx:86`. Do not reach for `Intl.NumberFormat` here.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `tests/ui/StateTransitions.test.tsx`, immediately
after the closing brace of `describe("State 2 · loading", ...)`.

First extend the imports at the top of the file:

```tsx
import { act, render, screen, within } from "@testing-library/react";
```

and add, next to the other component imports:

```tsx
import { LoadingState } from "@/components/common/LoadingState";
```

Then the block itself:

```tsx
// ---------------------------------------------------------------------------
// State 2 — Loading, in isolation
// ---------------------------------------------------------------------------
//
// Rendered directly rather than through the page. The page-flow tests above are
// locked to real timers because fake timers deadlock against userEvent — see
// the note on "advances the announced step over time". Nothing here touches
// userEvent, so fake timers are safe, and driving the clock directly is the
// only way to reach the 5.6 s mark without a six-second test.

describe("State 2 · loading timing", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("counts the wait up in m:ss without announcing it", () => {
    renderWithProviders(<LoadingState />);

    const elapsed = screen.getByTestId("elapsed-time");
    expect(elapsed).toHaveTextContent("0:00");
    // A per-second live region is the character-counter mistake in another
    // costume. The steps announce; the counter is for eyes only.
    expect(elapsed).toHaveAttribute("aria-hidden", "true");
    expect(within(screen.getByTestId("loading-state")).getByRole("status"))
      .not.toContainElement(elapsed);

    act(() => {
      jest.advanceTimersByTime(9_000);
    });
    expect(elapsed).toHaveTextContent("0:09");

    // Past a minute, because m:ss is the whole reason it is not a raw second
    // count — a 60 s ceiling means the user can see 1:00.
    act(() => {
      jest.advanceTimersByTime(52_000);
    });
    expect(elapsed).toHaveTextContent("1:01");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest --selectProjects jsdom -t "counts the wait up in m:ss" 2>&1 | tail -20
```

Expected: FAIL — `Unable to find an element by: [data-testid="elapsed-time"]`.

If it fails on the `LoadingState` import instead, the named export is missing;
confirm `LoadingState.tsx` exports `export function LoadingState`.

- [ ] **Step 3: Add the formatter**

In `src/components/common/LoadingState.tsx`, below the `STEP_INTERVAL_MS`
constant:

```tsx
/** Elapsed time as `m:ss`. Western digits in both locales, matching every other
 *  count in this codebase — the character counters and form.presets.meta all
 *  render String(n), and Intl is reserved for dates. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Add the state and the interval**

Inside the component, below `const [stepIndex, setStepIndex] = useState(0);`:

```tsx
  // Measured from a timestamp, not accumulated by an incrementing counter: a
  // backgrounded tab has its timers throttled, and a counter that ticks once
  // per throttled fire under-reports the wait by however long the user was
  // away. The subtraction is right regardless of how often the timer runs.
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
```

`startedAt` is never rendered and `elapsedMs` starts at 0, so the first paint is
a deterministic `0:00` on both server and client. This component is only ever
reached after a fetch begins, so it does not server-render in practice — but the
initial output is hydration-safe either way.

- [ ] **Step 5: Render it inside the heading**

Replace the heading line:

```tsx
      <p className={styles.heading}>
        {label ?? t("state.loading.label")}…{" "}
        <span
          className={styles.elapsed}
          aria-hidden="true"
          data-testid="elapsed-time"
        >
          {formatElapsed(elapsedMs)}
        </span>
      </p>
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx jest --selectProjects jsdom -t "counts the wait up in m:ss" 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 7: Run the full gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all pass, **400** tests across 20 suites — 399 after Task 1, plus the
one `it` this task adds.

- [ ] **Step 8: Commit**

```bash
git add src/components/common/LoadingState.tsx tests/ui/StateTransitions.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(ui): show elapsed time while a plan generates

The route allows 60 s and the step list stopped advancing after 4.2 s, so a slow
generation showed a completely still screen for most of its life. A ticking
counter is the smallest honest signal that the wait is progressing.

It is aria-hidden. A per-second live region is the mistake the intake form's
character counters were deliberately kept out of; the step list carries the
announcement and this carries the visual proof.

Time is derived from a stored timestamp rather than accumulated per tick,
because a backgrounded tab has its timers throttled and an accumulating counter
would under-report the wait."
git log -1 --format=%B | grep -i co-authored
```

The final `grep` must print nothing.

---

## Task 3: A fifth step, so the announcement outlives the fourth

**Files:**
- Modify: `src/lib/i18n/translations.ts`
- Modify: `src/components/common/LoadingState.tsx:29-33`
- Test: `tests/ui/StateTransitions.test.tsx`

**Interfaces:**
- Consumes: the `describe("State 2 · loading timing")` block from Task 2.
- Produces: the translation key `state.loading.step5`.

### Why this shape

`STEP_KEYS` has four entries at `STEP_INTERVAL_MS = 1400`, so the live region
speaks its last word at 4.2 s and then says nothing for the remaining ~50 s.
Appending a fifth key makes step 4 non-terminal. The existing effect at
`LoadingState.tsx:48-52` already stops at `STEP_KEYS.length - 1`, so **no timer
and no branch changes** — the chain simply runs one step further.

The fifth step lands at 5.6 s and then stays for the rest of the wait, so its
wording has to be true at 5.6 s *and* at 55 s. "Still working — this can take up
to a minute" is both: `maxDuration = 60` on the route makes the minute a fact,
not reassurance-shaped filler.

- [ ] **Step 1: Write the failing test**

Add this `it` inside the `describe("State 2 · loading timing")` block created in
Task 2:

```tsx
  it("keeps announcing past the fourth step instead of falling silent", () => {
    renderWithProviders(<LoadingState />);

    const loading = screen.getByTestId("loading-state");
    const status = within(loading).getByRole("status");
    expect(status).toHaveTextContent(/validating your request/i);

    // Four transitions at 1400 ms lands on the fifth and final step at 5.6 s.
    act(() => {
      jest.advanceTimersByTime(5_600);
    });
    expect(status).toHaveTextContent(/still working/i);

    // Terminal, not looping: a 50 s wait must not cycle back to "Validating
    // your request", which would be an outright lie about what is happening.
    act(() => {
      jest.advanceTimersByTime(45_000);
    });
    expect(status).toHaveTextContent(/still working/i);

    // And exactly one line is live — not the accumulated list.
    expect(status.textContent).not.toMatch(/validating/i);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest --selectProjects jsdom -t "keeps announcing past the fourth step" 2>&1 | tail -20
```

Expected: FAIL — the status region still reads "Calculating priority, MoSCoW,
and sprint capacity" at 5.6 s, so the `/still working/i` assertion fails.

- [ ] **Step 3: Add the translation pair**

In `src/lib/i18n/translations.ts`, in the `en` object, directly after
`"state.loading.step4"` (line 110):

```ts
  // Terminal step. It is shown from 5.6 s until the response arrives, which the
  // route caps at 60 s (maxDuration in src/app/api/scopecraft/route.ts), so the
  // minute is a fact rather than reassurance. Before this existed the live
  // region went silent at 4.2 s and stayed silent for the rest of the wait.
  "state.loading.step5": "Still working — this can take up to a minute",
```

and in the `ar` object, directly after its `"state.loading.step4"` (line 360):

```ts
  "state.loading.step5": "لا يزال العمل جاريًا — قد يستغرق هذا حتى دقيقة واحدة",
```

Adding only the English key is a compile error, because `ar` is typed
`Record<TranslationKey, string>`. That error is the type system working; do not
cast around it.

- [ ] **Step 4: Append the key to `STEP_KEYS`**

In `src/components/common/LoadingState.tsx`:

```tsx
const STEP_KEYS: readonly TranslationKey[] = [
  "state.loading.step1",
  "state.loading.step2",
  "state.loading.step3",
  "state.loading.step4",
  // Terminal, and the only step that is honest about not knowing. Steps 1-4
  // describe a chain whose shape is known; this one exists because the chain
  // finishes describing itself at 4.2 s while the request can run to 60 s, and
  // silence for the remaining 50 s told a screen-reader user nothing.
  "state.loading.step5",
];
```

The effect at lines 48-52 needs no change — `stepIndex >= STEP_KEYS.length - 1`
already reads the new length, and the step still stops rather than looping.

- [ ] **Step 5: Update the file's header comment**

The comment at `LoadingState.tsx:11-12` names the chain as four stages. Change
that sentence to:

```
//    reporting for a chain we know the general shape of (validate → contact
//    provider → structure → compute → still working), not a fabricated progress
//    percentage — the actual request either completes or fails; these steps
//    describe what is happening, not how close to done it is.
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx jest --selectProjects jsdom -t "keeps announcing past the fourth step" 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 7: Run the full gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all pass, **401** tests across 20 suites.

- [ ] **Step 8: Commit**

```bash
git add src/lib/i18n/translations.ts src/components/common/LoadingState.tsx tests/ui/StateTransitions.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(ui): keep the loading announcement alive past the fourth step

The step list spoke its last word at 4.2 s and then said nothing for the rest of
a request the route allows 60 s for. A screen-reader user got silence for most
of the wait.

A fifth step fixes it without a second timer: the existing chain already stops
at STEP_KEYS.length - 1, so appending a key simply gives it one more place to
go. It is worded to be true at 5.6 s and still true at 55 s."
git log -1 --format=%B | grep -i co-authored
```

The final `grep` must print nothing.

---

## Task 4: Capture the evidence and close the point

**Files:**
- Modify: `docs/upgrade-checklist.md`
- Modify: `docs/decision-log.md`
- Regenerate: `docs/evidence/ui/shots/*.png`,
  `docs/evidence/ui/accessibility-audit.txt`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: nothing consumed by later tasks. This closes D3.

- [ ] **Step 1: Build, then start both capture servers**

`capture:ui` needs a production build and two servers — the second serves the
provider-failure shots with deliberately bogus AI keys.

```bash
npm run build
```

Then, in two separate background shells:

```bash
set -a; . ./.env.local; set +a; npx next start -p 3200
```

```bash
set -a; . ./.env.local; set +a; NVIDIA_API_KEY=bogus GROQ_API_KEY=bogus GEMINI_API_KEY=bogus npx next start -p 3201
```

**Load the env with `set -a; . ./.env.local; set +a`, not
`export $(grep ... .env.local)`.** The latter breaks, because `DATABASE_URL`
contains an `&` that the shell splits on.

- [ ] **Step 2: Run the capture**

```bash
set -a; . ./.env.local; set +a; npm run capture:ui
```

Expected: exit 0. `AUTH_SECRET` must match the servers started above —
the script mints its own Auth.js session via `scripts/mint-session.mjs` to reach
the auth-gated pages.

Output: 17 PNGs in `docs/evidence/ui/shots/` plus
`docs/evidence/ui/accessibility-audit.txt`.

- [ ] **Step 3: Read the audit rather than trusting the exit code**

```bash
grep -iE "below|fail|unnamed|skip|overflow" docs/evidence/ui/accessibility-audit.txt
```

Check specifically, and write the real numbers into the checklist entry in
Step 5 — do not copy D2's:

- **Contrast pairs, light and dark, none below AA.** `--c-text-muted` on
  `--c-panel` is new to this file (the `.elapsed` counter) and
  `--c-accent` on `--c-panel` is new (`.stepDone`). Both must appear and pass.
- **0 unnamed controls, 0 heading skips.**
- **No horizontal overflow at 1280 / 768 / 390 px in both LTR and RTL.** The
  Arabic step-5 string is long; 390 px RTL is where it would show.

If any pair is below AA, stop and report. Do not adjust the token values —
`tokens.ts` is asserted against by `tests/evaluation/design-tokens.test.ts` and
the twelve roles are closed for this point.

- [ ] **Step 4: Add the decision-log entry**

`docs/decision-log.md` is a **numbered list**, not `###` headings. Match the
shape of entry 32 exactly: a bold one-line title ending in the date and module,
then indented paragraphs with bold lead-ins. Append as entry 33 — confirm the
current last number first with `grep -n "^3[0-9]\." docs/decision-log.md`.

Note that entry 32 already settled half of this: it records that `success` and
`warning` were deliberately not added, and that the capacity ring's "ok" state
takes `--c-accent` for that reason. `.stepDone` is the same call applied to the
same palette, so entry 33 should say so rather than re-argue it.

```markdown
33. **The loading card gets its own stylesheet — 2026-09-02, Module D3.**
    `StateViews.module.css` is shared by five components, which made D3 look
    inseparable from D9. It was not. Only `.card` and `.heading` are used by
    more than one consumer, and neither contains a single token reference — the
    shared surface had nothing token-shaped in it at all.

    **Traded:** roughly 13 duplicated lines of literals, and a sixth copy of
    `.srOnly`, for one module-cycle. **Against:** migrating `.retryButton` and
    `.startOverButton` onto `--c-*` now, when D9 replaces both with the `Button`
    primitive — the same disposal D1 performed on `.resetButton`. Work thrown
    away is worse than a duplicated literal with a known deletion date.

    **`.stepDone` was `--sc-success`, and no `success` role was added.** Entry 32
    already made this call for the capacity ring, whose "ok" state takes
    `--c-accent` rather than a green. A completed step is the same shape of
    thing: past, not a fault, and already carrying a `✓`. It takes `--c-accent`
    too. `danger` remains the only status colour among the twelve.

    **`.warningCard` was deleted, not ported.** No consumer referenced it, and
    it was the only reason this file mentioned `--sc-warning`.
```

- [ ] **Step 5: Tick D3 in the checklist**

Replace the D3 entry in `docs/upgrade-checklist.md` (lines 260-262) with a
ticked entry in the same shape as D1's and D2's. Fill in the real capture
numbers from Step 3 — the counts below marked `<n>` are placeholders you must
replace with what the audit actually printed:

```markdown
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
      deleted. Legacy references fell 271 → 261.

      Verified by `npm run capture:ui`, exit 0: <n> contrast pairs light /
      <n> dark, none below AA; 0 unnamed controls; 0 heading skips; no
      horizontal overflow at 1280/768/390 px in both LTR and RTL.

      **Not covered by this point.** `StateViews.module.css` keeps its four D9
      consumers on the legacy tokens, along with the hand-rolled `.retryButton`
      and `.startOverButton` that D9 replaces with the `Button` primitive —
      porting them now would be work D9 throws away. `.srOnly` is now duplicated
      in six stylesheets; consolidating it touches four separate points and is
      its own, like the global `box-sizing` reset. Reduced motion is still a
      per-file `@media` block rather than a token-level rule, which is E1.
```

- [ ] **Step 6: Verify the numbers that drift**

`CLAUDE.md` §11 names five numbers that appear in ~6 files each and go stale.
Check each against reality:

```bash
npm test 2>&1 | tail -5                          # test count → expect 401 / 20 suites
ls docs/evidence/ui/shots/*.png | wc -l          # screenshot count → expect 17
node -p "Object.keys(require('./package.json').dependencies).length"  # dependency count
grep -ro -- 'var(--sc-' src | wc -l              # legacy refs in use → expect 204
git log --oneline -1                              # branch head
```

Then find and fix any doc that states an old value:

```bash
grep -rn "398 tests\|271\|19 contrast" docs/ --include=*.md
```

- [ ] **Step 7: Run all four gates one final time**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add docs/
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "docs: close D3

Recaptured UI evidence, decision-log entry 33 for the stylesheet split and the
stepDone colour, and the drifting counts brought back in line."
git log -1 --format=%B | grep -i co-authored
```

The final `grep` must print nothing.

- [ ] **Step 9: Report, do not deploy**

Deploying is a separate, explicitly requested action. `CLAUDE.md` §8: do not
push to production without being asked. When asked, both remotes are needed —
pushing to `origin` alone never changes the live site:

```bash
git push origin dev && git push fork dev:main
```

Report to the owner: what the gates printed, the real contrast numbers from the
audit, the legacy-token count, and anything the plan expected that did not
happen.

---

## Self-Review

**Spec coverage.** The checklist's D3 wording is *"must keep the honest step
reporting that exists today, and add what is missing: elapsed time. The current
component stops advancing at step 4 and then sits still for up to 50 s."*
Step reporting is kept and extended (Task 3), elapsed time is added (Task 2), and
the "sits still" complaint is answered on both channels — visually by the counter
and audibly by the fifth step. The Module D framing (rebuild onto the new tokens,
phone-first, logical properties) is Task 1. Evidence and documentation are
Task 4.

**Placeholders.** The only intentional gaps are the `<n>` contrast counts in
Task 4 Step 5, which are marked as placeholders precisely because inventing them
would be fabricated evidence — `CLAUDE.md` §2 forbids exactly that. Step 3 says
where the real numbers come from.

**Type consistency.** `formatElapsed(ms: number): string` is defined in Task 2
Step 3 and used in Task 2 Step 5. `styles.elapsed` is defined in Task 1 Step 1
and used in Task 2 Step 5. `state.loading.step5` is defined in Task 3 Step 3 and
used in Task 3 Step 4. `data-testid="elapsed-time"` is produced in Task 2 Step 5
and queried in Task 2 Step 1. Every `styles.` name the component already used
survives Task 1 with the same spelling.

**Known risk.** Task 2's tests use fake timers, which the page-flow tests in the
same file deliberately do not — `tests/ui/StateTransitions.test.tsx:188-193`
records that fake timers deadlock against `userEvent`, confirmed by hand. The new
block renders `LoadingState` directly and touches `userEvent` nowhere, so the
conflict does not arise, and `beforeEach`/`afterEach` restore real timers for
every other test in the file. If the isolated block turns out to deadlock anyway,
fall back to real timers with `waitFor(..., { timeout: 3000 })` for the counter
and raise that single test's timeout to 15 s for the fifth step — slower, but it
follows the pattern the file already proves works.
