// src/app/scopecraft/history/page.tsx
//
// "Your plans" (owner: Yousef).
//
// A SERVER COMPONENT, DELIBERATELY. The query runs where the credential is —
// there is no JSON endpoint behind this page, because a route that exists only
// to feed your own frontend is an API surface you have to secure for no
// benefit. The parent layout already gates the route, so reaching this file at
// all means there is a session.
//
// SCOPED BY SESSION, NEVER BY INPUT. `user_id` comes from auth(), not from a
// query parameter or a path segment. This page and the board PATCH are the two
// places an IDOR could enter this codebase, and both take the id the same way.

import Link from "next/link";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { Header } from "@/components/common/Header";
import { HistoryList, type PlanSummary } from "./HistoryList";
import styles from "./HistoryList.module.css";

// Reads cookies and queries per request; there is nothing here to prerender.
export const dynamic = "force-dynamic";

/**
 * Capped rather than paginated.
 *
 * The daily quota is 20, so a heavy user reaches a few hundred rows a month —
 * a "load more" control would be scaffolding for a scale this app does not have
 * and a limit nobody would hit in a demo. What matters is that the query is
 * bounded at all: `select *` over an unbounded table of JSONB rows is a time
 * bomb, and `response` is the largest column in the schema.
 *
 * Note what is *not* selected: `response` and `board` are excluded entirely.
 * The list needs neither, and fetching a full PRD per row to render a date
 * would move megabytes to render kilobytes.
 */
const MAX_ROWS = 50;

export default async function HistoryPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null; // unreachable: the layout redirects first

  const plans = await sql<PlanSummary[]>`
    select id, idea, status, error_code as "errorCode",
           capacity_points as "capacityPoints", sprint_days as "sprintDays",
           provider_used as "providerUsed",
           board is not null as edited,
           created_at as "createdAt"
    from plans
    where user_id = ${userId}
    order by created_at desc
    limit ${MAX_ROWS}`;

  return (
    <>
      <Header />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {/* Dates are formatted in the browser, not here. The server renders in
            its own timezone and locale, which is neither the reader's nor the
            one they chose — and a server-formatted date is the classic source
            of a hydration mismatch. */}
        <HistoryList plans={plans.map(serialize)} />
        <p>
          {/* No arrow glyph. A literal "←" points the wrong way in RTL, where
              "back" is to the right, and swapping it per direction is more CSS
              than a back link is worth. The word alone is correct in both. */}
          <Link href="/scopecraft" className={styles.backLink}>
            ScopeCraft
          </Link>
        </p>
      </main>
    </>
  );
}

/** `postgres` returns Date objects; a client component boundary needs plain JSON. */
function serialize(plan: PlanSummary): PlanSummary {
  return { ...plan, createdAt: new Date(plan.createdAt).toISOString() };
}
