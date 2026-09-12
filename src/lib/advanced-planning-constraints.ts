export const ADVANCED_PLANNING_MODEL_VERSION = "VYNDI-ADVANCED-PLANNING-0.1" as const;

export type PlanningResourceType = "work_center" | "machine" | "tool" | "labour";

export type PeriodCapacity = {
  period: number;
  availableHours: number;
};

export type AdvancedPlanningResource = {
  id: string;
  name: string;
  type: PlanningResourceType;
  capabilities: string[];
  efficiency: number;
  capacity: PeriodCapacity[];
  sourceRef?: string;
};

export type AdvancedBomRequirement = {
  id: string;
  productId: string;
  sku: string;
  quantityPerUnit: number;
  scrapPct?: number;
  sourceRef?: string;
};

export type AdvancedMaterialPosition = {
  sku: string;
  onHandQty: number;
  reservedQty?: number;
  safetyStockQty?: number;
  sourceRef?: string;
};

export type AdvancedCommittedReceipt = {
  id: string;
  sku: string;
  period: number;
  quantity: number;
  sourceRef?: string;
};

export type RoutingOperation = {
  id: string;
  productId: string;
  operationCode: string;
  sequence: number;
  eligibleResourceIds: string[];
  runHoursPerUnit: number;
  setupHours?: number;
  yieldPct?: number;
  predecessorOperationIds?: string[];
  sourceRef?: string;
};

export type SupplierLaneCapacity = {
  period: number;
  maxQty: number;
};

export type SupplierLane = {
  id: string;
  supplierId: string;
  sku: string;
  approved: boolean;
  leadTimePeriods: number;
  moq: number;
  orderMultiple: number;
  landedUnitCostLakh: number;
  reliability: number;
  alternateRank?: number;
  capacity?: SupplierLaneCapacity[];
  validFromPeriod?: number;
  validToPeriod?: number;
  sourceCurrency?: string;
  sourceRef?: string;
};

export type PrioritisedDemand = {
  id: string;
  productId: string;
  period: number;
  quantity: number;
  priority: number;
  truth: "forecast" | "committed";
  sourceRef?: string;
};

export type PlanningObjectiveWeights = {
  unmetCommittedDemand: number;
  unmetForecastDemand: number;
  lateness: number;
  resourceOverload: number;
  supplierOverload: number;
  procurementCost: number;
  workingCapital: number;
  scheduleChange: number;
};

export type AdvancedPlanningConstraintModel = {
  modelVersion: typeof ADVANCED_PLANNING_MODEL_VERSION;
  horizonPeriods: number;
  demands: PrioritisedDemand[];
  bom: AdvancedBomRequirement[];
  materials: AdvancedMaterialPosition[];
  committedReceipts: AdvancedCommittedReceipt[];
  resources: AdvancedPlanningResource[];
  routingOperations: RoutingOperation[];
  supplierLanes: SupplierLane[];
  objectiveWeights: PlanningObjectiveWeights;
};

export type AdvancedPlanningValidationIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type AdvancedPlanningValidationResult = {
  valid: boolean;
  issues: AdvancedPlanningValidationIssue[];
};

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function periodIsValid(period: number, horizon: number) {
  return Number.isInteger(period) && period >= 1 && period <= horizon;
}

function addIssue(
  issues: AdvancedPlanningValidationIssue[],
  severity: AdvancedPlanningValidationIssue["severity"],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message });
}

function validateUniqueIds<T extends { id: string }>(
  rows: T[],
  collection: string,
  issues: AdvancedPlanningValidationIssue[],
) {
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const id = row.id.trim();
    if (!id) {
      addIssue(issues, "error", "EMPTY_ID", `${collection}[${index}].id`, "ID must not be empty.");
      continue;
    }
    if (seen.has(id)) {
      addIssue(issues, "error", "DUPLICATE_ID", `${collection}[${index}].id`, `Duplicate ID ${id}.`);
    }
    seen.add(id);
  }
}

