// src/app/scopecraft/history/[id]/page.tsx
//
// One saved plan, reopened (owner: Yousef).
//
// WHY THIS EXISTS. Without it, board persistence is write-only: edits are
// saved and never seen again, which is not persistence from the user's side.
// It is also the only place the round trip can actually be checked — that a
// plan loaded from the database produces the same numbers it produced when it
// was generated.
//
// WHAT IS REBUILT RATHER THAN READ. `response` is the model's output and is
// replayed exactly. Everything derived from it — score, MoSCoW bucket, live
// capacity — is recomputed by today's code, not replayed from what the formula
// said when the row was written. `board` contributes only the two fields a
// human can change. That ordering is the trust boundary: the AI's answer is the
// base layer, the human's edits sit on top, and neither can be mistaken for the
// other.

import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { Header } from "@/components/common/Header";
import {
  BoardSchema,
  ScopeCraftResponseSchema,
  type BoardEdits,
  type ScopeCraftResponse,
} from "@/lib/scopecraft/schema";
import { SavedPlanView } from "./SavedPlanView";
import styles from "../HistoryList.module.css";

export const dynamic = "force-dynamic";

interface PlanRow {
  idea: string;
  response: unknown;
  board: unknown;
  providerUsed: string | null;
  promptVersion: string | null;
  createdAt: Date | string;
}

export default async function SavedPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null; // unreachable: the layout redirects first

  const { id } = await params;
  // Rejected before Postgres, where a malformed uuid throws rather than
  // returning nothing. Same 404 as "not yours", so ids stay unguessable.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  // Scoped by the session's user id, never by anything in the URL.
  const [row] = await sql<PlanRow[]>`
    select idea, response, board,
           provider_used as "providerUsed", prompt_version as "promptVersion",
           created_at as "createdAt"
    from plans
    where id = ${id} and user_id = ${userId} and status = 'ok'`;

  if (!row) notFound();

  // Re-validated on the way out, not trusted because it was validated on the
  // way in. The row could have been written by an older schema, or edited by
  // hand in psql; rendering an unvalidated shape would crash the client
  // component rather than fail here where it can be handled.
  const parsed = ScopeCraftResponseSchema.safeParse(row.response);
  if (!parsed.success) notFound();

  const savedEdits: BoardEdits | undefined = row.board
    ? (BoardSchema.safeParse(row.board).data ?? undefined)
    : undefined;

  return (
    <>
      <Header />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <SavedPlanView
          planId={id}
          idea={row.idea}
          data={parsed.data as ScopeCraftResponse}
          savedEdits={savedEdits}
          providerUsed={row.providerUsed}
          promptVersion={row.promptVersion}
          createdAt={new Date(row.createdAt).toISOString()}
        />
        <p>
          <Link href="/scopecraft/history" className={styles.backLink}>
            ScopeCraft
          </Link>
        </p>
      </main>
    </>
  );
}
