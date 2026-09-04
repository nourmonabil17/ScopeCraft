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
  if (missing.length === 0) {
    await checkConstraints();
  }

  if (missing.length > 0) {
    // The init script only runs on an empty data directory, so a missing table
    // almost always means the schema changed after the volume was created.
    console.error(
      `\nFAIL: missing ${missing.join(", ")}. If db/schema.sql changed since ` +
        `the volume was created, reset it with \`npm run db:reset\`.`
    );
    process.exit(1);
  }

  if (failures > 0) {
    console.error(`\nFAIL: ${failures} constraint(s) missing or not enforcing.`);
    process.exit(1);
  }

  console.log("\nOK — reachable, both tables present, all constraints enforcing.");
}

let failures = 0;

/**
 * Proves the schema's guarantees rather than reading its DDL.
 *
 * This is where the integration testing lives (plan §6.3). A Jest project that
 * needs a live Postgres would go red in CI for reasons unrelated to the code,
 * and would only ever run where Docker is up. Putting the same three assertions
 * in a script that already exists means they also run against **production** —
 * which is exactly what §14.3.3 asks for, and what no local test suite can do.
 *
 * Each check is a negative: it does the forbidden thing inside a transaction
 * and expects to be refused. A constraint nobody has watched reject anything is
 * a constraint nobody knows works.
 */
async function checkConstraints() {
  const user = "constraint-probe@scopecraft.local";

  await expectRejected(
    "plans_status_check rejects an unknown status",
    async (tx) => {
      const [u] = await tx`insert into users (email) values (${user}) returning id`;
      await tx`insert into plans (user_id, idea, capacity_points, sprint_days, status, response)
               values (${u.id}, 'probe', 10, 7, 'pending', '{}'::jsonb)`;
    }
  );

  await expectRejected(
    "plans_ok_has_response rejects an ok row with no response",
    async (tx) => {
      const [u] = await tx`insert into users (email) values (${user}) returning id`;
      await tx`insert into plans (user_id, idea, capacity_points, sprint_days, status)
               values (${u.id}, 'probe', 10, 7, 'ok')`;
    }
  );

  await expectRejected(
    "plans_user_id_fkey rejects an unknown user",
    async (tx) => {
      await tx`insert into plans (user_id, idea, capacity_points, sprint_days, status, response)
               values ('00000000-0000-0000-0000-000000000000', 'probe', 10, 7, 'ok', '{}'::jsonb)`;
    }
  );

  await expectRejected("users_email_key rejects a duplicate address", async (tx) => {
    await tx`insert into users (email) values (${user})`;
    await tx`insert into users (email) values (${user})`;
  });

  // The inverse of every check above, and the only one that is. See the comment
  // on plans.derived_from in db/schema.sql: a foreign key here is a quota
  // bypass, because a caller can delete the parent mid-flight to make the
  // insert fail while the route still answers 200. tests/api/scopecraft.test.ts
  // asserts the same property by reading db/schema.sql from disk — that proves
  // the file. This is the only thing that asks a live database, production
  // included, which is where the constraint actually has to be absent.
  await expectAccepted(
    "plans.derived_from accepts a dead parent (no foreign key)",
    async (tx) => {
      const [u] = await tx`insert into users (email) values (${user}) returning id`;
      await tx`insert into plans (user_id, idea, capacity_points, sprint_days, status, response, derived_from)
               values (${u.id}, 'probe', 10, 7, 'ok', '{}'::jsonb, gen_random_uuid())`;
    }
  );

  await expectIndexed();
}

/**
 * Runs `body` in a transaction that is always rolled back, so a check can write
 * freely without leaving anything behind — including when it is pointed at a
 * production database.
 */
async function expectRejected(
  label: string,
  body: (tx: typeof sql) => Promise<unknown>
) {
  try {
    await sql.begin(async (tx) => {
      await body(tx as unknown as typeof sql);
      // Reached only if the database accepted what it should have refused.
      throw new Error("__ACCEPTED__");
    });
    report(label, false, "accepted");
  } catch (error) {
    const accepted = error instanceof Error && error.message === "__ACCEPTED__";
    report(label, !accepted, accepted ? "accepted" : "rejected");
  }
}

/**
 * Same always-rolled-back transaction as `expectRejected`, inverted: the write
 * has to be ACCEPTED. Used for the one guarantee that is the absence of a
 * constraint rather than the presence of one, where "the database refused it"
 * is the failure and the rollback is the pass.
 */
async function expectAccepted(
  label: string,
  body: (tx: typeof sql) => Promise<unknown>
) {
  try {
    await sql.begin(async (tx) => {
      await body(tx as unknown as typeof sql);
      throw new Error("__ROLLBACK__");
    });
    report(label, false, "unreachable");
  } catch (error) {
    const rolledBack = error instanceof Error && error.message === "__ROLLBACK__";
    report(label, rolledBack, rolledBack ? "accepted" : describeError(error));
  }
}

/**
 * Asserts the index **exists**, and reports the plan as information.
 *
 * The first version of this asserted that the rate-limit count *uses* the
 * index, and failed on an empty database — correctly, because a sequential
 * scan over zero rows is the cheaper plan and Postgres is right to choose it.
 * Asserting a planner decision means asserting the table's size, which is not
 * a property of the schema. The index existing is the invariant; which plan
 * wins is context, printed rather than enforced.
 */
async function expectIndexed() {
  const [idx] = await sql<{ indexdef: string }[]>`
    select indexdef from pg_indexes
    where tablename = 'plans' and indexname = 'plans_user_created_idx'`;
  report(
    "plans_user_created_idx exists",
    Boolean(idx),
    idx ? "present" : "MISSING"
  );

  const rows = await sql<{ "QUERY PLAN": string }[]>`
    explain (costs off)
    select count(*) from plans
    where user_id = '00000000-0000-0000-0000-000000000000'::uuid
      and created_at > now() - interval '24 hours'`;
  const plan = rows.map((r) => r["QUERY PLAN"]).join(" ");
  const chosen = plan.includes("plans_user_created_idx") ? "index scan" : "seq scan (table is small)";
  console.log(`  ---- rate-limit count currently plans as: ${chosen}`);
}

function report(label: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label} (${detail})`);
  if (!ok) failures += 1;
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
