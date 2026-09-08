import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSql, type JsonValue, type Sql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";
import { buildModelWithInputs, type FinanceAssumptions, type ProductLineId } from "@/lib/finance/model";
import {
  type BomRequirement,
  type CapacityPosition,
  type CashFlow,
  type DemandSignal,
  type IntegratedPlanningResult,
  type InventoryPosition,
  type InventoryReceipt,
  type InventoryReservation,
} from "@/lib/integrated-business-planning-engine";
import { runRuntimeIbpe, type RuntimeIbpeInput } from "@/lib/ibpe-runtime-parity";

export const IBPE_ENGINE_VERSION = "VYNDI-IBPE-1.1.0";
export type IbpeValidation = Record<string, JsonValue>;

export type IbpeRun = {
  id: string;
  engineVersion: string;
  sourceSha: string;
  inputHash: string;
  approvedPlanId: string;
  approvedPlanRevision: number;
  scenario: "base" | "delayed" | "stress";
  snapshotAt: string;
  status: "complete" | "invalidated";
  result: IntegratedPlanningResult;
  validation: IbpeValidation;
  createdAt: string;
};

export type IbpeReadinessCheck = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
  actionTo: string;
};

export type IbpeReadiness = {
  ready: boolean;
  checks: IbpeReadinessCheck[];
  counts: {
    approvedPlans: number;
    approvedInventoryMasters: number;
    activeInventoryItems: number;
    supplyPlanningRows: number;
    capacityStandardRows: number;
    completeRuns: number;
    longitudeBomRevisions: number;
    latitudeBomRevisions: number;
    altitudeBomRevisions: number;
  };
};

type ApprovedPlanRow = {
  id: string;
  revision: number | string;
  scenario: "base" | "delayed" | "stress";
  draw_standby: boolean;
  finance_json: FinanceAssumptions;
};

const PRODUCT_TIER: Record<ProductLineId, "core" | "pro" | "apex"> = {
  aluminium: "core",
  carbon: "pro",
  premiumCarbon: "apex",
};
const TIER_PRODUCT: Record<string, ProductLineId> = { core: "aluminium", pro: "carbon", apex: "premiumCarbon" };

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  }
  return value;
}
function stableJson(value: unknown) { return JSON.stringify(stable(value)); }
function sha256(value: unknown) { return createHash("sha256").update(stableJson(value)).digest("hex"); }
function positiveNumber(value: number | string | null | undefined) {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function sourceSha() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.VYNDI_SOURCE_SHA;
  if (!sha || sha.trim().length < 7) throw new Error("Governed IBPE run blocked: deployed source SHA is unavailable.");
  return sha.trim();
}

async function approvedPlan(sql: Sql): Promise<ApprovedPlanRow> {
  const rows = await sql.query<ApprovedPlanRow>(
    `select id,revision,scenario,draw_standby,finance_json from vyndi_plan_revisions where status='approved' order by revision desc limit 2`,
  );
  if (rows.length !== 1) throw new Error(rows.length ? "Governed IBPE run blocked: more than one approved operating plan exists." : "Governed IBPE run blocked: no approved operating plan exists.");
  return rows[0];
}

