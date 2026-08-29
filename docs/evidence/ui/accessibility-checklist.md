# Accessibility Checklist — WCAG 2.2 AA

**Row:** Product UI & Workflow Engineer. **Target:** WCAG 2.2 AA.
**Reviewed:** 2026-08-24 against commit `4896897`, on a production build.
**Method:** every row below is either *measured* by
[`scripts/capture-ui-evidence.mjs`](../../../scripts/capture-ui-evidence.mjs) against the live
DOM, or *asserted* by a test in `tests/ui/`. Rows that are neither are marked **unverified**
rather than ticked.

Machine-readable output: [`accessibility-audit.txt`](accessibility-audit.txt) — regenerate with
`npm run capture:ui`. The run **fails** (exit 1) if any contrast pair drops below its
threshold, any control loses its accessible name, a heading level is skipped, or the page
overflows horizontally in either text direction.

## Measured results

| Metric | Light | Dark |
|---|---|---|
| Distinct text/background pairs measured | 19 | 19 |
| Below WCAG AA threshold | **0** | **0** |
| Lowest ratio observed | 4.87:1 (11px "Live" badge, needs 4.5) | 4.87:1 |
| Interactive controls without an accessible name | **0** of 16 | **0** of 16 |
| Keyboard-reachable elements | 16 | 16 |
| Skipped heading levels | 0 (`h1`, `h2`) | 0 |
| Landmarks | `banner` + `main`, exactly one `h1` | same |
| Horizontal overflow at 1280 / 768 / 390px, **`en/ltr` and `ar/rtl`** | none in all six | — |

The 14th and 15th controls, and the extra contrast pairs, are the header's sign-out button,
the signed-in name and the "Your plans" history link — all added with authentication. The
16th control is the header's Home button (added after this table was last measured — see
below). Each clears AA.

Re-measured 2026-08-28 against the current build. The success screenshots took **1**
generation attempt, down from up to four before the `PLANNING_ERROR` fix.

**Superseded note, re-measured 2026-08-28 (history: duplicate/delete buttons):** this table
previously read 15 controls / 15 keyboard-reachable, carried over unchanged since before the
header gained a Home button (`155b74f`). Re-running `npm run capture:ui` for this change
caught the drift: the actual count on `/scopecraft` was already 16, not 15. That table is
fixed above. Separately: `/scopecraft/history` — where this change added a Duplicate and a
Delete button to every card — is **not** a page this script visits at all; the measured audit
above has only ever covered `/scopecraft`. The new history buttons are unmeasured by the
automated audit and are not reflected in this table; they are asserted instead by
`tests/ui/HistoryList.test.tsx` (both render with an accessible name from visible text, no
`aria-label` needed) and were checked by hand for the two-click delete confirm behavior.
The same gap applies to `/` — this plan's new landing page, and the only new *public* page,
the one a signed-out visitor lands on first. `scripts/capture-ui-evidence.mjs`'s route list is
`/login` and `/scopecraft` only; it does not visit `/` any more than it visits
`/scopecraft/history`. `/` is therefore also uncaptured and unmeasured by the automated audit
— not contrast-checked, not checked for accessible names or heading order, not screenshotted —
and nothing in this document should be read as covering it.

## Perceivable

| ✔ | Criterion | Evidence |
|---|---|---|
| ✅ | **1.1.1 Non-text content** — images have text alternatives | 0 `<img>` elements; the "SC" mark and the progress ring are `aria-hidden` with the accessible value beside them |
| ✅ | **1.3.1 Info and relationships** — structure is conveyed programmatically | `banner`/`main` landmarks, real `<label for>`, `<fieldset>/<legend>` for presets, a true ARIA `tablist` for results |
| ✅ | **1.3.5 Identify input purpose** | `autocomplete` set on all four controls; `type="number"` + `inputmode="numeric"` on the numeric fields |
| ✅ | **1.4.3 Contrast (minimum)** | 38 pairs measured across both themes, 0 failures, lowest 4.87:1 |
| ✅ | **1.4.1 Use of colour** | MoSCoW badges carry a text label as well as a hue; invalid fields get a thicker border *and* a message *and* `aria-invalid` — never colour alone |
| ✅ | **1.4.10 Reflow** — no 2-D scrolling at 320px-equivalent | measured at 390px: `scrollWidth === clientWidth` |
| ✅ | **1.4.12 Text spacing** | layout is flex/grid with no fixed heights on text containers |

## Operable

