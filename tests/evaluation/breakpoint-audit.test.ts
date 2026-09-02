// tests/evaluation/breakpoint-audit.test.ts
//
// CSS custom properties are not usable inside a media-query condition —
// `@media (min-width: var(--bp-md))` is invalid and fails silently — and the
// alternative, @custom-media, needs a PostCSS plugin this project does not
// want. So the four approved widths cannot be enforced by CSS itself.
//
// This test is the enforcement instead. It reads every stylesheet under src and
// fails on two things: a width literal outside the approved four, and a
// max-width query.
//
// The max-width rule is the less obvious half and matters more. Before the
// rebuild the app had three ad-hoc breakpoints (30/34/42rem) and every one was
// a max-width patch bolted onto a desktop layout — which is why it had no
// tablet behaviour and nothing at all above 42rem. The spec's rule is that
// phone is the base case and each breakpoint above *adds* rather than undoes.
// A max-width query is that rule inverted, so it fails here even when its
// number happens to be an approved one.

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

/** Width conditions only. Feature queries — prefers-reduced-motion, hover,
 *  pointer, forced-colors — are unrelated to the breakpoint scale and are
 *  deliberately left alone. */
const WIDTH_QUERY = /@media[^{]*?\((min|max)-width:\s*([^)]+)\)/g;

// Stylesheets still on the pre-rebuild breakpoints. Each comes off this list
// when Module D rebuilds that view, and the list reaching empty is one of
// Module D's exit conditions.
//
// Adding a NEW file here is not allowed. The whole point of the audit is that
// work done from now on uses the scale, and an exemption list that can grow is
// not an exemption list — it is a way of never fixing anything.
const PRE_REBUILD_EXEMPT = [
  "src/components/common/ToggleControls.module.css",
  "src/components/scopecraft/InteractiveSprintBoard.module.css",
];

describe("breakpoint audit", () => {
  const all = stylesheetsUnder("src");
  const audited = all.filter((f) => !PRE_REBUILD_EXEMPT.includes(f));

  it("finds stylesheets to audit", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it.each(audited)("%s uses only approved breakpoints", (file) => {
    const css = readFileSync(file, "utf8");

    for (const [, direction, rawWidth] of css.matchAll(WIDTH_QUERY)) {
      const width = rawWidth.trim();
      expect(APPROVED_MIN_WIDTHS).toContain(width);
      // Phone-first: a breakpoint adds at a larger width, never subtracts at a
      // smaller one. See the header comment.
      expect(direction).toBe("min");
    }
  });

  it("the pre-rebuild exemption list has not grown", () => {
    // Measured at 4 on 2026-09-02. Header came off in D1, InputForm in D2.
    // Module D shrinks this to zero.
    expect(PRE_REBUILD_EXEMPT).toHaveLength(2);
  });

  it("every exempt file still exists", () => {
    // A renamed or deleted file would otherwise sit here forever, silently
    // exempting nothing and hiding that the list is stale.
    for (const file of PRE_REBUILD_EXEMPT) {
      expect(all).toContain(file);
    }
  });
});
