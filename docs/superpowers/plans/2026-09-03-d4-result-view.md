# D4 — Result View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the result view — the peak moment of the product — onto the
`--c-*` design tokens, replacing four hue-coded MoSCoW badges and three
hue-coded risk levels with the `Chip` primitive's weight scale, and giving the
story cards a second column at `48rem`.

**Architecture:** Three layers, bottom-up. The primitives layer gains what D4
needs and Module C did not anticipate: a fourth `Chip` weight, because MoSCoW
has four buckets and `Chip` shipped with three; and three labelling props on
`Card`, because a story card is an `<article>` with an accessible name and a
test id, and `Card` forwards neither. The component layer then adopts those
primitives, which is what actually deletes the eight MoSCoW colour tokens, the
two `warning` tokens and the one `shadow` token from this file's dependencies.
The stylesheet layer migrates what is left to `--c-*`, phone-first.

**Tech Stack:** Next.js App Router, React client component, CSS Modules,
Jest + Testing Library (`ui` project, jsdom).

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
- **Logical CSS properties only.** `padding-inline` not `padding-left`,
  `margin-block` not `margin-top`, `text-align: start` not `left`,
  `min-block-size` not `min-height`. A physical `left: -9999px` once made every
  Arabic page scroll ~10000px sideways.
- **Bilingual.** Every new user-facing string needs both an `en` and an `ar`
  entry in `src/lib/i18n/translations.ts`. **This plan adds no new strings** —
  every label it renders already exists in both locales.
- **No new dependencies.** Nothing in this plan needs one.
- **Four gates before every commit:** `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run build`. A commit that breaks any gate does not get made.
- **`npm run capture:ui` is the fifth gate.** Task 5 runs it once for the whole
  point rather than per-task.
- **Approved token scales only.** Colours `--c-*`; spacing `--space-0..8`
  (0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4rem); type `--text-xs|sm|base|lg|xl|2xl`
  (0.6875, 0.8125, 0.9375, 1.125, 1.375, 1.75rem); radius
  `--radius-none|sm|md` (0, 2px, 4px); motion `--motion-fast|base|slow|ease`.
- **The twelve colour roles are closed.** `ground`, `panel`, `panelRecessed`,
  `rule`, `ruleStrong`, `text`, `textMuted`, `textFaint`, `accent`,
  `accentContrast`, `danger`, `dangerSurface`. There is deliberately no
  `success`, no `warning`, and no shadow scale. **Do not add a role.** This
  plan's whole reason for using `Chip` is that adding `warning` back would
  undo that decision.
- **Never hand-edit `src/lib/design/css.ts`.** It is generated from
  `tokens.ts`.
- **Approved breakpoints only:** `30rem`, `48rem`, `64rem`, `80rem`, and
  `min-width` only. `tests/evaluation/breakpoint-audit.test.ts` checks
  direction as well as value — a `max-width` query fails at an approved number.
- **Do not touch** `src/app/layout.tsx`'s `--sc-*` block. It is deleted in a
  later point, once `git grep -o 'var(--sc-' -- src | wc -l` returns 0.
  Use that exact pattern to count — a bare `--sc-` substring also matches the
  comment prose that describes the legacy block.
- **The `ui` Jest project is named `ui`, not `jsdom`.** `--selectProjects jsdom`
  silently matches nothing and exits 0.
- **`*.module.css` maps to `identity-obj-proxy`**, so `styles.foo === "foo"` and
  there is no computed style. Never assert a colour, a spacing value or a
  media-query behaviour in a unit test. Contrast is asserted in
  `tests/evaluation/design-tokens.test.ts` against `tokens.ts` instead.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/components/ui/Chip.tsx` | Modify | Add the fourth weight, `faint` |
| `src/components/ui/Chip.module.css` | Modify | `.faint` — dotted rule, faint text |
| `src/components/ui/Card.tsx` | Modify | Add `id`, `labelledBy`, `testId` |
| `tests/ui/primitives/Chip.test.tsx` | Modify | Cover the fourth weight |
| `tests/ui/primitives/Card.test.tsx` | Modify | Cover the three new props |
| `tests/evaluation/design-tokens.test.ts` | Modify | Assert `textFaint` on `panel` |
| `tests/ui/ResultView.test.tsx` | **Create** | The regression net D4 needs |
| `src/components/scopecraft/ResultView.tsx` | Modify | Adopt `Chip` and `Card` |
| `src/components/scopecraft/ResultView.module.css` | Modify | `--c-*`, phone-first, 2 columns |
| `docs/decision-log.md` | Modify | Entry 34 |
| `docs/upgrade-checklist.md` | Modify | Tick and write up D4 |

**Why a new test file rather than extending `StateTransitions.test.tsx`.**
That file drives the whole page through `fetch` to prove state *transitions*;
it touches the result view incidentally and its fixture has only two of the
four MoSCoW buckets (`must`, `wont`) and one of the three risk levels
(`medium`). D4 changes how all four buckets and all three levels render, so it
needs a fixture that contains all seven. Putting that in the transitions file
would slow every scenario in it for one scenario's benefit.

---

### Task 1: Primitives — the fourth Chip weight and Card's labelling props

Module C shipped `Chip` with three weights and `Card` with no way to name
itself. Both gaps only become visible at their first real consumer, which is
this point. This is the same shape as D2, which had to extend `Field` before it
could adopt it — see `docs/upgrade-checklist.md` D2, "closed rather than worked
around".

**Files:**
- Modify: `src/components/ui/Chip.tsx`
- Modify: `src/components/ui/Chip.module.css`
- Modify: `src/components/ui/Card.tsx`
- Test: `tests/ui/primitives/Chip.test.tsx`
- Test: `tests/ui/primitives/Card.test.tsx`
- Test: `tests/evaluation/design-tokens.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ChipProps.weight?: "solid" | "outline" | "dashed" | "faint"` (default
    `"outline"`).
  - `CardProps` gains `id?: string`, `labelledBy?: string`, `testId?: string`.
    Rendered as `id`, `aria-labelledby`, `data-testid`. **No `...rest` spread**
    — a spread would let `onClick` back in, which is the one thing `Card`
    exists to forbid.

- [ ] **Step 1: Write the failing Chip test**

Append inside the existing `describe("Chip", ...)` block in
`tests/ui/primitives/Chip.test.tsx`, and update the existing `it.each` list to
include the new weight:

```tsx
  it.each(["solid", "outline", "dashed", "faint"] as const)(
    "applies the %s weight class",
    (weight) => {
      const { container } = render(<Chip weight={weight}>bucket</Chip>);
      expect(container.firstElementChild).toHaveClass(weight);
    }
  );

  // WON'T is the fourth bucket and needed a fourth weight. It is dotted, not
  // a second dashed in a paler grey: --c-text-muted and --c-text-faint are
  // #5f5f5f and #767676 in light, which is not a distinction anyone can see.
  // The border STYLE carries the step, so it survives greyscale — the same
  // reason this component has no colour props at all.
  it("gives the fourth bucket its own weight, not a paler third", () => {
    const { container } = render(<Chip weight="faint">Won&apos;t</Chip>);
    expect(container.firstElementChild).toHaveClass("faint");
    expect(container.firstElementChild).not.toHaveClass("dashed");
    expect(screen.getByText("Won't")).toBeInTheDocument();
  });
