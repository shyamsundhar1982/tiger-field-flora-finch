import type { RoutingOperation } from "./advanced-planning-constraints.ts";

export type EprActualOperation = {
  id: string;
  travellerId: string;
  operationCode: string;
  workstation?: string;
  startedAt?: string;
  completedAt?: string;
  status: "planned" | "in_progress" | "completed" | "hold" | "rework" | "rejected";
  recordReference?: string;
};

export type RoutingActualMatch = {
  actualOperationId: string;
  travellerId: string;
  routingOperationId: string;
  operationCode: string;
  status: EprActualOperation["status"];
  workstation?: string;
  resourceEvidence: "eligible_resource_id" | "unresolved" | "absent";
  actualHours?: number;
  expectedRunHours: number;
  varianceHours?: number;
  variancePct?: number;
  recordReference?: string;
};

export type RoutingLearningIssue = {
  severity: "error" | "warning";
  code: string;
  actualOperationId?: string;
  routingOperationId?: string;
  message: string;
};

export type RoutingActualLearningResult = {
  learningReady: boolean;
  matches: RoutingActualMatch[];
  issues: RoutingLearningIssue[];
  unmatchedActualOperationIds: string[];
  missingRoutingOperationIds: string[];
  summary: {
    actualOperationCount: number;
    matchedOperationCount: number;
    completedTimedOperationCount: number;
    totalActualHours: number;
    totalExpectedRunHours: number;
    totalVarianceHours: number;
    averageVariancePct?: number;
    reworkOperationCount: number;
  };
  governance: {
    mayAutoUpdateRoutingStandards: false;
    humanReviewRequiredForStandardChange: true;
  };
};

function round(value: number) {
  return Number(value.toFixed(6));
}

