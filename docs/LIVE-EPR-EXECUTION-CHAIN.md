# Live EPR Execution Chain

Status: implemented in GitHub `main` as the next transactional slice beneath the Live EPR Transaction Core.

## Scope

The EPR traveller can now be extended with durable records for:

1. Material and lot traceability — material code, lot, supplier, certificate reference, quantity and disposition.
2. Process operations — operation code/name, workstation, operator, status and production record reference.
3. Quality inspections — dimensional, interface, NDT, cosmetic, structural and ISO 4210 result records.
4. NCR/CAPA — severity, containment, root cause, corrective action, owner and closure reference.
5. Inventory movements — reserve, issue, return, consume and adjustment transactions linked to the traveller and venture.

All write handlers require authenticated Command admin access and verify the traveller's venture before mutation. The records are keyed back to the controlled traveller so the serial genealogy can be built without mixing Carbon and Aluminium ventures.

## Deliberate boundary

This slice creates the software transaction layer. A database row is not physical evidence. It does not by itself prove material certificates, process completion, dimensional acceptance, NDT, cosmetic acceptance, structural testing, ISO 4210 compliance, NCR closure, or pilot release.

The next release work is to expose these transactions in the Live EPR UI, add append-only audit entries to each new transaction, connect approved inventory/COGS movements, and then close the Phase 6A evidence gates using actual serial-linked records.
