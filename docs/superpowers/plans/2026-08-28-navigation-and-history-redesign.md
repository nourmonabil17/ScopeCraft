# Navigation and History Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a real public landing page, replace a mislabeled "back"
link with an honest one on two history pages, add a Home button to the
header, and let a signed-in user duplicate, delete, and see a one-line summary
of their saved plans.

**Architecture:** Nine independently-shippable tasks, each ending in a commit
that passes typecheck/lint/test. No schema change anywhere. No new runtime
dependency. New client-only state (a duplicate-prefill payload) travels
through `sessionStorage`, never a URL parameter.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules,
Postgres via the `sql` tagged-template client, Jest + Testing Library.

Design spec: [`docs/superpowers/specs/2026-08-28-navigation-and-history-redesign-design.md`](../specs/2026-08-28-navigation-and-history-redesign-design.md)

## Global Constraints

- Every new user-facing string needs both an `en` and an `ar` entry in
  `src/lib/i18n/translations.ts`. The `ar` object is typed
  `Record<TranslationKey, string>`, so a missing Arabic entry is a
  `tsc` error, not a runtime gap.
- Logical CSS properties only — `inset-inline-start`, not `left`;
  `margin-inline`, not `margin-left`.
- No new npm dependency. Every task below uses only what's already installed.
- No new database column and no migration. `plans.constraints`,
  `plans.capacity_points`, and `plans.sprint_days` already exist; this plan
  only adds one of them to a `select` that didn't ask for it before.
- Before every commit: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`. All four must pass. A UI-touching task also needs
  `npm run capture:ui` re-run before that task's final commit, per the
  project's own rule that a UI change ships with a fresh capture.
- Commit author: `Yousef mohmed hasabo <yousefhasabo94@gmail.com>`. No
  `Co-Authored-By` trailer, ever.

---

### Task 1: Translation keys

**Files:**
- Modify: `src/lib/i18n/translations.ts`

**Interfaces:**
- Produces: 15 new `TranslationKey` values, listed below, usable by every
  later task via `t("key.name")`.

Every later task calls `t()` with one of these keys. Nothing else in this
plan can typecheck until they exist, so this goes first.

- [ ] **Step 1: Add the `en` entries**

In the `en` object, immediately after the line
`"header.language.ar": "العربية",` (inside the `// ---- Header / navigation ----`
block, before the blank line and the `// ---- Sign-in ----` comment), insert:

```ts
  "nav.home": "Home",
```

Immediately after `"history.unavailable": "Your plans cannot be loaded right now. Please try again shortly.",`
(the last line of the existing history block), insert:

```ts
  "history.backToForm": "Back to the plan form",
  "history.detail.backToHistory": "Back to your plans",
  "history.duplicate": "Duplicate",
  "history.duplicate.description": "Fill the form with this plan's idea and constraints",
  "history.delete": "Delete",
  "history.delete.confirm": "Confirm delete?",
  "history.delete.description": "Permanently delete this plan",
  "history.deleteFailed": "This plan could not be deleted. Please try again.",
  "history.stats.plans.one": "1 plan",
  "history.stats.plans.many": "{count} plans",
  "history.stats.avgCapacity": "Average capacity: {avg} pts",
  "landing.heading": "Turn a product idea into a sprint-ready plan.",
  "landing.exampleHeading": "Example output",
  "landing.examplePrd":
    "\"As a student, I want to filter potential study partners by course and availability, so that I can form a compatible group quickly.\" — one of seven user stories generated for a study-group planning app.",
  "landing.cta": "Get started",
```

- [ ] **Step 2: Add the matching `ar` entries**

In the `ar` object, immediately after the line
`"header.language.ar": "العربية",` (the second occurrence — inside `ar`'s own
header block, same structural position as Step 1), insert:

```ts
  "nav.home": "الرئيسية",
```

