import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";
import { procurementSummary, type ProcurementForecastRow } from "@/lib/data/procurement-planning";

async function requireProcurementView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Procurement view permission denied.");
}

type PlanningTier = "core" | "pro" | "apex";
type PlanningMapping = {
  model_id: PlanningTier;
  bom_revision: string;
  bom_line_key: string;
  sku: string;
  quantity: number | string;
  unit: string;
};
type StockRow = {
  sku: string;
  unit: string;
  minimum_stock_level: number | string;
  planned_monthly_use: number | string;
  physical_quantity: number | string;
  reserved_quantity: number | string;
  available_to_promise: number | string;
};
type CommittedRow = {
  requirement_month: number | string;
  sku: string;
  unit: string;
  committed_requirement: number | string;
  reserved_quantity: number | string;
  physical_quantity: number | string;
  available_to_promise: number | string;
  committed_order_count: number | string;
};
type OpenPoRow = {
  requirement_month: number | string;
  sku: string;
  unit: string;
  open_po_quantity: number | string | null;
};
export type ReconciledRequirementRow = {
  requirementMonth: number;
  sku: string;
  unit: string;
  plannedRequirement: number;
  committedRequirement: number;
  grossRequirement: number;
  physicalQuantity: number;
  reservedQuantity: number;
  availableToPromise: number;
  minimumStockLevel: number;
  openPoQuantity: number;
  projectedOpeningStock: number;
  projectedEndingStock: number;
  netRequirement: number;
  demandBasis: "planned" | "committed" | "reconciled";
};

function canonicalUnit(value: string) {
  const unit = value.trim().toLowerCase();
  return unit === "unit" || unit === "each" ? "ea" : unit;
}

function plannedSkuRequirements(forecast: ProcurementForecastRow[], mappings: PlanningMapping[]) {
  const result = new Map<string, number>();
  for (const month of forecast) {
    const unitsByTier: Record<PlanningTier, number> = {
      core: month.coreUnits,
      pro: month.proUnits,
      apex: month.apexUnits,
    };
    for (const mapping of mappings) {
      const required = unitsByTier[mapping.model_id] * Number(mapping.quantity);
      if (required <= 0) continue;
      const unit = canonicalUnit(mapping.unit);
      const key = `${month.requirementMonth}|${mapping.sku}|${unit}`;
      result.set(key, (result.get(key) ?? 0) + required);
    }
  }
  return result;
}

