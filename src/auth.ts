// src/auth.ts
//
// Authentication (owner: Yousef). Implements the sign-in half of
// docs/database-and-auth-design.md.
//
// ONE DATABASE WRITE, ON FIRST SIGN-IN ONLY. There is still no session table
// and no adapter: the JWT strategy keeps the session in a signed cookie. What
// the `users` row buys is a stable id for `plans.user_id` to reference, and the
// `jwt` callback below carries that id in the token so no *request* needs a
// user lookup — only the first sign-in touches the database.
//
// NO PASSWORDS, deliberately. Sign-in is GitHub or Google OAuth, so this app
// never sees, hashes, stores, resets or leaks a password. That removes a
// class of vulnerability rather than mitigating it.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { sql } from "@/lib/db";

// Auth.js ships `session.user` without an `id`. Widening it here rather than in
// a separate .d.ts keeps the declaration next to the callback that populates
// it — the two are meaningless apart, and a stray augmentation file is the kind
// of thing that gets deleted by someone who cannot see what depends on it.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// No `next-auth/jwt` augmentation. `JWT extends Record<string, unknown>`, so
// `token.uid` already assigns and reads without one — and augmenting that
// module needs it imported here purely to satisfy the declaration, which is a
// fragile import that a lint rule or a refactor eventually removes.

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Both are always in the array — Auth.js's env-var convention
  // (AUTH_<PROVIDER>_ID/SECRET) wires each one's credentials automatically,
  // and a provider with no credentials configured is simply one the sign-in
  // page never links to (see providers.github/providers.google in
  // src/app/login/page.tsx) rather than one that needs conditional removal
  // here.
  providers: [GitHub, Google],

  // No session table. See the header comment.
  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Runs on sign-in *and* on every subsequent token refresh. The early return
     * is what keeps that to one insert per user rather than one per request —
     * remove it and every page view becomes a database write.
     */
    async jwt({ token }) {
      if (token.uid) return token;

      // Every real sign-in has an email: the GitHub provider requests the
      // `user:email` scope and falls back to /user/emails for the primary
      // address when the public one is null, and Google's default scopes
      // (`openid email profile`) always include one. What is left is
      // genuinely rare — a revoked scope, a provider API failure mid-flow, an
      // account with no address at all. Fail the sign-in rather than
      // inventing a placeholder: `users.email` is the unique key, so a
      // fabricated value would either collide with another user or create an
      // unreachable orphan row.
      if (!token.email) {
        throw new Error("The identity provider did not return an email address for this account.");
      }

      // Idempotent by email. `do update` rather than `do nothing` so a renamed
      // or re-avatared GitHub account is not frozen at whatever it looked like
      // on first sign-in — and because `do nothing` returns no row, which would
      // leave `uid` undefined on every sign-in after the first.
      const [user] = await sql<{ id: string }[]>`
        insert into users (email, name, image)
        values (${token.email}, ${token.name ?? null}, ${token.picture ?? null})
        on conflict (email) do update
          set name = excluded.name, image = excluded.image
        returning id`;

      token.uid = user.id;
      return token;
    },

    /** Surfaces the database id to server code. The route needs it, not a name. */
    async session({ session, token }) {
      // A runtime narrow rather than a cast: `token.uid` is `unknown` here, and
      // a cast would happily let a malformed token through to a query that
      // expects a uuid.
      if (session.user && typeof token.uid === "string") {
        session.user.id = token.uid;
      }
      return session;
    },
  },

  // Without this, Auth.js serves its own unstyled, English-only sign-in page.
  // Pointing it at /login means every redirect — ours and the library's —
  // lands on the same bilingual, themed page.
  pages: { signIn: "/login" },

  // Auth.js only trusts the incoming Host header automatically on Vercel and
  // in development. Under a plain `next start` — which is how both evidence
  // capture scripts and any self-hosted deploy run the app — it refuses every
  // request with UntrustedHost, and `auth()` then returns null. That fails
  // closed, so it is not a security hole, but it locks out signed-in users
  // instead of just misbehaving, and it is invisible until something is
  // actually deployed off Vercel.
  //
  // The risk this flag exists to guard against is a forged Host header being
  // used to build the OAuth callback URL. Setting AUTH_URL in production pins
  // that origin regardless, which is why .env.example asks for it — with
  // AUTH_URL set, the header is not consulted and this flag costs nothing.
  trustHost: true,
});
