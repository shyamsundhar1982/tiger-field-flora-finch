import type { SupplierLane, SupplierLaneCapacity } from "./advanced-planning-constraints.ts";

export type GovernedSupplierEvidence = {
  supplierId: string;
  approved: boolean;
  active: boolean;
  leadTimeDays: number;
  qualityRating?: number;
  deliveryRating?: number;
  sourceCurrency?: string;
  sourceRef?: string;
};

export type GovernedPurchasePriceEvidence = {
  id: string;
  supplierId: string;
  sku: string;
  unitPriceInr: number;
  currency: string;
  approved: boolean;
  sourceRef?: string;
};

export type GovernedLandedCostEvidence = {
  landedUnitCostInr: number;
  sourceRef: string;
};

export type GovernedSupplierReliabilityEvidence = {
  reliability: number;
  sourceRef: string;
};

export type GovernedSupplierLanePolicy = {
  moq: number;
  orderMultiple: number;
  alternateRank?: number;
  sourceRef: string;
};

export type GovernedSupplierCapacityEvidence = {
  capacity: SupplierLaneCapacity[];
  sourceRef: string;
};

export type SupplierLaneTruthInput = {
  horizonPeriods: number;
  planningPeriodDays: number;
  sku: string;
  supplier: GovernedSupplierEvidence;
  purchasePrice?: GovernedPurchasePriceEvidence;
  landedCost?: GovernedLandedCostEvidence;
  reliability?: GovernedSupplierReliabilityEvidence;
  policy?: GovernedSupplierLanePolicy;
  capacity?: GovernedSupplierCapacityEvidence;
};

export type SupplierLaneTruthNotice = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type SupplierLaneTruthCandidate = {
  supplierId: string;
  sku: string;
  approvedSupplier: boolean;
  activeSupplier: boolean;
  leadTimeDays: number;
  leadTimePeriods: number;
  purchaseUnitPriceInr?: number;
  purchasePriceCurrency?: string;
  landedUnitCostInr?: number;
  qualityRating?: number;
  deliveryRating?: number;
  reliability?: number;
  moq?: number;
  orderMultiple?: number;
  alternateRank?: number;
  capacity?: SupplierLaneCapacity[];
  evidenceRefs: string[];
};

