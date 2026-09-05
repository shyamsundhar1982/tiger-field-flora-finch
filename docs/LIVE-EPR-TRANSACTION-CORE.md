# Live EPR Transaction Core v1

## Status

Implemented on `main` as the first durable transactional slice beneath Phase 6A.

## Scope

The module converts the Phase 6A execution register from client-only working state into server-backed transactions for:

- EPR-04 pilot traveller creation
- venture scope: Carbon / Aluminium
- canonical model identity: Longitude / Latitude / Altitude with internal `core/pro/apex` compatibility IDs
- SKU, BOM revision and engineering revision capture
- unique serial-number capture
- supplier/OEM capture
- EPR-05 through EPR-12 gate status events
- evidence records tied to a traveller and gate
- append-only audit events for durable mutations

## Security boundary

Mutations require the existing authenticated Command session. Viewer sessions remain read-only through the Command shell. EPR mutations execute server-side through `createServerFn` and use parameterized SQL.

## Persistence

Schema is defined in `migrations/003_epr_transaction_core.sql` and uses the repository's existing database abstraction. Production requires the configured persistent database backend; the embedded PGLite path remains a development/preview fallback.

## First operational flow

`Create Traveller → EPR-04 → Start EPR-05 → Record Evidence → Gate Disposition → Audit Event`

The next transaction slices should add material lots, process-operation records, dimensional/NDT/cosmetic inspections, NCR/CAPA, inventory movements and configuration/COGS reconciliation.

## Release rule

A transaction being recorded does not by itself prove physical validation. EPR remains evidence-gated: no final release without objective evidence and controlled disposition.
