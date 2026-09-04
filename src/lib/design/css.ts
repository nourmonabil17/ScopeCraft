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

/**
 * The motion scale collapsed for `prefers-reduced-motion: reduce`.
 *
 * Derived from the scale rather than listed by hand, so a token added to
 * tokens.ts is honoured here without anyone remembering to come back — which is
 * the same reason the colour block is generated.
 *
 * Durations only. `--motion-ease` is a timing curve, and a curve applied over
 * no time is not a thing that needs overriding.
 *
 * Not zero. A 0s transition does not fire `transitionend`, so any handler
 * waiting on that event would hang for exactly the users who asked for less
 * motion. 0.01ms is imperceptible and still fires.
 */
function reducedMotionBlock(): string {
  return Object.entries(tokens.motion)
    .filter(([, value]) => /(ms|s)$/.test(value))
    .map(([key]) => `      --motion-${key}: 0.01ms;`)
    .join("\n");
}

/**
 * The light palette, re-declared for print.
 *
 * Paper is white. The dark theme's text is a pale grey chosen to sit on a near
 * black ground, and printing it puts pale grey on white — the one contrast pair
 * this project measures everywhere else and would have shipped unmeasured here.
 *
 * A token concern rather than a per-file one, for exactly the reason the
 * reduced-motion block above is: every component already reads its colour from
 * `var(--c-*)`, so redefining the properties reaches all of them at once and a
 * component added later inherits the behaviour without remembering anything.
 *
 * Both selectors, and the order matters. `:root.dark` is (0,2,0) against bare
 * `:root`'s (0,1,0), so a print block naming only `:root` would lose to the
 * dark theme and print white-on-black — which is the failure this exists to
 * prevent, arriving silently and only on paper.
 */
function printColorBlock(): string {
  return Object.entries(tokens.color.light)
    .map(([role, value]) => `      --c-${kebab(role)}: ${value};`)
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

  /* Reduced motion is a TOKEN concern, not a per-file one (Module E1).
     Collapsing the durations here neutralises every var(--motion-*) in the
     tree at once — 15 declarations across 7 stylesheets — so a new component
     inherits the behaviour instead of remembering to add its own media query.
     Four files carried their own block before this landed; three of them were
     already redundant against the backstop in layout.tsx.

     This is deliberately a bare media query, which the colour tokens above are
     forbidden from using. The rule there exists because a theme can be chosen
     explicitly and a media query cannot express that choice. Motion has no such
     toggle — there is no in-app "play animations anyway" control, and the OS
     preference is the only input — so there is no explicit choice for a media
     query to lose to. If a motion toggle is ever added, this block has to
     become class-driven the same way .dark is. */
  @media (prefers-reduced-motion: reduce) {
    :root {
${reducedMotionBlock()}
    }
  }

  /* Print takes the light palette whichever theme is on screen. See
     printColorBlock. The structural print rules — what is hidden, what is
     revealed, page margins — live in layout.tsx; only colour is a token. */
  @media print {
    :root,
    :root.dark {
${printColorBlock()}
    }
  }
`;
}
