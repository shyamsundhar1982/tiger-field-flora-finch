# VYNDI Phase 1 — UI Workflow Reconciliation R2

Baseline production SHA: `b9cff4e823cafa2a9fe3891ec34ed8f623f5a7ab`
Rollback point: same SHA.

This release corrects the incomplete information-architecture work from PR #93. It is an additive/read-model/UI release only unless a gate explicitly says otherwise. Canonical transaction ownership, authentication/session behavior, RBAC, database truth, and VIBPE autonomous-write boundaries are protected.

## Governing user workflow

The normal operating journey is:

**Plan → Demand/Order → Engineering/BOM → Material Check → Procurement → Receiving → Job Card → Traveller → Production → Quality → Shipment → Invoice → Collection**

Users should be able to follow that journey without remembering which historical module owns the next page. Every specialist transaction still executes only in its canonical owning workspace.

## G0 — Baseline and evidence map
PASS requires:
- `main` SHA captured before changes;
- active production deployment status captured;
- current workspace/page ownership inspected;
- screenshots/reports mapped to concrete gaps;
- no production mutation.

Observed R1 gaps to eliminate:
- Operations is still presented internally as “Supply & Production”.
- People & Office still identifies itself as a Finance operating ledger.
- Finance and Governance share a sidebar label but not one internal workspace navigation.
- workflow rail is not consistently visible across relevant workflow pages.
- Command Centre is dominated by founder/program controls rather than daily operational control.
- users still have to mentally correlate order, job card, shortages, PO/GRN, traveller and order-to-cash records.

## G1 — Single information-architecture contract
PASS requires:
- one canonical primary workspace owner for each route;
- one canonical workflow-stage definition used by the shell and lineage views;
- no duplicate primary workspace highlighting;
- existing URLs remain compatible;
- no auth/RBAC changes.

Primary workspaces:
1. Command
2. Plan & Sales
3. Product & Engineering
4. Operations
5. People & Office
6. Finance & Governance
7. Admin

## G2 — Consistent workflow rail
PASS requires the canonical chain to be visible on all relevant operational pages, including:
- Master Plan / Demand & Orders
- Engineering / BOM
- Operations overview
- Procurement / Receiving / Inventory
- Production / Job Card / Traveller
- Quality
- Receivables / order-to-cash

The rail is read-only navigation. It must not post or mutate records.

## G3 — Operations becomes the actual operating hub
PASS requires:
- page title and copy use “Operations”, not “Supply & Production”;
- tabs are organized by execution sequence: Overview, Requirements, Purchase, Receiving, Inventory, Build & Genealogy, Quality;
- exception lists are compact/table-first;
- one read-only order lineage register links current records by business object;
- specialist controls remain the only write owners.

## G4 — Order lineage / one business object view
PASS requires a read-only register that, per confirmed order, shows only evidence that actually exists:
- Sales Order + revision
- current Job Card + revision/status
- controlled BOM revision / material requirement status
- shortage count
- linked PO IDs/statuses (if any)
- GRN IDs / accepted receipt status (if any)
- Traveller IDs/statuses (if any)
- Shipment IDs (if any)
- Invoice IDs (if any)
- Collection IDs / collection completion (if any)

No missing record may be fabricated. Missing stages must display “Not yet recorded” / equivalent and link to the owning workspace.

## G5 — People & Office becomes first-class
PASS requires:
- page identity changes from “Finance · operating ledgers” to “People & Office · operating administration”;
- People/Payroll, Office/Facilities, Statutory/Professional, Outsourcing, Assets/Equipment are clearly grouped;
- large editable ledgers are collapsed by default with summary totals;
- Finance is described as a downstream consumer, not the owner;
- current OPEX authority logic is preserved exactly.

## G6 — Finance & Governance is genuinely unified
PASS requires one internal top navigation across both finance and governance routes:
- Finance Overview
- Cash
- Payables
- Receivables
- Balance Sheet
- CA Audit
- Approvals
- Risk
- Legal & IP
- Audit & Actions

Planning assumptions/scenarios belong to Plan & Sales or secondary tools; they must not make Finance appear to own company planning.

## G7 — Command becomes Today’s Control Room
PASS requires Command to lead with:
- Today / operational status
- Exceptions
- Decisions / Action Inbox
- workflow status / operating areas
- ERP Reports / VIBPE briefing

Founder/program milestone controls remain available but are moved below the day-to-day control surface or collapsed as secondary governance.

## G8 — Table-first / progressive disclosure standard
PASS requires touched high-volume lists to follow:
**summary → grouped/compact table → expand on demand → full owning workspace**.

No approval/action controls may be hidden behind forced-width tables on normal desktop/tablet layouts.

## G9 — Legacy/duplicate containment
PASS requires:
- legacy/compatibility routes remain reachable for audit/direct links;
- they are hidden from normal primary navigation;
- no duplicate source of truth is created;
- canonical owner is explicit in route metadata/tests.

## G10 — Protected regression suite
Must pass:
- auth/session invariant
- route invariant
- demand/order persistence and revision
- BOM/configuration authority
- inventory/FIFO
- procurement/receiving
- job card/traveller/production
- quality routing
- shipment/invoice/collection
- finance/accounting
- People & Office OPEX authority
- VIBPE advisory boundaries
- TypeScript/typecheck
- lint
- full test suite

## G11 — Provider / preview gates
Required before merge:
- GitHub CI PASS
- CodeQL PASS
- active Vercel previews PASS
- configured Netlify previews PASS
- Cloudflare parity checked if an active deployment check/integration is available

## G12 — Merge, production publish, smoke evidence
Only after G0–G11 pass:
- merge PR to `main`;
- record final SHA;
- verify active production deployments on final SHA;
- smoke-check navigation, workflow rail, Operations lineage, People & Office, Finance & Governance, and Command;
- report rollback point and any remaining Phase 1 items.

## Explicit non-goals
This corrective UI release must not:
- change authentication/session/RBAC semantics;
- alter Demand → BOM → Inventory → Procurement → Job Card → Traveller → Production → Finance transaction authority;
- add autonomous learning or autonomous procurement;
- silently change plan/BOM/MSL/pricing/supplier data;
- implement supplier multi-line PO schema migration (tracked separately);
- claim quality lineage where no persisted order/job-card-linked quality evidence exists.
