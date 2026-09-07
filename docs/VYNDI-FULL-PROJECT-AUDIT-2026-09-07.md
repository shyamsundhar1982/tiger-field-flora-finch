# VYNDI Business Operator — Full Project Audit

**Audit date:** 7 September 2026  
**Repository:** `shyamsundhar1982/tiger-field-flora-finch`  
**Branch inspected:** `main`  
**Source commit inspected:** `d658d6a78f9b2a7034461743c1c3b89b3669361d`  
**Audit standard:** `docs/VYNDI-BUSINESS-OPERATOR.md`  
**Status:** Partial — strong navigation consolidation, incomplete business-truth consolidation

## Outcome

The project is now materially cleaner as an interface and its product catalogue correctly preserves Longitude, Latitude and Altitude variants while showing zero-stock items. The system is not yet a single coherent ERP, however. The largest risk is **data fragmentation across browser storage and two independent server-side inventory systems**.

There are no source-confirmed Critical findings. There are seven High findings that can produce conflicting operational or financial decisions.

## Executive priority

| Priority | Required correction | Reason |
| --- | --- | --- |
| 1 | Unify Master Inventory and EPR inventory into one ledger truth | Normal receipts and production shortages currently read different persistence models |
| 2 | Persist sales orders centrally and make the job card a synchronized projection | Prevent customer commitments from diverging from production |
| 3 | Generate released production BOMs from approved BOM revisions and mappings | Protect Engineering → Procurement → Production traceability |
| 4 | Implement transactional reservation and live shortage calculation | Prevent several orders from claiming the same stock |
| 5 | Centralize finance, actuals, actions and planning revisions | Give every authorized user the same company truth and audit history |
| 6 | Reconcile plan demand and committed demand in procurement and finance | Preserve both forecast and execution without silently substituting one for the other |
| 7 | Derive route ownership and ERP flow from one canonical workspace map | Prevent architectural drift and reintroduced clutter |

## Business Truth Map

| Business object | Current input | Current persistence / source | Rules and consumers | Audit state | Verdict |
| --- | --- | --- | --- | --- | --- |
| Product families and variants | Product/range and Commercial selectors | `src/lib/data/models.ts`, `src/lib/data/company.ts` | Longitude / Latitude / Altitude; variant groupset rules in `product-configuration.ts` | Git history only | Coherent catalogue, not a controlled released product master |
| Configurable component catalogue | Range, Commercial, Master Inventory seed | `SEED_INVENTORY`; copied into `master_inventory_items` | Model eligibility flags, category, rate; seed quantity forced to zero | Git history plus inventory item timestamps | Catalogue semantics corrected; duplicate representations remain |
| Authoritative inventory | Master Inventory entry and issue forms | `master_inventory_items`, `master_inventory_lots`, `master_inventory_issues` | MSL, 36-month item demand, FIFO | Lot, reference and issue records | Canonical UI is sound, but not the inventory source used by job-card shortages |
| EPR inventory | Admin openings, EPR movements | `epr_inventory_*` and `epr_authoritative_inventory_balance` | Mapping gate, FIFO layers, COGS and EPR execution | `epr_audit_events` | Strong control model, but competes with Master Inventory |
| Sales order | Commercial page | Browser `localStorage` key `veloxis-sales-orders-v1` | Revenue/order calculations and one-time job-card creation | None | Not acceptable as shared ERP truth |
| Production job card | Automatically from Commercial | `epr_production_job_cards` and lines | Variant configuration, SKU requirement, shortage snapshot | Creator/time only; no change-event ledger | Server-backed but stale after order edits and not mapping-controlled |
| Procurement plan | Procurement Planning actions | Static base financial model plus `epr_procurement_plan_actions` | 36-month MSL fence, RFQ/approval/PO statuses | Action timestamps | Plan is traceable, but committed demand remains a separate queue |
| Finance assumptions and scenarios | Finance pages | Zustand persist key `veloxis-planning-state` | 36-month financial model and cockpit | None | Browser-local management truth |
| Actuals | Actuals and Sales pages | Browser `localStorage` key `veloxis-actuals-v1` | Finance control, variance, collections | None | Browser-local and not accounting-grade |
| Planning actions/status | Planning and action pages | Zustand/browser persistence and static datasets | Milestones, actions, finance state | None or Git history | Useful planning interface, not multi-user controlled state |
| Users and roles | `/command/users` | Better Auth tables and `vindy_user_roles` | Admin-only CRUD and server-side role checks | Created/updated timestamps; limited explicit audit events | Functionally strong; legacy shared-password access remains |
| Controlled BOM mapping | Admin BOM mapping page | `epr_bom_inventory_mappings`, approved master data | Active revision/SKU mapping gate | EPR audit events | Strong control exists but Production does not consume it |
| Governance decisions/evidence | Governance and EPR pages | Mixed static data and EPR database records | Roles, approvals, EPR gates, NCR/CAPA, evidence | Strongest in EPR, weak elsewhere | Uneven coverage |
| Deployment | Git commit and host build | GitHub → Vercel/Cloudflare configuration | Environment-specific auth, database and server runtime | Host status not inspected in this audit | Not verified live |