export type SupplierLaneTruthResult = {
  candidate: SupplierLaneTruthCandidate;
  solverReady: boolean;
  solverLane?: SupplierLane;
  missingEvidence: string[];
  notices: SupplierLaneTruthNotice[];
};

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function nonNegativeFinite(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function uniqueRefs(refs: Array<string | undefined>) {
  return [...new Set(refs.filter((ref): ref is string => Boolean(ref?.trim())).map((ref) => ref.trim()))];
}

export function compileSupplierLaneTruth(input: SupplierLaneTruthInput): SupplierLaneTruthResult {
  const notices: SupplierLaneTruthNotice[] = [];
  const missingEvidence: string[] = [];
  const { supplier } = input;
  const sku = input.sku.trim().toUpperCase();

  if (!sku) {
    notices.push({ severity: "error", code: "EMPTY_SKU", message: "Supplier lane SKU must not be empty." });
  }
  if (!supplier.supplierId.trim()) {
    notices.push({ severity: "error", code: "EMPTY_SUPPLIER", message: "Supplier lane supplier ID must not be empty." });
  }
  if (!Number.isInteger(input.horizonPeriods) || input.horizonPeriods < 1) {
    notices.push({ severity: "error", code: "INVALID_HORIZON", message: "Planning horizon must be a positive integer." });
  }
  if (!positiveFinite(input.planningPeriodDays)) {
    notices.push({ severity: "error", code: "INVALID_PERIOD_DAYS", message: "Planning period days must be greater than zero." });
  }
  if (!Number.isInteger(supplier.leadTimeDays) || supplier.leadTimeDays < 0) {
    notices.push({ severity: "error", code: "INVALID_LEAD_TIME", message: "Supplier lead time days must be a non-negative integer." });
  }

  const leadTimePeriods = positiveFinite(input.planningPeriodDays)
    ? Math.ceil(Math.max(0, supplier.leadTimeDays) / input.planningPeriodDays)
    : 0;

  if (!supplier.approved) {
    notices.push({
      severity: "warning",
      code: "SUPPLIER_NOT_APPROVED",
      message: "Supplier is not approved and cannot become a solver-eligible lane.",
    });
  }
  if (!supplier.active) {
    notices.push({
      severity: "warning",
      code: "SUPPLIER_INACTIVE",
      message: "Supplier is inactive and cannot become a solver-eligible lane.",
    });
  }

  const purchasePrice = input.purchasePrice;
  if (purchasePrice) {
    if (purchasePrice.supplierId !== supplier.supplierId || purchasePrice.sku.toUpperCase() !== sku) {
      notices.push({
        severity: "error",
        code: "PURCHASE_PRICE_IDENTITY_MISMATCH",
        message: "Purchase-price evidence does not match the supplier and SKU lane identity.",
      });
    }
    if (!purchasePrice.approved) {
      notices.push({
        severity: "warning",
        code: "PURCHASE_PRICE_NOT_APPROVED",
        message: "Purchase-price evidence is not approved and remains informational only.",
      });
    }
    if (!positiveFinite(purchasePrice.unitPriceInr)) {
      notices.push({ severity: "error", code: "INVALID_PURCHASE_PRICE", message: "Purchase unit price must be greater than zero." });
    }
  }

  if (!input.landedCost) {
    missingEvidence.push("LANDED_COST");
  } else if (!positiveFinite(input.landedCost.landedUnitCostInr)) {
    notices.push({ severity: "error", code: "INVALID_LANDED_COST", message: "Landed unit cost must be greater than zero." });
  }

  if (!input.reliability) {
    missingEvidence.push("RELIABILITY");
  } else if (!Number.isFinite(input.reliability.reliability) || input.reliability.reliability < 0 || input.reliability.reliability > 1) {
    notices.push({ severity: "error", code: "INVALID_RELIABILITY", message: "Supplier reliability must be between zero and one." });
  }

  if (!input.policy) {
    missingEvidence.push("ORDER_POLICY");
  } else {
    if (!nonNegativeFinite(input.policy.moq)) {
      notices.push({ severity: "error", code: "INVALID_MOQ", message: "MOQ must be finite and non-negative." });
    }
    if (!positiveFinite(input.policy.orderMultiple)) {
      notices.push({ severity: "error", code: "INVALID_ORDER_MULTIPLE", message: "Order multiple must be greater than zero." });
    }
    if (input.policy.alternateRank !== undefined && (!Number.isInteger(input.policy.alternateRank) || input.policy.alternateRank < 1)) {
      notices.push({ severity: "error", code: "INVALID_ALTERNATE_RANK", message: "Alternate rank must be a positive integer." });
    }
  }

  if (!input.capacity) {
    missingEvidence.push("FINITE_CAPACITY");
  } else {
    const seenPeriods = new Set<number>();
    for (const row of input.capacity.capacity) {
      if (!Number.isInteger(row.period) || row.period < 1 || row.period > input.horizonPeriods) {
        notices.push({ severity: "error", code: "INVALID_CAPACITY_PERIOD", message: `Supplier capacity period ${row.period} is outside the planning horizon.` });
      }
      if (seenPeriods.has(row.period)) {
        notices.push({ severity: "error", code: "DUPLICATE_CAPACITY_PERIOD", message: `Supplier capacity period ${row.period} is duplicated.` });
      }
      seenPeriods.add(row.period);
      if (!nonNegativeFinite(row.maxQty)) {
        notices.push({ severity: "error", code: "INVALID_CAPACITY_QUANTITY", message: "Supplier capacity must be finite and non-negative." });
      }
    }
  }

  if (purchasePrice && !input.landedCost) {
    notices.push({
      severity: "warning",
      code: "PURCHASE_PRICE_IS_NOT_LANDED_COST",
      message: "Approved purchase price is retained as evidence but is not substituted for landed cost.",
    });
  }
  if ((supplier.qualityRating !== undefined || supplier.deliveryRating !== undefined) && !input.reliability) {
    notices.push({
      severity: "warning",
      code: "RATINGS_ARE_NOT_RELIABILITY",
      message: "Quality/delivery ratings are retained as evidence but are not converted into a reliability probability without governed methodology.",
    });
  }

  const evidenceRefs = uniqueRefs([
    supplier.sourceRef,
    purchasePrice?.sourceRef,
    input.landedCost?.sourceRef,
    input.reliability?.sourceRef,
    input.policy?.sourceRef,
    input.capacity?.sourceRef,
  ]);

  const candidate: SupplierLaneTruthCandidate = {
    supplierId: supplier.supplierId,
    sku,
    approvedSupplier: supplier.approved,
    activeSupplier: supplier.active,
    leadTimeDays: supplier.leadTimeDays,
    leadTimePeriods,
    purchaseUnitPriceInr: purchasePrice?.approved ? purchasePrice.unitPriceInr : undefined,
    purchasePriceCurrency: purchasePrice?.approved ? purchasePrice.currency : undefined,
    landedUnitCostInr: input.landedCost?.landedUnitCostInr,
    qualityRating: supplier.qualityRating,
    deliveryRating: supplier.deliveryRating,
    reliability: input.reliability?.reliability,
    moq: input.policy?.moq,
    orderMultiple: input.policy?.orderMultiple,
    alternateRank: input.policy?.alternateRank,
    capacity: input.capacity?.capacity,
    evidenceRefs,
  };

  const hasErrors = notices.some((notice) => notice.severity === "error");
  const solverReady =
    !hasErrors &&
    supplier.approved &&
    supplier.active &&
    missingEvidence.length === 0 &&
    Boolean(input.landedCost && input.reliability && input.policy && input.capacity);

  const solverLane: SupplierLane | undefined = solverReady
    ? {
        id: `${supplier.supplierId}:${sku}`,
        supplierId: supplier.supplierId,
        sku,
        approved: true,
        leadTimePeriods,
        moq: input.policy!.moq,
        orderMultiple: input.policy!.orderMultiple,
        landedUnitCostLakh: input.landedCost!.landedUnitCostInr / 100000,
        reliability: input.reliability!.reliability,
        alternateRank: input.policy!.alternateRank,
        capacity: input.capacity!.capacity,
        sourceCurrency: purchasePrice?.approved ? purchasePrice.currency : supplier.sourceCurrency,
        sourceRef: evidenceRefs.join(" | "),
      }
    : undefined;

  return { candidate, solverReady, solverLane, missingEvidence, notices };
}
