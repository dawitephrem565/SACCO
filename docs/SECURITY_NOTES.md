# Security Notes

## Secrets were NOT committed
- No production `.env`, passwords, tokens, keys, certificates, or AWS credentials are in this repo.
- The production secrets live only on the EC2 server in a root-only file
  (`/opt/mifos-deploy/secrets/generated-secrets.env`, `chmod 600`) and were never exported here.
- Only `.env.example` (placeholders) is committed. Real `.env` files are git-ignored.
- No production / customer / client database data is included — `database/init/` only creates
  **empty** databases; Fineract builds its schema on first boot.

## How to generate local secrets
`scripts/local-up.sh` auto-replaces every `CHANGE_ME_LOCAL` in `.env` using:
```bash
openssl rand -hex 24
```
Manually (Linux/Mac):
```bash
openssl rand -hex 24
```
Windows PowerShell:
```powershell
-join ((48..57)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```
These local passwords are for development only and are unrelated to the production secrets.

## Why production `.env` is excluded
Committing real database/master passwords would leak access to anyone who can read the repo.
The `.gitignore` blocks `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `*.crt`,
`*.p12`, `*.jks`, SSH keys, `*.sql`/`*.dump` data, and volume/data directories.

## Default application login
Fineract ships a built-in super user: tenant `default`, user `mifos`, password `password`.
**Change it immediately after first login**, in both local and any shared environment.

## Database exposure
- Locally and in production the database has **no published host port** — it is reachable only
  on the internal Docker network. Do not add a `ports:` mapping for `db` unless you intend to
  expose it, and never expose it to the public internet.

## HTTPS / domain recommendation
- This stack serves plain **HTTP** (local `:8080`, production `:80`). Fine for local dev and
  initial testing; **not** acceptable for production/internet use.
- Before production: put a real TLS certificate in front (domain + Let's Encrypt via certbot,
  or an AWS ALB/ACM), serve over **443**, and forward the real scheme. The backend already runs
  HTTPS internally; TLS is terminated at the proxy.

## Before exposing anything publicly
1. Change the `mifos` default password.
2. Enable HTTPS with a real certificate + domain.
3. Restrict inbound firewall / security-group sources to known IPs where possible.
4. Move the backend off the `test,diagnostics` Spring profile (it enables non-production
   test features — see `PRODUCTION_STACK_SNAPSHOT.md`).
5. Rotate any secret that was ever shared, and use a secrets manager.
