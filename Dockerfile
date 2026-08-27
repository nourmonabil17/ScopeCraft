# ScopeCraft — container image (owner: Yousef).
#
# NOT THE PRODUCTION DEPLOY PATH. Vercel does not build from this file; it runs
# `next build` against next.config.js and applies its own output handling.
# Production ships with `git push fork dev:main`. This image exists for a
# portable local environment and a deploy path that does not depend on Vercel.
#
# Three stages so the final image carries neither the toolchain nor the source:
# `deps` resolves node_modules, `builder` compiles, `runner` holds only the
# traced standalone output. node_modules is 505 MB; the standalone bundle Next
# traces out of it is 32 MB.

# ---------------------------------------------------------------- deps ------
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until a dependency actually
# changes. Copying the whole source here would rebuild node_modules on every
# edit to a component.
COPY package.json package-lock.json ./

# `npm ci` not `npm install`: it installs exactly the lockfile and fails if the
# two have drifted, which is the behaviour a reproducible image needs.
RUN npm ci

# -------------------------------------------------------------- builder -----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# No build ARGs, deliberately. AUTH_SECRET, DATABASE_URL and the provider keys
# are runtime configuration; an ARG would survive in the image layer history
# even if nothing later referenced it. Verified: the production build completes
# with none of them set.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --------------------------------------------------------------- runner -----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The node:22-alpine base already ships an unprivileged `node` user (uid 1000).
# Using it beats creating another one — a container running as root is a
# finding, and this is the platform's own answer to it.
#
# The standalone server writes nothing at runtime (no ISR, no file uploads), but
# the copies are chowned anyway so a future cache directory does not turn into a
# permissions failure that only appears in the container.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# No `public/` COPY: the directory does not exist in this project, and COPY of a
# missing path fails the build. Add it here if one is ever created.

USER node

EXPOSE 3000
ENV PORT=3000

# Required, not cosmetic. The standalone server binds HOSTNAME, which defaults
# to localhost — inside a container that means the loopback interface only, and
# a published port reaches nothing. This is the single most common reason a
# containerised Next app appears to start and then refuses connections.
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
