# VYNDI Ease-of-Operation Enhancement Plan — Rev 1.0

Status: PREPARATION / NOT IMPLEMENTATION RELEASE

Owner intent: improve day-to-day ease of operation without weakening VYNDI business depth, governance, auditability, ERP/MES controls, VIBPE/IBPE advisory discipline, RBAC, traceability, or canonical business truth.

## 1. Baseline and target

- Current ease-of-operation baseline: 78/100 (working estimate to be instrumented and re-measured).
- First commercial usability target: >=85/100.
- Premium target: 90–92/100.
- Improvement must come primarily from simpler operator paths, faster response, predictable interaction patterns, resilient sessions, business-language recovery, and better screen composition — not from removing business controls.

## 2. Non-negotiable preservation rules

The following are acceptance gates for every UX change:

1. Do not remove or bypass business rules to make a screen appear simpler.
2. Do not bypass RBAC, approval gates, audit events, transaction authority, source evidence, or provenance.
3. VIBPE/IBPE remains advisory unless an existing governed transaction explicitly authorises execution.
4. Do not create parallel business truth, duplicate ledgers, duplicate calculations, or duplicate canonical workspaces.
5. Role-specific presentation may filter emphasis, but must not alter underlying truth or authorised drill-down evidence.
6. Performance optimisation must not serve stale operational truth in place of current canonical data.
7. Simplified status must retain a drill-down path to the complete record and evidence.
8. No destructive schema change is permitted merely to improve UI convenience.
9. Preserve the canonical navigation/workspace ownership rules defined by `docs/VYNDI-BUSINESS-OPERATOR.md`.
10. Principle: **simplify the path to the control, not the control itself.**

## 3. Workstream sequence

### Phase 0 — Baseline and instrumentation

- Record representative operator journeys and current click/action counts.
- Record route responsiveness and heavy-screen usability timings.
- Capture present session/login behaviour and recovery paths.
- Catalogue raw technical errors that can reach operators.
- Catalogue horizontal-scroll and nested-table failure points.
- Freeze the first scoring rubric before implementation.

### Phase 1 — Reliability and performance

Targets:

- No unexplained logout during normal operator use.
- Immediate interaction acknowledgement.
- Ordinary route usable quickly enough that the user never questions whether a click registered.
- Heavy analytics load secondary detail progressively rather than blocking first useful content.
- No raw runtime/database/network exceptions exposed as the primary operator message.

Guardrail: current PR #199 modifies the root shell and Assurance loading path. This workstream must not conflict with those files until PR #199 is resolved and the branch is refreshed.

### Phase 2 — Navigation and interaction consistency

- Keep normal navigation aligned to canonical Command Centre, Master Plan, Engineering, Supply & Production, Commercial, Finance, and Governance workspaces.
- Prefer context tabs/sections over new sibling pages.
- Standardise common action anatomy around:
  `Review → Impact → Authorise → Execute → Evidence`.
- Common tasks should require <=3 meaningful navigation decisions where practical.
- Preserve explicit audit/provenance access.

### Phase 3 — Guided operation

- Surface the next valid action from the current business state.
- Prefer exception-first workflow guidance.
- Role-specific Command Centre emphasis without changing canonical truth.
- Reduce repeated controls, repeated status cards, duplicate help, and unnecessary operator choices.

### Phase 4 — Contextual VIBPE operator intelligence

- Make VIBPE context-aware to the record/page the user is viewing.
- Allow VIBPE to explain cause, impact, options, and evidence.
- Any governed recommendation still enters the owning authorised transaction workflow; the assistant must not bypass ownership or approval.

### Phase 5 — Validation

- Functional regression.
- Business-truth regression.
- RBAC and approval regression.
- Audit/provenance regression.
- Performance checks.
- Responsive-layout checks.
- Representative task-completion checks.
- Re-score against the same Ease-of-Operation rubric.

## 4. Full-view nested table standard

### User requirement

Nested operational tables must be visible as a fully integrated part of the page without a horizontal scrollbar. Important business information must not disappear merely to achieve the fit.

### Standard operating behaviour

At standard VYNDI desktop/landscape viewports (1180×820 and 1440×900 reference sizes):

- No primary or nested operating table may require horizontal scrolling.
- The table must fit its content container, not impose arbitrary `min-width` values that overflow it.
- Nested content must remain visually integrated with its parent row/panel.
- Long text may wrap vertically; horizontal overflow is not the default solution.
- Numeric values remain right-aligned and compact.
- Status, quantity, currency, date, identifier, and action columns receive deliberate width budgets.
- Narrative fields receive flexible width and wrapping.
- Repeated metadata can move into the nested detail region when this preserves clarity, but must remain immediately accessible.
- Critical business fields must never be hidden solely to make the table fit.

### Narrow viewport behaviour

Below the width where a table can remain legible:

- Do not introduce a horizontal scrollbar as the primary fallback.
- Convert rows to stacked key/value detail blocks or responsive cards.
- Preserve the same business values, statuses, actions, provenance links, and permissions.
- Nested rows become an integrated expanded detail block beneath the owning record.
- The operator must not need a separate page solely to see columns removed from the compact view.

### Recommended implementation pattern

Prefer a shared responsive table primitive rather than page-by-page CSS patches. Candidate anatomy:

- `ResponsiveDataTable` / `OperationalTableFrame` shared wrapper.
- Container-aware sizing (`w-full`, `max-w-full`, `min-w-0`).
- `table-layout: fixed` or an equivalent CSS-grid layout where deterministic width budgeting is needed.
- Declarative column metadata such as `priority`, `width`, `align`, `wrap`, and `detailOnNarrow`.
- Parent rows + semantically linked nested detail row/region.
- Long identifiers use controlled wrapping/break opportunities rather than forcing the whole table wider.
- Actions compact into a consistent action cell/menu without hiding required authority state.
- Use a true table where tabular semantics matter; use CSS grid only where it preserves accessibility and reading order.

### Explicit anti-patterns

Do not solve this requirement by:

- applying `overflow-x-auto` around normal operating tables;
- setting large `min-w-[...]` values that force viewport overflow;
- shrinking all text to unreadable sizes;
- clipping content;
- hiding critical columns;
- moving required data into tooltips only;
- creating a duplicate “full table” page;
- weakening table semantics, keyboard access, RBAC, or audit links.

## 5. Initial table audit observations

The current default branch contains multiple horizontal-scroll wrappers and large minimum table widths across Command pages. Representative examples include inventory truth, funding, manufacturing, actuals, engineering/technical, knowledge, and Command Centre surfaces.

This confirms the requirement should be implemented as a cross-cutting table-layout standard rather than a one-page patch.

The preparation phase will classify each affected table into:

1. **Compact operational register** — fit all primary fields in one full-width table.
2. **Parent + nested detail** — keep primary decision columns in the row and show secondary record detail directly underneath.
3. **Responsive stacked record** — use below the legibility threshold instead of horizontal scrolling.
4. **Analytical matrix exception** — only truly matrix-like analytical grids may require a separately justified interaction pattern; these require explicit review and must not silently inherit horizontal scroll.

## 6. Acceptance criteria for tables

A table conversion is acceptable only when all of the following pass:

- 1440×900: no horizontal page/table scrollbar for the tested operating table.
- 1180×820: no horizontal page/table scrollbar for the tested operating table.
- 390×844: responsive stacked/detail presentation shows the complete record without horizontal scrolling.
- All previously visible critical values remain available.
- All previously authorised actions remain available to the same roles.
- Audit/provenance links remain available.
- Expanded/nested content remains associated with its owning row.
- Keyboard focus order remains logical.
- Column labels/field labels remain understandable.
- Long text, identifiers, dates, currency, and quantities do not overflow their containers.
- No business calculation, persistence path, authorisation rule, or source-of-truth ownership changes as a side effect.

## 7. Ease-of-operation scoring rubric

The final score should be measured across these categories rather than estimated from visual polish alone:

| Category | Weight |
|---|---:|
| Navigation and discoverability | 15 |
| Workflow clarity / next action | 15 |
| Responsiveness / perceived speed | 15 |
| Session reliability / recovery | 10 |
| Data-entry efficiency | 10 |
| Table/readability/information density | 10 |
| Error clarity and recovery guidance | 10 |
| Cross-module interaction consistency | 5 |
| VIBPE contextual assistance | 5 |
| New-user learnability | 5 |
| **Total** | **100** |

Release objective: >=85/100 with no preservation-rule regression. Premium target: 90–92/100.

## 8. First implementation slices after preparation freeze

The implementation sequence should remain small and reviewable:

1. **Table foundation:** shared responsive full-view table primitive + tests, no broad page migration yet.
2. **Representative nested-table conversion:** one high-value operating table, measured at all reference viewports.
3. **Table migration batch:** convert remaining canonical high-use operating tables in small groups.
4. **Session/error/performance UX:** integrate after active performance work is reconciled.
5. **Interaction standardisation:** Universal Action Window and next-action patterns.
6. **Contextual VIBPE integration:** only after core operator journeys are stable.

Each slice must be independently reviewable and reversible.

## 9. Preparation exit gate

Implementation may begin when:

- this preservation contract is accepted;
- the scoring rubric is frozen;
- affected high-use tables are inventoried and classified;
- the shared full-view table pattern is agreed;
- PR #199 conflict areas are resolved or explicitly avoided;
- representative visual/responsive tests are defined;
- no active branch is editing the same first-slice files without reconciliation.

No merge or deployment is implied by this preparation document.
