#!/usr/bin/env bash
# Tail logs for the stack. Usage:
#   ./scripts/local-logs.sh            # all services
#   ./scripts/local-logs.sh fineract   # one service (db | fineract | webapp | proxy)
set -euo pipefail
cd "$(dirname "$0")/.."
SVC="${1:-}"
COMPOSE="docker compose -f docker-compose.local.yml"
if [ -n "${SVC}" ]; then
  exec ${COMPOSE} logs -f --tail=200 "${SVC}"
else
  exec ${COMPOSE} logs -f --tail=100
fi
