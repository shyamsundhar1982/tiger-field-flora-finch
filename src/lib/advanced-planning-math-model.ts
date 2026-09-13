import {
  validateAdvancedPlanningConstraintModel,
  type AdvancedPlanningConstraintModel,
  type PlanningObjectiveWeights,
} from "./advanced-planning-constraints.ts";

export const ADVANCED_MATH_MODEL_VERSION = "VYNDI-ADVANCED-MATH-MODEL-0.2" as const;

export type MathVariableType = "continuous" | "integer" | "binary";
export type MathConstraintSense = "eq" | "le" | "ge";

export type MathObjectiveKey = keyof PlanningObjectiveWeights;

export type MathVariable = {
  id: string;
  type: MathVariableType;
  lowerBound: number;
  upperBound?: number;
  objectiveKey?: MathObjectiveKey;
  objectiveRawFactor?: number;
  objectiveCoefficient: number;
  semantic: string;
};

export type MathTerm = { variableId: string; coefficient: number };

export type MathConstraint = {
  id: string;
  sense: MathConstraintSense;
  rhs: number;
  terms: MathTerm[];
  semantic: string;
};

export type AdvancedMathModelIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type AdvancedPlanningMathematicalModel = {
  version: typeof ADVANCED_MATH_MODEL_VERSION;
  sourceModelVersion: string;
  solverClass: "milp";
  horizonPeriods: number;
  variables: MathVariable[];
  constraints: MathConstraint[];
  objectiveWeights: PlanningObjectiveWeights;
  issues: AdvancedMathModelIssue[];
  semantics: string[];
};

export type AdvancedMathModelCompileResult = {
  valid: boolean;
  model?: AdvancedPlanningMathematicalModel;
  issues: AdvancedMathModelIssue[];
};

function clean(value: string) {
  return value.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "X";
}

function v(prefix: string, ...parts: Array<string | number>) {
  return [prefix, ...parts.map((part) => clean(String(part)))].join("__");
}

function c(prefix: string, ...parts: Array<string | number>) {
  return [prefix, ...parts.map((part) => clean(String(part)))].join("__");
}

function addTerm(terms: MathTerm[], variableId: string, coefficient: number) {
  if (Math.abs(coefficient) <= 1e-12) return;
  const existing = terms.find((row) => row.variableId === variableId);
  if (existing) existing.coefficient += coefficient;
  else terms.push({ variableId, coefficient });
}

function totalProductDemand(model: AdvancedPlanningConstraintModel, productId: string) {
  return model.demands.filter((row) => row.productId === productId).reduce((sum, row) => sum + row.quantity, 0);
}

