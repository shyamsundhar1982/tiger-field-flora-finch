import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";
import { validateConfiguration, type ProductConfiguration, type ProductTier } from "@/lib/product-configuration";

const syncSchema = z.object({ salesOrderId: z.string().min(1).max(100) });

function ventureForTier(tier: ProductTier) {
  return tier === "core" ? "aluminium" : "carbon";
}

function stageFor(category: string | null, bomLineKey: string) {
  const value = (category ?? bomLineKey).toLowerCase();
  if (value.includes("frame") || value.includes("fork") || value.includes("raw"))
    return { no: 1, code: "RM", name: "Raw material & frame set", type: "raw_material" as const };
  if (value.includes("groupset") || value.includes("wheel") || value.includes("tyre") || value.includes("bottom-bracket"))
    return { no: 2, code: "MC", name: "Major component kitting", type: "component" as const };
  if (value.includes("handlebar") || value.includes("stem") || value.includes("saddle") || value.includes("bracket") || value.includes("cage"))
    return { no: 3, code: "SA", name: "Sub-assembly & fit", type: "subassembly" as const };
  return { no: 2, code: "MC", name: "Mapped BOM component", type: "component" as const };
}

async function requireProductionView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Production job-card permission denied.");
}

type OrderRow = {
  id: string;
  revision: number | string;
  plan_month: number | string;
  product_id: "aluminium" | "carbon" | "premiumCarbon";
  units: number | string;
  status: "lead" | "confirmed" | "delivered" | "cancelled";
  model_tier: ProductTier | null;
  variant_id: string | null;
  variant_name: string | null;
  configuration: ProductConfiguration;
};

type MappingRow = {
  id: string;
  model_id: string;
  bom_revision: string;
  bom_line_key: string;
  sku: string;
  quantity: number | string;
  unit: string;
  configuration_category: string | null;
  configuration_option_id: string | null;
};

async function releasedRows(
  sql: Awaited<ReturnType<typeof getSql>>,
  venture: string,
  modelId: string,
) {
  return sql.query<MappingRow>(
    `select id,model_id,bom_revision,bom_line_key,sku,quantity,unit,configuration_category,configuration_option_id
       from epr_bom_inventory_mappings
      where venture=$1 and model_id=$2 and status='active'
        and approved_by is not null and approved_at is not null
        and effective_from<=now() and (effective_to is null or effective_to>now())
      order by bom_revision,bom_line_key,sku`,
    [venture, modelId],
  );
}

async function activeReleasedMappings(
  sql: Awaited<ReturnType<typeof getSql>>,
  order: OrderRow,
): Promise<{ bomRevision: string; rows: MappingRow[]; authority: "variant" | "family-standard" }> {
  if (!order.model_tier || !order.variant_id) {
    throw new Error("A confirmed order must reference an exact released VINDY variant.");
  }
  const venture = ventureForTier(order.model_tier);
  const exactRows = await releasedRows(sql, venture, order.variant_id);
  const usingFamilyStandard = exactRows.length === 0;
  const rows = usingFamilyStandard
    ? await releasedRows(sql, venture, order.model_tier)
    : exactRows;

  if (!rows.length) {
    throw new Error(`No active approved BOM mapping exists for ${order.variant_id} or its ${order.model_tier} planning standard. Release a controlled BOM before Production.`);
  }
  const revisions = [...new Set(rows.map((row) => row.bom_revision))];
  if (revisions.length !== 1) {
    const scope = usingFamilyStandard ? order.model_tier : order.variant_id;
    throw new Error(`Production release is ambiguous: ${scope} has ${revisions.length} active BOM revisions (${revisions.join(", ")}). Supersede all but one.`);
  }
  const bomRevision = revisions[0];
  if (!bomRevision) throw new Error(`No active BOM revision is available for ${order.variant_id}.`);

  const configuration = order.configuration ?? {};
  const configured = validateConfiguration(order.variant_id, configuration);

  if (usingFamilyStandard) {
    // Family planning BOMs are allowed to release a production build only when the
    // order uses exactly the SKUs already approved in that family standard. Any
    // customer/configuration deviation still requires an exact-variant BOM release.
    const releasedSkuSet = new Set(rows.map((row) => row.sku));
    const deviations = configured.filter((item) => !releasedSkuSet.has(item.sku));
    if (deviations.length) {
      throw new Error(
        `${order.variant_id} differs from the released ${order.model_tier} standard BOM (${deviations.map((item) => item.sku).join(", ")}). Release an exact variant BOM before Production.`,
      );
    }
    return { bomRevision, rows, authority: "family-standard" };
  }

  const selected = rows.filter((row) => {
    if (!row.configuration_option_id) return true;
    if (!row.configuration_category) return false;
    return configuration[row.configuration_category as keyof ProductConfiguration] === row.configuration_option_id;
  });
  for (const item of configured) {
    const approved = selected.some(
      (mapping) => mapping.sku === item.sku && mapping.configuration_option_id === item.id,
    );
    if (!approved) {
      throw new Error(`${item.brand} ${item.model} (${item.sku}) is allowed by the catalogue but is not released in BOM ${bomRevision} for ${order.variant_id}.`);
    }
  }
  return { bomRevision, rows: selected, authority: "variant" };
}

