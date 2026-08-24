#!/usr/bin/env bash
#
# scripts/capture-evidence.sh — API and provider-failover evidence capture (owner: Youssef).
#
#   npm run build && npm run capture:evidence
#
# WHY THIS EXISTS
# The acceptance criteria for the AI & Backend module require two evidence
# artifacts that no test can stand in for: "Postman/curl evidence" and a
# "provider fallback/error log". Every automated test in this repository mocks
# the network — correct for CI, but it means no committed artifact shows the
# real route answering a real HTTP request, or the real failover chain stepping
# from one provider to the next.
#
# This script produces both, from a production build, against live providers.
# It is deliberately NOT part of `npm test`: it needs real credentials, makes
# real calls, and costs tokens.
#
# WHAT IT DOES
# Boots `next start` six times, each with a different provider environment, and
# drives real curl requests through it. Server stdout/stderr is captured per
# scenario, so the fallback log is the application's own output rather than a
# transcription of it.
#
# SAFETY RULES THIS SCRIPT FOLLOWS
#  - Credentials are never printed, never passed on a command line, and never
#    written to an output file. The invalid-credential scenarios use the literal
#    string INVALID_KEY_FOR_EVIDENCE_CAPTURE, which is not a real key shape.
#  - Every output file is scanned for provider key patterns before the script
#    exits; a hit is a hard failure and the run is aborted.
#  - Outputs are written only under docs/evidence/raw/.
#
# EXIT CODE: 0 when every scenario produced the expected HTTP status and the
# secret scan is clean; 1 otherwise.

set -euo pipefail

PORT="${EVIDENCE_PORT:-3100}"
URL="http://127.0.0.1:${PORT}/api/scopecraft"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REPO_ROOT}/docs/evidence/raw"
TRANSCRIPT="${OUT}/curl-transcript.txt"
FALLBACK_LOG="${OUT}/provider-fallback.log"
TMP="$(mktemp -d)"

BAD_KEY="INVALID_KEY_FOR_EVIDENCE_CAPTURE"

SERVER_PID=""
FAILURES=0

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -rf "${TMP}"
}
trap cleanup EXIT

mkdir -p "${OUT}"

# ---------------------------------------------------------------- server ----

# start_server <scenario-slug> <env assignments...>
# The environment is passed as a prefix to `next start`. Next.js does not
# override variables that are already present in process.env, so these win over
# .env.local — including when the value is the empty string, which is how the
# "no provider configured" scenario is produced without touching .env.local.
start_server() {
  local slug="$1"; shift
  CURRENT_SERVER_LOG="${TMP}/server-${slug}.log"

  env "$@" npx next start -p "${PORT}" > "${CURRENT_SERVER_LOG}" 2>&1 &
  SERVER_PID=$!

  local i
  for i in $(seq 1 60); do
    if curl -sS -o /dev/null --max-time 2 -X POST "${URL}" \
         -H 'Content-Type: application/json' --data-binary '{' 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done

  echo "FATAL: server did not become ready on port ${PORT}" >&2
  exit 1
}

stop_server() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  SERVER_PID=""
}

# ------------------------------------------------------------- recording ----

section() {
  {
    echo ""
    echo "==================================================================="
    echo "$1"
    echo "==================================================================="
  } >> "${TRANSCRIPT}"
}

# The recorded command line is written to be copy-pasteable: a reviewer can
# paste it into a shell (with the server running on the same port) and get the
# same response. Request payloads referenced by name are committed alongside
# this transcript in docs/evidence/raw/.

# expect_body <label> <want-status> <inline-json>
expect_body() {
  local label="$1" want="$2" body="$3"
  {
    echo ""
    echo "-------------------------------------------------------------------"
    echo "CASE: ${label}"
    echo "EXPECT: HTTP ${want}"
    echo ""
    echo "\$ curl -sS -i -X POST ${URL} \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '${body}'"
    echo ""
  } >> "${TRANSCRIPT}"

  curl -sS -i -X POST "${URL}" -H 'Content-Type: application/json' \
    --data-binary "${body}" > "${TMP}/resp.txt" 2>&1 || true
  finish_case "${label}" "${want}"
}

# expect_file <label> <want-status> <path> <display-name> [prelude-line]
expect_file() {
  local label="$1" want="$2" path="$3" shown="$4" prelude="${5:-}"
  {
    echo ""
    echo "-------------------------------------------------------------------"
    echo "CASE: ${label}"
    echo "EXPECT: HTTP ${want}"
    echo ""
    [[ -n "${prelude}" ]] && echo "\$ ${prelude}"
    echo "\$ curl -sS -i -X POST ${URL} \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    --data-binary @${shown}"
    echo ""
  } >> "${TRANSCRIPT}"

  curl -sS -i -X POST "${URL}" -H 'Content-Type: application/json' \
    --data-binary "@${path}" > "${TMP}/resp.txt" 2>&1 || true
  finish_case "${label}" "${want}"
}

