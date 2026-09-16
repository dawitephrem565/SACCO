# MifosProd — Local-Runnable Mifos / Apache Fineract Stack

A clean, local-runnable copy of a working **Apache Fineract + Mifos Web App** deployment.
Mirrors the production EC2 stack, retargeted to `localhost`. **No production secrets or
production/customer data are included.**

## Stack

| Layer | Component | Image (default) |
|---|---|---|
| Core banking backend | Apache Fineract | `apache/fineract:latest` |
| Frontend | Mifos Web App (Angular) | `openmf/web-app:dev` |
| Database | PostgreSQL 18.3 | `postgres:18.3` |
| Reverse proxy | nginx | `nginx:1.27-alpine` |

Single entrypoint via nginx → no CORS / mixed-content issues. The database is never exposed to the host.

```
Browser ──http://localhost:8080──▶ nginx
                                    ├─ /                    ─▶ web-app (SPA)
                                    └─ /fineract-provider/  ─▶ fineract (HTTPS, internal)
                                                                 └─▶ postgres (internal only)
```

## Quick start

### Linux / macOS
```bash
git clone https://github.com/firaolteshale21/MifosProd.git
cd MifosProd
cp .env.example .env
chmod +x scripts/*.sh
./scripts/local-up.sh          # creates .env, generates local passwords, starts the stack
./scripts/local-healthcheck.sh # first boot migrates the DB (~3-6 min) — re-run until PASS
```

### Windows (PowerShell)
```powershell
git clone https://github.com/firaolteshale21/MifosProd.git
cd MifosProd
copy .env.example .env
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
```
> On Windows, edit `.env` and replace the `CHANGE_ME_LOCAL` values with your own strings
> (the auto-generation step is in the bash script). Full details in [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md).

## URLs (local)

| What | URL |
|---|---|
| Frontend | http://localhost:8080 |
| Backend API base | http://localhost:8080/fineract-provider/api/v1 |
| Health check | http://localhost:8080/fineract-provider/actuator/health |

**Default login (change immediately):** tenant `default`, user `mifos`, password `password`.

## Requirements
- Docker Desktop / Docker Engine with the Compose plugin
- ~4 GB free RAM and ~5 GB free disk (Fineract JVM + Postgres + images)

## Documentation
- [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md) — Windows + Linux/Mac setup
- [`docs/HANDOFF_REPORT.md`](docs/HANDOFF_REPORT.md) — what's in this repo, provenance, verification
- [`docs/PRODUCTION_STACK_SNAPSHOT.md`](docs/PRODUCTION_STACK_SNAPSHOT.md) — the production deployment it was captured from
- [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) — start/stop/logs/rebuild/backup/troubleshooting
- [`docs/SECURITY_NOTES.md`](docs/SECURITY_NOTES.md) — secrets handling, HTTPS, DB exposure

## Repository layout
```
MifosProd/
├─ docker-compose.local.yml   # canonical local stack
├─ docker-compose.yml         # same stack (default; local-safe)
├─ .env.example               # config template (copy to .env)
├─ nginx/local.conf           # reverse proxy
├─ database/init/             # DB bootstrap (creates empty DBs + user)
├─ scripts/                   # local-up/down/reset/logs/healthcheck, backup/restore
├─ backend/                   # Apache Fineract source (reference / optional build)
├─ frontend/                  # Mifos Web App source (reference / optional build)
└─ docs/                      # documentation
```
