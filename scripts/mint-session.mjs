// scripts/mint-session.mjs
//
// A real Auth.js session cookie for the evidence captures (owner: Yousef).
//
// WHY THIS FILE EXISTS. Both captures need to reach an endpoint that now
// requires a session, and neither could mint one on its own:
// capture-evidence.sh is bash and cannot call next-auth's `encode`, and
// duplicating the logic in two places is how two scripts start disagreeing
// about what a valid session looks like. One implementation, imported by the
// Node capture and shelled out to by the bash one.
//
// WHY NOT A BYPASS FLAG. The obvious shortcut is an env var that makes the app
// skip its own auth check during capture. That would be a production bypass
// switch living in the route forever, guarded by nothing but the hope that the
// variable is never set in production — a worse thing to own than this file.
// The capture signs in the way a person does, so what gets captured is the
// authenticated app.
//
// WHY IT TOUCHES THE DATABASE. `plans.user_id` is a foreign key. A cookie whose
// `uid` matches no row would pass the session check and then fail every insert,
// so the capture would record 200s that never persisted. The user row is
// upserted by a fixed address, so re-running the capture reuses it rather than
// accumulating rows.
//
// Usage:
//   import { mintCaptureSession } from "./mint-session.mjs";
//   node scripts/mint-session.mjs          # prints the cookie value to stdout

import { encode } from "next-auth/jwt";
import postgres from "postgres";

/** Fixed, so repeated captures reuse one row instead of creating a new user each run. */
export const CAPTURE_EMAIL = "capture@scopecraft.local";
export const CAPTURE_NAME = "Evidence Capture";

/**
 * Auth.js reads the unprefixed name over http and the `__Secure-` prefixed one
 * over https. Both captures run against `next start` on http, so this is the
 * name the server will look for.
 */
export const SESSION_COOKIE = "authjs.session-token";

export async function mintCaptureSession({
  secret = process.env.AUTH_SECRET,
  databaseUrl = process.env.DATABASE_URL,
  maxAge = 60 * 60,
} = {}) {
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Export the same value the server under capture " +
        "was started with, or every request will be answered with 401."
    );
  }
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. The capture needs a real users row because " +
        "plans.user_id is a foreign key. Start the database with `npm run db:up`."
    );
  }

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [user] = await sql`
      insert into users (email, name)
      values (${CAPTURE_EMAIL}, ${CAPTURE_NAME})
      on conflict (email) do update set name = excluded.name
      returning id`;

    const cookie = await encode({
      token: {
        name: CAPTURE_NAME,
        email: CAPTURE_EMAIL,
        sub: user.id,
        uid: user.id,
      },
      secret,
      salt: SESSION_COOKIE,
      maxAge,
    });

    return { cookie, userId: user.id, name: SESSION_COOKIE };
  } finally {
    await sql.end();
  }
}

/** Removes the rows this capture created, so a re-run starts from a known state. */
export async function resetCaptureUser(databaseUrl = process.env.DATABASE_URL) {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    // `plans` goes with it: the foreign key cascades on delete.
    await sql`delete from users where email = ${CAPTURE_EMAIL}`;
  } finally {
    await sql.end();
  }
}

// CLI mode, for the bash capture. Prints only the cookie value — no label, no
// newline noise — so it can be captured with `$(...)` directly.
if (process.argv[1] && process.argv[1].endsWith("mint-session.mjs")) {
  const arg = process.argv[2];
  try {
    if (arg === "--reset") {
      await resetCaptureUser();
    } else {
      const { cookie } = await mintCaptureSession();
      process.stdout.write(cookie);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
