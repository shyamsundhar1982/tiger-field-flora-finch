import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { requireBusinessActor } from "@/lib/business-actor";
import { MODELS } from "@/lib/data/models";
import { SEED_INVENTORY, type InventoryCategory } from "@/lib/data/inventory";
import { isEligible } from "@/lib/product-configuration";

const ventureSchema = z.enum(["carbon", "aluminium"]);
const planningTierIds = ["core", "pro", "apex"] as const;
const configurationCategories = [
  "groupset", "wheelset", "tyre", "handlebar", "stem", "saddle", "thruaxle",
  "bottom-bracket", "bottle-cage", "tool-pouch", "bracket", "colour",
] as const satisfies readonly InventoryCategory[];

function canonicalUnit(value: string) {
  const unit = value.trim().toLowerCase();
  return unit === "unit" || unit === "each" ? "ea" : unit;
}
async function requireAdminView() {
  const role = await getCommandRole();
  if (role !== "admin") throw new Error("Admin Command access is required for BOM mapping control.");
}
async function requireStableAdmin() {
  const actor = await requireBusinessActor("approve");
  if (actor.role !== "admin") throw new Error("Admin approval is required for BOM mapping mutations.");
  return actor;
}
function assertModelScope(modelId: string) {
  const variant = MODELS.find((model) => model.id === modelId);
  if (variant) return { kind: "variant" as const, variant };
  if ((planningTierIds as readonly string[]).includes(modelId)) return { kind: "planning" as const, variant: null };
  throw new Error("Unknown VINDY model/variant mapping scope.");
}

export const listControlledBomMappings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminView();
  const sql = await getSql();
  return sql`
    select id,venture,model_id,bom_revision,bom_line_key,sku,quantity,unit,status,
           configuration_category,configuration_option_id,approved_by,approved_at::text as approved_at,
           effective_from::text as effective_from,effective_to::text as effective_to,notes,created_by,created_at::text as created_at
      from epr_bom_inventory_mappings
     order by venture,model_id,bom_revision,bom_line_key,configuration_option_id nulls first,created_at desc
     limit 3000
  `;
});

export const createControlledBomMapping = createServerFn({ method: "POST" })
  .validator(z.object({
    venture: ventureSchema,
    modelId: z.string().min(1).max(120),
    bomRevision: z.string().trim().min(1).max(120),
    bomLineKey: z.string().trim().min(1).max(160),
    sku: z.string().trim().min(1).max(120),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().trim().min(1).max(30),
    configurationCategory: z.enum(configurationCategories).nullable().optional(),
    configurationOptionId: z.string().trim().min(1).max(120).nullable().optional(),
    notes: z.string().max(2000).default(""),
  }))
  .handler(async ({ data }) => {
    const actor = await requireStableAdmin();
    const scope = assertModelScope(data.modelId);
    const sql = await getSql();
    const safeSku = data.sku.toUpperCase();
    const unit = canonicalUnit(data.unit);
    const category = data.configurationCategory ?? null;
    const optionId = data.configurationOptionId ?? null;

    if ((category === null) !== (optionId === null)) {
      throw new Error("Configuration category and controlled option must either both be set or both be blank for a base BOM line.");
    }
    if (scope.kind === "planning" && optionId) {
      throw new Error("Planning-standard tier mappings cannot contain customer option selections; use an exact VINDY variant mapping.");
    }
    if (optionId) {
      if (scope.kind !== "variant") throw new Error("Configured BOM mappings require an exact VINDY variant.");
      const option = SEED_INVENTORY.find((item) => item.id === optionId);
      if (!option || option.category !== category) throw new Error("Controlled configuration option does not match the selected category.");
      if (!isEligible(option, scope.variant.tier)) throw new Error(`${option.brand} ${option.model} is not eligible for ${scope.variant.name}.`);
      if (option.sku.toUpperCase() !== safeSku) throw new Error(`Controlled option ${option.id} must map to SKU ${option.sku}.`);
    }
    if (scope.kind === "variant") {
      const expectedVenture = scope.variant.tier === "core" ? "aluminium" : "carbon";
      if (data.venture !== expectedVenture) throw new Error(`${scope.variant.name} must use the ${expectedVenture} BOM/inventory venture.`);
    }

    const [master] = await sql.query<{ id: string }>(
      `select id from master_data_records where domain='inventory' and code=$1 and status='approved' order by revision desc limit 1`,
      [safeSku],
    );
    if (!master) throw new Error(`SKU ${safeSku} is not an approved Inventory Master record.`);

    const mappingId = `MAP-${crypto.randomUUID()}`;
    await sql.query(
      `insert into epr_bom_inventory_mappings
        (id,venture,model_id,bom_revision,bom_line_key,sku,quantity,unit,status,configuration_category,configuration_option_id,notes,created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12)`,
      [mappingId, data.venture, data.modelId, data.bomRevision, data.bomLineKey, safeSku, data.quantity, unit, category, optionId, data.notes, actor.userId],
    );
    await sql.query(
      `insert into vyndi_audit_events
        (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
       values ($1,'bom_inventory_mapping',$2,'draft_created',$3,$4,$5::jsonb)`,
      [`AUD-${crypto.randomUUID()}`, mappingId, actor.userId, actor.role, JSON.stringify({ ...data, sku: safeSku, unit, inventoryMasterId: master.id })],
    );
    return { ok: true, mappingId };
  });

