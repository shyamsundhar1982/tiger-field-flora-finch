# Pre-R3 Authority Remediation Gates

Baseline / rollback SHA: `ff7894635e2498ed8e2548d16876517e7659e296`

This branch remediates canonical authority and VIBPE coverage gaps before any R3 UI/page-structure work.

## Protected boundaries

- No navigation redesign.
- No workspace/page ownership redesign.
- No final VIBPE Assurance page.
- No authentication/session/RBAC relaxation.
- No removal of compatibility aliases required by current transactions.
- Existing transaction chain remains protected: Authentication → Demand/Order → BOM/Requirements → Inventory/Procurement → Receiving → Job Card/Traveller → Production → Finance.
- Migrations are additive and backward-compatible unless a later gate explicitly proves a safe cutover.

## Gate sequence

### G0 — Baseline and branch isolation
Pass when:
- branch is created from exact current production `main`;
- rollback SHA is recorded;
- no unrelated files are changed.

### G1 — Product master authority
Pass when:
- Longitude, Latitude and Altitude are persisted as canonical product families;
- controlled variants are persisted and uniquely mapped to the existing compatibility keys (`core`, `pro`, `apex`) without exposing those aliases as the business identity;
- current variant IDs remain resolvable for existing orders;
- regression tests prove product/variant uniqueness and compatibility mapping.

### G2 — Engineering revision / ECR authority
Pass when:
- engineering baselines and ECRs have server-backed canonical persistence;
- revision lifecycle, actor attribution and audit evidence are preserved;
- ECR impact records can reference product family/variant and controlled BOM revision;
- no client-only state is treated as released engineering truth.

### G3 — Quality lineage authority
Pass when:
- inspection, NCR and CAPA records are persisted;
- inspection lineage can reference Job Card, Traveller, SKU/lot and finished-good/unit evidence where available;
- release decisions are auditable;
- VIBPE can distinguish missing quality evidence from passing quality evidence.

### G4 — People & Office authority
Pass when:
- People, payroll inputs, office/facilities, assets, outsourcing and statutory/professional service records are server-backed;
- Finance consumes approved postings/summary views instead of owning duplicate source records;
- client-store values remain compatibility/editing cache only.

### G5 — Dispatch ownership
Pass when:
- shipment/dispatch is explicitly owned by Operations/Fulfilment;
- shipment → invoice → collection lineage remains intact;
- Finance remains downstream owner of invoice/collection, not shipment execution;
- no existing order-to-cash report is broken.

### G6 — VIBPE coverage extension
Pass when:
- VIBPE entity/surface/gate registries cover Product, Engineering, Quality, People & Office, Dispatch and the remaining Finance/Governance authorities;
- coverage gaps are represented as gaps rather than false passes;
- exception detection covers the newly canonical authorities where deterministic checks are possible.

### G7 — Migration and authority regression
Pass when:
- all migrations execute in sequence on the regression database;
- dedicated authority tests pass for G1–G6;
- compatibility aliases and existing transaction reads/writes remain valid.

### G8 — Protected repository regression
Pass when:
- authentication invariant passes;
- route invariant passes;
- route tree/typecheck passes;
- lint passes;
- full test suite passes.

### G9 — Security and provider previews
Pass when:
- CodeQL/security checks pass;
- configured Vercel previews pass;
- configured Netlify previews pass;
- no provider-specific migration/runtime error remains.

### G10 — S5/S6 evidence review
Pass when:
- page-by-page data authority register contains no unresolved duplicate writer for the remediated domains;
- VIBPE coverage status matches real persisted evidence;
- known residual gaps are explicitly documented.

### G11 — Merge and publish
Pass only after G0–G10 are green.
After merge:
- verify exact final `main` SHA;
- verify active production deployments;
- record rollback SHA and unresolved deferred items.

## Stop rule

A failing gate blocks every later gate. Fix on this branch, rerun the failed gate, then continue. Never merge around a failed gate.
