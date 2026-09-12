import type { RoutingOperation } from "./advanced-planning-constraints.ts";

export type RoutingRevisionStatus = "draft" | "approved" | "retired";

export type GovernedRoutingRevision = {
  id: string;
  productId: string;
  revision: string;
  status: RoutingRevisionStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceRef: string;
};

export type GovernedRoutingOperation = {
  id: string;
  revisionId: string;
  operationCode: string;
  sequence: number;
  eligibleResourceIds: string[];
  runHoursPerUnit: number;
  setupHours?: number;
  yieldPct?: number;
  predecessorOperationIds?: string[];
  eprGateId?: string;
  travellerOperation?: string;
  sourceRef: string;
};

export type RoutingAuthorityInput = {
  asOfDate: string;
  revision: GovernedRoutingRevision;
  operations: GovernedRoutingOperation[];
  knownResourceIds: string[];
};

export type RoutingAuthorityIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type RoutingAuthorityResult = {
  solverReady: boolean;
  operations: RoutingOperation[];
  eprGateByOperationId: Record<string, string>;
  travellerOperationByOperationId: Record<string, string>;
  issues: RoutingAuthorityIssue[];
};

function issue(
  issues: RoutingAuthorityIssue[],
  severity: RoutingAuthorityIssue["severity"],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message });
}

function parseDate(value: string) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

