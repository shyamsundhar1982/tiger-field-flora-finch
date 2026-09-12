# VYNDI Best-in-Class Transformation Audit & Program

**Date:** 2026-09-12  
**Repository:** `shyamsundhar1982/tiger-field-flora-finch`  
**Source baseline:** GitHub `main`  
**Transformation branch:** `transformation/best-in-class-foundation`  
**Purpose:** Advance VYNDI from a strong founder-built vertical operating system into a best-in-class, bicycle-aware planning and execution platform without creating parallel truth or weakening governance.

## 1. Executive conclusion

VYNDI does not need another broad page-building phase. The repository already contains substantial operating authority across demand, sales orders, configuration-controlled job cards, BOMs, inventory/reservations, procurement, receiving/payables, shipment/revenue actuals, engineering revision control, quality lineage, dispatch, IBPE governed runs, VIBPE assurance, UI assurance, action lifecycle and evidence capture.

The principal gap to enterprise planning leaders is now **depth of decision mathematics and execution precision**, not breadth of screens.

The current VIBPE optimiser is a governed scenario-ranking layer: it evaluates candidate scenarios, applies business guardrails and penalties, and ranks the candidates. That is useful decision support, but it is not yet a mathematical constrained optimiser that searches a solution space of material, capacity, supplier, time, cash and service constraints.

The current IBPE scenario laboratory is also real and governed, with lineage back to a governed snapshot. Its scenario variables are intentionally coarse: demand, product demand, aggregate capacity, procurement cost, lead time, receipt delay and cash injection multipliers. The next generation must model individual resources, routings, supplier lanes and competing demand priorities while retaining the existing advisory-only boundary.

## 2. What is already strong and must be preserved

### 2.1 Governed planning truth

- Deterministic, side-effect-free IBPE planning core.
- Explicit `plan`, `forecast`, `committed`, and `actual` truth separation.
- Approved-plan and approved-BOM gates before governed IBPE runs.
- Governed input hash, source SHA and snapshot lineage.
- Recommendations cannot silently become purchase orders, stock reservations, accounting actuals or other transaction truth.

**Decision:** Preserve this architecture. Advanced optimisation must consume governed truth and return advisory proposals into the existing approval/action system.

### 2.2 Scenario and decision intelligence

- Governed scenario lab already exists.
- Product-family demand overrides exist.
- Capacity, cost, lead-time, receipt-delay and funding scenarios exist.
- VIBPE candidate ranking already applies funding, liquidity, capacity and exception guardrails.

**Decision:** Evolve this into a two-stage planning architecture:

1. deterministic scenario/reconciliation layer; and
2. mathematical constrained optimisation layer.

The optimiser may propose. Existing governance must approve and transact.

### 2.3 Rough-cut capacity planning

The repository already stores controlled work-centre planning standards with:

- work-centre ID and name;
- traveller operation;
- sequence;
- monthly available hours;
- efficiency; and
- standard hours per unit.

IBPE converts those standards into a 36-month capacity envelope.

**Decision:** Do not replace this. Promote it into the master resource model and progressively add finite-resource attributes.

### 2.4 Transaction and traceability chain

The migration and application layers contain substantial operating authority spanning:

- canonical sales/production;
- inventory ATP/reservations/FIFO;
- production job cards;
- production record linkage;
- shipment and revenue actuals;
- procure-to-pay;
- procurement cost authority;
- production-batch procurement response;
- EPR traveller/material/process/quality lineage;
- engineering revision authority;
- quality lineage authority;
- dispatch operations;
- issued-material fulfilment; and
- VIBPE assurance remediation.

**Decision:** Future planning features must integrate into these existing authorities rather than introducing competing writers.

### 2.5 Assurance and CI

The repository has route/auth invariant checks, typecheck, lint, broad business tests, VIBPE backend/UI assurance, migration testing and CodeQL workflow coverage.

**Gap:** `main` is currently not protected and required status checks are not enforced at the GitHub branch level. CI exists, but repository governance does not force every change through it.

## 3. External benchmark — capabilities to match selectively

This program uses current enterprise planning leaders as capability references, not as a requirement to clone their full ERP breadth.

### SAP IBP benchmark

Target capabilities worth adopting:

- multilevel material/network planning;
- constrained feasible planning;
- finite capacity and supplier constraints;
- alternate sourcing;
- cost-based optimisation;
- scenario comparison;
- planning-run explainability; and
- separation of planning from execution release.

SAP documents both finite heuristic and optimizer approaches and a mixed-integer linear programming optimisation model for cost-optimised production, procurement and distribution planning.

### Oracle Fusion Supply Chain Planning benchmark

Target capabilities worth adopting:

- material and resource constraints;
- supplier capacity;
- alternate suppliers/resources/work definitions;
- demand prioritisation;
- backlog re-planning;
- planning-to-execution release; and
- production scheduling tied to current operating conditions.

### Kinaxis Maestro benchmark

Target capabilities worth adopting:

- concurrent impact propagation;
- rapid scenario comparison;
- planning/execution feedback loops;
- constraint-aware production schedules;
- explainable trade-offs; and
- governed agentic assistance over one shared operational model.

## 4. Capability audit

| Capability | Current VYNDI assessment | Target | Priority |
|---|---|---|---|
| Truth separation / lineage | Strong | Preserve and harden | P0 |
| Scenario planning | Strong coarse-grained scenario engine | Resource/supplier/order-level scenarios | P0 |
| Optimisation | Candidate scoring/ranking | Mathematical constrained optimisation + heuristic fallback | P0 |
| Rough-cut capacity | Work-centre monthly units derived from hours/efficiency | Resource calendars + finite scheduling | P0 |
| Material planning | BOM/MRP/ATP/receipts/MOQ/order multiple | Time-phased multilevel constrained material plan | P0 |
| Supplier planning | SKU planning parameters and supplier evidence exist | Supplier lanes, capacities, alternates, OTIF/quality/risk/landed cost | P0 |
| Production execution | Job cards, traveller operations, lineage | Governed routing master + finite schedule + actual-vs-standard learning | P0 |
| Order promise | Demand/job-card linkage | ATP + capable-to-promise under material/capacity constraints | P1 |
| Demand forecasting | Plan/forecast/committed/actual + confidence | Forecast accuracy, bias, model/backtest framework when history supports it | P1 |
| Inventory optimisation | ATP, reservations, safety/MSL | Dynamic safety stock/service-level policy and multi-location later | P1 |
| Quality | Strong lineage/assurance foundation | SPC/CAPA/supplier-quality metrics where data exists | P1 |
| Finance | Strong management planning/cash/funding | Integrate statutory accounting rather than duplicate full ledger ERP | P1 |
| Integrations | Internal APIs and deployment integrations | Governed integration/event layer for accounting, supplier, logistics, commerce | P1 |
| Enterprise IAM | App RBAC/auth exists | MFA/SSO/SoD/access certification as organisation grows | P1 |
| Reliability | CI and migrations are robust | SLOs, observability, restore drills, performance and production smoke gates | P0 |
| Source governance | CI exists | Protected `main`, required checks, PR-only production changes | P0 |
| Multi-site network planning | Not required now | Add only when VYNDI operates multiple stocking/production nodes | P2 |

## 5. Target architecture

### Layer A — Canonical transaction truth

Existing authoritative ledgers and workflow writers remain the only source of transaction truth.

### Layer B — Governed planning snapshot

IBPE assembles approved plan, demand, BOM, inventory/ATP, committed supply, capacity, finance and funding into a reproducible snapshot.

### Layer C — Advanced planning model

Normalize the governed snapshot into explicit decision entities:

- demand priorities;
- inventory/material balances;
- routing operations;
- work centres, machines, tools and labour resources;
- resource calendars/capacities;
- supplier lanes and supplier capacities;
- lot sizes and order multiples;
- lead times and validity windows;
- alternate resources/sources;
- cost/working-capital parameters; and
- service-level and lateness penalties.

### Layer D — Planning algorithms

Provide pluggable algorithms over the same model:

1. deterministic reconciliation;
2. priority/finite heuristic;
3. mathematical constrained optimiser; and
4. scenario perturbation/re-optimisation.

No algorithm writes transaction truth directly.

### Layer E — VIBPE decision orchestration

VIBPE explains:

- what changed;
- which constraints bind;
- what customer/financial/production outcomes are affected;
- alternative feasible actions;
- why one option ranks above another; and
- confidence/evidence/lineage.

### Layer F — Governed approval and execution

Approved actions flow to their owning existing workspaces for transaction creation. Execution actuals flow back into the next governed planning snapshot.

## 6. Transformation program

### Phase 0 — Control the transformation

1. Freeze this audit and target architecture.
2. Use a dedicated branch and PR for each transformation slice.
3. Preserve current IBPE/VIBPE behaviour until replacement capability passes parity tests.
4. Protect `main` and require CI/CodeQL checks before merge.
5. Add explicit release evidence for Cloudflare production smoke, database persistence and authentication continuity.

**Exit:** no best-in-class work bypasses repository governance or existing business authorities.

### Phase 1 — Advanced constraint model

Create one machine-readable planning contract for resources, routings, supplier lanes, demand priority and objective weights. Add invariant validation. Do not introduce a solver yet.

