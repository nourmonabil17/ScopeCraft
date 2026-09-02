# Frontend rebuild

Status: approved by Yousef 2026-09-02. Implementation not yet started.
Baseline commit: `ec3a984` (dev, origin/dev and fork/main all in sync).

## Why

The app is deployed and working. This is not a repair job — it is a deliberate
replacement of a frontend that works but does not carry itself well.

Three specific failures, measured rather than asserted:

**It is not responsive.** Nine of the CSS modules contain no media query at all:
`ResultView`, `HistoryList`, `page.module.css`, `SavedPlanView`, `WelcomeModal`,
`LoginCard`, `EvidencePanel`, `ExportActions`, `BackLink`. That list includes the
three largest views in the product. The entire application has three breakpoints
— 30rem, 34rem and 42rem — every one of them a narrow-phone patch applied to the
header, the toggle controls and the form. There is no tablet behaviour and no
wide-desktop behaviour anywhere. Some views survive this because flexbox and grid
are intrinsically fluid, which is why the failure has gone unnoticed; surviving is
not the same as being designed.

**It has no visual system.** 6,433 lines across 47 files, styled file by file.
Colours, spacing and type sizes are decided locally in each module. There is no
token layer, so there is nothing that can be changed once and be right everywhere.

**It does not feel finished.** The owner's words were "more interactive, more
responsive, more professional." The first of those turned out, on questioning, to
mean motion and polish specifically — not drag-and-drop, not inline editing of
story prose, not plan comparison. Those were offered and declined, and are
recorded as out of scope below so they cannot drift back in.

## The scope decision, and what it costs

The owner chose a **full ground-up rewrite** over the two cheaper options offered
(rewrite the visual layer only; rebuild view by view). All 47 frontend files are
replaced. That decision is recorded here with its price attached, because the
price is real and was accepted knowingly:

- The 292 tests currently passing point at components that will no longer exist.
  Coverage is **re-earned, not inherited**. The number will drop before it rises.
- WCAG 2.2 AA compliance is a graded rubric row and was earned by fixing seven
  specific defects. A rewrite does not inherit that pass. It must be re-audited.
- EN/AR RTL correctness is likewise re-earned. A physical `left: -9999px` once
  made every Arabic page scroll ten thousand pixels sideways in this codebase.
- The live site must not regress while this happens. Work lands on `dev` and is
  not pushed to `fork/main` until a module is complete and verified.

## What survives the rewrite

Not everything under `src/` is the frontend. These are untouched:

- `src/lib/i18n/translations.ts` — the bilingual dictionary, and the type that
  makes an English key without an Arabic one a compile error.
- `src/context/*` — Language, Theme and Toast providers.
- `src/lib/scopecraft/*` — schema, tools, taxonomy, client-recalc, export-format.
  The board's capacity arithmetic is application logic, not presentation.
- Everything server-side: routes, providers, database, auth.

The rewrite replaces components and styling. It does not touch the trust boundary
between what the model wrote and what the code computed.

## Design system

Direction chosen from three mockups: **A's structure with C's dark palette.**

Sharp edges. Hairline rules instead of shadows. Uppercase micro-labels with
letter-spacing. Tabular numerals on every number that can be compared to another
number. The visual reference is a specification document, which is what this tool
produces — the form follows the artefact.

### Tokens

One layer, defined once, both themes. Light remains primary; dark is the variant.
This was raised explicitly during design (direction C was dark-first) and left as
light-first, so it is a decision, not an inheritance.

| Role | Light | Dark |
|---|---|---|
| Ground | `#ffffff` | `#0f1115` |
| Panel | `#ffffff` | `#141821` |
| Panel, recessed | `#fafafa` | `#11141b` |
| Rule | `#e5e5e5` | `#1e222b` |
| Rule, strong | `#d4d4d4` | `#262b36` |
| Text | `#0a0a0a` | `#e6e8ec` |
| Text, muted | `#737373` | `#7b8496` |
| Text, faint | `#a3a3a3` | `#5f6878` |
| Accent | `#0f766e` | `#5eead4` |

Every pair above is a contrast obligation, not a suggestion. Contrast is measured
during F1 and recorded, per the standing rule that contrast is measured and not
assumed.

Note the asymmetry in how a raised surface is expressed, because it is intentional
and someone will otherwise "correct" it: **in light, a panel is the same white as
the ground and is defined by its hairline rule; in dark, a panel is defined by a
lighter fill.** A border does the lifting on white, fill does it on black. Giving
light panels a grey fill to "match" dark would flatten the whole light theme into
mush, and giving dark panels a border instead of a fill would make them vanish.

### The accent decision

C used teal only in dark. Carrying that literally would have left the light theme
with no accent at all, and the two themes would have stopped reading as one
product. The accent is therefore shared: `#0f766e` on light (4.9:1 against white,
passes AA for normal text), `#5eead4` on dark.

It appears in exactly three places — the active navigation underline, the provider
chip, and the primary button. That restraint is load-bearing. An accent used in a
fourth place is a change to this spec, not an implementation detail.

### MoSCoW encoding

MUST is a solid fill. SHOULD is a heavy outline. COULD is a dashed outline.

