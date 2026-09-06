import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform, type CommandPermission } from "@/lib/page-access";
import { SEED_INVENTORY } from "@/lib/data/inventory";

const statusSchema = z.enum(["draft", "pending_approval", "approved", "superseded"]);
const domainSchema = z.enum(["product", "bom", "material", "supplier", "price", "inventory", "process", "quality", "epr", "finance", "document"]);
const recordSchema = z.object({
  domain: domainSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  revision: z.number().int().positive(),
  status: statusSchema,
  ownerRole: z.string().min(1).max(40),
  approverRole: z.string().min(1).max(40),
  effectiveFrom: z.string().nullable().optional(),
  sourceRef: z.string().max(500).nullable().optional(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

async function assertSameSiteRequest() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) return;
  const headers = request.headers;
  const site = headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;
  const isTopLevelGet = headers.get("sec-fetch-mode") === "navigate" && request.method === "GET" && headers.get("sec-fetch-dest") !== "object" && headers.get("sec-fetch-dest") !== "embed";
  if (!isTopLevelGet) throw new Error("Forbidden: cross-site request blocked");
}

async function requirePermission(permission: CommandPermission) {
  const role = await getCommandRole();
  if (!role || !canPerform(role, permission)) throw new Error(`Master data ${permission} permission denied.`);
  return role;
}

export const listMasterData = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  return sql`select id, domain, code, name, revision, status, owner_role, approver_role, effective_from::text, source_ref, attributes, created_by, approved_by, approved_at::text, created_at::text, updated_at::text from master_data_records order by domain, code, revision desc limit 500`;
});

export const createMasterData = createServerFn({ method: "POST" }).validator(recordSchema).handler(async ({ data }) => {
  await assertSameSiteRequest();
  const role = await requirePermission("edit");
  if (data.status === "approved") throw new Error("New master data must enter approval before becoming approved.");
  const sql = await getSql();
  const id = crypto.randomUUID();
  await sql`insert into master_data_records (id, domain, code, name, revision, status, owner_role, approver_role, effective_from, source_ref, attributes, created_by) values (${id}, ${data.domain}, ${data.code}, ${data.name}, ${data.revision}, ${data.status}, ${data.ownerRole}, ${data.approverRole}, ${data.effectiveFrom ?? null}, ${data.sourceRef ?? null}, ${JSON.stringify(data.attributes)}::jsonb, ${`command:${role}`})`;
  await sql`insert into master_data_audit_events (id, master_data_id, event_type, actor_user_id, actor_role, to_status, source_ref) values (${crypto.randomUUID()}, ${id}, ${"MASTER_DATA_CREATED"}, ${`command:${role}`}, ${role}, ${data.status}, ${data.sourceRef ?? null})`;
  return { ok: true, id };
});

/**
 * Explicit migration bridge for the legacy component catalogue.
 * It creates inventory-master DRAFT records only; it never approves, posts,
 * or changes the legacy SEED_INVENTORY values themselves.
 */
export const importLegacyInventoryAsDrafts = createServerFn({ method: "POST" }).handler(async () => {
  await assertSameSiteRequest();
  const role = await requirePermission("edit");
  const sql = await getSql();
  let created = 0;
  let existing = 0;

  for (const item of SEED_INVENTORY) {
    const sourceRef = `SEED_INVENTORY:${item.sku}`;
    const found = await sql<{ id: string }[]>`select id from master_data_records where domain='inventory' and source_ref=${sourceRef} limit 1`;
    if (found[0]) {
      existing += 1;
      continue;
    }

    const id = crypto.randomUUID();
    const attributes = {
      legacyId: item.id,
      category: item.category,
      subcategory: item.subcategory,
      brand: item.brand,
      model: item.model,
      detail: item.detail,
      legacyPriceInr: item.priceInr,
      legacyStockQty: item.stockQty,
      reorderLevel: item.reorderLevel,
      coreEnabled: item.coreEnabled,
      proEnabled: item.proEnabled,
      apexEnabled: item.apexEnabled,
      legacySource: item.source,
      legacyNotes: item.notes,
      controlState: "migration_candidate",
    };

    await sql`insert into master_data_records (id, domain, code, name, revision, status, owner_role, approver_role, effective_from, source_ref, attributes, created_by) values (${id}, 'inventory', ${item.sku}, ${`${item.brand} ${item.model}`.trim()}, 1, 'draft', 'operations', 'operations', null, ${sourceRef}, ${JSON.stringify(attributes)}::jsonb, ${`command:${role}`})`;
    await sql`insert into master_data_audit_events (id, master_data_id, event_type, actor_user_id, actor_role, to_status, source_ref, note) values (${crypto.randomUUID()}, ${id}, 'LEGACY_CATALOGUE_IMPORTED_AS_DRAFT', ${`command:${role}`}, ${role}, 'draft', ${sourceRef}, 'Explicit migration candidate import; no approval or inventory posting performed.')`;
    created += 1;
  }

  return { ok: true, created, existing, total: SEED_INVENTORY.length };
});

const transitionSchema = z.object({ id: z.string().uuid(), toStatus: statusSchema, note: z.string().max(500).optional(), sourceRef: z.string().max(500).optional() });

export const transitionMasterData = createServerFn({ method: "POST" }).validator(transitionSchema).handler(async ({ data }) => {
  await assertSameSiteRequest();
  const role = await requirePermission(data.toStatus === "approved" ? "approve" : "edit");
  const sql = await getSql();
  const rows = await sql<{ status: string }[]>`select status from master_data_records where id=${data.id} limit 1`;
  if (!rows[0]) throw new Error("Master data record not found.");
  const fromStatus = rows[0].status;
  const allowed = (fromStatus === "draft" && data.toStatus === "pending_approval") || (fromStatus === "pending_approval" && (data.toStatus === "approved" || data.toStatus === "draft")) || (fromStatus === "approved" && data.toStatus === "superseded");
  if (!allowed) throw new Error(`Invalid master data transition: ${fromStatus} → ${data.toStatus}`);
  await sql`update master_data_records set status=${data.toStatus}, approved_by=${data.toStatus === "approved" ? `command:${role}` : null}, approved_at=${data.toStatus === "approved" ? new Date() : null}, updated_at=now() where id=${data.id}`;
  await sql`insert into master_data_audit_events (id, master_data_id, event_type, actor_user_id, actor_role, from_status, to_status, note, source_ref) values (${crypto.randomUUID()}, ${data.id}, ${"MASTER_DATA_STATUS_CHANGED"}, ${`command:${role}`}, ${role}, ${fromStatus}, ${data.toStatus}, ${data.note ?? null}, ${data.sourceRef ?? null})`;
  return { ok: true, fromStatus, toStatus: data.toStatus };
});

export const listMasterDataAudit = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  return sql`select id, master_data_id, event_type, actor_user_id, actor_role, from_status, to_status, note, source_ref, created_at::text from master_data_audit_events order by created_at desc limit 100`;
});
