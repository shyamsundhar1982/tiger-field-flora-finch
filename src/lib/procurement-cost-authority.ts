import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";
import type { FinanceAssumptions, ProductLineId } from "@/lib/finance/model";

export type ProcurementCostAuthorityRow = {
  sku: string;
  unit: string;
  activePlanningBom: boolean;
  fifoActualCostInr?: number;
  approvedPurchasePriceInr?: number;
  approvedPurchasePriceRef?: string;
  approvedSupplierPriceInr?: number;
  approvedSupplierPriceRef?: string;
  approvedPlanningPriceInr?: number;
  approvedPlanningPriceRef?: string;
  legacyReferencePriceInr?: number;
  governedCostInr?: number;
  costAuthority: "EPR-FIFO-ACTUAL" | "APPROVED-PURCHASE-ORDER" | "APPROVED-SUPPLIER-PRICE" | "APPROVED-PLANNING-PROCUREMENT-PRICE" | "MISSING";
};

export type ProcurementCogsReconciliation = {
  modelId: "core" | "pro" | "apex";
  modelLabel: "Longitude" | "Latitude" | "Altitude";
  productId: ProductLineId;
  targetCogsLakh: number;
  bottomUpBomCostLakh?: number;
  varianceLakh?: number;
  variancePct?: number;
  coverageComplete: boolean;
  missingSkus: string[];
};

function positive(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function mapCostRow(row: Record<string, unknown>): ProcurementCostAuthorityRow {
  return {
    sku: String(row.sku),
    unit: String(row.unit),
    activePlanningBom: Boolean(row.active_planning_bom),
    fifoActualCostInr: positive(row.fifo_actual_cost_inr),
    approvedPurchasePriceInr: positive(row.approved_purchase_price_inr),
    approvedPurchasePriceRef: row.approved_purchase_price_ref ? String(row.approved_purchase_price_ref) : undefined,
    approvedSupplierPriceInr: positive(row.approved_supplier_price_inr),
    approvedSupplierPriceRef: row.approved_supplier_price_ref ? String(row.approved_supplier_price_ref) : undefined,
    approvedPlanningPriceInr: positive(row.approved_planning_price_inr),
    approvedPlanningPriceRef: row.approved_planning_price_ref ? String(row.approved_planning_price_ref) : undefined,
    legacyReferencePriceInr: positive(row.legacy_reference_price_inr),
    governedCostInr: positive(row.governed_cost_inr),
    costAuthority: String(row.cost_authority) as ProcurementCostAuthorityRow["costAuthority"],
  };
}

async function requireView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Procurement cost authority view permission denied.");
}

export const getProcurementCostAuthorityReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const [costRows, mappingRows, planRows, priceRows] = await Promise.all([
    sql.query<Record<string, unknown>>(
      `select * from vyndi_procurement_cost_authority where active_planning_bom=true order by sku`,
    ),
    sql.query<{ model_id:"core"|"pro"|"apex"; sku:string; quantity:number|string }>(
      `select model_id,sku,quantity
         from epr_bom_inventory_mappings
        where model_id in ('core','pro','apex') and status='active' and configuration_option_id is null
          and approved_by is not null and approved_at is not null
          and effective_from<=now() and (effective_to is null or effective_to>now())
        order by model_id,bom_line_key,sku`,
    ),
    sql.query<{ finance_json: FinanceAssumptions }>(
      `select finance_json from vyndi_plan_revisions where status='approved' order by revision desc limit 1`,
    ),
    sql.query<Record<string, unknown>>(
      `select id,sku,supplier_id,price_type,unit,unit_price_inr,currency,effective_from::text,effective_to::text,
              status,source_reference,notes,created_by,approved_by,approved_at::text,updated_by,updated_at::text
         from vyndi_procurement_prices
        where status<>'retired' and sku in (select sku from vyndi_procurement_cost_authority where active_planning_bom=true)
        order by sku,price_type,status,updated_at desc`,
    ),
  ]);

  const costs = costRows.map(mapCostRow);
  const costBySku = new Map(costs.map((row) => [row.sku, row]));
  const finance = planRows[0]?.finance_json;
  const targets = new Map((finance?.productLines ?? []).map((line) => [line.id, Number(line.cogsLakh)]));
  const modelProduct: Record<"core"|"pro"|"apex", ProductLineId> = { core:"aluminium", pro:"carbon", apex:"premiumCarbon" };
  const modelLabel: Record<"core"|"pro"|"apex", "Longitude"|"Latitude"|"Altitude"> = { core:"Longitude", pro:"Latitude", apex:"Altitude" };

  const reconciliation = (["core","pro","apex"] as const).map((modelId): ProcurementCogsReconciliation => {
    const rows = mappingRows.filter((row) => row.model_id === modelId);
    const missingSkus = [...new Set(rows.filter((row) => costBySku.get(row.sku)?.governedCostInr === undefined).map((row) => row.sku))].sort();
    const productId = modelProduct[modelId];
    const targetCogsLakh = targets.get(productId) ?? 0;
    const coverageComplete = rows.length > 0 && missingSkus.length === 0;
    const bottomUpBomCostLakh = coverageComplete
      ? rows.reduce((sum, row) => sum + Number(row.quantity) * Number(costBySku.get(row.sku)!.governedCostInr), 0) / 100000
      : undefined;
    const varianceLakh = bottomUpBomCostLakh === undefined ? undefined : bottomUpBomCostLakh - targetCogsLakh;
    const variancePct = varianceLakh === undefined || targetCogsLakh <= 0 ? undefined : (varianceLakh / targetCogsLakh) * 100;
    return { modelId,modelLabel:modelLabel[modelId],productId,targetCogsLakh,bottomUpBomCostLakh,varianceLakh,variancePct,coverageComplete,missingSkus };
  });

  return {
    costs,
    prices: priceRows,
    reconciliation,
    summary: {
      activePlanningBomSkus: costs.length,
      resolvedSkus: costs.filter((row) => row.governedCostInr !== undefined).length,
      unresolvedSkus: costs.filter((row) => row.governedCostInr === undefined).map((row) => row.sku),
      legacyReferenceOnlySkus: costs.filter((row) => row.governedCostInr === undefined && row.legacyReferencePriceInr !== undefined).map((row) => row.sku),
    },
  };
});

const priceDraftSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  sku: z.string().trim().min(1).max(120),
  supplierId: z.string().trim().max(120).nullable().optional(),
  priceType: z.enum(["supplier","planning"]),
  unit: z.string().trim().min(1).max(30).default("ea"),
  unitPriceInr: z.number().positive().max(1_000_000_000),
  currency: z.string().trim().min(3).max(3).default("INR"),
  effectiveFrom: z.string().trim().min(10).max(10),
  effectiveTo: z.string().trim().min(10).max(10).nullable().optional(),
  sourceReference: z.string().trim().min(1).max(500),
  notes: z.string().max(1000).optional(),
});

export const saveProcurementPriceDraft = createServerFn({ method:"POST" })
  .validator(priceDraftSchema)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const sku = data.sku.toUpperCase();
    const supplier = data.priceType === "supplier" ? data.supplierId?.toUpperCase() ?? null : null;
    const id = data.id ?? `PPRICE-${data.priceType.toUpperCase()}-${sku}${supplier ? `-${supplier}` : ""}`;
    const rows = await sql.query<{ id:string }>(
      `select upsert_vyndi_procurement_price_draft($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10,$11,$12,$13) as id`,
      [id,sku,supplier,data.priceType,data.unit,data.unitPriceInr,data.currency.toUpperCase(),data.effectiveFrom,data.effectiveTo ?? null,
       data.sourceReference,data.notes ?? "",actor.userId,actor.role],
    );
    return { ok:true,id:rows[0]?.id ?? id };
  });

export const approveProcurementPrice = createServerFn({ method:"POST" })
  .validator(z.object({ id:z.string().trim().min(1).max(160), sourceReference:z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("approve");
    const sql = await getSql();
    const rows = await sql.query<{ id:string }>(
      `select approve_vyndi_procurement_price($1,$2,$3,$4) as id`,
      [data.id,data.sourceReference,actor.userId,actor.role],
    );
    return { ok:true,id:rows[0]?.id ?? data.id };
  });

export const retireProcurementPrice = createServerFn({ method:"POST" })
  .validator(z.object({ id:z.string().trim().min(1).max(160), sourceReference:z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("approve");
    const sql = await getSql();
    const rows = await sql.query<{ id:string }>(
      `select retire_vyndi_procurement_price($1,$2,$3,$4) as id`,
      [data.id,data.sourceReference,actor.userId,actor.role],
    );
    return { ok:true,id:rows[0]?.id ?? data.id };
  });
