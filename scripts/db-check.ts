// scripts/db-check.ts
//
// Is the database reachable with the current configuration? (owner: Yousef)
//
// The smallest useful check, in the same spirit as scripts/smoke-test.ts: that
// one answers "are the AI providers reachable right now", this one answers the
// same question for Postgres. Both exist because the answer changes for reasons
// outside this repository — a stopped container, a rotated connection string, a
// free tier that idled the instance — and finding out from a failing route is
// slower than asking directly.
//
//   npm run db:check
//
// Prints no credentials. The connection string is read from DATABASE_URL and
// only its host and database name are ever echoed.

import { sql } from "../src/lib/db";

const EXPECTED_TABLES = ["plans", "users"];

async function main() {
  const { host, database } = describeTarget();
  console.log(`Checking ${database} at ${host} ...`);

  const [{ version }] = await sql<{ version: string }[]>`select version()`;
  console.log(`  server   ${version.split(",")[0]}`);

  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  const found = rows.map((r) => r.table_name);
  console.log(`  tables   ${found.join(", ") || "(none)"}`);

  const missing = EXPECTED_TABLES.filter((t) => !found.includes(t));
  if (missing.length > 0) {
    // The init script only runs on an empty data directory, so a missing table
    // almost always means the schema changed after the volume was created.
    console.error(
      `\nFAIL: missing ${missing.join(", ")}. If db/schema.sql changed since ` +
        `the volume was created, reset it with \`npm run db:reset\`.`
    );
    process.exit(1);
  }

  console.log("\nOK — reachable, and both tables are present.");
}

/** Host and database only. Never the user or the password. */
function describeTarget(): { host: string; database: string } {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return { host: u.host, database: u.pathname.replace(/^\//, "") || "(default)" };
  } catch {
    return { host: "(unparseable DATABASE_URL)", database: "?" };
  }
}

main()
  .catch((error) => {
    console.error(`\nFAIL: ${describeError(error)}`);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

/**
 * A connection failure from the `postgres` driver arrives as an AggregateError
 * whose own `message` is the empty string — every useful detail is on `.code`
 * and inside `.errors[]`, one entry per address it tried. Reporting
 * `error.message` alone prints "FAIL:" and nothing else, which is how this was
 * first written and why it is now a named function.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.message) return error.message;

  const code = (error as { code?: string }).code;
  const causes = (error as { errors?: Error[] }).errors ?? [];
  const detail = causes[0]?.message;

  if (code && detail) return `${code} — ${detail}`;
  return code ?? detail ?? error.name;
}
