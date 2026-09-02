# D2 — Intake Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the intake form onto the new design tokens and the `Field`/`Button` primitives, and take `InputForm.module.css` off the breakpoint audit's exemption list.

**Architecture:** Six tasks, in dependency order. The first two close gaps Module C left — the token set has no error colour, and `Field` cannot express this form's accessibility wiring — because D2 is the first point where either becomes visible. The next two adopt those primitives in the component; the fifth rewrites the stylesheet; the sixth verifies in a browser, which is where Module C's real bugs were found.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS Modules, Jest + Testing Library (jsdom).

## Global Constraints

Every task's requirements implicitly include this section.

- Commits authored **`Yousef mohmed hasabo <yousefhasabo94@gmail.com>`**. Use `git -c user.name=... -c user.email=... commit`.
- **Never add a `Co-Authored-By` trailer.** Verify after every commit: `git log -1 --format=%B | grep -i co-authored` must print nothing.
- No mention of Claude, Anthropic, or any model name in commit messages, code comments, or user-facing text.
- **All four gates pass before every commit:** `npm run typecheck && npm run lint && npm test && npm run build`. A commit that breaks any gate does not get made.
- Run `git checkout -- next-env.d.ts` after `npm run build` — it flips between dev and build variants.
- **Logical CSS properties, not physical.** `inline-size` not `width`; `min-block-size` not `min-height`; `padding-block`/`padding-inline` not shorthand `padding`; `border-inline-start` not `border-left`.
- **Breakpoints:** only `30rem`, `48rem`, `64rem`, `80rem`, and **`min-width` only**. Phone is the base case.
- **Theming:** colours on `:root`, redefined on `:root.dark`. Never a bare media query.
- **Bilingual:** every user-facing string needs both an `en` and an `ar` entry in `src/lib/i18n/translations.ts`. The type system enforces it.
- **WCAG 2.2 AA.** Every interactive control keeps an accessible name.
- **No new dependencies.**
- **jsdom has no computed style.** `*.module.css` maps via `identity-obj-proxy`, so `styles.foo === "foo"`. Never assert colours, spacing, or media-query behaviour in a unit test. Assert roles, names, attributes, class identity, and behaviour.
- Comments explain **why**, never what. Match the surrounding file's density and voice.
- Baseline before this plan: **383 tests, 20 suites**, all passing.

---

## File Structure

| File | Change | Responsibility after D2 |
|---|---|---|
| `src/lib/design/tokens.ts` | Modify | Gains `danger` + `dangerSurface` colour roles. |
| `tests/evaluation/design-tokens.test.ts` | Modify | Asserts the two new roles clear AA in both themes. |
| `src/components/ui/Field.tsx` | Modify | Gains `required`, `errorId` wiring, and extra `describedBy` ids. |
| `src/components/ui/Field.module.css` | Modify | Error text gains `--c-danger` as reinforcement. |
| `tests/ui/primitives/Field.test.tsx` | Modify | Covers the three new behaviours. |
| `src/components/scopecraft/InputForm.tsx` | Modify | Four fields delegate label/hint/error wiring to `Field`; actions use `Button`. |
| `src/components/scopecraft/InputForm.module.css` | Rewrite | Zero `--sc-*`, zero `max-width`, no button or label styling. |
| `tests/evaluation/breakpoint-audit.test.ts` | Modify | Exemption list 3 → 2. |

**Out of scope for D2** (do not do these here):
- The global `box-sizing: border-box` reset — the owner ruled it a separate point *after* D2. `.control`'s local declaration at `InputForm.module.css:67` **stays**, with its comment.
- `ToggleControls.module.css` — its own exemption entry, and the header-row height mismatch recorded in `decision-log.md` entry 31 stays open.
- The nested live region in `Toast.tsx` — carried-forward item 1.
- Deleting the `--sc-*` block from `layout.tsx` — still ~270 references after D2.
- Known issue #3 (hydration #418) — owner's decision.

---

## Decisions taken (owner-approved 2026-09-02)

