// src/app/layout.tsx
//
// Root shell.
//
// `color-scheme: light dark` plus explicit background/text colors are required
// here, not optional polish. Without them, a page with no author-declared
// colors falls back to the browser's own dark-mode heuristic, which inverts the
// background but leaves default heading/paragraph text near-black — a
// reproducible WCAG 1.4.3 contrast failure. Caught by actually loading the page
// in a dark-mode browser, not by any linter: `<h1>ScopeCraft</h1>` rendered
// black text on a near-black auto-darkened background, effectively invisible.
// Declaring the scheme here means every page inherits correct contrast in both
// themes without having to remember to do this per page.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ScopeCraft",
  description: "Turn an idea into a structured product plan.",
};

// Shared design tokens, defined once so every component module reads the same
// palette instead of redeclaring light/dark blocks per file. New components
// added after Module 1 (InteractiveSprintBoard, ResultView, evidence/export
// panels, and the state components) all consume these; InputForm.module.css
// predates this and keeps its own local tokens rather than being churned for
// no functional gain.
const rootStyle = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #1a1c22;
    --sc-text: #1a1c22;
    --sc-text-muted: #5a6070;
    --sc-border: #c9cedb;
    --sc-border-strong: #8b93a7;
    --sc-surface: #ffffff;
    --sc-surface-subtle: #f5f6fa;
    --sc-surface-raised: #ffffff;
    --sc-accent: #2f4fd4;
    --sc-accent-contrast: #ffffff;
    --sc-accent-subtle: #e8ecfb;
    --sc-danger: #a3231f;
    --sc-danger-surface: #fdf2f2;
    --sc-warning: #8a5a00;
    --sc-warning-surface: #fff6e0;
    --sc-success: #157a45;
    --sc-success-surface: #e9f7ef;
    --sc-shadow: 0 1px 2px rgba(20, 22, 30, 0.08), 0 1px 1px rgba(20, 22, 30, 0.04);

    /* MoSCoW badge colors — distinct hues, not just weight, so bucket is never
       conveyed by color alone (each badge also carries its own text label). */
    --sc-must: #a3231f;
    --sc-must-surface: #fdf2f2;
    --sc-should: #8a5a00;
    --sc-should-surface: #fff6e0;
    --sc-could: #1c5fa8;
    --sc-could-surface: #eaf2fb;
    --sc-wont: #5a6070;
    --sc-wont-surface: #f0f1f5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161c;
      --fg: #e8eaf0;
      --sc-text: #e8eaf0;
      --sc-text-muted: #a2a9bb;
      --sc-border: #3d4351;
      --sc-border-strong: #6b7385;
      --sc-surface: #14161c;
      --sc-surface-subtle: #1c1f27;
      --sc-surface-raised: #20232d;
      --sc-accent: #8ea6ff;
      --sc-accent-contrast: #10131a;
      --sc-accent-subtle: #232a47;
      --sc-danger: #ff9b95;
      --sc-danger-surface: #2a1618;
      --sc-warning: #e8b74f;
      --sc-warning-surface: #2c2412;
      --sc-success: #6fd39b;
      --sc-success-surface: #10261b;
      --sc-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 1px rgba(0, 0, 0, 0.3);

      --sc-must: #ff9b95;
      --sc-must-surface: #2a1618;
      --sc-should: #e8b74f;
      --sc-should-surface: #2c2412;
      --sc-could: #8fb8e8;
      --sc-could-surface: #172538;
      --sc-wont: #a2a9bb;
      --sc-wont-surface: #23262f;
    }
  }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{rootStyle}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
