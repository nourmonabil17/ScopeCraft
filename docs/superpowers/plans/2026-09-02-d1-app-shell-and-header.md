# D1 — App Shell and Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app shell and header off the legacy `--sc-*` tokens and off max-width media queries, so `Header.module.css` can leave the breakpoint audit's exemption list.

**Architecture:** Three tasks. The first replaces two hand-rolled buttons with the existing `Button` primitive, which deletes the `.resetButton` rules entirely. The second rewrites the remaining stylesheet onto `--c-*` tokens and inverts its two `max-width` queries to phone-first `min-width`, then removes the file from `PRE_REBUILD_EXEMPT`. The third verifies in a real browser, which is where Module C's two genuine bugs were found by eyes rather than by a green suite.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS Modules, Jest + Testing Library (jsdom).

## Global Constraints

Every task's requirements implicitly include this section.

- Commits are authored **`Yousef mohmed hasabo <yousefhasabo94@gmail.com>`**. Use `git -c user.name=... -c user.email=... commit` if local config disagrees.
- **Never add a `Co-Authored-By` trailer.** Verify after every commit: `git log -1 --format=%B | grep -i co-authored` must print nothing.
- No mention of Claude, Anthropic, or any model name in commit messages, code comments, or user-facing text.
- **All four gates pass before every commit:** `npm run typecheck && npm run lint && npm test && npm run build`. A commit that breaks any gate does not get made.
- **Logical CSS properties, not physical.** `inset-block-start` not `top`; `border-block-end` not `border-bottom`; `margin-inline` not `margin-left`; `inline-size`/`block-size` not `width`/`height`.
- **Breakpoints:** only `30rem`, `48rem`, `64rem`, `80rem`, and **`min-width` only**. Phone is the base case; a breakpoint adds, never undoes.
- **Theming:** colours are defined on `:root` and redefined on `:root.dark`. Never define a colour only inside a bare media query.
- **Bilingual:** every user-facing string needs both an `en` and an `ar` entry in `src/lib/i18n/translations.ts`. This task adds no new strings.
- **WCAG 2.2 AA.** Every interactive control keeps an accessible name. The skip link stays first in the tab order.
- **No new dependencies.**
- **jsdom has no computed style.** `*.module.css` maps to `identity-obj-proxy`, so `styles.foo === "foo"`. Never assert colours, spacing, or media-query behaviour in a unit test. Assert roles, names, attributes, class identity, and behaviour.
- Baseline before this plan: **380 tests, 20 suites**, all passing.

---

## File Structure

| File | Change | Responsibility after D1 |
|---|---|---|
| `src/components/common/Header.tsx` | Modify (~line 100-110) | App bar markup. Reset action delegates to `Button`. |
| `src/components/common/UserMenu.tsx` | Modify (~line 29-36) | Signed-in identity. Sign-out delegates to `Button`. |
| `src/components/common/Header.module.css` | Rewrite | Header + UserMenu layout only. Zero `--sc-*`, zero `max-width` queries, no button styling. |
| `tests/evaluation/breakpoint-audit.test.ts` | Modify (lines 49-54, 76-80) | Exemption list drops to 3. |
| `tests/ui/Amenities.test.tsx` | Modify (Header describe block) | Adds one assertion for the reset control's provenance. |
| `tests/ui/Auth.test.tsx` | Modify (Header identity describe block) | Adds one assertion for the sign-out control's provenance. |

**Out of scope for D1** (do not do these here):
- The global `box-sizing: border-box` reset — carried-forward item 2, its own point.
- `ToggleControls.module.css` — a separate `PRE_REBUILD_EXEMPT` entry, not D1's surface. `Header.tsx` keeps importing it.
- Deleting the `--sc-*` block from `layout.tsx` — blocked until `grep -r "--sc-" src` returns nothing. It will still return ~307 after D1.
- The nested live region in `Toast.tsx` — carried-forward item 1.
- Known issue #3 (hydration #418) — owner's decision, do not touch.

---

## Decisions this plan takes (flag at review if any is wrong)