**Exit:** the model can represent current work-centre standards and future finite constraints without changing current production decisions.

### Phase 2 — Resource and routing authority

Extend work-centre standards into governed resources and routings:

- calendars/shifts;
- operation-resource eligibility;
- setup/run time;
- yield/scrap;
- tooling and labour skill constraints;
- alternate resources; and
- effective dates/revisions.

Tie EPR traveller actual operations back to routing operations.

**Exit:** one bicycle can be represented as a time-phased, resource-consuming route.

### Phase 3 — Supplier intelligence authority

Add governed supplier lanes:

- approved supplier + SKU;
- lead time;
- MOQ/order multiple;
- unit/landed cost;
- monthly/period capacity;
- reliability/OTIF;
- quality performance;
- alternate-source rank;
- currency and validity; and
- evidence/approval metadata.

**Exit:** shortages can be evaluated against real alternate supply options instead of only aggregate SKU assumptions.

### Phase 4 — Feasibility engine

Implement a deterministic finite heuristic first:

- demand prioritisation;
- material feasibility;
- supplier feasibility;
- resource feasibility;
- lead-time feasibility;
- cash guardrails; and
- order-promise calculation.

**Exit:** VYNDI can produce a feasible plan or explain precisely why no feasible plan exists.

### Phase 5 — Mathematical optimiser

Introduce a solver adapter only after Phase 4 parity is proven. Initial objective hierarchy:

1. protect hard governance and configuration constraints;
2. minimise committed-demand non-fulfilment;
3. minimise lateness;
4. respect operating-reserve/cash guardrails;
5. minimise expedite/procurement/production cost;
6. minimise excess inventory and unstable schedule changes.

Expose binding constraints and objective contributions for explainability.

**Exit:** VYNDI searches the feasible decision space rather than ranking only hand-generated scenarios.

### Phase 6 — Concurrent replanning

Build an event-driven invalidation/replan mechanism so significant changes in demand, supply, inventory, capacity, quality holds or cash can trigger advisory impact recalculation while preserving approval gates.

**Exit:** one change visibly propagates through customer promise, material, supplier, capacity, cash and management exceptions.

### Phase 7 — Production scheduling and capable-to-promise

Add day/shift/resource scheduling where operational scale justifies it. Integrate latest feasible dates into sales promise management.

### Phase 8 — Forecast intelligence

Only after sufficient operating history exists, add forecast-error measurement, bias, segmentation and model backtesting. Machine learning must earn authority through measured out-of-sample performance; it must not replace governed demand truth by assertion.

### Phase 9 — Enterprise hardening

- SLOs and telemetry;
- backup/restore evidence;
- failure injection/recovery drills;
- load/performance tests;
- production smoke suite;
- IAM maturity/SoD;
- external integration contracts;
- data retention and operational runbooks.

## 7. Non-negotiable invariants

1. **One truth:** no parallel demand, BOM, inventory, cost, supplier, capacity or finance authority.
2. **Planning is advisory:** optimisation cannot silently transact.
3. **Evidence before status:** no gate becomes green from UI state alone.
4. **Lineage:** every plan/recommendation identifies source snapshot and model/algorithm version.
5. **Explainability:** a recommendation must expose the binding constraints and business trade-off.
6. **Human approval:** irreversible procurement, production, finance and customer-commitment actions remain governed.
7. **Backward compatibility:** current governed IBPE remains available until advanced planning demonstrates parity and superiority.
8. **Vertical advantage:** prioritise capabilities that make VYNDI exceptional for bicycle product/configuration/manufacturing operations; do not clone irrelevant horizontal ERP breadth.

## 8. First implementation slice

The first code change under this program is deliberately preparatory and non-invasive:

- add a typed advanced-planning constraint contract;
- add validation for IDs, horizons, resource references, supplier lanes, capacities, routing order, numeric bounds and objective weights;
- add tests;
- do **not** connect it to production writers or alter existing IBPE results.

This creates the stable seam required for finite heuristics and a later mathematical optimiser without destabilising the governed operating system.

## 9. Success definition

VYNDI will be considered best-in-class for its intended scope when it can take a governed change such as a new order, supplier delay, quality hold, capacity loss or funding constraint and, from one shared truth:

1. propagate the impact end-to-end;
2. calculate feasible alternatives;
3. optimise the trade-off under explicit constraints;
4. explain the recommendation and evidence;
5. route the decision for approval;
6. execute through the owning workspace; and
7. learn from actual outcomes without corrupting historical truth.

The objective is not to become a smaller SAP. It is to become a **faster, governed, bicycle-aware operating and decision system whose depth in its chosen vertical exceeds what a generic platform provides out of the box.**