export const getProcurementPlanningReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireProcurementView();
  const sql = await getSql();
  const summary = procurementSummary("base");
  const forecast = summary.rows as ProcurementForecastRow[];

  const actions = await sql`
    select id,scenario,plan_month,requirement_month,tranche_id,action_type,status,note,updated_at::text as updated_at
      from epr_procurement_plan_actions where scenario='base'
     order by requirement_month,plan_month,action_type
  `;
  const skuActions = await sql`
    select id,scenario,requirement_month,sku,unit,action_type,quantity,status,demand_basis,note,updated_by,updated_at::text as updated_at
      from epr_procurement_sku_actions where scenario='base'
     order by requirement_month,sku,unit,action_type
  `;
  const stock = await sql.query<StockRow>(
    `select i.sku,vyndi_canonical_unit(i.unit) as unit,i.minimum_stock_level,i.planned_monthly_use,
            coalesce(atp.physical_quantity,0) as physical_quantity,
            coalesce(atp.reserved_quantity,0) as reserved_quantity,
            coalesce(atp.available_to_promise,0) as available_to_promise
       from master_inventory_items i
       left join vyndi_inventory_available_to_promise atp
         on atp.sku=i.sku and atp.unit=vyndi_canonical_unit(i.unit)
      where i.active=true
      order by i.ledger_id,i.sku`,
  );
  const committed = await sql.query<CommittedRow>(
    `select requirement_month,sku,unit,committed_requirement,reserved_quantity,physical_quantity,
            available_to_promise,committed_order_count
       from vyndi_committed_procurement_requirements
      order by requirement_month,sku,unit`,
  );
  const planningMappings = await sql.query<PlanningMapping>(
    `select model_id,bom_revision,bom_line_key,sku,quantity,vyndi_canonical_unit(unit) as unit
       from epr_bom_inventory_mappings
      where model_id in ('core','pro','apex') and status='active'
        and configuration_option_id is null
        and approved_by is not null and approved_at is not null
        and effective_from<=now() and (effective_to is null or effective_to>now())
      order by model_id,bom_revision,bom_line_key,sku`,
  );
  const openPos = await sql.query<OpenPoRow>(
    `select requirement_month,sku,vyndi_canonical_unit(unit) as unit,coalesce(open_po_quantity,0) as open_po_quantity
       from vyndi_open_purchase_orders where scenario='base'`,
  );
  const unprojectedCommitments = await sql.query<{
    id: string;
    revision: number | string;
    plan_month: number | string;
    variant_id: string | null;
    variant_name: string | null;
    units: number | string;
    job_card_id: string | null;
    job_card_status: string | null;
    sales_order_revision: number | string | null;
    bom_revision: string | null;
  }>(
    `select o.id,o.revision,o.plan_month,o.variant_id,o.variant_name,o.units,
            c.id as job_card_id,c.status as job_card_status,c.sales_order_revision,c.bom_revision
       from vyndi_sales_orders o
       left join epr_production_job_cards c on c.sales_order_id=o.id
      where o.status='confirmed'
        and (c.id is null or c.sales_order_revision<>o.revision or c.bom_revision is null or c.status not in ('released','in_progress','complete'))
      order by o.plan_month,o.id`,
  );

  const planningMappingIssues: string[] = [];
  const usablePlanningMappings: PlanningMapping[] = [];
  const tierNames: Record<PlanningTier, string> = { core: "Longitude", pro: "Latitude", apex: "Altitude" };
  for (const tier of ["core", "pro", "apex"] as const) {
    const tierRows = planningMappings.filter((row) => row.model_id === tier);
    const revisions = [...new Set(tierRows.map((row) => row.bom_revision))];
    if (revisions.length === 1) usablePlanningMappings.push(...tierRows);
    else if (revisions.length === 0)
      planningMappingIssues.push(`No approved planning-standard BOM mapping exists for ${tierNames[tier]}.`);
    else
      planningMappingIssues.push(`${tierNames[tier]} has ${revisions.length} simultaneous planning BOM revisions (${revisions.join(", ")}).`);
  }

  const planned = plannedSkuRequirements(forecast, usablePlanningMappings);
  const committedByKey = new Map<string, number>();
  for (const row of committed) {
    committedByKey.set(
      `${Number(row.requirement_month)}|${row.sku}|${canonicalUnit(row.unit)}`,
      Number(row.committed_requirement),
    );
  }
  const stockByKey = new Map<string, StockRow>();
  for (const row of stock) stockByKey.set(`${row.sku}|${canonicalUnit(row.unit)}`, row);
  const openPoByKey = new Map<string, number>();
  for (const row of openPos) {
    openPoByKey.set(
      `${Number(row.requirement_month)}|${row.sku}|${canonicalUnit(row.unit)}`,
      Number(row.open_po_quantity ?? 0),
    );
  }

  const skuUnits = new Set<string>();
  for (const key of planned.keys()) skuUnits.add(key.split("|").slice(1).join("|"));
  for (const key of committedByKey.keys()) skuUnits.add(key.split("|").slice(1).join("|"));

  const requirements: ReconciledRequirementRow[] = [];
  for (const skuUnit of [...skuUnits].sort()) {
    const splitAt = skuUnit.lastIndexOf("|");
    const sku = skuUnit.slice(0, splitAt);
    const unit = skuUnit.slice(splitAt + 1);
    const inventory = stockByKey.get(`${sku}|${unit}`);
    const physicalQuantity = Number(inventory?.physical_quantity ?? 0);
    const reservedQuantity = Number(inventory?.reserved_quantity ?? 0);
    const availableToPromise = Number(inventory?.available_to_promise ?? 0);
    const minimumStockLevel = Number(inventory?.minimum_stock_level ?? 0);
    let projectedStock = physicalQuantity;

    for (let month = 1; month <= 36; month += 1) {
      const key = `${month}|${sku}|${unit}`;
      const plannedRequirement = planned.get(key) ?? 0;
      const committedRequirement = committedByKey.get(key) ?? 0;
      const grossRequirement = Math.max(plannedRequirement, committedRequirement);
      const openPoQuantity = openPoByKey.get(key) ?? 0;
      if (grossRequirement <= 0 && openPoQuantity <= 0) continue;
      const projectedOpeningStock = projectedStock + openPoQuantity;
      const netRequirement = Math.max(grossRequirement + minimumStockLevel - projectedOpeningStock, 0);
      projectedStock = projectedOpeningStock + netRequirement - grossRequirement;
      const demandBasis =
        committedRequirement > plannedRequirement ? "committed" :
        plannedRequirement > committedRequirement ? "planned" : "reconciled";
      requirements.push({
        requirementMonth: month,
        sku,
        unit,
        plannedRequirement,
        committedRequirement,
        grossRequirement,
        physicalQuantity,
        reservedQuantity,
        availableToPromise,
        minimumStockLevel,
        openPoQuantity,
        projectedOpeningStock,
        projectedEndingStock: projectedStock,
        netRequirement,
        demandBasis,
      });
    }
  }

  return { summary, forecast, actions, skuActions, stock, committed, requirements, planningMappingIssues, unprojectedCommitments };
});

