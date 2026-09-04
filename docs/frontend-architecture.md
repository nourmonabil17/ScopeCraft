# ScopeCraft — Frontend Architecture

**Written 2026-09-04.** Companion to [`architecture.md`](architecture.md), which covers the
system and the API boundary, and to
[`database-and-auth-design.md`](database-and-auth-design.md). This document covers everything
from the route handler outwards: what renders, where state lives, and which decisions are load-
bearing enough that changing them re-introduces a bug this project has already had.

> **Authorship.** The frontend row belongs to Joe in
> [`contribution-matrix.md`](contribution-matrix.md), and Module H4 of
> [`upgrade-checklist.md`](upgrade-checklist.md) says not to author it on his behalf. This
> document is written by Yousef because the September rebuild that produced the design-token
> layer, the six primitives and the breakpoint audit was his work, and describing it is part of
> that work. The components it *documents* remain credited where they were built. The credit
> note is recorded in the contribution matrix rather than left implicit here.

---

## 1. Routes

Next.js App Router. Eight routes — five pages and three API handlers.

| Route | File | Rendering |
|---|---|---|
| `/` | `src/app/page.tsx` | Server. Redirects to `/scopecraft`; nothing else |
| `/login` | `src/app/login/page.tsx` | Server |
| `/scopecraft` | `src/app/scopecraft/page.tsx` | Client, behind a server layout gate |
| `/scopecraft/history` | `src/app/scopecraft/history/page.tsx` | Server, `force-dynamic` |
| `/scopecraft/history/[id]` | `src/app/scopecraft/history/[id]/page.tsx` | Server, `force-dynamic` |
| `/api/scopecraft` | `src/app/api/scopecraft/route.ts` | Route handler — see `architecture.md` §4a |
| `/api/scopecraft/[id]` | `src/app/api/scopecraft/[id]/route.ts` | Route handler (board `PATCH`) |
| `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | Auth.js |

`src/app/scopecraft/layout.tsx` is the gate: a server component that calls `auth()` and
redirects a signed-out visitor to `/login` before any of the workflow page is sent to the
browser. `/` deliberately adds no session check of its own, so there is exactly one place a
page-level check can live.

That gate has a stated cost, recorded in the file itself: reading cookies opts the route out of
static prerendering. `/scopecraft` used to be prerendered and edge-cached. That is not a
regression to fix — it is what "this page requires a session" means, and the page's own work was
always a client-side fetch.

---

## 2. Component tree

```
RootLayout (server)  — token CSS, two pre-paint scripts, <html lang dir>
└── Providers (client)
    └── SessionProvider → LanguageProvider → ThemeProvider → ToastProvider
        ├── {children}
        └── ToastViewport

/scopecraft
└── ScopeCraftLayout (server — session gate)
    └── ScopeCraftPage (client — owns the seven-state union)
        ├── WelcomeModal ──────────── Dialog
        ├── Header ────────────────── LanguageToggle · ThemeToggle · UserMenu · HistoryLink
        ├── InputForm ─────────────── Field · Button   (presets.ts)
        └── exactly one of:
            LoadingState │ EmptyState │ ValidationErrorState │ DomainRefusalState │ ErrorState
            │ ResultView ─── tablist ─┬── PRD sections ────── Card · Chip
                                      ├── InteractiveSprintBoard  (client-recalc.ts)
                                      ├── EvidencePanel
                                      └── ExportActions

