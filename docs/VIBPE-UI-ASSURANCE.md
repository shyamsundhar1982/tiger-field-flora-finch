# VIBPE UI Assurance

VIBPE UI Assurance extends the existing Assurance backend with an audit-only front-end capability model.

## Scope

It registers expected UI capabilities, accepts runtime browser observations, projects failures as structured assurance exceptions, and summarizes observed coverage by business domain.

The initial protected workflow coverage includes authentication continuity, Demand & Orders, BOM Control, Inventory, Procurement Planning, Production, Business Action Inbox lifecycle controls, and Control Tower.

## Safety boundary

UI Assurance does not modify canonical sales orders, BOM authority, inventory, procurement, job cards, travellers, shipments, invoices, collections, forecasts, pricing, or supplier selection. The only runtime writes are assurance observations.

## Runtime audit

Use an authenticated Playwright storage-state file and run:

```bash
VIBPE_UI_BASE_URL=https://<deployment> \
VIBPE_UI_STORAGE_STATE=/path/to/storage-state.json \
VIBPE_UI_TARGET=vercel-production \
npm run audit:ui
```

The runner records route reachability, authentication-loop detection, generic application-error detection, and Action Inbox lifecycle-control multiplicity. Failures are available from `/api/vibpe/ui-assurance` and `vyndi_vibpe_ui_assurance_exceptions`.

## Extension model

Add new UI capabilities to `vyndi_vibpe_ui_capability_registry` with route, role, expected behavior and criticality. Browser checks should record observations through the protected API rather than writing business tables directly.
