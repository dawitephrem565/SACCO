# FETAN Tenant Seed

Turns an empty Apache Fineract tenant into a configured FETAN system.

Everything FETAN needs configured — branches, dropdown values, chart of accounts,
products, roles, maker-checker rules — is defined in the JSON files under `config/`
and applied by a single command. Nothing is created by clicking through the admin UI.

## Why a script instead of the admin UI

Configuration created by clicking exists in exactly one database. It cannot be
reviewed, cannot be rebuilt after a reset, and has to be redone by hand on every new
environment. Defining it here means a fresh Fineract becomes a working FETAN system
in seconds, every change is visible in git history, and staging and production are
provably identical.

## Requirements

- Node.js 18 or newer (uses the built-in `fetch`; verified on Node 24)
- A running Fineract with the health endpoint reporting `UP`
- No npm dependencies

## Usage

```bash
# Run every step
node scripts/seed/seed.mjs

# Run selected steps only
node scripts/seed/seed.mjs --only offices,codes

# Authenticate and report without writing anything
node scripts/seed/seed.mjs --dry-run
```

### Targeting a different environment

Defaults point at the local stack. Override with environment variables:

| Variable | Default |
|---|---|
| `FINERACT_URL` | `http://localhost:8080/fineract-provider/api/v1` |
| `FINERACT_TENANT` | `default` |
| `FINERACT_USER` | `mifos` |
| `FINERACT_PASSWORD` | `password` |

```powershell
# PowerShell example
$env:FINERACT_URL = "https://staging.example.com/fineract-provider/api/v1"
$env:FINERACT_PASSWORD = "<staging password>"
node scripts/seed/seed.mjs
```

> Never commit real credentials. Pass them as environment variables at run time.

## Safe to run repeatedly

Every step looks for an existing record by its natural key (name, or `glCode` for
accounts) before creating anything. A re-run reports what it found and creates
nothing:

```
0 created   132 already present   0 failed
```

This means a run interrupted halfway can simply be repeated, and adding one new
product to a config file only creates that product.

Output uses three markers: `+` created, `=` already present, `x` failed. A failed
step stops the run, because a partly configured tenant is easier to diagnose than one
where failures were skipped silently.

## Steps

Order matters — later steps reference records created by earlier ones.

| Key | What it creates | Status |
|---|---|---|
| `offices` | FETAN branches under Head Office | ✅ **placeholder branch names** |
| `codes` | 91 dropdown values across 15 categories | ✅ |
| `currencies` | Enables ETB (a stock tenant is USD-only) | ✅ |
| `coa` | Chart of accounts, 62 accounts | ✅ **draft, needs accountant sign-off** |
| `charges` | 6 fees and penalties | ✅ **placeholder amounts** |
| `products` | 2 savings, 1 share, 2 loan products, cash accounting | ✅ **placeholder rates and terms** |
| `roles` | 6 roles + 1 test user each | ✅ |
| `makerchecker` | Two-person control on approval and disbursement | ✅ |

A full run against a seeded tenant reports **170 items already present, 0 created**.

### Step order is deliberate

`currencies` runs before any product, because a product's currency is fixed at
creation and a stock tenant only permits USD.

`makerchecker` runs **last**. Once two-person control is on, configuration changes
themselves become checkable actions and would queue waiting for a second approver.

## The loan committee workflow

FETAN's multi-tier loan approval is implemented entirely by the `roles` and
`makerchecker` steps. There is **no custom backend module and no custom Fineract
image**, because FETAN confirmed that "Check" and "Approve" are one decision made by
two different people rather than three separate sign-offs.

| Stage | Who | Permission | Result |
|---|---|---|---|
| Request | Employee | `CREATE_LOAN` | Loan submitted |
| Make | Committee (Maker) | `APPROVE_LOAN` | Recorded as **pending** — not yet approved |
| Check | Committee (Checker) | `CHECKER_SUPER_USER` | Loan becomes **Approved** |
| Dispense | Maker + Checker | `DISBURSE_LOAN` | Loan becomes **Active** |

`enable-same-maker-checker` is `false`, so a user cannot check their own work.

### ⚠️ Two limitations worth knowing

**Checking is not per-action.** This version of Fineract has no `APPROVE_LOAN_CHECKER`
style permissions — the whole set is absent. The ability to check is the single
special permission `CHECKER_SUPER_USER`, which permits checking *any* pending
command, not just loan approvals. Separating the committee into a Maker role and a
Checker role is therefore what enforces two-person control. If FETAN needs a checker
who can only check loan approvals, that is a genuine gap to raise.

