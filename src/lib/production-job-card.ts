import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { BOM } from "@/lib/data/bom";
import type { BomTier } from "@/lib/finance/bom-engine";
import { validateConfiguration } from "@/lib/product-configuration";

const tierFor = (product: string): BomTier =>
  product === "aluminium" ? "core" : product === "premiumCarbon" ? "apex" : "pro";

function stageFor(item: string) {
  const value = item.toLowerCase();
  if (value.startsWith("frame") || value === "fork")
    return { no: 1, code: "RM", name: "Raw material & frame set", type: "raw_material" as const };
  if (value === "groupset" || value === "wheelset" || value.startsWith("tyres"))
    return { no: 2, code: "MC", name: "Major component kitting", type: "component" as const };
  if (value.startsWith("cockpit") || value.startsWith("saddle"))
    return { no: 3, code: "SA", name: "Sub-assembly & fit", type: "subassembly" as const };
  if (value.startsWith("assembly"))
    return { no: 4, code: "FA", name: "Final assembly", type: "operation" as const };
  return { no: 5, code: "QC", name: "QC, release & packaging", type: "operation" as const };
}

async function requireProductionWrite() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "edit")) throw new Error("Production job-card permission denied.");
  return role;
}

async function insertRequirement(
  sql: Sql,
  input: {
    lineId: string;
    jobId: string;
    stage: ReturnType<typeof stageFor>;
    itemName: string;
    quantity: number;
    sku: string | null;
    category: string | null;
    cardStatus: "planned" | "released";
  },
) {
  if (!input.sku) {
    await sql`
      insert into epr_production_job_card_lines
        (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,sku,category,available_quantity,shortage_quantity,issue_status)
      values
        (${input.lineId},${input.jobId},${input.stage.no},${input.stage.code},${input.stage.name},${input.stage.type},${input.itemName},${input.quantity},'unit',${input.itemName},null,${input.category},0,0,'pending')
    `;
    return;
  }

  // One SQL statement owns the SKU advisory lock, availability calculation and
  // line insert. Open released/in-progress job-card demand is subtracted before
  // this card can claim stock, preventing two cards from double-counting the
  // same Master Inventory balance.
  await sql.query(
    `
      with inventory_lock as (
        select pg_advisory_xact_lock(hashtext(upper($1))) as locked
      ), physical as (
        select coalesce(sum(l.quantity_remaining), 0) as physical_quantity
        from master_inventory_items i
        left join master_inventory_lots l on l.item_id = i.id
        cross join inventory_lock
        where i.active = true and upper(i.sku) = upper($1)
      ), committed as (
        select coalesce(sum(line.quantity), 0) as committed_quantity
        from epr_production_job_card_lines line
        join epr_production_job_cards card on card.id = line.job_card_id
        where line.sku is not null
          and upper(line.sku) = upper($1)
          and card.status in ('released', 'in_progress')
          and line.issue_status in ('reserved', 'short')
      ), availability as (
        select greatest(
          coalesce((select physical_quantity from physical), 0) -
          coalesce((select committed_quantity from committed), 0),
          0
        ) as free_quantity
      )
      insert into epr_production_job_card_lines
        (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,sku,category,available_quantity,shortage_quantity,issue_status)
      select
        $2,$3,$4,$5,$6,$7,$8,$9,'unit',$8,upper($1),$10,
        free_quantity,
        greatest($9 - free_quantity, 0),
        case
          when $11 <> 'released' then 'pending'
          when greatest($9 - free_quantity, 0) > 0 then 'short'
          else 'reserved'
        end
      from availability
    `,
    [
      input.sku,
      input.lineId,
      input.jobId,
      input.stage.no,
      input.stage.code,
      input.stage.name,
      input.stage.type,
      input.itemName,
      input.quantity,
      input.category,
      input.cardStatus,
    ],
  );
}