```

Note the existing `it.each` at the top of that file must be **replaced**, not
duplicated — there can only be one `it.each` with that title.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx jest --selectProjects ui tests/ui/primitives/Chip.test.tsx
```

Expected: FAIL. The `faint` case of `it.each` fails on
`expect(element).toHaveClass("faint")` because `styles.faint` is `undefined`
under `identity-obj-proxy` until the class exists in the stylesheet, and
TypeScript rejects `weight="faint"` as not assignable.

- [ ] **Step 3: Add the weight to the component**

In `src/components/ui/Chip.tsx`, change the union and extend the header
comment. The header currently reads "MUST solid, SHOULD outline, COULD dashed"
— it must now describe four buckets or it documents a component that no longer
exists:

```tsx
// MoSCoW is encoded by fill weight, not hue: MUST solid, SHOULD outline,
// COULD dashed, WON'T dotted. This is a WCAG 1.4.1 obligation — the rejected
// direction used red and teal chips, which makes colour the information and
// leaves anyone who cannot distinguish them with nothing.
//
// The four weights are a border ramp, deliberately: solid fill, solid rule,
// dashed rule, dotted rule. Separating WON'T from COULD by colour alone would
// have meant --c-text-muted against --c-text-faint, a difference of about one
// notch of grey. Style is visible where a shade is not.
```

```tsx
export interface ChipProps {
  weight?: "solid" | "outline" | "dashed" | "faint";
  className?: string;
  children: ReactNode;
}
```

The body needs no change — `styles[weight]` already indexes by the prop.

- [ ] **Step 4: Add the class to the stylesheet**

In `src/components/ui/Chip.module.css`, after `.dashed`:

```css
/* WON'T. One step further back than COULD, by border style rather than by a
   paler grey — see the component header. */
.faint {
  background: transparent;
  color: var(--c-text-faint);
  border-color: var(--c-text-faint);
  border-style: dotted;
}
```

- [ ] **Step 5: Run the Chip test to verify it passes**

```bash
npx jest --selectProjects ui tests/ui/primitives/Chip.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Write the failing Card test**

Append inside the existing `describe("Card", ...)` block in
`tests/ui/primitives/Card.test.tsx`:

```tsx
  // A story card is an <article>. An article with no accessible name is an
  // unlabelled landmark-adjacent region, so the name has to be able to get in
  // — and the name lives on a heading that is already inside the card.
  it("names itself from an element inside it", () => {
    render(
      <Card as="article" labelledBy="story-US-1-heading" testId="story-card-US-1">
        <span id="story-US-1-heading">US-1</span>
      </Card>
    );
    const card = screen.getByTestId("story-card-US-1");
    expect(card.tagName).toBe("ARTICLE");
    expect(card).toHaveAttribute("aria-labelledby", "story-US-1-heading");
  });

  it("takes an id so something else can point at it", () => {
    const { container } = render(<Card id="panel-1">body</Card>);
    expect(container.firstElementChild).toHaveAttribute("id", "panel-1");
  });

  // The reason there is no {...rest} spread: it would carry onClick, and a
  // clickable div is exactly what this component's header refuses to be.
  it("emits no attribute for props that were not passed", () => {
    const { container } = render(<Card>body</Card>);
    const card = container.firstElementChild!;
    expect(card).not.toHaveAttribute("id");
    expect(card).not.toHaveAttribute("aria-labelledby");
    expect(card).not.toHaveAttribute("data-testid");
  });
