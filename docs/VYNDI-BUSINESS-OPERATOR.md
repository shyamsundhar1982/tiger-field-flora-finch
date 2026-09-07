# VYNDI Business Operator

This document is the canonical repository-level operating contract for the VYNDI / Vāyú Shastr business execution system.

Treat this repository as a **business operating system**, not merely a web application. Keep business truth, workflow, UI, data, auditability, and deployment aligned. Reduce duplicate surfaces, preserve authoritative records, and make the simplest reliable path the default path for ordinary users.

## Operating principles

1. **One business truth per concept.**
   - Identify the canonical source for inventory, finance, planning, sales, users, engineering, and governance.
   - Do not create a second source of truth when one already exists.
   - Legacy pages may remain for history or compatibility, but keep them out of normal navigation unless explicitly requested.

2. **Trace the complete flow.**
   For every important feature, trace:
   `entry → validation → persistence → business rule → downstream calculation → UI presentation → audit trail → deployment`.

3. **Business semantics outrank UI convenience.**
   Do not make a page look cleaner by breaking provenance, accounting logic, inventory rules, forecasting, approvals, or auditability.

4. **Simplify before adding.**
   When the system feels cumbersome, first consolidate routes, cards, forms, ledgers, navigation, duplicated calculations, and repeated status components.

5. **Evidence before completion.**
   Do not call a feature implemented merely because code exists. Verify the relevant route, data path, state transition, calculations, build, and—when available—the deployed behavior.

6. **Preserve user authority.**
   - Audit/check/review requests are read-only by default.
   - Modify production code only when the user asks to implement, fix, refactor, reorganize, or otherwise change it.
   - Do not merge, deploy, delete data, rotate secrets, or change live infrastructure unless explicitly authorized.

## Task classification

Classify work as one or more of:

- **Audit** — inspect existing implementation and report gaps.
- **Reconcile** — find competing sources, duplicate pages, conflicting calculations, or dead routes and establish the canonical path.
- **Simplify** — reduce navigation, surface count, visual clutter, and redundant controls without losing required capability.
- **Implement** — change repository code or configuration.
- **Verify** — prove an existing or newly implemented user flow end to end.
- **Deploy** — verify or perform repository-to-host deployment when explicitly authorized.
- **Govern** — inspect access, auditability, provenance, approvals, master-data ownership, and controlled change.
- **Model** — evaluate finance, planning, forecasting, sales, inventory, or scenario logic.

For mixed work, handle dependencies in this order:

`reconcile truth → simplify structure → implement → verify → deploy`.

## Repository discovery

Before changing code, inspect enough of the repository to understand:

- repository instructions and contributor rules;
- package manager and framework;
- route tree and navigation;
- business data/constants;
- forms and persistence layer;
- calculations and selectors;
- authentication and role checks;
- tests, CI, build scripts, and deployment configuration;
- relevant recent diffs or pull requests when the task refers to them.

Never infer implementation from screenshots alone when repository evidence is available.

## Business Truth Map

For the affected domain, establish:

| Field | Meaning |
|---|---|
| Business object | Inventory item, scenario, order, milestone, user, funding tranche, etc. |
| Canonical source | File, API, database table, ledger, service, or derived model |
| Input route | Where users create or update it |
| Validation | Required fields and business constraints |
| Persistence | Where the change is actually stored |
| Derived logic | Forecasting, MSL, FIFO, runway, revenue, permissions, etc. |
| Consumer routes | Pages/cards/reports using the value |
| Audit path | How a user can inspect provenance/history |
| Legacy duplicates | Old routes, components, datasets, or calculations |
| Deployment dependency | Environment variables, server APIs, host-specific behavior |

If two surfaces claim to own the same business truth, stop treating them as peers. Determine which is canonical and make the other a view, redirect, adapter, or legacy surface.

## Canonical workspaces

Keep normal navigation centered on these seven workspaces:

- `/command` — Command Centre
- `/command/planning` — 36-month Master Plan
- `/command/engineering` — Engineering
- `/command/operations` — Supply & Production
- `/command/sales` — Commercial
- `/command/financial-cockpit` — Finance
- `/command/governance` — Governance

Do not add another top-level workspace or restore legacy phase pages to primary navigation unless explicitly requested.

## Finance & analytics

Canonical finance is `/command/financial-cockpit`, with Plan, Cash, Balance Sheet, CA Audit, and Scenarios as specialist tabs/routes.

Prefer a driver-based model. Trace assumptions into cash, funding, operating cost, revenue, break-even, income statement, balance sheet, and cash flow.

Check for:

- conflicting assumptions in different files;
- 24-month vs 36-month horizon mismatches;
- manually duplicated totals instead of derived totals;
- scenario cards that show outputs without provenance;
- funding requirements disconnected from milestones;
- balance-sheet or CA/audit views that do not reconcile to the same data.

Keep formulas and assumptions traceable. CA Audit verifies the management model; it does not own a second finance model.

## Strategic planning

Canonical planning is `/command/planning` and uses a 36-month horizon.

Prefer one Master Plan with milestones, owners, dates, dependencies, status, blockers, and decisions.

Separate:

- plan;
- current operating status;
- decisions;
- risks;
- historical/legacy records.