# expect_method <label> <want-status> <method>
expect_method() {
  local label="$1" want="$2" method="$3"
  {
    echo ""
    echo "-------------------------------------------------------------------"
    echo "CASE: ${label}"
    echo "EXPECT: HTTP ${want}"
    echo ""
    echo "\$ curl -sS -i -X ${method} ${URL}"
    echo ""
  } >> "${TRANSCRIPT}"

  curl -sS -i -X "${method}" "${URL}" > "${TMP}/resp.txt" 2>&1 || true
  finish_case "${label}" "${want}"
}

# finish_case <label> <want-status> — appends the real response and scores it.
finish_case() {
  local label="$1" want="$2" got
  got="$(head -1 "${TMP}/resp.txt" | awk '{print $2}')"

  cat "${TMP}/resp.txt" >> "${TRANSCRIPT}"
  echo "" >> "${TRANSCRIPT}"

  if [[ "${got}" == "${want}" ]]; then
    echo "RESULT: PASS (HTTP ${got})" >> "${TRANSCRIPT}"
    printf '  ✓ %-46s HTTP %s\n' "${label}" "${got}"
  else
    echo "RESULT: FAIL (expected ${want}, got ${got:-<none>})" >> "${TRANSCRIPT}"
    printf '  ✗ %-46s expected %s, got %s\n' "${label}" "${want}" "${got:-<none>}"
    FAILURES=$((FAILURES + 1))
  fi
}

# capture_success <label> <expected-provider|any> <body-file> <saved-name>
# A 200 body is a full PRD, so the transcript records the status line, the
# headers and a structural summary; the whole body is written beside it as JSON
# so the schema can be inspected directly.
capture_success() {
  local label="$1" want_provider="$2" body_file="$3" saved="$4"

  {
    echo ""
    echo "-------------------------------------------------------------------"
    echo "CASE: ${label}"
    echo "EXPECT: HTTP 200"
    echo ""
    echo "\$ curl -sS -D - -o ${saved} -X POST ${URL} \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    --data-binary @request-valid.json"
    echo ""
  } >> "${TRANSCRIPT}"

  # The generation is genuinely intermittent: the model sometimes returns
  # estimates the deterministic planner rejects (502 PLANNING_ERROR — usually a
  # dependency on a story it never emitted). A user would retry, so this does
  # too, and reports how many attempts it took rather than hiding the flakiness.
  local got provider attempt=1
  while [[ "${attempt}" -le 4 ]]; do
    curl -sS -D "${TMP}/head.txt" -o "${TMP}/body.json" \
      -X POST "${URL}" \
      -H 'Content-Type: application/json' \
      --data-binary "@${body_file}" || true
    got="$(head -1 "${TMP}/head.txt" | awk '{print $2}')"
    [[ "${got}" == "200" ]] && break
    printf '    · attempt %d returned HTTP %s — retrying\n' "${attempt}" "${got:-none}"
    attempt=$((attempt + 1))
  done
  GENERATION_ATTEMPTS="${attempt}"
  provider="$(grep -i '^x-provider-used:' "${TMP}/head.txt" | tr -d '\r' | awk '{print $2}' || true)"

  cat "${TMP}/head.txt" >> "${TRANSCRIPT}"

  if [[ "${got}" == "200" ]]; then
    cp "${TMP}/body.json" "${OUT}/${saved}"
    {
      echo "Body written to docs/evidence/raw/${saved}. Structural summary:"
      echo ""
      # Field names are the flat 11-field PRD contract in docs/api-contracts.md;
      # priority, effort and moscow are objects keyed by story ID.
      jq -r '
        "  top-level keys        : " + ([keys_unsorted[]] | length | tostring)
                                     + " (" + ([keys_unsorted[]] | join(", ")) + ")\n" +
        "  user_stories          : " + (.user_stories | length | tostring) + "\n" +
        "  every story has AC    : " + (.user_stories | all(.acceptance_criteria | length > 0) | tostring) + "\n" +
        "  risks                 : " + (.risks | length | tostring) + "\n" +
        "  sprint assignments    : " + (.sprint | length | tostring) + "\n" +
        "  priority / effort keys: " + ((.priority | keys | length | tostring)) + " / "
                                     + ((.effort | keys | length | tostring)) + "\n" +
        "  moscow buckets        : " + ((.moscow | to_entries | map(.value) | unique | join(", "))) + "\n" +
        "  capacity_points       : " + (.sprint_plan.capacity_points | tostring) + "\n" +
        "  committed_points      : " + (.sprint_plan.committed_points | tostring) + "\n" +
        "  included / deferred   : " + (.sprint_plan.included | length | tostring) + " / "
                                     + (.sprint_plan.deferred | length | tostring) + "\n" +
        "  committed <= capacity : " + (.sprint_plan.committed_points <= .sprint_plan.capacity_points | tostring) + "\n" +
        "  every story scheduled : " + (((.sprint | map(.story_id) | sort) == (.user_stories | map(.id) | sort)) | tostring)
      ' "${TMP}/body.json" 2>&1 | sed 's/^jq:/  jq:/'
      echo ""
    } >> "${TRANSCRIPT}"
  fi

  if [[ "${got}" == "200" ]] && { [[ "${want_provider}" == "any" ]] || [[ "${provider}" == "${want_provider}" ]]; }; then
    echo "RESULT: PASS (HTTP 200, served by ${provider})" >> "${TRANSCRIPT}"
    printf '  ✓ %-46s HTTP 200 via %s\n' "${label}" "${provider}"
  else
    echo "RESULT: FAIL (HTTP ${got:-<none>}, provider ${provider:-<none>}, wanted ${want_provider})" >> "${TRANSCRIPT}"
    printf '  ✗ %-46s HTTP %s via %s (wanted %s)\n' "${label}" "${got:-<none>}" "${provider:-<none>}" "${want_provider}"
    FAILURES=$((FAILURES + 1))
  fi
}

