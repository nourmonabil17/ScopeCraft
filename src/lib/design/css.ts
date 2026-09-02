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
