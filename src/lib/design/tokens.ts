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
  | "accentContrast"
  | "danger"
  | "dangerSurface";

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

      // Not in the original ten. The spec never discussed status colour, and
      // the omission only became visible at D2, where a validation form needs
      // to say "this is wrong" — see docs/decision-log.md entry 32.
      danger: "#b91c1c",
      // dangerSurface measures ~1.09:1 against ground — the tint is barely
      // distinguishable on its own. The error banner's non-text contrast
      // (WCAG 1.4.11) is carried entirely by the 2px --c-danger border drawn
      // on top of it (InputForm.module.css .errorBanner), not by this fill.
      // Do not drop that border as a "simplification" — it is the only thing
      // making the banner's boundary visible.
      dangerSurface: "#fef2f2",
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

      danger: "#fca5a5",
      // Same ~1.09:1-against-ground story as light above — the border, not
      // this fill, carries the banner's non-text contrast.
      dangerSurface: "#2a1416",
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
