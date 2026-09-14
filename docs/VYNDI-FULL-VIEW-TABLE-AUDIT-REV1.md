# VYNDI Full-View Table Audit — Rev 1.0

Status: PREPARATION / NO RUNTIME CHANGE

Purpose: identify current horizontal-scroll table patterns, prioritise canonical operator surfaces, and define the first migration order for the Ease-of-Operation Rev 1.0 programme.

## 1. Confirmed canonical pilot

### `/command/inventory` — Master Inventory

Current implementation in `src/routes/command/inventory.tsx` uses:

- an `overflow-x-auto` wrapper around the Stock Health register;
- a `min-w-[980px]` table;
- eight visible columns: Item, Ledger, Available, MSL, Health, Plan/mo, 36-mo forecast, Audit.

This is a canonical normal-user workspace and therefore the preferred first pilot for the shared full-view table pattern.

### Proposed full-view treatment

Desktop / landscape (`1180×820`, `1440×900`):

- remove forced horizontal scrolling;
- use the full available content width;
- keep all eight business concepts visible;
- allow Item and Forecast to wrap vertically;
- keep numeric columns compact and right aligned;
- keep status compact but readable;
- keep Audit action directly accessible;
- do not move critical values into hover-only UI.

Narrow viewport:

- transform each inventory record into an integrated stacked record;
- retain Item, Ledger, Available, MSL, Health, Plan/mo, Forecast and Audit;
- do not require a horizontal scrollbar;
- do not create a separate duplicate inventory page.

## 2. Initial repository-wide horizontal-overflow inventory

A default-branch search for `overflow-x-auto` identifies at least the following surfaces requiring review:

### Canonical / high-priority operator surfaces

1. `src/routes/command/index.tsx` — Command Centre.
2. `src/routes/command/inventory.tsx` — Master Inventory (confirmed separately; canonical pilot).
3. `src/routes/command/engineering.tsx` — Engineering.
4. `src/routes/command/operations.tsx` — Supply & Production.

### Operational subordinate / specialist surfaces

5. `src/routes/command/procurement.tsx` — procurement operating surface.
6. `src/routes/command/quality.tsx` — quality operating surface.
7. `src/routes/command/actuals.tsx` — finance actuals/forecast specialist surface.
8. `src/routes/command/cash.tsx` — cash specialist surface.
9. `src/routes/command/funding.tsx` — funding specialist surface.
10. `src/routes/command/risk.tsx` — risk/governance specialist surface.

### Legacy, specialist, administrative, or reconciliation candidates

These must be classified against canonical ownership before any migration. Do not spend UX effort on obsolete/duplicate surfaces merely because they contain a scroll wrapper.

11. `src/routes/command/inventory-truth.tsx`
12. `src/routes/command/manufacturing.tsx`
13. `src/routes/command/technical.tsx`
14. `src/routes/command/product.tsx`
15. `src/routes/command/gtm.tsx`
16. `src/routes/command/classification.tsx`
17. `src/routes/command/knowledge.tsx`
18. `src/routes/command/ai-knowledge.tsx`
19. `src/routes/command/investor-board.tsx`
20. `src/routes/inventory.tsx`
21. `src/components/inventory-workspace-nav.tsx` — horizontal navigation strip; review separately from data tables.

This list is an initial search inventory, not a claim that every listed surface should be retained or migrated.

## 3. Migration decision rule

For every identified table/surface:

1. Confirm whether the route is canonical, subordinate, admin-only, or legacy.
2. If canonical: migrate to the shared full-view pattern.
3. If subordinate: migrate only if it remains part of the intended operator flow.
4. If legacy/duplicate: prefer hiding, redirecting, adapting, or leaving maintainers-only according to the business-operator contract rather than polishing it as a peer workspace.
5. Never create a new page solely to avoid fitting an existing table.

## 4. Proposed shared table contract

The implementation should use one shared responsive primitive or a very small family of primitives with the following properties:

- full container width;
- `min-w-0` containment throughout parent layouts;
- no default horizontal overflow wrapper;
- deterministic column width budget on landscape;
- wrapping for narrative fields;
- compact numeric/date/status columns;
- responsive stacked detail below the legibility threshold;
- nested detail remains immediately under and visually linked to the parent record;
- keyboard and screen-reader semantics preserved;
- actions and evidence links remain role-authorised and directly accessible;
- no data hiding solely for fit.

Candidate names (implementation choice only, not yet frozen):

- `OperationalDataTable`
- `ResponsiveDataTable`
- `FullViewTable`

The implementation should reuse existing repository patterns and should not introduce a new table library unless a concrete deficiency in the current stack requires one.

## 5. First pilot acceptance matrix — Master Inventory

| Test | Required result |
|---|---|
| 1440×900 | Stock Health register fits the content area with no horizontal scrollbar |
| 1180×820 | Same; all eight business concepts remain available |
| 390×844 | Complete record shown as stacked/detail presentation with no horizontal scrollbar |
| Search/filter controls | Remain usable without forcing page overflow |
| Long item name/SKU/category | Wrap safely without widening the page |
| Large quantities/currency-like values | Remain readable and aligned |
| Health badge | Remains visible and legible |
| Forecast text | Wraps or compacts without clipping |
| Audit action | Remains directly reachable |
| RBAC | No permission change |
| Persistence/business logic | No change |
| Ledger/audit linkage | No change |

## 6. Proposed implementation order after prep freeze

1. Build shared responsive full-view table foundation and focused tests.
2. Convert `/command/inventory` Stock Health as the representative canonical pilot.
3. Verify all reference viewports and regression behaviour.
4. Convert Command Centre / Engineering / Operations tables in small batches.
5. Convert still-active subordinate Procurement / Quality / Finance specialist tables.
6. Reconcile legacy/specialist surfaces before deciding whether they deserve migration.

## 7. Conflict isolation

Active PR #199 currently changes:

- `scripts/vibpe-ui-assurance.test.mjs`
- `src/lib/vibpe-assurance.ts`
- `src/lib/vibpe-ui-assurance.ts`
- `src/routes/__root.tsx`
- `src/routes/command/ibpe-operating-workspace_.assurance.tsx`

The table preparation branch must avoid these paths until PR #199 is resolved or the branches are deliberately reconciled.

No merge, deployment, or runtime implementation is authorised by this audit document itself.
