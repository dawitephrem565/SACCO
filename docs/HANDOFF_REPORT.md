# Handoff Report — MifosProd

Local-runnable handoff of the working Apache Fineract + Mifos Web App production stack.

## What was pushed to GitHub
- Local-first Docker Compose stack: `docker-compose.local.yml` (+ `docker-compose.yml`, same content, local-safe)
- `.env.example` (placeholders only), `.gitignore` (blocks secrets/data/artifacts)
- `nginx/local.conf` reverse proxy, `database/init/01-init.sh` (creates empty DBs + user)
- `scripts/` — `local-up`, `local-down`, `local-reset`, `local-logs`, `local-healthcheck`, `backup-db`, `restore-db`
- `docs/` — this report + `LOCAL_SETUP`, `PRODUCTION_STACK_SNAPSHOT`, `MAINTENANCE`, `SECURITY_NOTES`
- `backend/` — Apache Fineract source (`.git`, build artifacts removed)
- `frontend/` — Mifos Web App source (`.git`, `node_modules`, build removed)

## What was intentionally NOT pushed
- ❌ Production `.env` files / real passwords (DB, master, tenant), tokens, keys
- ❌ Production secrets file (`/opt/mifos-deploy/secrets/generated-secrets.env`, root-only on the server)
- ❌ Private keys, `*.pem`, `*.key`, `*.crt`, `*.p12`, `*.jks`, SSH keys, AWS credentials
- ❌ Production / customer / client database data, Docker volumes, DB data dirs
- ❌ `node_modules/`, Gradle/Maven caches, `build/`, `dist/`, `target/`, logs, archives
- ✅ Verified: a scan for the actual production secret values found **0 matches** in the repo.

## Source paths copied from production
| Component | Server path (source of copy) | Repo destination |
|---|---|---|
| Backend | `/opt/mifos-deploy/src/fineract` | `backend/` |
| Frontend | `/opt/mifos-deploy/src/web-app` | `frontend/` |

## Original repos / branch / commit
| Component | Upstream | Branch | Commit |
|---|---|---|---|
| Backend (Apache Fineract) | https://github.com/apache/fineract | `develop` | `d3cba44f7e38f50cffbf5446aae1f1031f312373` |
| Frontend (Mifos Web App) | https://github.com/openMF/web-app | `dev` | `62672df43af7b6bab369a5e97b363f52ed54a209` |

Nested `.git` directories were removed; these are normal source folders now (not submodules),
which is simpler for a snapshot handoff. The provenance above (and `VENDORED_SOURCE.md` in each
folder) lets you re-sync with upstream at the exact commit. The default stack runs the official
published images, so no source build is required.

## How to run locally
**Linux/macOS**
```bash
git clone https://github.com/firaolteshale21/MifosProd.git
cd MifosProd
cp .env.example .env
chmod +x scripts/*.sh
./scripts/local-up.sh
./scripts/local-healthcheck.sh
```
**Windows (PowerShell)**
```powershell
git clone https://github.com/firaolteshale21/MifosProd.git
cd MifosProd
copy .env.example .env
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
```
Full details: [`LOCAL_SETUP.md`](LOCAL_SETUP.md).

## Exact local URLs
| What | URL |
|---|---|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:8080/fineract-provider/api/v1 |
| Health | http://localhost:8080/fineract-provider/actuator/health |

## How to verify locally
```bash
./scripts/local-healthcheck.sh           # PASS/WARNING/FAIL summary

# manual:
curl http://localhost:8080/fineract-provider/actuator/health      # {"status":"UP"}
curl -s -X POST -H "Fineract-Platform-TenantId: default" -H "Content-Type: application/json" \
     -d '{"username":"mifos","password":"password"}' \
     http://localhost:8080/fineract-provider/api/v1/authentication   # authenticated:true
```

## Manual steps required
1. `cp .env.example .env` (Linux/Mac script auto-generates passwords; on Windows edit the
   `CHANGE_ME_LOCAL` values yourself).
2. First boot runs Liquibase migrations (~3-6 min) before health is `UP`.
3. Change the default `mifos` / `password` login after first sign-in.

## Fresh-clone test result
**PASS** — the repo was cloned to a clean directory on the server and started from scratch
(`docker compose -f docker-compose.local.yml up -d`) on port 8080, isolated from the production
stack. Database auto-initialized (`fineract_tenants` + `fineract_default`), the frontend served
on `:8080` with `env.js` correctly pointing at `http://localhost:8080` (no EC2 IP baked in), and
the backend health endpoint returned `{"status":"UP"}` with `mifos` login `authenticated:true`
through the proxy. See the verification block at the end of this report.

## Known issues / notes
- Frontend image tag is `openmf/web-app:dev` (upstream publishes no stable `latest` tag).
- Backend runs the `test,diagnostics` Spring profile (the official image's tested config); it
  enables non-production test features. Fine for local/dev; change for production.
- HTTP only (no TLS) — intended for local dev. See [`SECURITY_NOTES.md`](SECURITY_NOTES.md).
- The vendored `backend/config/docker/aws/etc/credentials` contains only dummy `localstack`
  values (upstream LocalStack test placeholder) — not a real secret.
- Running the stack needs ~4 GB free RAM (Fineract JVM `-Xmx1G` + Postgres).