1. **There is no `success` colour role.** The ten roles carry no green, and adding one would reopen Module C and need new contrast tests. The LIVE badge therefore stops using hue to carry meaning: label in `--c-text-muted`, dot in `--c-accent`, on `--c-panel-recessed` with a `--c-rule` hairline. This matches the Chip decision (weight, not hue — WCAG 1.4.1). The badge still reads "Live" in text, so nothing is conveyed by colour alone.
2. **`backdrop-filter` is dropped.** The direction expresses elevation as a hairline rule in light and a lighter fill in dark, never as a blur or shadow. `--c-panel` is opaque, which makes a `saturate/blur` backdrop pointless anyway.
3. **`letter-spacing` is removed from `.status`.** Arabic is cursive and letter-spacing breaks the joins, and this badge renders `مباشر` when the locale is `ar`. `text-transform: uppercase` stays — it is a no-op on Arabic and harmless.
4. **Both header buttons become `Button variant="secondary"`.** This raises them from `2.25rem` (36px) to the primitive's `2.75rem` (44px) comfort target, and is what allows `.resetButton` to be deleted rather than migrated.

---

### Task 1: Both header buttons use the Button primitive

`styles.resetButton` has **two** consumers, not one — `Header.tsx:103` and `UserMenu.tsx:31`. Migrating only the first would leave the sign-out button referencing a class this task deletes, so both move together.

**Files:**
- Modify: `src/components/common/Header.tsx:100-110`
- Modify: `src/components/common/UserMenu.tsx:29-36`
- Modify: `src/components/common/Header.module.css:112-135` (delete)
- Test: `tests/ui/Amenities.test.tsx` (the `describe("Header", ...)` block)
- Test: `tests/ui/Auth.test.tsx` (the `describe("Header identity control", ...)` block)

**Interfaces:**
- Consumes: `Button` from `@/components/ui/Button` — `ButtonProps { variant?: "primary" | "secondary" | "quiet"; type?: "button" | "submit"; busy?: boolean; children: ReactNode }`, extending `ButtonHTMLAttributes<HTMLButtonElement>` minus `type`. Unlisted props (`title`, `data-testid`, `onClick`) pass through via `...rest`. Applies `styles.button` plus `styles[variant]`.
- Produces: nothing new. `data-testid="header-reset"` and `data-testid="sign-out"` keep their current meaning for every later task.

- [ ] **Step 1: Write the failing assertions**

In `tests/ui/Amenities.test.tsx`, inside `describe("Header", ...)`, add:

```tsx
  it("builds the reset action from the Button primitive", () => {
    renderWithProviders(<Header onReset={jest.fn()} />);

    const reset = screen.getByTestId("header-reset");
    // identity-obj-proxy maps each CSS-module class to its own name, so class
    // identity is the one thing jsdom can tell us about styling. It cannot tell
    // us the control is 44px tall; it can tell us which stylesheet owns it.
    expect(reset).toHaveClass("button");
    expect(reset).not.toHaveClass("resetButton");
    expect(reset).toHaveAttribute("type", "button");
  });
```

In `tests/ui/Auth.test.tsx`, inside `describe("Header identity control", ...)`, add:

```tsx
  it("builds the sign-out action from the Button primitive", () => {
    setStubSession({ user: { name: "Yousef", email: "yousef@example.com" } });
    renderWithProviders(<Header />);

    const signOutButton = screen.getByTestId("sign-out");
    expect(signOutButton).toHaveClass("button");
    expect(signOutButton).not.toHaveClass("resetButton");
    expect(signOutButton).toHaveAttribute("type", "button");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest tests/ui/Amenities.test.tsx tests/ui/Auth.test.tsx -t "Button primitive"`
Expected: **2 failing.** Each fails on `toHaveClass("button")` — the elements currently carry `class="resetButton"`.

- [ ] **Step 3: Point Header.tsx at the primitive**

In `src/components/common/Header.tsx`, add the import beside the other component imports:

```tsx
import { Button } from "@/components/ui/Button";
```

Replace the `onReset` block (currently lines 100-110):

