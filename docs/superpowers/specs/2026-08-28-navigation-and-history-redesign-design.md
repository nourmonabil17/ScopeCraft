# Navigation and history redesign

Status: approved by Yousef 2026-08-28. Implementation not yet started.

## Why

`/` currently redirects straight to `/scopecraft`, so a signed-out visitor
bounces twice (`/` → `/scopecraft` → `/login`) and there is nothing to show an
examiner who isn't logged in. The history page's only way back is a `<Link>`
literally labeled `ScopeCraft`, which reads as a brand link rather than a back
action — it's the app's own existing back-link, mislabeled, not a missing
feature. And three capabilities the schema was already built for
(`plans.constraints`, `plans.capacity_points`, `plans.sprint_days` are stored,
per the schema's own comment, "so a plan can be explained or re-run") were
never wired to a UI: deleting a plan, re-running one, and any aggregate view
of your own history.

## Architecture

No schema change. No new dependency. Two new routes, one new API method on an
existing route file, three small new components, edits to five existing ones.

**New: `/` becomes a real page**, replacing the `redirect("/scopecraft")` in
`src/app/page.tsx`. It stays a plain server component with no `auth()` call —
static, edge-cacheable, restoring a property the app lost when auth landed.
Its single CTA always points at `/login`, because `/login` **already**
resolves the signed-in case server-side (`if (session?.user) redirect
("/scopecraft")`) before ever rendering the sign-in card. The landing page
does not need to know or check whether you're signed in — `/login` already
does, and duplicating that check on `/` would be the second source of truth
this app's own rules warn against.

(This is a small refinement on what I described verbally: rather than the
landing page itself branching on session state, it delegates that entirely
to the page that already does it correctly. Same user-visible result, one
fewer place a session check could drift out of sync.)

**New: `BackLink` component** (`src/components/common/BackLink.tsx`) — a
small client component: an `href` and a `labelKey` (`TranslationKey`), styled
with a logical-property arrow (`inset-inline-start`, not a literal `←`, so it
flips correctly under `dir="rtl"` with no per-direction branching). Replaces
the existing mislabeled `<Link>ScopeCraft</Link>` in
`src/app/scopecraft/history/page.tsx` (both the success and the
database-error branches), going to `/scopecraft` with the label **"back to
the generator,"** not "back to ScopeCraft" — reusing the brand word as a
navigation label is the exact confusion this redesign exists to remove. Also
added to `src/app/scopecraft/history/[id]/page.tsx`, going to
`/scopecraft/history` as **"back to your plans."**

Deliberately **not** added to `src/app/scopecraft/page.tsx`. Its logical
parent is `/`, and the header's new Home button already links there from
every page, including this one — a second control with the identical
destination on the same page is clutter, not consistency.

**Header gets one addition**: a Home icon-button, always rendered, linking to
`/`. Placed before the brand mark. No conditional — clicking it while already
on `/` is a harmless no-op `Link`. The existing `Header` component is reused
as-is on the new landing page too; its signed-in-only pieces (`UserMenu`,
`HistoryLink`) already render `null` when signed out, so no new prop is
needed to make the same header correct on a public page.

**History list gets three additions**, all client-side in `HistoryList.tsx`
and its parent page — no new page, no new route for two of the three:

1. **Duplicate.** The list query in `src/app/scopecraft/history/page.tsx`
   gains one column: `constraints`. (`capacity_points` and `sprint_days` are
   already selected.) A "Duplicate" button on each card writes
   `{ idea, constraints, team_capacity_points, sprint_length_days }` to
   `sessionStorage` under a fixed key and navigates to `/scopecraft`.
   `InputForm` gains an `initialValues?: Partial<IntakeFormValues>` prop;
   `ScopeCraftPage` reads the sessionStorage key in a mount-only `useEffect`,
   applies it via the same state-setting path `applyPreset` already uses, and
   clears the key. Not a query param: the plan's idea and constraints are
   free text the user wrote, and URL parameters are logged by proxies and
   show up in browser history — sessionStorage is same-origin, ephemeral, and
   never leaves the browser. Not a new API route: every field it needs is
   already in the list query's result.

2. **Delete.** New `DELETE` handler in the existing
   `src/app/api/scopecraft/[id]/route.ts` (alongside `PATCH`) — same
   shape as `PATCH`: session check, id-format check, `delete from plans
   where id = $1 and user_id = $2 returning id`, 404 if no row matched
   (indistinguishable from "not yours," same as `PATCH` and the detail page
   already do), 204 on success. No new error code — `UNAUTHORIZED` and
   `NOT_FOUND` already cover it. Client side: a two-click inline confirm on
   the card itself (click "Delete" → the same control becomes "Confirm
   delete?" for a few seconds or until it loses focus) rather than a modal —
   no new dependency, no focus-trap to get right, and the existing app has no
   modal component to reuse. On success, the page calls `router.refresh()`
   so the list re-reads from the server rather than keeping a second,
   client-side copy of what "your plans" currently contains. On failure, an
   existing `Toast` reports it; the row stays.

3. **Stats strip.** A one-line summary above the list: plan count and average
   team capacity, computed client-side from the rows already on the page —
   zero new queries, zero new columns. Deliberately not "average committed
   points": that number lives inside the `response` JSONB blob, and pulling
   it for every row (even via a targeted `->>'committed_points'` path
   extraction) is more than a decorative stat justifies when
   `capacity_points` — a plans column already selected — says almost the
   same thing. Deliberately not exact beyond the existing 50-row cap: the
   list itself is documented as "capped rather than paginated," and a stat
   computed from what's already capped is consistent with that, not a new
   inaccuracy.

## Data flow

- Landing page: no data flow. Static markup, one link.
- Duplicate: `HistoryList` card → `sessionStorage.setItem` → `router.push`
  → `ScopeCraftPage` mount effect → `sessionStorage.getItem` +
  `removeItem` → `InputForm` `initialValues`.
- Delete: card button → `DELETE /api/scopecraft/[id]` → 204 →
  `router.refresh()` re-runs the server component's existing `select` →
  fresh `plans` prop → card gone. No client-side list mutation.
- Stats: derived, in the render path, from the same `plans` array
  `HistoryList` already receives. No new prop, no new fetch.

## Error handling

- Delete network/5xx failure: `Toast` shows `history.deleteFailed`; button
  reverts to its normal "Delete" state; the row is untouched, because
  nothing was optimistically removed.
- Delete against a plan that no longer exists or isn't yours: `404
  NOT_FOUND`, same envelope the route already returns elsewhere — the UI
  treats this the same as a network failure (show the toast, refresh the
  list next time), since either way the safe move is "don't claim success
  you can't confirm."
- Duplicate reading a corrupted or absent `sessionStorage` value: the
  mount effect no-ops. The form just opens empty, which is the page's
  existing default state — not an error path, a graceful absence.
- Landing page: no failure mode to handle; it renders unconditionally.

## Testing

- `tests/api/scopecraft.test.ts`: new `describe("DELETE /api/scopecraft/
  [id]")` mirroring the existing `PATCH` block — 401 anonymous, 404
  malformed id, 404 someone else's plan, 204 + row actually gone for the
  owner (assert via a follow-up `select`, the way the `PATCH` tests already
  confirm a write landed).
- `tests/ui/InputForm.test.tsx`: `initialValues` prefills all four fields
  and does not clobber a later preset click.
- A small render test for `BackLink` confirming `labelKey` renders as text
  (not just an icon) and the arrow direction responds to `dir`.
- `npm run capture:ui` re-run before commit, per the project's own rule
  that a UI change ships with a fresh capture — new landing-page screenshot,
  updated history screenshots (stats strip, duplicate/delete controls,
  back links replacing the old bottom link).
- Both `en` and `ar` read on screen for every new string, per the existing
  Module 10 discipline — not just the compile-time key-parity check, which
  a hardcoded-unit bug already proved insufficient on its own.

## Explicitly out of scope

- No signed-in "dashboard" page — the stats strip covers the one piece of
  that idea (an at-a-glance number) without duplicating `/scopecraft/
  history`.
- No bulk delete, no undo. A single-item, two-click confirm is the whole
  feature; "are you sure" twice is the safety margin for a destructive
  action on data with no other recovery path.
- No change to `plans.response` / `plans.board` separation, and no new
  column. Everything here reads existing data or writes a `delete`.
