# Database & Authentication — Design

**Owner:** Yousef Mohmed Hasabo
**Status:** the **authentication half is implemented**; the database half is still design only.
**Schema:** [`db/schema.sql`](../db/schema.sql)

This closes the boundary already recorded in [`architecture.md` §4a](architecture.md) and
[`README.md`](../README.md): the endpoint is public, unauthenticated and unmetered, so
anonymous callers can spend provider quota.

> **Scope note.** `architecture.md` §4 froze "no authentication" as an MVP non-goal. This
> design reverses that. Worth saying out loud at the defense as a deliberate scope change
> rather than letting an examiner find the contradiction.

## What is built, and what is not

| | Status | Where |
|---|---|---|
| GitHub OAuth sign-in, JWT session | **shipped** | [`src/auth.ts`](../src/auth.ts) |
| `/login` page (bilingual, themed) | **shipped** | [`LoginCard.tsx`](../src/components/common/LoginCard.tsx) |
| `/scopecraft` requires a session | **shipped** | [`scopecraft/layout.tsx`](../src/app/scopecraft/layout.tsx) |
| Header identity + sign out | **shipped** | [`UserMenu.tsx`](../src/components/common/UserMenu.tsx) |
| `users` / `plans` tables | design only | [`db/schema.sql`](../db/schema.sql) |
| Stage-0 session check on the API route | design only | below |
| Daily rate limit (`429 RATE_LIMITED`) | design only | below |

**The important consequence of that split:** the page is gated and the endpoint is not. A
signed-out visitor cannot use the UI, but anyone can still `curl` `POST /api/scopecraft` and
spend provider quota. Sign-in is a prerequisite for metering, not metering itself — do not
describe the quota gap as closed.

**Why the split, rather than doing both at once:** the shipped half needs no database, so it
costs one dependency and breaks nothing. The remaining half needs Postgres, a `DATABASE_URL`,
an auth mock across the route tests, and a session for `scripts/capture-evidence.sh`, which
currently posts anonymously on all eleven cases. Different size, different risk, different
change.

## The rest of this document: the database half

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
error_code, response JSONB, board JSONB), provenance (provider_used, prompt_version), and
created_at. Full commentary in [`db/schema.sql`](../db/schema.sql).

Two details that matter:

- **`board` is separate from `response`.** The model's output stays immutable; the human's
  edits live beside it. That keeps "what the AI said" distinguishable from "what the human
  decided", which is the product's core trust boundary and a graded criterion.
- **`status` allows `'failed'` rows.** A generation that reaches a provider and *then* fails
  still costs tokens. If only successes were stored, a caller could burn quota on failures
  for free.

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
  5. runScopeCraft                                  malformed request never costs one
  6. persist the plan row → 200
```

Two new error codes join `ERROR_CODES` in `src/lib/scopecraft/schema.ts`:

| Status | Code | When |
|---|---|---|
| `401` | `UNAUTHORIZED` | No valid session |
| `429` | `RATE_LIMITED` | Over the daily generation budget |

Both are contract changes and need a row in `docs/api-contracts.md`.

## The code, in full

Four small files. This is all of it.

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
  anonymous quota burn; someone willing to create many GitHub accounts is not addressed.
  Edge middleware token-bucket limiting (Upstash) is the next layer if that becomes real.
- **Server-side session revocation.** JWT sessions can't be killed before expiry. Switch to
  the database session strategy (adds an adapter and a `sessions` table) if that matters.
- **Multi-region latency.** One Postgres region. Fine at this scale.

## Setup

```bash
npm i postgres next-auth@beta
psql "$DATABASE_URL" -f db/schema.sql
```

New environment variables — add to `.env.example` and the hosting provider:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | `npx auth secret` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | From a GitHub OAuth app; callback `<url>/api/auth/callback/github` |
| `DAILY_PLAN_LIMIT` | Optional, defaults to 20 |

## Cost of adopting the remaining half

Honest accounting, because it is not free days before a defense. The sign-in half is already
paid for — one dependency (`next-auth`, four → five), and 251 tests green. What is left:

- **One more dependency** (`postgres`), and a `DATABASE_URL` that has to exist and stay up.
- **Route tests will need an auth mock.** Every test in `tests/api/scopecraft.test.ts` posts
  anonymously and would start getting `401`. The lazy fix is one mock of `auth()`, not 82
  edits.
- **`scripts/capture-evidence.sh` breaks** — it posts unauthenticated and would get `401` on
  all eleven cases. `scripts/capture-ui-evidence.mjs` already solved the equivalent problem by
  minting a real session cookie from `AUTH_SECRET` (see `signInAsCaptureUser`); the shell
  script can do the same rather than acquiring an auth bypass.
- **`docs/api-contracts.md`** needs the two new codes and the changed pre-provider ordering.

Roughly half a day including test repair. Nothing here is hard; it is just wider than it
looks from the four small files above.
