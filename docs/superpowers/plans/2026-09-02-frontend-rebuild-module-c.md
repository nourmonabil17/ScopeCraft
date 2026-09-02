# Frontend rebuild — Module C (foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the token layer, responsive scale and component primitives that every rebuilt view will be written in — without breaking the currently-live frontend at any commit.

**Architecture:** Tokens become typed data in `src/lib/design/`, from which the CSS custom-property block is generated. The new tokens are added *alongside* the existing `--sc-*` colour set rather than replacing it, so the 250+ existing references keep working while views migrate one at a time in Module D. Primitives are plain React components with CSS Modules, consuming only the new tokens.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, CSS Modules, Jest (ts-jest, node + jsdom projects). No new dependencies.

## Global Constraints

- **No new runtime dependency.** Not Tailwind, not a component library, not a motion library. The six-dependency count is a deliberate, documented property of this project.
- **Logical CSS properties only.** `inset-inline-start`, never `left`. `margin-inline`, never `margin-left`. `border-end-end-radius`, never four-value `border-radius`. A physical `left: -9999px` once made every Arabic page scroll ~10000px sideways.
- **Bilingual.** Every user-facing string needs both an `en` and an `ar` entry in `src/lib/i18n/translations.ts`. The type system enforces this — an English key with no Arabic one is a compile error. Never work around it with a fallback.
- **Theming model.** Every colour is defined on `:root` and redefined on `:root.dark`. Never inside a bare `prefers-color-scheme` media query — that cannot express "user chose light while their OS is dark", which is a real preference this app honours.
- **WCAG 2.2 AA.** Every interactive control needs an accessible name. Contrast is measured, not assumed.
- **All four gates green before every commit:** `npm run typecheck && npm run lint && npm test && npm run build`.
- **Nothing is pushed to `fork/main`** (the branch Vercel builds) during Module C. Work lands on `dev` only.
- **No `Co-Authored-By` trailer on any commit.** Verify with `git log -1 --format=%B | grep -i co-authored` after each one.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/design/tokens.ts` | Token values as typed data — the single source of truth |
| `src/lib/design/contrast.ts` | WCAG relative-luminance and contrast-ratio maths |
| `src/lib/design/css.ts` | Turns token data into the `:root` / `:root.dark` CSS string |
| `src/lib/design/breakpoints.ts` | The four approved breakpoint values, shared by CSS-audit test and docs |
| `src/app/layout.tsx` | Modified — consumes the generated block instead of a hand-written one |
| `src/components/ui/Button.tsx` + `.module.css` | Primitive |
| `src/components/ui/Card.tsx` + `.module.css` | Primitive |
| `src/components/ui/Chip.tsx` + `.module.css` | Primitive |
| `src/components/ui/Field.tsx` + `.module.css` | Primitive |
| `src/components/ui/Dialog.tsx` + `.module.css` | Primitive |
| `src/components/ui/Toast.tsx` + `.module.css` | Primitive — presentation only; `ToastContext` is unchanged |
| `tests/evaluation/design-tokens.test.ts` | Contrast obligations, node project |
| `tests/evaluation/breakpoint-audit.test.ts` | No stylesheet may invent a breakpoint |
| `tests/ui/primitives/*.test.tsx` | One per primitive, jsdom project |

**Why `src/components/ui/` and not `src/components/common/`:** `common/` holds the *existing* components, which stay live until Module D replaces them. A separate directory means both generations coexist without name collisions, and makes the eventual deletion a directory removal rather than a file-by-file audit.

---

## What this plan does NOT do

Stated so an implementer does not helpfully overreach:

- It does not modify, restyle or delete any existing component in `src/components/common/` or `src/components/scopecraft/`. Those are Module D.
- It does not remove any `--sc-*` token. That deletion is the last point of Module D, gated on `grep` returning zero.
- It does not change `src/context/*`, `src/lib/i18n/translations.ts`, or anything under `src/lib/scopecraft/`.
- It does not touch routes, API handlers, auth or the database.

---

## Point C2 — Design tokens

### Task 1: Token data and contrast maths

**Files:**
- Create: `src/lib/design/contrast.ts`
- Create: `src/lib/design/tokens.ts`
- Test: `tests/evaluation/design-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `contrastRatio(hexA: string, hexB: string): number`; `tokens: DesignTokens` where `DesignTokens = { color: { light: Record<ColorRole, string>; dark: Record<ColorRole, string> }; space: Record<string, string>; text: Record<string, string>; radius: Record<string, string>; motion: Record<string, string> }`; type `ColorRole`.

- [ ] **Step 1: Write the failing test**

Create `tests/evaluation/design-tokens.test.ts`:

```ts
// tests/evaluation/design-tokens.test.ts
//
// The spec calls every light/dark pair "a contrast obligation, not a
// suggestion". This is that obligation, executable. It fails if someone
// darkens a muted grey or brightens an accent past the point where it still
// clears AA — which is exactly the change that gets made by eye and shipped.

import { contrastRatio } from "@/lib/design/contrast";
import { tokens } from "@/lib/design/tokens";

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 1 for a colour against itself", () => {
    expect(contrastRatio("#4a7c59", "#4a7c59")).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#0f766e", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#0f766e"),
      5
    );
  });
});

describe("design tokens meet WCAG 2.2 AA", () => {
  const themes = ["light", "dark"] as const;

  it.each(themes)("%s: body text on ground clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.text, t.ground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("%s: muted text on ground clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.textMuted, t.ground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("%s: accent on ground clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.accent, t.ground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("%s: text on a panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.text, t.panel)).toBeGreaterThanOrEqual(4.5);
  });

  // Faint text is decorative-adjacent but still carries meaning (points,
  // timestamps), so it gets the 3:1 large-text floor rather than a pass.
  it.each(themes)("%s: faint text on ground clears 3:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.textFaint, t.ground)).toBeGreaterThanOrEqual(3);
  });

  // SC 1.4.11: a rule that separates content is a non-text contrast target.
  it.each(themes)("%s: strong rule on ground clears 3:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.ruleStrong, t.ground)).toBeGreaterThanOrEqual(3);
  });

  it.each(themes)("%s: text on the accent fill clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.accentContrast, t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("token completeness", () => {
  it("defines the same colour roles in both themes", () => {
    expect(Object.keys(tokens.color.light).sort()).toEqual(
      Object.keys(tokens.color.dark).sort()
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/evaluation/design-tokens.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/design/contrast'`.

- [ ] **Step 3: Write the contrast maths**

Create `src/lib/design/contrast.ts`:

```ts
// src/lib/design/contrast.ts
//
// WCAG 2.2 relative luminance and contrast ratio, from the spec's own
// formulae (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
//
// Hand-written rather than pulled from a package: it is nine lines of
// arithmetic defined by a public standard that has not changed since 2008,
// and it is the only thing that makes "contrast is measured, not assumed"
// an executable claim rather than a promise.

/** Accepts "#rgb" or "#rrggbb". Throws on anything else — a malformed token
 *  should fail loudly at test time, not silently score 21:1. */