| ✔ | Criterion | Evidence |
|---|---|---|
| ✅ | **2.1.1 Keyboard** — all functionality available from a keyboard | 15 of 15 controls in the tab order; the sprint board is explicitly "drag-free, keyboard-operable" and Defer is a real `<button>` |
| ✅ | **2.1.2 No keyboard trap** | no modal or overlay in the app |
| ✅ | **2.4.1 Bypass blocks** — skip link | **added in this pass.** Measured: the first `Tab` from a fresh load focuses "Skip to main content", and following it lands `main` clear of the sticky header (main top 73px, header bottom 73px) |
| ✅ | **2.4.3 Focus order** | DOM order matches visual order; the results `tablist` uses roving `tabindex` with arrow-key navigation |
| ✅ | **2.4.7 Focus visible** | `:focus-visible` rules in 9 CSS modules; **zero** `outline: none` declarations anywhere in `src/` |
| ✅ | **2.4.11 Focus not obscured** | the sticky-header clearance check above |
| ✅ | **2.5.8 Target size (minimum)** | AA requires 24×24px. Measured: all 13 controls pass; smallest is the language toggle at 30×30. Form controls and primary buttons are 44px (`min-height: 2.75rem`), which also meets the AAA 2.5.5 threshold — the 30px header toggles do not, and AAA is not the target |
| ✅ | **3.2.x / 2.3.1** — no motion hazards | `prefers-reduced-motion` honoured globally in `layout.tsx` plus 4 CSS modules; no `transition: all` anywhere |

## Understandable

| ✔ | Criterion | Evidence |
|---|---|---|
| ✅ | **3.1.1 Language of page** | `<html lang>` set server-side and corrected pre-paint; `dir="rtl"` verified for Arabic |
| ✅ | **3.2.2 On input** — no surprise context changes | errors appear on blur or submit, never on first keystroke |
| ✅ | **3.3.1 Error identification** | summary banner with `role="alert"` that **takes focus**, plus per-field messages |
| ✅ | **3.3.2 Labels or instructions** | every field has a visible label and a hint; required state is both `*` and text for screen readers |
| ✅ | **3.3.3 Error suggestion** | messages state the fix ("At least 20 characters"), and the provider error offers **Retry generation** |

## Robust

| ✔ | Criterion | Evidence |
|---|---|---|
| ✅ | **4.1.2 Name, role, value** | 0 unnamed controls; semantic HTML throughout — no `<div onClick>` |
| ✅ | **4.1.3 Status messages** | `role="status" aria-live="polite"` for loading progress, toasts and preset changes; `role="alert"` for errors |

### One deliberate deviation, and why

The character counter is **not** `aria-live`. Announcing "1/2000, 2/2000, 3/2000" on every
keystroke is technically compliant and practically unusable. Instead the counter is wired into
`aria-describedby` (read on focus and on demand) and a separate polite region announces only
meaningful threshold crossings. Asserted by test in `tests/ui/Amenities.test.tsx`.

The capacity slider is `aria-hidden` with `tabIndex={-1}` for the same reason: it is a second
*view* of the labelled number input, not a second setting. Exposing both would announce the
same value twice with no indication they are linked.

## Fixed during this review

Found by auditing against the Web Interface Guidelines, then verified by re-measuring:

1. **No skip link** (2.4.1) — added, localized in English and Arabic, with three regression
   tests.
2. **Skip target hidden behind the sticky header** (2.4.11) — `scroll-margin-top` added; now
   measured every run.
3. **10px horizontal overflow at ≤768px** (1.4.10) — `box-sizing: border-box` on `.control`.
4. **No `autocomplete`** on any form control (1.3.5) — added to all four.
5. **No `<meta name="theme-color">`** — added via the `viewport` export, matching `--bg` in
   each theme.
6. **Brand name not marked non-translatable** — `translate="no"` on "ScopeCraft"; machine
   translation renders it as "craft of scope" in Arabic.
7. **No `touch-action`/tap-highlight handling** — added globally, removing the 300ms
   double-tap delay and the grey flash on tap.
8. **~10000px horizontal overflow on every Arabic page** (1.4.10) — the skip link added in
   item 1 was parked at the physical `left: -9999px`, which is unscrollable space under LTR
   but *scrollable* space under RTL: `scrollWidth` measured 11279 against a 1280px viewport.
   Fixed with logical properties (`inset-inline-start`, `border-end-end-radius`).

   **Item 3 above should have caught this and did not**, because the overflow loop ran LTR
   only and tested the right edge only — an element escaping past the *left* edge was
   unreportable. The loop now runs every viewport in both `en/ltr` and `ar/rtl` and checks
   both edges. A direction-blind check on a bilingual app is not a passing check; it is an
   untested direction.

## Not verified — do not claim these

- **No real screen-reader run.** The audit measures the DOM contract assistive tech consumes;
  it is not a substitute for driving VoiceOver or NVDA by hand. This is the biggest gap.
- **No automated `axe`/Lighthouse scan.** The project has no such dependency; the checks above
  are hand-written.
- **Contrast is measured on rendered text only** — not on icon glyphs, focus rings, or
  borders (WCAG 1.4.11 non-text contrast).
- **Zoom to 200% and 400%** (1.4.4, 1.4.10) not tested.
- **Colour-blind simulation** not run; the "never colour alone" rule is enforced by review,
  not by measurement.
