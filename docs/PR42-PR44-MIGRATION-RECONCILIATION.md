# PR42 / PR44 migration reconciliation

This patch exists because PR #44 introduced the governed procurement-cost authority before PR #42 was merged. PR #42 then appended `job_card_id` and `auto_generated` to `vyndi_purchase_orders` and attempted to `CREATE OR REPLACE` a pre-existing `select p.*` status view. PostgreSQL correctly rejected the resulting view-column shift (`supplier_name` -> `job_card_id`).

The reconciliation does two things:

1. Before the PR #42 production migration runs, it conditionally drops the dependent purchase-order views only when that migration has not already been applied. This supports both the deploy migrator and the PGLite CI harness.
2. After PR #42 runs, it restores `vyndi_open_purchase_orders` and replaces `approve_vyndi_production_batch` so automatic draft PO shells use `vyndi_procurement_cost_authority` only. Catalogue / `legacyPriceInr` values are never treated as procurement cost. Missing governed cost remains a zero-value draft placeholder that cannot be submitted until a positive controlled supplier price is supplied.

No IBPE recommendation is promoted to an approved or issued PO by this patch. Existing maker-checker and supplier-approval controls remain in force.
