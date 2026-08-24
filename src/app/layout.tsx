// src/app/layout.tsx
//
// Root shell: design tokens, pre-paint theme/direction application, providers.
//
// THEMING MODEL — read before editing the token blocks below.
// Themes are driven by a `.dark` class on <html>, not by `prefers-color-scheme`
// alone. The media query cannot express "user explicitly chose light while
// their OS is dark", which is a real preference this app has to honour. The OS
// setting is still respected: it is the default that ThemeContext resolves
// 'system' against, and the inline script applies the result before first
// paint. Every color must therefore be defined once on `:root` and redefined
// on `:root.dark` — never inside a bare media query, or an explicit choice
// silently loses to the OS.
//
// `color-scheme` is set imperatively by the same script/provider rather than
// declared in CSS, so native controls (scrollbars, date pickers, form fields)
// follow the *chosen* theme instead of the OS one.

import type { Metadata } from "next";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/context/ThemeContext";
import { LANGUAGE_INIT_SCRIPT } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "ScopeCraft",
  description: "Turn an idea into a structured product plan.",
};

const rootStyle = `
  :root {
    --bg: #ffffff;
    --fg: #1a1c22;
    --sc-text: #1a1c22;
    --sc-text-muted: #5a6070;
    --sc-border: #d7dbe6;
    --sc-border-strong: #8b93a7;
    --sc-surface: #ffffff;
    --sc-surface-subtle: #f4f6fa;
    --sc-surface-raised: #ffffff;
    --sc-surface-header: rgba(255, 255, 255, 0.85);
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
    --sc-shadow-lg: 0 10px 24px rgba(20, 22, 30, 0.12), 0 2px 6px rgba(20, 22, 30, 0.08);

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

  :root.dark {
    --bg: #0f1116;
    --fg: #e8eaf0;
    --sc-text: #e8eaf0;
    --sc-text-muted: #a2a9bb;
    --sc-border: #2f3542;
    --sc-border-strong: #6b7385;
    --sc-surface: #0f1116;
    --sc-surface-subtle: #171a21;
    --sc-surface-raised: #1b1f28;
    --sc-surface-header: rgba(15, 17, 22, 0.85);
    --sc-accent: #8ea6ff;
    --sc-accent-contrast: #0f1116;
    --sc-accent-subtle: #212a47;
    --sc-danger: #ff9b95;
    --sc-danger-surface: #2a1618;
    --sc-warning: #e8b74f;
    --sc-warning-surface: #2c2412;
    --sc-success: #6fd39b;
    --sc-success-surface: #10261b;
    --sc-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(0, 0, 0, 0.35);
    --sc-shadow-lg: 0 10px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4);

    --sc-must: #ff9b95;
    --sc-must-surface: #2a1618;
    --sc-should: #e8b74f;
    --sc-should-surface: #2c2412;
    --sc-could: #8fb8e8;
    --sc-could-surface: #172538;
    --sc-wont: #a2a9bb;
    --sc-wont-surface: #23262f;
  }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    transition: background-color 160ms ease, color 160ms ease;
  }

  /* Arabic renders better with a face that has proper Arabic coverage; the
     stack falls through to the Latin default for en. */
  :root[lang="ar"] body {
    font-family: "Segoe UI", Tahoma, "Noto Naskh Arabic", system-ui, sans-serif;
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
    // lang/dir are the server's best guess; the inline script corrects both
    // before paint if the visitor previously chose Arabic.
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <style>{rootStyle}</style>
        {/* Blocking on purpose: both must run before first paint, or the page
            visibly flashes the wrong theme and the wrong direction. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
