# Database & Authentication — Design

**Owner:** Yousef Mohmed Hasabo
**Status:** both halves are implemented. Authentication and the database are shipped and
running in production.
**Schema:** [`db/schema.sql`](../db/schema.sql)

This closes the boundary recorded in [`architecture.md` §4a](architecture.md) and
[`README.md`](../README.md): the endpoint *was* public, unauthenticated and unmetered, so
anonymous callers could spend provider quota. It is now gated at stage 0 and metered per
account.

> **Scope note.** `architecture.md` §4 froze "no authentication" as an MVP non-goal. This
> design reverses that. Worth saying out loud at the defense as a deliberate scope change
> rather than letting an examiner find the contradiction.

## What is built

| | Status | Where |
|---|---|---|
| GitHub and Google OAuth sign-in, JWT session | **shipped** | [`src/auth.ts`](../src/auth.ts) |
| `/login` page (bilingual, themed) | **shipped** | [`LoginCard.tsx`](../src/components/common/LoginCard.tsx) |
| `/scopecraft` requires a session | **shipped** | [`scopecraft/layout.tsx`](../src/app/scopecraft/layout.tsx) |
| Header identity + sign out | **shipped** | [`UserMenu.tsx`](../src/components/common/UserMenu.tsx) |
| `users` / `plans` tables | **shipped** | [`db/schema.sql`](../db/schema.sql), client in [`src/lib/db.ts`](../src/lib/db.ts) |
| Stage-0 session check on the API route | **shipped** | [`route.ts`](../src/app/api/scopecraft/route.ts) — `POST` opens with it, `401 UNAUTHORIZED` before the body is read |
| Daily rate limit (`429 RATE_LIMITED`) | **shipped** | [`src/lib/quota.ts`](../src/lib/quota.ts) |
| Plans read back after the fact | **shipped** | `/scopecraft/history` — [`page.tsx`](../src/app/scopecraft/history/page.tsx) |

The shipping is recorded in [`docs/decision-log.md`](decision-log.md) entries 16 (session at
stage 0, quota at stage 4b), 18 (history and board persistence), 19 (the quota fails closed)
and 24 (the Neon database provisioned, constraints proven in production).

**The consequence:** the page and the endpoint are both closed. A signed-out `curl` at
`POST /api/scopecraft` gets `401` before the body is read, so it cannot spend provider quota,
and a signed-in one is counted against the daily budget.

## The rest of this document: how the database half works

## The whole design in one paragraph

Two tables — `users` and `plans`. Sign-in is GitHub OAuth through Auth.js with the **JWT
session strategy**, so there is no session table and no password anywhere. The rate limit is
a `count(*)` over `plans` in the last 24 hours, so there is no Redis and no quota table. The
generated PRD is stored whole as JSONB because it is already a validated Zod shape.

## What each piece buys, and what it costs

| Decision | Why | What it gives up |
|---|---|---|
| **Postgres** (Neon / Vercel Postgres) | Serverless-friendly, free tier, survives cold starts | — |
| **`postgres` driver, no ORM** | Two tables. Prisma or Drizzle would add a schema DSL, a generate step and a migration engine to write ~6 queries | Type-safe query builder; you write SQL |
| **Auth.js + GitHub OAuth** | The app never sees a password — nothing to hash, reset, leak, or get wrong | Users need a GitHub account |
| **JWT session strategy** | No `sessions` or `accounts` table, no adapter, no DB round trip per request | Can't revoke a session server-side before it expires |
| **Rate limit from `plans`** | The data is already there. No Redis, no second store to keep consistent | Limit is per-user, not per-IP — anonymous abuse is handled by requiring auth at all |
| **Response as JSONB** | Always read whole; nothing queries across stories | Can't `SELECT` across user_stories without `jsonb` operators |

**If you only remember one thing:** the two tables that *don't* exist — `sessions` and
`rate_limits` — are the design. Both are standard, both were considered, both turned out to
be storage for something already available elsewhere.

## Tables

`users` — id, email (unique), name, image, created_at. No password column.

`plans` — the request (idea, constraints, capacity, sprint length), the result (status,
error_code, response JSONB, board JSONB), provenance (provider_used, prompt_version), how the
generation went (duration_ms, attempts), and created_at. Full commentary in
[`db/schema.sql`](../db/schema.sql).

Three details that matter:

- **`board` is separate from `response`.** The model's output stays immutable; the human's
  edits live beside it. That keeps "what the AI said" distinguishable from "what the human
  decided", which is the product's core trust boundary and a graded criterion.
- **`status` allows `'failed'` rows.** A generation that reaches a provider and *then* fails
  still costs tokens. If only successes were stored, a caller could burn quota on failures
  for free.
- **`duration_ms` and `attempts` are the log** (Module B2). There is no separate logging
  table, because `plans` is already exactly one row per generation that reached a provider —
  a second store would have to be kept consistent with the first for no information gained,
  which is the same argument that kept the rate limiter out of Redis. `attempts` counts
  providers actually *called*, so a provider skipped for a missing key does not increment it;
  that is what lets a row say whether the primary failed or was never configured. Both are
  nullable and are null on every row written before 2026-09-04.

## Where it plugs into the existing route

The current pipeline is five ordered stages in `src/app/api/scopecraft/route.ts`, cheapest
first, with no provider module imported until stage 5. Auth and the rate limit slot in
without disturbing that ordering:

```
  0. session check        → 401 UNAUTHORIZED      ← new, first: no reason to read a
  ─────────────────────────────────────────────     body from an anonymous caller
  1. size cap 16 KB       → 413
  2. JSON.parse           → 400
  3. RequestSchema (Zod)  → 422
  4. clarification check  → 422
  4b. rate limit          → 429 RATE_LIMITED      ← new: one DB round trip, placed
  ─────────────────────────────────────────────     after the free local checks so a
  4c. cache lookup        → 200, no provider        malformed request never costs one
  5. runScopeCraft
  6. persist the plan row → 200
```

Two new error codes join `ERROR_CODES` in `src/lib/scopecraft/schema.ts`:

| Status | Code | When |
|---|---|---|
| `401` | `UNAUTHORIZED` | No valid session |
| `429` | `RATE_LIMITED` | Over the daily generation budget |

Both are contract changes; both have their row in `docs/api-contracts.md`.

## The code, as designed

Four small files. The shipped code follows this shape but has moved past it in two places:
`src/auth.ts` carries Google alongside GitHub, and the two inline inserts below were factored
into `src/lib/plans.ts` (`recordPlan`) once a second writer — regenerating a single story —
needed the same row. Read the files for the current text; this section is kept because it is
the argument for the shape, not a copy of it.

**`src/lib/db.ts`**

```ts
import postgres from "postgres";

// One pooled client per process. Serverless reuses warm instances, so this is
// created once per container, not once per request.
export const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
```

