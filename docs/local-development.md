# Local Development

**Owner:** Yousef Mohmed Hasabo · **Last verified:** 2026-08-27

How to run ScopeCraft on your machine. The short version:

```bash
npm install
cp .env.example .env.local     # then fill in at least one provider key
npm run db:up                  # Postgres in Docker
npm run dev                    # the app on your host
```

Open <http://localhost:3000>.

---

## The setup, and why it is split

**The database runs in Docker. The application runs on your host.**

That is a deliberate choice, not an omission. A bind-mounted rebuild on macOS is
noticeably slower than `next dev`, and this app has no native dependency that needs
containerising — so putting the app in a container costs iteration speed and buys nothing
day to day. What Docker is genuinely good for here is a real Postgres with no signup, in
one command, that behaves the same on every machine.

`docker compose up -d` therefore starts **only** the database. The application service
exists but sits behind a profile; see [Running the app in a container](#running-the-app-in-a-container)
for when you actually want it.

Recorded in [`project-plan.md`](project-plan.md) §1.3.3 and the decision log.

---

## Prerequisites

| | Version | Why that version |
|---|---|---|
| Node | **22+** | `scripts/capture-ui-evidence.mjs` uses the global `WebSocket`, which landed in 22 |
| Docker Desktop | any current | Postgres only |
| Google Chrome | any | Only for `npm run capture:ui` |

---

## Environment files

There are two, and they are not interchangeable.

| File | Read by | Contains |
|---|---|---|
| `.env.local` | Next.js | Provider keys, `AUTH_*`, `DATABASE_URL` |
| `.env` | Docker Compose | Postgres credentials, ports |

`.env.local` is the one you need. Copy `.env.example` and fill it in — at minimum one
provider key, or the app runs but cannot generate a plan.

`.env` is optional. Compose has working defaults for everything; copy
`.env.docker.example` only if you need to change a port or run the app in a container.

Both are gitignored. Neither may ever contain a `NEXT_PUBLIC_` prefix — that inlines the
value into the client bundle and leaks it to every visitor permanently.

---

## The database

```bash
npm run db:up      # start Postgres (detached)
npm run db:psql    # open a psql shell
npm run db:logs    # follow the log
npm run db:down    # stop, keep the data
npm run db:reset   # destroy the data and start fresh
```

Connect to it from the app by putting this in `.env.local`:

```
DATABASE_URL=postgres://scopecraft:scopecraft@localhost:5432/scopecraft
```

> **Note added 2026-08-28.** If you have run `neon env pull` (or `neon link` /
> `neon checkout`, which call it), `.env.local` will have been repointed at a Neon
> branch and the container below is no longer what your app talks to. Check with
> `grep DATABASE_URL .env.local` before assuming a local change is hitting local
> rows. `NEON_BRANCH` tells you which branch you landed on — it should never say
> `production`.

**Production is a different database.** It runs on [Neon](https://console.neon.tech), and
this container never touches it. Vercel cannot reach a container on your machine, and the
compose stack is not part of the deploy path — see [`project-plan.md`](project-plan.md)
§14. If you point `.env.local` at Neon to reproduce something, use the **pooled** connection
string and remember you are writing to real rows.

The credentials are readable defaults on purpose. The database is published on localhost
only; there is nothing here worth protecting, and a developer who cannot guess the
password cannot open a shell.

### The one thing that will confuse you

**`db/schema.sql` runs once.** Postgres executes everything in its init directory on first
start, and only while the data directory is empty. Editing the schema afterwards does
nothing until you throw the data away:

```bash
npm run db:reset
```

This is the single most common surprise with a containerised Postgres. If a column you
just added is not there, this is why.

---

## Running the app in a container

Only needed to verify the image, or to demo the stack on a machine without Node.

```bash
cp .env.docker.example .env    # fill in AUTH_SECRET and the GitHub OAuth values
docker compose --profile app up -d --build
```

The image is multi-stage and ships Next's traced standalone output — 269 MB, running as a
non-root user. It is **not** the production deploy path: Vercel does not build from the
Dockerfile. Production ships with `git push fork dev:main`.

---

## Authentication

`/scopecraft` redirects to `/login` unless you are signed in, and sign-in is GitHub OAuth,
so local development needs its own OAuth app:

1. <https://github.com/settings/developers> → New OAuth App
2. Callback URL, exactly: `http://localhost:3000/api/auth/callback/github`
3. `npx auth secret` for `AUTH_SECRET`
4. Put all three in `.env.local`

Production is a different origin and needs either a second OAuth app or a second callback
URL on the same one.

---

## The checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint --max-warnings=0
npm test              # 268 tests, 9 suites
npm run build
```

All four before every commit. A commit that breaks one does not get made.

### Evidence capture

```bash
npm run smoke             # are all three providers reachable right now?
npm run capture:evidence  # API and failover evidence
npm run capture:ui        # 17 screenshots + the accessibility audit
```

Both capture scripts run **on the host**, not in a container. `capture:ui` drives Chrome
over the DevTools Protocol and launches it from a macOS path; it cannot run inside the app
image without a headless Chrome base. `capture:ui` also needs `AUTH_SECRET` to match the
server it is capturing, because it mints a session cookie to get past `/login`.

---

## Troubleshooting

### `npm ci` fails inside `docker build` with `ECONNRESET`

Docker cannot resolve DNS. Check what a container sees:

```bash
docker run --rm alpine cat /etc/resolv.conf
```

If the nameserver is Docker Desktop's internal address (`192.168.65.x`) and this works —

```bash
docker run --rm --dns 8.8.8.8 alpine wget -q -O /dev/null https://registry.npmjs.org/next
```

— then the internal resolver is the problem, usually because a proxy is configured under
**Docker Desktop → Settings → Resources → Proxies**. Set it to "No proxy", or point it at
a proxy that answers.

Workaround without changing settings: `docker build --network=host`. That flag is
deliberately **not** in `docker-compose.yml` — one machine's broken resolver does not
belong in a committed project file.

### Port 5432 already in use

Something else owns it, usually a host Postgres or another project's stack. Put
`POSTGRES_PORT=5433` in `.env` and update `DATABASE_URL` to match.

### The page renders with no styling in Safari on `localhost`

Known, and being tracked as §0.1 of [`project-plan.md`](project-plan.md). The CSP sends
`upgrade-insecure-requests`, which Safari applies to `localhost` while Chromium exempts it
— so the stylesheets are requested over `https://`, where nothing is listening. Chromium
is unaffected, and so is the deployed site, because it is already https.

### `next dev` cannot reach the database

Check it is running and healthy:

```bash
docker compose ps
```

From the host the hostname is `localhost`. From inside a container it is `db` — the
compose service name. Using `localhost` inside a container points at the container itself,
which is the most common version of this mistake.