function toRgb(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, "");

  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Per WCAG: linearise each channel, then weight for human luminance response. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 4: Write the token data**

Create `src/lib/design/tokens.ts`:

```ts
// src/lib/design/tokens.ts
//
// The design system as data, not as a stylesheet (owner: Yousef) — Module C.
//
// Values come from the approved spec,
// docs/superpowers/specs/2026-09-02-frontend-rebuild-design.md.
//
// Why data and not CSS: a stylesheet cannot be asserted against. Holding the
// values here lets tests/evaluation/design-tokens.test.ts prove every
// light/dark pair actually meets its contrast obligation, which is the
// difference between "we measured contrast" and "we intended to".
//
// The CSS block that the browser sees is generated from this file by
// ./css.ts. Do not hand-write a second copy anywhere.

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
  | "accentContrast";

export interface DesignTokens {
  color: Record<"light" | "dark", Record<ColorRole, string>>;
  space: Record<string, string>;
  text: Record<string, string>;
  radius: Record<string, string>;
  motion: Record<string, string>;
}

export const tokens: DesignTokens = {
  color: {
    // In light, a raised panel is the same white as the ground and is defined
    // by its hairline rule. In dark, it is defined by a lighter fill. Border
    // does the lifting on white, fill does it on black — giving light panels a
    // grey fill to "match" dark flattens the whole light theme into mush.
    light: {
      ground: "#ffffff",
      panel: "#ffffff",
      panelRecessed: "#fafafa",
      rule: "#e5e5e5",
      ruleStrong: "#8f8f8f",
      text: "#0a0a0a",
      textMuted: "#5f5f5f",
      textFaint: "#767676",
      accent: "#0f766e",
      accentContrast: "#ffffff",
    },
    dark: {
      ground: "#0f1115",
      panel: "#141821",
      panelRecessed: "#11141b",
      rule: "#1e222b",
      ruleStrong: "#6c7789",
      text: "#e6e8ec",
      textMuted: "#9aa3b2",
      textFaint: "#8b95a6",
      accent: "#5eead4",
      accentContrast: "#0f1115",
    },
  },

  // A 4px base. Every gap, pad and margin in the rebuild is one of these —
  // the absence of exactly this is why 6,433 lines of CSS have no rhythm.
  space: {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.5rem",
    "6": "2rem",
    "7": "3rem",
    "8": "4rem",
  },

  // Deliberately short. A scale with fourteen sizes is a scale nobody obeys.
  text: {
    xs: "0.6875rem",
    sm: "0.8125rem",
    base: "0.9375rem",
    lg: "1.125rem",
    xl: "1.375rem",
    "2xl": "1.75rem",
  },

  // Direction A is sharp. These exist to stop anyone reaching for 12px.
  radius: {
    none: "0",
    sm: "2px",
    md: "4px",
  },

  // There is deliberately NO elevation/shadow scale. The checklist listed one,
  // and direction A answers it differently: elevation is expressed by a
  // hairline rule in light and by a lighter fill in dark, never by a shadow.
  // A shadow token would exist only to be reached for, and the first component
  // that used it would be the first component off-direction.

  // Motion that explains a change earns its place; motion that decorates does
  // not. Three durations is enough to express that and few enough to obey.
  motion: {
    fast: "120ms",
    base: "180ms",
    slow: "260ms",
    ease: "cubic-bezier(0.2, 0, 0, 1)",
  },
};
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npm test -- tests/evaluation/design-tokens.test.ts
```

