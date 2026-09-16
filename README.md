# SACCO — FETAN on Apache Fineract

Local development stack for **FETAN SACCO**: stock **Apache Fineract** + customized **Mifos Web App**, with FETAN screens, seed scripts, and demo users.

No production secrets or customer data are included.

## What this is

| Layer | What runs |
|-------|-----------|
| Backend | Apache Fineract (`apache/fineract:latest`) |
| Frontend | Local Angular web app (`dantel/web-app:local`, built from `frontend/`) |
| Database | PostgreSQL 18.3 (internal only) |
| Proxy | nginx → `http://localhost:8080` |

FETAN work lives mainly in:

- `frontend/src/app/fetan/` — dashboard, contacts, add member, loan queues, receivable  
- `scripts/seed/` — offices, products, roles, reports, contacts, staff/tellers, maker-checker  
- `scripts/demo/` — sample members and loan workflow demo  

## Quick start (Windows)

```powershell
git clone https://github.com/dawitephrem565/SACCO.git
cd SACCO
copy .env.example .env
# Edit .env — replace every CHANGE_ME_LOCAL value

docker compose -f docker-compose.local.yml up -d --build
```

First boot: wait until Fineract is healthy (often a few minutes), then:

```powershell
# Seed FETAN config (roles, products, reports, …)
$env:SEED_USER_PASSWORD = "FetanDev#2026x"
node scripts/seed/seed.mjs

# Optional demo members / savings / shares
node scripts/demo/demo-data.mjs
```

Open **http://localhost:8080** and hard-refresh (`Ctrl+Shift+R`).

### Linux / macOS

```bash
git clone https://github.com/dawitephrem565/SACCO.git
cd SACCO
cp .env.example .env
# Edit .env — replace CHANGE_ME_LOCAL values

docker compose -f docker-compose.local.yml up -d --build

export SEED_USER_PASSWORD='FetanDev#2026x'
node scripts/seed/seed.mjs
node scripts/demo/demo-data.mjs   # optional
```

## Logins (local only)

| User | Password | Role |
|------|----------|------|
| `mifos` | `password` | Super admin |
| `fetan.employee` | `FetanDev#2026x` | Front office (add member, submit loans) |
| `fetan.maker` | `FetanDev#2026x` | Loan committee — approve / disburse |
| `fetan.checker` | `FetanDev#2026x` | Confirms maker actions |
| `fetan.manager` | `FetanDev#2026x` | Oversight / receivable |
| `fetan.teller` | `FetanDev#2026x` | Cash desk |
| `fetan.auditor` | `FetanDev#2026x` | Read-only |

Tenant: **`default`**.  
Test users are created only when `SEED_USER_PASSWORD` is set.

## FETAN features (current)

- Executive dashboard (demographics / savings / shares / loans)  
- Contact directory (view + manage via offices)  
- Add member stepped form (personal + deposit + documents)  
- Loan requests / approval / disbursement queues  
- Two-person control on approve & disburse (maker → checker)  
- Reject loan with required reason  
- Loan receivable (collected vs uncollected)  
- Role-aware sidebar menus  
- Staff / teller seed data  

## Useful commands

```powershell
# Status
docker compose -f docker-compose.local.yml ps

# Logs
docker compose -f docker-compose.local.yml logs -f fineract

# Stop
docker compose -f docker-compose.local.yml down

# Prove loan chain via API
node scripts/demo/loan-workflow.mjs
node scripts/demo/loan-workflow.mjs --populate-queues
```

After frontend changes, rebuild the webapp image (or build Angular locally and copy into the container). RBAC is enabled in `docker-compose.local.yml` (`MIFOS_PRODUCTION_MODE_ENABLE_RBAC=true`).

## Requirements

- Docker Desktop (Compose plugin)  
- ~4 GB free RAM, ~5 GB disk  
- Node.js 20+ (for seed / demo scripts)

## Repo layout

```
SACCO/
├─ docker-compose.local.yml
├─ .env.example
├─ nginx/
├─ database/init/
├─ frontend/                 # Web app (includes app/fetan/)
├─ backend/                  # Fineract source (reference / optional build)
├─ scripts/seed/             # Tenant configuration
└─ scripts/demo/             # Demo data + loan workflow
```

## Notes for collaborators

- Do **not** commit `.env`  
- Local analysis docs under `NewDocs/` are gitignored on purpose  
- Products and rates in seed config are **placeholders** until FETAN provides real numbers  
- Still blocked / not done: dormant-member definition, “loan failed” / share “promised” labels, SMS, external payments, production hardening  

## License

Upstream Fineract / Mifos components keep their original licenses (Apache / MPL as applicable).
