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

  /* State entry (Module E2). One definition used by all six views that mount
     when the workflow state changes — the five state cards and the result —
     following the same one-global-utility shape as .sc-sr-only above rather
     than repeating the same rule in six stylesheets.

     What it is for: the seven states swap markup instantly, so a result and an
     error card arrive with identical weight and nothing tells you which of the
     two just happened. A short rise says "this is new" and stops there.

     Deliberately an entry, not a crossfade. A crossfade needs the outgoing view
     to stay mounted while it fades, which React gives no native way to do and
     which is wrong in one direction anyway: regenerating goes success ->
     loading, so a fading-out result means a stale plan is still on screen while
     a new one is generated. An entry marks the change without ever showing two
     answers at once.

     TRANSFORM ONLY. IT DOES NOT FADE, AND THAT IS THE WHOLE POINT.
     An entry effect that starts from opacity 0 has one catastrophic failure
     mode: if the animation never advances, the element stays invisible. That is
     not hypothetical — measured here in a real browser, twice. A document whose
     visibilityState is "hidden" freezes both mechanisms:

       - animation with a fill mode: playState "running", currentTime still 0
         after 400ms, computed opacity pinned at 0;
       - transition from @starting-style: identical, frozen at the start value.

     A transition is NOT safer than an animation here; that was the first guess
     and the probe disproved it. What makes it safe is the start value, not the
     mechanism. So the only property that animates is one whose frozen state is
     harmless: worst case this renders 4px low, which nobody can see and no
     screenshot is wrong for containing. A frozen fade would have photographed
     all six views as blank cards, and the screenshot set is how this project
     evidences its UI.

     If a fade is ever wanted back, it needs a mechanism that cannot leave the
     element invisible — adding the class after mount, so a renderer that never
     runs the callback simply never starts the effect.

     translateY, not an inline offset: the movement is block-direction, so it
     reads the same in Arabic and needs no logical-property equivalent.

     No reduced-motion block here, and that is the E1 payoff: the duration is a
     token, and the token collapses itself under prefers-reduced-motion. */
  .sc-enter {
    transform: translateY(0);
    transition: transform var(--motion-base) var(--motion-ease);
  }
  @starting-style {
    .sc-enter {
      transform: translateY(0.25rem);
    }
  }

  /* Route changes (Module E3). React drives the transition — see
     src/app/providers.tsx and the experimental.viewTransition flag in
     next.config.js — and the browser supplies the default cross-fade. All this
     does is put that cross-fade on the app's own timing.

     Which is the whole reason it is written as tokens rather than as a
     keyframe. These pseudo-elements sit in a separate tree hanging off the
     root element, so the reduced-motion backstop at the bottom of this file
     does NOT reach them: it selects *, *::before and *::after, and none of
     those match ::view-transition-old. A custom property does reach them,
     because the tree inherits from the root element the tokens are defined on.
     So E1 covers this for free — under prefers-reduced-motion the duration
     collapses to 0.01ms and the cross-fade is over before it is visible — and
     a hand-written duration here would have needed its own media query and
     been the one thing in the file that could drift from the scale.

     The wildcard is not laziness, it is the fix for a measured bug. Naming
     only (root) looked right and was not: React's default name of "auto"
     assigns its own names to the wrapped nodes, so a single navigation runs
     five groups, and getAnimations() showed (root) at the token's 180ms while
     _t_0_ and _t_0__1 stayed on the browser default of 250ms. Since those are
     the ones actually covering the page, styling (root) alone would have left
     the visible animation untokenized — and therefore outside E1's reach under
     prefers-reduced-motion, which is the failure that matters. */
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: var(--motion-base);
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