export const setProcurementPlanningAction = createServerFn({ method: "POST" })
  .validator(z.object({
    planMonth: z.number().int().min(1).max(36),
    requirementMonth: z.number().int().min(1).max(36),
    trancheId: z.string().max(120).nullable().optional(),
    actionType: z.enum(["plan", "rfq", "approval", "po", "receipt", "hold"]),
    status: z.enum(["planned", "in_progress", "complete", "on_hold", "cancelled"]),
    note: z.string().max(1000).optional(),
  }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const id = `PPA-base-${data.planMonth}-${data.requirementMonth}-${data.actionType}`;
    await sql.query(
      `insert into epr_procurement_plan_actions
        (id,scenario,plan_month,requirement_month,tranche_id,action_type,status,note,updated_at)
       values ($1,'base',$2,$3,$4,$5,$6,$7,now())
       on conflict (id) do update set status=excluded.status,note=excluded.note,tranche_id=excluded.tranche_id,updated_at=now()`,
      [id,data.planMonth,data.requirementMonth,data.trancheId ?? null,data.actionType,data.status,data.note ?? ""],
    );
    await sql.query(
      `insert into vyndi_audit_events
        (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
       values ($1,'procurement_plan_action',$2,'status_changed',$3,$4,$5::jsonb)`,
      [`AUD-${crypto.randomUUID()}`,id,actor.userId,actor.role,JSON.stringify(data)],
    );
    return { ok: true, id };
  });

export const setProcurementSkuAction = createServerFn({ method: "POST" })
  .validator(z.object({
    requirementMonth: z.number().int().min(1).max(36),
    sku: z.string().trim().min(1).max(120),
    unit: z.string().trim().min(1).max(30),
    actionType: z.enum(["rfq", "approval", "po", "receipt", "hold"]),
    quantity: z.number().min(0).max(1_000_000_000),
    status: z.enum(["planned", "in_progress", "complete", "on_hold", "cancelled"]),
    demandBasis: z.enum(["planned", "committed", "reconciled"]),
    note: z.string().max(1000).optional(),
  }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const safeSku = data.sku.toUpperCase();
    const unit = canonicalUnit(data.unit);
    const id = `PSA-base-M${data.requirementMonth}-${safeSku}-${unit}-${data.actionType}`;
    await sql.query(
      `insert into epr_procurement_sku_actions
        (id,scenario,requirement_month,sku,unit,action_type,quantity,status,demand_basis,note,updated_by,updated_at)
       values ($1,'base',$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       on conflict (id) do update set quantity=excluded.quantity,status=excluded.status,
         demand_basis=excluded.demand_basis,note=excluded.note,updated_by=excluded.updated_by,updated_at=now()`,
      [id,data.requirementMonth,safeSku,unit,data.actionType,data.quantity,data.status,data.demandBasis,data.note ?? "",actor.userId],
    );
    await sql.query(
      `insert into vyndi_audit_events
        (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
       values ($1,'procurement_sku_action',$2,'upserted',$3,$4,$5::jsonb)`,
      [`AUD-${crypto.randomUUID()}`,id,actor.userId,actor.role,JSON.stringify({ ...data,sku:safeSku,unit })],
    );
    return { ok: true, id };
  });

export const getProcurementPlanningMethod = createServerFn({ method: "GET" }).handler(async () => {
  await requireProcurementView();
  return {
    planningLeadMonths: 2,
    horizonMonths: 36,
    principles: [
      "Planned demand uses one approved planning-standard BOM per VINDY family; committed demand uses the exact released variant BOM.",
      "Planned and committed demand remain visible separately; the larger signal governs so confirmed orders never double-count forecast demand.",
      "Physical stock is the single EPR FIFO ledger; reservations reduce ATP without moving quantity.",
      "Open purchase orders and projected inventory are carried month-to-month; MSL remains protected as safety stock.",
      "Planning early does not move finance cash timing unless the approved PO/receipt timing changes.",
    ],
  };
});
