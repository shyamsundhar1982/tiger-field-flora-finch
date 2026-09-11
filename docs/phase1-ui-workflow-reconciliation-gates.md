# VYNDI Phase 1 — UI Workflow Reconciliation Gates

Baseline main: `03fab9de87204eb4377d88d679a4f80b868bbe37`

This release changes information architecture and presentation only. It must not change canonical
transaction ownership, database write authority, authentication/session behaviour, RBAC, or VIBPE
autonomous-write boundaries.

## G0 — Baseline and parity
- Capture main SHA and existing deployment status.
- No source modification before baseline is known.
- PASS required before G1.

## G1 — Navigation taxonomy and ownership
Primary operating areas:
1. Command
2. Plan & Sales
3. Product & Engineering
4. Operations
5. People & Office
6. Finance & Governance
7. Admin

Requirements:
- one primary owner for each normal user workflow;
- no duplicate active workspace highlighting;
- People & Office is first-class, not a Finance child;
- legacy/compatibility URLs remain reachable but are not primary navigation.

## G2 — End-to-end workflow rail
Canonical user-visible chain:
Demand → Engineering/BOM → Material Check → Procurement → Receiving → Job Card → Traveller →
Production → Quality → Invoice/Collection.

Requirements:
- client-side links only;
- route visibility honours existing RBAC;
- rail is contextual and must not create or mutate business records.

## G3 — People & Office first-class workspace
- sidebar owner: People & Office;
- preserve existing `/command/people-office` route and ledgers;
- downstream Finance consumption is unchanged.

## G4 — Compact operating presentation
- table-first / grouped / collapsed-by-default where touched;
- details expand on demand;
- no forced-width approval controls that break responsive use.

## G5 — Legacy and duplicate surface containment
- hide legacy/duplicate pages from normal primary navigation;
- preserve compatibility routes, redirects, audit access and direct URLs.

## G6 — Protected regression matrix
Must pass:
- auth/session and route invariants;
- demand/order persistence;
- BOM and configuration authority;
- inventory/FIFO;
- procurement and receiving;
- job card / traveller / production / quality;
- finance and People & Office;
- VIBPE advisory boundaries;
- full test suite, typecheck and lint.

## G7 — Provider gates
Required:
- GitHub CI PASS;
- CodeQL PASS;
- active Vercel previews PASS;
- Netlify previews PASS where configured;
- Cloudflare parity checked if an active deployment check/integration is available.

## G8 — Merge and publish
Only after G0–G7 PASS:
- merge PR to main;
- verify final main SHA;
- verify active production deployment;
- record rollback point as the G0 baseline SHA.

True multi-line supplier PO schema consolidation remains a separate Phase 1 migration gate and is not
part of this UI-only release.
