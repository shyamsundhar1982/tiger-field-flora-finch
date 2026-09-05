import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const PHASE6A_ROLES = ["founder", "finance", "operations", "investor", "auditor"] as const;
export type Phase6ARole = (typeof PHASE6A_ROLES)[number];
export const VENTURES = ["carbon", "aluminium", "consolidated"] as const;
export type VentureId = (typeof VENTURES)[number];

const ventureSchema = z.enum(VENTURES);
const idSchema = z.string().min(1).max(120);
const orderStatus = z.enum(["draft", "confirmed", "cancelled", "completed"]);
const purchaseStatus = z.enum(["draft", "ordered", "received", "cancelled"]);
const productionStatus = z.enum(["planned", "in-production", "qc", "finished", "released", "cancelled"]);
const inventoryType = z.enum(["receipt", "reserve", "consume", "release", "adjustment"]);

const rolePermissions: Record<Phase6ARole, Set<string>> = {
  founder: new Set(["read", "sales:create", "sales:transition", "purchase:create", "purchase:transition", "production:create", "production:transition", "inventory:create", "decision:create", "role:assign"]),
  finance: new Set(["read", "sales:transition", "purchase:transition", "decision:create"]),
  operations: new Set(["read", "sales:create", "sales:transition", "purchase:create", "purchase:transition", "production:create", "production:transition", "inventory:create"]),
  investor: new Set(["read"]),
  auditor: new Set(["read"]),
};

async function currentRole(userId: string): Promise<Phase6ARole> {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL?.trim()) throw new Error("Phase 6A requires DATABASE_URL in production");
  const sql = await getSql();
  const rows = await sql.query<{ role: Phase6ARole }>("select role from phase6a_user_roles where user_id = $1", [userId]);
  if (rows[0]?.role) return rows[0].role;
  const bootstrapUserId = process.env.PHASE6A_BOOTSTRAP_USER_ID?.trim();
  if (bootstrapUserId && bootstrapUserId === userId) {
    await sql.query("insert into phase6a_user_roles (user_id, role, assigned_by) values ($1, 'founder', $1) on conflict (user_id) do nothing", [userId]);
    return "founder";
  }
  if (!process.env.DATABASE_URL?.trim() && userId === "dev-user") return "founder";
  throw new Error("No Phase 6A role assigned to this user");
}

async function requirePermission(userId: string, permission: string) {
  const role = await currentRole(userId);
  if (!rolePermissions[role].has(permission)) throw new Error(`Forbidden: ${permission}`);
  return role;
}

const auditId = () => crypto.randomUUID();

export const getPhase6AContext = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => ({ userId: context.userId, role: await currentRole(context.userId) }));

export const listPhase6AOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  await requirePermission(context.userId, "read");
  const sql = await getSql();
  const [sales, purchases, production, inventory, decisions] = await Promise.all([
    sql.query("select * from phase6a_sales_orders order by created_at desc"),
    sql.query("select * from phase6a_purchase_orders order by created_at desc"),
    sql.query("select * from phase6a_production_orders order by created_at desc"),
    sql.query("select * from phase6a_inventory_movements order by created_at desc"),
    sql.query("select * from phase6a_decisions order by created_at desc"),
  ]);
  return { sales, purchases, production, inventory, decisions };
});

const salesInput = z.object({ ventureId: ventureSchema, customer: z.string().trim().min(1).max(200), product: z.string().trim().min(1).max(200), units: z.number().int().positive(), valueInr: z.number().int().positive(), month: z.number().int().min(1).max(36) });
export const createSalesOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => salesInput.parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "sales:create"); const sql = await getSql(); const id = `SO-${crypto.randomUUID()}`;
  const rows = await sql.query("with inserted as (insert into phase6a_sales_orders (id,venture_id,customer,product,units,value_inr,status,month,created_by,updated_at) values ($1,$2,$3,$4,$5,$6,'confirmed',$7,$8,now()) returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) select $9,$8,$10,'sales_order',id,'create',to_jsonb(inserted) from inserted returning entity_id", [id,data.ventureId,data.customer,data.product,data.units,data.valueInr,data.month,context.userId,auditId(),role]);
  return { id: rows[0]?.entity_id ?? id };
});

const purchaseInput = z.object({ ventureId: ventureSchema, supplier: z.string().trim().min(1).max(200), sku: z.string().trim().min(1).max(120), item: z.string().trim().min(1).max(200), qty: z.number().int().positive(), unitCostInr: z.number().int().positive(), expectedMonth: z.number().int().min(1).max(36) });
export const createPurchaseOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => purchaseInput.parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "purchase:create"); const sql = await getSql(); const id = `PO-${crypto.randomUUID()}`;
  await sql.query("with inserted as (insert into phase6a_purchase_orders (id,venture_id,supplier,sku,item,qty,unit_cost_inr,status,expected_month,created_by,updated_at) values ($1,$2,$3,$4,$5,$6,$7,'ordered',$8,$9,now()) returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) select $10,$9,$11,'purchase_order',id,'create',to_jsonb(inserted) from inserted", [id,data.ventureId,data.supplier,data.sku,data.item,data.qty,data.unitCostInr,data.expectedMonth,context.userId,auditId(),role]);
  return { id };
});

const inventoryInput = z.object({ ventureId: ventureSchema, type: inventoryType, sku: z.string().trim().min(1).max(120), qty: z.number().refine(v => Number.isFinite(v) && v !== 0), unitCostInr: z.number().int().nonnegative(), refType: z.string().trim().min(1).max(80), refId: idSchema });
export const createInventoryMovement = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => inventoryInput.parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "inventory:create"); const sql = await getSql(); const id = `IM-${crypto.randomUUID()}`;
  await sql.query("with inserted as (insert into phase6a_inventory_movements (id,venture_id,type,sku,qty,unit_cost_inr,ref_type,ref_id,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) select $10,$9,$11,'inventory_movement',id,'create',to_jsonb(inserted) from inserted", [id,data.ventureId,data.type,data.sku,data.qty,data.unitCostInr,data.refType,data.refId,context.userId,auditId(),role]);
  return { id };
});