/scopecraft/history        → HistoryList (client) + BackLink
/scopecraft/history/[id]   → SavedPlanView (client) → ResultView
```

Three directories, and the split is by *stability*, not by page:

- **`src/components/ui/`** — six primitives, each with its own CSS Module: `Button`, `Card`,
  `Chip`, `Dialog`, `Field`, `Toast`. They know nothing about ScopeCraft. They are the only
  components allowed to define a visual treatment from scratch.
- **`src/components/common/`** — app furniture that is not domain logic: `Header`,
  `LanguageToggle`, `ThemeToggle`, `UserMenu`, `HistoryLink`, `BackLink`, `LoginCard`, the
  `ToastViewport`, and the five state views (`EmptyState`, `ErrorState`,
  `ValidationErrorState`, `DomainRefusalState`, `LoadingState`).
- **`src/components/scopecraft/`** — the domain: `InputForm`, `ResultView`,
  `InteractiveSprintBoard`, `EvidencePanel`, `ExportActions`, `WelcomeModal`, `presets.ts`.

Two primitives carry a refusal in their API, and both are the point of having primitives at all:

- **`Card` has no `onClick`.** A clickable div is invisible to the keyboard and unnamed to a
  screen reader, and codebases acquire them one convenience at a time. If a card needs an
  action, the action is a real `<button>` inside it. `id`, `labelledBy` and `testId` are spelled
  out individually rather than taken as a `{...rest}` spread — a spread is shorter and would
  also let `onClick` back in, which is the single thing the component exists to refuse. Its
  `as?: "div" | "article" | "li" | "section"` prop exists because the right element depends on
  context, and getting it wrong is a semantics bug.
- **`Dialog` is a native `<dialog>` with `showModal()`,** not a hand-rolled overlay: focus
  trapping, Escape-to-close, an inert background and a real top-layer backdrop all come free,
  and each is something a div-based modal gets subtly wrong. It is **not rendered at all when
  closed**, rather than rendered and hidden by the UA's `dialog:not([open])` rule — that rule is
  not applied by every environment (jsdom does not apply it), and content leaking out of a
  closed modal was a real bug here once.

---

## 3. Where state lives

### 3.1 The seven mandatory UI states are one discriminated union

`src/app/scopecraft/page.tsx:49-62`:

```ts
type UiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; resultId: number; data: ScopeCraftResponse;
      providerUsed: ProviderUsed | "unknown"; promptVersion: string }
  | { status: "empty" }
  | { status: "validation_error"; message: string; issues: ValidationIssue[] }
  | { status: "domain_refusal"; message: string }
  | { status: "provider_error"; message: string; questions?: string[] };
