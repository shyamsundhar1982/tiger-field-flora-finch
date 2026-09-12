import type {
  BomRequirement,
  DemandSignal,
  IntegratedPlanningInput,
  InventoryPosition,
  InventoryReceipt,
} from "./integrated-business-planning-engine";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
  type PlanningObjectiveWeights,
  type SupplierLane,
} from "./advanced-planning-constraints";

export type GovernedCapacityStandard = {
  workCentreId: string;
  workCentreName: string;
  travellerOperation: string;
  sequence: number;
  availableHoursPerPeriod: number;
  efficiency: number;
  standardHoursPerUnit: number;
  sourceRef?: string;
};

export type AdvancedPlanningAdapterInput = {
  horizonPeriods: number;
  planningInput: Pick<
    IntegratedPlanningInput,
    "demand" | "bom" | "inventory" | "receipts"
  >;
  capacityStandards: GovernedCapacityStandard[];
  supplierLanes?: SupplierLane[];
  objectiveWeights: PlanningObjectiveWeights;
  committedDemandPriority: number;
  forecastDemandPriority: number;
};

export type AdvancedPlanningAdapterNotice = {
  code: string;
  message: string;
};

export type AdvancedPlanningAdapterResult = {
  model: AdvancedPlanningConstraintModel;
  notices: AdvancedPlanningAdapterNotice[];
};

function demandRows(
  demand: DemandSignal[],
  committedPriority: number,
  forecastPriority: number,
) {
  return demand.flatMap((row) => {
    const rows = [];
    if (row.committedQty > 0) {
      rows.push({
        id: `${row.id}:committed`,
        productId: row.productId,
        period: row.period,
        quantity: row.committedQty,
        priority: committedPriority,
        truth: "committed" as const,
        sourceRef: row.sourceRef,
      });
    }

    // DemandSignal.forecastQty is the total expected demand and already includes
    // actual + committed demand. The optimiser must never re-plan actuals or
    // double-count committed orders, so only the residual becomes forecast truth.
    const residualForecast = Math.max(
      0,
      row.forecastQty - row.actualQty - row.committedQty,
    );
    if (residualForecast > 0) {
      rows.push({
        id: `${row.id}:forecast`,
        productId: row.productId,
        period: row.period,
        quantity: residualForecast,
        priority: forecastPriority,
        truth: "forecast" as const,
        sourceRef: row.sourceRef,
      });
    }
    return rows;
  });
}

function bomRows(bom: BomRequirement[]) {
  return bom
    .filter((row) => row.approved)
    .map((row) => ({
      id: row.id,
      productId: row.productId,
      sku: row.sku,
      quantityPerUnit: row.quantityPerUnit,
      scrapPct: row.scrapPct,
      sourceRef: row.sourceRef,
    }));
}

function materialRows(inventory: InventoryPosition[]) {
  return inventory.map((row) => ({
    sku: row.sku,
    onHandQty: row.onHandQty,
    reservedQty: row.reservedQty,
    safetyStockQty: row.safetyStockQty ?? row.mslQty,
    sourceRef: row.sourceRef,
  }));
}

function receiptRows(receipts: InventoryReceipt[] | undefined) {
  return (receipts ?? [])
    .filter((row) => row.truth === "committed")
    .map((row) => ({
      id: row.id,
      sku: row.sku,
      period: row.period,
      quantity: row.quantity,
      sourceRef: row.sourceRef,
    }));
}

export function compileAdvancedPlanningModel(
  input: AdvancedPlanningAdapterInput,
): AdvancedPlanningAdapterResult {
  const notices: AdvancedPlanningAdapterNotice[] = [];
  const productIds = [
    ...new Set([
      ...input.planningInput.demand.map((row) => row.productId),
      ...input.planningInput.bom.filter((row) => row.approved).map((row) => row.productId),
    ]),
  ].sort();

  const standards = [...input.capacityStandards].sort(
    (a, b) => a.sequence - b.sequence || a.workCentreId.localeCompare(b.workCentreId),
  );

  const resources = standards.map((standard) => ({
    id: standard.workCentreId,
    name: standard.workCentreName,
    type: "work_center" as const,
    capabilities: [standard.travellerOperation],
    efficiency: standard.efficiency,
    capacity: Array.from({ length: input.horizonPeriods }, (_, index) => ({
      period: index + 1,
      availableHours: standard.availableHoursPerPeriod,
    })),
    sourceRef: standard.sourceRef,
  }));

  const routingOperations = productIds.flatMap((productId) =>
    standards.map((standard, index) => {
      const predecessor = index > 0 ? standards[index - 1] : undefined;
      return {
        id: `${productId}:${standard.workCentreId}`,
        productId,
        operationCode: standard.travellerOperation,
        sequence: standard.sequence,
        eligibleResourceIds: [standard.workCentreId],
        runHoursPerUnit: standard.standardHoursPerUnit,
        predecessorOperationIds: predecessor
          ? [`${productId}:${predecessor.workCentreId}`]
          : undefined,
        sourceRef: standard.sourceRef,
      };
    }),
  );

  if ((input.supplierLanes ?? []).length === 0) {
    notices.push({
      code: "SUPPLIER_LANES_NOT_COMPILED",
      message:
        "No governed supplier-lane constraints were supplied. Supplier selection/capacity optimisation must remain disabled until lane authority is available.",
    });
  }

  if (standards.length === 0) {
    notices.push({
      code: "CAPACITY_STANDARDS_NOT_COMPILED",
      message:
        "No governed capacity standards were supplied. Finite resource feasibility must remain disabled.",
    });
  }

  return {
    model: {
      modelVersion: ADVANCED_PLANNING_MODEL_VERSION,
      horizonPeriods: input.horizonPeriods,
      demands: demandRows(
        input.planningInput.demand,
        input.committedDemandPriority,
        input.forecastDemandPriority,
      ),
      bom: bomRows(input.planningInput.bom),
      materials: materialRows(input.planningInput.inventory),
      committedReceipts: receiptRows(input.planningInput.receipts),
      resources,
      routingOperations,
      supplierLanes: input.supplierLanes ?? [],
      objectiveWeights: input.objectiveWeights,
    },
    notices,
  };
}
