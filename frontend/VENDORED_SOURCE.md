# Vendored frontend source

This folder is a copy of the Mifos Web App source used by the production deployment,
with `.git/`, `node_modules/`, and build artifacts removed.

- Upstream: https://github.com/openMF/web-app
- Branch:   dev
- Commit:   62672df43af7b6bab369a5e97b363f52ed54a209  (matches the openmf/web-app:dev-62672df image)

The stack runs the official **`openmf/web-app:dev`** image by default. To build your
customized frontend instead, uncomment the `build:` block under the `webapp` service in
`docker-compose.local.yml` and run `docker compose -f docker-compose.local.yml up -d --build`.