1. **Add `danger` and `dangerSurface` colour roles.** The ten roles carry no error colour, and the spec never discusses status colours — it calls the colour layer "sound" and frames the gap as the missing scales, so the omission is an oversight, not a decision. Two roles, not four: the capacity ring's other two states do not need new colours (decision 4).
2. **Extend `Field` rather than work around it.** It has no consumer today outside its own test, and this form's wiring is strictly richer. Adopting it unchanged would silently drop the character counter out of `aria-describedby` — undoing a decision `InputForm.tsx:16-19` makes deliberately for screen-reader users, with every existing test still passing.
3. **`danger` is reinforcement, not the signal.** `Field.module.css`'s header comment states the error text is deliberately not red-only, because colour alone fails WCAG 1.4.1. That stays true: the weight and the `border-inline-start` rule remain, and `--c-danger` is added on top. Do not remove either.
4. **The capacity ring needs no `warning` or `success` role.** It is `aria-hidden` (`InputForm.tsx:172`) with the number input as the accessible source of truth. Only "over capacity" is a fault: `.ringOver` takes `--c-danger`, `.ringOk` takes `--c-accent`, and `.ringShort` takes `--c-text-faint` — under-filled is simply not-yet-full, not a warning.
5. **`--sc-shadow` is deleted, not mapped.** `tokens.ts:99-103` states there is deliberately no elevation scale. `.preset:hover` already changes `border-color`, which is the direction's way of expressing the same thing.
6. **The `34rem` preset breakpoint moves to `48rem`.** `34rem` is not on the approved scale, so it fails the audit on value as well as direction. Three preset cards side by side need tablet width, not 30rem (480px).

---

### Task 1: Add the `danger` and `dangerSurface` colour roles

**Files:**
- Modify: `src/lib/design/tokens.ts:16-26` (the `ColorRole` union) and `:42-65` (both theme maps)
- Test: `tests/evaluation/design-tokens.test.ts`

**Interfaces:**
- Produces: two new `ColorRole` members, `"danger"` and `"dangerSurface"`. `src/lib/design/css.ts` emits them automatically as `--c-danger` and `--c-danger-surface` via `Object.entries` + its `kebab()` helper — **do not edit `css.ts`**. Later tasks consume both custom properties.
- `DesignTokens.color` is `Record<"light" | "dark", Record<ColorRole, string>>`, so adding a role to the union makes TypeScript require it in **both** themes. That is the safety net; do not weaken the type to avoid it.

- [ ] **Step 1: Write the failing contrast assertions**

Append these inside the existing `describe("design tokens meet WCAG 2.2 AA", ...)` block in `tests/evaluation/design-tokens.test.ts`, after the `text on the accent fill` case:

```ts
  // The error role is reinforcement for a message that already carries the
  // fault in words — but reinforcement nobody can read is not reinforcement,
  // so it takes the same 4.5:1 floor as body text.
  it.each(themes)("%s: danger text on ground clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.danger, t.ground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("%s: danger text on a panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.danger, t.panel)).toBeGreaterThanOrEqual(4.5);
  });

  // The error banner puts danger text on the danger surface. That pair is the
  // one a reader actually meets, and it is the one most easily got wrong by
  // picking a tint that looks right beside the text rather than under it.
  it.each(themes)("%s: danger text on the danger surface clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.danger, t.dangerSurface)).toBeGreaterThanOrEqual(4.5);
  });
```

- [ ] **Step 2: Run it and confirm it fails to compile**

Run: `npx jest tests/evaluation/design-tokens.test.ts`
Expected: **FAIL**. `ts-jest` reports that `danger` and `dangerSurface` do not exist on the token type. That is the intended red — the type is what proves the role is genuinely absent.

- [ ] **Step 3: Add the roles**

In `src/lib/design/tokens.ts`, extend the union:

```ts
export type ColorRole =
  | "ground"
  | "panel"
  | "panelRecessed"
  | "rule"
  | "ruleStrong"
  | "text"
  | "textMuted"
  | "textFaint"
  | "accent"
  | "accentContrast"
  | "danger"
  | "dangerSurface";
```

Add to the `light` map, after `accentContrast`:

```ts
      // Not in the original ten. The spec never discussed status colour, and
      // the omission only became visible at D2, where a validation form needs
      // to say "this is wrong" — see docs/decision-log.md entry 32.
      danger: "#b91c1c",
      dangerSurface: "#fef2f2",
```

And to the `dark` map, after `accentContrast`:

```ts
      danger: "#fca5a5",
      dangerSurface: "#2a1416",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/evaluation/design-tokens.test.ts`
Expected: **PASS**, with 6 new cases (3 assertions × 2 themes).

Then confirm the generated CSS carries them, since `css.ts` was not edited:

```bash
npx tsx -e "import{tokenCss}from'./src/lib/design/css';const c=tokenCss();console.log(['--c-danger:','--c-danger-surface:'].map(k=>k+' '+(c.includes(k)?'present':'MISSING')).join('\n'))"
```
Expected: both `present`.

- [ ] **Step 5: Record the decision**

Append this to `docs/decision-log.md`, matching entry 31's numbered-list format (4-space continuation indents):

