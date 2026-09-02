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

Six tasks, one per primitive. Each is written in full and stands on its own.
**Read Task 4 before any other** — Button establishes the pattern the rest
follow: token usage, the 44px target, the focus treatment, logical properties,
and what is and is not testable in jsdom.

**On the staged expansion, recorded so the history reads honestly:** Tasks 5–9
were originally written as interfaces, test lists and styling rules without
literal code, deliberately and with the reason stated. C2 and C3 were reviewed
and accepted before C4 began, and either review could have changed what the
primitives should look like; writing five components in full beforehand would
have been writing code against decisions not yet made.

**They were expanded to full code on 2026-09-02**, after C2 and C3 were
accepted and Button was built and verified in the browser. Expanding them
against a real, working example rather than an imagined one caught two things
that the sketch had wrong, both in Task 9 — the toast tone count, and a second
live region that would have made every toast announce twice.

A note on testing that applies to all six: `jest.config.js` maps `*.module.css`
to `identity-obj-proxy`, so `styles.foo` returns the string `"foo"` and **no
computed style is available in jsdom.** Do not write tests that assert colours,
spacing or media-query behaviour — they cannot work. Test roles, accessible
names, attributes, and behaviour. Visual and responsive verification happens in
the browser, and is recorded as evidence, not as a unit test.

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

**Files:**
- Create: `src/components/ui/Card.tsx`, `src/components/ui/Card.module.css`
- Test: `tests/ui/primitives/Card.test.tsx`

**Interfaces:**
- Consumes: token custom properties from Task 2.
- Produces: `Card` — props `{ as?: "div" | "article" | "li"; recessed?: boolean; muted?: boolean; className?: string; children: ReactNode }`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/primitives/Card.test.tsx`:

```tsx
// tests/ui/primitives/Card.test.tsx
//
// A Card carries no behaviour, so what is worth testing is the shape of the
// element it produces and the promise that it stays inert. The visual half —
// that a light card is lifted by its rule and a dark one by its fill — cannot
// be tested in jsdom and is verified in the browser instead.