export function validateAdvancedPlanningConstraintModel(
  model: AdvancedPlanningConstraintModel,
): AdvancedPlanningValidationResult {
  const issues: AdvancedPlanningValidationIssue[] = [];
  const horizon = model.horizonPeriods;

  if (model.modelVersion !== ADVANCED_PLANNING_MODEL_VERSION) {
    addIssue(
      issues,
      "error",
      "MODEL_VERSION",
      "modelVersion",
      `Expected ${ADVANCED_PLANNING_MODEL_VERSION}.`,
    );
  }
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 60) {
    addIssue(issues, "error", "HORIZON", "horizonPeriods", "Planning horizon must be an integer from 1 to 60.");
  }

  validateUniqueIds(model.demands, "demands", issues);
  validateUniqueIds(model.bom, "bom", issues);
  validateUniqueIds(model.committedReceipts, "committedReceipts", issues);
  validateUniqueIds(model.resources, "resources", issues);
  validateUniqueIds(model.routingOperations, "routingOperations", issues);
  validateUniqueIds(model.supplierLanes, "supplierLanes", issues);

  const resources = new Map(model.resources.map((resource) => [resource.id, resource]));
  const operations = new Map(model.routingOperations.map((operation) => [operation.id, operation]));
  const materialSkus = new Set(model.materials.map((material) => material.sku));
  const bomSkus = new Set(model.bom.map((row) => row.sku));

  for (const [index, demand] of model.demands.entries()) {
    if (!periodIsValid(demand.period, horizon)) {
      addIssue(issues, "error", "DEMAND_PERIOD", `demands[${index}].period`, "Demand period is outside the planning horizon.");
    }
    if (!finiteNonNegative(demand.quantity)) {
      addIssue(issues, "error", "DEMAND_QUANTITY", `demands[${index}].quantity`, "Demand quantity must be finite and non-negative.");
    }
    if (!Number.isInteger(demand.priority) || demand.priority < 1 || demand.priority > 100) {
      addIssue(issues, "error", "DEMAND_PRIORITY", `demands[${index}].priority`, "Demand priority must be an integer from 1 to 100.");
    }
  }

  for (const [index, requirement] of model.bom.entries()) {
    if (!finiteNonNegative(requirement.quantityPerUnit) || requirement.quantityPerUnit === 0) {
      addIssue(issues, "error", "BOM_QUANTITY", `bom[${index}].quantityPerUnit`, "BOM quantity per unit must be finite and greater than zero.");
    }
    const scrapPct = requirement.scrapPct ?? 0;
    if (!finiteNonNegative(scrapPct) || scrapPct >= 1) {
      addIssue(issues, "error", "BOM_SCRAP", `bom[${index}].scrapPct`, "BOM scrap percentage must be at least zero and less than one.");
    }
  }

  const materialSeen = new Set<string>();
  for (const [index, material] of model.materials.entries()) {
    if (!material.sku.trim()) {
      addIssue(issues, "error", "EMPTY_SKU", `materials[${index}].sku`, "Material SKU must not be empty.");
    }
    if (materialSeen.has(material.sku)) {
      addIssue(issues, "error", "DUPLICATE_MATERIAL", `materials[${index}].sku`, `Duplicate material position for ${material.sku}.`);
    }
    materialSeen.add(material.sku);
    for (const [field, value] of [
      ["onHandQty", material.onHandQty],
      ["reservedQty", material.reservedQty ?? 0],
      ["safetyStockQty", material.safetyStockQty ?? 0],
    ] as const) {
      if (!finiteNonNegative(value)) {
        addIssue(issues, "error", "MATERIAL_QUANTITY", `materials[${index}].${field}`, `${field} must be finite and non-negative.`);
      }
    }
  }

  for (const [index, receipt] of model.committedReceipts.entries()) {
    if (!periodIsValid(receipt.period, horizon)) {
      addIssue(issues, "error", "RECEIPT_PERIOD", `committedReceipts[${index}].period`, "Receipt period is outside the planning horizon.");
    }
    if (!finiteNonNegative(receipt.quantity) || receipt.quantity === 0) {
      addIssue(issues, "error", "RECEIPT_QUANTITY", `committedReceipts[${index}].quantity`, "Receipt quantity must be finite and greater than zero.");
    }
    if (!materialSkus.has(receipt.sku) && !bomSkus.has(receipt.sku)) {
      addIssue(issues, "warning", "UNREFERENCED_RECEIPT_SKU", `committedReceipts[${index}].sku`, `Receipt SKU ${receipt.sku} is not present in material positions or BOM requirements.`);
    }
  }

  for (const [index, resource] of model.resources.entries()) {
    if (!resource.name.trim()) {
      addIssue(issues, "error", "RESOURCE_NAME", `resources[${index}].name`, "Resource name must not be empty.");
    }
    if (!Number.isFinite(resource.efficiency) || resource.efficiency <= 0 || resource.efficiency > 1) {
      addIssue(issues, "error", "RESOURCE_EFFICIENCY", `resources[${index}].efficiency`, "Resource efficiency must be greater than zero and at most one.");
    }
    const periods = new Set<number>();
    for (const [capacityIndex, capacity] of resource.capacity.entries()) {
      const path = `resources[${index}].capacity[${capacityIndex}]`;
      if (!periodIsValid(capacity.period, horizon)) {
        addIssue(issues, "error", "RESOURCE_PERIOD", `${path}.period`, "Resource capacity period is outside the planning horizon.");
      }
      if (periods.has(capacity.period)) {
        addIssue(issues, "error", "DUPLICATE_RESOURCE_PERIOD", `${path}.period`, `Resource ${resource.id} has duplicate capacity for period ${capacity.period}.`);
      }
      periods.add(capacity.period);
      if (!finiteNonNegative(capacity.availableHours)) {
        addIssue(issues, "error", "RESOURCE_CAPACITY", `${path}.availableHours`, "Available hours must be finite and non-negative.");
      }
    }
  }

  for (const [index, operation] of model.routingOperations.entries()) {
    if (!Number.isInteger(operation.sequence) || operation.sequence <= 0) {
      addIssue(issues, "error", "ROUTING_SEQUENCE", `routingOperations[${index}].sequence`, "Routing sequence must be a positive integer.");
    }
    if (!finiteNonNegative(operation.runHoursPerUnit) || operation.runHoursPerUnit === 0) {
      addIssue(issues, "error", "ROUTING_RUN_TIME", `routingOperations[${index}].runHoursPerUnit`, "Run hours per unit must be finite and greater than zero.");
    }
    if (!finiteNonNegative(operation.setupHours ?? 0)) {
      addIssue(issues, "error", "ROUTING_SETUP", `routingOperations[${index}].setupHours`, "Setup hours must be finite and non-negative.");
    }
    const yieldPct = operation.yieldPct ?? 1;
    if (!Number.isFinite(yieldPct) || yieldPct <= 0 || yieldPct > 1) {
      addIssue(issues, "error", "ROUTING_YIELD", `routingOperations[${index}].yieldPct`, "Routing yield must be greater than zero and at most one.");
    }
    if (operation.eligibleResourceIds.length === 0) {
      addIssue(issues, "error", "NO_ELIGIBLE_RESOURCE", `routingOperations[${index}].eligibleResourceIds`, "Every routing operation requires at least one eligible resource.");
    }
    for (const resourceId of operation.eligibleResourceIds) {
      if (!resources.has(resourceId)) {
        addIssue(issues, "error", "UNKNOWN_RESOURCE", `routingOperations[${index}].eligibleResourceIds`, `Unknown resource ${resourceId}.`);
      }
    }
    for (const predecessorId of operation.predecessorOperationIds ?? []) {
      const predecessor = operations.get(predecessorId);
      if (!predecessor) {
        addIssue(issues, "error", "UNKNOWN_PREDECESSOR", `routingOperations[${index}].predecessorOperationIds`, `Unknown predecessor operation ${predecessorId}.`);
      } else if (predecessor.productId !== operation.productId) {
        addIssue(issues, "error", "CROSS_PRODUCT_PREDECESSOR", `routingOperations[${index}].predecessorOperationIds`, `Predecessor ${predecessorId} belongs to another product.`);
      } else if (predecessor.sequence >= operation.sequence) {
        addIssue(issues, "error", "INVALID_PREDECESSOR_SEQUENCE", `routingOperations[${index}].predecessorOperationIds`, `Predecessor ${predecessorId} must have a lower sequence.`);
      }
    }
  }

  const productSequence = new Set<string>();
  for (const [index, operation] of model.routingOperations.entries()) {
    const key = `${operation.productId}::${operation.sequence}`;
    if (productSequence.has(key)) {
      addIssue(issues, "error", "DUPLICATE_PRODUCT_SEQUENCE", `routingOperations[${index}].sequence`, `Product ${operation.productId} has more than one operation at sequence ${operation.sequence}.`);
    }
    productSequence.add(key);
  }

  for (const [index, lane] of model.supplierLanes.entries()) {
    if (!lane.supplierId.trim() || !lane.sku.trim()) {
      addIssue(issues, "error", "SUPPLIER_LANE_IDENTITY", `supplierLanes[${index}]`, "Supplier ID and SKU must not be empty.");
    }
    if (!Number.isInteger(lane.leadTimePeriods) || lane.leadTimePeriods < 0) {
      addIssue(issues, "error", "SUPPLIER_LEAD_TIME", `supplierLanes[${index}].leadTimePeriods`, "Lead time must be a non-negative integer number of planning periods.");
    }
    if (!finiteNonNegative(lane.moq) || !Number.isFinite(lane.orderMultiple) || lane.orderMultiple <= 0) {
      addIssue(issues, "error", "SUPPLIER_ORDER_POLICY", `supplierLanes[${index}]`, "MOQ must be non-negative and order multiple must be greater than zero.");
    }
    if (!finiteNonNegative(lane.landedUnitCostLakh)) {
      addIssue(issues, "error", "SUPPLIER_COST", `supplierLanes[${index}].landedUnitCostLakh`, "Landed unit cost must be finite and non-negative.");
    }
    if (!Number.isFinite(lane.reliability) || lane.reliability < 0 || lane.reliability > 1) {
      addIssue(issues, "error", "SUPPLIER_RELIABILITY", `supplierLanes[${index}].reliability`, "Supplier reliability must be between zero and one.");
    }
    if (lane.alternateRank !== undefined && (!Number.isInteger(lane.alternateRank) || lane.alternateRank < 1)) {
      addIssue(issues, "error", "SUPPLIER_ALTERNATE_RANK", `supplierLanes[${index}].alternateRank`, "Alternate rank must be a positive integer.");
    }
    if (lane.validFromPeriod !== undefined && !periodIsValid(lane.validFromPeriod, horizon)) {
      addIssue(issues, "error", "SUPPLIER_VALID_FROM", `supplierLanes[${index}].validFromPeriod`, "Supplier validity start is outside the planning horizon.");
    }
    if (lane.validToPeriod !== undefined && !periodIsValid(lane.validToPeriod, horizon)) {
      addIssue(issues, "error", "SUPPLIER_VALID_TO", `supplierLanes[${index}].validToPeriod`, "Supplier validity end is outside the planning horizon.");
    }
    if (
      lane.validFromPeriod !== undefined &&
      lane.validToPeriod !== undefined &&
      lane.validFromPeriod > lane.validToPeriod
    ) {
      addIssue(issues, "error", "SUPPLIER_VALIDITY_ORDER", `supplierLanes[${index}]`, "Supplier validity start must not be after validity end.");
    }
    for (const [capacityIndex, capacity] of (lane.capacity ?? []).entries()) {
      const path = `supplierLanes[${index}].capacity[${capacityIndex}]`;
      if (!periodIsValid(capacity.period, horizon)) {
        addIssue(issues, "error", "SUPPLIER_CAPACITY_PERIOD", `${path}.period`, "Supplier capacity period is outside the planning horizon.");
      }
      if (!finiteNonNegative(capacity.maxQty)) {
        addIssue(issues, "error", "SUPPLIER_CAPACITY", `${path}.maxQty`, "Supplier maximum quantity must be finite and non-negative.");
      }
    }
    if (!lane.approved) {
      addIssue(issues, "warning", "UNAPPROVED_SUPPLIER_LANE", `supplierLanes[${index}].approved`, `Supplier lane ${lane.id} is not approved and must not be selected for execution.`);
    }
  }

  const weights = Object.entries(model.objectiveWeights);
  let positiveWeightCount = 0;
  for (const [name, weight] of weights) {
    if (!finiteNonNegative(weight)) {
      addIssue(issues, "error", "OBJECTIVE_WEIGHT", `objectiveWeights.${name}`, "Objective weight must be finite and non-negative.");
    } else if (weight > 0) {
      positiveWeightCount += 1;
    }
  }
  if (positiveWeightCount === 0) {
    addIssue(issues, "error", "EMPTY_OBJECTIVE", "objectiveWeights", "At least one optimisation objective weight must be greater than zero.");
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
