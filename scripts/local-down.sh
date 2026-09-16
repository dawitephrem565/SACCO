#!/usr/bin/env bash
# Stop the local stack (containers are removed; the database volume is KEPT).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[local-down] stopping stack (data volume preserved)..."
docker compose -f docker-compose.local.yml down
echo "[local-down] done. Data volume 'mifos_local_pg_data' is preserved. Use local-reset.sh to wipe it."
