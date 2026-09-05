# Phase 3 — Operational ERP & Order-to-Cash / Procure-to-Produce

## Build scope
- Sales orders are captured separately from planning assumptions.
- Purchase orders carry venture, supplier, SKU, quantity, cost and expected receipt month.
- Sales orders can be released into production orders.
- Production has controlled stages through QC and finished/released status.
- Carbon and Aluminium transactions are explicitly venture-scoped.
- Operational records persist for the current command session in browser storage.
- Existing Phase 2 finance remains the authoritative planning/accounting layer; this phase does not fabricate statutory invoices, GST or audited stock valuation.

## Acceptance gates
- Customer → Sales Order → Production → QC → Release chain is visible.
- Supplier → Purchase Order → Receipt status chain is visible.
- Venture separation is enforced in the execution view.
- Controlled dropdown statuses are used for transaction state.
- Command navigation exposes ERP Execution.
- Phase 2 Control Tower remains reachable from the execution layer.
- Regression test covers the new transaction types and route.
- Build once after the complete Phase 3 bundle.

## Next backend layer
Move these browser-persisted records to a transactional backend with authenticated users, immutable inventory movements, BOM consumption, invoice/payment events and audit history before treating the module as an accounting system of record.