/** Synchronize Production from the current central Sales-order revision. */
export const syncProductionJobCard = createServerFn({ method: "POST" })
  .validator(syncSchema)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const [order] = await sql.query<OrderRow>(
      `select id,revision,plan_month,product_id,units,status,model_tier,variant_id,variant_name,configuration
         from vyndi_sales_orders where id=$1`,
      [data.salesOrderId],
    );
    if (!order) throw new Error("Sales order not found in the central order authority.");

    const [existing] = await sql.query<{ id: string; status: string; sales_order_revision: number | string; approved_at:string|null }>(
      `select id,status,sales_order_revision,approved_at::text as approved_at from epr_production_job_cards where sales_order_id=$1 limit 1`,
      [order.id],
    );

    if (order.status === "lead") {
      return { id: existing?.id ?? null, created: false, synchronized: false, state: "pipeline" as const };
    }
    if (order.status === "cancelled") {
      if (!existing) return { id: null, created: false, synchronized: true, state: "cancelled" as const };
      await sql.query(`select release_epr_job_card_reservations($1,$2,$3)`, [existing.id, actor.userId, actor.role]);
      await sql.query(
        `update epr_production_job_cards set status='cancelled',sales_order_revision=$2,updated_by=$3,updated_at=now() where id=$1`,
        [existing.id, Number(order.revision), actor.userId],
      );
      await sql.query(
        `insert into vyndi_audit_events
          (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
         values ($1,'production_job_card',$2,$3,'cancelled_from_sales_order',$4,$5,$6,$7::jsonb)`,
        [`AUD-JC-${crypto.randomUUID()}`, existing.id, Number(order.revision), actor.userId, actor.role, order.id, JSON.stringify({ salesOrderStatus: order.status })],
      );
      return { id: existing.id, created: false, synchronized: true, state: "cancelled" as const };
    }
    if (order.status === "delivered") {
      if (!existing || existing.status !== "complete") throw new Error("An order cannot be treated as delivered until its production job card is complete.");
      return { id: existing.id, created: false, synchronized: true, state: "complete" as const };
    }
    if (!order.model_tier || !order.variant_id) throw new Error("Confirmed production demand requires model tier and exact variant.");
    if (existing?.approved_at && Number(existing.sales_order_revision) !== Number(order.revision)) {
      throw new Error("This build is already approved. Process a controlled production change instead of replacing its released order revision.");
    }

    const { bomRevision, rows: mappings, authority } = await activeReleasedMappings(sql, order);
    if (existing && existing.status === "in_progress" && Number(existing.sales_order_revision) !== Number(order.revision)) {
      throw new Error("This job card is already in progress. Put it on controlled hold and process a production change before revising the order.");
    }

    const jobId = existing?.id ?? `JBC-${crypto.randomUUID()}`;
    if (existing) {
      await sql.query(`select release_epr_job_card_reservations($1,$2,$3)`, [jobId, actor.userId, actor.role]);
      await sql.query(`delete from epr_production_job_card_lines where job_card_id=$1`, [jobId]);
      await sql.query(
        `update epr_production_job_cards set
           product_id=$2,product_label=$3,units=$4,bom_tier=$5,due_month=$6,status='released',
           model_tier=$5,variant_id=$7,configuration=$8::jsonb,sales_order_revision=$9,bom_revision=$10,
           released_mapping_set=$11::jsonb,updated_by=$12,updated_at=now()
         where id=$1`,
        [jobId, order.product_id, order.variant_name ?? order.variant_id, Number(order.units), order.model_tier, Number(order.plan_month), order.variant_id, JSON.stringify(order.configuration ?? {}), Number(order.revision), bomRevision, JSON.stringify(mappings.map((m) => m.id)), actor.userId],
      );
    } else {
      await sql.query(
        `insert into epr_production_job_cards
          (id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,
           model_tier,variant_id,configuration,sales_order_revision,bom_revision,released_mapping_set,updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,'released','operations',$8,$6,$9,$10::jsonb,$11,$12,$13::jsonb,$8)`,
        [jobId, order.id, order.product_id, order.variant_name ?? order.variant_id, Number(order.units), order.model_tier, Number(order.plan_month), actor.userId, order.variant_id, JSON.stringify(order.configuration ?? {}), Number(order.revision), bomRevision, JSON.stringify(mappings.map((m) => m.id))],
      );
    }

    for (const [index, mapping] of mappings.entries()) {
      const stage = stageFor(mapping.configuration_category, mapping.bom_line_key);
      const lineId = `${jobId}-${index + 1}`;
      const quantity = Number(order.units) * Number(mapping.quantity);
      await sql.query(
        `insert into epr_production_job_card_lines
          (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,sku,category,
           available_quantity,shortage_quantity,issue_status,bom_mapping_id,requirement_revision)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$8,'pending',$13,$14)`,
        [lineId, jobId, stage.no, stage.code, stage.name, stage.type, mapping.bom_line_key, quantity, mapping.unit, mapping.bom_line_key, mapping.sku, mapping.configuration_category, mapping.id, Number(order.revision)],
      );
      await sql.query(`select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`, [
        `RES-${crypto.randomUUID()}`, jobId, lineId, actor.userId, actor.role,
      ]);
    }

    const operations = [
      { no: 4, code: "FA", name: "Final assembly", item: "Final assembly" },
      { no: 5, code: "QC", name: "QC, release & packaging", item: "QC, release & packaging" },
    ];
    for (const [index, step] of operations.entries()) {
      await sql.query(
        `insert into epr_production_job_card_lines
          (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,issue_status,requirement_revision)
         values ($1,$2,$3,$4,$5,'operation',$6,$7,'operation',$6,'pending',$8)`,
        [`${jobId}-OP-${index + 1}`, jobId, step.no, step.code, step.name, step.item, Number(order.units), Number(order.revision)],
      );
    }

    await sql.query(
      `insert into vyndi_audit_events
        (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
       values ($1,'production_job_card',$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [`AUD-JC-${crypto.randomUUID()}`, jobId, Number(order.revision), existing ? "synchronized_to_sales_revision" : "released_from_sales_order", actor.userId, actor.role, order.id,
       JSON.stringify({ variantId: order.variant_id, bomRevision, bomAuthority: authority, mappingIds: mappings.map((m) => m.id), units: Number(order.units), dueMonth: Number(order.plan_month) })],
    );

    return { id: jobId, created: !existing, synchronized: true, state: "released" as const, salesOrderRevision: Number(order.revision), bomRevision, bomAuthority: authority };
  });

export const refreshProductionReservations = createServerFn({ method: "POST" })
  .validator(z.object({ jobCardId: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const lines = await sql.query<{ id: string }>(`select id from epr_production_job_card_lines where job_card_id=$1 and sku is not null order by id`, [data.jobCardId]);
    for (const line of lines) {
      await sql.query(`select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`, [`RES-${crypto.randomUUID()}`, data.jobCardId, line.id, actor.userId, actor.role]);
    }
    return { ok: true, lineCount: lines.length };
  });

export const issueProductionReservation = createServerFn({ method: "POST" })
  .validator(z.object({ reservationId: z.string().min(1).max(160), travellerId: z.string().min(1).max(160) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const movementId = `MOV-${crypto.randomUUID()}`;
    const ledgerId = `LED-${crypto.randomUUID()}`;
    const rows = await sql.query<{ movement_id:string; ledger_id:string; resulting_balance:number|string; cogs_inr:number|string }>(
      `select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,
      [data.reservationId, data.travellerId, movementId, ledgerId, actor.userId, actor.role],
    );
    const row = rows[0];
    if (!row) throw new Error("Reservation issue was not posted.");
    return { ok:true, movementId:row.movement_id, ledgerId:row.ledger_id, resultingBalance:Number(row.resulting_balance), cogsInr:Number(row.cogs_inr) };
  });