```markdown
32. **The token set gained an error colour it never had — 2026-09-02, Module D2.**
    The ten roles approved in Module C carry no way to say "this is wrong".
    That went unnoticed because nothing had used them yet; D2 put a
    validation-heavy form in front of them and the hole was immediate — the
    intake form referenced `--sc-danger` eight times.

    **This fills a gap rather than reversing a decision.** The spec never
    discusses status colour at all: it calls the existing colour layer "sound"
    and frames the real gap as the missing spacing, type, radius and motion
    scales. The omission was an oversight of the reduction from ~30 legacy
    properties down to ten structural roles, not a considered exclusion — unlike
    the shadow scale, which `tokens.ts` explicitly argues against.

    **Two roles, not four.** `warning` and `success` were not added. The only
    place they were used is the capacity ring, which is `aria-hidden` with the
    number input as its accessible source of truth, and only over-capacity is
    actually a fault: the ring's "ok" state takes `--c-accent` and its "short"
    state takes `--c-text-faint`, because under-filled is not-yet-full rather
    than wrong.

    **Colour stays reinforcement, not the signal.** `Field.module.css` says the
    error text is deliberately not red-only, because colour alone fails WCAG
    1.4.1 and the message is what carries the fault. That is unchanged: the
    error keeps its weight and its `border-inline-start` rule, and `--c-danger`
    is added on top of both. Every new pair is asserted against the 4.5:1 floor
    in `tests/evaluation/design-tokens.test.ts`, including danger-on-danger-
    surface, which is the pair a reader actually meets in the error banner.
```

- [ ] **Step 6: Run all four gates, then commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/lib/design/tokens.ts tests/evaluation/design-tokens.test.ts docs/decision-log.md \
  -m 'feat(design): add the danger colour role the token set was missing

The ten roles had no way to say "this is wrong", which went unnoticed until D2
put a validation form in front of them. The spec never discussed status colour
at all, so this fills a gap rather than reversing a decision.

Two roles, not four: the capacity ring is aria-hidden with the number input as
its accessible source, and only over-capacity is a fault, so short and ok reuse
existing roles. Colour stays reinforcement - the error message carries the fault
in words, and Field keeps the weight and rule that do that job.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```
Expected test count: **389** (383 + 6).

---

### Task 2: Extend `Field` to carry this form's wiring

Three gaps, each of which would otherwise force a call site back to hand-wiring: no required marker, no `aria-errormessage`, and no way to add ids (the character counter) to `aria-describedby`.

**Files:**
- Modify: `src/components/ui/Field.tsx`
- Modify: `src/components/ui/Field.module.css`
- Test: `tests/ui/primitives/Field.test.tsx`

**Interfaces:**
- Consumes: `--c-danger` from Task 1.
- Produces — the extended props. Later tasks call `Field` with exactly these:

```ts
export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** The translated "(required)" text. Present means required — the caller
   *  supplies it already translated, exactly as it does label/hint/error. */
  requiredLabel?: string;
  /** Extra element ids to append to aria-describedby, e.g. a character counter. */
  describedBy?: string[];
  children: ReactElement<FieldControlProps>;
}

export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-errormessage"?: string;
  "aria-required"?: true;
}
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui/primitives/Field.test.tsx`:

```tsx
  it("marks a required field for both sighted and screen-reader users", () => {
    render(
      <Field id="idea" label="Idea" requiredLabel="(required)">
        <textarea defaultValue="" />
      </Field>
    );

    const control = screen.getByLabelText(/idea/i);
    expect(control).toHaveAttribute("aria-required", "true");
    // The glyph is decorative; the word is what a screen reader reads — and it
    // comes from the caller, so the Arabic page gets the Arabic word.
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });

  it("points aria-errormessage at the error it renders", () => {
    render(
      <Field id="idea" label="Idea" error="Too short">
        <textarea defaultValue="" />
      </Field>
    );

    const control = screen.getByLabelText(/idea/i);
    expect(control).toHaveAttribute("aria-errormessage", "idea-error");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Too short")).toHaveAttribute("id", "idea-error");
  });

  it("appends extra described-by ids after its own", () => {
    render(
      <Field id="idea" label="Idea" hint="Describe it" describedBy={["idea-counter"]}>
        <textarea defaultValue="" />
      </Field>
    );

    // Order is the reading order: what to enter, then what went wrong, then
    // the running count.
    expect(screen.getByLabelText(/idea/i)).toHaveAttribute(
      "aria-describedby",
      "idea-hint idea-counter"
    );
  });

  it("omits aria-required and aria-errormessage when they do not apply", () => {
    render(
      <Field id="idea" label="Idea">
        <textarea defaultValue="" />
      </Field>
    );

    const control = screen.getByLabelText(/idea/i);
    expect(control).not.toHaveAttribute("aria-required");
    expect(control).not.toHaveAttribute("aria-errormessage");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest tests/ui/primitives/Field.test.tsx`
Expected: **4 failing** — `required` and `describedBy` are not props yet, and no `aria-errormessage` or `aria-required` is emitted.

- [ ] **Step 3: Extend the component**

Replace the `FieldControlProps`/`FieldProps` interfaces and the `Field` function body in `src/components/ui/Field.tsx` with:

```tsx
/** The subset of props this primitive injects into its child control. */
export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-errormessage"?: string;
  "aria-required"?: true;
}

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** The translated "(required)" text. Present means required. This primitive
   *  never holds a user-facing string of its own: every one is passed in
   *  already translated, because an English word baked in here would be an
   *  English word on the Arabic page that the i18n types cannot catch. */
  requiredLabel?: string;
  /** Extra element ids to append to aria-describedby — a character counter, a
   *  running total, anything the control is described by but does not own. */
  describedBy?: string[];
  children: ReactElement<FieldControlProps>;
}