Expected: PASS, all cases.

If a contrast case fails, **adjust the token, not the threshold.** The thresholds are the WCAG floors and are not negotiable. Record any value you had to move, and by how much, in the point's review.

- [ ] **Step 6: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/design/contrast.ts src/lib/design/tokens.ts tests/evaluation/design-tokens.test.ts
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(design): tokens as data, with contrast as an executable obligation"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

---

### Task 2: Generate the CSS block and wire it into the layout

**Files:**
- Create: `src/lib/design/css.ts`
- Modify: `src/app/layout.tsx` (the `rootStyle` template string)
- Test: `tests/evaluation/design-tokens.test.ts` (extend)

**Interfaces:**
- Consumes: `tokens` and `ColorRole` from Task 1.
- Produces: `tokenCss(): string` — a CSS string containing a `:root { … }` block and a `:root.dark { … }` block, using custom properties named `--c-<role>` for colours, `--space-<key>`, `--text-<key>`, `--radius-<key>`, `--motion-<key>`.

**Naming, and why it differs from the old set:** the existing tokens are `--sc-*`. The new ones deliberately are **not**, so both sets coexist unambiguously while Module D migrates views one at a time. A `grep` for `--sc-` is therefore an exact measure of migration progress, and its reaching zero is the trigger for deleting the old block.

- [ ] **Step 1: Write the failing test**

Append to `tests/evaluation/design-tokens.test.ts`:

```ts
import { tokenCss } from "@/lib/design/css";

describe("tokenCss", () => {
  const css = tokenCss();

  it("defines a light block on :root and a dark block on :root.dark", () => {
    expect(css).toContain(":root {");
    expect(css).toContain(":root.dark {");
  });

  it("emits every colour role as a --c- property in both themes", () => {
    for (const role of Object.keys(tokens.color.light)) {
      const kebab = role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      // Once in :root, once in :root.dark.
      const occurrences = css.split(`--c-${kebab}:`).length - 1;
      expect(occurrences).toBe(2);
    }
  });

  it("emits the scales once — they do not vary by theme", () => {
    expect(css.split("--space-4:").length - 1).toBe(1);
    expect(css.split("--text-base:").length - 1).toBe(1);
    expect(css.split("--radius-md:").length - 1).toBe(1);
    expect(css.split("--motion-base:").length - 1).toBe(1);
  });

  // The theming model requires an explicit light choice to survive a dark OS.
  // A bare prefers-color-scheme block would break that, silently.
  it("never defines colours inside a prefers-color-scheme media query", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/evaluation/design-tokens.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/design/css'`.

- [ ] **Step 3: Write the generator**

Create `src/lib/design/css.ts`:

```ts
// src/lib/design/css.ts
//
// Turns the token data into the custom-property block the browser reads.
//
// Generated rather than hand-written so the values in tokens.ts — the ones the
// contrast test actually asserts against — are provably the same values that
// ship. A hand-maintained second copy would drift, and the drift would be
// invisible until someone measured the live site.

import { tokens } from "./tokens";

function kebab(role: string): string {
  return role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function colorBlock(theme: "light" | "dark"): string {
  return Object.entries(tokens.color[theme])
    .map(([role, value]) => `    --c-${kebab(role)}: ${value};`)
    .join("\n");
}

function scaleBlock(prefix: string, scale: Record<string, string>): string {
  return Object.entries(scale)
    .map(([key, value]) => `    --${prefix}-${key}: ${value};`)
    .join("\n");
}

/** The full token stylesheet. Injected by src/app/layout.tsx. */
export function tokenCss(): string {
  return `
  :root {
${colorBlock("light")}

${scaleBlock("space", tokens.space)}

${scaleBlock("text", tokens.text)}

${scaleBlock("radius", tokens.radius)}

${scaleBlock("motion", tokens.motion)}
  }

  :root.dark {
${colorBlock("dark")}
  }
`;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/evaluation/design-tokens.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire it into the layout, additively**

In `src/app/layout.tsx`:

1. Add the import: `import { tokenCss } from "@/lib/design/css";`
2. Find the `const rootStyle = \`` template literal.
3. Insert `${tokenCss()}` as the **first** thing inside it, before the existing `:root {` block.

**Do not delete or edit any existing `--sc-*` declaration.** They are referenced 250+ times by components this plan does not touch. The result is one stylesheet defining both generations of token; that is intentional and temporary, and is explained in the spec under "How the new tokens land without breaking the app".

Add a comment above the insertion:

```
  /* New token layer (Module C). Coexists with the --sc-* block below until
     Module D finishes migrating every view; the old block is deleted in that
     module's final point, gated on `grep -r "--sc-" src` returning nothing.
     Two generations of token in one stylesheet is deliberate — replacing them
     in a single commit would break every view that has not been rebuilt yet. */
```

- [ ] **Step 6: Verify both generations are live in the browser**

```bash
npm run build
```

Then start the preview and confirm in the Browser pane that `getComputedStyle(document.documentElement).getPropertyValue('--c-accent')` returns `#0f766e` in light and `#5eead4` after toggling to dark, **and** that an existing `--sc-accent` still resolves. Both must be true — the second is what proves nothing regressed.

- [ ] **Step 7: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/design/css.ts src/app/layout.tsx tests/evaluation/design-tokens.test.ts
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(design): generate the token stylesheet, alongside the existing one"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

**Point C2 ends here.** Produce the full review and stop for the owner's acceptance before starting C3.

---

## Point C3 — Responsive system

### Task 3: Breakpoints, and a test that no stylesheet may invent one

**Files:**
- Create: `src/lib/design/breakpoints.ts`
- Test: `tests/evaluation/breakpoint-audit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BREAKPOINTS: readonly { name: string; minWidth: string }[]`, and `APPROVED_MIN_WIDTHS: readonly string[]`.

**The constraint that shapes this task:** CSS custom properties **cannot** be used in a media-query condition — `@media (min-width: var(--bp-md))` is invalid CSS and fails silently. There is no dependency-free way to make breakpoints a true single source of truth in CSS. `@custom-media` needs a PostCSS plugin, which is a dependency, which is out of scope.

