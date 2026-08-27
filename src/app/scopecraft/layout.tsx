// src/app/scopecraft/layout.tsx
//
// The gate. A server component wrapping the (client) workflow page, so the
// session is checked before any of it is sent to the browser — a signed-out
// visitor receives a redirect, not the page plus a client-side bounce.
//
// COST, stated plainly: calling auth() reads cookies, which opts this route
// out of static prerendering. /scopecraft used to be prerendered and edge
// cached. That is not a regression to fix; it is what "this page requires a
// session" means. The page's own work was always a client-side fetch to
// /api/scopecraft, so nothing user-visible got slower.
//
// SCOPE: this protects the *page*. /api/scopecraft is still open — see
// README "Unauthenticated Endpoint & Rate Limiting Boundary". Closing it is
// stage 0 in docs/database-and-auth-design.md and a separate change.

import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ScopeCraftLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
