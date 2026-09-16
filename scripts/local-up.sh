#!/usr/bin/env bash
# Start the full local Mifos/Fineract stack.
# - creates .env from .env.example if missing
# - auto-generates secure local passwords for any CHANGE_ME_LOCAL placeholders
# - starts all services and prints the URLs
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.local.yml"

if [ ! -f .env ]; then
  echo "[local-up] .env not found -> creating from .env.example"
  cp .env.example .env
fi

# Generate strong local passwords for any placeholder values.
gen() { openssl rand -hex 24; }
for key in POSTGRES_PASSWORD FINERACT_DB_PASS FINERACT_MASTER_PASSWORD; do
  val="$(grep -E "^${key}=" .env | cut -d= -f2- || true)"
  if [ -z "${val}" ] || echo "${val}" | grep -q "CHANGE_ME"; then
    new="$(gen)"
    # portable in-place sed (GNU + BSD)
    sed -i.bak "s|^${key}=.*|${key}=${new}|" .env && rm -f .env.bak
    echo "[local-up] generated a secure value for ${key}"
  fi
done

echo "[local-up] starting stack..."
${COMPOSE} up -d

PORT="$(grep -E '^LOCAL_HTTP_PORT=' .env | cut -d= -f2- || echo 8080)"
PORT="${PORT:-8080}"
cat <<EOF

[local-up] Stack starting. Fineract runs database migrations on first boot (~3-6 min).
           Watch readiness with:  ./scripts/local-healthcheck.sh

  Frontend     : http://localhost:${PORT}
  Backend API  : http://localhost:${PORT}/fineract-provider/api/v1
  Health       : http://localhost:${PORT}/fineract-provider/actuator/health

  Default login (CHANGE after first login): tenant=default  user=mifos  password=password
EOF