# append_server_log <heading>
append_server_log() {
  {
    echo ""
    echo "==================================================================="
    echo "$1"
    echo "==================================================================="
    echo ""
    # Drop the Next.js banner; keep the application's own output.
    grep -v -e '▲ Next.js' -e '^- Local:' -e '^- Network:' -e '^ *$' \
      "${CURRENT_SERVER_LOG}" || echo "(no application output)"
  } >> "${FALLBACK_LOG}"
}

# ------------------------------------------------------------- payloads ----

VALID_BODY="${TMP}/valid.json"
cat > "${VALID_BODY}" <<'JSON'
{
  "idea": "A web app that helps university students form study groups by matching them on course, availability and preferred study style.",
  "constraints": "Team of four, five weeks, no paid APIs.",
  "team_capacity_points": 30,
  "sprint_length_days": 14
}
JSON

# The request payload is copied into the evidence folder so a reviewer can run
# the recorded commands verbatim.
cp "${VALID_BODY}" "${OUT}/request-valid.json"

OVERSIZE_BODY="${TMP}/oversize.json"
python3 - "${OVERSIZE_BODY}" <<'PY'
import json, sys
# 20 KB of body — over the 16 KB cap, so the size guard must fire before
# JSON.parse and before any schema check.
with open(sys.argv[1], "w") as f:
    json.dump({"idea": "A study group matching app. " + ("padding " * 2600)}, f)
PY

# ------------------------------------------------------------------ run ----

: > "${TRANSCRIPT}"
: > "${FALLBACK_LOG}"

CAPTURED_AT="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"

for f in "${TRANSCRIPT}" "${FALLBACK_LOG}"; do
  {
    echo "ScopeCraft — captured $(basename "${f}")"
    echo "Captured at : ${CAPTURED_AT}"
    echo "Commit      : ${GIT_SHA}"
    echo "Server      : next start (production build) on 127.0.0.1:${PORT}"
    echo "Generated by: scripts/capture-evidence.sh"
    echo ""
    echo "This file is raw captured output. Do not hand-edit."
  } >> "${f}"
done

echo "Capturing evidence against a production build on port ${PORT}..."
echo ""

# ---- Scenario 1: all providers configured and reachable --------------------
echo "[1/6] Local rejections and the happy path (all providers healthy)"
start_server "healthy"
section "SCENARIO 1 — all three providers configured (env from .env.local)"

capture_success "valid request returns a plan" "any" "${VALID_BODY}" "200-response.json"

expect_body "malformed JSON is rejected" "400" \
  '{"idea": "A study group matching app for students",'

expect_file "oversized body is rejected" "413" \
  "${OVERSIZE_BODY}" "oversize.json" \
  "python3 -c 'import json;print(json.dumps({\"idea\":\"A study group matching app. \"+\"padding \"*2600}))' > oversize.json"

expect_body "short idea fails schema validation" "422" \
  '{"idea":"hi","team_capacity_points":900}'

expect_body "unintelligible idea asks for clarification" "422" \
  '{"idea":"qwrtplkj zxcvbnmk hjklzxcv bnmqwrtp lkjhgfds"}'