## Findings

### HIGH 1 — Canonical Master Inventory and production shortages use different stock truths

**Affected modules:** `src/lib/master-inventory.ts`, `src/lib/inventory-authority.ts`, `src/lib/production-job-card.ts`, `/command/inventory`, `/command/procurement`.

The canonical Master Inventory saves receipts and issues in `master_inventory_*`. Production job-card availability and configured-demand procurement shortages query `epr_authoritative_inventory_balance`, which is built from the separate `epr_inventory_*` ledger.

**Business impact:** a user can receive stock through the normal Master Inventory page and still see zero availability against a customer order. Conversely, EPR opening balances may not appear in the canonical Master Inventory health view.

**Recommendation:** nominate one physical inventory ledger. Prefer making the canonical Master Inventory UI an adapter over the controlled EPR ledger, or make EPR execution consume the master ledger. Do not synchronize by periodic copying; post every receipt, reservation, issue and return through one transactional service.

### HIGH 2 — Historical catalogue seed lots can preserve fictitious stock

**Affected module:** `src/lib/master-inventory.ts`.

The catalogue helper now forces all seed quantities to zero and no longer creates new positive seed lots. However, `ensureComponentCatalogue()` uses `on conflict do nothing` and does not reverse previously created `component-seed-*` lots. Environments initialized before this correction may retain the earlier planning quantities as inventory.

**Business impact:** production and inventory reports may continue to show stock that was never physically received.

**Recommendation:** provide a reviewed, idempotent migration that identifies only system-created `catalogue-seed` lots, reports their impact, and reverses/removes them without touching user-entered receipts. Require an explicit backup/approval before applying to production data.

### HIGH 3 — Sales orders remain browser-local and job cards become stale

**Affected modules:** `/command/sales`, `src/lib/finance/sales-engine.ts`, `src/lib/production-job-card.ts`.

Sales orders are held in browser local storage. Job-card creation is database-backed but returns immediately when the `sales_order_id` already exists. Month and quantity edits do not synchronize the existing card, and cancellation does not cancel it or its shortages.

**Business impact:** two users can have different order books; a 10-unit order changed to 20 units can leave Production at 10; cancelled demand can continue driving procurement.

**Recommendation:** create server-backed sales-order header, line, configuration and status-history tables. Update the order and its demand projection in one database transaction. Treat job cards as controlled releases from the current committed order revision.

### HIGH 4 — Production does not consume the approved BOM/mapping authority

**Affected modules:** `src/lib/production-job-card.ts`, `src/lib/product-configuration.ts`, `src/lib/epr/final-control.ts`, `/command/bom-control`, `/command/bom-inventory-mapping`.

The project has an approved BOM→SKU mapping system, but configured job cards validate against the static source catalogue and create their own SKU lines. Legacy orders still fall back to the static cost BOM and fuzzy text staging.

**Business impact:** Engineering can approve a new BOM revision while Production continues using code constants or customer configuration choices that were never released as an executable BOM.

**Recommendation:** a released job card must reference an approved product variant, approved BOM revision and active BOM-line→SKU mappings. Customer options should select an approved configuration rule; they should not replace the engineering BOM.

### HIGH 5 — Stock reservation is a label and snapshot, not a transactional control

**Affected module:** `src/lib/production-job-card.ts`, migration `013_configured_order_requirements.sql`.

Availability is read independently for each line when a job card is created. Existing job-card demand/reservations are not deducted. A line may be marked `reserved`, but no reservation transaction or allocation is posted. Shortages are stored snapshots and are not recalculated after receipts, issues, order edits or cancellation.

**Business impact:** multiple orders can claim the same stock, procurement shortages become stale, and the displayed issue status overstates control.

