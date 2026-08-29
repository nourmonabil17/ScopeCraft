// src/app/page.tsx
//
// Redirects straight into the app (owner: Yousef).
//
// Was a separate public landing page for one day (2026-08-28): a full-page
// marketing screen with its own heading, tagline and example, gated behind
// a "Get started" click before you ever saw the form. Retired the same day,
// on the owner's own call after seeing it live — the intake form IS the main
// page now, and the explanatory content that used to live here moved to
// WelcomeModal, a one-time popup shown on /scopecraft itself. See
// decision-log.md for the reasoning; the design spec and plan under
// docs/superpowers/ that built the original page are historical records of
// what shipped that day, not of what this route does now.
//
// /scopecraft's own layout already redirects a signed-out visitor to
// /login — this route adds nothing on top of that, deliberately, so there
// is only one place a session check can live.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/scopecraft");
}
