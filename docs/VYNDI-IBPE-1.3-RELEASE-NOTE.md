# VYNDI IBPE 1.3 — Committed-material reconciliation

## Outcome

IBPE 1.3 closes the gap between aggregate planning-BOM demand and the exact material configuration released through production job cards. Procurement, cash, scenario and VIBpE Co-Pilot outputs now share the same governed SKU-month demand basis.

This is a prerequisite release for the Plan → Forecast → Actual → Variance learning loop. It does not claim that WAPE, bias or plan-attainment learning is complete.

## Authoritative flow

1. A confirmed sales order is synchronized to a current configuration-controlled production job card.
2. Released and in-progress job-card lines feed `vyndi_committed_procurement_requirements` by month, SKU and unit.
3. The governed IBPE snapshot preserves two signals:
   - planned material demand exploded through the approved planning BOM;
   - exact committed material demand already exploded by the released job card.
4. The larger quantity governs each SKU-month. The signals are not added, which prevents the same customer demand from being counted twice.
5. ATP, shortages, purchase recommendations, procurement cash and VIBpE Co-Pilot explanations use that reconciled requirement.

## Controls

- A governed run is blocked while a confirmed order has no current job card, a stale sales-order revision, no BOM revision or a non-operating job-card status.
- Exact job-card option SKUs enter the material plan even when they do not appear in the standard planning BOM.
- Controlled procurement-cost coverage includes both active planning-BOM SKUs and exact released job-card SKUs.
- Duplicate committed-requirement identifiers are excluded from aggregation and surfaced as high-severity findings.
- Committed requirements outside the 36-month horizon are surfaced as high-severity findings.
- Stored IBPE 1.2 decision packets are not presented as current; users must create a governed IBPE 1.3 run.
- Scenario demand levers change forecast assumptions but preserve exact committed requirements.
- Scenario Studio exposes the governing demand basis and the planned/exact quantities for each material action.

## Operator sequence

If the readiness strip reports a committed-order projection blocker, reconcile the confirmed order and production job card in `/command/production`. Then create a new governed IBPE run. Use Scenario Studio and VIBpE Co-Pilot only after the 1.3 snapshot is persisted.

## Next build sequence

The next increment should implement the learning loop in this order:

1. immutable forecast vintages tied to approved plan revision and cutoff date;
2. governed period-close rules for demand, revenue, procurement and cash actuals;
3. Plan → Forecast → Actual → Variance facts at one canonical grain;
4. exception thresholds, ownership and audit evidence;
5. WAPE, bias and plan-attainment metrics only after forecast vintage and actual-close semantics are stable.