```tsx
          {onReset && (
            <Button
              variant="secondary"
              onClick={onReset}
              title={t("header.reset.description")}
              data-testid="header-reset"
            >
              {t("header.reset")}
            </Button>
          )}
```

- [ ] **Step 4: Point UserMenu.tsx at the primitive**

In `src/components/common/UserMenu.tsx`, add:

```tsx
import { Button } from "@/components/ui/Button";
```

Replace the `<button>` element (currently lines 29-36):

```tsx
      <Button
        variant="secondary"
        onClick={() => void signOut({ callbackUrl: "/login" })}
        data-testid="sign-out"
      >
        {t("header.signOut")}
      </Button>
```

- [ ] **Step 5: Delete the dead rules**

In `src/components/common/Header.module.css`, delete lines 112-135 entirely — `.resetButton`, `.resetButton:hover`, and `.resetButton:focus-visible`. Nothing references them after Steps 3 and 4.

Confirm: `grep -rn 'resetButton' src` must print nothing.

- [ ] **Step 6: Run the affected suites**

Run: `npx jest tests/ui/Amenities.test.tsx tests/ui/Auth.test.tsx`
Expected: **PASS.** The pre-existing assertions must pass unchanged too — `header-reset` still calls `onReset` once, still reads `وثيقة جديدة` under `locale: "ar"`, `sign-out` still calls `signOut({ callbackUrl: "/login" })`, and the skip link is still `focusable[0]`.

- [ ] **Step 7: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all clean; test count **382, 20 suites** (380 baseline + the 2 added here).

- [ ] **Step 8: Restore the build-flipped file, then commit**

```bash
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/components/common/Header.tsx src/components/common/UserMenu.tsx \
         src/components/common/Header.module.css \
         tests/ui/Amenities.test.tsx tests/ui/Auth.test.tsx \
  -m 'feat(ui): header buttons come from the Button primitive

The reset action and the sign-out action were both wearing .resetButton, a
36px bespoke control defined in Header.module.css. Both are now the Button
primitive at the 44px comfort target, which lets the rule be deleted rather
than migrated to the new tokens.

Two consumers, not one: UserMenu imports Header.module.css and used the same
class, so migrating only the header would have left sign-out unstyled.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```

---

### Task 2: Header.module.css onto `--c-*` tokens and phone-first queries

The two `@media (max-width: 30rem)` blocks are the only reason this file is exempt. The audit rejects `max-width` even at an approved number, so both invert: the hidden state becomes the base case and the breakpoint adds the visible state back.

**Files:**
- Rewrite: `src/components/common/Header.module.css`
- Modify: `tests/evaluation/breakpoint-audit.test.ts:49-54` and `:76-80`

**Interfaces:**
- Consumes: custom properties emitted by `tokenCss()` in `src/lib/design/css.ts` — colours `--c-ground --c-panel --c-panel-recessed --c-rule --c-rule-strong --c-text --c-text-muted --c-text-faint --c-accent --c-accent-contrast`; scales `--space-0`…`--space-8` (0, .25, .5, .75, 1, 1.5, 2, 3, 4 rem), `--text-xs|sm|base|lg|xl|2xl`, `--radius-none|sm|md`, `--motion-fast|base|slow|ease`.
- Consumes: `APPROVED_MIN_WIDTHS` from `@/lib/design/breakpoints` = `["30rem", "48rem", "64rem", "80rem"]`.
- Produces: class names `header inner leftGroup brand mark brandText brandName status statusDot actions user userName`, all still exported to `Header.tsx` and `UserMenu.tsx`.

- [ ] **Step 1: Remove the exemption to make the audit fail**

In `tests/evaluation/breakpoint-audit.test.ts`, delete the `Header.module.css` line from `PRE_REBUILD_EXEMPT` so it reads:

```ts
const PRE_REBUILD_EXEMPT = [
  "src/components/common/ToggleControls.module.css",
  "src/components/scopecraft/InputForm.module.css",
  "src/components/scopecraft/InteractiveSprintBoard.module.css",
];
```

And update the length assertion and its comment:

