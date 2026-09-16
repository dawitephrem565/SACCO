# Production Stack Snapshot

Snapshot of the working EC2 deployment this handoff repo was captured from.
**No secrets are included.** Production passwords live only on the server in a
root-only file (`/opt/mifos-deploy/secrets/generated-secrets.env`) and were never exported here.

## Host
- AWS EC2, Ubuntu 24.04.4 LTS, 2 vCPU / 3.7 GiB RAM (+2 GiB swap added) / 33 GB disk
- Region: eu-central-1
- Deployment dir on server: `/opt/mifos-deploy/` (`runtime/`, `src/`, `secrets/`, `reports/`)

## Stack type
**Modern Apache Fineract + Mifos Web App** (NOT legacy Mifos X / Community App). Deployed with **Docker Compose** using official published images (no source build).

## Running containers

| Container | Image | Role | Host ports |
|---|---|---|---|
| `mifos-db` | `postgres:18.3` | Database | none (internal only) |
| `mifos-fineract` | `apache/fineract:latest` | Core banking API | `127.0.0.1:8443` (loopback only) |
| `mifos-webapp` | `openmf/web-app:dev` | Angular frontend | none (internal only) |
| `mifos-proxy` | `nginx:1.27-alpine` | Reverse proxy | `0.0.0.0:80` (public) |

## Images (approx. sizes)
- `apache/fineract:latest` — ~965 MB
- `postgres:18.3` — ~649 MB
- `nginx:1.27-alpine` — ~75 MB
- `openmf/web-app:dev` — ~71 MB

## Ports / exposure
- **80/tcp** public (nginx) — frontend + API.
- **8443/tcp** bound to `127.0.0.1` only (Fineract HTTPS, for local curl/health).
- **PostgreSQL 5432** — internal Docker network only; never published.
- Host UFW allows only 22 + 80. AWS Security Group `launch-wizard-2` must allow inbound 22 + 80.

## Database
- Engine: **PostgreSQL 18.3** (container `mifos-db`)
- Databases: `fineract_tenants` (tenant registry) + `fineract_default` (default tenant data)
- Superuser: `root`; application user: `postgres`
- Data volume: `mifos_pg_data` (mounted at `/var/lib/postgresql` — PG18 convention)

## Compose files (server)
- `/opt/mifos-deploy/runtime/docker-compose.yml`
- env files (root-only `600`): `runtime/db.env`, `runtime/fineract.env`; non-secret: `runtime/webapp.env`
- `runtime/nginx/default.conf`, `runtime/db-init/01-init.sh`

## Nginx config summary
Single server on :80. `location /fineract-provider/` → `https://fineract:8443` with
`proxy_ssl_verify off` and **`X-Forwarded-Proto: https`** (Fineract forces HTTPS on `/api/v1`
and honors the header; without it the API returns 302 redirect loops). `location /` → `webapp:80`.

## Health / API
- Health: `GET /fineract-provider/actuator/health` → `{"status":"UP"}`
- Tenant header: `Fineract-Platform-TenantId: default`
- Login (JSON body, per FINERACT-726): `POST /fineract-provider/api/v1/authentication` with `{"username":"mifos","password":"password"}`

## Live production URLs
- Frontend: `http://3.67.201.201/`
- Backend API: `http://3.67.201.201/fineract-provider/api/v1`
> The public IP is not an Elastic IP and may change if the instance is stopped/started.

## Source provenance (vendored into this repo)
| Component | Upstream repo | Branch | Commit |
|---|---|---|---|
| Backend | https://github.com/apache/fineract | `develop` | `d3cba44f7e38f50cffbf5446aae1f1031f312373` |
| Frontend | https://github.com/openMF/web-app | `dev` | `62672df43af7b6bab369a5e97b363f52ed54a209` |

The frontend commit `62672df` matches the running `openmf/web-app:dev-62672df` image.

## Custom modifications made during deployment
1. PostgreSQL 18 volume mounted at `/var/lib/postgresql` (not `/var/lib/postgresql/data`) — PG18 dir convention.
2. nginx forwards `X-Forwarded-Proto: https` on the API location to stop Fineract's HTTP→HTTPS 302 loop.
3. Removed the JDWP remote-debug agent from `JAVA_TOOL_OPTIONS` (the official test env ships it).
4. Strong secrets generated with `openssl rand -hex 24`; stored root-only on the server.
5. Backend kept on its self-signed HTTPS internally; TLS terminated at nginx.
6. Added a 2 GiB swap file for JVM headroom.