**`src/auth.ts`**

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { sql } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },   // no session table
  callbacks: {
    // First sign-in creates the row; later sign-ins just fetch its id, which
    // is then carried in the JWT so no request needs a user lookup.
    async jwt({ token }) {
      if (token.uid || !token.email) return token;
      const [user] = await sql`
        insert into users (email, name, image)
        values (${token.email}, ${token.name ?? null}, ${token.picture ?? null})
        on conflict (email) do update set name = excluded.name
        returning id`;
      token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
```

**`src/app/api/auth/[...nextauth]/route.ts`**

```ts
export { GET, POST } from "@/auth";
```

**`src/lib/quota.ts`**

```ts
import { sql } from "@/lib/db";

export const DAILY_LIMIT = Number(process.env.DAILY_PLAN_LIMIT ?? 20);

/** Counts attempts, not successes — a failed generation still cost tokens. */
export async function overDailyLimit(userId: string): Promise<boolean> {
  const [{ count }] = await sql`
    select count(*)::int from plans
    where user_id = ${userId} and created_at > now() - interval '24 hours'`;
  return count >= DAILY_LIMIT;
}
```

### Route changes

```ts
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { overDailyLimit, DAILY_LIMIT } from "@/lib/quota";

export async function POST(req: NextRequest) {
  // ---- 0. Session. Before anything is read off the wire. ----
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Please sign in to generate a plan.", 401);

  // ---- 1..4 unchanged ----

  // ---- 4b. Daily budget ----
  if (await overDailyLimit(userId)) {
    return fail(
      "RATE_LIMITED",
      `You have reached the limit of ${DAILY_LIMIT} plans per day. Try again tomorrow.`,
      429
    );
  }

  // ---- 5. Generate, then record the outcome either way ----
  try {
    const { data, providerUsed, promptVersion } = await runScopeCraft(parsed.data);
    await sql`
      insert into plans (user_id, idea, constraints, capacity_points, sprint_days,
                         status, response, provider_used, prompt_version)
      values (${userId}, ${parsed.data.idea},
              ${constraintsToText(parsed.data.constraints) ?? null},
              ${parsed.data.team_capacity_points}, ${parsed.data.sprint_length_days},
              'ok', ${sql.json(data)}, ${providerUsed}, ${promptVersion})`;
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Provider-Used": providerUsed, "X-Prompt-Version": promptVersion },
    });
  } catch (error) {
    const res = mapGenerationError(error);
    // Only provider-reaching failures are recorded — the 4xx paths above never
    // get here, so a malformed request still costs the caller nothing.
    await sql`
      insert into plans (user_id, idea, constraints, capacity_points, sprint_days,
                         status, error_code)
      values (${userId}, ${parsed.data.idea},
              ${constraintsToText(parsed.data.constraints) ?? null},
              ${parsed.data.team_capacity_points}, ${parsed.data.sprint_length_days},
              'failed', ${(await res.clone().json()).code})`;
    return res;
  }
}
```

### UI

`Header.tsx` gains a sign-in / sign-out button (`signIn("github")` / `signOut()`), and
`page.tsx` maps the two new codes onto states it already has — `401` sends the user to sign
in, `429` reuses the existing `provider_error` shape, which already renders a message plus a
retry affordance. **No new UI state is needed.**

## What this does *not* solve

- **Per-IP abuse before sign-in.** The limit is per account. Requiring auth is what stops
  anonymous quota burn; someone willing to create many GitHub or Google accounts is not
  addressed.
  Edge middleware token-bucket limiting (Upstash) is the next layer if that becomes real.
- **Server-side session revocation.** JWT sessions can't be killed before expiry. Switch to
  the database session strategy (adds an adapter and a `sessions` table) if that matters.
- **Multi-region latency.** One Postgres region. Fine at this scale.

## Setup

```bash
npm i postgres next-auth@beta
psql "$DATABASE_URL" -f db/schema.sql
```

Environment variables — all of these are in `.env.example` and must be set in the hosting
provider:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. Neon in production — the **pooled** host, the one with `-pooler` in it, and keep `sslmode=require` |
| `AUTH_SECRET` | `npx auth secret`. Signs and encrypts the session cookie; rotating it is the only way to force sign-out under the JWT strategy |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | From a GitHub OAuth app; callback `<origin>/api/auth/callback/github` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | From a Google OAuth client; redirect URI `<origin>/api/auth/callback/google`. While the consent screen is in "Testing", only listed test users can sign in |
| `AUTH_URL` | Production only. Auth.js builds the callback URL from the request, and behind a proxy that can resolve to the internal host, which the provider then rejects as a mismatch |
| `DAILY_PLAN_LIMIT` | Optional, defaults to 20 |

Local and production are different origins, so each OAuth provider needs either two apps or
two callback URLs on one app.

## What adopting it cost

The estimate was half a day including test repair, on the grounds that the work was wider than
the four small files above. That held. What was actually paid:

- **One more dependency** — `postgres`, five → six — and a `DATABASE_URL` that has to exist and
  stay up. Neon in production, a compose container locally (`npm run db:up`, `npm run db:check`).
- **Route tests took an auth mock**, one of `auth()` rather than an edit per test.
- **`scripts/capture-evidence.sh` mints a real session** rather than acquiring an auth bypass —
  `scripts/mint-session.mjs`, the same approach `scripts/capture-ui-evidence.mjs` already used.
  One case still posts without the cookie on purpose: the auth boundary is worth capturing.
- **`docs/api-contracts.md`** carries `401` and `429` and the changed pre-provider ordering.

## What is still open

- **A persistence outage is silent to the caller.** `recordPlan` never throws: a failed
  bookkeeping write must not destroy a plan the user already waited for and already paid
  provider tokens for, so the failure is logged and the result is returned anyway. The cost is
  stated where the code is — for as long as such an outage lasts, the quota under-counts and
  the board cannot be saved for that plan.
- **A schema/code skew fails the same way.** Code that names a column the deployed database
  does not have takes that path: `200`, a valid plan, and no row. Apply `db/schema.sql` before
  shipping code that names a new column, not after.