```

- [ ] **Step 7: Run it and confirm it fails**

```bash
npx jest --selectProjects ui tests/ui/primitives/Card.test.tsx
```

Expected: FAIL — TypeScript rejects `labelledBy`, `testId` and `id` as not
existing on `CardProps`.

- [ ] **Step 8: Add the three props to Card**

In `src/components/ui/Card.tsx`, extend the interface and the element. Add to
the header comment, after the paragraph about `as`:

```tsx
// `id`, `labelledBy` and `testId` are spelled out one at a time rather than
// taken as a {...rest} spread. A spread is shorter and would also let through
// onClick, which is the single thing this component exists to refuse. Three
// named props are the cost of that guarantee.
```

```tsx
export interface CardProps {
  as?: "div" | "article" | "li";
  /** The deferred column's surface: a step back rather than forward. */
  recessed?: boolean;
  /** Dashed rule — content that is present but not committed to. */
  muted?: boolean;
  id?: string;
  /** id of the element that names this card, for `aria-labelledby`. */
  labelledBy?: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Element = "div",
  recessed = false,
  muted = false,
  id,
  labelledBy,
  testId,
  className,
  children,
}: CardProps) {
  return (
    <Element
      id={id}
      aria-labelledby={labelledBy}
      data-testid={testId}
      className={[
        styles.card,
        recessed ? styles.recessed : null,
        muted ? styles.muted : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Element>
  );
}
```

React omits an attribute whose value is `undefined`, which is what makes
Step 6's third test pass without a conditional-spread dance.

- [ ] **Step 9: Run the Card test to verify it passes**

```bash
npx jest --selectProjects ui tests/ui/primitives/Card.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Assert the contrast pair the fourth weight introduces**

The `faint` chip puts `--c-text-faint` on `--c-panel` — a role on a surface
that pair has never met before. `textFaint` is currently asserted at the 3:1
large-text floor on `ground` only. Measured, it clears the full 4.5:1 on
`panel` in both themes (4.54 light, 5.88 dark), so it is asserted at 4.5,
not 3 — asserting the weaker floor would let a future edit quietly degrade it.

Add to `tests/evaluation/design-tokens.test.ts`, inside
`describe("design tokens meet WCAG 2.2 AA", ...)`, after the existing
`faint text on ground` test:

```ts
  // The WON'T chip is faint text on a story card, not on the page ground.
  // It measures 4.54:1 light / 5.88:1 dark, so it is held to the full 4.5
  // rather than the 3:1 large-text floor it gets on ground — a bucket label
  // nobody can read is a bucket label that is not doing its job.
  it.each(themes)("%s: faint text on a panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.textFaint, t.panel)).toBeGreaterThanOrEqual(4.5);
  });
```

- [ ] **Step 11: Run the four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all pass. Test count rises by 5 (2 Chip + 3 Card) plus 2 from the
`it.each` contrast pair, and 1 more from the `faint` case joining the existing
Chip `it.each` — from 406 to 414. **Record the number the run actually
prints**; do not carry this estimate forward into any document.

- [ ] **Step 12: Commit**

```bash
git add src/components/ui/Chip.tsx src/components/ui/Chip.module.css \
        src/components/ui/Card.tsx tests/ui/primitives/Chip.test.tsx \
        tests/ui/primitives/Card.test.tsx tests/evaluation/design-tokens.test.ts
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): give Chip a fourth weight and Card a way to name itself

MoSCoW has four buckets and Chip shipped with three. The fourth is dotted
rather than a paler dashed, because muted and faint differ by one notch of
grey and border style survives greyscale.

Card gains id, labelledBy and testId as named props rather than a spread,
so a story card can be a named <article> without onClick getting in."
git log -1 --format=%B | grep -i co-authored
```

The `grep` must print nothing. If it prints a trailer, amend the commit.

---

### Task 2: The regression net

`ResultView.tsx` is 380 lines with no dedicated test. Everything protecting it
is incidental coverage in `StateTransitions.test.tsx`, which drives the page
through `fetch`. Tasks 3 and 4 rewrite most of its rendering. This task builds
the net first, against the **current** implementation, so that a behaviour lost
in the rebuild fails a test instead of shipping.

**Files:**
- Create: `tests/ui/ResultView.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 — these tests assert rendered text, roles and
  ARIA, none of which Task 1 changes.
- Produces: `FIXTURE`, a `ScopeCraftResponse` covering all four MoSCoW buckets
  and all three risk levels. Task 3 extends this file; it does not replace it.

- [ ] **Step 1: Write the test file**

```tsx
// tests/ui/ResultView.test.tsx
//
// The result view had no test of its own before D4 — everything covering it
// was incidental, in StateTransitions.test.tsx, which drives the whole page
// through fetch and whose fixture carries only two of the four MoSCoW buckets
// and one of the three risk levels.
//
// These tests were written against the pre-rebuild component and are the net
// D4 rebuilds inside: the APG tab contract, the eleven PRD sections, and the
// two tables. They assert text, roles and ARIA — never colour, spacing or
// breakpoints, none of which exist under identity-obj-proxy.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { ResultView } from "@/components/scopecraft/ResultView";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";

// All four buckets and all three levels, which is the whole reason this file
// does not reuse the transitions fixture.
const FIXTURE: ScopeCraftResponse = {
  problem: "Teams cannot turn a rough idea into a backlog.",
  target_user: "Student software teams",
  goals: ["Ship a usable PRD in under five minutes"],
  non_goals: ["Replace the Product Owner's judgement"],
  requirements: ["Generate a structured PRD from free text"],
  user_stories: [
    {
      id: "US-1",
      as_a: "student",
      i_want: "a structured backlog",
      so_that: "my team can start building",
      acceptance_criteria: ["The backlog contains at least one story"],
      points: 3,
      value: 5,
      risk: 5,
      dependencies: [],
    },
    {
      id: "US-2",
      as_a: "student",
      i_want: "to see my sprint capacity",
      so_that: "I don't overcommit",
      acceptance_criteria: ["The capacity meter reflects committed points"],
      points: 5,
      value: 2,
      risk: 1,
      dependencies: ["US-1"],
    },
    {
      id: "US-3",
      as_a: "tutor",
      i_want: "to export the plan",
      so_that: "I can mark it offline",
      acceptance_criteria: ["Export produces a file"],
      points: 2,
      value: 3,
      risk: 2,
      dependencies: [],
    },
    {
      id: "US-4",
      as_a: "student",
      i_want: "a dark theme",
      so_that: "late sessions hurt less",
      acceptance_criteria: ["The theme persists across reloads"],
      points: 1,
      value: 1,
      risk: 1,
      dependencies: [],
    },
  ],
  acceptance_criteria: ["Every story is testable"],
  risks: [
    { id: "R-1", description: "Scope may grow", impact: "high", likelihood: "medium" },
    { id: "R-2", description: "Provider may rate-limit", impact: "medium", likelihood: "low" },
    { id: "R-3", description: "Copy may need review", impact: "low", likelihood: "low" },
  ],
  priority: { "US-1": 3.33, "US-2": 0.6, "US-3": 1.5, "US-4": 1 },
  effort: { "US-1": 3, "US-2": 5, "US-3": 2, "US-4": 1 },
  sprint: [
    { story_id: "US-1", priority_score: 3.33, effort: 3, sprint: 1 },
    { story_id: "US-2", priority_score: 0.6, effort: 5, sprint: 1 },
  ],
  sprint_plan: {
    capacity_points: 30,
    committed_points: 11,
    included: ["US-1", "US-2", "US-3"],
    deferred: ["US-4"],
  },
  moscow: { "US-1": "must", "US-2": "should", "US-3": "could", "US-4": "wont" },
};

describe("ResultView · tabs", () => {
  it("opens on the overview panel with the other two hidden", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("result-panel-overview")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("result-panel-backlog")).toHaveAttribute("hidden");
    expect(screen.getByTestId("result-panel-evidence")).toHaveAttribute("hidden");
  });

  // APG roving focus: only the selected tab is in the tab sequence, and the
  // arrows move between them. Losing this turns three tabs into three tab
  // stops, which is the bug the pattern exists to prevent.
  it("keeps only the selected tab in the tab sequence", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("result-tab-backlog")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("tabindex", "-1");
  });

  it("moves between tabs with the arrow keys and wraps", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultView data={FIXTURE} />);
    screen.getByTestId("result-tab-overview").focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("result-tab-backlog")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the ends with Home and End", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultView data={FIXTURE} />);
    screen.getByTestId("result-tab-overview").focus();

    await user.keyboard("{End}");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");
  });

  it("wires every tab to its panel in both directions", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    for (const id of ["overview", "backlog", "evidence"] as const) {
      const tab = screen.getByTestId(`result-tab-${id}`);
      const panel = screen.getByTestId(`result-panel-${id}`);
      expect(tab).toHaveAttribute("aria-controls", panel.id);
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }
  });

  // Panels stay mounted so that switching to the evidence tab and back does
  // not discard in-progress board edits. `hidden`, never unmounted.
  it("keeps the backlog panel mounted while it is hidden", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultView data={FIXTURE} />);
    const backlog = screen.getByTestId("result-panel-backlog");
    expect(backlog).toHaveAttribute("hidden");
    await user.click(screen.getByTestId("result-tab-backlog"));
    expect(screen.getByTestId("result-panel-backlog")).toBe(backlog);
  });
});

