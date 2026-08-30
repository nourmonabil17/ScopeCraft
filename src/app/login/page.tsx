// src/app/login/page.tsx
//
// Server half of the login page: the "already signed in" bounce. Doing it here
// rather than in the client card means a returning visitor never sees the
// sign-in button flash before being sent on.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "@/components/common/LoginCard";

export const metadata: Metadata = {
  title: "Sign in · ScopeCraft",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/scopecraft");

  // Read here, not in the client card: these are plain (non-NEXT_PUBLIC_)
  // env vars, so a client component cannot see them at all, and a dead
  // button for an unconfigured provider is worse than no button — it fails
  // only after a redirect and a confusing error page, not at a glance.
  return (
    <LoginCard
      providers={{
        github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
        google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      }}
    />
  );
}
