# Phase 6A · Authoritative Operating & Control Layer

## Scope
6A establishes the durable control spine for transactions, identity, venture scope and auditability. Phase 5 remains frozen as the management-planning and investor-presentation layer.

## Durable entities
- Sales orders
- Purchase orders
- Production orders
- Immutable inventory movements
- Decisions and decision transitions
- Append-only audit events
- Period closes and monthly snapshots
- Per-user Phase 6A roles

## Control rules
- Every durable operational row is venture-scoped.
- Mutations are server functions protected by `authMiddleware` and role checks.
- Inventory movements and audit events are append-only and can only be reversed by a later event.
- Investor and auditor roles are read-only in the 6A mutation matrix.
- Production with a real `DATABASE_URL` requires real authenticated identity and an assigned Phase 6A role.
- `PHASE6A_BOOTSTRAP_USER_ID` may be set to the first authenticated founder user id to provision the initial founder role; subsequent roles are assigned by a founder mutation.

## Production safety
The Phase 6A service layer refuses to operate against the PGLite fallback when `NODE_ENV=production` and `DATABASE_URL` is missing. `/api/health` returns HTTP 503 in that condition.

## Phase boundary
6A does not yet make approvals prerequisites for operational effects, derive forecasts from actuals, or implement a statutory double-entry ledger. Those are 6B/6C concerns.

## Acceptance checks
1. Authenticated identity reaches every mutating server function through `authMiddleware`.
2. Role permissions are enforced server-side.
3. Orders and inventory movements persist in the database and survive browser refresh / shared sessions when Neon is configured.
4. Audit events are written with actor, role, entity and before/after payloads where applicable.
5. Inventory and audit tables reject update/delete operations.
6. Venture constraints prevent invalid venture ids and cross-venture production links.
7. Production without a real database fails closed at the authoritative layer.
8. Automated tests exercise database constraints and append-only triggers.
