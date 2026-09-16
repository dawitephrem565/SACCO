# config/

Safe, non-secret configuration templates only. **Never** place real secrets here.

The active configuration for this stack lives in:
- `../.env.example`            → copy to `../.env` (real values, git-ignored)
- `../docker-compose.local.yml` → service environment (non-secret tuning + `${}` from .env)
- `../nginx/local.conf`        → reverse proxy

This folder is reserved for additional safe templates you may add later
(e.g. logging overrides, sample tenant configs). Keep it secret-free.