```

**Why a union and not booleans.** Seven booleans permit 128 combinations, of which 121 are
nonsense — `isLoading && isError`, a success with no data, an empty state rendered over a
result. The union makes those unrepresentable: a render is exactly one variant, and each
variant carries precisely the data that variant needs and nothing else. `success` is the only
one that holds a plan; `issues` exists only on `validation_error`; `questions` only on
`provider_error`. TypeScript then narrows per branch, so `state.issues` does not compile
outside the branch where it exists.

**The variant is chosen by the server's `code`, not by the HTTP status.** A `422` can be either
a validation failure or a domain refusal, and they get different UI, different copy and
different recovery actions. The mapping is explicit:

| Server `code` | State |
|---|---|
| `VALIDATION_ERROR` | `validation_error` — field-level issues, focus returns to the form |
| `OUT_OF_DOMAIN` | `domain_refusal` — "edit your idea", no retry button |
| `UNAUTHORIZED` | *not a state* — `window.location.href = "/login"` |
| everything else | `provider_error` — explain and offer retry |

`UNAUTHORIZED` is a redirect rather than an error card because there is nothing the user can act
on from that page; it means the session expired while the tab was open, and a fresh load would
have been bounced by the layout gate anyway. The remaining codes — `PAYLOAD_TOO_LARGE`,
`INVALID_JSON`, `CLARIFICATION_REQUIRED`, `PLANNING_ERROR`, `SCHEMA_VIOLATION`,
`PROVIDER_ERROR`, `TIMEOUT`, `RATE_LIMITED` — all share the same "explain and offer retry"
shape, so they share one variant rather than each earning a branch.

### 3.2 The page's other state, and why it is separate

| State | Why it is not in the union |
|---|---|
| `duplicateValues` / `hasDuplicate` | Form prefill from a history card's "Duplicate". Orthogonal to which result is showing |
| `lastRequest` | Retry needs the payload after the state has already become an error |
| `board` | The human's edits. Survives tab switches inside `ResultView` |
| `planId` / `saveState` | Persistence status. `null` planId means the write failed; `saveState` says so rather than failing silently on the first edit |

Two things about this state are load-bearing and are commented in the file:

**The duplicate-prefill read must run in an effect, not a lazy `useState` initializer**
(`page.tsx:149-186`). `sessionStorage` does not exist during SSR, so a lazy initializer would
return `undefined` on the server and a real value on the client's hydrating render whenever a
prefill genuinely exists — a hydration mismatch. Running it in an effect means the server render
and the client's hydrating render both see `undefined`, and the real value arrives in a later,
ordinary re-render. The parsed value is merged over `emptyFormValues()` rather than cast and
trusted: `sessionStorage` content is untrusted, `JSON.parse` guarantees valid JSON and not the
right shape, and a stale key from a future field rename would otherwise reach `InputForm` as a
missing string and crash the render.

**`InputForm` is remounted by `key`, not updated by prop** (`page.tsx:287-298`). Its own values
come from a lazy `useState` initializer, which runs once per mount, so a plain prop change when
`duplicateValues` arrives after first render would be silently ignored. `hasDuplicate` — not
`duplicateValues` itself — is the remount signal, because `duplicateValues` is always a
fully-formed object and can no longer double as "was a real payload found".

**Board saves are debounced at 800 ms** (`SAVE_DEBOUNCE_MS`). The board reports on every change,
including every keystroke in a points field; an unthrottled `PATCH` per keystroke would be both
wasteful and racy, since the last *response* would win rather than the last *edit*. Only
`points` and `column` are sent — score, MoSCoW and capacity are derived and recomputed on load,
and sending them would make a saved board a second source of truth for numbers the code owns.
That is the same rule the backend enforces, on the other side of the wire.

### 3.3 Three contexts, and nothing else

There is no state library. Three React contexts cover everything that is genuinely global:

- **`LanguageContext`** — `locale`, `direction`, `setLocale`, `toggleLocale`, `t`. It exposes
  `t()` rather than the raw dictionary so every call site goes through one interpolation path
  and a missing key is a compile error at the call site rather than `undefined` rendered into
  the page.
- **`ThemeContext`** — `preference` (`light | dark | system`), `theme` (the resolved
  `light | dark`), `setPreference`, `cyclePreference`.
- **`ToastContext`** — a queue of `{id, message, tone}` with a 4 s TTL. No dependency, no
  portal: the viewport is rendered once at the end of the provider tree and positioned with
  fixed CSS, which avoids the SSR hazards of `createPortal` against a document that does not
  exist yet. Every pending timer is tracked so it can be cleared on unmount.

**Provider order is not arbitrary** (`src/app/providers.tsx`). `SessionProvider` is outermost
because `UserMenu` needs both it and `useLanguage`, and it has no dependency of its own.
`LanguageProvider` wraps `Theme` and `Toast` because both render translated strings — aria
labels, dismiss buttons — and must be able to call `useLanguage`.

**`ThemeContext` keeps the preference and the resolved theme as separate values on purpose.**
`'system'` is a real, persistable choice meaning "follow the OS", and it must keep following the
OS if the user changes their OS setting while the page is open. Collapsing the two would make
`'system'` a one-shot read. The OS preference is subscribed to with `useSyncExternalStore` — it
is state owned outside React, which is exactly what that hook is for. Mirroring it into
`useState` and syncing with an effect would make the resolved theme lag one render behind, and
is the pattern `react-hooks/set-state-in-effect` exists to prevent. The resolved theme is then
*derived during render*, not stored.

---

## 4. The client/server boundary

`"use client"` is a boundary marker, not a default. Where it sits:

**Server components.** `layout.tsx`, `/`, `/login`, `scopecraft/layout.tsx`, and both history
routes. The history pages are server components **deliberately**: the query runs where the
credential is, and there is no JSON endpoint behind them, because a route that exists only to
feed your own frontend is an API surface you have to secure for no benefit. `user_id` comes from
`auth()`, never from a query parameter or path segment.

**Directive-free components.** `Card`, `Chip`, `Field` and the `Toast` primitive carry no
directive at all. They have no state and no effects, so they compile into whichever environment
imports them — a server component or a client one.

**Client components.** Everything that holds state, listens to an event or touches
`localStorage`: the workflow page, the three contexts, `Header` and its toggles, `InputForm`,
`ResultView`, `InteractiveSprintBoard`, `Dialog`, `WelcomeModal`, and the state views.

`layout.tsx` stays a server component precisely so it can keep exporting `metadata` — a
`"use client"` layout cannot — which is why the providers live in their own
`src/app/providers.tsx` file.

**One rule crosses the boundary in both directions.** Dates are never formatted on the server:
`HistoryPage` serializes to ISO strings and the client formats them, because the server renders
in its own timezone and locale, which is neither the reader's nor the one they chose — and a
server-formatted date is the classic hydration mismatch. Likewise, a saved plan's `response` is
re-validated with Zod on the way *out* of the database, not trusted because it was validated on
the way in; a row could have been written by an older schema or edited by hand in `psql`, and
rendering an unvalidated shape would crash the client component instead of failing where it can
be handled.

---

## 5. The two pre-paint scripts

`src/app/layout.tsx:179-182` inlines two scripts into `<head>`:

```tsx
<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
<script dangerouslySetInnerHTML={{ __html: LANGUAGE_INIT_SCRIPT }} />
```

**They are blocking on purpose.** Both must run before first paint, or the page visibly flashes
the wrong theme and then corrects itself, or renders LTR and snaps to RTL. A deferred script, a
`next/script` strategy other than `beforeInteractive`, or moving this work into an effect all
reintroduce the flash — the effect runs after paint, which is the definition of the bug.

`THEME_INIT_SCRIPT` reads `scopecraft.theme`, resolves `system` against
`prefers-color-scheme`, toggles `.dark` on `<html>` and sets `root.style.colorScheme`.
`LANGUAGE_INIT_SCRIPT` reads `scopecraft.locale` and sets `lang` and `dir`. Both are
dependency-free and wrapped in `try/catch`, because `localStorage` throws outright in some
privacy modes and a theme preference is never worth breaking the page over.

`<html lang="en" dir="ltr">` in the server render is the server's best guess — it cannot know
the visitor's stored locale — and the script corrects both before paint. `suppressHydrationWarning`
on `<html>` and `<body>` acknowledges that the DOM React hydrates into is deliberately not the
DOM React rendered. Each provider then *adopts* what the script already decided, via a lazy
initializer reading the same key, so React's first render agrees with the DOM instead of
correcting it a frame later.

**The duplication is the price, and it is written down.** `THEME_INIT_SCRIPT` must stay
behaviourally identical to `resolveTheme` + `applyTheme` in the same file, and
`LANGUAGE_INIT_SCRIPT` to the effect below it. Each script is defined next to the function it
mirrors so the two are edited together.

**Known open issue.** React hydration error #418 appears in the console on returning visits. It
reproduces on unmodified production and predates the frontend rebuild. The available fix trades
the console error for a visible language flash on load — worse for every user, in exchange for a
cleaner console for developers. It is limitation 15 in
[`known-limitations.md`](known-limitations.md), explicitly left to the owner rather than
resolved unilaterally.

---

## 6. Theming: a `.dark` class, not `prefers-color-scheme`

The reasoning is in the header of `src/app/layout.tsx:5-17` and is worth repeating here, because
it is the decision most likely to be "simplified" back:

> The media query cannot express "user explicitly chose light while their OS is dark", which is
> a real preference this app has to honour.

The OS setting is still respected — it is the default that `ThemeContext` resolves `'system'`
against — but it is not the mechanism. Which produces one hard rule:

> **Every colour is defined once on `:root` and redefined on `:root.dark`. Never inside a bare
> media query.**

A colour defined in `@media (prefers-color-scheme: dark)` ignores the class, so an explicit
choice silently loses to the OS for that one property. The failure is partial and looks like a
rendering glitch rather than a logic error, which is what makes it expensive to find.

`color-scheme` is set **imperatively** (`root.style.colorScheme = theme`) rather than declared
in CSS, so native controls — scrollbars, date pickers, form fields — follow the *chosen* theme
rather than the OS one.

`ThemeToggle` is one button cycling light → dark → system, and its icon shows the current
**preference**, not the resolved theme: otherwise a user on system-dark and a user on
explicit-dark would see identical UI for two different states. Its `aria-label` carries both the
current state and what pressing will do, because a bare "Switch theme" leaves a screen-reader
user unable to tell what they are switching from.

---

## 7. Styling: CSS Modules over generated custom properties

Two layers, and no third.

**Layer 1 — tokens as data.** `src/lib/design/tokens.ts` holds thirteen closed colour roles
(`ground`, `panel`, `panelRecessed`, `rule`, `ruleStrong`, `text`, `textMuted`, `textFaint`,
`accent`, `accentHover`, `accentContrast`, `danger`, `dangerSurface`) plus the space, text,
radius and motion scales. It is TypeScript rather than CSS because **a stylesheet cannot be asserted against**:
holding the values here lets `tests/evaluation/design-tokens.test.ts` prove every light/dark
pair actually clears its contrast obligation, which is the difference between "we measured
contrast" and "we intended to".

`src/lib/design/css.ts` generates the `--c-*` custom-property block from that data, and
`layout.tsx` injects it. Generated, not hand-written, so the values the contrast test asserts
against are provably the values that ship — a hand-maintained second copy would drift, and the
drift would be invisible until someone measured the live site.

**Layer 2 — CSS Modules.** One `.module.css` per component, consuming `var(--c-*)`,
`var(--space-*)`, `var(--text-*)`, `var(--radius-*)`, `var(--motion-*)`. Locally scoped class
names, no global cascade to reason about, no naming convention to enforce socially, and no
runtime CSS-in-JS dependency. In tests they resolve through `identity-obj-proxy`, so
`styles.foo` returns `"foo"` and class assertions stay meaningful without running a bundler.

**Elevation is asymmetric between themes, and that is the design, not an oversight.** On white,
a panel is the same colour as the page and is lifted by its hairline rule; on black it is lifted
by a lighter fill. Border does the lifting on white, fill does it on black — giving light panels
a grey fill to "match" dark flattens the whole light theme into mush. Both values come from the
tokens, which is why `Card.module.css` carries the instruction in capitals: **that file must not
special-case dark.** A `:root.dark` block there would be the first crack in the arrangement.

**The legacy layer is gone.** A second generation of `--sc-*` custom properties coexisted with
`--c-*` for the whole of Module D — deliberately, because replacing both in one commit would
have broken every view not yet rebuilt. The gate for deleting it was a tree-wide count of legacy
references reaching zero, and it currently reads **0**, confirmed against the live stylesheet as
well as the source. That grep command is deliberately not quoted in `layout.tsx`: it matches its
own pattern, so writing it into a comment makes the count report 1 and the gate can never close.
It lives in [`upgrade-checklist.md`](upgrade-checklist.md).

**Six globals live in `layout.tsx`, each for a reason that is written down there:** the
`box-sizing: border-box` reset (three separate overflow bugs traced to content-box sizing —
`InputForm`'s textarea, `Dialog`, `Toast` — and this rule is now the only thing preventing all
three), `.sc-sr-only` (one definition replacing five identical copies that had accumulated), the
skip link, `touch-action: manipulation` on interactive elements, `.sc-enter` — the state-entry
effect shared by the five state cards and the result, since E2 — and, since E3, the
`::view-transition-*` timing rule.

`.sc-enter` animates `transform` only and never `opacity`, which is a constraint rather than a
stylistic choice. A document that does not advance its animation timeline
(`visibilityState: "hidden"`) freezes **both** a filled animation and an `@starting-style`
transition at their *start* value — measured, not assumed. So an entry effect that begins
transparent renders as an invisible card in exactly the class of renderer that takes automated
screenshots, while a frozen transform is 4px off and costs nothing. Decision-log entry 43; a
test asserts the block contains no `opacity`, including inside `@starting-style`.

**The view-transition rule is written with a wildcard for a reason that is not tidiness.** The
reduced-motion backstop at the foot of `layout.tsx` selects `*`, `*::before` and `*::after`, and
a view-transition pseudo-element matches none of those — it lives in a separate tree hanging off
the root element. A hardcoded duration there would therefore sit outside every reduced-motion
mechanism this project has. A custom property does reach it, because that tree inherits from the
root the tokens are defined on, so the rule sets `animation-duration: var(--motion-base)` and E1
collapses it for free. Naming only `(root)` was measured wrong first: React's auto-assigned
names cover the page and stayed on the browser's 250ms default while `(root)` alone obeyed the
token. Decision-log entry 44.

---

## 8. Breakpoints: four widths, enforced by a test

`src/lib/design/breakpoints.ts`:

| Name | Min-width | What changes |
|---|---|---|
| `sm` | 30rem | Large phone. Single column; toggles condense |
| `md` | 48rem | Tablet. Two-column board; form fields pair up |
| `lg` | 64rem | Desktop. Full board; side-by-side PRD sections |
| `xl` | 80rem | Wide. Max-width engages; margins grow, not columns |

**Phone is the base case.** Styles outside any media query are the phone styles, and every
breakpoint above *adds* rather than undoes.

**Why the audit is a test rather than CSS.** A custom property is not valid inside a media-query
condition — `@media (min-width: var(--bp-md))` is invalid and fails *silently* — and the
alternative, `@custom-media`, needs a PostCSS plugin this project does not want. So the literals
are repeated in each stylesheet and `tests/evaluation/breakpoint-audit.test.ts` enforces them
instead. It reads every stylesheet under `src` and fails on two things: a width literal outside
the approved four, and **any `max-width` query** — even one whose number is on the list, because
max-width is the "each breakpoint adds" rule inverted. Before the rebuild the app had three
ad-hoc breakpoints (30/34/42rem), every one a max-width patch bolted onto a desktop layout,
which is why it had no tablet behaviour and nothing above 42rem. The test's `PRE_REBUILD_EXEMPT`
list is empty and an assertion keeps it that way.

---

## 9. Bilingual and RTL

`src/lib/i18n/translations.ts` holds both dictionaries. `TranslationKey` is derived from the
English dictionary and `ar` is typed as `Record<TranslationKey, string>`, so **an English key
with no Arabic one is a compile error**, not a silently untranslated string in production. Do not
work around that with a fallback.

**The type check only sees keys.** A string hardcoded into JSX is invisible to it. That is
exactly how the Arabic capacity-meter bug reached production — decision-log entry 40 — and it is
the reason the reviewer step for any UI change is to read the JSX for literals, not to trust the
compiler.

Direction is applied to `<html>`, not to a wrapper div, because `dir` on the root is what CSS
logical properties, form controls, and the browser's own text-selection and caret behaviour all
key off.

**Logical CSS properties, always:**

| Use | Never |
|---|---|
| `inset-inline-start` | `left` |
| `margin-inline` / `padding-inline` | `margin-left` / `padding-left` |
| `text-align: start` | `text-align: left` |
| `border-end-end-radius` | `border-radius: 0 0 6px 0` |
| `inline-size` / `block-size` | `width` / `height` on direction-sensitive boxes |

This is not stylistic. A physical `left: -9999px` on the skip link parked it in unscrollable
space under LTR, but under RTL that same offset landed in *scrollable* space: the document
measured 11279px wide against a 1280px viewport, so **every Arabic page scrolled ~10000px
sideways.** `inset-inline-start` resolves to whichever edge is the inline start and is off-screen
in both directions.

**Both directions are tested, not just LTR.** `renderWithProviders` takes a `locale` option that
seeds storage before mount, so a component can be rendered directly in Arabic without a click;
`tests/ui/ThemeAndLocale.test.tsx` covers the switch itself; and 6 of the 22 UI evidence
screenshots are Arabic RTL captures. A check that runs LTR only is not a passing check on a
bilingual app — it is an untested direction.

Arabic also gets its own font stack (`:root[lang="ar"] body`), because the Latin default has
poor Arabic coverage.

---

## 10. Accessibility

Target is WCAG 2.2 AA. The decisions that are not obvious:

- **Announcement urgency is a property of the message, not the container.** The `Toast`
  primitive picks `role="alert"` for `tone="error"` and `role="status"` otherwise, and the
  viewport carries no live-region semantics at all, so those roles are never nested inside a
  politer ancestor. Previously one polite region wrapped every tone, which meant an error
  announcement waited for a pause in speech — for a failed generation, that can mean acting on a
  plan that was never produced. The trade is decision-log entry 36.
- **Character counters are not `aria-live`.** Announcing "1/2000, 2/2000, 3/2000" on every
  keystroke is hostile. The counter is wired into `aria-describedby` and a separate polite region
  announces only threshold crossings.
- **Errors appear on blur or submit, never on first keystroke.** Validating an idea as "too
  short" while someone types the first word is technically correct and practically obnoxious.
  The submit-time error summary takes focus (SC 3.3.1).
- **The capacity slider and number input are one control.** The slider is `aria-hidden` and the
  number input keeps the label; exposing both would announce the same setting twice with no
  indication they are linked.
- **No drag-and-drop on the board.** SC 2.5.7 requires a single-pointer alternative to any drag
  gesture, and a `<button>` *is* that alternative — plus native elements get Enter/Space and
  focus for free. Listed under "deliberately not doing" in the upgrade checklist.
- **`ResultView`'s tabs implement the full APG keyboard contract** — arrow keys between tabs,
  Home/End to the ends, only the active tab in the tab sequence. Panels stay mounted (`hidden`
  rather than unmounted), because unmounting the backlog panel would discard in-progress board
  edits every time the user glanced at the evidence tab.
- **The skip link is first in the tab order** and `scroll-margin-top: 5rem` reserves space for
  the sticky header, so "skip to content" actually lands on content.
- **Board save status is announced politely, not assertively** — it changes on a debounce timer,
  and an assertive region would interrupt a screen-reader user mid-sentence while they edit.

---

## 11. What the tests cover

566 tests across 22 suites, in two Jest projects (`jest.config.js`), split because they need
different environments: `tests/api` and `tests/evaluation` run in Node, `tests/ui` in jsdom.

| Suite | Covers |
|---|---|
| `tests/ui/primitives/*` (6 files) | `Button` `Card` `Chip` `Dialog` `Field` `Toast` in isolation |
| `tests/ui/StateTransitions.test.tsx` | All seven states (25 tests), the `VALIDATION_ERROR` / `OUT_OF_DOMAIN` / `PROVIDER_ERROR` / `TIMEOUT` / `CLARIFICATION_REQUIRED` / network mappings, and the duplicate-prefill path including a corrupted payload |
| `tests/ui/InputForm.test.tsx` | Validation, counters, presets, focus management |
| `tests/ui/InteractiveBoard.test.tsx` | Toggling, points editing, capacity recompute |
| `tests/ui/ResultView.test.tsx` | The 11 PRD fields, tabs, keyboard contract |
| `tests/ui/ThemeAndLocale.test.tsx` | Theme cycling, locale switching, direction |
| `tests/ui/HistoryList` · `BackLink` · `Auth` · `Amenities` · `WelcomeModal` | The rest |
| `tests/evaluation/design-tokens.test.ts` | Every light/dark colour pair against its AA obligation |
| `tests/evaluation/breakpoint-audit.test.ts` | Approved widths only; no `max-width` anywhere |

Beyond the suites, `npm run capture:ui` drives headless Chrome over the DevTools Protocol and
produces the 22 screenshots in `docs/evidence/ui/shots/` — both themes, both directions, three
widths, and every one of the seven states. It is ~700 lines of script rather than a Playwright
dependency, which is the standard this project holds for adding one.

**Any UI change invalidates that evidence set.** Re-run the capture and commit the whole set,
never a partial one.

---

## 12. What is not covered

Stated plainly rather than left for an examiner to find. Full entries are in
[`known-limitations.md`](known-limitations.md).

- **No screen-reader run** (limitation 13, *Open*). Contrast and accessible names are measured
  automatically; no part of this application has been listened to with VoiceOver, NVDA or JAWS.
  Automated checking finds the errors it can name, not the ones a user hears.
- **No test on real hardware** (limitation 14, *Open*). Responsive behaviour is verified at
  1280 / 768 / 390px in both directions with no horizontal overflow in any of the six
  combinations — but that is emulation. Touch target sizes, the sticky header against real
  browser chrome, and iOS Safari's viewport behaviour are unchecked.
- **Hydration error #418 on returning visits** (limitation 15, *Open*). Reproduces on
  unmodified production; the fix trades it for a language flash. Owner's decision.
- **`script-src 'unsafe-inline'`** (limitation 3, *Accepted*). Not caused by the two pre-paint
  scripts in §5, though they depend on it: the App Router streams its hydration payload as
  roughly ten inline scripts whose contents change every build, so a hash allow-list is
  unmaintainable, and a nonce must be minted per request. `style-src 'unsafe-inline'`
  (limitation 4) is the token stylesheet, which must stay inline or the page flashes the wrong
  theme on every load. Both are documented as weaknesses in `next.config.js` rather than
  glossed; do not loosen anything further without a decision-log entry.
- **No component-level visual regression testing.** The screenshot set is evidence, captured and
  reviewed by a human, not an automated diff.
- **No hover state is exercised anywhere.** Neither the suite nor the screenshot capture can
  hold a pointer over a control, so the two hover affordances added in E4 — the primary
  button's fill and the history row's `:has(.ideaLink:hover)` border — are proven only as far
  as "the rule ships and parses in the browser, with its tokens resolving". The colours behind
  them are asserted (`design-tokens.test.ts` holds the hovered fill to 4.5:1 against its label
  and requires it to differ measurably from the resting fill); the interaction is not.
- **View transitions and per-element transitions are mutually exclusive here.** The page-level
  `<ViewTransition>` that gives E3 its route cross-fade also prevents any element beneath it
  from being captured — measured with a control experiment, decision-log entry 45 — so the
  sprint board's story-move animation was built and removed. Reconciling them needs
  `transitionTypes` threaded through every `Link`, where a link added later silently loses the
  transition. Recorded as a deliberate non-goal, not an oversight.
- **The `UNAUTHORIZED` branch of §3.1 has no UI test.** Every other error code the page branches
  on is covered by `StateTransitions.test.tsx`; the expired-session redirect is not, because it
  sets `window.location.href`, which jsdom does not navigate on. It is exercised end to end
  instead — the route returns `401` before reading a body, verified live twice — but the
  client-side branch itself is unproven by the suite. Noted here rather than left to be
  discovered from a coverage report.
- ~~**`prefers-reduced-motion` is handled per-file, not at the token layer.**~~ **Closed
  2026-09-04 (E1).** The motion scale now collapses itself under the query, generated from
  `tokens.motion` in `css.ts`, so every `var(--motion-*)` inherits the preference. Three of the
  four per-file blocks turned out to have been dead already — overridden by the `!important`
  backstop in `layout.tsx` they were duplicating — and were deleted. Two remain on purpose:
  Header's `no-preference` opt-in for the status pulse, and one `transform: none` in
  `InputForm.module.css`, because a hover transform has no duration to collapse and would still
  jump. Decision-log entry 42.

---

## 13. Related documents

| Document | What it covers that this one does not |
|---|---|
| [`architecture.md`](architecture.md) | System workflow, module ownership, the API trust boundary |
| [`database-and-auth-design.md`](database-and-auth-design.md) | Sessions, the `plans` schema, what auth does and does not protect |
| [`api-contracts.md`](api-contracts.md) | Every status code and body shape the state union branches on |
| [`known-limitations.md`](known-limitations.md) | All 19 limitations with owners and next steps |
| [`decision-log.md`](decision-log.md) | Entries 32 (danger tokens), 36 (toast live regions), 40 (Arabic capacity meter) |
| [`upgrade-checklist.md`](upgrade-checklist.md) | Modules C–E — the rebuild this document describes the result of |
| [`evidence/ui/ui-evidence.md`](evidence/ui/ui-evidence.md) | The 22 screenshots and what each shows |
| [`evidence/ui/accessibility-checklist.md`](evidence/ui/accessibility-checklist.md) | Measured contrast ratios and accessible-name coverage |
