#!/bin/bash
# Creates the Fineract databases + application DB user on first DB container start.
# Adapted from apache/fineract official:
#   config/docker/postgresql/docker-entrypoint-initdb.d/01-init.sh
# Variables are supplied by the db service environment (POSTGRES_* and FINERACT_DB_*).
# NOTE: this only creates EMPTY databases + the user. Fineract itself builds all
# tables via Liquibase on first boot. No customer/production data is present here.
set -e
export PGPASSWORD=$POSTGRES_PASSWORD;
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER $FINERACT_DB_USER WITH PASSWORD '$FINERACT_DB_PASS';
  CREATE DATABASE $FINERACT_TENANTS_DB_NAME;
  CREATE DATABASE $FINERACT_TENANT_DEFAULT_DB_NAME;
  GRANT ALL PRIVILEGES ON DATABASE $FINERACT_TENANTS_DB_NAME TO $FINERACT_DB_USER;
  GRANT ALL PRIVILEGES ON DATABASE $FINERACT_TENANT_DEFAULT_DB_NAME TO $FINERACT_DB_USER;
  \c $FINERACT_TENANTS_DB_NAME
  GRANT ALL ON SCHEMA public TO $FINERACT_DB_USER;
  \c $FINERACT_TENANT_DEFAULT_DB_NAME
  GRANT ALL ON SCHEMA public TO $FINERACT_DB_USER;
EOSQL