export const createProductionJobCard = createServerFn({ method: "POST" })
  .validator(
    z.object({
      salesOrderId: z.string().min(1).max(100),
      productId: z.string().min(1).max(100),
      productLabel: z.string().min(1).max(200),
      units: z.number().positive(),
      dueMonth: z.number().int().min(1).max(36),
      status: z.enum(["planned", "released"]).default("released"),
      modelTier: z.enum(["core", "pro", "apex"]).optional(),
      variantId: z.string().min(1).max(100).optional(),
      configuration: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const role = await requireProductionWrite();
    const sql = await getSql();
    const existing =
      await sql`select id from epr_production_job_cards where sales_order_id=${data.salesOrderId} limit 1`;
    if (existing[0]) return { id: existing[0].id, created: false };

    const tier = data.modelTier ?? tierFor(data.productId);
    const configuredLines =
      data.variantId && data.configuration
        ? validateConfiguration(data.variantId, data.configuration)
        : null;
    const jobId = `JBC-${Date.now()}`;
    await sql`
      insert into epr_production_job_cards
        (id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,model_tier,variant_id,configuration)
      values
        (${jobId},${data.salesOrderId},${data.productId},${data.productLabel},${data.units},${tier},${data.dueMonth},${data.status},'operations',${role},${tier},${data.variantId ?? null},${JSON.stringify(data.configuration ?? {})}::jsonb)
    `;

    const physicalLines =
      configuredLines ??
      BOM.filter((line) => !["freight", "hs", "warranty"].includes(line.flag ?? ""));
    for (const [index, line] of physicalLines.entries()) {
      const itemName = "model" in line ? `${line.brand} ${line.model}` : line.item;
      const stage = stageFor("category" in line ? line.category : line.item);
      const quantity = data.units * ("quantityPerBike" in line ? line.quantityPerBike : 1);
      const sku = "sku" in line ? line.sku : null;
      const category = "category" in line ? line.category : null;
      await insertRequirement(sql, {
        lineId: `${jobId}-${index + 1}`,
        jobId,
        stage,
        itemName,
        quantity,
        sku,
        category,
        cardStatus: data.status,
      });
    }
    return { id: jobId, created: true };
  });

export const getProductionJobCards = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Production job-card permission denied.");
  const sql = await getSql();
  const cards = await sql`
    select id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,model_tier,variant_id,configuration,created_at::text as created_at
    from epr_production_job_cards order by due_month asc, created_at desc limit 500
  `;
  const lines = await sql`
    select id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,issue_status,sku,category,available_quantity,shortage_quantity
    from epr_production_job_card_lines order by job_card_id,stage_no,id
  `;
  return { cards, lines };
});

export const getConfiguredDemandShortages = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view"))
    throw new Error("Procurement shortage permission denied.");
  const sql = await getSql();

  // Recalculate shortages from current Master Inventory every time. Receipts,
  // cancellations and earlier-due demand therefore change the procurement queue
  // without relying on the job card's creation-time availability snapshot.
  return sql`
    with on_hand as (
      select upper(i.sku) as sku, coalesce(sum(l.quantity_remaining), 0) as on_hand
      from master_inventory_items i
      left join master_inventory_lots l on l.item_id = i.id
      where i.active = true
      group by upper(i.sku)
    ), ordered_demand as (
      select card.sales_order_id, card.product_label, card.variant_id, card.units, card.due_month,
        card.created_at, line.id as line_id, line.sku, line.category, line.item,
        line.quantity as required_quantity, line.unit, coalesce(stock.on_hand, 0) as on_hand,
        sum(line.quantity) over (
          partition by upper(line.sku)
          order by card.due_month, card.created_at, line.id
          rows between unbounded preceding and current row
        ) as cumulative_required,
        coalesce(sum(line.quantity) over (
          partition by upper(line.sku)
          order by card.due_month, card.created_at, line.id
          rows between unbounded preceding and 1 preceding
        ), 0) as prior_required
      from epr_production_job_card_lines line
      join epr_production_job_cards card on card.id = line.job_card_id
      left join on_hand stock on stock.sku = upper(line.sku)
      where card.status not in ('complete', 'cancelled') and line.sku is not null
    ), live_shortage as (
      select *,
        greatest(on_hand - prior_required, 0) as available_quantity,
        greatest(cumulative_required - on_hand, 0) - greatest(prior_required - on_hand, 0) as shortage_quantity
      from ordered_demand
    )
    select sales_order_id, product_label, variant_id, units, due_month, sku, category, item,
      required_quantity, available_quantity, shortage_quantity, unit
    from live_shortage
    where shortage_quantity > 0
    order by due_month, shortage_quantity desc, sku, line_id
  `;
});
