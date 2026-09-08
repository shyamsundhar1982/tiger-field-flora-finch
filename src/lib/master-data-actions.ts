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
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
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
  const rows = await sql`select id, domain, code, name, revision, status, owner_role as "ownerRole", approver_role as "approverRole", effective_from::text as "effectiveFrom", source_ref as "sourceRef", attributes, created_by as "createdBy", approved_by as "approvedBy", approved_at::text as "approvedAt", created_at::text as "createdAt", updated_at::text as "updatedAt" from master_data_records order by domain, code, revision desc limit 500`;
  return Array.isArray(rows) ? [...rows] : [];
});

export const createMasterData = createServerFn({ method: "POST" })
  .validator(recordSchema)
  .handler(async ({ data }) => {
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

  const candidates = SEED_INVENTORY.map((item) => ({
    id: crypto.randomUUID(),
    code: item.sku,
    name: `${item.brand} ${item.model}`.trim(),
    source_ref: `SEED_INVENTORY:${item.sku}`,
    attributes: {
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
    },
  }));

  const inserted = await sql<{ id: string; source_ref: string }>`
    with candidates as (
      select *
      from jsonb_to_recordset(${JSON.stringify(candidates)}::jsonb)
        as c(id uuid, code text, name text, source_ref text, attributes jsonb)
    )
    insert into master_data_records (
      id, domain, code, name, revision, status, owner_role, approver_role,
      effective_from, source_ref, attributes, created_by
    )
    select
      c.id, 'inventory', c.code, c.name, 1, 'draft', 'operations', 'operations',
      null, c.source_ref, c.attributes, ${`command:${role}`}
    from candidates c
    where not exists (
      select 1
      from master_data_records m
      where m.domain='inventory' and m.source_ref=c.source_ref
    )
    returning id::text as id, source_ref
  `;

  const insertedRows = Array.isArray(inserted) ? inserted : [];
  if (insertedRows.length > 0) {
    const auditRows = insertedRows.map((row) => ({
      id: crypto.randomUUID(),
      master_data_id: row.id,
      source_ref: row.source_ref,
    }));
    await sql`
      insert into master_data_audit_events (
        id, master_data_id, event_type, actor_user_id, actor_role,
        to_status, source_ref, note
      )
      select
        a.id, a.master_data_id, 'LEGACY_CATALOGUE_IMPORTED_AS_DRAFT',
        ${`command:${role}`}, ${role}, 'draft', a.source_ref,
        'Explicit migration candidate import; no approval or inventory posting performed.'
      from jsonb_to_recordset(${JSON.stringify(auditRows)}::jsonb)
        as a(id uuid, master_data_id uuid, source_ref text)
    `;
  }

  const created = insertedRows.length;
  return { ok: true, created, existing: Math.max(0, SEED_INVENTORY.length - created), total: SEED_INVENTORY.length };
});

const transitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: statusSchema,
  note: z.string().max(500).optional(),
  sourceRef: z.string().max(500).optional(),
});

const bulkApprovalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  note: z.string().max(500).optional(),
});

export const transitionMasterData = createServerFn({ method: "POST" })
  .validator(transitionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission(data.toStatus === "approved" ? "approve" : "edit");
    const sql = await getSql();
    const rows = await sql<{
      status: string;
    }>`select status from master_data_records where id=${data.id} limit 1`;
    if (!rows[0]) throw new Error("Master data record not found.");
    const fromStatus = rows[0].status;
    const allowed = (fromStatus === "draft" && data.toStatus === "pending_approval") || (fromStatus === "pending_approval" && (data.toStatus === "approved" || data.toStatus === "draft")) || (fromStatus === "approved" && data.toStatus === "superseded");
    if (!allowed) throw new Error(`Invalid master data transition: ${fromStatus} → ${data.toStatus}`);
    await sql`update master_data_records set status=${data.toStatus}, approved_by=${data.toStatus === "approved" ? `command:${role}` : null}, approved_at=${data.toStatus === "approved" ? new Date() : null}, updated_at=now() where id=${data.id}`;
    await sql`insert into master_data_audit_events (id, master_data_id, event_type, actor_user_id, actor_role, from_status, to_status, note, source_ref) values (${crypto.randomUUID()}, ${data.id}, ${"MASTER_DATA_STATUS_CHANGED"}, ${`command:${role}`}, ${role}, ${fromStatus}, ${data.toStatus}, ${data.note ?? null}, ${data.sourceRef ?? null})`;
    return { ok: true, fromStatus, toStatus: data.toStatus };
  });

/**
 * Governed bulk approval for the Master Data list.
 * Only pending-approval records are eligible. The guarded CTE updates nothing
 * if any selected ID is missing or has changed status, preventing partial bulk
 * approval from a stale browser selection.
 */
export const bulkApproveMasterData = createServerFn({ method: "POST" })
  .validator(bulkApprovalSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("approve");
    const sql = await getSql();
    const ids = [...new Set(data.ids)];
    const selectedRows = ids.map((id) => ({ id }));

    const updated = await sql<{ id: string }>`
      with selected as (
        select s.id::uuid as id
        from jsonb_to_recordset(${JSON.stringify(selectedRows)}::jsonb) as s(id text)
      ), current_rows as (
        select m.id, m.status
        from master_data_records m
        join selected s on s.id=m.id
      ), guard as (
        select
          count(*)::int as found_count,
          count(*) filter (where status='pending_approval')::int as eligible_count
        from current_rows
      ), updated as (
        update master_data_records m
        set
          status='approved',
          approved_by=${`command:${role}`},
          approved_at=now(),
          updated_at=now()
        from selected s, guard g
        where m.id=s.id
          and m.status='pending_approval'
          and g.found_count=${ids.length}
          and g.eligible_count=${ids.length}
        returning m.id::text as id
      )
      select id from updated
    `;

    const updatedRows = Array.isArray(updated) ? updated : [];
    if (updatedRows.length !== ids.length) {
      throw new Error("Bulk approval stopped because one or more selected records are missing or no longer pending approval. Refresh the register and select again.");
    }

    const auditRows = updatedRows.map((row) => ({
      id: crypto.randomUUID(),
      master_data_id: row.id,
    }));
    await sql`
      insert into master_data_audit_events (
        id, master_data_id, event_type, actor_user_id, actor_role,
        from_status, to_status, note
      )
      select
        a.id, a.master_data_id, 'MASTER_DATA_BULK_APPROVED',
        ${`command:${role}`}, ${role}, 'pending_approval', 'approved',
        ${data.note ?? "Bulk approval from Master Data Engine"}
      from jsonb_to_recordset(${JSON.stringify(auditRows)}::jsonb)
        as a(id uuid, master_data_id uuid)
    `;

    return { ok: true, approved: updatedRows.length, ids: updatedRows.map((row) => row.id) };
  });

export const listMasterDataAudit = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  const rows = await sql`select id, master_data_id, event_type, actor_user_id, actor_role, from_status, to_status, note, source_ref, created_at::text from master_data_audit_events order by created_at desc limit 100`;
  return Array.isArray(rows) ? [...rows] : [];
});
