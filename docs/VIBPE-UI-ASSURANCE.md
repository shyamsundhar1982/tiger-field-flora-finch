# VIBPE UI Assurance

VIBPE UI Assurance extends the canonical Assurance backend merged through PR #102 with a runtime UI evidence layer and a final read-only Assurance page.

## Current authority boundary

Cloudflare is the active deployment authority for this release line. Vercel is non-blocking and out of scope unless it is deliberately restored to the release gate later.

The UI assurance layer does not create a second business authority. Product, Engineering, Quality, People & Office, Dispatch, Finance and the existing transactional domains continue to use their canonical writers and governed lifecycle services.

## Final Assurance page

The final page is available at:

`/command/ibpe-operating-workspace/assurance`

It combines:

- canonical entity, gate, workflow and surface coverage;
- the unified VIBPE exception stream;
- explicit `full` / `partial` / `gap` surface status;
- runtime UI capability observations;
- failing and unobserved UI capabilities;
- approval-gated immutable assurance snapshot capture.

A canonical backend may be `full` while a route remains `gap` until the route binding is actually proved. The page must not manufacture a route-level pass from backend persistence alone.

## Runtime audit

Use an authenticated Playwright storage-state file against the Cloudflare deployment:

```bash
VIBPE_UI_BASE_URL=https://<worker>.workers.dev \
VIBPE_UI_STORAGE_STATE=/path/to/storage-state.json \
VIBPE_UI_TARGET=cloudflare-production \
npm run audit:ui
```

The runner records route reachability, authentication-loop detection, generic application-error detection, and Action Inbox lifecycle-control multiplicity. Runtime observations are written only to `vyndi_vibpe_ui_observations` through the protected `/api/vibpe/ui-assurance` endpoint.

## Assurance semantics

- **Passing** — runtime evidence exists and the most recent observation passed.
- **Failing** — the latest runtime observation failed.
- **Unobserved** — no runtime proof exists yet. This is projected as a warning, not treated as green.
- **Backend full** — canonical backend persistence/service authority is proved.
- **Route gap** — exclusive UI binding to that canonical authority has not yet been proved.

UI failures and unobserved capabilities extend the canonical unified VIBPE assurance exception stream. Snapshot capture therefore records them alongside backend and authority exceptions without modifying protected business records.

## Safety boundary

UI Assurance does not directly insert, update or delete sales orders, BOM authority, inventory, procurement, job cards, travellers, quality releases, shipments, invoices, collections, forecasts, pricing, supplier selection, People & Office source records or Engineering authority. Its only runtime writes are assurance observations and approval-gated assurance snapshots/evidence.