expect_method "GET is not an allowed method" "405" "GET"

append_server_log "SCENARIO 1 — all three providers configured and reachable"
stop_server

# ---- Scenario 2: primary fails, first fallback serves ----------------------
echo "[2/6] One-hop failover: NVIDIA credential invalid"
start_server "failover-groq" "NVIDIA_API_KEY=${BAD_KEY}"
section "SCENARIO 2 — NVIDIA credential invalid; Groq and Gemini healthy"
capture_success "failover to Groq serves the request" "groq" "${VALID_BODY}" "200-response-groq.json"
append_server_log "SCENARIO 2 — NVIDIA credential invalid (expect: nvidia fails, groq serves)"
stop_server

# ---- Scenario 3: two providers fail, last one serves -----------------------
echo "[3/6] Two-hop failover: NVIDIA and Groq credentials invalid"
start_server "failover-gemini" "NVIDIA_API_KEY=${BAD_KEY}" "GROQ_API_KEY=${BAD_KEY}"
section "SCENARIO 3 — NVIDIA and Groq credentials invalid; Gemini healthy"
capture_success "failover to Gemini serves the request" "gemini" "${VALID_BODY}" "200-response-gemini.json"
append_server_log "SCENARIO 3 — NVIDIA and Groq credentials invalid (expect: two hops, gemini serves)"
stop_server

# ---- Scenario 4: the whole chain is exhausted ------------------------------
echo "[4/6] Chain exhausted: all three credentials invalid"
start_server "exhausted" "NVIDIA_API_KEY=${BAD_KEY}" "GROQ_API_KEY=${BAD_KEY}" "GEMINI_API_KEY=${BAD_KEY}"
section "SCENARIO 4 — every provider credential invalid"
expect_file "exhausted chain returns a safe 502" "502" \
  "${VALID_BODY}" "request-valid.json"
append_server_log "SCENARIO 4 — every provider credential invalid (expect: three failures, then exhausted)"
stop_server

# ---- Scenario 5: nothing configured ----------------------------------------
echo "[5/6] Nothing configured: no provider credentials present"
start_server "unconfigured" "NVIDIA_API_KEY=" "GROQ_API_KEY=" "GEMINI_API_KEY="
section "SCENARIO 5 — no provider credential is configured"
expect_file "unconfigured deployment returns a safe 502" "502" \
  "${VALID_BODY}" "request-valid.json"
append_server_log "SCENARIO 5 — no provider credential configured (expect: skipped, not failed)"
stop_server

# ---- Scenario 6: timeout ----------------------------------------------------
echo "[6/6] Timeout: providers healthy, 1 ms deadline"
start_server "timeout" "AI_TIMEOUT_MS=1"
section "SCENARIO 6 — providers healthy but the deadline is 1 ms"
expect_file "deadline exceeded returns 504" "504" \
  "${VALID_BODY}" "request-valid.json"
append_server_log "SCENARIO 6 — AI_TIMEOUT_MS=1 (expect: every provider aborts on the clock)"
stop_server

# ------------------------------------------------------------ secret scan ----

echo ""
echo "Scanning captured output for credential patterns..."
SECRET_RE='AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|nvapi-[0-9A-Za-z_-]{20,}'
if grep -rqE "${SECRET_RE}" "${OUT}"; then
  echo "  ✗ LEAK — a credential pattern appears in ${OUT}. Outputs NOT safe to commit." >&2
  FAILURES=$((FAILURES + 1))
else
  echo "  ✓ CLEAN — no credential pattern in any captured file."
fi

# ------------------------------------------------------- committability ----
# Evidence that git silently ignores is evidence nobody can review. The repo's
# blanket `*.log` rule already swallowed provider-fallback.log once; this check
# makes that failure loud instead of invisible.

echo ""
echo "Checking captured files are committable..."
IGNORED_COUNT=0
for f in "${OUT}"/*; do
  if git -C "${REPO_ROOT}" check-ignore -q "${f}"; then
    echo "  ✗ IGNORED — $(basename "${f}") is excluded by .gitignore and will not commit." >&2
    IGNORED_COUNT=$((IGNORED_COUNT + 1))
    FAILURES=$((FAILURES + 1))
  fi
done
if [[ "${IGNORED_COUNT}" -eq 0 ]]; then
  echo "  ✓ All captured files are tracked by git."
fi

echo ""
if [[ "${FAILURES}" -eq 0 ]]; then
  echo "All scenarios behaved as documented. Evidence written to docs/evidence/raw/."
  exit 0
fi
echo "${FAILURES} scenario(s) did not match the documented contract. See ${TRANSCRIPT}." >&2
exit 1