async function readIbpeReadiness(sql: Sql): Promise<IbpeReadiness> {
  const [summary] = await sql.query<{
    approved_plans: number | string;
    approved_inventory_masters: number | string;
    active_inventory_items: number | string;
    supply_planning_rows: number | string;
    capacity_standard_rows: number | string;
    complete_runs: number | string;
  }>(`select
      (select count(*) from vyndi_plan_revisions where status='approved') as approved_plans,
      (select count(*) from master_data_records where domain='inventory' and status='approved') as approved_inventory_masters,
      (select count(*) from master_inventory_items where active=true) as active_inventory_items,
      (select count(*) from vyndi_supply_planning_parameters where planning_status<>'retired') as supply_planning_rows,
      (select count(*) from vyndi_capacity_standards where planning_status<>'retired') as capacity_standard_rows,
      (select count(*) from vyndi_ibpe_runs where status='complete') as complete_runs`);
  const bomRows = await sql.query<{ model_id:string; revisions:number|string }>(
    `select model_id,count(distinct bom_revision) as revisions
       from epr_bom_inventory_mappings
      where model_id in ('core','pro','apex') and status='active'
        and configuration_option_id is null and approved_by is not null and approved_at is not null
        and effective_from<=now() and (effective_to is null or effective_to>now())
      group by model_id`,
  );
  const bom = new Map(bomRows.map((row) => [row.model_id, Number(row.revisions)]));
  const counts = {
    approvedPlans: Number(summary?.approved_plans ?? 0),
    approvedInventoryMasters: Number(summary?.approved_inventory_masters ?? 0),
    activeInventoryItems: Number(summary?.active_inventory_items ?? 0),
    supplyPlanningRows: Number(summary?.supply_planning_rows ?? 0),
    capacityStandardRows: Number(summary?.capacity_standard_rows ?? 0),
    completeRuns: Number(summary?.complete_runs ?? 0),
    longitudeBomRevisions: bom.get("core") ?? 0,
    latitudeBomRevisions: bom.get("pro") ?? 0,
    altitudeBomRevisions: bom.get("apex") ?? 0,
  };
  const checks: IbpeReadinessCheck[] = [
    {
      key:"approved-plan",
      label:"Approved operating plan",
      ready:counts.approvedPlans===1,
      detail:counts.approvedPlans===1 ? "One approved 36-month company plan is available." : counts.approvedPlans===0 ? "No approved operating plan exists." : `${counts.approvedPlans} approved plans exist; exactly one is required.`,
      actionTo:"/command/planning",
    },
    {
      key:"inventory-master",
      label:"Approved Inventory Master",
      ready:counts.approvedInventoryMasters>0,
      detail:counts.approvedInventoryMasters>0 ? `${counts.approvedInventoryMasters} approved Inventory Master records.` : "Operational SKUs exist, but none are approved in Master Data governance.",
      actionTo:"/command/master-data",
    },
    {
      key:"longitude-bom",
      label:"Longitude planning BOM",
      ready:counts.longitudeBomRevisions===1,
      detail:`${counts.longitudeBomRevisions} active approved planning revision(s); exactly one is required.`,
      actionTo:"/command/bom-inventory-mapping",
    },
    {
      key:"latitude-bom",
      label:"Latitude planning BOM",
      ready:counts.latitudeBomRevisions===1,
      detail:`${counts.latitudeBomRevisions} active approved planning revision(s); exactly one is required.`,
      actionTo:"/command/bom-inventory-mapping",
    },
    {
      key:"altitude-bom",
      label:"Altitude planning BOM",
      ready:counts.altitudeBomRevisions===1,
      detail:`${counts.altitudeBomRevisions} active approved planning revision(s); exactly one is required.`,
      actionTo:"/command/bom-inventory-mapping",
    },
    {
      key:"inventory",
      label:"Master Inventory",
      ready:counts.activeInventoryItems>0,
      detail:`${counts.activeInventoryItems} active operational SKU(s).`,
      actionTo:"/command/inventory",
    },
    {
      key:"supply-parameters",
      label:"Supply planning parameters",
      ready:counts.supplyPlanningRows>0,
      detail:`${counts.supplyPlanningRows} active planning parameter row(s).`,
      actionTo:"/command/procurement-planning",
    },
    {
      key:"capacity",
      label:"Capacity standards",
      ready:counts.capacityStandardRows>0,
      detail:`${counts.capacityStandardRows} active capacity standard row(s).`,
      actionTo:"/command/capacity",
    },
  ];
  return { ready:checks.every((check) => check.ready), checks, counts };
}

