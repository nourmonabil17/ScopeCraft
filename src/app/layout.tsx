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

import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/context/ThemeContext";
import { LANGUAGE_INIT_SCRIPT } from "@/context/LanguageContext";
import { tokenCss } from "@/lib/design/css";

export const metadata: Metadata = {
  title: "ScopeCraft",
  description: "Turn an idea into a structured product plan.",
};

/**
 * Matches --bg in each theme, so the mobile browser chrome does not sit at a
 * different colour from the page it frames. Lives on the `viewport` export
 * rather than `metadata` — Next moved themeColor there, and leaving it on
 * metadata is a build warning, not an error, so it would ship silently wrong.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1116" },
  ],
};

const rootStyle = `
  /* The token layer, generated from src/lib/design/tokens.ts.
     The legacy block that used to sit below this — two generations of token in
     one stylesheet — was deleted at Module D's final point, once every view had
     been migrated. The coexistence was deliberate for the whole of Module D:
     replacing both in one commit would have broken every view not yet rebuilt.

     The gate was a tree-wide count of legacy custom-property references
     reaching zero. That command is deliberately NOT quoted here: it greps for
     its own pattern, so writing it into a comment makes the count report 1 and
     the gate can never close. It lives in docs/upgrade-checklist.md instead. */
${tokenCss()}


  /* Skip link: off-screen until focused, then pinned above everything. The
     header is sticky, so a link that merely became visible could still be
     covered by it — hence the explicit z-index.

     Offsets are logical, not physical. A physical left: -9999px parks the link
     in unscrollable space under LTR, but under RTL that same offset lands in
     *scrollable* space: the document measured 11279px wide against a 1280px
     viewport, so every Arabic page scrolled ~10000px sideways. inset-inline-start
     resolves to whichever edge is the inline start, so it is off-screen in both
     directions — and the same reasoning applies to the corner radius below. */
  .sc-skip-link {
    position: absolute;
    inset-inline-start: -9999px;
    top: 0;
    z-index: 1000;
    padding: 0.6rem 1rem;
    background: var(--c-accent);
    color: var(--c-accent-contrast);
    border-start-start-radius: 0;
    border-start-end-radius: 0;
    border-end-start-radius: 0;
    border-end-end-radius: 6px;
    font: inherit;
    text-decoration: none;
  }
  .sc-skip-link:focus {
    inset-inline-start: 0;
  }

  /* The header is sticky, so any in-page anchor target — the skip link's
     destination above all — would otherwise land underneath it. Reserving more
     than the header's height means "skip to content" actually lands on content. */
  #main-content,
  [id][class*="title"],
  h1[id], h2[id], h3[id] {
    scroll-margin-top: 5rem;
  }

  /* The global box-sizing reset, added at Module D's final point. Until then
     each primitive that constrained its own size set this itself, because
     adding it mid-rebuild would have shifted every view that had not been
     redone yet.

     Three local declarations were removed when this landed. Their reasoning is
     kept here rather than lost with them, because each recorded a real measured
     bug and this rule is now the only thing preventing all three:

       - InputForm's textarea: horizontal padding and border were added OUTSIDE
         a 100% width, pushing the document ~10px wider than the viewport and
         giving every page a horizontal scrollbar below ~800px. Textareas
         default to content-box, so nothing inherited it.
       - Dialog: a 491px content box rendered 557px wide on a 529px viewport and
         pushed margin-inline-end to -28px.
       - Toast: same shape — a width cap plus padding overflowing its own cap.

     Anything that sets its own inline-size is relying on this rule. Removing it
     brings all three back at once. */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* Visible to screen readers only. One definition, replacing five identical
     copies that had accumulated across Field, InputForm, ExportActions,
     InteractiveSprintBoard and LoadingState — one per point that needed it,
     each unaware of the others. ExportActions' copy turned out to have no
     consumer at all.

     clip-path: inset(50%) rather than the deprecated clip: rect(), and logical
     sizing, so it behaves the same in both directions. */
  .sc-sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }

  /* Pointer ergonomics: removes the 300ms double-tap delay on touch and stops
     the grey flash on tap, which reads as a rendering glitch rather than
     feedback. Focus and hover styling carry the feedback instead. */
  button, a, [role="button"], input, select, textarea, summary {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    margin: 0;
    background: var(--c-ground);
    color: var(--c-text);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    transition: background-color var(--motion-base) var(--motion-ease),
      color var(--motion-base) var(--motion-ease);
  }

  /* Arabic renders better with a face that has proper Arabic coverage; the
     stack falls through to the Latin default for en. */
  :root[lang="ar"] body {
    font-family: "Segoe UI", Tahoma, "Noto Naskh Arabic", system-ui, sans-serif;
  }

  /* The backstop, not the primary mechanism. Since E1 the motion tokens
     collapse themselves under the same query (see src/lib/design/css.ts), which
     covers every duration written as var(--motion-*).

     This still earns its place, because a token cannot reach three things:
     the two ambient keyframe animations whose durations are deliberately off
     the scale (the header's 2.4s status pulse, the skeleton's 1.4s shimmer),
     animation-iteration-count on anything infinite, and scroll-behavior.
     Anything using a hardcoded duration also lands here rather than nowhere.

     What it does NOT cover is a property with no duration at all — a hover
     transform applies instantly whatever the transition says. Those are
     neutralised where they are declared; InputForm.module.css has the only one. */
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
      {/* Matches <html> above. Neither pre-paint script touches <body> today,
          so this is defence in depth rather than a fix for a live mismatch: it
          means a future script that does adjust the body (a font class, a
          density preference) cannot reintroduce a hydration warning here. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
