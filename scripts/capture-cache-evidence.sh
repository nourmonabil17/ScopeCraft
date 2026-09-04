#!/usr/bin/env bash
#
# Application-layer cache evidence (owner: Yousef) — Module A3.
#
# Boots the production build once and sends the SAME request twice, then reads
# back the two rows it wrote. The point is the second response: it must carry
# `x-cache: hit` and must not have called a provider.
#
# WHY THIS IS NOT PART OF capture-evidence.sh. That script proves the eleven
# request/response contracts by booting a server per provider environment. This
# one needs the opposite: one server, one environment, two requests that differ
# only in being the second. Folding it in would mean a seventh boot that shares
# none of the scenario machinery.
#
# WHY THE IDEA IS GENERATED FRESH EACH RUN. The cache is permanent — nothing
# evicts a row. A fixed idea would be a hit on the very first request of the
# second run and the capture would prove nothing. The nonce guarantees the first
# request is always a genuine miss.
#
#   AUTH_SECRET=... DATABASE_URL=... npm run capture:cache
#
# Exits non-zero if the first response is not a miss or the second is not a hit,
# so it is a regression check as well as a capture.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

PORT=3202
URL="http://127.0.0.1:${PORT}/api/scopecraft"
OUT="${REPO_ROOT}/docs/evidence/raw"
TRANSCRIPT="${OUT}/cache-transcript.txt"
TMP="$(mktemp -d)"
SERVER_PID=""

if [[ -z "${AUTH_SECRET:-}" ]]; then
  echo "FATAL: AUTH_SECRET is not set. Export the same value the captured" >&2
  echo "       server runs with, or every request is answered with 401." >&2
  exit 1
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL is not set. The cache lives in Postgres." >&2
  exit 1
fi

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -rf "${TMP}"
}
trap cleanup EXIT

mkdir -p "${OUT}"

if ! COOKIE="$(node "${REPO_ROOT}/scripts/mint-session.mjs" 2>&1)"; then
  echo "FATAL: could not mint a capture session." >&2
  echo "       ${COOKIE}" >&2
  exit 1
fi
# The transcript is a committed public artifact and a session token is a
# credential. The recorded command shows the shape, never the bytes.
SHOWN_COOKIE="authjs.session-token=<session-cookie>"

# The quota counts rows, and a hit writes one, so a capture on a branch with a
# day's history would 429 before reaching the cache.
DAILY_PLAN_LIMIT=200 npx next start -p "${PORT}" > "${TMP}/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do
  curl -sS -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/login" 2>/dev/null && break
  sleep 0.5
done

IDEA="a shared grocery list app for flatmates with a weekly budget, run $(date -u +%Y%m%dT%H%M%SZ)"
BODY="$(printf '{"idea":"%s","team_capacity_points":30,"sprint_length_days":14}' "${IDEA}")"
printf '%s' "${BODY}" > "${TMP}/request.json"

# send <label> -> appends the command, the status line, the four provenance
# headers and the elapsed time. Bodies are compared separately, below.
send() {
  local label="$1"
  {
    echo "\$ curl -i -X POST ${URL} \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -H 'Cookie: ${SHOWN_COOKIE}' \\"
    echo "    --data-binary @request.json"
    echo
  } >> "${TRANSCRIPT}"

  curl -sS -D "${TMP}/${label}.h" -o "${TMP}/${label}.json" \
    -w '%{time_total}' \
    -X POST "${URL}" \
    -H 'Content-Type: application/json' \
    -H "Cookie: authjs.session-token=${COOKIE}" \
    --data-binary "@${TMP}/request.json" > "${TMP}/${label}.time"

  head -1 "${TMP}/${label}.h" >> "${TRANSCRIPT}"
  grep -iE '^x-(cache|provider-used|prompt-version|plan-id)' "${TMP}/${label}.h" \
    | sort >> "${TRANSCRIPT}"
  echo "elapsed: $(cat "${TMP}/${label}.time")s" >> "${TRANSCRIPT}"
  echo >> "${TRANSCRIPT}"
}