Immediately after `"history.unavailable": "تعذّر تحميل خططك الآن. يُرجى المحاولة بعد قليل.",`
(the last line of `ar`'s history block), insert:

```ts
  "history.backToForm": "العودة إلى نموذج الخطة",
  "history.detail.backToHistory": "العودة إلى خططك",
  "history.duplicate": "نسخ",
  "history.duplicate.description": "املأ النموذج بفكرة هذه الخطة وقيودها",
  "history.delete": "حذف",
  "history.delete.confirm": "تأكيد الحذف؟",
  "history.delete.description": "حذف هذه الخطة نهائيًا",
  "history.deleteFailed": "تعذّر حذف هذه الخطة. يُرجى المحاولة مرة أخرى.",
  "history.stats.plans.one": "خطة واحدة",
  "history.stats.plans.many": "{count} خطة",
  "history.stats.avgCapacity": "متوسط السعة: {avg} نقطة",
  "landing.heading": "حوّل فكرة منتجك إلى خطة جاهزة للسبرنت.",
  "landing.exampleHeading": "مثال على الناتج",
  "landing.examplePrd":
    "«بصفتي طالبًا، أريد تصفية شركاء الدراسة المحتملين حسب المقرر والتوافر، لأتمكن من تكوين مجموعة متوافقة بسرعة.» — إحدى سبع قصص مستخدم أُنشئت لتطبيق لتخطيط مجموعات الدراسة.",
  "landing.cta": "ابدأ الآن",
```

- [ ] **Step 3: Verify the key-parity guarantee actually catches a mismatch**

Temporarily delete the `"nav.home": "الرئيسية",` line you just added from
`ar`, then run:

```bash
npm run typecheck
```

Expected: FAIL, reporting that `ar` is missing property `"nav.home"` (or
similar — `Record<TranslationKey, string>` is what's being violated). This
confirms the type system is actually enforcing the pair, not just that you
remembered to add both.

Put the line back, then run `npm run typecheck` again.

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/translations.ts
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "i18n: add translation keys for the navigation and history redesign"
```

---

### Task 2: `BackLink` component

**Files:**
- Create: `src/components/common/BackLink.tsx`
- Create: `src/components/common/BackLink.module.css`
- Test: `tests/ui/BackLink.test.tsx`

**Interfaces:**
- Consumes: `useLanguage()` from `@/context/LanguageContext` (existing).
- Produces: `BackLink({ href, labelKey }: { href: string; labelKey:
  TranslationKey })` — a default *named* export `BackLink`. Task 3 imports
  it as `import { BackLink } from "@/components/common/BackLink"`.

A small link with a direction-aware arrow. No literal `←`: it flips
correctly under `dir="rtl"` using a logical CSS property, matching the
reasoning already written into the code this replaces (see Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/BackLink.test.tsx
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./render-helpers";
import { BackLink } from "@/components/common/BackLink";

describe("BackLink", () => {
  it("renders the given label as a link to the given href", () => {
    renderWithProviders(<BackLink href="/scopecraft" labelKey="history.backToForm" />);

    const link = screen.getByRole("link", { name: "Back to the plan form" });
    expect(link).toHaveAttribute("href", "/scopecraft");
  });

  it("translates the label", () => {
    renderWithProviders(
      <BackLink href="/scopecraft/history" labelKey="history.detail.backToHistory" />,
      { locale: "ar" }
    );

    expect(screen.getByRole("link", { name: "العودة إلى خططك" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- BackLink.test.tsx`
Expected: FAIL — `Cannot find module '@/components/common/BackLink'`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/common/BackLink.tsx
//
// A back-navigation link with a direction-aware arrow.
//
// No literal "←" glyph: it points the wrong way once the page is `dir="rtl"`,
// where "back" reads right, not left. `inset-inline-start` on the icon
// container solves this the same way the rest of this app's layout does —
// no per-direction branching in the component itself.

"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import styles from "./BackLink.module.css";

export interface BackLinkProps {
  href: string;
  labelKey: TranslationKey;
}

export function BackLink({ href, labelKey }: BackLinkProps) {
  const { t } = useLanguage();

  return (
    <Link href={href} className={styles.link}>
      <span className={styles.arrow} aria-hidden="true" />
      {t(labelKey)}
    </Link>
  );
}
```

```css
/* src/components/common/BackLink.module.css
 *
 * The arrow is a CSS border-triangle, not a glyph — a Unicode arrow character
 * renders inconsistently across fonts, and mirroring it under `dir="rtl"`
 * would need the same per-direction branching this component exists to
 * avoid. Rotating a `border-inline-start` triangle with `transform` picks up
 * the writing direction for free.
 */
.link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--sc-text-muted);
  text-decoration: none;
}

.link:hover {
  color: var(--sc-text);
  text-decoration: underline;
}

.link:focus-visible {
  outline: 2px solid var(--sc-accent);
  outline-offset: 2px;
  border-radius: 0.25rem;
}

