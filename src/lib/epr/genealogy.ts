import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

const id = z.string().min(1);
const direction = z.enum(["backward", "forward"]);

async function command() {
  const role = await getCommandRole();
  if (!role) throw new Error("Command access is required for genealogy.");
  return role;
}

export const getSerialGenealogy = createServerFn({ method: "GET" })
  .validator(z.object({ travellerId: id }))
  .handler(async ({ data }) => {
    await command();
    const sql = await getSql();
    const traveller = await sql.query(`select id,venture,model_id,model_name,sku,bom_revision,engineering_revision,serial_number,status,supplier,created_at,updated_at from epr_travellers where id=$1`, [data.travellerId]);
    if (!traveller[0]) throw new Error("Traveller not found.");
    const [links, lots, operations, inspections, ncrCapa, movements, evidence, cogs] = await Promise.all([
      sql.query(`select * from epr_genealogy_links where traveller_id=$1 order by created_at`, [data.travellerId]),
      sql.query(`select * from epr_material_lots where traveller_id=$1 order by created_at`, [data.travellerId]),
      sql.query(`select * from epr_process_operations where traveller_id=$1 order by created_at`, [data.travellerId]),
      sql.query(`select * from epr_inspections where traveller_id=$1 order by inspected_at`, [data.travellerId]),
      sql.query(`select * from epr_ncr_capa where traveller_id=$1 order by created_at`, [data.travellerId]),
      sql.query(`select * from epr_inventory_movements where traveller_id=$1 order by created_at`, [data.travellerId]),
      sql.query(`select * from epr_evidence where traveller_id=$1 order by recorded_at`, [data.travellerId]),
      sql.query(`select * from epr_cogs_entries where traveller_id=$1 order by created_at`, [data.travellerId]),
    ]);
    return { traveller: traveller[0], links, lots, operations, inspections, ncrCapa, movements, evidence, cogs };
  });

export const rebuildSerialGenealogy = createServerFn({ method: "POST" })
  .validator(z.object({ travellerId: id }))
  .handler(async ({ data }) => {
    const role = await command();
    if (role !== "admin") throw new Error("Admin Command access is required to rebuild genealogy.");
    const sql = await getSql();
    const rows = await sql.query<{ records: number }>(`select rebuild_epr_genealogy($1,$2) as records`, [data.travellerId, role]);
    return { ok: true, records: Number(rows[0]?.records ?? 0) };
  });

export const getGenealogyBySerial = createServerFn({ method: "GET" })
  .validator(z.object({ serialNumber: id, direction: direction.default("backward") }))
  .handler(async ({ data }) => {
    await command();
    const sql = await getSql();
    const traveller = await sql.query(`select id,venture,model_id,model_name,sku,bom_revision,engineering_revision,serial_number,status,supplier,created_at,updated_at from epr_travellers where serial_number=$1`, [data.serialNumber.trim()]);
    if (!traveller[0]) throw new Error("Serial number not found.");
    const links = await sql.query(`select * from epr_genealogy_links where serial_number=$1 and direction=$2 order by created_at`, [data.serialNumber.trim(), data.direction]);
    return { traveller: traveller[0], direction: data.direction, links };
  });

export const getWhereUsed = createServerFn({ method: "GET" })
  .validator(z.object({ sourceEntityType: id, sourceEntityId: id }))
  .handler(async ({ data }) => {
    await command();
    const sql = await getSql();
    return sql.query(`select traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,metadata_json,created_at from epr_genealogy_links where source_entity_type=$1 and source_entity_id=$2 order by created_at`, [data.sourceEntityType, data.sourceEntityId]);
  });