export function Field({
  id,
  label,
  hint,
  error,
  requiredLabel,
  describedBy,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Order matters to a screen reader: the hint describes what to enter, the
  // error says what went wrong with what was entered, and anything the caller
  // appends is supplementary to both.
  const describedByValue =
    [hintId, errorId, ...(describedBy ?? [])].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {requiredLabel ? (
          <>
            {/* The glyph is decoration. Screen readers get the word, because
                "asterisk" is not a requirement and punctuation is skipped by
                some verbosity settings entirely. */}
            <span className={styles.requiredMark} aria-hidden="true">
              {" *"}
            </span>
            <span className={styles.srOnly}>{requiredLabel}</span>
          </>
        ) : null}
      </label>

      {cloneElement(children, {
        id,
        "aria-describedby": describedByValue,
        // Never `false`. aria-invalid="false" is announced by some assistive
        // tech, and an empty field is not an invalid one.
        "aria-invalid": error ? true : undefined,
        // aria-errormessage is only meaningful while aria-invalid is true, so
        // the two are set together or not at all.
        "aria-errormessage": errorId,
        "aria-required": requiredLabel ? true : undefined,
      })}

      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Add the two new classes**

Append to `src/components/ui/Field.module.css`, and change `.error`'s colour to the new role — keeping the weight and the rule, which are what actually carry the fault:

```css
.requiredMark {
  color: var(--c-danger);
  margin-inline-start: var(--space-1);
}

/* Visually hidden, still read. Not display:none, which removes it from the
   accessibility tree along with the screen. */
.srOnly {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

Then in the existing `.error` rule, replace `color: var(--c-text);` with `color: var(--c-danger);` and leave `border-inline-start` and `font-weight` untouched. Update the file's header comment so it still describes what the file does: the error is now red *and* weighted *and* ruled, and the message is still what carries the fault.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/ui/primitives/Field.test.tsx`
Expected: **PASS**, including every pre-existing case unchanged.

- [ ] **Step 6: Run all four gates, then commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/components/ui/Field.tsx src/components/ui/Field.module.css tests/ui/primitives/Field.test.tsx \
  -m 'feat(ui): Field carries required, errormessage and extra describedby

Field had no consumer outside its own test, and the first real one - the intake
form - needs three things it could not express: a required marker, an
aria-errormessage pointing at the error it already renders, and a way to append
the character counter to aria-describedby.

That last one is why this is not optional. Adopting Field unchanged would have
dropped the counter out of the description, undoing a decision the form makes
deliberately for screen-reader users, and every existing test would still have
passed.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```
Expected test count: **393** (389 + 4).

---

### Task 3: Adopt `Field` for all four form fields

**Files:**
- Modify: `src/components/scopecraft/InputForm.tsx` — the four field blocks at roughly `:357-411` (idea), `:411-455` (constraints), `:457-513` (capacity), `:514-551` (sprint length)
- Test: `tests/ui/InputForm.test.tsx`

**Interfaces:**
- Consumes: `Field` with the Task 2 props. Import as `import { Field } from "@/components/ui/Field";`.
- The component's `id()` helper (built on `useId`) already namespaces every id. `Field` derives `${id}-hint` and `${id}-error` itself, so the call site passes `id={id("idea")}` and stops constructing those two ids by hand — but still constructs the **counter** id, because `Field` does not own it.

**Preserve exactly — these are documented decisions in `InputForm.tsx:15-28`:**
- Counters are **not** `aria-live`; they reach the user through `aria-describedby`. Pass the counter id via `describedBy`.
- Errors appear on blur or submit, never on first keystroke. Do not change when `showError()` returns true.
- The capacity slider and number input are **one** control: the slider keeps `aria-hidden="true"` and `tabIndex={-1}`, and only the number input is wrapped by `Field`.
- The submit-time error summary keeps focus (`errorBanner`, `role="alert"`). Do not move it inside a `Field`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui/InputForm.test.tsx`, inside its top-level `describe`:

```tsx
  it("keeps the character counter in the idea field's description", () => {
    setup();

    const idea = screen.getByLabelText(/product idea/i);
    const describedBy = (idea.getAttribute("aria-describedby") ?? "").split(" ");
    const counter = describedBy.map((x) => document.getElementById(x)).find(Boolean);

    // The counter must be reachable by description, not announced live — see
    // the decision recorded at the top of InputForm.tsx.
    expect(describedBy.length).toBeGreaterThanOrEqual(2);
    expect(counter).not.toBeNull();
    expect(
      describedBy.some((x) => document.getElementById(x)?.textContent?.match(/\d+\s*\/\s*\d+/))
    ).toBe(true);
  });

  it("marks the idea field required through the primitive", () => {
    setup();

    expect(screen.getByLabelText(/product idea/i)).toHaveAttribute("aria-required", "true");
  });

  it("gives every field a label that is attached, not merely adjacent", () => {
    setup();

    // getByLabelText resolves through htmlFor/id, so it fails on a label that
    // only looks attached.
    for (const re of [/product idea/i, /constraints/i, /capacity/i, /sprint length/i]) {
      expect(screen.getByLabelText(re)).toBeInTheDocument();
    }
  });
```

The file's fixture is `setup(props)` at `tests/ui/InputForm.test.tsx:24`, which renders the form and returns `{ onSubmit, user }`. There is also a `fields()` helper that resolves the four controls by label. Use both rather than adding a fixture.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest tests/ui/InputForm.test.tsx -t "required through the primitive"`
Expected: **FAIL** — the form emits no `aria-required` today.

Note: the counter and label tests may already pass against the hand-wired markup. That is fine and expected — they are regression guards for this task, proving the migration does not lose what exists. Record in the report which of the three were red and which were already green.

- [ ] **Step 3: Migrate the idea field**

Replace the block currently at `:357-410` (the `<div className={styles.field}>` wrapping the idea textarea, its label, hint and error) with a `Field` call. The textarea keeps its own `value`, `onChange`, `onBlur`, `maxLength`, `rows`, `placeholder` and `className`; it loses `id`, `aria-describedby`, `aria-invalid`, `aria-errormessage` and `aria-required`, all of which `Field` now injects:

```tsx
      <Field
        id={id("idea")}
        label={t("form.idea.label")}
        hint={t("form.idea.hint")}
        requiredLabel={t("form.idea.required")}
        error={showError("idea")}
        describedBy={[id("idea-counter")]}
      >
        <textarea
          className={`${styles.control} ${styles.textarea}`}
          value={values.idea}
          onChange={(e) => update("idea", e.target.value)}
          onBlur={() => handleBlur("idea")}
          rows={6}
          maxLength={MAX_IDEA_LENGTH}
          placeholder={t("form.idea.placeholder")}
        />
      </Field>
```

`showError(name)` returns `string | undefined` already (`InputForm.tsx:241`) — it is not a boolean predicate, so it feeds `error` directly. The state helpers are `update(name, value)` and `handleBlur(name)`. Read the existing textarea before replacing it and carry over every prop it actually has; keep the counter markup exactly where it is, since `Field` does not render it.

- [ ] **Step 4: Migrate the remaining three fields the same way**

`constraints` — same shape, no `required`, `describedBy={[id("constraints-counter")]}`.
`team_capacity_points` — wraps **only** the number input. The slider, the SVG ring and the `capacityRow` wrapper stay outside `Field`, and the slider keeps `aria-hidden="true"` and `tabIndex={-1}`.
`sprint_length_days` — simplest: no counter, so no `describedBy`.

- [ ] **Step 5: Run the full UI suite**

Run: `npx jest tests/ui/`
Expected: **PASS**, including all 41 pre-existing `InputForm.test.tsx` cases and the cases in `Amenities.test.tsx`, `ThemeAndLocale.test.tsx` and `StateTransitions.test.tsx` that render this form. Do not edit any pre-existing test to make this pass — if one fails, the migration changed behaviour and the migration is what to fix.

- [ ] **Step 6: Run all four gates, then commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/components/scopecraft/InputForm.tsx tests/ui/InputForm.test.tsx \
  -m 'feat(ui): the intake form delegates its label wiring to Field

Four fields were each hand-wiring label, hint, error, describedby and invalid
state. That is the bug Field exists to remove: wiring repeated per call site is
wiring that drifts, and a label that is near a control instead of attached to it
looks right and is invisible.

The character counter still reaches the user by description rather than by live
region, which is the decision recorded at the top of this file and the reason
Field grew a describedBy prop rather than the form giving the counter up.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```

---

### Task 4: The form's actions use the `Button` primitive

**Files:**
- Modify: `src/components/scopecraft/InputForm.tsx:553-572` (the `.actions` block)
- Modify: `src/components/scopecraft/InputForm.module.css` — delete `.button`, `.secondaryButton` and their state rules
- Test: `tests/ui/InputForm.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/Button` — `variant?: "primary" | "secondary" | "quiet"`, `type?: "button" | "submit"`, `busy?: boolean`. Unlisted props pass through via `...rest`. Applies `styles.button` plus `styles[variant]`, and `min-block-size: 2.75rem`.

> **BLOCKING — settle before implementing this task.** The submit button today
> carries **both** `disabled={isLoading}` and `aria-busy={isLoading}`
> (`InputForm.tsx:554-558`). Moving it to `busy` alone is the `Button`
> primitive's central documented decision — `Button.tsx:10-15` says a disabled
> control leaves the tab order mid-request and tells a screen-reader user
> nothing, "which matters here more than in most apps, because a generation can
> take the better part of a minute". That comment describes *this* form.
>
> But two existing tests assert the old behaviour and will fail:
> `tests/ui/InputForm.test.tsx:341` and `tests/ui/StateTransitions.test.tsx:173`,
> both `expect(...).toBeDisabled()`. This plan otherwise forbids editing
> pre-existing tests, so the two rules collide here and the owner has ruled:
> **switch to `busy` and update those two assertions**, because they encode the
> behaviour this task exists to change, and updating them is not weakening them.
> Change each to assert `aria-busy="true"` and `not.toBeDisabled()`. Do not
> touch `InputForm.test.tsx:344`, which asserts the *inputs* are disabled —
> that stays true and is a different control.

**The preset buttons are NOT migrated.** `.preset` is a three-line card (label, description, meta) with its own layout, not a label in a box. Wrapping it in `Button` would mean overriding most of the primitive's styling, which is the signal that it is the wrong primitive. It keeps its own class and is migrated to the new tokens in Task 5.

- [ ] **Step 1: Write the failing test**

```tsx
  it("builds the submit action from the Button primitive and keeps busy separate from disabled", async () => {
    setup({ isLoading: true });

    const submit = screen.getByRole("button", { name: /generating plan/i });
    expect(submit).toHaveClass("button");
    expect(submit).toHaveAttribute("type", "submit");
    // busy, not disabled: a disabled control leaves the tab order mid-request
    // and tells a screen-reader user nothing about why.
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit).not.toBeDisabled();
  });
```

The accessible name is "Generate plan" idle and "Generating plan…" while loading (`translations.ts:88-89`), so under `isLoading` the matcher is `/generating plan/i` — the same one `StateTransitions.test.tsx:173` already uses.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/ui/InputForm.test.tsx -t "Button primitive"`
Expected: **FAIL** on `toHaveClass("button")` — the control currently wears `styles.button` from `InputForm.module.css`, which `identity-obj-proxy` also maps to `"button"`. **If it passes for that reason, tighten the assertion** to something that distinguishes the two, e.g. asserting the primitive's variant class `toHaveClass("primary")`, and say so in the report.

- [ ] **Step 3: Swap both actions**

```tsx
      <div className={styles.actions}>
        <Button type="submit" busy={isLoading}>
          {isLoading ? t("form.submit.loading") : t("form.submit")}
        </Button>
        <Button variant="secondary" onClick={handleReset} disabled={isLoading}>
          {t("form.clear")}
        </Button>
      </div>
```

The keys are `form.submit`, `form.submit.loading` and `form.clear`; the reset handler is `handleReset`. Note the submit button loses `disabled={isLoading}` — see the blocking note below, which must be settled before this step runs.

- [ ] **Step 4: Delete the dead rules**

Remove `.button`, `.secondaryButton` and every `:hover`/`:focus-visible`/`:disabled` rule belonging to them from `src/components/scopecraft/InputForm.module.css`.

Confirm: `grep -nE '^\.(button|secondaryButton)' src/components/scopecraft/InputForm.module.css` prints nothing, and `grep -n 'styles.button\|styles.secondaryButton' src/components/scopecraft/InputForm.tsx` prints nothing.

- [ ] **Step 5: Run the gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/components/scopecraft/InputForm.tsx src/components/scopecraft/InputForm.module.css tests/ui/InputForm.test.tsx \
  -m 'feat(ui): form actions come from the Button primitive

Submit and reset were two more bespoke buttons. Both are now the primitive,
which deletes their rules rather than migrating them to the new tokens.

The preset cards are deliberately left alone: a three-line card with a label, a
description and a meta line is not a label in a box, and dressing it as one
would mean overriding most of what the primitive does.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```

---

### Task 5: `InputForm.module.css` onto the new tokens, phone-first, off the exemption list

**Files:**
- Rewrite: `src/components/scopecraft/InputForm.module.css`
- Modify: `tests/evaluation/breakpoint-audit.test.ts:49-53` and its length assertion

- [ ] **Step 1: Remove the exemption to make the audit fail**

In `tests/evaluation/breakpoint-audit.test.ts`, drop the `InputForm.module.css` entry so the list reads:

```ts
const PRE_REBUILD_EXEMPT = [
  "src/components/common/ToggleControls.module.css",
  "src/components/scopecraft/InteractiveSprintBoard.module.css",
];
```

And update the assertion and comment:

```ts
  it("the pre-rebuild exemption list has not grown", () => {
    // Measured at 4 on 2026-09-02. Header came off in D1, InputForm in D2.
    // Module D shrinks this to zero.
    expect(PRE_REBUILD_EXEMPT).toHaveLength(2);
  });
```

- [ ] **Step 2: Run the audit to verify it fails**

Run: `npx jest tests/evaluation/breakpoint-audit.test.ts`
Expected: **FAIL** on `src/components/scopecraft/InputForm.module.css`, twice over: `34rem` is not in `APPROVED_MIN_WIDTHS`, and both queries are `max` where `min` is required.

- [ ] **Step 3: Apply the token mapping**

Replace every legacy custom property in the file per this table. It is exhaustive — 37 references, every one accounted for.

| Legacy | New | Note |
|---|---|---|
| `--sc-text` | `--c-text` | |
| `--sc-text-muted` | `--c-text-muted` | |
| `--sc-border` | `--c-rule` | |
| `--sc-border-strong` | `--c-rule-strong` | |
| `--sc-accent` | `--c-accent` | |
| `--sc-accent-contrast` | `--c-accent-contrast` | |
| `--sc-surface` | `--c-panel` | `.control` background |
| `--sc-surface-subtle` | `--c-panel-recessed` | `.control:disabled`, `.preset` |
| `--sc-accent-subtle` | `--c-panel-recessed` | `.presetMeta` — there is no subtle-accent role; the meta reads by its `--c-accent` text |
| `--sc-danger` | `--c-danger` | from Task 1 |
| `--sc-danger-surface` | `--c-danger-surface` | from Task 1 |
| `--sc-warning` (`.ringShort .ringFill`) | `--c-text-faint` | under-filled is not-yet-full, not a fault — decision 4 |
| `--sc-success` (`.ringOk .ringFill`) | `--c-accent` | decision 4 |
| `--sc-shadow` (`.preset:hover`) | **delete the declaration** | no elevation scale by design — decision 5 |

Also, in the same pass:
- Replace every hard-coded length with the nearest scale token: `--space-*` for gap/padding/margin, `--text-*` for `font-size`, `--radius-*` for `border-radius` (`0.5rem` and `0.625rem` both become `--radius-md`), `--motion-fast`/`--motion-ease` for the `140ms ease` transitions and `--motion-base` for the `160ms` ring transition.
- Convert physical properties to logical: `width: 100%` → `inline-size: 100%`, `min-height` → `min-block-size`, two-value `padding` shorthands → `padding-block` + `padding-inline`.
- **Keep `.control`'s `box-sizing: border-box` and its comment verbatim.** The global reset is a separate point; removing this locally would reintroduce the horizontal-scrollbar bug the comment describes.
- Remove `transform` from `.preset`'s `transition` list if the `box-shadow` deletion leaves it transitioning a property nothing changes.

- [ ] **Step 4: Invert both media queries**

Delete both `max-width` blocks and make their narrow state the base case.

`.presetRow` becomes single-column by default, with the three-up grid arriving at tablet:

```css
.presetRow {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

/* Three preset cards side by side need tablet width. The 34rem this replaces
   was not on the approved scale, so it failed the audit on its number as well
   as its direction. */
@media (min-width: 48rem) {
  .presetRow {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

`.numberRow` the same, at the phone breakpoint:

```css
.numberRow {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

/* The two number fields stop fighting for width below this. */
@media (min-width: 30rem) {
  .numberRow {
    grid-template-columns: 1fr 1fr;
  }
}
```

Leave `@media (prefers-reduced-motion: reduce)` exactly as it is — the audit only inspects width conditions.

- [ ] **Step 5: Run the audit and confirm the file is clean**

```bash
npx jest tests/evaluation/breakpoint-audit.test.ts
grep -c '\-\-sc-' src/components/scopecraft/InputForm.module.css          # expect 0
grep -cE '@media[^{]*max-width' src/components/scopecraft/InputForm.module.css  # expect 0
grep -c 'box-sizing' src/components/scopecraft/InputForm.module.css       # expect 1
```
Expected: audit **PASS**; 0, 0, 1.

Note the `--sc-` count is the authoritative check; a plain `grep -c 'max-width'` can match the word inside a comment, as it did in D1.

- [ ] **Step 6: Run the gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git checkout -- next-env.d.ts
git -c user.name='Yousef mohmed hasabo' -c user.email='yousefhasabo94@gmail.com' \
  commit src/components/scopecraft/InputForm.module.css tests/evaluation/breakpoint-audit.test.ts \
  -m 'feat(ui): intake form on the new tokens, phone-first

Thirty-seven legacy token references gone, and both max-width queries inverted.
The preset grid moves from 34rem to 48rem: 34rem was not on the approved scale,
so it failed the audit on its number as well as its direction, and three cards
side by side want tablet width rather than a large phone.

The exemption list drops from three entries to two. .control keeps its local
box-sizing and the comment explaining it - the global reset is its own point,
and dropping this one early brings back the horizontal scrollbar it describes.'
git log -1 --format=%B | grep -i co-authored && echo 'TRAILER PRESENT - amend it out' || echo 'clean'
```

---

### Task 6: Verify in a browser, both themes and both directions

jsdom cannot see layout, colour or media queries. Module C found two real bugs this way that a green suite did not catch.

**Files:** none committed except the checklist in Step 6.

- [ ] **Step 1: Start the app**

Port 3000 is usually held by Docker: `docker compose stop web` frees it, and keeps `localhost:3000` valid for the OAuth callback. Start the `dev` preview and sign in — `/scopecraft` redirects signed-out visitors, so the form is unreachable without a session. `.env.local` has `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.

- [ ] **Step 2: Check each field, light and dark**

1. Every label sits above its control and every hint below it, with no orphaned or doubled label text left over from the migration.
2. The required marker shows on the idea field only.
3. Both textareas and both number inputs are 44px or taller and share one border colour and radius.
4. The character counters still update as you type.

- [ ] **Step 3: Force the error states**

Submit empty. Then confirm:

1. The error banner takes focus, reads as an alert, and is legible — `--c-danger` on `--c-danger-surface`, in **both** themes.
2. Each failing field shows its message, and the message is red **and** weighted **and** ruled. Colour is reinforcement; check the other two are actually present.
3. `.control[aria-invalid="true"]` shows the danger border.
4. Drive the capacity number past its maximum and confirm the ring turns `--c-danger`; below the minimum, that it is faint rather than alarming.

- [ ] **Step 4: Check both breakpoints in both directions**

At 375px: presets stack one per row, the two number fields stack, and the page does not scroll sideways. At 480px: number fields pair up, presets still stacked. At 768px: presets go three-up. Repeat the whole sweep in Arabic and confirm the form mirrors, the counters sit on the correct side, and nothing clips.

- [ ] **Step 5: Restore**

```bash
git checkout -- next-env.d.ts
git status --short   # expect empty
```

- [ ] **Step 6: Record the result**

Tick D2 in `docs/upgrade-checklist.md` **only if every check above passed**, following the annotation style of the D1 entry: what was measured, and anything the point does not cover. If a check failed, do not tick it — say what failed and open it as the next piece of work.

---

## Exit conditions

- [ ] `grep -c '\-\-sc-' src/components/scopecraft/InputForm.module.css` returns `0`
- [ ] `grep -cE '@media[^{]*max-width' src/components/scopecraft/InputForm.module.css` returns `0`
- [ ] `grep -c 'box-sizing' src/components/scopecraft/InputForm.module.css` returns `1` — still local, still commented
- [ ] `PRE_REBUILD_EXEMPT` has 2 entries and its length assertion says `2`
- [ ] All four fields resolve through `getByLabelText`
- [ ] The idea field's `aria-describedby` still contains the counter id
- [ ] All four gates pass
- [ ] Verified in a browser in light+dark and en+ar, including both breakpoints and the error states
- [ ] `git status --short` is empty

**Not** an exit condition: `grep -r "--sc-" src` returning zero. Roughly 270 references remain after D2.
