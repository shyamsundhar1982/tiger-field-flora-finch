# VYNDI / Vāyú Shastr Project Instructions

Build and operate the VYNDI carbon-bicycle business execution system for **Vāyú Shastr Private Limited**.

## Mandatory business-operator contract

Before auditing, simplifying, implementing, verifying, or deploying business-system work, read:

`docs/VYNDI-BUSINESS-OPERATOR.md`

The repository skill entrypoint is:

`.grok/skills/vyndi-business-operator/SKILL.md`

Treat the operator document as the canonical repository-specific business operating standard. Platform/build instructions in the root `AGENTS.md` remain in force and must not be removed or weakened.

## Non-negotiable invariants

- One business truth per concept; do not create parallel finance, planning, sales, inventory, engineering, or governance truth.
- Normal navigation stays centered on Command Centre, 36-month Master Plan, Engineering, Supply & Production, Commercial, Finance, and Governance.
- `/command/inventory` is the canonical normal-user Master Inventory.
- Active inventory ledgers are `components`, `raw-materials`, `tooling`, `quality`, and `stores-tools`.
- MSL, FIFO, movements, and forecast health are inventory rules/views, not competing normal-user inventory pages.
- `/command/financial-cockpit` is canonical finance; CA Audit verifies that model rather than owning another finance model.
- `/command/planning` owns modeled 36-month intent. Actual orders, receipts, issues, job cards, quality records, collections, and accounting transactions belong to operating workspaces.
- Use controlled product/BOM truth and explicit BOM↔inventory mapping.
- Prefer exception-first, decision-oriented screens; do not proliferate pages, duplicate KPIs, or duplicate identical nearby tooltips/popovers.
- Preserve legacy/history where needed but keep legacy routes out of normal user navigation.
- Verify end-to-end data flow and persistence before claiming completion.
- Separate source-code state from deployment state; a GitHub change is not live until the target deployment is verified.
- Do not expose secrets or infer permission to deploy, merge, alter production data, rotate secrets, or change environment variables/live infrastructure without explicit user authorization.

## Project file context

This conversation belongs to a Grok project. The project's files are mounted at `/workspace/artifacts` — look there for user-provided sources before concluding the workspace has no project files. Files written there persist to the project across conversations.