describe("ResultView · PRD content", () => {
  it("renders the prose sections", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByText(FIXTURE.problem)).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.target_user)).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.goals[0])).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.non_goals[0])).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.requirements[0])).toBeInTheDocument();
  });

  it("renders one card per story, each named by its id", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    for (const story of FIXTURE.user_stories) {
      const card = screen.getByTestId(`story-card-${story.id}`);
      expect(card).toHaveAttribute("aria-labelledby", `story-${story.id}-heading`);
      expect(within(card).getByText(story.id)).toBeInTheDocument();
    }
  });

  it("labels every story with its MoSCoW bucket as text", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(within(screen.getByTestId("story-card-US-1")).getByText("Must")).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-2")).getByText("Should")).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-3")).getByText("Could")).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-4")).getByText("Won't")).toBeInTheDocument();
  });

  it("shows a story's dependencies only when it has some", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(within(screen.getByTestId("story-card-US-2")).getByText(/US-1/)).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-1")).queryByText(/depends/i)).toBeNull();
  });

  it("renders the risk table as a real table with column headers", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    // Only one table is in the accessibility tree: the sequence table lives in
    // the backlog panel, which is `hidden`, and role queries skip it.
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByRole("columnheader", { name: "Description" })).toBeInTheDocument();
    expect(within(table).getByText("Scope may grow")).toBeInTheDocument();
    expect(within(table).getByText("Provider may rate-limit")).toBeInTheDocument();
  });

  // The level word is the information. If it ever stops being rendered as
  // text, impact and likelihood become colour-only — a WCAG 1.4.1 failure.
  it("renders every risk level as a word, not only as a colour", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getAllByText("high").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("medium").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("low").length).toBeGreaterThanOrEqual(3);
  });

  it("prefixes each acceptance criterion with the Scenario keyword", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getAllByText("Scenario:").length).toBeGreaterThan(0);
    expect(screen.getByText("Every story is testable")).toBeInTheDocument();
  });
});

