// src/lib/design/breakpoints.ts
//
// The four approved breakpoints (owner: Yousef) — Module C.
//
// These values cannot be enforced by CSS. A custom property is not valid inside
// a media-query condition, and the alternative — @custom-media — needs a
// PostCSS plugin, which is a dependency this project does not want. So the
// literals are repeated in each stylesheet and enforced by
// tests/evaluation/breakpoint-audit.test.ts instead. The test is the source of
// truth; this file is what the test reads.
//
// Phone is the base case: styles outside any media query are the phone styles,
// and every breakpoint above adds rather than undoes. That direction is also
// audited — a max-width query fails even when its number is on this list,
// because max-width is this rule inverted.
//
// Two of these bands have no equivalent in the pre-rebuild app, whose widest
// breakpoint was 42rem and whose every query was a max-width phone patch.

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
