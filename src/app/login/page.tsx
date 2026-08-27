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
  return <LoginCard />;
}