{
  echo "ScopeCraft — application-layer cache capture (Module A3)"
  echo "Captured   : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Commit     : $(git rev-parse --short HEAD)"
  echo "Server     : next start (production build) on 127.0.0.1:${PORT}, DAILY_PLAN_LIMIT=200"
  echo "Database   : $(node -e 'console.log(new URL(process.env.DATABASE_URL.replace(/^postgres(ql)?:/,"http:")).hostname.split(".")[0])')"
  echo "Request    : identical both times, idea carries a per-run nonce so run 1 is a real miss"
  echo
  echo "--- request.json ---"
  cat "${TMP}/request.json"
  echo; echo
  echo "=== RUN 1 — first time this request has been seen ==="
  echo
} > "${TRANSCRIPT}"

send run1

{
  echo "=== RUN 2 — byte-identical request ==="
  echo
} >> "${TRANSCRIPT}"

send run2

CACHE1="$(grep -i '^x-cache' "${TMP}/run1.h" | tr -d '\r' | awk '{print $2}')"
CACHE2="$(grep -i '^x-cache' "${TMP}/run2.h" | tr -d '\r' | awk '{print $2}')"

{
  echo "=== BODIES ==="
  echo
} >> "${TRANSCRIPT}"

# Byte equality is the wrong question and the first run of this capture proved
# it: the served plan makes a round trip through a `jsonb` column, and Postgres
# does not preserve object key order in that type. What has to hold is that the
# two payloads carry the same data, which is what the client parses.
node -e '
const fs = require("node:fs");
const [a, b] = process.argv.slice(1).map((f) => fs.readFileSync(f, "utf8"));
const order = (s) => Object.keys(JSON.parse(s)).join(",");
const deep = JSON.stringify(JSON.parse(a), Object.keys(JSON.parse(a)).sort())
  === JSON.stringify(JSON.parse(b), Object.keys(JSON.parse(b)).sort());
console.log(`bytes identical         : ${a === b ? "yes" : "no"}`);
console.log(`same data               : ${deep ? "yes" : "NO"}`);
console.log(`sizes                   : ${a.length} / ${b.length} bytes`);
console.log(`top-level key order run1: ${order(a)}`);
console.log(`top-level key order run2: ${order(b)}`);
' "${TMP}/run1.json" "${TMP}/run2.json" >> "${TRANSCRIPT}"

{
  echo
  echo "=== ROWS WRITTEN ==="
  echo
} >> "${TRANSCRIPT}"

ROWS_JS="$(cat <<'JS'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5 });
const rows = await sql`
  select id, status, provider_used, attempts, duration_ms,
         left(request_hash, 16) as hash16, (response is not null) as has_response
  from plans order by created_at desc limit 2`;
for (const r of rows.reverse()) {
  console.log(
    `${r.id.slice(0, 8)}  status=${r.status}  provider=${r.provider_used}  ` +
    `attempts=${r.attempts}  duration_ms=${r.duration_ms}  ` +
    `request_hash=${r.hash16}...  response=${r.has_response}`
  );
}
console.log(`\nsame request_hash on both rows : ${rows[0].hash16 === rows[1].hash16}`);
const [{ same }] = await sql`
  select (a.response = b.response) as same from plans a, plans b
  where a.id = ${rows[0].id} and b.id = ${rows[1].id}`;
console.log(`stored response identical      : ${same}`);
await sql.end();
JS
)"
# --input-type=module -e resolves bare specifiers from the cwd (the repo root).
# A file under $TMP cannot: it would look for node_modules beside itself.
node --input-type=module -e "${ROWS_JS}" >> "${TRANSCRIPT}"

{
  echo
  echo "=== SERVER LOG (scopecraft.generation lines) ==="
  echo
  grep 'scopecraft.generation' "${TMP}/server.log" || echo "(none)"
} >> "${TRANSCRIPT}"

echo "run 1: x-cache=${CACHE1}   run 2: x-cache=${CACHE2}"
echo "written: ${TRANSCRIPT}"

if [[ "${CACHE1}" != "miss" || "${CACHE2}" != "hit" ]]; then
  echo "FAIL: expected miss then hit." >&2
  exit 1
fi
echo "OK"