async function buildGovernedInput(sql: Sql, plan: ApprovedPlanRow) {
  const finance = plan.finance_json;
  if (!finance?.operatingPlan) throw new Error("Governed IBPE run blocked: approved plan has no operatingPlan payload.");
  const model = buildModelWithInputs(plan.scenario, Boolean(plan.draw_standby), finance);

  const orders = await sql.query<{ plan_month:number|string; product_id:ProductLineId; confirmed:number|string }>(
    `select plan_month,product_id,coalesce(sum(units),0) as confirmed from vyndi_sales_orders where status='confirmed' group by plan_month,product_id order by plan_month,product_id`,
  );
  const actualProductRows = await sql.query<{ plan_month:number|string; product_id:ProductLineId; actual_units:number|string }>(
    `select i.plan_month,o.product_id,coalesce(sum(i.units),0) as actual_units
       from vyndi_invoices i join vyndi_sales_orders o on o.id=i.sales_order_id
      where i.status='issued'
      group by i.plan_month,o.product_id
      order by i.plan_month,o.product_id`,
  );
  const confirmed = new Map(orders.map((r) => [`${Number(r.plan_month)}|${r.product_id}`, Number(r.confirmed)]));
  const actualByProduct = new Map(actualProductRows.map((r) => [`${Number(r.plan_month)}|${r.product_id}`, Number(r.actual_units)]));

  const demand: DemandSignal[] = [];
  for (const row of model) {
    const planned: Record<ProductLineId, number> = { aluminium: row.aluminiumUnits, carbon: row.carbonUnits, premiumCarbon: row.premiumCarbonUnits };
    for (const productId of Object.keys(PRODUCT_TIER) as ProductLineId[]) {
      const planQty = planned[productId];
      const committedQty = confirmed.get(`${row.m}|${productId}`) ?? 0;
      const actualQty = actualByProduct.get(`${row.m}|${productId}`) ?? 0;
      demand.push({
        id: `M${row.m}-${productId}`,
        productId,
        period: row.m,
        planQty,
        forecastQty: Math.max(planQty, committedQty + actualQty),
        committedQty,
        actualQty,
        confidence: actualQty > 0 || committedQty > 0 ? 1 : 0.7,
        sourceRef: actualQty > 0 ? "ISSUED-INVOICE-LEDGER" : `PLAN-${plan.id}-R${plan.revision}`,
      });
    }
  }

  const mappingRows = await sql.query<{ model_id:string; bom_revision:string; bom_line_key:string; sku:string; quantity:number|string }>(
    `select model_id,bom_revision,bom_line_key,sku,quantity from epr_bom_inventory_mappings
      where model_id in ('core','pro','apex') and status='active' and configuration_option_id is null
        and approved_by is not null and approved_at is not null and effective_from<=now() and (effective_to is null or effective_to>now())
      order by model_id,bom_revision,bom_line_key,sku`,
  );
  const revisionByTier = new Map<string, Set<string>>();
  for (const row of mappingRows) {
    if (!revisionByTier.has(row.model_id)) revisionByTier.set(row.model_id, new Set());
    revisionByTier.get(row.model_id)!.add(row.bom_revision);
  }
  for (const tier of ["core","pro","apex"]) {
    const revisions = revisionByTier.get(tier) ?? new Set<string>();
    if (revisions.size !== 1) throw new Error(`Governed IBPE run blocked: ${tier} requires exactly one approved planning BOM revision; found ${revisions.size}.`);
  }
  const bom: BomRequirement[] = mappingRows.map((r) => ({
    id: `${r.model_id}:${r.bom_revision}:${r.bom_line_key}:${r.sku}`,
    productId: TIER_PRODUCT[r.model_id],
    revisionId: r.bom_revision,
    approved: true,
    sku: r.sku,
    quantityPerUnit: Number(r.quantity),
    sourceRef: `BOM-${r.bom_revision}`,
  }));

  const supplyParameterRows = await sql.query<{
    sku:string;
    lead_time_months:number|string;
    moq:number|string;
    order_multiple:number|string;
    payment_lag_months:number|string;
    planning_status:string;
    source_ref:string;
  }>(
    `select sku,lead_time_months,moq,order_multiple,payment_lag_months,planning_status,source_ref
       from vyndi_supply_planning_parameters
      where planning_status <> 'retired'
      order by sku`,
  );
  const supplyParameters = new Map(supplyParameterRows.map((r) => [r.sku, r]));

  const inventoryRows = await sql.query<{
    sku:string;
    minimum_stock_level:number|string;
    physical_quantity:number|string;
    reserved_quantity:number|string;
    available_to_promise:number|string;
    fifo_cost_inr:number|string|null;
    planning_cost_inr:number|string|null;
  }>(
    `select i.sku,i.minimum_stock_level,coalesce(a.physical_quantity,0) as physical_quantity,
            coalesce(a.reserved_quantity,0) as reserved_quantity,coalesce(a.available_to_promise,0) as available_to_promise,
            (select sum(f.quantity_remaining*f.unit_cost_inr)/nullif(sum(f.quantity_remaining),0)
               from epr_inventory_fifo_layers f where f.sku=i.sku and f.quantity_remaining>0) as fifo_cost_inr,
            (select nullif((m.attributes->>'legacyPriceInr')::numeric,0)
               from master_data_records m
              where m.domain='inventory' and m.status='approved' and m.code=i.sku
              order by m.revision desc limit 1) as planning_cost_inr
       from master_inventory_items i left join vyndi_inventory_available_to_promise a on a.sku=i.sku and a.unit=vyndi_canonical_unit(i.unit)
      where i.active=true order by i.sku`,
  );
  if (!inventoryRows.length) throw new Error("Governed IBPE run blocked: canonical Master Inventory has no active items.");
  const costResolution = inventoryRows.map((r) => {
    const fifoCostInr = positiveNumber(r.fifo_cost_inr);
    const planningCostInr = positiveNumber(r.planning_cost_inr);
    const governedCostInr = fifoCostInr ?? planningCostInr;
    const costAuthority = fifoCostInr !== undefined
      ? "EPR-FIFO-ACTUAL"
      : planningCostInr !== undefined
        ? "APPROVED-INVENTORY-MASTER"
        : "MISSING";
    return { row:r, fifoCostInr, planningCostInr, governedCostInr, costAuthority };
  });
  const inventory: InventoryPosition[] = costResolution.map(({ row:r, governedCostInr, costAuthority }) => {
    const planning = supplyParameters.get(r.sku);
    const inventoryAuthority = planning ? `EPR-FIFO-ATP+${planning.source_ref}` : "EPR-FIFO-ATP";
    return {
      sku:r.sku,
      onHandQty:Number(r.physical_quantity),
      reservedQty:Number(r.reserved_quantity),
      mslQty:Number(r.minimum_stock_level),
      safetyStockQty:Number(r.minimum_stock_level),
      unitCostLakh:governedCostInr === undefined ? undefined : governedCostInr/100000,
      leadTimeMonths:planning ? Number(planning.lead_time_months) : 0,
      moq:planning ? Number(planning.moq) : 0,
      orderMultiple:planning ? Number(planning.order_multiple) : 1,
      sourceRef:`${inventoryAuthority}+COST:${costAuthority}`,
    };
  });
  const fifoActualCostSkus = costResolution.filter((entry) => entry.fifoCostInr !== undefined).length;
  const approvedMasterPlanningCostFallbackSkus = costResolution.filter((entry) => entry.fifoCostInr === undefined && entry.planningCostInr !== undefined).length;
  const missingControlledCostSkus = costResolution.filter((entry) => entry.governedCostInr === undefined).map((entry) => entry.row.sku);

  const reservationRows = await sql.query<{ id:string; sku:string; quantity_reserved:number|string; status:"active"|"released"|"consumed"; plan_month:number|string }>(
    `select r.id,r.sku,r.quantity_reserved,r.status,o.plan_month from epr_inventory_reservations r
       join vyndi_sales_orders o on o.id=r.sales_order_id where r.status in ('active','released','consumed') order by o.plan_month,r.id`,
  );
  const reservations: InventoryReservation[] = reservationRows.map((r) => ({ id:r.id,sku:r.sku,period:Number(r.plan_month),quantity:Number(r.quantity_reserved),status:r.status,demandRef:r.id,sourceRef:"EPR-RESERVATION" }));

  const poRows = await sql.query<{ requirement_month:number|string; sku:string; open_po_quantity:number|string }>(
    `select requirement_month,sku,open_po_quantity from vyndi_open_purchase_orders where scenario=$1 and coalesce(open_po_quantity,0)>0 order by requirement_month,sku`, [plan.scenario],
  );
  const receipts: InventoryReceipt[] = poRows.map((r) => ({ id:`PO-M${r.requirement_month}-${r.sku}`,sku:r.sku,period:Number(r.requirement_month),quantity:Number(r.open_po_quantity),truth:"committed",sourceRef:"PROCUREMENT-OPEN-PO" }));

  const capacityStandardRows = await sql.query<{
    work_centre_id:string;
    available_hours_per_month:number|string;
    efficiency:number|string;
    standard_hours_per_unit:number|string;
    planning_status:string;
    source_ref:string;
  }>(
    `select work_centre_id,available_hours_per_month,efficiency,standard_hours_per_unit,planning_status,source_ref
       from vyndi_capacity_standards
      where planning_status <> 'retired'
      order by sequence,work_centre_id`,
  );
  const capacity: CapacityPosition[] = [];
  for (const standard of capacityStandardRows) {
    const standardHours = Number(standard.standard_hours_per_unit);
    const capacityUnits = standardHours > 0
      ? Number(standard.available_hours_per_month) * Number(standard.efficiency) / standardHours
      : 0;
    for (let period = 1; period <= 36; period += 1) {
      capacity.push({
        id:`${standard.work_centre_id}-M${period}`,
        period,
        capacityUnits,
        sourceRef:`${standard.source_ref}:${standard.work_centre_id}`,
      });
    }
  }

  const cashFlows: CashFlow[] = [];
  for (const row of model) {
    cashFlows.push(
      { id:`plan-sales-${row.m}`,businessKey:`sales-M${row.m}`,period:row.m,direction:"inflow",amountLakh:row.revenue,truth:"plan",category:"sales",sourceRef:`PLAN-${plan.id}-R${plan.revision}` },
      { id:`plan-funding-${row.m}`,businessKey:`funding-M${row.m}`,period:row.m,direction:"inflow",amountLakh:row.funding,truth:"plan",category:"funding",sourceRef:`PLAN-${plan.id}-R${plan.revision}` },
      { id:`plan-opex-${row.m}`,businessKey:`opex-M${row.m}`,period:row.m,direction:"outflow",amountLakh:row.opex,truth:"plan",category:"opex",sourceRef:`PLAN-${plan.id}-R${plan.revision}` },
      { id:`plan-capex-${row.m}`,businessKey:`capex-M${row.m}`,period:row.m,direction:"outflow",amountLakh:row.capex,truth:"plan",category:"capex",sourceRef:`PLAN-${plan.id}-R${plan.revision}` },
    );
  }
  const collectionRows = await sql.query<{ plan_month:number|string; amount:number|string }>(
    `select plan_month,coalesce(sum(amount_lakh),0) as amount from vyndi_collections where status='posted' group by plan_month order by plan_month`,
  );
  for (const r of collectionRows) cashFlows.push({ id:`actual-sales-${r.plan_month}`,businessKey:`sales-M${r.plan_month}`,period:Number(r.plan_month),direction:"inflow",amountLakh:Number(r.amount),truth:"actual",category:"collections",sourceRef:"COLLECTION-LEDGER" });

  const input: RuntimeIbpeInput = {
    demand,bom,inventory,reservations,receipts,capacity,cashFlows,
    funding:{ openingBankCashLakh:finance.openingCashLakh,minimumOperatingReserveLakh:finance.operatingPlan.cashFloorLakh,restrictedCashLakh:0,fundraisingLeadMonths:3 },
    runtimeControls:{
      paymentLagBySku:Object.fromEntries(supplyParameterRows.map((row) => [row.sku, Number(row.payment_lag_months)])),
    },
  };
  const validation: IbpeValidation = {
    approvedPlan:`${plan.id}:R${plan.revision}`,
    demandSignals:demand.length,
    approvedBomRows:bom.length,
    inventorySkus:inventory.length,
    reservations:reservations.length,
    committedReceipts:receipts.length,
    cashFlows:cashFlows.length,
    supplyPlanningParameters:supplyParameterRows.length,
    supplyPlanningDefaults:supplyParameterRows.filter((r) => r.planning_status === "planning-default").length,
    paymentLagParameters:supplyParameterRows.filter((r) => Number(r.payment_lag_months) > 0).length,
    paymentLagRuntimeParity:"applied-stage-2",
    paymentLagAuthority:"vyndi_supply_planning_parameters.payment_lag_months",
    fifoActualCostSkus,
    approvedMasterPlanningCostFallbackSkus,
    missingControlledCostSkus:missingControlledCostSkus.join(","),
    inventoryCostAuthority:"EPR FIFO weighted actual cost -> approved Inventory Master planning reference -> explicit missing-cost exception",
    capacityStandards:capacityStandardRows.length,
    capacityConstraints:capacity.length,
    capacityAuthority:"vyndi_capacity_standards",
    capacitySummarySemantics:"unique-shortfall-months-stage-2",
    planningInputs:["vyndi_supply_planning_parameters","vyndi_capacity_standards","master_data_records:approved-inventory-planning-cost"],
    transactionInputs:["vyndi_sales_orders","vyndi_invoices","epr_bom_inventory_mappings","vyndi_inventory_available_to_promise","epr_inventory_reservations","vyndi_open_purchase_orders","vyndi_collections"],
  };
  return { input, validation };
}

