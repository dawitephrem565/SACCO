# Local Setup

Run the same Mifos/Fineract stack on your own machine with Docker. Default images mean
no source build is required — a fresh clone starts in minutes (plus ~3-6 min for the
Fineract first-boot database migration).

## Prerequisites
- **Docker Desktop** (Windows/macOS) or **Docker Engine + Compose plugin** (Linux)
- ~**4 GB free RAM**, ~**5 GB free disk**
- Ports: **8080** free on the host (change `LOCAL_HTTP_PORT` in `.env` if taken)

---

## Windows (PowerShell)

```powershell
git clone https://github.com/firaolteshale21/MifosProd.git
cd MifosProd
copy .env.example .env
```

Open `.env` in an editor and replace each `CHANGE_ME_LOCAL` with your own value, e.g.:
```
POSTGRES_PASSWORD=localdevpass_change_me_123
FINERACT_DB_PASS=localdevpass_change_me_456
FINERACT_MASTER_PASSWORD=localdevmaster_change_me_789
```
> Tip to generate a random value in PowerShell:
> ```powershell
> -join ((48..57)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
> ```

Start the stack:
```powershell
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs -f
```

Open in a browser:
```
Frontend     : http://localhost:8080
Backend/API  : http://localhost:8080/fineract-provider/api/v1
Health       : http://localhost:8080/fineract-provider/actuator/health
```

Stop:
```powershell
docker compose -f docker-compose.local.yml down
```

Reset (wipe local DB volume):
```powershell
docker compose -f docker-compose.local.yml down -v
```

---

## Linux / macOS

```bash
git clone https://github.com/firaolteshale21/MifosProd.git
cd MifosProd
cp .env.example .env
chmod +x scripts/*.sh
./scripts/local-up.sh
./scripts/local-healthcheck.sh
```

`local-up.sh` copies `.env.example` → `.env` (if needed), auto-generates secure local
passwords for the `CHANGE_ME_LOCAL` placeholders, and starts the stack.

Helper scripts:
```bash
./scripts/local-logs.sh [service]   # tail logs (db | fineract | webapp | proxy)
./scripts/local-down.sh             # stop (keep data)
./scripts/local-reset.sh            # stop + wipe local DB volume (asks to confirm)
./scripts/backup-db.sh              # dump DBs to ./backups/<timestamp>/
./scripts/restore-db.sh backups/<timestamp>
```

---

## First boot

Fineract builds ~280 tables via Liquibase on first start. Expect the health check to show
`WARNING`/`NOT READY` for the first **3-6 minutes**, then `PASS`. Re-run:
```bash
./scripts/local-healthcheck.sh
```
or watch:
```bash
docker compose -f docker-compose.local.yml logs -f fineract
```

## Default login
| Field | Value |
|---|---|
| Tenant | `default` |
| Username | `mifos` |
| Password | `password` |

**Change the password right after the first login.**

## Changing the port
Edit `LOCAL_HTTP_PORT` in `.env` (e.g. `9090`) and set `FINERACT_API_BASE=http://localhost:9090`
to match, then `docker compose -f docker-compose.local.yml up -d`.

## Troubleshooting
See [`MAINTENANCE.md`](MAINTENANCE.md#troubleshooting).