.arrow {
  width: 0;
  height: 0;
  border-block: 0.25rem solid transparent;
  border-inline-end: 0.3125rem solid currentColor;
  /* LTR: a leftward triangle, pointing toward inline-start. Under dir="rtl"
     the browser mirrors border-inline-end to the visual left automatically,
     so this needs no [dir] override. */
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- BackLink.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/common/BackLink.tsx src/components/common/BackLink.module.css tests/ui/BackLink.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat: add a direction-aware BackLink component"
```

---

### Task 3: Replace the mislabeled back links

**Files:**
- Modify: `src/app/scopecraft/history/page.tsx`
- Modify: `src/app/scopecraft/history/[id]/page.tsx`
- Modify: `src/app/scopecraft/history/HistoryList.module.css` (remove now-unused `.backLink`)

**Interfaces:**
- Consumes: `BackLink` from Task 2.

Both files currently render `<Link href="..." className={styles.backLink}>ScopeCraft</Link>`
— a link whose visible text is the brand name regardless of where it
actually goes. On the detail page this is doubly wrong: the link goes to
`/scopecraft/history`, not to "ScopeCraft."

- [ ] **Step 1: Replace the two links in `history/page.tsx`**

There are two occurrences (the database-error branch and the success
branch) of:

```tsx
        <Link href="/scopecraft" className={styles.backLink}>
          ScopeCraft
        </Link>
```

Wait — check the actual file first: one occurrence has a preceding comment
about the arrow glyph. Replace **both** occurrences of the block

```tsx
          <Link href="/scopecraft" className={styles.backLink}>
            ScopeCraft
          </Link>
```

(and, in the success branch, the comment immediately above it starting
`{/* No arrow glyph. ...`) with:

```tsx
          <BackLink href="/scopecraft" labelKey="history.backToForm" />
```

Remove the now-unused `import Link from "next/link";` from this file (check
first that nothing else in the file still uses `Link` — it does not; the
only use was these two links). Add:

```tsx
import { BackLink } from "@/components/common/BackLink";
```

Also remove the now-pointless wrapping `<p>...</p>` around each — `BackLink`
already renders its own inline element; keep it if the surrounding markup
depends on `<p>` for spacing, otherwise drop the tag. (Check the rendered
spacing after Step 4 below; if the gap looks wrong, keep the `<p>` wrapper.)

- [ ] **Step 2: Replace the link in `history/[id]/page.tsx`**

Replace:

```tsx
        <p>
          <Link href="/scopecraft/history" className={styles.backLink}>
            ScopeCraft
          </Link>
        </p>
```

with:

```tsx
        <BackLink href="/scopecraft/history" labelKey="history.detail.backToHistory" />
```

Remove `import Link from "next/link";` from this file if it is no longer
used elsewhere in it (check — it is not). Add:

```tsx
import { BackLink } from "@/components/common/BackLink";
```

- [ ] **Step 3: Remove the now-unused CSS class**

Delete the `.backLink` and `.backLink:hover` rules from
`src/app/scopecraft/history/HistoryList.module.css`:

```css
.backLink {
  font-size: 0.875rem;
  color: var(--sc-text-muted);
}

.backLink:hover {
  color: var(--sc-text);
}
```

- [ ] **Step 4: Manual verification**

Run the app locally (or use an existing running instance) and visually
confirm both pages: `/scopecraft/history` shows "Back to the plan form"
linking to `/scopecraft`, and a saved plan's detail page shows "Back to your
plans" linking to `/scopecraft/history`. There is no existing automated test
for either page (checked — `tests/` has none), so this step is the only
check until Task 9 adds a test file that also covers this rendering.

- [ ] **Step 5: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all four pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/scopecraft/history/page.tsx src/app/scopecraft/history/[id]/page.tsx src/app/scopecraft/history/HistoryList.module.css
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "fix(history): replace the brand-labeled back link with an honest one

Both history pages linked back with the text \"ScopeCraft\" regardless of
destination — on the plan-detail page this pointed at /scopecraft/history
while reading like a link to the brand. Uses the new BackLink component."
```

---

### Task 4: Landing page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/page.module.css`
- Test: `tests/ui/LandingPage.test.tsx`

**Interfaces:**
- Consumes: `Header` (existing, no prop changes needed — `onReset` stays
  omitted, which already hides the reset button per its existing logic).

Replaces the unconditional `redirect("/scopecraft")` with real, static
content. No `auth()` call — the single CTA always points at `/login`, which
already redirects an authenticated visitor to `/scopecraft` server-side
(`src/app/login/page.tsx:16`). This keeps `/` a plain, cacheable static
route.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/LandingPage.test.tsx
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./render-helpers";
import Home from "@/app/page";

describe("Landing page", () => {
  it("renders a heading, the example excerpt, and a CTA to /login", () => {
    renderWithProviders(<Home />);

    expect(
      screen.getByRole("heading", { name: "Turn a product idea into a sprint-ready plan." })
    ).toBeInTheDocument();
    expect(screen.getByText(/one of seven user stories/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/login");
  });

  it("renders the shared header", () => {
    renderWithProviders(<Home />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- LandingPage.test.tsx`
Expected: FAIL — the current `src/app/page.tsx` calls `redirect()`, which
throws inside a Jest/jsdom render (Next's `redirect` throws a special
`NEXT_REDIRECT` error to be caught by the framework, not by a test render).

- [ ] **Step 3: Write the page**

Two files: a server component holding `metadata` and `Header`, and a
client component for the part that needs `useLanguage()` — `metadata`
exports are only valid in a Server Component, so the page shell cannot
itself be `"use client"`.

```tsx
// src/app/page.tsx
//
// Public landing page (owner: Yousef).
//
// Deliberately has no `auth()` call. The single CTA always points at
// /login, which already resolves the "already signed in" case server-side
// (redirect("/scopecraft") in src/app/login/page.tsx) before rendering
// anything — duplicating that check here would be a second place a session
// check could drift out of sync with the first. That also keeps this page a
// plain static route: no cookies read, nothing here opts it out of
// prerendering.
//
// The body copy lives in HomeContent, a client component, because it needs
// useLanguage() to respond to the language toggle — this file stays a
// Server Component so `metadata` below is valid and the route can still
// prerender.

import type { Metadata } from "next";
import { Header } from "@/components/common/Header";
import { translate } from "@/lib/i18n/translations";
import { HomeContent } from "./HomeContent";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ScopeCraft",
  description: translate("en", "landing.heading"),
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <HomeContent />
      </main>
    </>
  );
}
```

```tsx
// src/app/HomeContent.tsx
"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./page.module.css";

export function HomeContent() {
  const { t } = useLanguage();

  return (
    <div className={styles.content}>
      <h1 className={styles.heading}>{t("landing.heading")}</h1>
      <p className={styles.tagline}>{t("app.tagline")}</p>

      <section className={styles.example} aria-labelledby="example-heading">
        <h2 id="example-heading" className={styles.exampleHeading}>
          {t("landing.exampleHeading")}
        </h2>
        <p className={styles.examplePrd}>{t("landing.examplePrd")}</p>
      </section>

      <Link href="/login" className={styles.cta}>
        {t("landing.cta")}
      </Link>
    </div>
  );
}
```

```css
/* src/app/page.module.css */
.main {
  max-width: 42rem;
  margin-inline: auto;
  padding: 3rem 1rem 4rem;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.heading {
  font-size: 2rem;
  line-height: 1.2;
  margin: 0;
}

.tagline {
  font-size: 1.0625rem;
  color: var(--sc-text-muted);
  margin: 0;
}

.example {
  border: 1px solid var(--sc-border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: var(--sc-surface-subtle);
}

.exampleHeading {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--sc-text-muted);
  margin: 0 0 0.5rem;
}

.examplePrd {
  margin: 0;
  font-style: italic;
}

.cta {
  align-self: start;
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  color: var(--sc-accent-contrast);
  background: var(--sc-accent);
  border-radius: 0.5rem;
  padding: 0.625rem 1.25rem;
  min-height: 2.75rem;
  text-decoration: none;
}

.cta:hover {
  opacity: 0.92;
}

.cta:focus-visible {
  outline: 2px solid var(--sc-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- LandingPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Confirm in the build output that `/` is listed as prerendered
(`○  /`), not dynamic (`ƒ  /`) — this is the property the "no `auth()` call"
design choice exists to preserve.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/HomeContent.tsx src/app/page.module.css tests/ui/LandingPage.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat: add a real public landing page at /

Replaces the unconditional redirect to /scopecraft. A signed-out visitor
now has something to read instead of bouncing straight to a login wall."
```

---

### Task 5: Home button in the header

**Files:**
- Modify: `src/components/common/Header.tsx`
- Modify: `tests/ui/Amenities.test.tsx` (extend the existing `describe("Header", ...)` block)

**Interfaces:**
- Consumes: `ToggleControls.module.css`'s existing `.linkButton` and `.icon`
  classes (already used by `HistoryLink` and `ThemeToggle` — no new CSS).

Unconditional — rendered on every page `Header` appears on, including
`/login` and the new `/`. No new component file: unlike `HistoryLink` and
`UserMenu`, this link has no session-dependent branching, so there's no
reason to isolate it in its own file (matching the reasoning already
written into `HistoryLink.tsx`'s own header comment).

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("Header", ...)` block in
`tests/ui/Amenities.test.tsx` (after the last existing `it(...)` in that
block, before the closing `});`):

```tsx
  it("links Home to the root path, unconditionally", () => {
    renderWithProviders(<Header />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Amenities.test.tsx -t "links Home"`
Expected: FAIL — no link with accessible name "Home" exists yet.

- [ ] **Step 3: Add the Home link**

In `src/components/common/Header.tsx`, add an import:

```tsx
import Link from "next/link";
import toggleStyles from "./ToggleControls.module.css";
```

(alongside the existing imports). Inside `<div className={styles.inner}>`,
immediately before `<div className={styles.brand}>`, add:

```tsx
        <Link href="/" className={toggleStyles.linkButton}>
          <HomeIcon />
          <span className={toggleStyles.buttonText}>{t("nav.home")}</span>
        </Link>
```

Add the `HomeIcon` function above the `Header` function, matching the
icon style already used in `ThemeToggle.tsx`:

```tsx
function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={toggleStyles.icon}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 11.5 12 4l8.5 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10.5V19a1 1 0 0 0 1 1h3v-4.5h4V20h3a1 1 0 0 0 1-1v-8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- Amenities.test.tsx -t "links Home"`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Confirm no existing `Header` test regressed — specifically the "first
focusable element" test (the skip link must still come before this new
link in tab order, since the skip link is a sibling rendered before
`.inner` entirely).

- [ ] **Step 6: Commit**

```bash
git add src/components/common/Header.tsx tests/ui/Amenities.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(header): add a Home button linking to /"
```

---

### Task 6: `InputForm` accepts prefill values

**Files:**
- Modify: `src/components/scopecraft/presets.ts`
- Modify: `src/components/scopecraft/InputForm.tsx`
- Test: `tests/ui/InputForm.test.tsx` (extend)

**Interfaces:**
- Produces: `export const DUPLICATE_PREFILL_STORAGE_KEY: string` from
  `presets.ts` — Task 7 and Task 9 both import this exact constant so
  the sessionStorage key can never drift between the writer (Task 9) and
  the reader (Task 7).
- Produces: `InputFormProps.initialValues?: IntakeFormValues` — a new,
  optional prop. Passing it prefills the form's initial state. **Changing
  this prop's value on an already-mounted `InputForm` does nothing** — it
  is read once, by a lazy `useState` initializer. Task 7 is responsible for
  forcing a remount (via a changed `key` prop) when the value becomes
  available after mount.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/InputForm.test.tsx` (find the existing top-level
`describe("InputForm", ...)` or equivalent and add inside it — if the file
has no such wrapping describe, add this as a new top-level `describe`):

```tsx
describe("InputForm initialValues", () => {
  it("prefills every field from initialValues on first render", () => {
    renderWithProviders(
      <InputForm
        onSubmit={jest.fn()}
        initialValues={{
          idea: "A duplicate of an existing plan",
          constraints: "Team of two",
          team_capacity_points: "25",
          sprint_length_days: "7",
        }}
      />
    );

    expect(screen.getByLabelText(/product idea/i)).toHaveValue(
      "A duplicate of an existing plan"
    );
    expect(screen.getByLabelText(/constraints/i)).toHaveValue("Team of two");
  });

  it("falls back to the empty defaults when initialValues is omitted", () => {
    renderWithProviders(<InputForm onSubmit={jest.fn()} />);

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("");
  });
});
```

(Check the exact label-matching regex against how existing tests in this
file query the idea/constraints fields — reuse whatever pattern is already
there instead of `getByLabelText(/product idea/i)` if the file's convention
differs, e.g. `getByRole("textbox", { name: ... })`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- InputForm.test.tsx -t "initialValues"`
Expected: FAIL — `initialValues` is not a recognized prop yet (TypeScript
error at compile time inside the test file, surfaced by ts-jest as a test
failure).

- [ ] **Step 3: Add the constant to `presets.ts`**

Add, near the top of `src/components/scopecraft/presets.ts` (after the
`IntakeFormValues` interface):

```ts
/**
 * sessionStorage key used to hand a plan's fields from a history card's
 * "Duplicate" action to the generator page. Exported so the writer
 * (HistoryList) and the reader (ScopeCraftPage) can never drift apart on
 * the literal string.
 */
export const DUPLICATE_PREFILL_STORAGE_KEY = "scopecraft.duplicatePrefill";
```

- [ ] **Step 4: Add the prop to `InputForm`**

In `src/components/scopecraft/InputForm.tsx`, change:

```tsx
export interface InputFormProps {
  onSubmit: (payload: IntakeSubmitPayload) => void;
  /** True while a plan is being generated. Disables the form and marks it busy. */
  isLoading?: boolean;
}
```

to:

```tsx
export interface InputFormProps {
  onSubmit: (payload: IntakeSubmitPayload) => void;
  /** True while a plan is being generated. Disables the form and marks it busy. */
  isLoading?: boolean;
  /**
   * Prefills the form once, on mount. Read by a lazy `useState` initializer,
   * so a prop update on an already-mounted instance has no effect — the
   * caller must change this component's `key` to force a fresh mount if the
   * value becomes available after the initial render (see ScopeCraftPage).
   */
  initialValues?: IntakeFormValues;
}
```

Change:

```tsx
export function InputForm({ onSubmit, isLoading = false }: InputFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<IntakeFormValues>(emptyFormValues);
```

to:

```tsx
export function InputForm({ onSubmit, isLoading = false, initialValues }: InputFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<IntakeFormValues>(
    () => initialValues ?? emptyFormValues()
  );
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- InputForm.test.tsx -t "initialValues"`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/scopecraft/presets.ts src/components/scopecraft/InputForm.tsx tests/ui/InputForm.test.tsx
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(input-form): accept initialValues to prefill the form on mount"
```

---

### Task 7: Consume the prefill on the generator page

**Files:**
- Modify: `src/app/scopecraft/page.tsx`
- Test: extend an existing test file covering `ScopeCraftPage`, or create
  `tests/ui/ScopeCraftPage.prefill.test.tsx` if none currently renders
  this page directly (check `tests/ui/StateTransitions.test.tsx` first —
  it likely already imports and renders `ScopeCraftPage`; if so, add the
  new tests there instead of a new file).

**Interfaces:**
- Consumes: `DUPLICATE_PREFILL_STORAGE_KEY`, `type IntakeFormValues` from
  `@/components/scopecraft/presets` (Task 6).
- Produces: nothing new for later tasks — this is the last piece of the
  duplicate feature. Task 9's Duplicate button writes to the same
  sessionStorage key this task reads.

On mount, checks `sessionStorage` for a prefill payload written by a
history card's "Duplicate" button (Task 9). If present, consumes it (reads
and immediately removes the key) and remounts `InputForm` with those
values via a changed `key`.

- [ ] **Step 1: Check which test file already renders `ScopeCraftPage`**

```bash
grep -l "ScopeCraftPage\|from \"@/app/scopecraft/page\"" tests/ui/*.tsx
```

If `tests/ui/StateTransitions.test.tsx` (or similar) already imports and
renders it, add the new tests there, inside a new `describe` block. Adjust
the import path in Step 2 below to match whichever file you use.

- [ ] **Step 2: Write the failing test**

```tsx
describe("ScopeCraftPage duplicate prefill", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("prefills the form from sessionStorage and clears the key", () => {
    sessionStorage.setItem(
      DUPLICATE_PREFILL_STORAGE_KEY,
      JSON.stringify({
        idea: "A duplicated idea",
        constraints: "Some constraints",
        team_capacity_points: "25",
        sprint_length_days: "7",
      })
    );

    renderWithProviders(<ScopeCraftPage />);

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("A duplicated idea");
    expect(sessionStorage.getItem(DUPLICATE_PREFILL_STORAGE_KEY)).toBeNull();
  });

  it("renders the normal empty form when there is nothing to prefill", () => {
    renderWithProviders(<ScopeCraftPage />);

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("");
  });
});
```

Add the import at the top of the test file:

```tsx
import { DUPLICATE_PREFILL_STORAGE_KEY } from "@/components/scopecraft/presets";
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- <that test file> -t "duplicate prefill"`
Expected: FAIL — the page currently ignores sessionStorage entirely, so the
idea field stays empty in both tests, failing the first assertion.

- [ ] **Step 4: Implement the mount effect and remount key**

In `src/app/scopecraft/page.tsx`, add to the imports:

```tsx
import {
  DUPLICATE_PREFILL_STORAGE_KEY,
  type IntakeFormValues,
} from "@/components/scopecraft/presets";
```

Add a new piece of state alongside the existing ones (near
`const [state, setState] = useState<UiState>({ status: "idle" });`):

```tsx
  const [duplicateValues, setDuplicateValues] = useState<IntakeFormValues | undefined>(
    undefined
  );
```

Add a new mount-only effect (place it near the existing
`useEffect(() => { return () => { ... }; }, []);` cleanup effect):

```tsx
  // Reads a prefill payload written by a history card's "Duplicate" button
  // (see HistoryList). Consumed once: the key is removed immediately so a
  // later, unrelated visit to /scopecraft never re-applies stale data.
  useEffect(() => {
    const raw = sessionStorage.getItem(DUPLICATE_PREFILL_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(DUPLICATE_PREFILL_STORAGE_KEY);
    try {
      setDuplicateValues(JSON.parse(raw) as IntakeFormValues);
    } catch {
      // Corrupted value — treated exactly like "nothing to prefill".
    }
  }, []);
```

Change the `<InputForm .../>` render site from:

```tsx
        <InputForm onSubmit={submit} isLoading={state.status === "loading"} />
```

to:

```tsx
        {/* `key` forces a remount when duplicateValues arrives after the
            initial render — InputForm's lazy useState initializer only runs
            once per mount, so a plain prop change would be silently
            ignored. */}
        <InputForm
          key={duplicateValues ? "duplicate" : "empty"}
          initialValues={duplicateValues}
          onSubmit={submit}
          isLoading={state.status === "loading"}
        />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- <that test file> -t "duplicate prefill"`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/scopecraft/page.tsx <the test file you edited>
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(scopecraft): prefill the form from a duplicated plan"
```

---

### Task 8: `DELETE /api/scopecraft/[id]`

**Files:**
- Modify: `src/app/api/scopecraft/[id]/route.ts`
- Modify: `tests/api/scopecraft.test.ts` (extend)

**Interfaces:**
- Produces: `DELETE` handler on the existing route file. Task 9's client
  code calls `fetch(`/api/scopecraft/${id}`, { method: "DELETE" })`
  expecting `204` on success, `401`/`404` with the existing
  `{ error, code, message }` envelope otherwise — no new error code.

Mirrors the existing `PATCH` handler in the same file exactly: session
check, id-format check, a scoped write, 404 for both "doesn't exist" and
"isn't yours."

- [ ] **Step 1: Write the failing tests**

The existing `PATCH` tests live in `describe("board persistence", ...)`
(search for that exact string). They do **not** use the file's top-level
`makeRequest` helper — that one is hardcoded to `POST` against
`/api/scopecraft` for a different test group entirely. `PATCH`'s own tests
build the request locally:

```ts
  function patch(id: string, body: unknown) {
    return PATCH(
      new NextRequest(`http://localhost/api/scopecraft/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    );
  }
```

Mirror this exactly for `DELETE`, as a new `describe` block placed
immediately after `describe("board persistence", ...)` closes:

```ts
describe("plan deletion", () => {
  const PLAN_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  function del(id: string) {
    return DELETE(
      new NextRequest(`http://localhost/api/scopecraft/${id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) }
    );
  }

  it("rejects an anonymous caller without querying the database", async () => {
    signOut();
    const response = await del(PLAN_ID);

    expect(response.status).toBe(401);
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed id as 404 rather than reaching Postgres", async () => {
    const response = await del("not-a-uuid");

    expect(response.status).toBe(404);
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("answers 404 for another user's plan, indistinguishably from a missing one", async () => {
    queueDbResult([]); // the user_id predicate matched nothing
    const response = await del(PLAN_ID);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("deletes the row and returns 204 for the owner", async () => {
    queueDbResult([{ id: PLAN_ID }]);
    const response = await del(PLAN_ID);

    expect(response.status).toBe(204);
  });

  it("scopes the delete by the session user, not by anything in the request", async () => {
    queueDbResult([{ id: PLAN_ID }]);
    await del(PLAN_ID);

    const call = dbMock.mock.calls.at(-1) ?? [];
    const fragments = (call[0] as string[]).join("?");
    expect(fragments).toContain("user_id =");
    expect(call.slice(1)).toContain(TEST_USER_ID);
  });
});
```

`dbMock`, `queueDbResult`, `signOut`, `TEST_USER_ID` are already imported
at the top of this file from `./setup` (used by the `PATCH` tests above) —
no new import needed for those. Add `DELETE` to the existing
`import { PATCH } from "@/app/api/scopecraft/[id]/route";` line, making it
`import { PATCH, DELETE } from "@/app/api/scopecraft/[id]/route";`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- scopecraft.test.ts -t "plan deletion"`
Expected: FAIL — `DELETE` is not exported from the route file yet.

- [ ] **Step 3: Implement the handler**

In `src/app/api/scopecraft/[id]/route.ts`, add after the existing `PATCH`
function:

```ts
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return fail("UNAUTHORIZED", "Please sign in to delete a plan.", 401);
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  // Scoped by user_id from the session, exactly like PATCH above — the same
  // IDOR boundary applies to a delete as it does to an edit.
  const rows = await sql`
    delete from plans
    where id = ${id} and user_id = ${userId}
    returning id`;

  if (rows.length === 0) {
    return fail("NOT_FOUND", "Unknown plan.", 404);
  }

  return new NextResponse(null, { status: 204 });
}
```

Update the file's header comment (the block starting `// Board persistence
(owner: Yousef).`) to mention deletion too — change the first line to:

```ts
// Board persistence and plan deletion (owner: Yousef).
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- scopecraft.test.ts -t "plan deletion"`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/scopecraft/[id]/route.ts tests/api/scopecraft.test.ts
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(api): add DELETE /api/scopecraft/[id]

Mirrors PATCH's session check, id validation, and user_id scoping. No new
error code — UNAUTHORIZED and NOT_FOUND already cover it."
```

---

### Task 9: History list — duplicate, delete, and a stats strip

**Files:**
- Modify: `src/app/scopecraft/history/page.tsx`
- Modify: `src/app/scopecraft/history/HistoryList.tsx`
- Modify: `src/app/scopecraft/history/HistoryList.module.css`
- Create: `tests/ui/HistoryList.test.tsx`

**Interfaces:**
- Consumes: `DUPLICATE_PREFILL_STORAGE_KEY`, `type IntakeFormValues` from
  `@/components/scopecraft/presets` (Task 6); the `DELETE` route from
  Task 8; `useToast` from `@/context/ToastContext` (existing).

The biggest remaining task. `PlanSummary` gains a `constraints` field (the
column is already on the table, just not selected before). Each card gets
two buttons; the page gets a one-line stats summary above the list.

- [ ] **Step 1: Add `constraints` to the query and the type**

In `src/app/scopecraft/history/page.tsx`, change the `PlanSummary` import
site — actually `PlanSummary` is defined in `HistoryList.tsx` and imported
here. Change the `select` in the `try` block from:

```ts
      select id, idea, status, error_code as "errorCode",
             capacity_points as "capacityPoints", sprint_days as "sprintDays",
             provider_used as "providerUsed",
             board is not null as edited,
             created_at as "createdAt"
```

to:

```ts
      select id, idea, constraints, status, error_code as "errorCode",
             capacity_points as "capacityPoints", sprint_days as "sprintDays",
             provider_used as "providerUsed",
             board is not null as edited,
             created_at as "createdAt"
```

In `src/app/scopecraft/history/HistoryList.tsx`, change the `PlanSummary`
interface from:

```ts
export interface PlanSummary {
  id: string;
  idea: string;
  status: "ok" | "failed";
  errorCode: string | null;
  capacityPoints: number;
  sprintDays: number;
  providerUsed: string | null;
  edited: boolean;
  createdAt: string;
}
```

to:

```ts
export interface PlanSummary {
  id: string;
  idea: string;
  constraints: string | null;
  status: "ok" | "failed";
  errorCode: string | null;
  capacityPoints: number;
  sprintDays: number;
  providerUsed: string | null;
  edited: boolean;
  createdAt: string;
}
```

(No change needed to the `serialize()` function in `page.tsx` — it only
transforms `createdAt`; `constraints` passes through untouched, same as
every other plain field.)

- [ ] **Step 2: Write the failing tests for the stats strip**

```tsx
// tests/ui/HistoryList.test.tsx
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./render-helpers";
import { HistoryList, type PlanSummary } from "@/app/scopecraft/history/HistoryList";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

function makePlan(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    idea: "A test idea",
    constraints: "Team of four",
    status: "ok",
    errorCode: null,
    capacityPoints: 30,
    sprintDays: 14,
    providerUsed: "groq",
    edited: false,
    createdAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("HistoryList stats strip", () => {
  it("shows a singular count for exactly one plan", () => {
    renderWithProviders(<HistoryList plans={[makePlan()]} />);
    expect(screen.getByText("1 plan")).toBeInTheDocument();
  });

  it("shows a plural count and the average capacity for several plans", () => {
    renderWithProviders(
      <HistoryList
        plans={[
          makePlan({ id: "1", capacityPoints: 20 }),
          makePlan({ id: "2", capacityPoints: 40 }),
        ]}
      />
    );
    expect(screen.getByText("2 plans")).toBeInTheDocument();
    expect(screen.getByText(/Average capacity: 30 pts/)).toBeInTheDocument();
  });

  it("shows no stats strip when there are no plans", () => {
    renderWithProviders(<HistoryList plans={[]} />);
    expect(screen.queryByText(/Average capacity/)).not.toBeInTheDocument();
  });
});

describe("HistoryList duplicate action", () => {
  afterEach(() => sessionStorage.clear());

  it("writes the plan's fields to sessionStorage as strings", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<HistoryList plans={[makePlan()]} />);

    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    const raw = sessionStorage.getItem("scopecraft.duplicatePrefill");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      idea: "A test idea",
      constraints: "Team of four",
      team_capacity_points: "30",
      sprint_length_days: "14",
    });
  });
});

describe("HistoryList delete action", () => {
  it("requires a second click to actually delete", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 204 } as Response);
    renderWithProviders(<HistoryList plans={[makePlan()]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Confirm delete?" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete?" }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/scopecraft/11111111-1111-1111-1111-111111111111",
      { method: "DELETE" }
    );
  });

  it("shows a toast and keeps the row on failure", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 404 } as Response);
    renderWithProviders(<HistoryList plans={[makePlan()]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete?" }));

    expect(
      await screen.findByText("This plan could not be deleted. Please try again.")
    ).toBeInTheDocument();
  });
});
```

Check this file's imports against how other test files in `tests/ui/`
import `userEvent` at the top of the file rather than dynamically inside
each test — match that convention (a static
`import userEvent from "@testing-library/user-event";` at the top is very
likely already the house style; the dynamic import above is only a
placeholder for this plan and should be replaced with whatever the rest of
this codebase does).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- HistoryList.test.tsx`
Expected: FAIL — no stats strip, no Duplicate button, no Delete button
exist yet.

- [ ] **Step 4: Implement the stats strip, Duplicate, and Delete**

Replace the full contents of
`src/app/scopecraft/history/HistoryList.tsx` with:

```tsx
// src/app/scopecraft/history/HistoryList.tsx
//
// The rendering half of "Your plans" (owner: Yousef).
//
// A client component only because it needs three things the server cannot
// supply: the reader's chosen language, their timezone, and the ability to
// call fetch() and the router directly for delete/duplicate. Dates are
// formatted here for the timezone reason — the server renders in its own
// locale and timezone, which is neither the reader's nor the one they
// picked, and a server-formatted date is a classic hydration mismatch.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { DUPLICATE_PREFILL_STORAGE_KEY } from "@/components/scopecraft/presets";
import styles from "./HistoryList.module.css";

export interface PlanSummary {
  id: string;
  idea: string;
  constraints: string | null;
  status: "ok" | "failed";
  errorCode: string | null;
  capacityPoints: number;
  sprintDays: number;
  providerUsed: string | null;
  edited: boolean;
  createdAt: string;
}

/** `null` means the query failed — distinct from an empty list, which means the
 *  user genuinely has no plans. Conflating the two would tell someone their
 *  work had vanished during a database outage. */
export function HistoryList({ plans }: { plans: PlanSummary[] | null }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { showToast } = useToast();
  const [visiblePlans, setVisiblePlans] = useState<PlanSummary[] | null>(plans);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (visiblePlans === null) {
    return <ErrorState message={t("history.unavailable")} />;
  }

  if (visiblePlans.length === 0) {
    return <EmptyState headingKey="history.empty" bodyKey="history.emptyAction" />;
  }

  const totalCapacity = visiblePlans.reduce((sum, plan) => sum + plan.capacityPoints, 0);
  const averageCapacity = Math.round(totalCapacity / visiblePlans.length);

  function duplicate(plan: PlanSummary) {
    sessionStorage.setItem(
      DUPLICATE_PREFILL_STORAGE_KEY,
      JSON.stringify({
        idea: plan.idea,
        constraints: plan.constraints ?? "",
        team_capacity_points: String(plan.capacityPoints),
        sprint_length_days: String(plan.sprintDays),
      })
    );
    router.push("/scopecraft");
  }

  async function deletePlan(id: string) {
    setConfirmingId(null);
    try {
      const response = await fetch(`/api/scopecraft/${id}`, { method: "DELETE" });
      if (!response.ok) {
        showToast(t("history.deleteFailed"), "error");
        return;
      }
      setVisiblePlans((current) => (current ?? []).filter((plan) => plan.id !== id));
      router.refresh();
    } catch {
      showToast(t("history.deleteFailed"), "error");
    }
  }

  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title" className={styles.title}>
        {t("history.title")}
      </h1>
      <p className={styles.subtitle}>{t("history.showing")}</p>

      <p className={styles.stats}>
        {visiblePlans.length === 1
          ? t("history.stats.plans.one")
          : t("history.stats.plans.many", { count: visiblePlans.length })}
        {" · "}
        {t("history.stats.avgCapacity", { avg: averageCapacity })}
      </p>

      <ul className={styles.list}>
        {visiblePlans.map((plan) => (
          <li key={plan.id} className={styles.item}>
            {/* dir="auto" because this is the user's own text and may be in
                either language regardless of the interface language. Without
                it, an Arabic idea renders left-aligned in the English UI and an
                English idea renders right-aligned in the Arabic one — the
                browser infers direction from the first strong character. */}
            {plan.status === "ok" ? (
              // Only successful plans open: a failed row has no `response` to
              // render, so linking it would promise a page that 404s.
              <Link href={`/scopecraft/history/${plan.id}`} className={styles.ideaLink}>
                <span className={styles.idea} dir="auto">
                  {plan.idea}
                </span>
              </Link>
            ) : (
              <p className={styles.idea} dir="auto">
                {plan.idea}
              </p>
            )}

            <p className={styles.meta}>
              {/* `time` carries the machine-readable value; the text is the
                  human one, in the reader's own locale and timezone. */}
              <time dateTime={plan.createdAt}>
                {new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(plan.createdAt))}
              </time>
              {" · "}
              {plan.capacityPoints} {t("history.points")}
              {" · "}
              {plan.sprintDays} {t("history.days")}
            </p>

            <p className={styles.badges}>
              {plan.status === "failed" && (
                <span className={styles.badgeFailed}>
                  {t("history.failed")}
                  {plan.errorCode ? ` (${plan.errorCode})` : ""}
                </span>
              )}
              {plan.edited && (
                // The one flag worth showing: it distinguishes a plan the human
                // reshaped from one left as the model produced it, which is the
                // product's central distinction.
                <span className={styles.badgeEdited}>{t("history.edited")}</span>
              )}
              {plan.providerUsed && (
                <span className={styles.badgeProvider}>{plan.providerUsed}</span>
              )}
            </p>

            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.duplicateButton}
                onClick={() => duplicate(plan)}
                title={t("history.duplicate.description")}
              >
                {t("history.duplicate")}
              </button>
              {confirmingId === plan.id ? (
                <button
                  type="button"
                  className={styles.deleteButtonConfirming}
                  onClick={() => deletePlan(plan.id)}
                  onBlur={() => setConfirmingId(null)}
                >
                  {t("history.delete.confirm")}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => setConfirmingId(plan.id)}
                  title={t("history.delete.description")}
                >
                  {t("history.delete")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Add to `src/app/scopecraft/history/HistoryList.module.css` (after the
existing `.badgeProvider` rule):

```css
.stats {
  margin-block: 0 0.5rem;
  font-size: 0.875rem;
  color: var(--sc-text-muted);
}

.cardActions {
  margin-block-start: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.duplicateButton,
.deleteButton,
.deleteButtonConfirming {
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  min-height: 2rem;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.duplicateButton {
  color: var(--sc-text);
  background: var(--sc-surface-raised);
  border: 1px solid var(--sc-border);
}

.duplicateButton:hover {
  border-color: var(--sc-border-strong);
  background: var(--sc-surface-subtle);
}

.deleteButton {
  color: var(--sc-danger);
  background: var(--sc-surface-raised);
  border: 1px solid var(--sc-border);
}

.deleteButton:hover {
  border-color: var(--sc-danger);
  background: var(--sc-danger-surface);
}

.deleteButtonConfirming {
  color: var(--sc-accent-contrast);
  background: var(--sc-danger);
  border: 1px solid var(--sc-danger);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- HistoryList.test.tsx`
Expected: PASS (7 tests). If any test's exact query (`getByRole`,
`getByText`) doesn't match due to a house-style difference caught in
Step 2's note about `userEvent`'s import style, fix the test file, not the
component — the component code above is the target shape.

- [ ] **Step 6: Manual verification of the two-click confirm**

Run the app locally, open "Your plans" with at least one saved plan, click
"Delete" once (button becomes "Confirm delete?"), click elsewhere on the
page (blur), and confirm the button reverts to "Delete" rather than staying
armed indefinitely.

- [ ] **Step 7: Run the full gate, then re-run the UI capture**

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run capture:ui
```

Compare the new screenshots against `docs/evidence/ui/accessibility-audit.txt`
and update `docs/evidence/ui/accessibility-checklist.md`'s measured-results
table if any count changed (interactive-control count will rise — a
Duplicate and a Delete button per card is new).

- [ ] **Step 8: Commit**

```bash
git add src/app/scopecraft/history/page.tsx src/app/scopecraft/history/HistoryList.tsx src/app/scopecraft/history/HistoryList.module.css tests/ui/HistoryList.test.tsx docs/evidence/
git -c user.name="Yousef mohmed hasabo" -c user.email="yousefhasabo94@gmail.com" commit -m "feat(history): duplicate, delete, and a stats strip

Duplicate writes the plan's fields to sessionStorage and navigates to the
generator, which prefills from them (see the two prior commits). Delete is
a two-click inline confirm calling the new DELETE route, then
router.refresh() so the list re-reads from the server rather than keeping
a second, client-side copy of what \"your plans\" contains. The stats
strip is computed from the rows already on the page — no new query."
```

---

## Plan self-review

**Spec coverage** — every numbered item in the design spec's "History gets
three additions" and navigation sections maps to a task: landing page →
Task 4; Home button → Task 5; BackLink + its two call sites → Tasks 2–3;
duplicate → Tasks 6–7 (form) + 9 (trigger); delete → Task 8 (route) + 9
(trigger); stats strip → Task 9. The spec's "Explicitly out of scope"
section (no dashboard page, no bulk delete/undo, no schema change) is
respected — no task does any of those.

**Placeholder scan** — no task contains "TBD" or an unwritten test. Task 7
and Task 9 both include a "check which file/convention already exists"
step rather than a placeholder, because the exact existing test file names
for `ScopeCraftPage` and the exact `userEvent` import style could not be
pinned down without running the test suite interactively — each such step
names precisely what to check and what to do with either outcome, which is
different from leaving a gap.

**Type consistency** — `IntakeFormValues` (Task 6's new prop, Task 7's
state, Task 9's sessionStorage payload) has the same four fields
(`idea`, `constraints`, `team_capacity_points`, `sprint_length_days`, all
strings) everywhere it's constructed or consumed. `DUPLICATE_PREFILL_STORAGE_KEY`
is defined once (Task 6) and only ever imported, never redefined, by Tasks
7 and 9. `PlanSummary`'s new `constraints: string | null` field is added in
the same task (9) that both changes the SQL `select` and reads the field,
so there's no window where the type and the query disagree.