```ts
  it("the pre-rebuild exemption list has not grown", () => {
    // Measured at 4 on 2026-09-02; Header came off in D1. Module D shrinks
    // this to zero.
    expect(PRE_REBUILD_EXEMPT).toHaveLength(3);
  });
```

- [ ] **Step 2: Run the audit to verify it fails**

Run: `npx jest tests/evaluation/breakpoint-audit.test.ts`
Expected: **FAIL** on `src/components/common/Header.module.css uses only approved breakpoints`, with `expect(received).toBe("min")` receiving `"max"`. Two violations, from the blocks at lines 137 and 165.

- [ ] **Step 3: Rewrite the stylesheet**

Replace the whole of `src/components/common/Header.module.css` with:

```css
/* src/components/common/Header.module.css */

.header {
  position: sticky;
  inset-block-start: 0;
  z-index: 40;
  background: var(--c-panel);
  /* Direction A expresses elevation as a hairline in light and a lighter fill
     in dark — never a shadow, and never a blur. The backdrop-filter this rule
     replaced was doing neither job on an opaque panel. */
  border-block-end: 1px solid var(--c-rule);
}

.inner {
  max-inline-size: 64rem;
  margin-inline: auto;
  padding-block: var(--space-2);
  padding-inline: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.leftGroup {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-inline-size: 0;
}

.mark {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 2rem;
  block-size: 2rem;
  border-radius: var(--radius-md);
  background: var(--c-accent);
  color: var(--c-accent-contrast);
  font-size: var(--text-xs);
  font-weight: 800;
  /* "SC" is always Latin and aria-hidden, so tracking is safe here. */
  letter-spacing: 0.02em;
}

.brandText {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-inline-size: 0;
}

.brandName {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--c-text);
  white-space: nowrap;
}

/* Phone is the base case, so the badge is absent until there is room for it —
   not present and then removed. Inverted from a max-width query, which is what
   kept this file on the breakpoint audit's exemption list.

   No hue carries the meaning: there is no success role in the token set, and
   the word "Live" is the signal. No letter-spacing either — this renders
   "مباشر" under the ar locale, and tracking breaks Arabic's cursive joins. */
.status {
  display: none;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--c-text-muted);
  background: var(--c-panel-recessed);
  border: 1px solid var(--c-rule);
  border-radius: var(--radius-sm);
  padding-block: var(--space-1);
  padding-inline: var(--space-2);
  white-space: nowrap;
}

@media (min-width: 30rem) {
  .status {
    display: inline-flex;
  }
}

.statusDot {
  inline-size: 0.375rem;
  block-size: 0.375rem;
  border-radius: 50%;
  background: var(--c-accent);
}

/* Only the dot animates, and only when motion is welcome. A pulsing text label
   would be much harder to read. */
@media (prefers-reduced-motion: no-preference) {
  .statusDot {
    animation: status-pulse 2.4s ease-in-out infinite;
  }
}

@keyframes status-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* ---- Signed-in identity (UserMenu) ---- */

.user {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-inline-size: 0;
}

/* Same inversion as .status. On a phone the header is already tight: the
   sign-out control is the thing that matters, the name is the nicety, so the
   name appears once there is room rather than being taken away when there
   is not. */
.userName {
  display: none;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-muted);
  /* A long display name must not push the toggles off the bar. */
  max-inline-size: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 30rem) {
  .userName {
    display: block;
  }
}
```

- [ ] **Step 4: Run the audit to verify it passes**

Run: `npx jest tests/evaluation/breakpoint-audit.test.ts`
Expected: **PASS**, now including a `src/components/common/Header.module.css uses only approved breakpoints` case.

- [ ] **Step 5: Confirm the file is fully migrated**

```bash
grep -c '\-\-sc-' src/components/common/Header.module.css   # expect 0
grep -c 'max-width' src/components/common/Header.module.css # expect 0
grep -rn 'top:\|border-bottom:\|margin-left\|margin-right\|width:' src/components/common/Header.module.css
```
The last command should return only `max-inline-size`/`min-inline-size`/`inline-size` matches — no physical `width:`, `top:`, or `border-bottom:`.