**The UI can misreport a pending approval.** With maker-checker on, the first approval
POST returns success-shaped JSON while the loan is *not yet approved*. Any screen must
show "pending second approval" rather than "Approved". This is verified in Phase 2 of
the build plan and is an operational risk, not a cosmetic one.

## Test users

Created only when `SEED_USER_PASSWORD` is set, so a run against a shared environment
cannot silently create accounts with known credentials.

```powershell
$env:SEED_USER_PASSWORD = "<a strong password>"
node scripts/seed/seed.mjs --only roles
```

| Username | Role | Office |
|---|---|---|
| `fetan.employee` | FETAN Employee | Addis Ababa Main Branch |
| `fetan.maker` | Loan Committee (Maker) | Head Office |
| `fetan.checker` | Loan Committee (Checker) | Head Office |
| `fetan.manager` | FETAN Management | Head Office |
| `fetan.teller` | FETAN Teller | Addis Ababa Main Branch |
| `fetan.auditor` | FETAN Auditor | Head Office |

> Development accounts for the local stack only. Never create these in production.

## How unused Mifos modules are hidden

By omission, not deletion. Groups, centres, collection sheets, remittances, investors
and surveys are simply absent from every FETAN role. The frontend hides what the user
cannot access and the backend refuses the call anyway, so the feature is invisible
without a single line being removed — which keeps upstream updates conflict-free and
makes re-enabling a feature a one-line config change.

## What FETAN needs to correct

The code is finished; the **data is provisional**. These files hold assumptions that
should be replaced with FETAN's real values. Editing the JSON is all that is required
— no code changes.

| File | What to confirm |
|---|---|
| `config/offices.json` | Real branch names, locations and opening dates. Current values are placeholders. |
| `config/chart-of-accounts.json` | ⚠️ **The whole structure.** A conventional SACCO layout, not FETAN's. Needs their accountant. |
| `config/products.json` | ⚠️ Interest rates, loan limits, terms, share unit price, opening balances. All invented. |
| `config/charges.json` | ⚠️ Every fee amount. All invented. |
| `config/code-values.json` | Dropdown wording — ID types, professions, loan purposes. |
| `config/currencies.json` | Whether USD should remain enabled alongside ETB. |
| `config/roles.json` | Whether each role grants the right authority, especially the committee split. |

### The chart of accounts is the one to be careful about

Every transaction files itself into one of these accounts, and the balance sheet and
income statement are built entirely from them. If the structure is wrong and FETAN
operates for months, correcting it is an accounting cleanup of real financial
records, not a code change. This is the single most consequential item in the seed.

Three known open questions:

- FETAN's requirements list "costs" separately from "expenses". This is currently
  modelled as a `Costs` HEADER account (`51000`) under `EXPENSES`, holding the cost of
  funds. Whether FETAN means this, or something else, is unconfirmed.
- Account numbering follows the standard `1xxxx` assets … `5xxxx` expenses convention.
  If FETAN already has a ledger, its existing numbering should be used instead.
- Products use **cash** accounting, which records journal entries when money moves.
  **Accrual** would instead recognise interest as it is earned. Which one FETAN needs
  is an accounting policy decision and changes how every income figure is reported.

## Structure

```
scripts/seed/
├── seed.mjs                 # runner and step registry
├── lib/
│   ├── api.mjs              # Fineract REST client with readable error messages
│   ├── idempotent.mjs       # ensure() — create only if absent
│   └── log.mjs              # console output and the created/present/failed tally
├── steps/                   # one module per step
└── config/                  # the data FETAN reviews and corrects
```

Adding a step means writing one module in `steps/`, one config file, and one entry in
the `STEPS` array in `seed.mjs`.

## Verifying from scratch

The real test is a clean database, since that is what a new environment looks like:

```bash
docker compose -f docker-compose.local.yml down -v   # ⚠️ destroys all local data
docker compose -f docker-compose.local.yml up -d
./scripts/local-healthcheck.sh                       # wait for UP (~3-6 min)
node scripts/seed/seed.mjs
```

Then confirm in the UI at http://localhost:8080 that branches appear under
Organization → Manage Offices, and the chart of accounts under Accounting.