export const getProductionJobCards = createServerFn({ method: "GET" }).handler(async () => {
  await requireProductionView();
  const sql = await getSql();
  const cards = await sql`
    select id,sales_order_id,sales_order_revision,product_id,product_label,units,bom_tier,due_month,status,
           production_owner,created_by,model_tier,variant_id,configuration,bom_revision,released_mapping_set,
           batch_code,approved_by,approved_at::text as approved_at,created_at::text as created_at,updated_at::text as updated_at
      from epr_production_job_cards order by due_month asc,created_at desc limit 500`;
  const lines = await sql`
    select job_card_line_id as id,job_card_id,sku,category,item,required_quantity as quantity,unit,
           physical_quantity as available_quantity,shortage_quantity,issue_status,bom_mapping_id,
           reserved_quantity,available_to_promise
      from vyndi_live_job_card_requirements order by job_card_id,job_card_line_id`;
  return { cards, lines };
});

export const getConfiguredDemandShortages = createServerFn({ method: "GET" }).handler(async () => {
  await requireProductionView();
  const sql = await getSql();
  return sql`
    select sales_order_id,product_label,variant_id,units,due_month,sku,category,item,
           required_quantity,physical_quantity as available_quantity,reserved_quantity,
           shortage_quantity,available_to_promise,unit,bom_revision,sales_order_revision
      from vyndi_live_job_card_requirements
     where job_card_status in ('released','in_progress') and sku is not null and shortage_quantity > 0
     order by due_month,shortage_quantity desc,sku`;
});