export const createDecision = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => z.object({ ventureId: ventureSchema, title: z.string().trim().min(1).max(240), impactInr: z.number().int().nonnegative() }).parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "decision:create"); const sql = await getSql(); const id = `D-${crypto.randomUUID()}`;
  await sql.query("with inserted as (insert into phase6a_decisions (id,venture_id,title,impact_inr,status,created_by) values ($1,$2,$3,$4,'proposed',$5) returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) select $6,$5,$7,'decision',id,'create',to_jsonb(inserted) from inserted", [id,data.ventureId,data.title,data.impactInr,context.userId,auditId(),role]);
  return { id };
});

export const assignPhase6ARole = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => z.object({ userId: z.string().min(1), role: z.enum(PHASE6A_ROLES) }).parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "role:assign"); const sql = await getSql();
  await sql.query("insert into phase6a_user_roles (user_id,role,assigned_by,assigned_at) values ($1,$2,$3,now()) on conflict (user_id) do update set role=excluded.role, assigned_by=excluded.assigned_by, assigned_at=now()", [data.userId,data.role,context.userId]);
  await sql.query("insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) values ($1,$2,$3,'user_role',$4,$5::jsonb)", [auditId(),context.userId,role,data.userId,JSON.stringify(data)]);
  return { ok: true };
});

const transitionInput = z.object({ id: idSchema, status: z.string().min(1).max(40) });
export const transitionSalesOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => transitionInput.extend({ status: orderStatus }).parse(x)).handler(async ({ context, data }) => transitionEntity(context.userId, "sales", data.id, data.status, "sales:transition"));
export const transitionPurchaseOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => transitionInput.extend({ status: purchaseStatus }).parse(x)).handler(async ({ context, data }) => transitionEntity(context.userId, "purchase", data.id, data.status, "purchase:transition"));
export const transitionProductionOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => transitionInput.extend({ status: productionStatus }).parse(x)).handler(async ({ context, data }) => transitionEntity(context.userId, "production", data.id, data.status, "production:transition"));

async function transitionEntity(userId: string, entity: "sales" | "purchase" | "production", id: string, status: string, permission: string) {
  const role = await requirePermission(userId, permission); const sql = await getSql();
  const tables = { sales: "phase6a_sales_orders", purchase: "phase6a_purchase_orders", production: "phase6a_production_orders" } as const;
  const table = tables[entity];
  const rows = await sql.query(`with before as (select to_jsonb(t) as data from ${table} t where id=$1), updated as (update ${table} set status=$2, updated_at=now() where id=$1 returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,before_data,after_data) select $3,$4,$5,$6,$1,'status_transition',before.data,to_jsonb(updated) from before cross join updated returning entity_id`, [id,status,auditId(),userId,role,`${entity}_order`]);
  if (!rows[0]) throw new Error("Record not found or transition not applied");
  return { id };
}

export const createProductionOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((x: unknown) => z.object({ ventureId: ventureSchema, salesOrderId: idSchema, product: z.string().trim().min(1).max(200), units: z.number().int().positive() }).parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "production:create"); const sql = await getSql(); const id = `MO-${crypto.randomUUID()}`;
  await sql.query("with inserted as (insert into phase6a_production_orders (id,venture_id,sales_order_id,product,units,status,qc_passed,created_by,updated_at) values ($1,$2,$3,$4,$5,'planned',false,$6,now()) returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) select $7,$6,$8,'production_order',id,'create',to_jsonb(inserted) from inserted", [id,data.ventureId,data.salesOrderId,data.product,data.units,context.userId,auditId(),role]);
  return { id };
});

export const listInventoryPosition = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((x: unknown) => z.object({ ventureId: ventureSchema.optional() }).parse(x)).handler(async ({ context, data }) => {
  await requirePermission(context.userId, "read"); const sql = await getSql();
  const params: unknown[] = []; let where = "";
  if (data.ventureId) { where = " where venture_id=$1"; params.push(data.ventureId); }
  return sql.query(`select venture_id, sku, sum(case when type in ('receipt','release') then qty else -qty end) as net_qty, max(created_at) as last_movement_at from phase6a_inventory_movements${where} group by venture_id, sku order by venture_id, sku`, params);
});

export const getPhase6AHealth = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  await requirePermission(context.userId, "read"); const sql = await getSql();
  const rows = await sql.query<{ applied: number }>("select count(*)::int as applied from _migrations");
  return { backend: process.env.DATABASE_URL?.trim() ? "neon" : "pglite", migrationsApplied: rows[0]?.applied ?? 0, userId: context.userId, role: await currentRole(context.userId) };
});

export const listAuditEvents = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((x: unknown) => z.object({ entityType: z.string().max(80).optional(), entityId: z.string().max(120).optional() }).parse(x)).handler(async ({ context, data }) => {
  const role = await requirePermission(context.userId, "read"); const sql = await getSql();
  const params: unknown[] = []; const clauses: string[] = [];
  if (data.entityType) { params.push(data.entityType); clauses.push(`entity_type=$${params.length}`); }
  if (data.entityId) { params.push(data.entityId); clauses.push(`entity_id=$${params.length}`); }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = await sql.query(`select * from phase6a_audit_events ${where} order by created_at desc limit 200`, params);
  return { role, events: rows };
});
