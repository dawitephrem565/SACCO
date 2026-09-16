#!/usr/bin/env bash
# DANGER: stops the stack AND deletes local containers + the database volume.
# This wipes ALL local data (your local Fineract database). Use for a clean slate.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "############################################################"
echo "# WARNING: this DELETES the local database volume"
echo "#          (mifos_local_pg_data) and ALL local data."
echo "#          Production is NOT affected — this is local only."
echo "############################################################"
read -r -p "Type 'RESET' to confirm: " CONFIRM
if [ "${CONFIRM}" != "RESET" ]; then
  echo "[local-reset] aborted."
  exit 1
fi

echo "[local-reset] removing containers + volumes..."
docker compose -f docker-compose.local.yml down -v
echo "[local-reset] done. Next 'local-up.sh' will re-initialize a fresh database."
