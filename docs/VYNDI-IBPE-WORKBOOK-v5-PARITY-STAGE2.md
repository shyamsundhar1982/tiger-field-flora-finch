# VYNDI IBPE Workbook v5 ↔ Runtime Parity — Stage 2

**Controlled workbook:** `docs/VYNDI_36_Month_Integrated_Business_Operating_Model_v5_Operational_Execution_Governance.xlsx`  
**Workbook SHA-256:** `2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7`  
**Runtime core:** `src/lib/integrated-business-planning-engine.ts`  
**Runtime parity adapter:** `src/lib/ibpe-runtime-parity.ts`  
**Governed authority:** `src/lib/ibpe-authority.ts`

## Outcome

Stage 2 closes the two controlled runtime gaps explicitly left open by Stage 1:

1. `payment_lag_months` now changes analytical procurement cash timing and therefore liquidity/funding results.
2. `capacityShortfallMonths` now means unique affected months rather than the number of constrained work-centre rows.

These changes remain planning/advisory only. They do not create purchase orders, reserve inventory, release production, post accounting actuals, draw funds, or approve a plan.

## Payment-lag cash timing

The governed input snapshot now contains:

```text
runtimeControls.paymentLagBySku
```

The map is populated from `vyndi_supply_planning_parameters.payment_lag_months` and is therefore included in the stable `input_hash` and persisted `input_json`.

For every recommended SKU purchase:

```text
requirement period
  → lead-time offset
  → orderByPeriod
  → payment-lag offset
  → analytical cash-payment period
```

Example:

```text
Requirement: M4
Lead time: 2 months
Order by: M2
Payment lag: 1 month
Analytical procurement cash: M3
```

A payment that falls after M36 is not pulled back into M36. It is recorded in runtime parity metadata as `deferredProcurementBeyondHorizonLakh`, preserving the 36-month planning boundary without pretending the obligation disappears.

## Reproducibility

Payment-lag controls are embedded in the governed snapshot before hashing. Runtime does not query a newer payment-term table after the snapshot is persisted.

Therefore:

```text
approved plan revision
+ canonical transaction snapshot
+ supply/capacity planning controls
+ payment-lag controls
= deterministic input hash
= reproducible governed IBPE result
```

The governed engine version is advanced to `VYNDI-IBPE-1.1.0` so Stage 2 results cannot be mistaken for Stage 1 results under the persistence idempotency key.

## Capacity summary semantics

Stage 1 generated one capacity constraint per work centre per month. The detailed capacity result continues to preserve every work-centre row.

Stage 2 changes only the executive summary semantic:

```text
capacityShortfallMonths
= count(distinct period where any work centre has shortfallUnits > 0)
```

Runtime parity metadata separately exposes:

- `capacityShortfallConstraintRows`
- `capacityShortfallUniqueMonths`

This preserves detailed bottleneck evidence while making the executive KPI match its name.

## Scenario and VIBpE Co-Pilot routing

The Scenario Studio now executes through the same Stage 2 runtime parity adapter as governed baseline runs.

The operating path is:

```text
approved plan
→ canonical demand/orders/actuals
→ approved BOM/SKU mapping
→ ATP/reservations/open POs
→ lead time/MOQ/order multiple/payment lag
→ MRP and recommended buy
→ work-centre capacity
→ payment-timed procurement cash
→ liquidity/funding
→ decision packet
→ Scenario Studio / VIBpE Co-Pilot
```

Scenario changes remain hypothetical forecast analysis. They never overwrite actual, committed or approved-plan truth.

## Reproducible parity gate

`scripts/ibpe-workbook-v5-parity.test.mjs` now verifies:

1. the controlled workbook still seeds 72 supply-planning rows and eight work-centre standards;
2. lead time drives `orderByPeriod`;
3. MOQ/order multiple rounds recommended replenishment correctly;
4. a one-month payment lag moves analytical procurement cash one month after the order period;
5. two constrained work centres in one month produce two detailed constraint rows but one `capacityShortfallMonths` month;
6. a payment pushed after M36 is excluded from active-horizon cash and exposed as a deferred beyond-horizon obligation.

## Remaining controlled differences

Stage 2 is still **not** a claim of complete 32-sheet numeric parity.

### WB-PAR-01 — Workbook dashboard ranges

Workbook v5 contains old row-69 dashboard references while current inventory/procurement structures extend to row 75. This requires a controlled workbook v5.1 repair or structured-table conversion.

### WB-PAR-02 — Workbook health vocabulary

`Control Dashboard!B11` still uses stale `HEALTHY` wording relative to the newer controlled inventory-health states. Workbook v5.1 should normalize it.

### WB-PAR-03 — Workbook MRP Cash Bridge remains aggregate

Workbook v5 redistributes aggregate procurement value using gross-material-cost share and global timing assumptions. Runtime is now more granular: SKU-level lead time, MOQ/order multiple and payment lag. Exact workbook/runtime cash equality therefore requires the workbook bridge to be upgraded to the same SKU-time-phased method rather than weakening runtime back to the aggregate bridge.

### WB-PAR-05 — Workbook capacity control presentation

Runtime capacity is formula-driven from the eight controlled work-centre standards, but workbook `IBPE Control` does not yet expose a fully equivalent dynamic reconciliation of the capacity sheet.

## Stage 2 completion gate

Stage 2 is complete only when:

- the Stage 2 parity tests pass;
- existing IBPE governance tests remain green;
- build/typecheck passes;
- the governed authority persists `runtimeControls.paymentLagBySku` inside hashed input JSON;
- Scenario Studio uses the same Stage 2 adapter;
- no transaction-side effects are introduced;
- a deployment/build check succeeds on at least one connected target.

Browser-level authenticated interaction of Scenario Studio and VIBpE Co-Pilot remains a separate verification gate from build success.
