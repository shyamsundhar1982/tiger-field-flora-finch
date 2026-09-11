# VYNDI Ledger Operating System Gates

These gates define completion for the day-to-day ledger correction. A green
source test proves repository intent; it does not prove that production has
run the migration or that an authenticated user can see the rows.

## Gate 0 — One source of truth

- Canonical inventory authority is `master_inventory_items`.
- Legacy catalogue reconciliation is idempotent.
- People & Office assets/costs remain in their canonical tables.
- No browser-local ledger is treated as production authority.

## Gate 1 — Correct display

- Registered catalogue rows render independently of receipts.
- Zero balance is displayed as `0`.
- No catalogue item, no transaction, loading, and unavailable are distinct states.
- Office Assets Register is visible on People & Office.

## Gate 2 — Actionable tables

- Operational rows are primary content, not decorative cards.
- Tables expose identity, owner/category, status, balance/value, evidence, and action.
- Search/filter/sort/export are required for high-volume registers.

## Gate 3 — Governed lifecycle

- Add/edit/archive operations preserve canonical authority.
- Domain-specific states are used: draft, approval, receipt, issue, reconcile,
  retire/close.
- Actor, timestamp, reason, revision and audit event remain visible.

## Gate 4 — Production proof

- Latest `main` is deployed by Cloudflare.
- Database migrations are confirmed applied in production.
- Authenticated checks confirm catalogue rows and zero balances are visible.
- Navigation, permissions, responsive tables and stale-route checks pass.

Current evidence is recorded by `scripts/ledger-operating-system-gates.test.mjs`.
Gate 4 requires live deployment evidence and cannot be passed by a local build.