export function compileAdvancedPlanningMathematicalModel(
  source: AdvancedPlanningConstraintModel,
): AdvancedMathModelCompileResult {
  const issues: AdvancedMathModelIssue[] = [];
  const validation = validateAdvancedPlanningConstraintModel(source);
  for (const issue of validation.issues.filter((row) => row.severity === "error")) {
    issues.push({ severity: "error", code: `SOURCE_${issue.code}`, message: `${issue.path}: ${issue.message}` });
  }
  if (issues.some((row) => row.severity === "error")) return { valid: false, issues };

  const variables: MathVariable[] = [];
  const constraints: MathConstraint[] = [];
  const variableIds = new Set<string>();
  const H = source.horizonPeriods;

  const addVariable = (row: MathVariable) => {
    if (variableIds.has(row.id)) {
      issues.push({ severity: "error", code: "DUPLICATE_VARIABLE", message: `Duplicate mathematical variable ${row.id}.` });
      return;
    }
    variableIds.add(row.id);
    variables.push(row);
  };
  const addConstraint = (row: MathConstraint) => constraints.push(row);

  const products = [...new Set([
    ...source.demands.map((row) => row.productId),
    ...source.bom.map((row) => row.productId),
    ...source.routingOperations.map((row) => row.productId),
  ])].sort();

  for (const productId of products) {
    const upper = totalProductDemand(source, productId);
    for (let period = 1; period <= H; period += 1) {
      addVariable({
        id: v("PROD", productId, period), type: "continuous", lowerBound: 0, upperBound: upper,
        objectiveCoefficient: 0, semantic: `production:${productId}:M${period}`,
      });
    }
  }

  for (const demand of source.demands) {
    const unmetKey: MathObjectiveKey = demand.truth === "committed" ? "unmetCommittedDemand" : "unmetForecastDemand";
    addVariable({
      id: v("UNMET", demand.id), type: "continuous", lowerBound: 0, upperBound: demand.quantity,
      objectiveKey: unmetKey, objectiveRawFactor: demand.priority,
      objectiveCoefficient: source.objectiveWeights[unmetKey] * demand.priority,
      semantic: `unmet:${demand.id}`,
    });
    const balance: MathTerm[] = [{ variableId: v("UNMET", demand.id), coefficient: 1 }];
    for (let delivery = demand.period; delivery <= H; delivery += 1) {
      const lateness = delivery - demand.period;
      addVariable({
        id: v("FULFILL", demand.id, delivery), type: "continuous", lowerBound: 0, upperBound: demand.quantity,
        objectiveKey: lateness > 0 ? "lateness" : undefined,
        objectiveRawFactor: lateness > 0 ? demand.priority * lateness : undefined,
        objectiveCoefficient: lateness > 0 ? source.objectiveWeights.lateness * demand.priority * lateness : 0,
        semantic: `fulfil:${demand.id}:M${delivery}`,
      });
      balance.push({ variableId: v("FULFILL", demand.id, delivery), coefficient: 1 });
    }
    addConstraint({ id: c("DEMAND_BALANCE", demand.id), sense: "eq", rhs: demand.quantity, terms: balance, semantic: `demand balance ${demand.id}` });
  }

  for (const productId of products) {
    for (let period = 1; period <= H; period += 1) {
      const terms: MathTerm[] = [];
      for (let p = 1; p <= period; p += 1) addTerm(terms, v("PROD", productId, p), 1);
      for (const demand of source.demands.filter((row) => row.productId === productId)) {
        for (let delivery = demand.period; delivery <= period; delivery += 1) addTerm(terms, v("FULFILL", demand.id, delivery), -1);
      }
      addConstraint({ id: c("FG_CUMULATIVE", productId, period), sense: "ge", rhs: 0, terms, semantic: `cumulative finished-goods coverage ${productId} M${period}` });
    }
    addConstraint({
      id: c("PRODUCTION_TOTAL_CAP", productId),
      sense: "le",
      rhs: totalProductDemand(source, productId),
      terms: Array.from({ length: H }, (_, index) => ({ variableId: v("PROD", productId, index + 1), coefficient: 1 })),
      semantic: `total production cannot exceed governed demand for ${productId}`,
    });
  }

  const skuRequirements = new Map<string, Array<{ productId: string; factor: number }>>();
  for (const bom of source.bom) {
    const rows = skuRequirements.get(bom.sku) ?? [];
    rows.push({ productId: bom.productId, factor: bom.quantityPerUnit * (1 + (bom.scrapPct ?? 0)) });
    skuRequirements.set(bom.sku, rows);
  }
  const materialBySku = new Map(source.materials.map((row) => [row.sku, row]));
  const receiptsBySku = new Map<string, typeof source.committedReceipts>();
  for (const receipt of source.committedReceipts) {
    const rows = receiptsBySku.get(receipt.sku) ?? [];
    rows.push(receipt);
    receiptsBySku.set(receipt.sku, rows);
  }

  const procurementVarsBySkuReceipt = new Map<string, Array<{ variableId: string; qtyPerLot: number }>>();
  for (const lane of source.supplierLanes.filter((row) => row.approved)) {
    if (!lane.capacity?.length) {
      issues.push({ severity: "error", code: "SUPPLIER_CAPACITY_REQUIRED", message: `Supplier lane ${lane.id} has no finite capacity evidence.` });
      continue;
    }
    const totalRequirement = (skuRequirements.get(lane.sku) ?? []).reduce((sum, req) => sum + totalProductDemand(source, req.productId) * req.factor, 0);
    const upperQty = Math.max(totalRequirement, lane.moq, lane.orderMultiple);
    const upperLots = Math.max(1, Math.ceil(upperQty / lane.orderMultiple));
    const capacityByReceipt = new Map(lane.capacity.map((row) => [row.period, row.maxQty]));
    for (let orderPeriod = 1; orderPeriod <= H; orderPeriod += 1) {
      const receiptPeriod = orderPeriod + lane.leadTimePeriods;
      if (receiptPeriod > H) continue;
      const lotId = v("PROC_LOTS", lane.id, orderPeriod);
      const activeId = v("PROC_ACTIVE", lane.id, orderPeriod);
      addVariable({
        id: lotId, type: "integer", lowerBound: 0, upperBound: upperLots,
        objectiveKey: "procurementCost", objectiveRawFactor: lane.orderMultiple * lane.landedUnitCostLakh,
        objectiveCoefficient: source.objectiveWeights.procurementCost * lane.orderMultiple * lane.landedUnitCostLakh,
        semantic: `procurement lots:${lane.id}:order M${orderPeriod}:receipt M${receiptPeriod}`,
      });
      addVariable({ id: activeId, type: "binary", lowerBound: 0, upperBound: 1, objectiveCoefficient: 0, semantic: `procurement active:${lane.id}:M${orderPeriod}` });
      addConstraint({
        id: c("PROC_ACTIVE_UPPER", lane.id, orderPeriod), sense: "le", rhs: 0,
        terms: [{ variableId: lotId, coefficient: 1 }, { variableId: activeId, coefficient: -upperLots }],
        semantic: `procurement activation upper ${lane.id} M${orderPeriod}`,
      });
      if (lane.moq > 0) {
        addConstraint({
          id: c("PROC_MOQ", lane.id, orderPeriod), sense: "ge", rhs: 0,
          terms: [{ variableId: lotId, coefficient: lane.orderMultiple }, { variableId: activeId, coefficient: -lane.moq }],
          semantic: `MOQ ${lane.id} M${orderPeriod}`,
        });
      }
      const receiptKey = `${lane.sku}::${receiptPeriod}`;
      const receipts = procurementVarsBySkuReceipt.get(receiptKey) ?? [];
      receipts.push({ variableId: lotId, qtyPerLot: lane.orderMultiple });
      procurementVarsBySkuReceipt.set(receiptKey, receipts);

      const overId = v("SUP_OVER", lane.id, receiptPeriod);
      if (!variableIds.has(overId)) {
        addVariable({
          id: overId, type: "continuous", lowerBound: 0,
          objectiveKey: "supplierOverload", objectiveRawFactor: 1,
          objectiveCoefficient: source.objectiveWeights.supplierOverload,
          semantic: `supplier overload:${lane.id}:M${receiptPeriod}`,
        });
      }
      const capacity = capacityByReceipt.get(receiptPeriod);
      if (capacity === undefined) {
        issues.push({ severity: "error", code: "SUPPLIER_CAPACITY_PERIOD_REQUIRED", message: `Supplier lane ${lane.id} has no finite capacity for receipt period ${receiptPeriod}.` });
      } else {
        addConstraint({
          id: c("SUP_CAP", lane.id, receiptPeriod), sense: "le", rhs: capacity,
          terms: [{ variableId: lotId, coefficient: lane.orderMultiple }, { variableId: overId, coefficient: -1 }],
          semantic: `supplier capacity ${lane.id} M${receiptPeriod}`,
        });
      }
    }
  }

  for (const [sku, requirements] of skuRequirements.entries()) {
    const material = materialBySku.get(sku);
    if (!material) {
      issues.push({ severity: "error", code: "MATERIAL_POSITION_REQUIRED", message: `Required SKU ${sku} has no governed material position.` });
      continue;
    }
    const reserved = material.reservedQty ?? 0;
    const safetyTarget = material.safetyStockQty ?? 0;
    const unreservedOpening = material.onHandQty - reserved;
    const protectedSafetyStock = Math.min(safetyTarget, Math.max(0, unreservedOpening));
    const openingSafetyDeficit = safetyTarget - protectedSafetyStock;
    const opening = unreservedOpening - protectedSafetyStock;
    if (openingSafetyDeficit > 1e-12) {
      issues.push({
        severity: "warning",
        code: "OPENING_SAFETY_STOCK_DEFICIT",
        message: `SKU ${sku} opens ${openingSafetyDeficit} below its governed safety-stock target. The optimizer protects only physically available unreserved opening stock; the pre-existing deficit remains planning evidence rather than impossible negative inventory.`,
      });
    }
    for (let period = 1; period <= H; period += 1) {
      const terms: MathTerm[] = [];
      for (const req of requirements) {
        for (let p = 1; p <= period; p += 1) addTerm(terms, v("PROD", req.productId, p), -req.factor);
      }
      for (let receiptPeriod = 1; receiptPeriod <= period; receiptPeriod += 1) {
        for (const proc of procurementVarsBySkuReceipt.get(`${sku}::${receiptPeriod}`) ?? []) addTerm(terms, proc.variableId, proc.qtyPerLot);
      }
      const committed = (receiptsBySku.get(sku) ?? []).filter((row) => row.period <= period).reduce((sum, row) => sum + row.quantity, 0);
      const materialRhs = -(opening + committed);
      addConstraint({
        id: c("MATERIAL_CUMULATIVE", sku, period), sense: "ge", rhs: Math.abs(materialRhs) <= 1e-12 ? 0 : materialRhs, terms,
        semantic: `protected cumulative material balance ${sku} M${period}`,
      });
    }
  }

  const resourceById = new Map(source.resources.map((row) => [row.id, row]));
  const resourceLoadTerms = new Map<string, MathTerm[]>();
  for (const operation of source.routingOperations) {
    const productUpper = totalProductDemand(source, operation.productId);
    for (let period = 1; period <= H; period += 1) {
      const assignmentTerms: MathTerm[] = [];
      for (const resourceId of operation.eligibleResourceIds) {
        const resource = resourceById.get(resourceId);
        if (!resource) continue;
        const assignId = v("ASSIGN", operation.id, resourceId, period);
        const activeId = v("OP_ACTIVE", operation.id, resourceId, period);
        addVariable({ id: assignId, type: "continuous", lowerBound: 0, upperBound: productUpper, objectiveCoefficient: 0, semantic: `operation assignment:${operation.id}:${resourceId}:M${period}` });
        addVariable({ id: activeId, type: "binary", lowerBound: 0, upperBound: 1, objectiveCoefficient: 0, semantic: `operation active:${operation.id}:${resourceId}:M${period}` });
        assignmentTerms.push({ variableId: assignId, coefficient: 1 });
        addConstraint({
          id: c("OP_ACTIVE_UPPER", operation.id, resourceId, period), sense: "le", rhs: 0,
          terms: [{ variableId: assignId, coefficient: 1 }, { variableId: activeId, coefficient: -productUpper }],
          semantic: `operation setup activation ${operation.id} ${resourceId} M${period}`,
        });
        const loadKey = `${resourceId}::${period}`;
        const load = resourceLoadTerms.get(loadKey) ?? [];
        addTerm(load, assignId, operation.runHoursPerUnit / (operation.yieldPct ?? 1));
        addTerm(load, activeId, operation.setupHours ?? 0);
        resourceLoadTerms.set(loadKey, load);
      }
      addTerm(assignmentTerms, v("PROD", operation.productId, period), -1);
      addConstraint({ id: c("OP_ASSIGNMENT", operation.id, period), sense: "eq", rhs: 0, terms: assignmentTerms, semantic: `assign all production through ${operation.id} M${period}` });
    }
  }

  for (const resource of source.resources) {
    const capacityByPeriod = new Map(resource.capacity.map((row) => [row.period, row.availableHours]));
    for (let period = 1; period <= H; period += 1) {
      const load = resourceLoadTerms.get(`${resource.id}::${period}`) ?? [];
      if (!load.length) continue;
      const hours = capacityByPeriod.get(period);
      if (hours === undefined) {
        issues.push({ severity: "error", code: "RESOURCE_CAPACITY_PERIOD_REQUIRED", message: `Resource ${resource.id} has modeled load but no capacity in period ${period}.` });
        continue;
      }
      const overId = v("RES_OVER", resource.id, period);
      addVariable({
        id: overId, type: "continuous", lowerBound: 0,
        objectiveKey: "resourceOverload", objectiveRawFactor: 1,
        objectiveCoefficient: source.objectiveWeights.resourceOverload,
        semantic: `resource overload:${resource.id}:M${period}`,
      });
      addTerm(load, overId, -1);
      addConstraint({ id: c("RESOURCE_CAP", resource.id, period), sense: "le", rhs: hours * resource.efficiency, terms: load, semantic: `effective resource capacity ${resource.id} M${period}` });
    }
  }

  issues.push({ severity: "warning", code: "WORKING_CAPITAL_ZERO_BASIS", message: "The current constraint model has no governed inventory carrying-cost policy; working-capital objective contribution is held at zero rather than invented." });
  issues.push({ severity: "warning", code: "SCHEDULE_CHANGE_ZERO_BASIS", message: "The current constraint model has no prior finite schedule baseline; schedule-change objective contribution is held at zero rather than invented." });
  issues.push({ severity: "warning", code: "SUPPLIER_RELIABILITY_NOT_DERATED", message: "Governed supplier reliability remains evidence and is not used to derate finite capacity without an approved risk-to-capacity policy." });

  const hasErrors = issues.some((row) => row.severity === "error");
  if (hasErrors) return { valid: false, issues };

  return {
    valid: true,
    issues,
    model: {
      version: ADVANCED_MATH_MODEL_VERSION,
      sourceModelVersion: source.modelVersion,
      solverClass: "milp",
      horizonPeriods: H,
      variables,
      constraints,
      objectiveWeights: source.objectiveWeights,
      issues,
      semantics: [
        "Demand is fulfilled at or after its requested period; unmet quantity is explicit and penalised by truth class and priority.",
        "Production is bounded by total modeled demand and cumulative finished-goods fulfilment cannot exceed cumulative production.",
        "Protected material balance preserves all reservations and protects safety stock only from physically available unreserved opening stock; a pre-existing safety-stock deficit remains a planning exception rather than impossible negative inventory. BOM scrap uses quantityPerUnit × (1 + scrapPct).",
        "Supplier orders use integer order-multiple lots, MOQ activation binaries, governed lead time and finite receipt-period capacity with explicit overload slack.",
        "Operation quantities are assigned only to eligible resources; run load is divided by yield and setup is charged once per active operation-resource-period.",
        "Resource capacity equals governed available hours × efficiency, with explicit overload slack rather than silent infeasibility masking.",
      ],
    },
  };
}
