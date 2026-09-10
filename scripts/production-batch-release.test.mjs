import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function text(path) { return readFile(new URL(`../${path}`, import.meta.url), "utf8"); }

test("one bike / batch approval owns dependent production record creation", async () => {
  const migration = await text("migrations/0037_production_batch_auto_procurement.sql");
  assert.match(migration, /approve_vyndi_production_batch/);
  assert.match(migration, /raise_epr_traveller_for_job_card/);
  assert.match(migration, /auto_released_from_batch_approval/);
  assert.match(migration, /auto_draft_created_from_job_shortage/);
  assert.match(migration, /status='draft'/);
  assert.match(migration, /supplier_id is not null/);
  assert.match(migration, /Purchase-order approval requires a different authorised user/);
});

test("PR42 production migration remains compatible with PR44 procurement authority", async () => {
  const compat = await text("migrations/0037_a_prepare_purchase_order_view_compat.sql");
  const reconcile = await text("migrations/0038_reconcile_production_procurement_authority.sql");

  assert.match(compat, /drop view if exists vyndi_open_purchase_orders/);
  assert.match(compat, /drop view if exists vyndi_purchase_order_status/);
  assert.match(reconcile, /create or replace view vyndi_open_purchase_orders/);
  assert.match(reconcile, /vyndi_procurement_cost_authority/);
  assert.match(reconcile, /governedCostInr/);
  assert.match(reconcile, /costAuthority/);
  assert.match(reconcile, /Governed procurement cost is MISSING/);
  assert.doesNotMatch(reconcile, /legacyPriceInr/);
  assert.doesNotMatch(reconcile, /planningPriceInr/);
});

test("canonical family BOM may release only an unchanged default configuration", async () => {
  const source = await text("src/lib/production-job-card.ts");
  assert.match(source, /family-standard/);
  assert.match(source, /differs from the released .* standard BOM/);
  assert.match(source, /Release an exact variant BOM before Production/);
});

test("approval-heavy operational screens do not use forced-width horizontal registers", async () => {
  const paths = [
    "src/routes/command/master-data.tsx",
    "src/routes/command/bom-inventory-mapping.tsx",
    "src/routes/command/production.tsx",
    "src/routes/command/purchase-execution.tsx",
  ];
  for (const path of paths) {
    const source = await text(path);
    assert.doesNotMatch(source, /min-w-\[(?:9|1[0-9])\d{2}px\]/, `${path} must not hide approval/action controls behind a forced-width table`);
  }
});

test("Commercial defaults components and Production exposes one batch approval", async () => {
  const sales = await text("src/routes/command/sales.tsx");
  const production = await text("src/routes/command/production.tsx");
  assert.match(sales, /defaultConfiguration\(variantId\)/);
  assert.match(sales, /Optional component customization · defaults already selected/);
  assert.match(production, /Approve bike \/ batch/);
  assert.match(production, /approveProductionBatch/);
  assert.match(production, /Draft PO is generated when this build is approved/);
});

test("Production exposes confirmed-order to current job-card reconciliation instead of silently hiding gaps", async () => {
  const production = await text("src/routes/command/production.tsx");
  assert.match(production, /Confirmed orders/);
  assert.match(production, /Order → Job Card reconciliation/);
  assert.match(production, /Missing \/ stale/);
  assert.match(production, /Reconcile all/);
  assert.match(production, /synchronizedOrders/);
  assert.match(production, /ordersNeedingJobCard/);
  assert.match(production, /If you expected more confirmed orders than the count above/);
  assert.doesNotMatch(production, /const committedUnits = cards\.reduce/);
});

