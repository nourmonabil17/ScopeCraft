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
// WHY THE CLIENT IS LAZY. This was first written to read DATABASE_URL and throw
// at module scope, on the theory that a missing variable should surface with a
// stack trace naming this file. That broke `next build`: page-data collection
// evaluates every route module, `/api/auth/[...nextauth]` imports `@/auth`
// which imports this file, and the build died with "DATABASE_URL is not set".
// The same failure would have hit the Vercel build, where DATABASE_URL is not
// configured. Build-time module evaluation has no runtime environment, so
// nothing here may require one until it is actually used.
//
// SERVER ONLY. Nothing under a "use client" boundary may import this file; a
// single accidental import would try to bundle a database driver into the
// browser. Checked across all 21 client components as of 2026-08-27.

import postgres, { type Sql } from "postgres";

let client: Sql | undefined;

function connect(): Sql {
  if (client) return client;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Thrown on first query rather than on import — see the header. Still the
    // message someone can act on, just at the moment the connection is wanted.
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local, and start the " +
        "database with `npm run db:up`."
    );
  }

  // `max: 1` is not a typo. Serverless multiplies connections by instance
  // count, and a free-tier Postgres has a low connection ceiling — a pool of 10
  // across 20 warm lambdas exhausts it. One connection per instance, reused
  // across requests on that instance, is what fits the deployment shape.
  client = postgres(url, { max: 1 });
  return client;
}

/**
 * The query client, with the same surface as `postgres()` itself.
 *
 * A Proxy rather than a plain function because callers use two different
 * shapes: `sql\`select 1\`` (a call) and `sql.json(x)` / `sql.end()` (property
 * access). Forwarding both to a lazily-created client is the smallest thing
 * that keeps the driver's own API intact while deferring the connection.
 */
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (connect() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop: string | symbol) {
    return (connect() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