function mapRun(row: Record<string, unknown>): IbpeRun {
  return {
    id:String(row.id),engineVersion:String(row.engine_version),sourceSha:String(row.source_sha),inputHash:String(row.input_hash),
    approvedPlanId:String(row.approved_plan_id),approvedPlanRevision:Number(row.approved_plan_revision),scenario:row.scenario as IbpeRun["scenario"],
    snapshotAt:String(row.snapshot_at),status:row.status as IbpeRun["status"],result:row.result_json as IntegratedPlanningResult,
    validation:(row.validation_json ?? {}) as IbpeValidation,createdAt:String(row.created_at),
  };
}

export const getIbpeReadiness = createServerFn({ method:"GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role,"view")) throw new Error("IBPE view permission denied.");
  const sql = await getSql();
  return readIbpeReadiness(sql);
});

export const runGovernedIbpe = createServerFn({ method:"POST" }).handler(async () => {
  // Governed IBPE persists an advisory, reproducible decision packet only. It does
  // not approve or mutate transaction truth, so an authorised Command session is
  // sufficient; transaction mutations remain protected by edit/approve actors.
  const actor = await requireBusinessActor("view");
  const sql = await getSql();
  const readiness = await readIbpeReadiness(sql);
  if (!readiness.ready) {
    const blockers = readiness.checks.filter((check) => !check.ready).map((check) => check.label);
    throw new Error(`Governed IBPE setup incomplete: ${blockers.join(" · ")}.`);
  }
  const plan = await approvedPlan(sql);
  const { input, validation } = await buildGovernedInput(sql, plan);
  const inputHash = sha256(input);
  const result = runRuntimeIbpe(input, { horizonMonths:36 });
  const sha = sourceSha();
  const snapshotAt = new Date().toISOString();
  const id = `IBPE-${plan.revision}-${inputHash.slice(0,12)}-${sha.slice(0,7)}`;
  const rows = await sql.query<{ id:string }>(
    `select persist_vyndi_ibpe_run($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13) as id`,
    [id,IBPE_ENGINE_VERSION,sha,inputHash,plan.id,Number(plan.revision),plan.scenario,snapshotAt,stableJson(input),stableJson(result),stableJson(validation),actor.userId,actor.role],
  );
  return { id:rows[0]?.id ?? id,inputHash,sourceSha:sha,planRevision:Number(plan.revision),result,validation };
});

export const getLatestIbpeRun = createServerFn({ method:"GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role,"view")) throw new Error("IBPE view permission denied.");
  const sql = await getSql();
  const rows = await sql.query<Record<string,unknown>>(
    `select id,engine_version,source_sha,input_hash,approved_plan_id,approved_plan_revision,scenario,snapshot_at::text,status,result_json,validation_json,created_at::text
       from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`,
  );
  return rows[0] ? mapRun(rows[0]) : null;
});

export const listIbpeRuns = createServerFn({ method:"GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role,"view")) throw new Error("IBPE view permission denied.");
  const sql = await getSql();
  const rows = await sql.query<Record<string,unknown>>(
    `select id,engine_version,source_sha,input_hash,approved_plan_id,approved_plan_revision,scenario,snapshot_at::text,status,result_json,validation_json,created_at::text
       from vyndi_ibpe_runs order by created_at desc limit 20`,
  );
  return rows.map(mapRun);
});