**Recommendation:** add a reservation ledger keyed by order revision/job card/SKU/unit. Lock the stock row or use an atomic allocation function, subtract active reservations from available-to-promise, and derive shortage dynamically. Release reservations on cancellation and convert them to FIFO issue allocations during kitting.

### HIGH 6 — Finance, actuals, actions and planning state are browser-local

**Affected modules:** `src/lib/store.ts`, `/command/actuals`, `/command/sales`, `/command/financial-cockpit`, `/command/finance-control`.

Management assumptions, scenarios, accounting assumptions, BOM overrides and actions persist under `veloxis-planning-state`; actuals use `veloxis-actuals-v1`. These values feed canonical executive pages.

**Business impact:** authorized users can view conflicting company plans and actuals with no central revision, approver or audit history. Clearing a browser can remove the apparent business record.

**Recommendation:** centralize versioned assumptions, approved scenario, monthly actuals and action status. Keep browser state only for drafts, filters and caches. Actuals should originate in controlled accounting/operating transactions and reconcile to statements.

### HIGH 7 — Procurement has separate planned-demand and committed-demand queues

**Affected modules:** `src/lib/data/procurement-planning.ts`, `src/lib/procurement-authority.ts`, `/command/procurement`, `/command/procurement-planning`.

The 36-month procurement forecast is always generated from the base modeled scenario and static mix. Configured order shortages now appear in Procurement, but are a separate table and do not reconcile with the planning forecast or procurement actions.

**Business impact:** forecast purchases, confirmed-order requirements and actual receipts can produce contradictory recommended quantities and cash timing.

**Recommendation:** show planned requirement, committed requirement, current stock, active reservations, open PO, net requirement and variance by SKU/month. Preserve the forecast and commitment distinction, then derive one approved action quantity.

### MEDIUM 8 — Route ownership and ERP-flow metadata describe an older architecture

**Affected modules:** `src/lib/page-metadata.ts`, `src/lib/erp-flow.ts`, `src/components/command-shell.tsx`, `src/lib/route-ownership.test.ts`.

Finance ERP flow points to compatibility route `/command/finance` instead of canonical `/command/financial-cockpit`. The canonical Master Plan and Governance are absent from the flow. Route ownership covers only selected routes, while its completeness test checks only entries already present. Hand-maintained workspace context sets overlap.

**Business impact:** the visible seven-workspace design and the metadata used to govern it can drift, allowing future duplicate navigation and ambiguous ownership.

**Recommendation:** define one canonical workspace/route ownership registry and derive navigation, ERP flow, access metadata and coverage tests from it. Test every registered business route, not only existing ownership entries.

### MEDIUM 9 — User access has two identity models

**Affected modules:** `src/lib/command-access.ts`, `src/lib/vindy-users.ts`, `/command/users`.

Better Auth identities and `vindy_user_roles` are the stronger path and the User Creation link is now directly visible to administrators. A legacy shared-password session can still grant named operational roles without a stable user identity.

**Business impact:** actions performed through the compatibility login can be attributed only to a role, weakening individual accountability.

**Recommendation:** retain legacy login only for a time-bound migration window. Show its active status to administrators, log its use, and remove it after all operators have individual Better Auth accounts.

### MEDIUM 10 — Audit coverage is inconsistent outside EPR

**Affected modules:** Sales, Master Inventory, production job cards, finance/planning store, EPR control modules.

EPR mapping, openings and evidence have explicit audit events. Sales has none; finance/planning has none; production cards have creator/timestamps but no revision events; Master Inventory has transaction records but no uniform business event register.

**Business impact:** management cannot reconstruct who changed a commitment, assumption, status or configuration across the full flow.

**Recommendation:** adopt a shared append-only audit event contract with entity type, stable entity ID, revision, action, actor user ID/role, before/after or structured payload, source reference and timestamp.

### MEDIUM 11 — Legacy brand terms remain in active source data

**Affected modules:** finance defaults, inventory catalogue brands, market survey, legal and engineering presentation content.

`COMPANY.brand` correctly identifies VINDY and the UI root replaces some legacy text at runtime, but many active source constants still say VéLOXIS/Veloxis. Internal storage keys may remain for backward compatibility; customer-facing and business-record labels should not depend on runtime text replacement.

**Business impact:** exports, server-rendered data, audits and future UI components can expose a superseded identity.

**Recommendation:** classify each occurrence as historical evidence, compatibility key or active label. Preserve historical references and storage keys, but migrate active labels to VINDY explicitly.