test("Production job card owns the material requisition and traveller-linked FIFO issue record", async () => {
  const production = await text("src/routes/command/production.tsx");
  const view = await text("src/lib/production-job-card-view.ts");

  assert.match(production, /Material Requisition &amp; Issue/);
  assert.match(production, /MR-\$\{String\(card\.batch_code \?\? card\.id\)/);
  assert.match(production, /Requested by/);
  assert.match(production, /Approved by/);
  assert.match(production, /Print requisition \/ issue record/);
  assert.match(production, /Issue reserved FIFO/);
  assert.match(production, /consumed_by/);
  assert.match(view, /reservation\.job_card_line_id=l\.id/);
  assert.match(view, /r\.consumed_by,r\.consumed_at/);
  assert.doesNotMatch(production, /to="\/command\/stores-requisition"/);
});

test("production release SQL qualifies job-card lineage inside table-returning functions", async () => {
  const batch = await text("migrations/0042_fix_production_batch_job_card_id_ambiguity.sql");
  const traveller = await text("migrations/0043_fix_traveller_job_card_return_ambiguity.sql");

  assert.match(batch, /tr\.job_card_id=c\.id/);
  assert.match(batch, /req\.job_card_id=c\.id/);
  assert.match(batch, /po\.id=v_po_id/);
  assert.doesNotMatch(batch, /where job_card_id=c\.id/);

  assert.match(traveller, /jc\.sales_order_id as sales_order_id_value/);
  assert.match(traveller, /tr\.job_card_id=c\.job_card_id_value/);
  assert.match(traveller, /c\.sales_order_id_value/);
  assert.doesNotMatch(traveller, /where job_card_id=/);
});

test("Commercial business writes require an individual identity and prove persistence before Production sync", async () => {
  const actor = await text("src/lib/business-actor.ts");
  const authority = await text("src/lib/sales-order-authority.ts");
  const sales = await text("src/routes/command/sales.tsx");

  assert.match(actor, /getBusinessWriteReadiness/);
  assert.match(actor, /getAssignedBusinessIdentity/);
  assert.match(actor, /signedIn: Boolean\(user\)/);
  assert.match(actor, /canEdit: Boolean\(role && canPerform\(role, "edit"\)\)/);
  assert.doesNotMatch(actor, /requireUserId/);

  assert.match(authority, /getSalesOrderWriteReadiness/);
  assert.match(authority, /middleware\(\[optionalAuthMiddleware\]\)/);
  assert.match(authority, /middleware\(\[authMiddleware\]\)/);
  assert.match(authority, /vyndi_sales_order_revisions/);
  assert.match(authority, /Sales-order persistence verification failed/);
  assert.match(authority, /persisted: true as const/);

  assert.match(sales, /getSalesOrderWriteReadiness/);
  assert.doesNotMatch(sales, /from "@\/lib\/business-actor"/);
  assert.match(sales, /Order was NOT saved/);
  assert.match(sales, /IS persisted in Commercial, but Production synchronization failed/);
  assert.match(sales, /Sign in to create order/);
  assert.match(
    sales,
    /write = await saveSalesOrder\([\s\S]*?const projection = await syncProductionJobCard/,
    "Commercial must persist the order before synchronizing Production",
  );
});

test("email login captures bearer and server functions transport the same verified identity", async () => {
  const appEnv = JSON.parse(await text(".grok/app-env.json"));
  const login = await text("src/routes/login.tsx");
  const commandLogin = await text("src/routes/command-login.tsx");
  const middleware = await text("src/lib/auth/middleware.ts");
  const actor = await text("src/lib/business-actor.ts");
  const commandAccess = await text("src/lib/command-access.ts");
  const productionJobCard = await text("src/lib/production-job-card.ts");
  const productionRelease = await text("src/lib/production-release-authority.ts");

  assert.notEqual(appEnv.VITE_AUTH_ENABLED, "false", "individual VYNDI login must be enabled in local, preview and provider builds");

  assert.match(login, /set-auth-token/);
  assert.match(login, /grok-auth\.bearer-token/);
  assert.match(commandLogin, /set-auth-token/);
  assert.match(commandLogin, /removeItem\(BEARER_KEY\)/);

  assert.match(middleware, /export const authMiddleware/);
  assert.match(middleware, /export const optionalAuthMiddleware/);
  assert.match(middleware, /getBearerToken/);
  assert.match(middleware, /getSessionUser\(context\?\.bearerToken\)/);

  assert.match(actor, /verified\?: VerifiedBusinessIdentity/);
  assert.match(actor, /getAssignedBusinessIdentity\(verified\)/);
  assert.match(actor, /if \(!user\) throw new UnauthorizedError\(\)/);
  assert.match(actor, /return \{ userId: user\.id, role \}/);
  assert.doesNotMatch(actor, /const role = await getCommandRole\(\);[\s\S]*?requireUserId/);

  assert.match(commandAccess, /middleware\(\[optionalAuthMiddleware\]\)/);
  assert.match(commandAccess, /getAssignedCommandRole\(context\.userId, context\.userEmail\)/);
  assert.match(productionJobCard, /middleware\(\[authMiddleware\]\)/);
  assert.match(productionJobCard, /requireBusinessActor\("edit", \{ userId: context\.userId, email: context\.userEmail \}\)/);
  assert.match(productionRelease, /middleware\(\[authMiddleware\]\)/);
  assert.match(productionRelease, /requireBusinessActor\("approve", \{ userId: context\.userId, email: context\.userEmail \}\)/);
});

test("business mutation actor resolves verified identity and assigned role in one request context", async () => {
  const actor = await text("src/lib/business-actor.ts");
  const assignedRole = await text("src/lib/command-user-role.server.ts");
  const commandAccess = await text("src/lib/command-access.ts");

  assert.match(actor, /const \{ user, role \} = await getAssignedBusinessIdentity\(verified\)/);
  assert.match(actor, /if \(!user\) throw new UnauthorizedError\(\)/);
  assert.match(actor, /return \{ userId: user\.id, role \}/);
  assert.doesNotMatch(actor, /const role = await getCommandRole\(\);[\s\S]*?requireUserId/);

  assert.match(assignedRole, /getAssignedCommandRole/);
  assert.match(assignedRole, /select role from vindy_user_roles/);
  assert.match(assignedRole, /VINDY_ADMIN_EMAILS/);
  assert.match(commandAccess, /getAssignedCommandRole\(context\.userId, context\.userEmail\)/);
});

test("user administration transports the same verified identity used for role enforcement", async () => {
  const users = await text("src/lib/vindy-users.ts");

  assert.match(users, /getVindyUserContext[\s\S]*?middleware\(\[optionalAuthMiddleware\]\)/);
  assert.match(users, /listVindyUsers[\s\S]*?middleware\(\[authMiddleware\]\)/);
  assert.match(users, /createVindyUser[\s\S]*?middleware\(\[authMiddleware\]\)/);
  assert.match(users, /resetVindyUserPassword[\s\S]*?middleware\(\[authMiddleware\]\)/);
  assert.match(users, /setVindyUserRole[\s\S]*?middleware\(\[authMiddleware\]\)/);
  assert.match(users, /deleteVindyUser[\s\S]*?middleware\(\[authMiddleware\]\)/);
  assert.match(users, /getAssignedCommandRole\(context\.userId, context\.userEmail\)/);
  assert.doesNotMatch(users, /getSessionUser\(/);
});

test("Cash consumes canonical accounting timing rather than treating accrual sales as immediate cash", async () => {
  const cash = await text("src/routes/command/cash.tsx");
  const statements = await text("src/routes/command/balance-sheet.tsx");

  assert.match(cash, /buildAccountingModel\(planning, accounting\)/);
  assert.match(cash, /salesCollections/);
  assert.match(cash, /supplierPayments/);
  assert.match(cash, /gstSettlement/);
  assert.match(cash, /Revenue recognition and cash collection are deliberately separate/);
  assert.doesNotMatch(cash, /Cash inflow modeled at sale/);
  assert.match(statements, /buildAccountingModel\(planning,accounting\)/);
});

test("CA Audit is a live launch gate over the canonical accounting model", async () => {
  const audit = await text("src/routes/command/ca-audit.tsx");

  assert.match(audit, /buildAccountingModel\(planning, accounting\)/);
  assert.match(audit, /checkFinanceIntegrity\(rows\)/);
  assert.match(audit, /fundingTypeByMonth/);
  assert.match(audit, /STATUTORY_GAPS/);
  assert.match(audit, /Statutory \/ certified external use: NO-GO/);
  assert.match(audit, /browser-side planning state/);
  assert.match(audit, /taxRatePct > 0/);
  assert.match(audit, /gstRatePct > 0/);
});

test("Commercial revisions are buffered and synchronize only on explicit save", async () => {
  const sales = await text("src/routes/command/sales.tsx");
  assert.match(sales, /Revise order \/ configuration/);
  assert.match(sales, /Save & synchronize revision/);
  assert.match(sales, /editOrderVariant/);
  assert.match(sales, /editOrderConfiguration/);
  assert.match(sales, /Controlled Commercial order revision/);
  assert.doesNotMatch(sales, /onChange=\{\(event\) => void updateOrder/);
});

test("governed planning supports admin-editable M1-M36 unit overrides without creating transactions", async () => {
  const plan = await text("src/lib/planning/operating-plan.ts");
  const studio = await text("src/components/planning-studio.tsx");
  const store = await text("src/lib/store.ts");

  assert.match(plan, /monthlyDemandOverrides/);
  assert.match(plan, /unitsForPlanMonth/);
  assert.match(studio, /Month-by-month base production \/ demand units/);
  assert.match(studio, /setMonthUnits/);
  assert.match(studio, /never creates a Commercial order, Production job card, traveller, inventory movement or supplier commitment/);
  assert.match(store, /key === "unitMultiplier"/);
  assert.match(store, /demandScale: value/);
});

test("legacy Command admin can maintain internal Governance action status without weakening business commitments", async () => {
  const actions = await text("src/lib/operating-action-authority.ts");
  const actor = await text("src/lib/business-actor.ts");
  assert.match(actions, /requireOperatingActionActor/);
  assert.match(actions, /command:admin/);
  assert.match(actions, /role === "admin"/);
  assert.match(actor, /getAssignedBusinessIdentity/);
  assert.match(actor, /if \(!user\) throw new UnauthorizedError\(\)/);
  assert.doesNotMatch(actor, /return \{ userId: "command:admin"/);
});
