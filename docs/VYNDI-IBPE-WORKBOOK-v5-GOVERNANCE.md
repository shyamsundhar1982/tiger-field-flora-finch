# VYNDI IBPE Workbook v5 — Governance Note

## Controlled artifact

`VYNDI_36_Month_Integrated_Business_Operating_Model_v5_Operational_Execution_Governance.xlsx` is the controlled spreadsheet planning and verification companion to the VYNDI Integrated Business Planning Engine (IBPE).

- Repository path: `docs/VYNDI_36_Month_Integrated_Business_Operating_Model_v5_Operational_Execution_Governance.xlsx`
- Workbook size: 345,425 bytes
- SHA-256: `2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7`
- Planning horizon: 36 months

## Authority boundary

The workbook is a controlled planning, audit, reconciliation and scenario artifact. It does **not** replace canonical transaction truth in the application/database.

Runtime transaction authority remains with governed application workflows and persistence used by the VYNDI business operating system. In particular, a spreadsheet forecast or recommendation must not silently create or mutate:

- purchase orders;
- inventory receipts or issues;
- reservations;
- accounting actuals;
- production releases;
- approved operating-plan revisions.

## Truth classification

The workbook and runtime IBPE must preserve the same semantic separation:

- `PLAN` — approved management intent;
- `FORECAST` — latest expected outcome or analytical recommendation;
- `COMMITTED` — contractually/operationally committed demand or supply;
- `ACTUAL` — posted/realized transaction truth.

## Core business flow

The workbook is intended to reproduce and verify the following controlled flow:

`approved plan → demand → approved BOM → MRP → ATP/reservations → procurement recommendation → governed PO/receipt → production/job material readiness → cash/funding → decision/audit trail`

The workbook also includes operational execution/governance structures for supplier control, purchase requisitions, GRN, FIFO layers/allocations, work-centre capacity, Traveller-linked production readiness and decision provenance.

## Runtime relationship

The spreadsheet should be reconciled against the deterministic runtime planning core in `src/lib/integrated-business-planning-engine.ts` and the governed input/persistence layer in `src/lib/ibpe-authority.ts`.

Where spreadsheet logic and runtime transaction truth disagree, investigate lineage and approval state before changing either source. Do not treat a workbook formula result as proof that a transaction occurred.

## Change control

Any future workbook revision should:

1. preserve one source of truth per business concept;
2. preserve PLAN / FORECAST / COMMITTED / ACTUAL separation;
3. document the workbook revision and SHA-256;
4. verify formula integrity and cross-sheet lineage;
5. reconcile material, procurement and cash effects to the IBPE runtime model;
6. avoid adding parallel finance, inventory, BOM or transaction truth.
