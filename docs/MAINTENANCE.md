# Maintenance (Local)

All commands run from the repo root. `COMPOSE = docker compose -f docker-compose.local.yml`.

## Start / stop / restart
```bash
./scripts/local-up.sh                         # start (Linux/Mac, auto-generates .env secrets)
docker compose -f docker-compose.local.yml up -d        # start (any OS)
docker compose -f docker-compose.local.yml stop         # stop, keep containers
docker compose -f docker-compose.local.yml down         # stop + remove containers (keep data volume)
docker compose -f docker-compose.local.yml restart      # restart all
docker compose -f docker-compose.local.yml restart fineract
```

## Status & logs
```bash
docker compose -f docker-compose.local.yml ps
./scripts/local-logs.sh                # all services
./scripts/local-logs.sh fineract       # backend only
./scripts/local-healthcheck.sh         # PASS/WARNING/FAIL summary
```

## Rebuild
Default runs published images. To pull newer images:
```bash
docker compose -f docker-compose.local.yml pull
docker compose -f docker-compose.local.yml up -d
```
To build from the bundled source: uncomment the `build:` block under the `fineract`
and/or `webapp` service in `docker-compose.local.yml`, then:
```bash
docker compose -f docker-compose.local.yml up -d --build
```
> Building Fineract from `./backend` is heavy (Gradle, lots of RAM/disk, slow). The
> frontend (`./frontend`) builds via its Dockerfile (Node) in a few minutes.

## Database backup / restore
```bash
./scripts/backup-db.sh                       # -> ./backups/<timestamp>/{fineract_tenants,fineract_default}.sql
./scripts/restore-db.sh backups/<timestamp>  # overwrites local DBs (asks to confirm)
```
Manual:
```bash
docker compose -f docker-compose.local.yml exec -T db \
  sh -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U root -d fineract_default' > default.sql
```
> `*.sql` / `*.dump` are git-ignored — backups never get committed.

## Where to edit the frontend API URL
`.env` → `FINERACT_API_BASE` (and `LOCAL_HTTP_PORT`). These are injected into the web-app
container, which writes them into `assets/env.js` at startup. After changing:
```bash
docker compose -f docker-compose.local.yml up -d webapp   # recreate so new env is applied
```
The full browser API URL is `FINERACT_API_BASE` + `/fineract-provider/api` + `/v1`.

## Where the backend env is configured
In `docker-compose.local.yml` under the `fineract` service `environment:` block. Secrets
(`FINERACT_DB_PASS`, `FINERACT_MASTER_PASSWORD`) are interpolated from `.env`; everything
else is non-secret tuning. Reverse-proxy routing is in `nginx/local.conf`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Health check stays WARNING for a few minutes | Normal first boot — Fineract runs Liquibase (~3-6 min). Re-run healthcheck. |
| `db` container restart loop, "data in /var/lib/postgresql/data" | PG18 dir change — the volume must mount at `/var/lib/postgresql` (already set). If you changed it, run `local-reset.sh`. |
| API returns 302 redirect to `https://...` | nginx must send `X-Forwarded-Proto: https` on `/fineract-provider/` (already set in `nginx/local.conf`). If you edited that file in-place, recreate the proxy: `... up -d --force-recreate proxy`. |
| Editing `nginx/local.conf` has no effect | Single-file bind mounts don't pick up in-place edits — recreate: `docker compose -f docker-compose.local.yml up -d --force-recreate proxy`. |
| Login returns 500 with "Invalid JSON in BODY" | Send credentials in a JSON body (the web app does this); not as URL params (FINERACT-726). |
| Port 8080 already in use | Set `LOCAL_HTTP_PORT` (and matching `FINERACT_API_BASE`) in `.env`, then `up -d`. |
| Frontend loads but can't reach backend | Ensure `FINERACT_API_BASE` matches `LOCAL_HTTP_PORT`; recreate `webapp`. |
