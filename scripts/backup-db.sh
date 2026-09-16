#!/usr/bin/env bash
# Back up the local Fineract databases to ./backups/<timestamp>/.
# Secrets are read from inside the container, never passed on the command line.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.local.yml"

TENANTS_DB="$(grep -E '^FINERACT_TENANTS_DB_NAME=' .env | cut -d= -f2- || echo fineract_tenants)"
DEFAULT_DB="$(grep -E '^FINERACT_TENANT_DEFAULT_DB_NAME=' .env | cut -d= -f2- || echo fineract_default)"
USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- || echo root)"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${STAMP}"
mkdir -p "${OUT}"

for db in "${TENANTS_DB}" "${DEFAULT_DB}"; do
  echo "[backup] dumping ${db} ..."
  ${COMPOSE} exec -T db sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -U ${USER} -d ${db}" > "${OUT}/${db}.sql"
done

echo "[backup] done -> ${OUT}/"
ls -la "${OUT}"
echo "[backup] NOTE: *.sql dumps are git-ignored (they may contain data). Keep them off GitHub."