export const approveControlledBomMapping = createServerFn({ method: "POST" })
  .validator(z.object({ mappingId: z.string().min(1).max(160) }))
  .handler(async ({ data }) => {
    const actor = await requireStableAdmin();
    const sql = await getSql();
    const [mapping] = await sql.query<{
      id: string; venture: string; model_id: string; bom_revision: string; bom_line_key: string;
      sku: string; unit: string; status: string; configuration_category: string | null; configuration_option_id: string | null;
    }>(`select id,venture,model_id,bom_revision,bom_line_key,sku,unit,status,configuration_category,configuration_option_id
          from epr_bom_inventory_mappings where id=$1 for update`, [data.mappingId]);
    if (!mapping) throw new Error("BOM-SKU mapping not found.");
    if (mapping.status !== "draft") throw new Error(`Only draft mappings can be approved; current status is ${mapping.status}.`);
    assertModelScope(mapping.model_id);
    const [master] = await sql.query<{ id: string }>(
      `select id from master_data_records where domain='inventory' and code=$1 and status='approved' order by revision desc limit 1`, [mapping.sku]);
    if (!master) throw new Error(`SKU ${mapping.sku} is no longer approved in Inventory Master.`);

    await sql.query(`update epr_bom_inventory_mappings
          set status='superseded',effective_to=now(),updated_at=now()
        where venture=$1 and model_id=$2 and bom_revision=$3 and bom_line_key=$4
          and coalesce(configuration_option_id,'')=coalesce($5,'')
          and status='active' and effective_to is null and id<>$6`,
      [mapping.venture, mapping.model_id, mapping.bom_revision, mapping.bom_line_key, mapping.configuration_option_id, mapping.id]);
    await sql.query(`update epr_bom_inventory_mappings
          set status='active',approved_by=$1,approved_at=now(),effective_from=now(),effective_to=null,updated_at=now()
        where id=$2`, [actor.userId, mapping.id]);
    await sql.query(`insert into vyndi_audit_events
        (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
       values ($1,'bom_inventory_mapping',$2,'approved',$3,$4,$5::jsonb)`,
      [`AUD-${crypto.randomUUID()}`, mapping.id, actor.userId, actor.role, JSON.stringify(mapping)]);
    return { ok: true };
  });

export const retireControlledBomMapping = createServerFn({ method: "POST" })
  .validator(z.object({ mappingId: z.string().min(1).max(160), reason: z.string().trim().min(1).max(1000) }))
  .handler(async ({ data }) => {
    const actor = await requireStableAdmin();
    const sql = await getSql();
    const [mapping] = await sql.query<{ id: string; status: string }>(
      `select id,status from epr_bom_inventory_mappings where id=$1 for update`, [data.mappingId]);
    if (!mapping) throw new Error("BOM-SKU mapping not found.");
    if (mapping.status !== "active") throw new Error("Only active mappings can be retired.");
    await sql.query(`update epr_bom_inventory_mappings
          set status='superseded',effective_to=now(),updated_at=now(),notes=case when notes='' then $1 else notes || E'\n' || $1 end
        where id=$2`, [`Retired: ${data.reason}`, mapping.id]);
    await sql.query(`insert into vyndi_audit_events
        (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
       values ($1,'bom_inventory_mapping',$2,'retired',$3,$4,$5::jsonb)`,
      [`AUD-${crypto.randomUUID()}`, mapping.id, actor.userId, actor.role, JSON.stringify({ reason: data.reason })]);
    return { ok: true };
  });