import { render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Sprint 1</Card>);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("renders a div by default", () => {
    const { container } = render(<Card>plain</Card>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("renders the element named by `as`", () => {
    render(<Card as="article">a story</Card>);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("renders an li when asked, for use inside a real list", () => {
    render(
      <ul>
        <Card as="li">a plan</Card>
      </ul>
    );
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("applies the recessed class only when asked", () => {
    const { container, rerender } = render(<Card>default</Card>);
    expect(container.firstElementChild).not.toHaveClass("recessed");

    rerender(<Card recessed>deferred</Card>);
    expect(container.firstElementChild).toHaveClass("recessed");
  });

  it("applies the muted class only when asked", () => {
    const { container } = render(<Card muted>deferred</Card>);
    expect(container.firstElementChild).toHaveClass("muted");
  });

  // A card is a surface, not a control. If one ever needs to be clickable, the
  // button goes inside it — a clickable div is the accessibility bug this
  // primitive exists to make hard to write.
  it("is inert: it contributes no button or link of its own", () => {
    render(<Card>just content</Card>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps a caller's own className alongside its own", () => {
    const { container } = render(<Card className="wide">x</Card>);
    expect(container.firstElementChild).toHaveClass("wide");
    expect(container.firstElementChild).toHaveClass("card");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/ui/primitives/Card.test.tsx
```

Expected: FAIL — cannot resolve `@/components/ui/Card`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Card.tsx`:

```tsx
// src/components/ui/Card.tsx
//
// Card primitive (owner: Yousef) — Module C.
//
// A surface, never a control. There is deliberately no `onClick` prop: a
// clickable div is invisible to the keyboard and unnamed to a screen reader,
// and every codebase acquires them one convenience at a time. If a card needs
// an action, the action is a real <button> inside it.
//
// `as` exists because the right element depends on context — an article in a
// list of plans, an li inside a real <ul>, a div when it is only a container.
// Getting that wrong is a semantics bug, so the choice is explicit at the call
// site rather than guessed here.

import type { ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps {
  as?: "div" | "article" | "li";
  /** The deferred column's surface: a step back rather than forward. */
  recessed?: boolean;
  /** Dashed rule — content that is present but not committed to. */
  muted?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Element = "div",
  recessed = false,
  muted = false,
  className,
  children,
}: CardProps) {
  return (
    <Element
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

Create `src/components/ui/Card.module.css`:

```css
/* src/components/ui/Card.module.css
 *
 * Elevation is expressed differently per theme, and that asymmetry is the
 * point rather than an oversight: on white a panel is the same colour as the
 * page and is lifted by its hairline rule; on black it is lifted by a lighter
 * fill. Both come from the tokens, so THIS FILE MUST NOT SPECIAL-CASE DARK.
 * A `:root.dark` block here would be the first crack in that arrangement.
 */

.card {
  background: var(--c-panel);
  border: 1px solid var(--c-rule);
  border-radius: var(--radius-sm);
  padding: var(--space-4);

  /* Lists of cards are the common case, and a list that carries its own
     bullets and indentation is never what is wanted. */
  list-style: none;
  margin: 0;
}

.recessed {
  background: var(--c-panel-recessed);
}

/* Dashed, not faded: opacity would drag the text below its contrast floor,
   and the text inside a deferred card still has to be readable. */
.muted {
  border-style: dashed;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/ui/primitives/Card.test.tsx
```

Expected: PASS, eight cases.

- [ ] **Step 5: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Card.module.css tests/ui/primitives/Card.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): Card primitive"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

---

### Task 6: Chip

**Files:**
- Create: `src/components/ui/Chip.tsx`, `src/components/ui/Chip.module.css`
- Test: `tests/ui/primitives/Chip.test.tsx`

**Interfaces:**
- Consumes: token custom properties from Task 2.
- Produces: `Chip` — props `{ weight?: "solid" | "outline" | "dashed"; className?: string; children: ReactNode }`.

**The rule this primitive exists to enforce:** MoSCoW is encoded by **fill weight, not hue** — MUST solid, SHOULD outline, COULD dashed. Direction C's coloured chips made colour the information, which fails WCAG 1.4.1. The `weight` prop has no colour variants and **must not gain any**.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/primitives/Chip.test.tsx`:

```tsx
// tests/ui/primitives/Chip.test.tsx
//
// The test that matters here is the last one. A chip's bucket must be legible
// without colour — that is a WCAG 1.4.1 obligation, not a stylistic choice —
// and the way this component keeps that promise is by having no colour props
// at all and always rendering its label as text.

import { render, screen } from "@testing-library/react";
import { Chip } from "@/components/ui/Chip";

describe("Chip", () => {
  it("renders its text content", () => {
    render(<Chip>MUST</Chip>);
    expect(screen.getByText("MUST")).toBeInTheDocument();
  });

  it("defaults to the outline weight", () => {
    const { container } = render(<Chip>SHOULD</Chip>);
    expect(container.firstElementChild).toHaveClass("outline");
  });

  it.each(["solid", "outline", "dashed"] as const)("applies the %s weight class", (weight) => {
    const { container } = render(<Chip weight={weight}>bucket</Chip>);
    expect(container.firstElementChild).toHaveClass(weight);
  });

  // The guarantee, stated as a test: the bucket is readable text, so it
  // survives greyscale, colour blindness and a screen reader alike. If someone
  // later adds a `tone` or `colour` prop, this is the test that should stop
  // them — the information may never live in the fill alone.
  it("carries its meaning as text, not as colour", () => {
    render(<Chip weight="dashed">COULD</Chip>);
    expect(screen.getByText("COULD")).toBeInTheDocument();
  });

  it("keeps a caller's own className alongside its own", () => {
    const { container } = render(<Chip className="inline">WON'T</Chip>);
    expect(container.firstElementChild).toHaveClass("inline");
    expect(container.firstElementChild).toHaveClass("chip");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/ui/primitives/Chip.test.tsx
```

Expected: FAIL — cannot resolve `@/components/ui/Chip`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Chip.tsx`:

```tsx
// src/components/ui/Chip.tsx
//
// Chip primitive (owner: Yousef) — Module C.
//
// MoSCoW is encoded by fill weight, not hue: MUST solid, SHOULD outline,
// COULD dashed. This is a WCAG 1.4.1 obligation — the rejected direction used
// red and teal chips, which makes colour the information and leaves anyone who
// cannot distinguish them with nothing.
//
// So there is no `tone`, no `colour` and no `variant` prop here, and adding one
// would undo the reason the component exists. The bucket name is always
// rendered as text, which is what actually carries the meaning; the weight only
// reinforces it.

import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export interface ChipProps {
  weight?: "solid" | "outline" | "dashed";
  className?: string;
  children: ReactNode;
}

export function Chip({ weight = "outline", className, children }: ChipProps) {
  return (
    <span className={[styles.chip, styles[weight], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
```

Create `src/components/ui/Chip.module.css`:

```css
/* src/components/ui/Chip.module.css
 *
 * Three weights, one colour. The fill carries emphasis; the text carries the
 * meaning. Nothing in this file may introduce a hue that encodes a bucket —
 * see the component header for why.
 */

.chip {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.3;

  padding-block: var(--space-1);
  padding-inline: var(--space-2);

  border: 1px solid var(--c-text);
  border-radius: var(--radius-none);
  white-space: nowrap;
}

.solid {
  background: var(--c-text);
  color: var(--c-ground);
}

.outline {
  background: transparent;
  color: var(--c-text);
}

.dashed {
  background: transparent;
  color: var(--c-text-muted);
  border-color: var(--c-text-muted);
  border-style: dashed;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/ui/primitives/Chip.test.tsx
```

Expected: PASS, seven cases.

- [ ] **Step 5: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Chip.tsx src/components/ui/Chip.module.css tests/ui/primitives/Chip.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): Chip primitive, weight not hue"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

---

### Task 7: Field

**Files:**
- Create: `src/components/ui/Field.tsx`, `src/components/ui/Field.module.css`
- Test: `tests/ui/primitives/Field.test.tsx`

**Interfaces:**
- Consumes: token custom properties from Task 2.
- Produces: `Field` — props `{ id: string; label: string; hint?: string; error?: string; children: ReactElement<FieldControlProps> }`, where `FieldControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: true }`.

**Why this primitive exists:** every accessible-name and description failure in a form is the same bug — a label that is near a control rather than attached to it. Doing that wiring by hand at each call site is where it goes wrong, so it is done exactly once here.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/primitives/Field.test.tsx`:

```tsx
// tests/ui/primitives/Field.test.tsx
//
// getByLabelText is the assertion that matters most in this file: it only
// succeeds when the label is genuinely associated with the control, so it
// fails for the exact bug this primitive exists to prevent — a label that
// merely sits next to an input.

import { render, screen } from "@testing-library/react";
import { Field } from "@/components/ui/Field";

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field id="idea" label="Product idea">
        <textarea />
      </Field>
    );
    expect(screen.getByLabelText("Product idea")).toBeInTheDocument();
  });

  it("links a hint through aria-describedby", () => {
    render(
      <Field id="idea" label="Product idea" hint="One or two sentences.">
        <textarea />
      </Field>
    );

    const control = screen.getByLabelText("Product idea");
    const hint = screen.getByText("One or two sentences.");

    expect(hint.id).toBeTruthy();
    expect(control.getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("links an error and marks the control invalid", () => {
    render(
      <Field id="idea" label="Product idea" error="Required.">
        <textarea />
      </Field>
    );

    const control = screen.getByLabelText("Product idea");
    const error = screen.getByText("Required.");

    expect(control.getAttribute("aria-describedby")).toContain(error.id);
    expect(control).toHaveAttribute("aria-invalid", "true");
  });

  it("references both hint and error when both are present", () => {
    render(
      <Field id="idea" label="Product idea" hint="One or two sentences." error="Required.">
        <textarea />
      </Field>
    );

    const control = screen.getByLabelText("Product idea");
    const describedBy = control.getAttribute("aria-describedby") ?? "";

    expect(describedBy).toContain(screen.getByText("One or two sentences.").id);
    expect(describedBy).toContain(screen.getByText("Required.").id);
  });

  // aria-invalid="false" is a valid value that some assistive tech announces.
  // A field that is simply not yet filled in is not invalid, and saying so out
  // loud on every control in a form is noise.
  it("sets no aria-invalid attribute at all when there is no error", () => {
    render(
      <Field id="idea" label="Product idea">
        <textarea />
      </Field>
    );
    expect(screen.getByLabelText("Product idea")).not.toHaveAttribute("aria-invalid");
  });

  it("sets no aria-describedby when there is neither hint nor error", () => {
    render(
      <Field id="idea" label="Product idea">
        <textarea />
      </Field>
    );
    expect(screen.getByLabelText("Product idea")).not.toHaveAttribute("aria-describedby");
  });

  // The control keeps ownership of its own value and handlers; this primitive
  // supplies identity and description only.
  it("leaves the control's own props untouched", () => {
    render(
      <Field id="capacity" label="Capacity">
        <input type="number" defaultValue={40} />
      </Field>
    );

    const control = screen.getByLabelText("Capacity");
    expect(control).toHaveAttribute("type", "number");
    expect(control).toHaveValue(40);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/ui/primitives/Field.test.tsx
```

Expected: FAIL — cannot resolve `@/components/ui/Field`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Field.tsx`:

```tsx
// src/components/ui/Field.tsx
//
// Field primitive (owner: Yousef) — Module C.
//
// Every accessible-name failure in a form is the same bug: a label that is
// near a control instead of attached to it. It looks correct on screen and is
// invisible to a screen reader, and it happens because the wiring is repeated
// by hand at each call site. It is done exactly once here instead.
//
// cloneElement supplies only identity and description — id, aria-describedby,
// aria-invalid. The control keeps its own value, handlers and type, because a
// primitive that took ownership of those would have to grow a prop for every
// kind of input this app will ever have.

import { cloneElement, type ReactElement } from "react";
import styles from "./Field.module.css";

/** The subset of props this primitive injects into its child control. */
export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<FieldControlProps>;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Order matters to a screen reader: the hint describes what to enter, the
  // error says what went wrong with what was entered.
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        // Never `false`. aria-invalid="false" is announced by some assistive
        // tech, and an empty field is not an invalid one.
        "aria-invalid": error ? true : undefined,
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

Create `src/components/ui/Field.module.css`:

```css
/* src/components/ui/Field.module.css
 *
 * The error text is not red-only. Colour alone would fail WCAG 1.4.1, and the
 * message itself is what carries the fault — the weight and the rule beside it
 * are reinforcement, not the signal.
 */

.field {
  display: grid;
  gap: var(--space-2);
}

.label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text);
}

.hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--c-text-muted);
}

.error {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--c-text);
  border-inline-start: 2px solid var(--c-text);
  padding-inline-start: var(--space-2);
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/ui/primitives/Field.test.tsx
```

Expected: PASS, seven cases.

**If `cloneElement` fails to typecheck:** the child is typed `ReactElement<FieldControlProps>` precisely so the injected props are known to TypeScript. Do not reach for `any` or a cast — if it errors, the child's own prop type is the thing to look at, and the fix belongs in `FieldControlProps`.

- [ ] **Step 5: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Field.tsx src/components/ui/Field.module.css tests/ui/primitives/Field.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): Field primitive, label wiring done once"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

---

### Task 8: Dialog

**Files:**
- Create: `src/components/ui/Dialog.tsx`, `src/components/ui/Dialog.module.css`
- Test: `tests/ui/primitives/Dialog.test.tsx`

**Interfaces:**
- Consumes: token custom properties from Task 2; `installDialogPolyfill` already wired into `tests/ui/setup.ts`.
- Produces: `Dialog` — props `{ open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }`.

**Use the native `<dialog>` element with `showModal()`.** It gives focus trapping, Escape-to-close and a real top-layer backdrop with no library. Already proven in this codebase by `WelcomeModal`.

**Two jsdom limitations that are already solved — do not re-solve them differently:**
1. jsdom implements no `showModal`/`close` at all. `installDialogPolyfill()` in `tests/ui/render-helpers.tsx` supplies both and is already called from `tests/ui/setup.ts`. Your test gets it for free.
2. jsdom does not apply the UA rule that hides a closed dialog's content, so a closed dialog's children remain findable by queries. The answer already used here is to render `null` until the component decides to show. Follow that; do not rely on the closed state hiding anything.

**Difference from `WelcomeModal`:** that component owns its own open state and its own "seen" flag. This primitive is **controlled** — the parent owns `open`. Do not copy the localStorage logic into it.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/primitives/Dialog.test.tsx`:

```tsx
// tests/ui/primitives/Dialog.test.tsx
//
// The first test is the load-bearing one, and it is not obvious why. jsdom
// does not apply the UA stylesheet rule that hides a closed <dialog>'s
// children, so a component that merely rendered a closed dialog would still
// leak its content into every query on the page — which is exactly the bug
// that was found and fixed in WelcomeModal. Rendering null is the fix, and
// this asserts it.

import { render, screen } from "@testing-library/react";
import { Dialog } from "@/components/ui/Dialog";

describe("Dialog", () => {
  it("renders nothing at all when closed", () => {
    render(
      <Dialog open={false} onClose={jest.fn()} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
  });

  it("renders its children when open", () => {
    render(
      <Dialog open onClose={jest.fn()} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });

  it("opens modally rather than merely being present", () => {
    render(
      <Dialog open onClose={jest.fn()} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    // The polyfill records showModal() by setting the open attribute.
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
  });

  it("takes its accessible name from the element named by labelledBy", () => {
    render(
      <Dialog open onClose={jest.fn()} labelledBy="dialog-title">
        <h2 id="dialog-title">Welcome to ScopeCraft</h2>
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "Welcome to ScopeCraft" })).toBeInTheDocument();
  });

  // Escape closes a native dialog without any handler of ours running, so
  // onClose must be driven by the element's own close event or a dismissal
  // that did not come from our button would go unrecorded.
  it("calls onClose when the dialog fires its close event", () => {
    const onClose = jest.fn();
    render(
      <Dialog open onClose={onClose} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    (screen.getByRole("dialog") as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/ui/primitives/Dialog.test.tsx
```

Expected: FAIL — cannot resolve `@/components/ui/Dialog`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Dialog.tsx`:

```tsx
// src/components/ui/Dialog.tsx
//
// Dialog primitive (owner: Yousef) — Module C.
//
// Native <dialog> with showModal(), not a hand-rolled overlay: focus trapping,
// Escape-to-close, inert background and a real top-layer backdrop all come for
// free, and each one is a thing a div-based modal gets subtly wrong.
//
// Not rendered at all until open, rather than rendered closed and hidden by
// the UA's `dialog:not([open])` rule. A closed dialog's children are still
// real DOM nodes, that rule is not applied by every environment — jsdom does
// not apply it — and content leaking out of a closed modal was a real bug here
// once already.
//
// Controlled: the parent owns `open`. WelcomeModal owns its own state and its
// own seen-flag; that logic stays there and does not belong in a primitive.

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the heading that names this dialog. */
  labelledBy: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // showModal() only works once the element exists, which is after the render
  // that `open` turned on — hence an effect rather than a call during render.
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      // The element's own close event, not the button's click: Escape closes a
      // native dialog without any handler of ours running, and a dismissal
      // that goes unrecorded is how a modal comes back after you closed it.
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
```

Create `src/components/ui/Dialog.module.css`:

```css
/* src/components/ui/Dialog.module.css
 *
 * The UA gives <dialog> its own margin, border and padding; all three are
 * reset here so the panel is the token system's, not the browser's.
 */

.dialog {
  margin: auto;
  inline-size: min(32rem, calc(100vw - var(--space-6)));

  background: var(--c-panel);
  color: var(--c-text);
  border: 1px solid var(--c-rule);
  border-radius: var(--radius-sm);
  padding: var(--space-6);
}

.dialog::backdrop {
  background: rgb(0 0 0 / 0.5);
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/ui/primitives/Dialog.test.tsx
```

Expected: PASS, five cases.

- [ ] **Step 5: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Dialog.tsx src/components/ui/Dialog.module.css tests/ui/primitives/Dialog.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): Dialog primitive on native <dialog>"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

---

### Task 9: Toast

**Files:**
- Create: `src/components/ui/Toast.tsx`, `src/components/ui/Toast.module.css`
- Test: `tests/ui/primitives/Toast.test.tsx`

**Interfaces:**
- Consumes: token custom properties from Task 2.
- Produces: `Toast` — props `{ tone?: "success" | "error" | "info"; className?: string; children: ReactNode }`.

**Two corrections to this task as originally sketched, found by reading `src/components/common/Toast.tsx` before writing it:**

1. **Three tones, not two.** The existing viewport supports `success`, `error` and `info`, and `ToastContext` emits all three. A two-tone primitive could not absorb the existing component in Module D without dropping `success`.

2. **No `ToastViewport` in this primitive.** The sketch called for one. The existing `ToastViewport` is already a live region (`role="status" aria-live="polite"`) rendered once from `providers.tsx`, and adding a second live region would mean **every toast is announced twice** for as long as both exist. The primitive is therefore a single toast's presentation only, and Module D re-implements the existing viewport's *insides* using it, leaving exactly one live region in the tree.

**A real accessibility finding, recorded rather than fixed here:** the existing viewport wraps *all* tones — errors included — in one `aria-live="polite"` region, so an error waits for a pause in speech before it is announced. This primitive gives an error `role="alert"` (assertive) instead. That is only half a fix: while the outer polite region still exists, Module D must resolve the nesting when it migrates the viewport. **Do not change `common/Toast.tsx` in this task** — it is a live component and its migration is Module D's, with its own review.

**Scope boundary:** presentation only. `src/context/ToastContext.tsx` is untouched — the queue, timing and dismissal logic already exist and are not part of the visual layer.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/primitives/Toast.test.tsx`:

```tsx
// tests/ui/primitives/Toast.test.tsx
//
// Tone changes how the message is announced, not just how it looks. An error
// routed through a polite live region waits for a pause in speech, which for a
// failed generation can mean the user acts on a plan that was never produced.
// That is why role is asserted per tone here and not treated as styling.

import { render, screen } from "@testing-library/react";
import { Toast } from "@/components/ui/Toast";

describe("Toast", () => {
  it("renders its message", () => {
    render(<Toast>Plan saved.</Toast>);
    expect(screen.getByText("Plan saved.")).toBeInTheDocument();
  });

  it("announces an error assertively", () => {
    render(<Toast tone="error">Generation failed.</Toast>);
    expect(screen.getByRole("alert")).toHaveTextContent("Generation failed.");
  });

  it.each(["success", "info"] as const)("announces %s politely", (tone) => {
    render(<Toast tone={tone}>Saved.</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("defaults to the info tone", () => {
    const { container } = render(<Toast>Heads up.</Toast>);
    expect(container.firstElementChild).toHaveClass("info");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it.each(["success", "error", "info"] as const)("applies the %s tone class", (tone) => {
    const { container } = render(<Toast tone={tone}>message</Toast>);
    expect(container.firstElementChild).toHaveClass(tone);
  });

  // The tone must survive greyscale: the message text is the information, and
  // the colour only reinforces it. A toast whose meaning is carried by its
  // background alone fails WCAG 1.4.1 the same way a coloured chip would.
  it("carries its meaning as text rather than colour", () => {
    render(<Toast tone="error">Could not reach the planner.</Toast>);
    expect(screen.getByText("Could not reach the planner.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- tests/ui/primitives/Toast.test.tsx
```

Expected: FAIL — cannot resolve `@/components/ui/Toast`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Toast.tsx`:

```tsx
// src/components/ui/Toast.tsx
//
// Toast primitive (owner: Yousef) — Module C.
//
// Tone decides how the message is announced, not only how it looks. An error
// sent through a polite live region waits for a pause in speech; for a failed
// generation that can mean acting on a plan that was never produced. So error
// is role="alert" and everything else is role="status".
//
// There is deliberately no viewport here. src/components/common/Toast.tsx is
// already a live region rendered once from providers.tsx, and a second one
// would announce every toast twice. Module D re-implements that component's
// insides with this primitive, leaving exactly one live region in the tree.

import type { ReactNode } from "react";
import styles from "./Toast.module.css";

export interface ToastProps {
  tone?: "success" | "error" | "info";
  className?: string;
  children: ReactNode;
}

export function Toast({ tone = "info", className, children }: ToastProps) {
  return (
    <div
      className={[styles.toast, styles[tone], className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
```

Create `src/components/ui/Toast.module.css`:

```css
/* src/components/ui/Toast.module.css
 *
 * Tone is reinforced by a rule on the inline start edge rather than by a
 * coloured fill. The message text is what carries the meaning — the same rule
 * that governs Chip — and a border-inline-start flips correctly under RTL
 * where a border-left would strand it on the wrong edge.
 */

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-2);

  padding-block: var(--space-3);
  padding-inline: var(--space-4);

  background: var(--c-panel);
  color: var(--c-text);
  border: 1px solid var(--c-rule);
  border-inline-start-width: 3px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.info {
  border-inline-start-color: var(--c-rule-strong);
}

.success {
  border-inline-start-color: var(--c-accent);
}

/* Deliberately the strongest edge available in the token set rather than a red
   that is not in it. Adding a semantic red would mean adding a colour whose
   contrast is unasserted, and the alert role already carries the urgency. */
.error {
  border-inline-start-color: var(--c-text);
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- tests/ui/primitives/Toast.test.tsx
```

Expected: PASS, nine cases.

- [ ] **Step 5: Run all four gates**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Toast.tsx src/components/ui/Toast.module.css tests/ui/primitives/Toast.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" \
  commit -m "feat(ui): Toast primitive, tone drives politeness"
git log -1 --format=%B | grep -i co-authored && echo "TRAILER PRESENT - FIX IT" || echo "clean"
```

**Point C4 ends here.** Full review, then stop.

---

## Module C exit conditions

Module C is complete when all of these are true, each verified rather than assumed:

- [ ] `npm test` green, and the new test count recorded.
      **Baseline: 293 tests across 12 suites**, measured at `8ea895c`. An earlier
      figure of 292 circulated in this session and is wrong — it was taken before
      the Google OAuth merge (`ca6f3e7`), which added one test. Corrected during
      Task 1 after the reviewer flagged the arithmetic not reconciling.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all green.
- [ ] The token contrast test passes for every pair in both themes.
- [ ] The breakpoint audit passes, with exactly four exempt pre-rebuild files.
- [ ] Six primitives exist, each with tests.
- [ ] `--sc-*` tokens still resolve and the live app is visually unchanged — Module C adds foundations, it does not alter any existing view.
- [ ] The app has been loaded in the browser in **both** languages and **both** themes, and nothing regressed.
- [ ] `docs/upgrade-checklist.md` has C2, C3 and C4 ticked with dates.
- [ ] Nothing pushed to `fork/main`.
