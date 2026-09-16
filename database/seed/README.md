# database/seed/

No production, customer, or client data is included in this repository.

Fineract creates its full schema automatically via Liquibase on first boot, so no seed
is required to run the stack. If you need demo data, add **sanitized** files here named
`*.sanitized.sql` (only those are allowed past `.gitignore`). Never commit real data dumps.