### MEDIUM 12 — Current full test gate is not green

`npm test` produced 195 tests: 185 passed and 10 failed. Failures are in platform share-card/PWA expectations, Nitro `serverDir` wiring expectations and an auth-schema migration-plan assertion. These failures pre-date the audited business-flow change based on prior recorded runs, but they remain unresolved release evidence.

**Business impact:** the repository cannot currently use a simple green full-suite gate to establish release readiness.

**Recommendation:** separate/update obsolete platform-template expectations or restore the required platform wiring. Do not suppress the tests without confirming current platform contracts.

### LOW 13 — Source formatting obscures review history

Several older routes and data files are densely single-line formatted, while recently edited files were expanded by the formatter. This produces large diffs for small semantic changes.

**Business impact:** reviewers have more difficulty isolating material business changes and detecting accidental edits.

**Recommendation:** make one explicit formatting-only baseline commit after functional work is stable; thereafter enforce formatting in CI.

## Canonical target structure

| Domain | Canonical route | Canonical data owner | Subordinate views |
| --- | --- | --- | --- |
| Command | `/command` | Derived exception/read model | Control Tower, founder/board views |
| Planning | `/command/planning` | Versioned 36-month plan | Scenarios, funding and procurement-plan views |
| Engineering | `/command/engineering` | Approved product + BOM revision + mappings | BOM cost editor, BOM control, validation |
| Supply & Production | `/command/operations` | One inventory ledger + orders/job cards/reservations | Master Inventory, Procurement, Production, Quality, EPR |
| Commercial | `/command/sales` | Server-backed opportunity/order revisions | GTM and market evidence |
| Finance | `/command/financial-cockpit` | Versioned assumptions + posted actuals | Cash, Balance Sheet, CA Audit, Scenarios |
| Governance | `/command/governance` | Identity, approvals and append-only audit events | Risk, Legal, QA, Actions |

Compatibility and historical routes should remain redirects, read-only evidence, specialist tabs or admin-only surfaces. They should not own an independent editable truth.

## Recommended implementation sequence

1. Reconcile and migrate the two inventory ledgers; include a report-only pass for historical seed lots.
2. Add central sales-order tables, configuration revisions and status history.
3. Make job-card release consume approved BOM revisions/mappings and synchronize order changes.
4. Add atomic reservations, available-to-promise and FIFO conversion.
5. Reconcile committed demand into procurement plan/PO actions and finance cash timing.
6. Move finance assumptions, actuals, actions and plan revisions to central persistence.
7. Consolidate route ownership/ERP metadata and remove runtime active-brand substitution.
8. Close the platform test-gate failures and perform authenticated browser tests on the deployed targets.

## Verification performed

- Read repository and embedded VYNDI Business Operator instructions.
- Compared the attached audit of `b20dc2a` with current commit `d658d6a`.
- Inspected route registry, ownership tests, command shell and ERP flow.
- Traced product/variant configuration into Commercial, job-card lines and Procurement shortages.
- Traced canonical Master Inventory entry/receipt/issue persistence and EPR authoritative inventory separately.
- Inspected controlled BOM→SKU mapping approval and EPR audit controls.
- Inspected Better Auth roles, User Creation and legacy command-session behavior.
- Searched all source routes for browser-local persistence, 24/36-month references and legacy brand usage.
- Focused product configuration tests: **2 passed, 0 failed**.
- Development build and TypeScript check: **passed**.
- Focused ESLint: **0 errors, 4 warnings**.
- Full test suite: **185 passed, 10 failed** (platform/template failures described above).

## Not verified

- No production database was queried or changed; existing seed-lot quantities are therefore a confirmed migration risk, not a measured production balance.
- No authenticated end-to-end browser flow was run against Vercel or Cloudflare.
- No live deployment commit, environment-variable scope, auth callback or Cloudflare database binding was verified.
- Full production `npm run build` including remote/production database migration was not run during this audit.
- The local correction commit could not be pushed through the workspace HTTPS remote because no GitHub credential was available; deployed state must not be inferred from this local audit.

## Final verdict

**Specification health: Partial.** The model/variant/zero-stock correction is represented in source, but the complete order-to-stock flow is not yet authoritative because inventory, order and reservation truth are fragmented.

**Engineering quality: Partial.** Build/type evidence is positive and controlled EPR foundations are strong. Release readiness remains blocked by the seven High findings, missing deployed-flow verification and the non-green full test suite.