function parseTimestamp(value?: string) {
  if (!value?.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function reconcileRoutingActuals(
  routingOperations: RoutingOperation[],
  actualOperations: EprActualOperation[],
): RoutingActualLearningResult {
  const issues: RoutingLearningIssue[] = [];
  const matches: RoutingActualMatch[] = [];
  const routingByCode = new Map<string, RoutingOperation[]>();

  for (const routing of routingOperations) {
    const code = routing.operationCode.trim();
    const rows = routingByCode.get(code) ?? [];
    rows.push(routing);
    routingByCode.set(code, rows);
  }

  for (const [code, rows] of routingByCode.entries()) {
    if (rows.length > 1) {
      issues.push({
        severity: "error",
        code: "AMBIGUOUS_ROUTING_OPERATION_CODE",
        message: `Routing operation code ${code} resolves to ${rows.length} operations; actual execution cannot be reconciled deterministically.`,
      });
    }
  }

  const matchedRoutingIds = new Set<string>();
  const unmatchedActualOperationIds: string[] = [];

  for (const actual of actualOperations) {
    const routingMatches = routingByCode.get(actual.operationCode.trim()) ?? [];
    if (routingMatches.length !== 1) {
      unmatchedActualOperationIds.push(actual.id);
      issues.push({
        severity: routingMatches.length === 0 ? "warning" : "error",
        code: routingMatches.length === 0 ? "UNMATCHED_ACTUAL_OPERATION" : "AMBIGUOUS_ACTUAL_OPERATION",
        actualOperationId: actual.id,
        message:
          routingMatches.length === 0
            ? `Actual operation ${actual.operationCode} has no matching approved routing operation.`
            : `Actual operation ${actual.operationCode} maps to more than one routing operation.`,
      });
      continue;
    }

    const routing = routingMatches[0];
    matchedRoutingIds.add(routing.id);
    const startedAt = parseTimestamp(actual.startedAt);
    const completedAt = parseTimestamp(actual.completedAt);
    let actualHours: number | undefined;

    if (actual.startedAt && startedAt === undefined) {
      issues.push({
        severity: "error",
        code: "INVALID_ACTUAL_START",
        actualOperationId: actual.id,
        routingOperationId: routing.id,
        message: `Actual operation ${actual.id} has an invalid startedAt timestamp.`,
      });
    }
    if (actual.completedAt && completedAt === undefined) {
      issues.push({
        severity: "error",
        code: "INVALID_ACTUAL_COMPLETION",
        actualOperationId: actual.id,
        routingOperationId: routing.id,
        message: `Actual operation ${actual.id} has an invalid completedAt timestamp.`,
      });
    }
    if (startedAt !== undefined && completedAt !== undefined) {
      if (completedAt < startedAt) {
        issues.push({
          severity: "error",
          code: "NEGATIVE_ACTUAL_DURATION",
          actualOperationId: actual.id,
          routingOperationId: routing.id,
          message: `Actual operation ${actual.id} completes before it starts.`,
        });
      } else {
        actualHours = (completedAt - startedAt) / 3_600_000;
      }
    } else if (actual.status === "completed" || actual.status === "rework") {
      issues.push({
        severity: "warning",
        code: "COMPLETED_OPERATION_WITHOUT_DURATION",
        actualOperationId: actual.id,
        routingOperationId: routing.id,
        message: `Completed/rework operation ${actual.id} lacks a complete start/completion timestamp pair and cannot calibrate cycle time.`,
      });
    }

    const workstation = actual.workstation?.trim() || undefined;
    const resourceEvidence = !workstation
      ? "absent"
      : routing.eligibleResourceIds.includes(workstation)
        ? "eligible_resource_id"
        : "unresolved";

    if (resourceEvidence === "unresolved") {
      issues.push({
        severity: "warning",
        code: "WORKSTATION_RESOURCE_UNRESOLVED",
        actualOperationId: actual.id,
        routingOperationId: routing.id,
        message: `Actual workstation ${workstation} is not an eligible governed resource ID for routing operation ${routing.id}.`,
      });
    }

    const varianceHours = actualHours === undefined ? undefined : actualHours - routing.runHoursPerUnit;
    const variancePct =
      actualHours === undefined || routing.runHoursPerUnit <= 0
        ? undefined
        : varianceHours! / routing.runHoursPerUnit;

    matches.push({
      actualOperationId: actual.id,
      travellerId: actual.travellerId,
      routingOperationId: routing.id,
      operationCode: actual.operationCode,
      status: actual.status,
      workstation,
      resourceEvidence,
      actualHours: actualHours === undefined ? undefined : round(actualHours),
      expectedRunHours: routing.runHoursPerUnit,
      varianceHours: varianceHours === undefined ? undefined : round(varianceHours),
      variancePct: variancePct === undefined ? undefined : round(variancePct),
      recordReference: actual.recordReference,
    });
  }

  const missingRoutingOperationIds = routingOperations
    .filter((routing) => !matchedRoutingIds.has(routing.id))
    .map((routing) => routing.id)
    .sort();

  for (const routingOperationId of missingRoutingOperationIds) {
    issues.push({
      severity: "warning",
      code: "ROUTING_OPERATION_NO_ACTUAL",
      routingOperationId,
      message: `Routing operation ${routingOperationId} has no actual execution record in the supplied traveller sample.`,
    });
  }

  const timed = matches.filter((row) => row.actualHours !== undefined);
  const totalActualHours = timed.reduce((sum, row) => sum + (row.actualHours ?? 0), 0);
  const totalExpectedRunHours = timed.reduce((sum, row) => sum + row.expectedRunHours, 0);
  const percentageRows = timed.filter((row) => row.variancePct !== undefined);
  const averageVariancePct = percentageRows.length
    ? percentageRows.reduce((sum, row) => sum + (row.variancePct ?? 0), 0) / percentageRows.length
    : undefined;

  const hasErrors = issues.some((row) => row.severity === "error");
  const completedTimedOperationCount = matches.filter(
    (row) => (row.status === "completed" || row.status === "rework") && row.actualHours !== undefined,
  ).length;

  return {
    learningReady: !hasErrors && completedTimedOperationCount > 0,
    matches,
    issues,
    unmatchedActualOperationIds: unmatchedActualOperationIds.sort(),
    missingRoutingOperationIds,
    summary: {
      actualOperationCount: actualOperations.length,
      matchedOperationCount: matches.length,
      completedTimedOperationCount,
      totalActualHours: round(totalActualHours),
      totalExpectedRunHours: round(totalExpectedRunHours),
      totalVarianceHours: round(totalActualHours - totalExpectedRunHours),
      averageVariancePct: averageVariancePct === undefined ? undefined : round(averageVariancePct),
      reworkOperationCount: matches.filter((row) => row.status === "rework").length,
    },
    governance: {
      mayAutoUpdateRoutingStandards: false,
      humanReviewRequiredForStandardChange: true,
    },
  };
}
