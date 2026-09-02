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
