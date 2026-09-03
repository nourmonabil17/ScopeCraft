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
alter table plans add column if not exists duration_ms integer;
alter table plans add column if not exists attempts    integer;
