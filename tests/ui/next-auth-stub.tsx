// tests/ui/next-auth-stub.tsx
//
// `next-auth/react` is ESM-only. ts-jest runs the UI project as CommonJS, so
// importing it throws "Cannot use import statement outside a module" before a
// single test runs. The alternatives were to transform node_modules (slow, and
// the beta's export map makes it fragile) or to stub the four things the app
// actually uses. This is the stub, wired in via moduleNameMapper.
//
// Nothing of value is lost: no test asserts on Auth.js internals. What the
// tests care about is "what does the UI do for a signed-in versus signed-out
// visitor", and `setStubSession` controls exactly that.

import type { ReactNode } from "react";

type StubUser = { name?: string | null; email?: string | null };
type StubSession = { user: StubUser } | null;

let session: StubSession = null;

/** Call in a test's arrange step. `resetStubSession` runs from setup.ts. */
export function setStubSession(next: StubSession): void {
  session = next;
}

export function resetStubSession(): void {
  session = null;
}

export function useSession() {
  return session
    ? { data: session, status: "authenticated" as const }
    : { data: null, status: "unauthenticated" as const };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const signIn = jest.fn();
export const signOut = jest.fn();