export function compileGovernedRoutingAuthority(input: RoutingAuthorityInput): RoutingAuthorityResult {
  const issues: RoutingAuthorityIssue[] = [];
  const knownResources = new Set(input.knownResourceIds);
  const operationById = new Map(input.operations.map((operation) => [operation.id, operation]));
  const asOf = parseDate(input.asOfDate);
  const effectiveFrom = parseDate(input.revision.effectiveFrom);
  const effectiveTo = input.revision.effectiveTo ? parseDate(input.revision.effectiveTo) : undefined;

  if (!input.revision.id.trim() || !input.revision.productId.trim() || !input.revision.revision.trim()) {
    issue(issues, "error", "ROUTING_REVISION_IDENTITY", "revision", "Routing revision identity fields must not be empty.");
  }
  if (input.revision.status !== "approved") {
    issue(
      issues,
      "warning",
      "ROUTING_REVISION_NOT_APPROVED",
      "revision.status",
      "Only an approved routing revision can become solver eligible.",
    );
  }
  if (asOf === undefined || effectiveFrom === undefined || (input.revision.effectiveTo && effectiveTo === undefined)) {
    issue(issues, "error", "ROUTING_EFFECTIVITY_DATE", "revision", "Routing effectivity dates must be valid YYYY-MM-DD dates.");
  } else {
    if (effectiveTo !== undefined && effectiveTo < effectiveFrom) {
      issue(issues, "error", "ROUTING_EFFECTIVITY_RANGE", "revision.effectiveTo", "Routing effective-to date must not precede effective-from date.");
    }
    if (asOf < effectiveFrom || (effectiveTo !== undefined && asOf > effectiveTo)) {
      issue(
        issues,
        "warning",
        "ROUTING_NOT_EFFECTIVE",
        "asOfDate",
        "Routing revision is not effective for the requested planning date.",
      );
    }
  }

  if (input.operations.length === 0) {
    issue(issues, "error", "ROUTING_EMPTY", "operations", "An approved routing requires at least one operation.");
  }

  const ids = new Set<string>();
  const sequences = new Set<number>();
  const operationCodes = new Set<string>();
  const eprGateByOperationId: Record<string, string> = {};
  const travellerOperationByOperationId: Record<string, string> = {};

  for (const [index, operation] of input.operations.entries()) {
    const path = `operations[${index}]`;
    if (!operation.id.trim()) {
      issue(issues, "error", "ROUTING_OPERATION_ID", `${path}.id`, "Routing operation ID must not be empty.");
    } else if (ids.has(operation.id)) {
      issue(issues, "error", "ROUTING_OPERATION_DUPLICATE_ID", `${path}.id`, `Duplicate routing operation ID ${operation.id}.`);
    }
    ids.add(operation.id);

    if (operation.revisionId !== input.revision.id) {
      issue(
        issues,
        "error",
        "ROUTING_REVISION_MISMATCH",
        `${path}.revisionId`,
        `Operation ${operation.id} does not belong to routing revision ${input.revision.id}.`,
      );
    }
    if (!operation.operationCode.trim()) {
      issue(issues, "error", "ROUTING_OPERATION_CODE", `${path}.operationCode`, "Operation code must not be empty.");
    } else if (operationCodes.has(operation.operationCode)) {
      issue(
        issues,
        "error",
        "ROUTING_OPERATION_DUPLICATE_CODE",
        `${path}.operationCode`,
        `Operation code ${operation.operationCode} is duplicated within the revision.`,
      );
    }
    operationCodes.add(operation.operationCode);

    if (!Number.isInteger(operation.sequence) || operation.sequence <= 0) {
      issue(issues, "error", "ROUTING_SEQUENCE", `${path}.sequence`, "Routing sequence must be a positive integer.");
    } else if (sequences.has(operation.sequence)) {
      issue(
        issues,
        "error",
        "ROUTING_DUPLICATE_SEQUENCE",
        `${path}.sequence`,
        `Routing sequence ${operation.sequence} is duplicated within the revision.`,
      );
    }
    sequences.add(operation.sequence);

    if (operation.eligibleResourceIds.length === 0) {
      issue(issues, "error", "ROUTING_NO_RESOURCE", `${path}.eligibleResourceIds`, "Every operation needs at least one eligible resource.");
    }
    for (const resourceId of operation.eligibleResourceIds) {
      if (!knownResources.has(resourceId)) {
        issue(
          issues,
          "error",
          "ROUTING_UNKNOWN_RESOURCE",
          `${path}.eligibleResourceIds`,
          `Routing operation ${operation.id} references unknown resource ${resourceId}.`,
        );
      }
    }

    if (!finitePositive(operation.runHoursPerUnit)) {
      issue(issues, "error", "ROUTING_RUN_TIME", `${path}.runHoursPerUnit`, "Run hours per unit must be finite and greater than zero.");
    }
    if (!finiteNonNegative(operation.setupHours ?? 0)) {
      issue(issues, "error", "ROUTING_SETUP_TIME", `${path}.setupHours`, "Setup hours must be finite and non-negative.");
    }
    const yieldPct = operation.yieldPct ?? 1;
    if (!Number.isFinite(yieldPct) || yieldPct <= 0 || yieldPct > 1) {
      issue(issues, "error", "ROUTING_YIELD", `${path}.yieldPct`, "Operation yield must be greater than zero and at most one.");
    }

    if (operation.eprGateId) {
      if (!/^EPR-\d{2}$/.test(operation.eprGateId)) {
        issue(issues, "error", "ROUTING_EPR_GATE", `${path}.eprGateId`, "EPR gate linkage must use the EPR-NN identifier format.");
      } else {
        eprGateByOperationId[operation.id] = operation.eprGateId;
      }
    } else {
      issue(
        issues,
        "warning",
        "ROUTING_EPR_GATE_MISSING",
        `${path}.eprGateId`,
        `Operation ${operation.id} is not yet linked to an EPR traveller gate.`,
      );
    }

    if (operation.travellerOperation?.trim()) {
      travellerOperationByOperationId[operation.id] = operation.travellerOperation.trim();
    }
  }

  for (const [index, operation] of input.operations.entries()) {
    for (const predecessorId of operation.predecessorOperationIds ?? []) {
      const predecessor = operationById.get(predecessorId);
      if (!predecessor) {
        issue(
          issues,
          "error",
          "ROUTING_UNKNOWN_PREDECESSOR",
          `operations[${index}].predecessorOperationIds`,
          `Unknown predecessor operation ${predecessorId}.`,
        );
      } else if (predecessor.revisionId !== input.revision.id) {
        issue(
          issues,
          "error",
          "ROUTING_CROSS_REVISION_PREDECESSOR",
          `operations[${index}].predecessorOperationIds`,
          `Predecessor ${predecessorId} belongs to another routing revision.`,
        );
      } else if (predecessor.sequence >= operation.sequence) {
        issue(
          issues,
          "error",
          "ROUTING_PREDECESSOR_SEQUENCE",
          `operations[${index}].predecessorOperationIds`,
          `Predecessor ${predecessorId} must have a lower sequence than ${operation.id}.`,
        );
      }
    }
  }

  const effective =
    asOf !== undefined &&
    effectiveFrom !== undefined &&
    asOf >= effectiveFrom &&
    (effectiveTo === undefined || asOf <= effectiveTo);
  const hasErrors = issues.some((row) => row.severity === "error");
  const solverReady = !hasErrors && input.revision.status === "approved" && effective;

  const operations: RoutingOperation[] = solverReady
    ? [...input.operations]
        .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
        .map((operation) => ({
          id: operation.id,
          productId: input.revision.productId,
          operationCode: operation.operationCode,
          sequence: operation.sequence,
          eligibleResourceIds: [...operation.eligibleResourceIds],
          runHoursPerUnit: operation.runHoursPerUnit,
          setupHours: operation.setupHours,
          yieldPct: operation.yieldPct,
          predecessorOperationIds: operation.predecessorOperationIds,
          sourceRef: [input.revision.sourceRef, operation.sourceRef].filter(Boolean).join(" | "),
        }))
    : [];

  return { solverReady, operations, eprGateByOperationId, travellerOperationByOperationId, issues };
}