So the honest approach is: the literal values are repeated in each stylesheet, and a **test enforces that no stylesheet uses a value outside the approved four.** The single source of truth is the test, not the CSS. That is a real guarantee — someone inventing a 37rem breakpoint gets a red build — and it costs nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/evaluation/breakpoint-audit.test.ts`:

```ts
// tests/evaluation/breakpoint-audit.test.ts
//
// CSS custom properties are not usable inside a media-query condition, so the
// four approved breakpoints cannot be enforced by CSS itself. This test is the
// enforcement instead: it reads every stylesheet and fails if one invents a
// width of its own. Before the rebuild the app had three ad-hoc phone patches
// (30/34/42rem) and nothing above 42rem at all; this is what stops that
// growing back.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_MIN_WIDTHS } from "@/lib/design/breakpoints";

function stylesheetsUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...stylesheetsUnder(path));
    } else if (entry.endsWith(".css")) {
      found.push(path);
    }
  }
  return found;
}

/** Width conditions only. Feature queries such as prefers-reduced-motion and
 *  hover/pointer are unrelated to the breakpoint scale and are left alone. */
const WIDTH_QUERY = /@media[^{]*?\((?:min|max)-width:\s*([^)]+)\)/g;

describe("breakpoint audit", () => {
  const files = stylesheetsUnder("src");

  it("finds stylesheets to audit", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s uses only approved breakpoints", (file) => {
    const css = readFileSync(file, "utf8");
    const used = [...css.matchAll(WIDTH_QUERY)].map((m) => m[1].trim());

    for (const width of used) {
      expect(APPROVED_MIN_WIDTHS).toContain(width);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/evaluation/breakpoint-audit.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/design/breakpoints'`.

- [ ] **Step 3: Write the breakpoint module**

Create `src/lib/design/breakpoints.ts`:

```ts
// src/lib/design/breakpoints.ts
//
// The four approved breakpoints (owner: Yousef) — Module C.
//
// These values cannot be enforced by CSS: a custom property is not valid
// inside a media-query condition, and the alternative (@custom-media) needs a
// PostCSS plugin, which is a dependency this project does not want. So the
// literals are repeated in each stylesheet and enforced by
// tests/evaluation/breakpoint-audit.test.ts instead. The test is the source of
// truth; this file is what the test reads.
//
// Phone is the base case: styles outside any media query are the phone styles,
// and every breakpoint above adds rather than undoes. Two of these bands (lg,
// xl) have no equivalent in the pre-rebuild app, whose widest breakpoint was
// 42rem.

export interface Breakpoint {
  name: "sm" | "md" | "lg" | "xl";
  minWidth: string;
  /** What changes at this width. Documentation, not behaviour. */
  intent: string;
}

export const BREAKPOINTS: readonly Breakpoint[] = [
  { name: "sm", minWidth: "30rem", intent: "Large phone. Single column; toggles condense." },
  { name: "md", minWidth: "48rem", intent: "Tablet. Two-column board; form fields pair up." },
  { name: "lg", minWidth: "64rem", intent: "Desktop. Full board; side-by-side PRD sections." },
  { name: "xl", minWidth: "80rem", intent: "Wide. Max-width engages; margins grow, not columns." },
] as const;

/** Every width literal a stylesheet in this project is allowed to use. */
export const APPROVED_MIN_WIDTHS: readonly string[] = BREAKPOINTS.map((b) => b.minWidth);
```

- [ ] **Step 4: Run the test**

```bash
npm test -- tests/evaluation/breakpoint-audit.test.ts
```

Expected: **FAIL**, and this failure is the point. The existing stylesheets use `30rem`, `34rem` and `42rem`; only `30rem` is approved. The test has just found the real, pre-existing inconsistency this point exists to fix.

- [ ] **Step 5: Decide the exemption, deliberately**

The nine old stylesheets are Module D's work and must not be edited here. But leaving the suite red is not acceptable either.

Add an explicit, dated exemption list to the test — not a loosened rule:

```ts
// Stylesheets still on the pre-rebuild breakpoints. Each is removed from this
// list when Module D rebuilds that view; the list reaching empty is one of the
// exit conditions for Module D. Adding a NEW file here is not allowed — the
// point of the audit is that new work uses the scale.
const PRE_REBUILD_EXEMPT = [
  "src/components/common/Header.module.css",
  "src/components/common/ToggleControls.module.css",
  "src/components/scopecraft/InputForm.module.css",
  "src/components/scopecraft/InteractiveSprintBoard.module.css",
];
```

and skip those paths in the `it.each`. Then add a test that the exemption list itself cannot grow silently:

```ts
it("the pre-rebuild exemption list has not grown", () => {
  // Frozen at the count measured on 2026-09-02. Module D shrinks this to zero;
  // nothing may add to it.
  expect(PRE_REBUILD_EXEMPT).toHaveLength(4);
});
```

- [ ] **Step 6: Run the test and watch it pass**

```bash
npm test -- tests/evaluation/breakpoint-audit.test.ts
```

Expected: PASS, with four files exempt and the rest audited.

- [ ] **Step 7: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/design/breakpoints.ts tests/evaluation/breakpoint-audit.test.ts
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(design): four approved breakpoints, enforced by audit"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

**Point C3 ends here.** Full review, then stop for acceptance.

---

## Point C4 — Primitives

Six tasks, one per primitive. Each follows the same shape, so Task 4 is written
in full and Tasks 5–9 state only what differs. **Read Task 4 before any other.**

**A deliberate deviation from the plan-writing standard, declared rather than
hidden:** that standard says never write "same as Task N" — repeat the code,
because an implementer may read tasks out of order. Tasks 5–9 below give exact
interfaces, exact test cases and exact styling rules, but not literal code.

The reason is the owner's acceptance protocol: C2 and C3 are reviewed and
accepted before C4 begins, and either review can change what the primitives
should look like. Writing five components in full now would be writing code
against decisions that have not been made yet. **Tasks 5–9 are expanded to full
code when point C4 is proposed** — that expansion is the first step of C4, not
an omission from this plan. Task 4 is complete because Button is needed to prove
the token layer works at all.

A note on testing that applies to all six: `jest.config.js` maps `*.module.css`
to `identity-obj-proxy`, so `styles.foo` returns the string `"foo"` and **no
computed style is available in jsdom.** Do not write tests that assert colours,
spacing or media-query behaviour — they cannot work. Test roles, accessible
names, attributes, and behaviour. Visual and responsive verification happens in
the browser, and is recorded as evidence, not as a unit test.

### Task 4: Button

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Button.module.css`
- Test: `tests/ui/primitives/Button.test.tsx`

**Interfaces:**
- Consumes: token custom properties from Task 2.
- Produces: `Button` — props `{ variant?: "primary" | "secondary" | "quiet"; type?: "button" | "submit"; disabled?: boolean; busy?: boolean; onClick?: () => void; children: React.ReactNode }` and all standard `<button>` attributes.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/primitives/Button.test.tsx`:

```tsx
// tests/ui/primitives/Button.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../render-helpers";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders a real button element with its label as the accessible name", () => {
    renderWithProviders(<Button>Generate plan</Button>);
    expect(screen.getByRole("button", { name: "Generate plan" })).toBeInTheDocument();
  });

  it("defaults to type=button so it cannot accidentally submit a form", () => {
    renderWithProviders(<Button>Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
  });

  it("calls onClick when activated", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderWithProviders(<Button onClick={onClick}>Export</Button>);

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderWithProviders(
      <Button disabled onClick={onClick}>
        Export
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  // busy is a distinct state from disabled: the control stays focusable and
  // keeps its name, so a screen-reader user is told it is working rather than
  // finding it silently gone from the tab order.
  it("marks a busy button aria-busy without removing it from the tab order", () => {
    renderWithProviders(<Button busy>Generating</Button>);
    const button = screen.getByRole("button", { name: "Generating" });

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toHaveAttribute("disabled");
  });

  it("applies the variant as a class so styling is selectable", () => {
    renderWithProviders(<Button variant="secondary">Reset</Button>);
    expect(screen.getByRole("button", { name: "Reset" })).toHaveClass("secondary");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/ui/primitives/Button.test.tsx
```

Expected: FAIL — cannot resolve `@/components/ui/Button`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Button.tsx`:

```tsx
// src/components/ui/Button.tsx
//
// Button primitive (owner: Yousef) — Module C.
//
// A real <button>, always. Not a styled <div> with a click handler: the native
// element brings keyboard activation, focus, the disabled semantic and form
// participation for free, and every one of those is something a div version
// gets wrong quietly.
//
// `busy` is separate from `disabled` on purpose. A disabled control leaves the
// tab order, so a screen-reader user who was on it while a request started
// loses their place and is told nothing. `aria-busy` keeps the control
// reachable and announced while pointer activation is suppressed.

"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "primary" | "secondary" | "quiet";
  /** Defaults to "button" — an unspecified type inside a form submits it. */
  type?: "button" | "submit";
  /** Working, but still focusable and still announced. Not the same as disabled. */
  busy?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  type = "button",
  busy = false,
  disabled = false,
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      onClick={busy ? undefined : onClick}
    >
      {children}
    </button>
  );
}
```

Create `src/components/ui/Button.module.css`:

```css
/* src/components/ui/Button.module.css
 *
 * Direction A: sharp edges, hairline rules, no shadow. The primary variant is
 * the only filled one — that scarcity is what makes it read as the primary
 * action without needing size or colour shouting to say so.
 *
 * Logical properties throughout: padding-inline / padding-block, never
 * padding-left. This is what makes one stylesheet serve both text directions.
 */

.button {
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 580;
  line-height: 1.2;

  padding-block: var(--space-2);
  padding-inline: var(--space-4);

  /* 44px comfort target. The old history buttons were 32px, which clears the
     24px floor of SC 2.5.8 but is not comfortable on a phone. */
  min-block-size: 2.75rem;

  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;

  transition:
    background-color var(--motion-fast) var(--motion-ease),
    border-color var(--motion-fast) var(--motion-ease),
    color var(--motion-fast) var(--motion-ease);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.button[aria-busy="true"] {
  cursor: progress;
}

/* Focus is never removed, only restyled. The offset keeps the ring clear of
   the border so it stays visible against both the button and the page. */
.button:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.primary {
  background: var(--c-accent);
  color: var(--c-accent-contrast);
}

.secondary {
  background: transparent;
  color: var(--c-text);
  border-color: var(--c-rule-strong);
}

.quiet {
  background: transparent;
  color: var(--c-text-muted);
}

.quiet:hover:not(:disabled),
.secondary:hover:not(:disabled) {
  background: var(--c-panel-recessed);
  color: var(--c-text);
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/ui/primitives/Button.test.tsx
```

Expected: PASS, six cases.

- [ ] **Step 5: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.module.css tests/ui/primitives/Button.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): Button primitive"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

---

### Task 5: Card

Same six steps as Task 4. What differs:

**Files:** `src/components/ui/Card.tsx`, `Card.module.css`, `tests/ui/primitives/Card.test.tsx`

**Interfaces:** `Card` — props `{ as?: "div" | "article" | "li"; recessed?: boolean; muted?: boolean; children: ReactNode }`.

**Tests to write:**
- Renders its children.
- Renders a `<div>` by default and the given element when `as` is passed (`article` → `screen.getByRole("article")`).
- `recessed` applies the `recessed` class; default does not.
- A card is not interactive: it must render no `button` or `link` role of its own.

**Styling notes:** light uses `background: var(--c-panel)` with `border: 1px solid var(--c-rule)`; dark inherits the fill difference from the tokens automatically — **the stylesheet must not special-case dark.** `recessed` swaps to `var(--c-panel-recessed)`. `muted` uses a dashed rule, which is how the deferred column is expressed.

---

### Task 6: Chip

**Files:** `src/components/ui/Chip.tsx`, `Chip.module.css`, `tests/ui/primitives/Chip.test.tsx`

**Interfaces:** `Chip` — props `{ weight?: "solid" | "outline" | "dashed"; children: ReactNode }`.

**The rule this primitive exists to enforce:** MoSCoW is encoded by **fill weight, not hue** — MUST solid, SHOULD outline, COULD dashed. Direction C's coloured chips made colour the information, which fails WCAG 1.4.1. The `weight` prop has no colour variants and must not gain any.

**Tests to write:**
- Renders its text content.
- Each weight applies its own class.
- Default weight is `outline`.
- The chip's meaning survives without colour: assert the visible text is the bucket name, so the label carries the information on its own.

---

### Task 7: Field

**Files:** `src/components/ui/Field.tsx`, `Field.module.css`, `tests/ui/primitives/Field.test.tsx`

**Interfaces:** `Field` — props `{ id: string; label: string; hint?: string; error?: string; children: ReactElement }`. It renders the `<label>`, wires `htmlFor`/`id`, and links hint and error text via `aria-describedby`.

**Tests to write:**
- `screen.getByLabelText(label)` finds the control — this is the whole point of the primitive.
- A hint is linked: the control's `aria-describedby` contains the hint element's id.
- An error is linked the same way **and** sets `aria-invalid="true"` on the control.
- With both hint and error present, `aria-describedby` references both ids.
- No error means no `aria-invalid` attribute at all, not `aria-invalid="false"`.

**Implementation note:** use `cloneElement` to add the wiring attributes to the child control. The child keeps ownership of its own `value`/`onChange`; this primitive only supplies identity and description.

---

### Task 8: Dialog

**Files:** `src/components/ui/Dialog.tsx`, `Dialog.module.css`, `tests/ui/primitives/Dialog.test.tsx`

**Interfaces:** `Dialog` — props `{ open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }`.

**Use the native `<dialog>` element with `showModal()`.** It gives focus trapping, Escape-to-close and a real top-layer backdrop with no library. This is already proven in this codebase by `WelcomeModal`.

**Two jsdom limitations that are already solved — do not re-solve them differently:**
1. jsdom implements no `showModal`/`close` at all. `installDialogPolyfill()` in `tests/ui/render-helpers.tsx` supplies both and is already called from `tests/ui/setup.ts`. It is available to your test for free.
2. jsdom does not apply the UA rule that hides a closed dialog's content, so a closed dialog's children are still findable by queries. The existing answer is to render `null` until the component decides to show — follow that, do not rely on the closed state hiding anything.

**Tests to write:**
- Renders nothing at all when `open` is false — `expect(screen.queryByRole("dialog")).not.toBeInTheDocument()`.
- Renders its children when `open` is true.
- Calls `onClose` when the dialog fires its `close` event.
- Is labelled by the element named in `labelledBy`.

---

### Task 9: Toast

**Files:** `src/components/ui/Toast.tsx`, `Toast.module.css`, `tests/ui/primitives/Toast.test.tsx`

**Interfaces:** `Toast` — props `{ tone?: "info" | "error"; children: ReactNode }`, plus `ToastViewport` for positioning.

**Scope boundary:** this is the *presentation* only. `src/context/ToastContext.tsx` is untouched by this plan — the queue, timing and dismissal logic already exist and are not part of the visual layer.

**Tests to write:**
- Renders with `role="status"` for `info` and `role="alert"` for `error`. The tone changes the politeness of the announcement, not only the colour — an error that is announced politely may never be heard.
- Renders its message text.
- The viewport uses logical positioning: assert the class, and verify the actual placement in the browser rather than in jsdom.

**Point C4 ends here.** Full review, then stop.

---

## Module C exit conditions

Module C is complete when all of these are true, each verified rather than assumed:

- [ ] `npm test` green, and the new test count recorded (baseline: 292 across 12 suites).
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all green.
- [ ] The token contrast test passes for every pair in both themes.
- [ ] The breakpoint audit passes, with exactly four exempt pre-rebuild files.
- [ ] Six primitives exist, each with tests.
- [ ] `--sc-*` tokens still resolve and the live app is visually unchanged — Module C adds foundations, it does not alter any existing view.
- [ ] The app has been loaded in the browser in **both** languages and **both** themes, and nothing regressed.
- [ ] `docs/upgrade-checklist.md` has C2, C3 and C4 ticked with dates.
- [ ] Nothing pushed to `fork/main`.
