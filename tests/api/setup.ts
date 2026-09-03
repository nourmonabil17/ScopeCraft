// tests/api/setup.ts
//
// Node-project test setup (owner: Yousef).
//
// TWO MOCKS, ONE FILE. The route gained a session check and two database calls
// in Module 3. Without these, every test in tests/api and tests/evaluation
// fails to even load: `next-auth` is ESM-only and this project runs Jest as
// CommonJS, so importing it throws before a single assertion runs.
//
// Mocking here rather than per-file is the whole point. There are 80-odd tests
// across the two node suites and none of them is *about* authentication or
// persistence — they are about the request pipeline. One default that keeps
// them green, overridable in the few tests that do care.

import type { Session } from "next-auth";

/** Stable, valid uuid. Shaped like the real thing so a query cannot pass by accident. */
export const TEST_USER_ID = "11111111-2222-4333-8444-555555555555";

// `mock` prefix is required: jest.mock factories are hoisted above the file, so
// they may only close over variables whose names begin with it.
const mockAuth = jest.fn<Promise<Session | null>, []>(async () => ({
  user: { id: TEST_USER_ID },
  expires: new Date(Date.now() + 86_400_000).toISOString(),
}));

/**
 * A tagged-template stand-in for the `postgres` client.
 *
 * Returns `[]` by default, which is deliberately the right answer for both
 * queries the route makes: the quota count reads `row?.used ?? 0` and so sees
 * zero used, and the insert's return value is ignored. Tests that need a
 * different answer push onto `mockSqlResults`.
 */
const mockSqlResults: unknown[][] = [];
const mockSql = jest.fn(async () => mockSqlResults.shift() ?? []) as jest.Mock & {
  json: (value: unknown) => unknown;
  end: () => Promise<void>;
};
mockSql.json = (value: unknown) => value;
mockSql.end = async () => {};

jest.mock("@/auth", () => ({ auth: mockAuth }));
jest.mock("@/lib/db", () => ({ sql: mockSql }));

/** Exposed so a test can assert the database was *not* reached. */
export const dbMock = mockSql;
export const authMock = mockAuth;

/** Queue one result for the next query. */
export function queueDbResult(rows: unknown[]): void {
  mockSqlResults.push(rows);
}

/** Make the next `auth()` return no session. */
export function signOut(): void {
  mockAuth.mockResolvedValueOnce(null);
}

// The route logs one `scopecraft.generation` line per generation (Module B2),
// and the node suites drive the route 57 times. Left alone that is 57 lines of
// noise on every `npm test`, which is how people stop reading test output.
//
// Filtered rather than blanket-silenced: only this one prefix is dropped, so a
// stray console.log added later is still visible. The line stays under test —
// the secret-leak guard spies on console.log directly, which replaces this
// wrapper, and asserts no key or idea text reaches it.
const realLog = console.log;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("scopecraft.generation ")) return;
  realLog(...args);
};

beforeEach(() => {
  mockSql.mockClear();
  mockAuth.mockClear();
  mockSqlResults.length = 0;
});