describe("ResultView · Arabic", () => {
  // A check that runs LTR only is not a passing check on a bilingual app.
  it("renders the Arabic tab labels", () => {
    renderWithProviders(<ResultView data={FIXTURE} />, { locale: "ar" });
    expect(screen.getByTestId("result-tab-overview")).toHaveTextContent("نظرة عامة");
  });

  it("renders the Arabic MoSCoW labels", () => {
    renderWithProviders(<ResultView data={FIXTURE} />, { locale: "ar" });
    expect(within(screen.getByTestId("story-card-US-1")).getByText("يجب")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new file against the unchanged component**

```bash
npx jest --selectProjects ui tests/ui/ResultView.test.tsx
```

Expected: **PASS.** This is the one place in this plan where a new test is
expected to pass on first run — it is a characterisation test of code that
already exists, not a specification of code that does not. If anything fails,
the test is wrong about the current behaviour: fix the test, not the component.
Task 3 is where the component changes.

- [ ] **Step 3: Run the four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Note the printed test count. The breakpoint audit is `it.each` over every
stylesheet under `src`, but this task adds no stylesheet, so the count rises
only by the tests written here.

- [ ] **Step 4: Commit**

```bash
git add tests/ui/ResultView.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "test(result): cover the result view before rebuilding it

The component had no test of its own — only incidental coverage in the
transitions file, whose fixture carries two of four MoSCoW buckets and one
of three risk levels. This is the net the D4 rebuild happens inside."
git log -1 --format=%B | grep -i co-authored
```

---

### Task 3: Adopt Chip and Card

This is the task that actually removes the eleven colour tokens D4 cannot
carry forward: eight MoSCoW (`--sc-must/should/could/wont` and their surfaces),
two warning (`--sc-warning`, `--sc-warning-surface`), and one shadow
(`--sc-shadow`). None of them has a `--c-*` equivalent, and none is getting
one.

**Files:**
- Modify: `src/components/scopecraft/ResultView.tsx`
- Modify: `src/components/scopecraft/ResultView.module.css` (delete the
  replaced classes only — the token migration is Task 4)
- Test: `tests/ui/ResultView.test.tsx`

**Interfaces:**
- Consumes: `Chip` with `weight?: "solid" | "outline" | "dashed" | "faint"`;
  `Card` with `as`, `labelledBy`, `testId`, `className` (Task 1).
- Produces: `ResultView`'s rendered DOM keeps every `data-testid` it has today
  — `result-view`, `result-tablist`, `result-tab-*`, `result-panel-*`,
  `story-card-*`. `StateTransitions.test.tsx:337` depends on `story-card-US-1`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui/ResultView.test.tsx`:

```tsx
describe("ResultView · MoSCoW and risk are encoded without hue", () => {
  // Four buckets, four weights, in descending commitment. The mapping is the
  // assertion: if someone re-adds a colour-per-bucket, these still pass, which
  // is why the sibling test below checks the colour classes are gone.
  it.each([
    ["US-1", "solid"],
    ["US-2", "outline"],
    ["US-3", "dashed"],
    ["US-4", "faint"],
  ])("gives %s the %s chip weight", (storyId, weight) => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    const card = screen.getByTestId(`story-card-${storyId}`);
    expect(card.querySelector(`.${weight}`)).not.toBeNull();
  });

  // Three levels reuse the top three weights; `faint` is a fourth bucket, not
  // a fourth level, so it does not appear here.
  it("gives the risk levels the top three weights", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("high").className).toContain("solid");
    expect(within(table).getAllByText("medium")[0].className).toContain("outline");
    expect(within(table).getAllByText("low")[0].className).toContain("dashed");
  });

  // identity-obj-proxy makes styles.badgeMust the string "badgeMust", so a
  // leftover hue class is visible in the DOM even though no colour is. This
  // is the test that fails if the MoSCoW palette creeps back in.
  //
  // Scoped to the overview panel deliberately. InteractiveSprintBoard has its
  // own .badgeMust..badgeWont, and identity-obj-proxy gives both stylesheets
  // the identical class string — so an unscoped query would fail on the
  // board's badges, which belong to D5 and are not this point's to remove.
  it("renders no hue-coded bucket or level class at all", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    const overview = screen.getByTestId("result-panel-overview");
    for (const gone of [
      "badgeMust", "badgeShould", "badgeCould", "badgeWont",
      "impactHigh", "impactMedium", "impactLow",
    ]) {
      expect(overview.querySelector(`.${gone}`)).toBeNull();
    }
  });

  it("puts every story card on the Card primitive", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByTestId("story-card-US-1")).toHaveClass("card");
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
npx jest --selectProjects ui tests/ui/ResultView.test.tsx
```

Expected: FAIL — the weight classes do not exist on the rendered chips, and
`.badgeMust` / `.impactHigh` are still present.

- [ ] **Step 3: Replace the MoSCoW map and the impact map in the component**

In `src/components/scopecraft/ResultView.tsx`, delete `MOSCOW_BADGE_CLASS` and
`IMPACT_CLASS` entirely and replace them with weight maps. Add the imports:

```tsx
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
```

```tsx
// Buckets and levels are encoded by chip weight, not by hue — see
// src/components/ui/Chip.tsx and docs/decision-log.md entry 34. The word is
// always rendered too; the weight only reinforces it.
const MOSCOW_WEIGHT = {
  must: "solid",
  should: "outline",
  could: "dashed",
  wont: "faint",
} as const satisfies Record<string, NonNullable<ChipProps["weight"]>>;

// Three levels, the top three weights. Descending emphasis, same ramp.
const LEVEL_WEIGHT = {
  high: "solid",
  medium: "outline",
  low: "dashed",
} as const satisfies Record<string, NonNullable<ChipProps["weight"]>>;
```

That needs `ChipProps` on the import:

```tsx
import { Chip, type ChipProps } from "@/components/ui/Chip";
```

- [ ] **Step 4: Swap the story card onto Card and its badge onto Chip**

Replace the `<article>` opening and closing tags and the badge block:

```tsx
                <Card
                  key={story.id}
                  as="article"
                  labelledBy={`story-${story.id}-heading`}
                  testId={`story-card-${story.id}`}
                  className={styles.storyCard}
                >
                  <div className={styles.storyHeader}>
                    <span id={`story-${story.id}-heading`} className={styles.storyId}>
                      {story.id}
                    </span>
                    <div className={styles.storyBadges}>
                      {bucket && <Chip weight={MOSCOW_WEIGHT[bucket]}>{t(MOSCOW_LABEL_KEY[bucket])}</Chip>}
                    </div>
                  </div>
```

and close it with `</Card>` instead of `</article>`.

`className={styles.storyCard}` stays — Task 4 gives `.storyCard` the one thing
`Card` does not provide, which is the internal flex layout. It no longer
carries background, border, radius, padding or shadow; those come from `Card`.

- [ ] **Step 5: Swap the risk cells onto Chip**

```tsx
                    <td>
                      <Chip weight={LEVEL_WEIGHT[risk.impact]}>
                        {t(LEVEL_LABEL_KEY[risk.impact])}
                      </Chip>
                    </td>
                    <td>
                      <Chip weight={LEVEL_WEIGHT[risk.likelihood]}>
                        {t(LEVEL_LABEL_KEY[risk.likelihood])}
                      </Chip>
                    </td>
```

- [ ] **Step 6: Delete the replaced classes from the stylesheet**

From `src/components/scopecraft/ResultView.module.css`, delete these rules
entirely — `.badge`, `.badgeMust`, `.badgeShould`, `.badgeCould`, `.badgeWont`,
`.impactChip`, `.impactHigh`, `.impactMedium`, `.impactLow` — and strip
`.storyCard` down to the layout `Card` does not own:

```css
/* Card supplies the surface: --c-panel, the hairline rule, the radius and the
   padding. What is left here is the internal rhythm, which is this view's
   business and not the primitive's. */
.storyCard {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 7: Run the result-view tests**

```bash
npx jest --selectProjects ui tests/ui/ResultView.test.tsx
```

Expected: PASS, including everything written in Task 2.

- [ ] **Step 8: Confirm the eleven tokens are gone from this file**

```bash
grep -c -o 'var(--sc-' src/components/scopecraft/ResultView.module.css
grep -nE 'sc-(must|should|could|wont|warning|shadow)' src/components/scopecraft/ResultView.module.css
```

Expected: the count drops from 28 to 17, and the second command prints nothing.

- [ ] **Step 9: Run the four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`StateTransitions.test.tsx` must still pass untouched — it asserts
`story-card-US-1`, which `Card`'s `testId` now renders.

- [ ] **Step 10: Commit**

```bash
git add src/components/scopecraft/ResultView.tsx \
        src/components/scopecraft/ResultView.module.css \
        tests/ui/ResultView.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "refactor(result): encode buckets and risk levels by weight, not hue

Eight MoSCoW tokens, two warning tokens and one shadow token had no --c-*
equivalent and were never going to get one — the twelve roles are closed and
there is deliberately no warning and no shadow scale. Chip already existed for
exactly this and had no consumer until now.

Story cards move onto Card, which is what removes the shadow."
git log -1 --format=%B | grep -i co-authored
```

---

### Task 4: Migrate the stylesheet

**Files:**
- Modify: `src/components/scopecraft/ResultView.module.css`
- Modify: `src/components/scopecraft/ResultView.tsx` (two inline styles out)

**Interfaces:**
- Consumes: the class names Task 3 left in place.
- Produces: `styles.sequenceSummary`, `styles.sequenceScroll` and
  `styles.sequenceTable`. The first two replace inline `style={{ ... }}`
  objects; the third is `.sprintTable` renamed, because it styles the full
  sequence table inside the `<details>`, not the sprint board.

- [ ] **Step 1: Rewrite the stylesheet**

Replace `src/components/scopecraft/ResultView.module.css` in full:

```css
/* src/components/scopecraft/ResultView.module.css
 *
 * Rebuilt for D4 on the --c-* tokens. Phone-first: everything outside a media
 * query is the phone layout, and the one breakpoint adds rather than undoes.
 *
 * There are no bucket or level colours in this file and there must not be —
 * MoSCoW and risk are carried by Chip's weight ramp. See docs/decision-log.md
 * entry 34.
 */

.result {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-inline-size: 52rem;
  margin-inline: auto;
}

.resultHeading {
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0;
}

/* `overflow-x: auto` so three labels in Arabic, which run longer, can scroll
   on a phone instead of wrapping into an unreadable stack. */
.tabList {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--c-panel-recessed);
  border: 1px solid var(--c-rule);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.tab {
  flex: 1 1 auto;
  white-space: nowrap;
  font: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--c-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding-block: var(--space-2);
  padding-inline: var(--space-3);
  min-block-size: 2.5rem;
  cursor: pointer;
  transition: color var(--motion-fast) var(--motion-ease),
    background var(--motion-fast) var(--motion-ease);
}

.tab:hover:not(.tabActive) {
  color: var(--c-text);
}

.tabActive {
  color: var(--c-accent-contrast);
  background: var(--c-accent);
}

.tab:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

/* Panels are focusable (tabIndex 0) so keyboard users can reach scrollable
   content within them. */
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.panel:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}

/* `hidden` alone loses to `display: flex` above — without this, every panel
   would render at once. */
.panel[hidden] {
  display: none;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sectionHeading {
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.sectionNumber {
  color: var(--c-text-muted);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  margin-inline-end: var(--space-1);
}

.prose {
  margin: 0;
  line-height: 1.6;
}

.list {
  margin: 0;
  padding-inline-start: var(--space-5);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* One column on a phone, two from the tablet band up — the 48rem intent in
   breakpoints.ts is "two-column board; form fields pair up", and this is the
   same idea for the story list.

   minmax(0, 1fr), not 1fr: a bare 1fr is minmax(auto, 1fr), so a long
   unbreakable token — a dependency list, a URL pasted into a criterion —
   would push the column past its share and scroll the whole page sideways.
   The capture checks for exactly that at 1280, 768 and 390px. */
.storyGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

@media (min-width: 48rem) {
  .storyGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Card supplies the surface: --c-panel, the hairline rule, the radius and the
   padding. What is left here is the internal rhythm, which is this view's
   business and not the primitive's. */
.storyCard {
  display: flex;
  flex-direction: column;
}

.storyHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.storyId {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--c-text-muted);
  letter-spacing: 0.02em;
}

.storyBadges {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.storyStatement {
  margin-block: var(--space-2);
  line-height: 1.6;
}

.storyStats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--c-text-muted);
  font-variant-numeric: tabular-nums;
  margin-block-end: var(--space-2);
}

.storyDependencies {
  font-size: var(--text-sm);
  color: var(--c-text-muted);
  margin-block: 0 var(--space-2);
  margin-inline: 0;
}

.acLabel {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--c-text-muted);
  margin-block: 0 var(--space-1);
  margin-inline: 0;
}

.gherkinList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.gherkinItem {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.gherkinKeyword {
  flex: 0 0 auto;
  font-weight: 700;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  color: var(--c-accent);
}

.riskTable,
.sequenceTable {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--text-base);
}

/* `start`, not `left`. Both tables were physically left-aligned, which put
   every cell on the wrong edge in Arabic. */
.riskTable th,
.riskTable td,
.sequenceTable th,
.sequenceTable td {
  text-align: start;
  padding-block: var(--space-2);
  padding-inline: var(--space-2);
  border-block-end: 1px solid var(--c-rule);
}

.riskTable th,
.sequenceTable th {
  font-weight: 700;
  color: var(--c-text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.tableScroll {
  overflow-x: auto;
}

/* Was an inline style={{ cursor }} on the <summary>. */
.sequenceSummary {
  cursor: pointer;
}

/* Was an inline style={{ marginTop }} on the wrapper. */
.sequenceScroll {
  overflow-x: auto;
  margin-block-start: var(--space-2);
}

.disclaimer {
  font-size: var(--text-sm);
  color: var(--c-text-muted);
  border-block-start: 1px dashed var(--c-rule);
  padding-block-start: var(--space-3);
}
```

Note `.sprintTable` is renamed `.sequenceTable`, because it styles the full
sequence table inside the `<details>`, not the sprint board.

- [ ] **Step 2: Take the two inline styles out of the component**

In `src/components/scopecraft/ResultView.tsx`, inside the backlog panel:

```tsx
            <details>
              <summary className={`${styles.acLabel} ${styles.sequenceSummary}`}>
                {t("prd.sprint.fullSequence")}
              </summary>
              <div className={styles.sequenceScroll}>
                <table className={styles.sequenceTable}>
```

- [ ] **Step 3: Run the result-view tests**

```bash
npx jest --selectProjects ui tests/ui/ResultView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Confirm the legacy references are gone and the audit passes**

```bash
grep -c -o 'var(--sc-' src/components/scopecraft/ResultView.module.css || echo 0
git grep -o 'var(--sc-' -- src | wc -l
grep -nE '(^|[^a-z-])(left|right|width|height|margin-top|margin-bottom|padding-left|padding-right)\s*:' src/components/scopecraft/ResultView.module.css
npx jest --selectProjects node tests/evaluation/breakpoint-audit.test.ts
```

Expected: `0` for this file; **169** for the tree. The arithmetic: `git grep -c`
counts matching LINES (28 for this file before D4) while `git grep -o | wc -l`
counts OCCURRENCES (35). The tree-wide 204 was occurrences, so the two metrics
must not be subtracted from each other. Task 3 removed 17 occurrences, taking
the tree to 187; this task removes the remaining 18. The physical-property
grep prints nothing; the audit passes with the exemption list still at 2 —
this file was never exempt and its one new query is `min-width: 48rem`, which
is on the approved scale.

- [ ] **Step 5: Run the four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/scopecraft/ResultView.module.css \
        src/components/scopecraft/ResultView.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "style(result): move the result view onto the --c-* tokens

Phone-first, with the story grid gaining a second column at 48rem — the
tablet band's documented intent. Legacy references in use fall 204 to 169.

Fixes a real RTL bug while here: both tables were text-align: left, which put
every cell on the wrong edge in Arabic. Two inline style objects move into
the stylesheet."
git log -1 --format=%B | grep -i co-authored
```

---

### Task 5: Evidence and documentation

**Files:**
- Modify: `docs/decision-log.md`
- Modify: `docs/upgrade-checklist.md`
- Regenerate: `docs/evidence/ui/shots/*.png`,
  `docs/evidence/ui/accessibility-audit.txt`

- [ ] **Step 1: Capture the UI evidence**

```bash
npm run build
```

Then two servers, per `CLAUDE.md` §5 and the D3 notes — one normal, one with
bogus AI keys:

```bash
set -a; . ./.env.local; set +a
```

`export $(grep ...)` breaks here, because `DATABASE_URL` contains an `&`.

```bash
npm run capture:ui
```

Expected: exit 0. Record the contrast-pair counts, unnamed-control count,
heading-skip count and the overflow result at 1280/768/390 in both directions.

- [ ] **Step 2: Write decision-log entry 34**

Append to `docs/decision-log.md`, matching the shape of entry 33. It must
record, at minimum:

- That MoSCoW and risk levels are encoded by `Chip`'s weight ramp rather than
  by hue, and that this closes the `--sc-warning` gap without reopening the
  twelve closed roles.
- That the fourth weight is **dotted, not a paler dashed**, because
  `--c-text-muted` and `--c-text-faint` are `#5f5f5f` and `#767676` in light —
  a distinction the eye does not make.
- That `text-transform: uppercase`, which the old badge used for emphasis, is
  a no-op in Arabic, so the old design's emphasis mechanism silently vanished
  in RTL. The weight ramp works in both scripts.
- The cost, stated plainly: a high-impact risk no longer renders red. The word
  "high" carries it, and the alternative was reopening a closed decision.
- That this binds D5 and `EvidencePanel`, which still hold 33 and 12 legacy
  references including `--sc-could` and `--sc-warning`.

- [ ] **Step 3: Tick D4 in the checklist and write it up**

In `docs/upgrade-checklist.md`, change `- [ ] **D4` to `- [x] **D4` and write
the entry in the same voice as D2 and D3: what changed, what was verified and
how, what it cost elsewhere, and — explicitly — what is **not** covered:

- The board (D5), which still holds the largest legacy block at 37 references
  — 33 is its line count, not its `var(--sc-` occurrence count.
- `EvidencePanel`'s 12, including `--sc-could`.
- The global `box-sizing` reset and the `.srOnly` consolidation, both still
  their own points.
- **That the capture never renders a result view.** It audits the idle
  `/scopecraft` page only, so the `faint`-on-panel pair is asserted in
  `tests/evaluation/design-tokens.test.ts` (4.54 light, 5.88 dark) and is
  **not** in the regenerated evidence file. Same limit D3 recorded.
- That `.tab` keeps its `2.5rem` (40px) target — over the 24px WCAG 2.5.8
  floor, under the 44px comfort target that D6 raises for the history actions.
- That this file still has no `prefers-reduced-motion` block; its only
  transition is a hover colour fade, and reduced motion becomes a token-level
  rule at E1.

- [ ] **Step 4: Update the drifted numbers**

Test count and legacy-reference count both moved. Check every document that
carries either:

```bash
git grep -ln '\b40[0-9] tests\|\b39[0-9] tests\|204' -- docs *.md
```

Fix the ones this point actually made wrong. **Do not** fix the ~15 documents
carrying test counts from 130–293 — those predate D3, no document said 406, so
this point did not make them wrong. They are their own point.

- [ ] **Step 5: Run the four gates one final time**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add docs/
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "docs: close D4, record the weight-over-hue decision as entry 34"
git log -1 --format=%B | grep -i co-authored
```

- [ ] **Step 7: Report, do not push**

`CLAUDE.md` §8: do not push to production without being asked. Report the
final state and stop. Shipping, when asked, is:

```bash
git push origin dev && git push fork dev:main
```

---

## What this plan deliberately does not do

- **Add a colour role.** The `warning` gap is closed by the weight ramp. If a
  task finds itself editing `tokens.ts`, it has gone wrong — stop and report.
- **Touch `InteractiveSprintBoard`.** It holds 37 legacy references and is D5.
  Entry 34 binds it, but this point does not change it.
- **Touch `EvidencePanel`.** 12 references, including `--sc-could`, which entry
  34 also binds. It is reached by D4's evidence tab but is not D4's scope.
- **Delete the `--sc-*` block.** 169 references remain after this point.
- **Consolidate `.srOnly`** or add the global `box-sizing` reset. Both are
  their own points by the owner's ruling.
- **Raise `.tab` to a 44px target.** Target sizing is D6's, and doing it here
  would change the header rhythm on a point that is not about that.
