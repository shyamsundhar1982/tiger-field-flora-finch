import type { SupplierLane } from "./advanced-planning-constraints.ts";
import {
  compileSupplierLaneTruth,
  type GovernedPurchasePriceEvidence,
  type SupplierLaneTruthNotice,
} from "./supplier-lane-truth.ts";

export type PersistedSupplierLaneRow = {
  lane_revision_id: string;
  supplier_id: string;
  sku: string;
  revision_code: string;
  effective_from: string;
  effective_to: string | null;
  planning_period_days: number | string;
  horizon_periods: number | string;
  lead_time_days: number | string;
  moq: number | string;
  order_multiple: number | string;
  alternate_rank: number | string;
  landed_unit_cost_inr: number | string;
  landed_cost_source_ref: string;
  reliability: number | string;
  reliability_method: string;
  reliability_source_ref: string;
  policy_source_ref: string;
  source_ref: string;
  supplier_approval_status: string;
  supplier_active: boolean;
  supplier_currency: string;
  quality_rating: number | string | null;
  delivery_rating: number | string | null;
  supplier_source_ref: string;
  capacity_json: unknown;
};

export type PersistedSupplierPriceRow = {
  id: string;
  supplier_id: string;
  sku: string;
  unit_price_inr: number | string;
  currency: string;
  source_reference: string;
  effective_from: string;
  effective_to: string | null;
};

export type PersistedSupplierLanePlanningResult = {
  complete: boolean;
  supplierLanes: SupplierLane[];
  laneRevisionIds: string[];
  missingSkus: string[];
  notices: SupplierLaneTruthNotice[];
};

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function capacityRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return { period: Number(item.period), maxQty: Number(item.maxQty) };
  });
}

export function compilePersistedSupplierLanesForPlanning(input: {
  rows: PersistedSupplierLaneRow[];
  purchasePrices?: PersistedSupplierPriceRow[];
  requiredSkus: string[];
  asOfDate: string;
}): PersistedSupplierLanePlanningResult {
  const asOf = dateOnly(input.asOfDate);
  const requiredSkus = [...new Set(input.requiredSkus.map((sku) => sku.trim().toUpperCase()).filter(Boolean))].sort();
  const prices = input.purchasePrices ?? [];
  const notices: SupplierLaneTruthNotice[] = [];
  const readyBySku = new Map<string, SupplierLane[]>();
  const revisionIds: string[] = [];

  for (const row of input.rows) {
    const sku = row.sku.trim().toUpperCase();
    if (!requiredSkus.includes(sku)) continue;
    const from = dateOnly(row.effective_from);
    const to = row.effective_to ? dateOnly(row.effective_to) : null;
    if (from > asOf || (to && to < asOf)) continue;

    const priceRow = prices.find((price) => {
      if (price.supplier_id !== row.supplier_id || price.sku.trim().toUpperCase() !== sku) return false;
      const pFrom = dateOnly(price.effective_from);
      const pTo = price.effective_to ? dateOnly(price.effective_to) : null;
      return pFrom <= asOf && (!pTo || pTo >= asOf);
    });
    const purchasePrice: GovernedPurchasePriceEvidence | undefined = priceRow
      ? {
          id: priceRow.id,
          supplierId: priceRow.supplier_id,
          sku,
          unitPriceInr: Number(priceRow.unit_price_inr),
          currency: priceRow.currency,
          approved: true,
          sourceRef: priceRow.source_reference,
        }
      : undefined;

    const reliabilitySource = `${row.reliability_source_ref} | method:${row.reliability_method}`;
    const result = compileSupplierLaneTruth({
      horizonPeriods: Number(row.horizon_periods),
      planningPeriodDays: Number(row.planning_period_days),
      sku,
      supplier: {
        supplierId: row.supplier_id,
        approved: row.supplier_approval_status === "approved",
        active: row.supplier_active,
        leadTimeDays: Number(row.lead_time_days),
        qualityRating: row.quality_rating == null ? undefined : Number(row.quality_rating),
        deliveryRating: row.delivery_rating == null ? undefined : Number(row.delivery_rating),
        sourceCurrency: row.supplier_currency,
        sourceRef: row.supplier_source_ref,
      },
      purchasePrice,
      landedCost: {
        landedUnitCostInr: Number(row.landed_unit_cost_inr),
        sourceRef: row.landed_cost_source_ref,
      },
      reliability: {
        reliability: Number(row.reliability),
        sourceRef: reliabilitySource,
      },
      policy: {
        moq: Number(row.moq),
        orderMultiple: Number(row.order_multiple),
        alternateRank: Number(row.alternate_rank),
        sourceRef: row.policy_source_ref,
      },
      capacity: {
        capacity: capacityRows(row.capacity_json),
        sourceRef: row.source_ref,
      },
    });
    notices.push(...result.notices);
    if (!result.solverReady || !result.solverLane) continue;
    revisionIds.push(row.lane_revision_id);
    const current = readyBySku.get(sku) ?? [];
    current.push(result.solverLane);
    readyBySku.set(sku, current);
  }

  const missingSkus = requiredSkus.filter((sku) => (readyBySku.get(sku)?.length ?? 0) === 0);
  const complete = requiredSkus.length > 0 && missingSkus.length === 0;
  const supplierLanes = complete
    ? requiredSkus.flatMap((sku) => readyBySku.get(sku) ?? []).sort((a, b) => a.sku.localeCompare(b.sku) || (a.alternateRank ?? 999) - (b.alternateRank ?? 999) || a.supplierId.localeCompare(b.supplierId))
    : [];

  return {
    complete,
    supplierLanes,
    laneRevisionIds: complete ? [...new Set(revisionIds)].sort() : [],
    missingSkus,
    notices,
  };
}
