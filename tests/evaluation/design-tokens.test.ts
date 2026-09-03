// tests/evaluation/design-tokens.test.ts
//
// The spec calls every light/dark pair "a contrast obligation, not a
// suggestion". This is that obligation, executable. It fails if someone
// darkens a muted grey or brightens an accent past the point where it still
// clears AA — which is exactly the change that gets made by eye and shipped.

import { readFileSync } from "node:fs";
import { contrastRatio } from "@/lib/design/contrast";
import { tokens } from "@/lib/design/tokens";
import { tokenCss } from "@/lib/design/css";

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

  // The loading state's elapsed counter is muted text on a panel, not on
  // ground — the same role, a different surface, and its own obligation.
  it.each(themes)("%s: muted text on a panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.textMuted, t.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("%s: accent on ground clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.accent, t.ground)).toBeGreaterThanOrEqual(4.5);
  });

  // The loading state's completed step takes --c-accent on --c-panel.
  it.each(themes)("%s: accent on a panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.accent, t.panel)).toBeGreaterThanOrEqual(4.5);
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

  // The WON'T chip is faint text on a story card, not on the page ground.
  // It measures 4.54:1 light / 5.88:1 dark, so it is held to the full 4.5
  // rather than the 3:1 large-text floor it gets on ground — a bucket label
  // nobody can read is a bucket label that is not doing its job.
  it.each(themes)("%s: faint text on a panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.textFaint, t.panel)).toBeGreaterThanOrEqual(4.5);
  });

  // Three pairs new at D5, none of which the capture can reach: it renders the
  // idle page only and never a board. The recessed surface is the deferred
  // column and the capacity percentage pill.
  it.each(themes)("%s: accent on a recessed panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.accent, t.panelRecessed)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("%s: muted text on a recessed panel clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.textMuted, t.panelRecessed)).toBeGreaterThanOrEqual(4.5);
  });

  // SC 1.4.11: a rule that separates content is a non-text contrast target.
  it.each(themes)("%s: strong rule on ground clears 3:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.ruleStrong, t.ground)).toBeGreaterThanOrEqual(3);
  });

  // The points input's border is the only thing marking it as a field, and it
  // sits on a card rather than on the page ground.
  it.each(themes)("%s: strong rule on a panel clears 3:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.ruleStrong, t.panel)).toBeGreaterThanOrEqual(3);
  });

  it.each(themes)("%s: text on the accent fill clears 4.5:1", (theme) => {
    const t = tokens.color[theme];
    expect(contrastRatio(t.accentContrast, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

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
});

describe("token completeness", () => {
  it("defines the same colour roles in both themes", () => {
    expect(Object.keys(tokens.color.light).sort()).toEqual(
      Object.keys(tokens.color.dark).sort()
    );
  });
});

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

// The invariant behind decision-log entry 31. D1 moved the header's two real
// buttons onto the Button primitive at 44px while the controls beside them in
// the same row stayed at 36px, leaving the signed-in header 8px uneven for
// four points. Point 2 closed it by matching the number.
//
// It is asserted from the stylesheets rather than from a render because jsdom
// resolves no CSS — identity-obj-proxy hands back the class name and nothing
// else, so a rendered check here would pass whatever the values were.
describe("header control target sizes", () => {
  function minBlockSizes(file: string): string[] {
    const css = readFileSync(file, "utf8");
    return [...css.matchAll(/min-block-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  }

  const buttonSizes = minBlockSizes("src/components/ui/Button.module.css");

  it("Button states exactly one target size", () => {
    expect(buttonSizes).toHaveLength(1);
    expect(buttonSizes[0]).toBe("2.75rem");
  });

  // The Home link, the history link, the theme toggle and the language
  // segmented control all live in this one file and all sit in the Button's
  // row. Any one of them drifting is the mismatch reopening.
  it("every toggle control matches the Button's target", () => {
    const toggleSizes = minBlockSizes("src/components/common/ToggleControls.module.css");
    expect(toggleSizes.length).toBeGreaterThan(0);
    for (const size of toggleSizes) {
      expect(size).toBe(buttonSizes[0]);
    }
  });
});