- [ ] **Step 6: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all clean, **383 tests, 20 suites**. The audit's `it.each(audited)` gains one case because `Header.module.css` moves from `PRE_REBUILD_EXEMPT` into `audited`, so this task adds a test without adding an `it` block: 380 baseline + 2 from Task 1 + 1 here. If the reported total differs, reconcile it before committing rather than adjusting the expectation.

- [ ] **Step 7: Restore the build-flipped file, then commit**

```bash
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/components/common/Header.module.css tests/evaluation/breakpoint-audit.test.ts \
  -m 'feat(ui): header on the new tokens, phone-first

Every max-width query in this file is inverted to min-width: the status
badge and the user name are now absent on a phone and added at 30rem, rather
than present and taken away. That is the whole reason the file sat on the
breakpoint audit exemption list, which drops from four entries to three.

Three substitutions have no like-for-like token. There is no success role, so
the Live badge stops carrying meaning in hue and reads as text on a recessed
panel. There is no translucent surface and no shadow scale, so the sticky bar
is an opaque panel with a hairline rule and the backdrop-filter is gone. And
.status loses its letter-spacing, which was breaking the cursive joins on the
Arabic label.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```

---

### Task 3: Verify in a browser, both themes and both directions

Module C found two real bugs this way that a green suite did not catch — a dialog overflowing its viewport, and a plan that would have produced two live regions. jsdom cannot see layout, so this task is not optional.

**Files:**
- Temporarily modify, then restore: `.claude/launch.json`

- [ ] **Step 1: Free the preview port**

Port 3000 is held by Docker. Add `"autoPort": true` to the `dev` entry in `.claude/launch.json`. The file is tracked, so it must be restored in Step 5.

- [ ] **Step 2: Start the dev server and open the shell**

Start the `dev` preview and open `/scopecraft`. Sign in if the session has lapsed, so `UserMenu` actually renders — signed out it returns `null` and half this task's surface will not exist.

- [ ] **Step 3: Check the four combinations**

For each of light/dark × en/ar, confirm:

1. The header bar has a visible hairline at its base and no blur halo.
2. The `SC` mark reads at 2rem square with legible contrast against `--c-accent`.
3. The **Live** badge shows a recessed pill with a hairline and an accent dot; in `ar` the label reads `مباشر` with its letters **joined**, not spaced apart.
4. The reset and sign-out buttons measure **44px** tall (`getBoundingClientRect().height` ≈ 44).
5. In `ar`, the bar mirrors: `leftGroup` sits at the inline-start (visually right) and `actions` at the inline-end. Nothing is clipped and the page does not scroll sideways.
6. Tab once from a fresh load: focus lands on the skip link, and it is visible.

- [ ] **Step 4: Check the 30rem breakpoint in both directions**

Resize to 375px wide and confirm the Live badge and the user name are **both absent**, and the sign-out button is still present and still 44px. Resize to 600px and confirm both reappear. Repeat in `ar`.

- [ ] **Step 5: Restore the tracked files**

```bash
git checkout -- .claude/launch.json next-env.d.ts
git status --short   # expect empty
```

- [ ] **Step 6: Record the result**

Tick D1 in `docs/upgrade-checklist.md` **only if every check above passed.** If any failed, do not tick it — open the failure as the next piece of work and say so plainly.

```bash
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit docs/upgrade-checklist.md -m 'docs: close D1'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```

---

## Exit conditions

D1 is done when all of these are true:

- [ ] `grep -c '\-\-sc-' src/components/common/Header.module.css` returns `0`
- [ ] `grep -c 'max-width' src/components/common/Header.module.css` returns `0`
- [ ] `grep -rn 'resetButton' src` returns nothing
- [ ] `PRE_REBUILD_EXEMPT` has 3 entries and its length assertion says `3`
- [ ] All four gates pass
- [ ] The header verified in a browser in light+dark and en+ar, including the 30rem behaviour
- [ ] `git status --short` is empty — `.claude/launch.json` and `next-env.d.ts` restored

**Not** an exit condition: `grep -r "--sc-" src` returning zero. That is Module D's overall exit condition and will still return roughly 307 after D1.
