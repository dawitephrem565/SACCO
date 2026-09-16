# Vendored backend source

This folder is a copy of the Apache Fineract source used by the production deployment,
with `.git/`, build artifacts, and caches removed.

- Upstream: https://github.com/apache/fineract
- Branch:   develop
- Commit:   d3cba44f7e38f50cffbf5446aae1f1031f312373

The production/local stack runs the official **`apache/fineract:latest`** image by default
(no source build required). This source is here for reference and optional customization
(see the commented `build:` block in `docker-compose.local.yml`). To track upstream:
`git clone https://github.com/apache/fineract && git checkout d3cba44`.
