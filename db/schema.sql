-- ScopeCraft — database schema (owner: Yousef)
--
-- Two tables. That is the whole design.
--
-- Why so little: the product generates a plan and shows it. The only state
-- worth keeping between requests is "who are you" and "what did you generate".
-- Everything else the app already computes deterministically from the response,
-- so storing it would create a second source of truth that can drift.
--
-- Target: Postgres 14+ (Neon / Vercel Postgres / Supabase — any of them).
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------- users ----
-- One row per authenticated person.
--
-- No password column, deliberately. Sign-in is OAuth (GitHub), so this app
-- never sees, hashes, stores, resets or leaks a password. That removes an
-- entire class of vulnerability rather than mitigating it.
--
-- No sessions or accounts table either: Auth.js runs with the JWT session
-- strategy, so the session lives in a signed cookie and needs no storage.
create table if not exists users (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  name        text,
  image       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- plans ----
-- One row per generation attempt that reached a provider.
--
-- `response` is the whole validated payload as JSONB rather than eleven
-- normalised tables. It is already schema-checked by Zod on the way in, it is
-- always read whole, and nothing queries across user_stories. Normalising it
-- would buy joins nobody runs and a migration every time the PRD shape changes.
--
-- `board` holds the human's edits to the sprint board, null until they touch
-- it. Kept separate from `response` so the original model output stays intact
-- and "what did the AI say" versus "what did the human decide" stays legible —
-- which is the product's core trust boundary.
--
-- `status` exists so the rate limit can count *attempts*, not just successes.
-- A generation that reaches a provider and then fails still costs tokens; if
-- only successes were stored, a caller could burn quota on failures for free.
create table if not exists plans (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,

  -- the request, kept so a plan can be explained or re-run
  idea            text        not null,
  constraints     text,
  capacity_points integer     not null,
  sprint_days     integer     not null,

  -- sha256 over the request fields that actually change the answer, so a repeat
  -- request can be served from this table instead of from a provider (Module A3).
  -- Nullable: every row written before A3 has no hash, and simply never matches.
  request_hash    text,

  -- the result
  status          text        not null default 'ok'
                              check (status in ('ok', 'failed')),
  error_code      text,                     -- set when status = 'failed'
  response        jsonb,                    -- set when status = 'ok'
  board           jsonb,                    -- human edits, null until edited

  -- provenance, mirrors the x-provider-used / x-prompt-version headers
  provider_used   text,
  prompt_version  text,

  -- how the generation went, not just what it produced (Module B2)
  --
  -- Both nullable, and both are null on rows written before these columns
  -- existed. Any query over them has to say so — `avg(duration_ms)` silently
  -- ignores nulls, which is right here, but `count(*)` over the same window is
  -- not the denominator.
  --
  -- duration_ms is wall-clock around the generate step only: the provider
  -- chain, the retry and the deterministic tools. It excludes session lookup,
  -- validation and the quota query, all of which happen before the clock
  -- starts, and excludes this insert, which happens after it stops.
  --
  -- attempts counts providers actually CALLED, so a provider skipped for a
  -- missing key does not increment it. That distinction is the reason the
  -- column exists: `provider_used = 'groq'` alone cannot say whether NVIDIA
  -- failed or was never configured, and this repository has an open question
  -- of exactly that shape.
  duration_ms     integer,
  attempts        integer,

  -- which of several answers to the same question the user kept
  --
  -- Two rows can share a request_hash, because a caller can ask for a second,
  -- independent answer to a question they have already asked. `chosen_at` is
  -- how they say which one they are keeping. Nullable and non-exclusive by
  -- design: nothing in the schema stops two rows being marked, because the
  -- statement that sets it clears the siblings in the same breath. A partial
  -- unique index would be the stricter guard and was not taken — it would turn
  -- a lost race into a 500 for the second writer rather than a last-write-wins
  -- that is correct either way.
  --
  -- A timestamp rather than a boolean, for the same reason created_at is one:
  -- "when did they decide" is free to store here and impossible to recover
  -- later, and ordering by it is what lets the cache prefer the kept plan.
  chosen_at       timestamptz,

  -- the row this one was produced from, when it was not produced from scratch
  --
  -- Null for an ordinary generation and for an independent alternative; set
  -- when a plan was derived by regenerating part of an earlier one. Both of
  -- those carry the SAME request_hash as their sibling — the idea, the
  -- constraints and the capacity are unchanged, which is the whole point —
  -- so without this column the two are indistinguishable in SQL and the
  -- distinction is unrecoverable after the fact.
  --
  -- NO FOREIGN KEY, deliberately, and it is a security property rather than a
  -- shortcut. `recordPlan` swallows a failed insert and still answers 200, so
  -- anything that lets a CALLER make the insert fail is a way to generate
  -- without being counted: fire N rewrites, delete the parent while they are in
  -- flight, and every insert dies on the constraint while every response
  -- succeeds. A plain uuid cannot fail that way. Referential integrity buys
  -- nothing here — nothing joins on this column, and a row pointing at a
  -- deleted parent is honest history rather than corruption.
  derived_from    uuid,

  created_at      timestamptz not null default now(),

  constraint plans_ok_has_response
    check (status <> 'ok' or response is not null)
);

-- Serves both queries the app makes: "my plans, newest first" and the
-- rate-limit count over a recent window. One index, both jobs.
create index if not exists plans_user_created_idx
  on plans (user_id, created_at desc);

-- ------------------------------------------------------------ migrations ----
-- Columns added after the first deployment.
--
-- These are not redundant with the table definition above, and deleting them as
-- duplication would be a silent data bug. `create table if not exists` does
-- nothing at all when the table already exists — it does not diff the
-- definition — so on every database that already holds plans, the columns above
-- would never appear. Re-running this file is how the schema is applied, and it
-- has to work on a fresh database and an existing one from the same text.
--
-- `add column if not exists` makes each line idempotent, which is what lets
-- this file stay the single source of truth instead of growing a migrations
-- directory and a runner to walk it.
alter table plans add column if not exists duration_ms  integer;
alter table plans add column if not exists attempts     integer;
alter table plans add column if not exists request_hash text;
alter table plans add column if not exists chosen_at    timestamptz;
alter table plans add column if not exists derived_from uuid;
-- Dropped rather than never-added: an earlier revision of this file created the
-- column WITH a foreign key. See the comment on the column for why a caller
-- being able to fail an insert is a quota bypass rather than a tidy constraint.
alter table plans drop constraint if exists plans_derived_from_fkey;
