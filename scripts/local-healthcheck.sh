#!/usr/bin/env bash
# Health check for the local stack. Prints PASS / WARNING / FAIL per component.
set -uo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.local.yml"

PORT="$(grep -E '^LOCAL_HTTP_PORT=' .env 2>/dev/null | cut -d= -f2- || echo 8080)"
PORT="${PORT:-8080}"
BASE="http://localhost:${PORT}"
rc=0

line() { printf '%-26s : %s\n' "$1" "$2"; }

# 1) containers running
running="$(${COMPOSE} ps --services --filter status=running 2>/dev/null | tr '\n' ' ')"
for s in db fineract webapp proxy; do
  if echo " ${running} " | grep -q " ${s} "; then line "container:${s}" "PASS (running)"; else line "container:${s}" "FAIL (not running)"; rc=1; fi
done

# 2) database connectivity
if ${COMPOSE} exec -T db pg_isready -U "$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2- || echo root)" >/dev/null 2>&1; then
  line "database connectivity" "PASS"
else
  line "database connectivity" "FAIL (pg_isready failed)"; rc=1
fi

# 3) backend health (via proxy)
health="$(curl -s --max-time 8 "${BASE}/fineract-provider/actuator/health" 2>/dev/null || true)"
if echo "${health}" | grep -q '"status":"UP"'; then
  line "backend API health" "PASS (${BASE}/fineract-provider/actuator/health)"
elif [ -z "${health}" ]; then
  line "backend API health" "WARNING (no response yet — Fineract may still be migrating, wait a few min)"
  rc=1
else
  line "backend API health" "WARNING (unexpected: ${health})"; rc=1
fi

# 4) frontend
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "${BASE}/" 2>/dev/null || echo 000)"
if [ "${code}" = "200" ]; then line "frontend" "PASS (${BASE})"; else line "frontend" "FAIL (HTTP ${code})"; rc=1; fi

# 5) authenticated login through proxy (browser path)
login="$(curl -s --max-time 10 -X POST -H 'Fineract-Platform-TenantId: default' -H 'Content-Type: application/json' \
  -d '{"username":"mifos","password":"password"}' "${BASE}/fineract-provider/api/v1/authentication" 2>/dev/null || true)"
if echo "${login}" | grep -q '"authenticated":true'; then
  line "login (mifos via proxy)" "PASS"
else
  line "login (mifos via proxy)" "WARNING (backend not ready or default creds changed)"
fi

echo
if [ "${rc}" -eq 0 ]; then echo "OVERALL: PASS"; else echo "OVERALL: NOT READY (see WARNING/FAIL above; first boot takes ~3-6 min)"; fi
exit "${rc}"
