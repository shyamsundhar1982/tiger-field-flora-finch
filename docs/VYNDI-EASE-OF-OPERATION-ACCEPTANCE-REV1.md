# VYNDI Ease-of-Operation Acceptance Standard — Rev 1.0

Status: PREPARATION / NO RUNTIME CHANGE

This document converts the Ease-of-Operation Rev 1.0 proposal into measurable release gates. It supplements, and must not weaken, the canonical business-operator contract in `docs/VYNDI-BUSINESS-OPERATOR.md`.

## 1. Reference viewports

Reuse the established Stage D browser-acceptance viewport set:

- Desktop landscape: `1440×900`
- Tablet / compact landscape: `1180×820`
- Mobile: `390×844`

Do not create a competing viewport standard unless a real customer/device requirement requires it.

## 2. Ease-of-operation release score

The working baseline is 78/100. It is a provisional operator score until instrumented task runs are recorded.

### Weighted scoring

| Category | Weight | Release expectation |
|---|---:|---|
| Navigation and discoverability | 15 | canonical task reachable without menu hunting |
| Workflow clarity / next action | 15 | user can identify the next valid action from state |
| Responsiveness / perceived speed | 15 | immediate click acknowledgement; useful content arrives predictably |
| Session reliability / recovery | 10 | no unexplained logout; recovery returns user to work |
| Data-entry efficiency | 10 | single-entry patterns; no duplicate re-entry of known values |
| Table/readability/information density | 10 | full-view landscape; responsive complete record on narrow view |
| Error clarity and recovery | 10 | business-language cause/impact/recovery instead of raw technical faults |
| Interaction consistency | 5 | common actions behave the same across modules |
| Contextual VIBPE assistance | 5 | explains the current record without bypassing governed execution |
| New-user learnability | 5 | core task can be completed without tribal knowledge |
| **Total** | **100** | |

### Score gates

- `<85`: not yet at commercial ease-of-operation target.
- `85–89`: commercial release UX acceptable, subject to no Critical/High usability blockers.
- `90–92`: premium target.
- `>92`: only award from measured operator evidence; do not inflate score for visual polish.

Any regression in business truth, RBAC, auditability, approval authority, traceability, or governed VIBPE/IBPE execution is an automatic failure regardless of numerical UX score.

## 3. Representative operator journeys

The following journeys are the minimum usability sample. They are not new business workflows; they test existing canonical ownership.

### Founder / executive

1. Enter Command Centre.
2. Understand business health / top exceptions.
3. Open one material exception.
4. Understand impact and recommended next action.
5. Inspect supporting evidence.
6. Enter the owning authorised workflow if action is required.

Acceptance: no duplicated dashboard truth; no unclear “what now?” dead-end; evidence remains inspectable.

### Supply & Production manager

1. Enter Supply & Production.
2. Identify material or production risk.
3. Open affected job/order/requirement.
4. Determine material readiness / commitment impact.
5. Take the authorised next action or escalate.

Acceptance: exception-first path; no need to hunt across legacy production/procurement pages to understand the same fact.

### Stores / inventory operator

1. Enter Master Inventory.
2. Find an SKU.
3. Understand available stock, MSL, health and forecast.
4. Open ledger/audit evidence.
5. Receive or adjust through the correct controlled entry path.

Acceptance: Stock Health is full-view without horizontal scrolling at landscape reference sizes; mobile retains the complete record in stacked/detail form.

### Procurement

1. Enter the owning Supply & Production/procurement execution surface.
2. Identify shortage / supplier commitment gap.
3. Inspect recommended quantity, source and lead-time evidence.
4. Enter authorised purchase execution.
5. Verify the resulting commitment/audit record.

Acceptance: recommendation does not silently become a PO; authority remains explicit.

### Quality

1. Identify inspection/quality/traceability exception.
2. Open affected material/serial/batch.
3. Understand status, containment and next valid disposition.
4. Inspect genealogy/evidence.
5. Record authorised action.

Acceptance: no simplification may hide containment, traceability, release authority, or quality evidence.

### Finance

1. Enter canonical finance.
2. Understand cash / actual / payables / receivables condition.
3. Open an actionable item.
4. Inspect source transaction/evidence.
5. Take authorised action.

Acceptance: finance remains one truth; specialist views cannot become parallel ledgers.

## 4. Navigation acceptance

For regular tasks:

- target <=3 meaningful navigation decisions from the owning canonical workspace;
- legacy/maintenance routes do not appear as peers in normal operator navigation;
- moving between summary → record → authorised action must have a clear return path;
- page names must reflect business ownership, not implementation terminology;
- do not add a new top-level workspace solely for UX convenience.

## 5. Full-view table acceptance

### Landscape

For every migrated canonical operating table at `1440×900` and `1180×820`:

- page-level horizontal overflow <=4 px, matching Stage D tolerance;
- table container itself does not expose a horizontal scrollbar as its normal operating mode;
- complete critical business record remains visible/accessible;
- long narrative fields wrap;
- numeric/date/status/action fields remain compact;
- nested detail is visually linked to the parent row;
- no critical field is hidden solely for fit;
- controls above/beside the table must also fit without forcing the page wider.

### Mobile

At `390×844`:

- no horizontal page/table scrollbar for migrated operating records;
- table may transform into stacked key/value record presentation;
- all business concepts, actions and evidence links remain available;
- reading order and keyboard/focus order remain logical;
- nested detail remains under the owning record.

### Analytical-matrix exception

If a genuine matrix cannot be represented legibly without two-dimensional navigation, document and approve that exception explicitly. Do not let ordinary operational registers inherit matrix behaviour by accident.

## 6. Session and recovery acceptance

- successful authentication returns the user to the requested protected route;
- an authenticated browser context survives normal top-level navigation;
- no unexpected logout during representative journeys;
- if session expiry is genuine, preserve unsaved work where technically possible;
- after re-authentication, return to the intended route/context rather than silently dropping the user at home;
- raw auth/runtime internals are not shown as the primary operator message.

The existing Stage D browser acceptance remains a required regression source for protected-route/session behaviour.

## 7. Error-language standard

Operator-facing errors must answer:

1. **What happened?**
2. **What is affected?**
3. **What can the operator do next?**
4. **Where can evidence/details be inspected?** (when relevant)

Examples of prohibited primary operator messages:

- `Cannot read properties of undefined`
- `packet is undefined`
- `result is undefined`
- raw SQL/driver exception
- raw stack trace

Technical details may remain in diagnostics/logging, but the operator surface must translate them into business recovery language.

## 8. Interaction consistency standard

Where an action has business consequence, converge on:

`Review → Impact → Authorise → Execute → Evidence`

Not every read-only screen requires a modal/window. Do not force the pattern onto simple navigation. Use it where an operator is making or confirming a controlled business action.

The pattern must preserve:

- role/authority;
- source evidence;
- business impact;
- explicit confirmation where required;
- transaction result;
- audit/provenance path.

## 9. Performance / perceived-response budget

The UX target is progressive usefulness rather than waiting for every secondary calculation before showing anything.

### Required behaviour

- every click/action gives immediate visible acknowledgement;
- route shell / primary content appears before secondary analytics when feasible;
- heavy detail is deferred/lazy-loaded if it does not determine the initial decision;
- background work must not block basic navigation unnecessarily;
- loading state must be contextual (what is loading) rather than a blank screen;
- stable master/reference data should not be repeatedly fetched without need.

### Measurement

Record for representative routes:

- navigation start → DOMContentLoaded;
- navigation start → substantive body / first useful content;
- action click → visible acknowledgement;
- heavy secondary data completion;
- payload/request count where material.

Do not claim a performance score improvement without before/after measurements from the same environment.

## 10. Regression command set

The repository already provides the following gates and they remain part of the implementation verification set:

- `npm run lint`
- `npm run typecheck`
- `npm run check:routes`
- `npm run check:auth`
- `npm test`
- `npm run audit:ui` where the required environment is available

Focused Playwright/browser checks should be added for full-view tables rather than weakening existing Stage D checks.

## 11. First pilot — Master Inventory

The first runtime implementation after preparation freeze should be the `/command/inventory` Stock Health register.

Why:

- canonical normal-user inventory surface;
- high operational value;
- current code explicitly uses a horizontal-scroll wrapper and `min-w-[980px]`;
- eight business concepts provide a realistic test of width budgeting, wrapping and narrow-view transformation;
- business logic can remain untouched, isolating UX risk.

The pilot is successful only if the same inventory truth, filters, health logic, forecast logic, ledger/audit links and RBAC remain unchanged.

## 12. Change / rollback discipline

For each implementation slice:

- one coherent UX objective;
- small changed-file set;
- avoid active-conflict paths where possible;
- no opportunistic unrelated cleanup;
- focused test first, full regression before merge;
- commit/PR should be independently reversible;
- record observable before/after behaviour;
- do not merge or deploy without explicit user authorisation.

## 13. Preparation exit checklist

Preparation is complete when all of these are satisfied:

- [x] strength-preservation contract drafted;
- [x] ease-of-operation scoring rubric drafted;
- [x] full-view nested-table standard drafted;
- [x] initial repository horizontal-overflow inventory drafted;
- [x] canonical Master Inventory pilot selected;
- [x] reference viewports aligned to existing Stage D gate;
- [x] representative operator journeys defined;
- [x] regression command set identified;
- [x] rollback/change-isolation discipline defined;
- [ ] active PR #199 resolved or first implementation paths confirmed non-conflicting;
- [ ] implementation branch refreshed from latest `main` immediately before runtime changes.

Until the final two items are true, this work remains preparation-only.