This is deliberate and is not a styling preference. Direction C encoded the
buckets as red and teal chips, which makes colour *the* information and fails
WCAG 1.4.1 (Use of Colour) for anyone who cannot distinguish them. Encoding by
fill weight satisfies the criterion structurally, so no text-alternative
workaround is needed on top.

### Responsive system

A real scale replaces the three ad-hoc phone patches. Four breakpoints, defined
once and used everywhere; no view invents its own:

| Name | Min width | What changes |
|---|---|---|
| `sm` | 30rem (480px) | Large phone. Single column throughout; toggles condense. |
| `md` | 48rem (768px) | Tablet. Two-column board, form fields pair up. |
| `lg` | 64rem (1024px) | Desktop. Full board, side-by-side PRD sections. |
| `xl` | 80rem (1280px) | Wide. Content max-width engages; margins grow, not columns. |

Below `sm` is the base case and is written first — the styles outside any media
query are the phone styles, and every breakpoint above adds rather than undoes.
Two of these bands (`lg` and `xl`) have no equivalent in the current app at all;
the widest thing it currently knows about is 42rem.

Logical properties only. `inset-inline-start`, never `left`. `margin-inline`,
never `margin-left`. `border-end-end-radius`, never a four-value `border-radius`.
This is not stylistic — it is the single rule that makes one stylesheet serve both
text directions, and it has been violated in this codebase before with visible
consequences.

Every view is verified at real widths in **both** directions. A check that runs
LTR only is not a passing check.

## Primitives

Built once, before any view: **Button, Card, Chip, Field, Dialog, Toast.** These
are the vocabulary every view is then written in, and the reason 47 files stopped
agreeing with each other the first time.

Dialog is native `<dialog>` with `showModal()` — already proven in this codebase,
including the two jsdom gaps found and worked around in `installDialogPolyfill`.
Nothing here needs a library.

## Views

One point each in the checklist, rebuilt and reviewed in order: app shell and
header; intake form; loading state; result view; interactive sprint board;
history list; saved plan view; login and welcome modal; error, empty, refusal and
validation states.

Two of these carry constraints that a naive rebuild would destroy:

**The loading state** must keep its honest step reporting. It announces real
stages through `role="status"` and deliberately does not fake a progress
percentage. What it must *gain* is elapsed time: today it stops advancing at step
four and then sits motionless for up to fifty seconds, which is the app's single
worst moment and the one clear Doherty-threshold failure.

**The interactive sprint board** must not gain drag-and-drop. WCAG 2.2 SC 2.5.7
requires a single-pointer alternative to any dragging movement, and the toggle
buttons that exist today *are* that alternative. It must also continue to refuse
to display delivery dates — it shows capacity, not calendar commitments, because
turning story points into a ship date is a Product Owner's judgement and a
documented product non-goal.

## Motion

CSS-native throughout. No motion library — this was offered and declined in favour
of holding the dependency count.

Four pieces: motion tokens with `prefers-reduced-motion` honoured at the token
level rather than patched per file; state transitions for idle → loading → result
and the skeleton-to-content handoff; the View Transitions API for route changes;
and micro-interactions on buttons, cards, chips and toggles.

The rule for all of it: motion that explains a change earns its place, motion that
decorates does not.

## Accessibility

Re-earned, not inherited. WCAG 2.2 AA. Every interactive control has an
accessible name. Contrast measured. The skip link stays first in the tab order.
Target sizes get fixed while the views are open — the history action buttons are
currently 32px, which clears the 24px floor of SC 2.5.8 but sits below the 44px
comfort target.

Reviewed per view with `design:accessibility-review`, and audited as a whole in F1.

## Testing

The current suite is 292 tests across 12 suites. Those numbers will move and this
document does not pretend to predict where they land. What is required:

- Every rebuilt view carries tests before its point is called done.
- The bilingual assertions survive — a view tested only in English is untested.
- `npm run capture:ui` re-run for every UI-touching point.
- All four gates green before any commit: `typecheck`, `lint`, `test`, `build`.

## Out of scope

Recorded so they are not re-proposed mid-build:

- Drag-and-drop on the sprint board — breaks SC 2.5.7 by removing the alternative
  that already exists.
- Delivery dates derived from story points — documented product non-goal.
- Inline editing of story prose, acceptance criteria or risks — offered, declined.
- Search, filter, sort or side-by-side comparison on history — offered, declined.
- Any new runtime dependency, including Tailwind, a component library and a motion
  library — offered as three separate options, all declined in favour of holding
  the six-dependency count.
- Reordering any data view for memorability. Sprint and priority order reflect the
  computed result. The code does the arithmetic; the presentation does not get to
  editorialise it.

## Risks

**The rewrite is larger than any single session.** It is decomposed into modules C
through F in `docs/upgrade-checklist.md`, each gated on the owner's acceptance
before it starts and reviewed in full when it ends.

**Rubric rows go temporarily unmet.** Accessibility, bilingual coverage and test
count all regress before they recover. If the project needs to be defensible at a
fixed date, that date constrains how much of this can be in flight at once.

**The live site is the current frontend.** Nothing ships to `fork/main` — the
branch Vercel actually builds — until a module is complete and verified. Pushing
to `origin` alone never changes the live site, which has cost this project time
before.
