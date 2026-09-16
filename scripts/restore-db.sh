#!/usr/bin/env bash
# Restore local Fineract databases from a backup directory created by backup-db.sh.
# Usage: ./scripts/restore-db.sh backups/<timestamp>
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.local.yml"

DIR="${1:-}"
if [ -z "${DIR}" ] || [ ! -d "${DIR}" ]; then
  echo "Usage: $0 <backup-dir>    (e.g. $0 backups/20260101-120000)"
  echo "Available backups:"; ls -1 backups 2>/dev/null || echo "  (none)"
  exit 1
fi

TENANTS_DB="$(grep -E '^FINERACT_TENANTS_DB_NAME=' .env | cut -d= -f2- || echo fineract_tenants)"
DEFAULT_DB="$(grep -E '^FINERACT_TENANT_DEFAULT_DB_NAME=' .env | cut -d= -f2- || echo fineract_default)"
USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- || echo root)"

echo "WARNING: this OVERWRITES the local ${TENANTS_DB} and ${DEFAULT_DB} databases."
read -r -p "Type 'RESTORE' to confirm: " C
[ "${C}" = "RESTORE" ] || { echo "aborted."; exit 1; }

for db in "${TENANTS_DB}" "${DEFAULT_DB}"; do
  f="${DIR}/${db}.sql"
  if [ -f "${f}" ]; then
    echo "[restore] loading ${f} into ${db} ..."
    ${COMPOSE} exec -T db sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U ${USER} -d ${db}" < "${f}"
  else
    echo "[restore] SKIP ${db} (no file ${f})"
  fi
done
echo "[restore] done. Restart Fineract:  ${COMPOSE} restart fineract"
