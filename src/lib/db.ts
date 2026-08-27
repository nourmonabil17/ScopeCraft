// src/lib/db.ts
//
// The database client (owner: Yousef). Implements docs/database-and-auth-design.md.
//
// WHY NO ORM. This schema is two tables and roughly six queries. Prisma or
// Drizzle would add a schema DSL, a generate step and a migration engine to
// write those six — a toolchain larger than the thing it manages. The
// `postgres` driver's tagged templates parameterise every interpolation by
// construction, which is the one property an ORM would have been bought for.
//
// SERVER ONLY. Nothing under a "use client" boundary may import this file; a
// single accidental import would try to bundle a database driver into the
// browser. `server-only` is not installed for this — the import graph is small
// enough to check, and Next already fails the build when a Node built-in
// reaches the client bundle.

import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  // Thrown at import time rather than at first query. A missing DATABASE_URL is
  // a deployment mistake, and it should surface when the module loads — while
  // the stack trace still names this file — instead of as a query failure
  // inside whatever route happened to be hit first.
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local, and start the " +
      "database with `npm run db:up`."
  );
}

/**
 * One pooled client per process.
 *
 * `max: 1` is not a typo. Serverless multiplies connections by instance count,
 * and a free-tier Postgres has a low connection ceiling — a pool of 10 across
 * 20 warm lambdas exhausts it. One connection per instance, reused across
 * requests on that instance, is what actually fits the deployment shape.
 */
export const sql = postgres(url, { max: 1 });
