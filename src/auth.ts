// src/auth.ts
//
// Authentication (owner: Yousef). Implements the sign-in half of
// docs/database-and-auth-design.md.
//
// NO DATABASE. The design document pairs auth with a `users` table and a
// `plans` table, but neither is needed to *sign someone in*: the JWT session
// strategy keeps the whole session in a signed cookie, so there is no session
// table, no adapter, and no DB round trip per request. The tables become
// necessary only when plans are persisted and rate-limited, which is not this
// change. Adding them now would mean a DATABASE_URL that nothing reads.
//
// NO PASSWORDS, deliberately. Sign-in is GitHub OAuth, so this app never
// sees, hashes, stores, resets or leaks a password. That removes a class of
// vulnerability rather than mitigating it.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],

  // No session table. See the header comment.
  session: { strategy: "jwt" },

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
