# VYNDI IBPE Workbook v5 ↔ Runtime Parity — Stage 1

**Controlled workbook:** `docs/VYNDI_36_Month_Integrated_Business_Operating_Model_v5_Operational_Execution_Governance.xlsx`  
**Workbook SHA-256:** `2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7`  
**Runtime engine:** `src/lib/integrated-business-planning-engine.ts`  
**Runtime authority:** `src/lib/ibpe-authority.ts`

## Outcome

Stage 1 closes two material runtime-input gaps identified during workbook/runtime reconciliation:

1. SKU supply-planning parameters (lead time, MOQ and order multiple) are now available to the governed IBPE input instead of defaulting to zero/one inside the engine.
2. Workbook v5 work-centre standards now create explicit 36-month capacity constraints for the governed IBPE instead of reporting `capacityAuthority: not-configured-explicitly-optional`.

The changes are planning authority only. They do not post inventory, create purchase orders, reserve stock, release production, or write accounting actuals.

## Added planning authorities

### `vyndi_supply_planning_parameters`

The migration seeds the 72 SKU rows present in workbook v5 `Component Catalogue`, with workbook provenance on every row.

Fields used by Stage 1 runtime:

- `lead_time_months`
- `moq`
- `order_multiple`

Also retained for parity evidence, but **not applied to runtime cash timing in Stage 1**:

- `payment_lag_months`

All seeded rows are `planning-default`, not supplier-contract truth. Supplier names are not invented.

### `vyndi_capacity_standards`

The migration seeds the eight controlled workbook work centres:

| ID | Work centre | Standard hrs/unit | Available hrs/month | Efficiency |
|---|---|---:|---:|---:|
| WC-010 | Kitting | 0.35 | 160 | 85% |
| WC-020 | Frame / frameset receipt | 0.25 | 160 | 85% |
| WC-030 | Drivetrain assembly | 1.25 | 160 | 85% |
| WC-040 | Cockpit & controls | 0.75 | 160 | 85% |
| WC-050 | Wheel / tyre fitment | 0.60 | 160 | 85% |
| WC-060 | Torque & fit inspection | 0.45 | 160 | 85% |
| WC-070 | Final quality | 0.65 | 160 | 85% |
| WC-080 | Pack & release | 0.40 | 160 | 85% |

Each standard is converted into an IBPE capacity constraint for M1–M36 using:

`capacity units = available hours × efficiency ÷ standard hours per unit`

## Runtime routing after Stage 1

`approved operating plan → demand truth → approved BOM → canonical ATP/reservations → SKU supply controls → time-phased MRP/recommended buy → explicit work-centre capacity → cash/funding → decision packet`

The governed run validation packet now records:

- supply-planning parameter count;
- count of planning-default supply rows;
- payment-lag parameter count and the explicit Stage 1 non-parity status;
- capacity-standard count;
- generated capacity-constraint count;
- planning-input tables separately from transaction-input tables.

## Reproducible parity gate

`scripts/ibpe-workbook-v5-parity.test.mjs` verifies:

1. exactly 72 non-retired supply-planning rows are seeded from workbook v5;
2. all 72 carry the controlled workbook SHA-256;
3. raw-material lead-time overrides match the workbook (frameset 2 months; T700/T800/resin/paint/packaging 1 month);
4. exactly eight work-centre standards are seeded with workbook provenance;
5. lead-time offset drives the IBPE `orderByPeriod`;
6. MOQ/order-multiple logic rounds replenishment correctly;
7. explicit capacity constraints create a capacity shortfall when demand exceeds available units;
8. the planning engine remains advisory and deterministic.

The parity test is included in the repository `npm test` command.

## Known workbook/runtime differences — not silently corrected

Stage 1 is **not** a claim of complete numeric parity. The following differences remain controlled open items:

### WB-PAR-01 — Dashboard ranges stop at old row 69

Workbook v5 still contains dashboard formulas referencing old inventory/procurement ranges, including:

- `Control Dashboard!B10` → `Master Inventory!N4:N69`
- `Control Dashboard!B11` → `Master Inventory!L4:L69`
- `Control Dashboard!B12` → `Procurement Plan!K4:K69`
- `IBPE Control!C7` → `Master Inventory!L4:L69`

The current master/procurement structures extend to row 75. These formulas should be repaired in a workbook v5.1 revision or converted to structured table references.

### WB-PAR-02 — Dashboard health wording is stale

`Control Dashboard!B11` tests for `<>HEALTHY` while the current inventory health states use the newer controlled status vocabulary. This should be normalized in workbook v5.1.

### WB-PAR-03 — MRP Cash Bridge is aggregate, not SKU-time-phased

Workbook v5 `MRP Cash Bridge` redistributes the 36-month net procurement value across months using each month's gross-material-cost share. It does not independently net every SKU/month.

It also uses global hard-coded timing assumptions in the bridge:

- lead time: 2 months;
- payment lag: 1 month.

The runtime IBPE now consumes SKU-level lead time/MOQ/order multiple from the controlled Stage 1 planning table. Therefore the workbook bridge and runtime procurement timing can legitimately differ until workbook v5.1 replaces the aggregate bridge with the same SKU-level logic.

### WB-PAR-04 — Payment-lag cash timing is not runtime parity yet

Workbook v5 shifts purchase cash using a payment lag. The current runtime engine values analytical procurement at `orderByPeriod`. Stage 1 records `payment_lag_months` for provenance but does not alter runtime cash timing. This remains an explicit Stage 2 decision because changing cash timing changes funding results.

### WB-PAR-05 — Capacity control status is not fully formula-driven

Workbook `Capacity Planning` calculates work-centre load/shortfall, but the capacity status exposed in `IBPE Control` is not yet a complete dynamic reconciliation of the capacity sheet. Runtime now has explicit capacity constraints; workbook v5.1 should expose the same calculated result.

### RT-PAR-01 — Capacity summary semantics

The runtime engine's `capacityShortfallMonths` summary currently counts shortfall constraint rows. With multiple work centres per month, that can exceed the number of unique affected months. A later engine hardening should either rename the metric or count unique periods.

## Stage 1 completion criterion

Stage 1 is complete when:

- migration `0034_ibpe_workbook_v5_parity_authority.sql` applies cleanly;
- the existing IBPE governance test remains green;
- the new workbook-v5 parity test is green;
- build/typecheck confirms the governed runtime input accepts the supply and capacity authorities;
- no transaction-side effects are introduced.

Complete numeric workbook ↔ runtime equality remains a later gate after the workbook v5.1 corrections above.