Avoid multiple planning pages that express the same timeline differently.

The Master Plan holds modeled intent. Actual orders, receipts, inventory issues, production job cards, quality records, collections, and accounting transactions belong to operating workspaces. Never present a plan or forecast as an accounting actual.

## Sales & commercial

Canonical commercial workspace is `/command/sales`.

Trace:

`lead/demand → opportunity/order → forecast → production requirement → inventory requirement → cash/revenue`.

Do not allow sales forecasts to become independent numbers that never influence operations or finance.

## Inventory & supply

Canonical normal-user inventory is `/command/inventory`.

Active ledger IDs are:

- `components`
- `raw-materials`
- `tooling`
- `quality`
- `stores-tools`

The Master Inventory should support:

- stock health;
- minimum stock level (MSL);
- forecast status;
- one item-entry point;
- category and ledger assignment;
- component ledger access;
- audit links;
- FIFO where applicable.

Preserve the single-point-entry rule: SKU + name + category + one ledger. Receipts require reference evidence and dated FIFO lots.

MSL, movements, FIFO, and forecast health are rules/columns/views inside the inventory system, not reasons to create competing normal-user truth pages.

Trace item creation all the way to the correct ledger and downstream calculations.

Keep `/command/inventory-legacy` and older control routes subordinate/admin-only as appropriate. Preserve historical data.

## Engineering and BOM

Canonical engineering workspace is `/command/engineering`.

Use controlled product/BOM sources. Do not duplicate component or specification truth across routes. Prefer stable IDs and explicit BOM↔inventory mapping over fuzzy name matching.

## ERP governance

Canonical governance workspace is `/command/governance`.

Check:

- source-of-truth ownership;
- least-privilege roles;
- authorization at both UI and server/data boundaries;
- change provenance;
- user-visible audit paths;
- controlled master data;
- duplicate business objects;
- stale legacy routes;
- environment-specific behavior.

## UX and information architecture

For operating screens:

- show the most important decision first;
- prefer a single canonical page plus tabs/sections over many sibling routes;
- use status cards only when each card answers a distinct question;
- avoid repeated tooltips/popovers that contain identical information;
- do not overlay duplicate popups when adjacent elements describe the same fact;
- keep legacy pages discoverable to maintainers but out of normal user navigation;
- make audit links explicit rather than hiding provenance behind decorative UI;
- preserve consistent typography and semantic hierarchy across modules.

A useful executive page usually answers:

1. What is healthy?
2. What is at risk?
3. What changed?
4. What decision is needed?
5. What action happens next?
6. Where can I inspect the underlying record?

## Implementation method

When source changes are authorized:

1. State the observable outcome.
2. Identify the canonical source and affected consumers.
3. Reproduce or demonstrate the current gap when feasible.
4. Make the smallest coherent change.
5. Avoid unrelated redesign or cleanup.
6. Re-run focused checks after each material slice.
7. Verify the full affected flow.
8. Review the diff for accidental changes, secrets, generated noise, dead imports, duplicated logic, and broken routes.

Use existing repository patterns before introducing new libraries or abstractions.

## End-to-end verification

For a user-flow task, verify the actual sequence, not isolated files.

Example inventory verification:

1. Open canonical inventory route.
2. Confirm the master surface renders.
3. Add an item.
4. Select category and target ledger.
5. Save.
6. Confirm persistence.
7. Confirm it appears in the intended category/ledger.
8. Open the component ledger.
9. Confirm expected inventory records are accessible.
10. Open audit/ledger links.
11. Confirm MSL/forecast/FIFO logic still uses canonical data.
12. Confirm old duplicate inventory routes are hidden, redirected, or clearly marked legacy.
13. Run route/build/type/test checks.
14. If deployment is in scope, verify the deployed route separately.

## Deployment and environment checks

When behavior differs between GitHub, Vercel, Cloudflare, or another host:

- separate source-code state from deployment state;
- identify the exact commit deployed to each host;
- compare environment-variable presence/scope and runtime assumptions without exposing secret values;
- check authentication callback/base URLs;
- check route generation, rewrites, server/API endpoints, and static-vs-server behavior;
- never conclude that a GitHub fix is live until the target deployment is verified.

## Reporting format

For audits, report:

### Outcome
A concise statement of whether the flow is healthy and the biggest issue.

### Findings
Use severity `Critical`, `High`, `Medium`, or `Low`. For each finding include the affected route/module, observed problem, business impact, evidence, and recommended action.

### Canonical structure
State which route/data source remains authoritative and what becomes legacy, redirect, tab, or derived view.

### Verification
List checks actually performed and results.

### Not verified
Explicitly list anything that could not be freshly demonstrated.

For implementation work, additionally report changed files, observable behavior, tests/build checks, and deployment status when applicable.

## Do not

- Add new dashboards merely because the current system feels complicated.
- Create parallel finance, planning, sales, or inventory truth.
- Hide a broken data flow with mock values.
- Treat a successful build as proof of correct business behavior.
- Treat a screenshot as proof of persistence.
- Duplicate values across files when they can be derived from one source.
- Expose secrets.
- Remove legacy data before confirming it is no longer required.
- Change unrelated modules during a focused business-flow fix.
