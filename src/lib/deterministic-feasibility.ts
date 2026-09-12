import {
  type AdvancedPlanningConstraintModel,
  validateAdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";

export type FeasibilityStatus = "feasible" | "infeasible" | "indeterminate";

export type MaterialFeasibilityRow = {
  sku: string;
  period: number;
  cumulativeAvailableQty: number;
  cumulativeCommittedRequirementQty: number;
  cumulativeTotalRequirementQty: number;
  committedShortageQty: number;
  totalShortageQty: number;
};

export type ResourceFeasibilityRow = {
  resourceId: string;
  period: number;
  effectiveCapacityHours: number;
  committedLoadHours: number;
  totalLoadHours: number;
  committedOverloadHours: number;
  totalOverloadHours: number;
};

export type FeasibilityIndeterminate = {
  code: string;
  productId?: string;
  sku?: string;
  operationId?: string;
  resourceId?: string;
  period?: number;
  message: string;
};

export type FeasibilityBindingConstraint = {
  code: string;
  truth: "committed" | "total";
  period: number;
  entityId: string;
  amount: number;
  unit: "qty" | "hours";
  message: string;
};

export type SupplierRemediationOption = {
  laneId: string;
  supplierId: string;
  sku: string;
  leadTimePeriods: number;
  earliestReceiptPeriod: number;
  alternateRank?: number;
  reliability: number;
  capacityPeriods: number[];
};

export type DeterministicFeasibilityResult = {
  modelValid: boolean;
  committedStatus: FeasibilityStatus;
  totalStatus: FeasibilityStatus;
  materials: MaterialFeasibilityRow[];
  resources: ResourceFeasibilityRow[];
  bindingConstraints: FeasibilityBindingConstraint[];
  indeterminate: FeasibilityIndeterminate[];
  supplierRemediation: SupplierRemediationOption[];
  validationIssues: ReturnType<typeof validateAdvancedPlanningConstraintModel>["issues"];
  assumptions: string[];
};

type DemandTotals = {
  committed: number;
  total: number;
};

const EPSILON = 1e-9;

function key(...parts: Array<string | number>) {
  return parts.join("::");
}

function round(value: number) {
  return Math.abs(value) < EPSILON ? 0 : Number(value.toFixed(9));
}

function status(knownInfeasible: boolean, hasIndeterminate: boolean): FeasibilityStatus {
  if (knownInfeasible) return "infeasible";
  if (hasIndeterminate) return "indeterminate";
  return "feasible";
}

function aggregateDemand(model: AdvancedPlanningConstraintModel) {
  const result = new Map<string, DemandTotals>();
  for (const demand of model.demands) {
    const demandKey = key(demand.productId, demand.period);
    const row = result.get(demandKey) ?? { committed: 0, total: 0 };
    row.total += demand.quantity;
    if (demand.truth === "committed") row.committed += demand.quantity;
    result.set(demandKey, row);
  }
  return result;
}

export function evaluateDeterministicFeasibility(
  model: AdvancedPlanningConstraintModel,
): DeterministicFeasibilityResult {
  const validation = validateAdvancedPlanningConstraintModel(model);
  const validationErrors = validation.issues.filter((row) => row.severity === "error");

  const baseResult = {
    modelValid: validationErrors.length === 0,
    materials: [] as MaterialFeasibilityRow[],
    resources: [] as ResourceFeasibilityRow[],
    bindingConstraints: [] as FeasibilityBindingConstraint[],
    indeterminate: [] as FeasibilityIndeterminate[],
    supplierRemediation: [] as SupplierRemediationOption[],
    validationIssues: validation.issues,
    assumptions: [
      "Baseline feasibility uses opening inventory plus committed receipts only; new supplier orders are not silently assumed.",
      "Safety stock and reservations are protected before demand coverage is assessed.",
      "BOM scrap is treated as additional material requirement: quantityPerUnit × (1 + scrapPct).",
      "Resource effective capacity equals available hours × governed efficiency.",
      "Run load is adjusted for operation yield; setup is charged once per product-operation-period when quantity is positive.",
      "Operations with multiple eligible resources are reported as indeterminate until an allocation or optimisation method selects a resource.",
      "Supplier lanes are presented only as remediation options and do not change baseline feasibility.",
    ],
  };

  if (validationErrors.length > 0) {
    return {
      ...baseResult,
      committedStatus: "indeterminate",
      totalStatus: "indeterminate",
      indeterminate: validationErrors.map((row) => ({
        code: `MODEL_${row.code}`,
        message: `${row.path}: ${row.message}`,
      })),
    };
  }

  const demandByProductPeriod = aggregateDemand(model);
  const demandedProducts = new Set(model.demands.filter((row) => row.quantity > 0).map((row) => row.productId));
  const bomByProduct = new Map<string, typeof model.bom>();
  for (const row of model.bom) {
    const list = bomByProduct.get(row.productId) ?? [];
    list.push(row);
    bomByProduct.set(row.productId, list);
  }
  const routingByProduct = new Map<string, typeof model.routingOperations>();
  for (const row of model.routingOperations) {
    const list = routingByProduct.get(row.productId) ?? [];
    list.push(row);
    routingByProduct.set(row.productId, list);
  }

  const committedIndeterminateKeys = new Set<string>();
  const totalIndeterminateKeys = new Set<string>();

  for (const productId of demandedProducts) {
    const hasCommitted = model.demands.some(
      (row) => row.productId === productId && row.truth === "committed" && row.quantity > 0,
    );
    if ((bomByProduct.get(productId) ?? []).length === 0) {
      baseResult.indeterminate.push({
        code: "MISSING_PRODUCT_BOM",
        productId,
        message: `Demanded product ${productId} has no approved BOM requirements in the planning model.`,
      });
      totalIndeterminateKeys.add(`BOM:${productId}`);
      if (hasCommitted) committedIndeterminateKeys.add(`BOM:${productId}`);
    }
    if ((routingByProduct.get(productId) ?? []).length === 0) {
      baseResult.indeterminate.push({
        code: "MISSING_PRODUCT_ROUTING",
        productId,
        message: `Demanded product ${productId} has no governed routing operations in the planning model.`,
      });
      totalIndeterminateKeys.add(`ROUTING:${productId}`);
      if (hasCommitted) committedIndeterminateKeys.add(`ROUTING:${productId}`);
    }
  }

  const materialBySku = new Map(model.materials.map((row) => [row.sku, row]));
  const receiptsBySkuPeriod = new Map<string, number>();
  for (const receipt of model.committedReceipts) {
    const receiptKey = key(receipt.sku, receipt.period);
    receiptsBySkuPeriod.set(receiptKey, (receiptsBySkuPeriod.get(receiptKey) ?? 0) + receipt.quantity);
  }

  const periodRequirements = new Map<string, DemandTotals>();
  const requiredSkus = new Set<string>();
  for (let period = 1; period <= model.horizonPeriods; period += 1) {
    for (const productId of demandedProducts) {
      const demand = demandByProductPeriod.get(key(productId, period));
      if (!demand || demand.total <= EPSILON) continue;
      for (const bom of bomByProduct.get(productId) ?? []) {
        requiredSkus.add(bom.sku);
        const factor = bom.quantityPerUnit * (1 + (bom.scrapPct ?? 0));
        const requirementKey = key(bom.sku, period);
        const row = periodRequirements.get(requirementKey) ?? { committed: 0, total: 0 };
        row.committed += demand.committed * factor;
        row.total += demand.total * factor;
        periodRequirements.set(requirementKey, row);
      }
    }
  }

  let committedMaterialInfeasible = false;
  let totalMaterialInfeasible = false;
  for (const sku of [...requiredSkus].sort()) {
    const material = materialBySku.get(sku);
    const skuHasCommittedRequirement = Array.from({ length: model.horizonPeriods }, (_, index) => index + 1).some(
      (period) => (periodRequirements.get(key(sku, period))?.committed ?? 0) > EPSILON,
    );
    if (!material) {
      baseResult.indeterminate.push({
        code: "MISSING_MATERIAL_POSITION",
        sku,
        message: `Required SKU ${sku} has no governed inventory position; missing inventory truth is not treated as zero stock.`,
      });
      totalIndeterminateKeys.add(`MAT:${sku}`);
      if (skuHasCommittedRequirement) committedIndeterminateKeys.add(`MAT:${sku}`);
      continue;
    }

    let cumulativeAvailable = material.onHandQty - (material.reservedQty ?? 0) - (material.safetyStockQty ?? 0);
    let cumulativeCommittedRequirement = 0;
    let cumulativeTotalRequirement = 0;

    for (let period = 1; period <= model.horizonPeriods; period += 1) {
      cumulativeAvailable += receiptsBySkuPeriod.get(key(sku, period)) ?? 0;
      const requirement = periodRequirements.get(key(sku, period));
      cumulativeCommittedRequirement += requirement?.committed ?? 0;
      cumulativeTotalRequirement += requirement?.total ?? 0;
      const committedShortage = Math.max(0, cumulativeCommittedRequirement - cumulativeAvailable);
      const totalShortage = Math.max(0, cumulativeTotalRequirement - cumulativeAvailable);

      baseResult.materials.push({
        sku,
        period,
        cumulativeAvailableQty: round(cumulativeAvailable),
        cumulativeCommittedRequirementQty: round(cumulativeCommittedRequirement),
        cumulativeTotalRequirementQty: round(cumulativeTotalRequirement),
        committedShortageQty: round(committedShortage),
        totalShortageQty: round(totalShortage),
      });

      if (committedShortage > EPSILON) {
        committedMaterialInfeasible = true;
        baseResult.bindingConstraints.push({
          code: "MATERIAL_SHORTAGE_COMMITTED",
          truth: "committed",
          period,
          entityId: sku,
          amount: round(committedShortage),
          unit: "qty",
          message: `${sku} is short by ${round(committedShortage)} units against committed demand by period ${period}.`,
        });
      }
      if (totalShortage > EPSILON) {
        totalMaterialInfeasible = true;
        baseResult.bindingConstraints.push({
          code: "MATERIAL_SHORTAGE_TOTAL",
          truth: "total",
          period,
          entityId: sku,
          amount: round(totalShortage),
          unit: "qty",
          message: `${sku} is short by ${round(totalShortage)} units against total demand by period ${period}.`,
        });
      }
    }
  }

  const resourceById = new Map(model.resources.map((row) => [row.id, row]));
  const exactCommittedLoad = new Map<string, number>();
  const exactTotalLoad = new Map<string, number>();

  for (const operation of model.routingOperations) {
    for (let period = 1; period <= model.horizonPeriods; period += 1) {
      const demand = demandByProductPeriod.get(key(operation.productId, period));
      if (!demand || demand.total <= EPSILON) continue;

      if (operation.eligibleResourceIds.length !== 1) {
        baseResult.indeterminate.push({
          code: "ALTERNATE_RESOURCE_ASSIGNMENT_REQUIRED",
          productId: operation.productId,
          operationId: operation.id,
          period,
          message: `Operation ${operation.id} has ${operation.eligibleResourceIds.length} eligible resources; deterministic feasibility will not guess an assignment.`,
        });
        totalIndeterminateKeys.add(`ALT:${operation.id}:${period}`);
        if (demand.committed > EPSILON) committedIndeterminateKeys.add(`ALT:${operation.id}:${period}`);
        continue;
      }

      const resourceId = operation.eligibleResourceIds[0];
      const yieldPct = operation.yieldPct ?? 1;
      const committedRun = (demand.committed * operation.runHoursPerUnit) / yieldPct;
      const totalRun = (demand.total * operation.runHoursPerUnit) / yieldPct;
      const committedSetup = demand.committed > EPSILON ? operation.setupHours ?? 0 : 0;
      const totalSetup = demand.total > EPSILON ? operation.setupHours ?? 0 : 0;
      const loadKey = key(resourceId, period);
      exactCommittedLoad.set(loadKey, (exactCommittedLoad.get(loadKey) ?? 0) + committedRun + committedSetup);
      exactTotalLoad.set(loadKey, (exactTotalLoad.get(loadKey) ?? 0) + totalRun + totalSetup);
    }
  }

  let committedResourceInfeasible = false;
  let totalResourceInfeasible = false;
  for (const resource of [...model.resources].sort((a, b) => a.id.localeCompare(b.id))) {
    const capacityByPeriod = new Map(resource.capacity.map((row) => [row.period, row.availableHours]));
    for (let period = 1; period <= model.horizonPeriods; period += 1) {
      const capacityHours = capacityByPeriod.get(period);
      const committedLoad = exactCommittedLoad.get(key(resource.id, period)) ?? 0;
      const totalLoad = exactTotalLoad.get(key(resource.id, period)) ?? 0;
      const isDemanded = committedLoad > EPSILON || totalLoad > EPSILON;

      if (capacityHours === undefined) {
        if (isDemanded) {
          baseResult.indeterminate.push({
            code: "MISSING_RESOURCE_CAPACITY_PERIOD",
            resourceId: resource.id,
            period,
            message: `Resource ${resource.id} has planned load but no capacity evidence for period ${period}.`,
          });
          totalIndeterminateKeys.add(`CAP:${resource.id}:${period}`);
          if (committedLoad > EPSILON) committedIndeterminateKeys.add(`CAP:${resource.id}:${period}`);
        }
        continue;
      }

      const effectiveCapacity = capacityHours * resource.efficiency;
      const committedOverload = Math.max(0, committedLoad - effectiveCapacity);
      const totalOverload = Math.max(0, totalLoad - effectiveCapacity);
      baseResult.resources.push({
        resourceId: resource.id,
        period,
        effectiveCapacityHours: round(effectiveCapacity),
        committedLoadHours: round(committedLoad),
        totalLoadHours: round(totalLoad),
        committedOverloadHours: round(committedOverload),
        totalOverloadHours: round(totalOverload),
      });

      if (committedOverload > EPSILON) {
        committedResourceInfeasible = true;
        baseResult.bindingConstraints.push({
          code: "RESOURCE_OVERLOAD_COMMITTED",
          truth: "committed",
          period,
          entityId: resource.id,
          amount: round(committedOverload),
          unit: "hours",
          message: `${resource.id} exceeds effective capacity by ${round(committedOverload)} hours for committed demand in period ${period}.`,
        });
      }
      if (totalOverload > EPSILON) {
        totalResourceInfeasible = true;
        baseResult.bindingConstraints.push({
          code: "RESOURCE_OVERLOAD_TOTAL",
          truth: "total",
          period,
          entityId: resource.id,
          amount: round(totalOverload),
          unit: "hours",
          message: `${resource.id} exceeds effective capacity by ${round(totalOverload)} hours for total demand in period ${period}.`,
        });
      }
    }
  }

  const shortageSkus = new Set(
    baseResult.materials
      .filter((row) => row.committedShortageQty > EPSILON || row.totalShortageQty > EPSILON)
      .map((row) => row.sku),
  );
  baseResult.supplierRemediation = model.supplierLanes
    .filter((lane) => lane.approved && shortageSkus.has(lane.sku))
    .map((lane) => ({
      laneId: lane.id,
      supplierId: lane.supplierId,
      sku: lane.sku,
      leadTimePeriods: lane.leadTimePeriods,
      earliestReceiptPeriod: 1 + lane.leadTimePeriods,
      alternateRank: lane.alternateRank,
      reliability: lane.reliability,
      capacityPeriods: (lane.capacity ?? []).map((row) => row.period).sort((a, b) => a - b),
    }))
    .sort(
      (a, b) =>
        a.sku.localeCompare(b.sku) ||
        (a.alternateRank ?? Number.MAX_SAFE_INTEGER) - (b.alternateRank ?? Number.MAX_SAFE_INTEGER) ||
        a.supplierId.localeCompare(b.supplierId),
    );

  baseResult.bindingConstraints.sort(
    (a, b) => a.period - b.period || a.entityId.localeCompare(b.entityId) || a.code.localeCompare(b.code),
  );

  return {
    ...baseResult,
    committedStatus: status(
      committedMaterialInfeasible || committedResourceInfeasible,
      committedIndeterminateKeys.size > 0,
    ),
    totalStatus: status(totalMaterialInfeasible || totalResourceInfeasible, totalIndeterminateKeys.size > 0),
  };
}
