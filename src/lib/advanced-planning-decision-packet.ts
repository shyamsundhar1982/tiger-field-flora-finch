import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import {
  evaluateConstrainedCapableToPromise,
  type CapableToPromiseRequest,
  type ConstrainedCapableToPromiseResult,
} from "./constrained-capable-to-promise.ts";
import {
  evaluateDeterministicFeasibility,
  type DeterministicFeasibilityResult,
} from "./deterministic-feasibility.ts";

export const ADVANCED_PLANNING_PACKET_VERSION = "VYNDI-ADVANCED-DECISION-PACKET-0.1" as const;
export const DETERMINISTIC_FEASIBILITY_ALGORITHM = "VYNDI-DETERMINISTIC-FEASIBILITY-0.1" as const;
export const CONSTRAINED_CTP_ALGORITHM = "VYNDI-CONSTRAINED-CTP-0.1" as const;

export type AdvancedPlanningSourceLineage = {
  sourceSnapshotId: string;
  sourceSnapshotAt: string;
  sourceSha: string;
  sourceInputHash: string;
  sourceEngineVersion: string;
  approvedPlanId: string;
  approvedPlanRevision: number;
};

export type AdvancedPlanningDecisionPacketInput = {
  packetId: string;
  createdAt: string;
  lineage: AdvancedPlanningSourceLineage;
  model: AdvancedPlanningConstraintModel;
  ctpRequests?: CapableToPromiseRequest[];
};

export type AdvancedPlanningPacketIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type AdvancedPlanningDecisionPacket = {
  packetVersion: typeof ADVANCED_PLANNING_PACKET_VERSION;
  packetId: string;
  createdAt: string;
  lineage: AdvancedPlanningSourceLineage & {
    advancedModelVersion: AdvancedPlanningConstraintModel["modelVersion"];
    algorithms: {
      feasibility: typeof DETERMINISTIC_FEASIBILITY_ALGORITHM;
      capableToPromise: typeof CONSTRAINED_CTP_ALGORITHM;
    };
  };
  governance: {
    advisoryOnly: true;
    mayCreateTransactions: false;
    humanApprovalRequiredForBusinessAction: true;
  };
  evidenceRefs: string[];
  baseline: DeterministicFeasibilityResult;
  capableToPromise: Array<{
    request: CapableToPromiseRequest;
    result: ConstrainedCapableToPromiseResult;
  }>;
  summary: {
    committedStatus: DeterministicFeasibilityResult["committedStatus"];
    totalStatus: DeterministicFeasibilityResult["totalStatus"];
    bindingConstraintCount: number;
    indeterminateCount: number;
    ctpPromiseAvailableCount: number;
    ctpBlockedOrIndeterminateCount: number;
  };
};

export type AdvancedPlanningDecisionPacketBuildResult = {
  valid: boolean;
  packet?: AdvancedPlanningDecisionPacket;
  issues: AdvancedPlanningPacketIssue[];
};

function addIssue(
  issues: AdvancedPlanningPacketIssue[],
  severity: AdvancedPlanningPacketIssue["severity"],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message });
}

function isIsoTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Boolean(value.trim()) && Number.isFinite(parsed);
}

function evidenceRefs(model: AdvancedPlanningConstraintModel) {
  const refs: string[] = [];
  const add = (value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) refs.push(trimmed);
  };

  model.demands.forEach((row) => add(row.sourceRef));
  model.bom.forEach((row) => add(row.sourceRef));
  model.materials.forEach((row) => add(row.sourceRef));
  model.committedReceipts.forEach((row) => add(row.sourceRef));
  model.resources.forEach((row) => add(row.sourceRef));
  model.routingOperations.forEach((row) => add(row.sourceRef));
  model.supplierLanes.forEach((row) => add(row.sourceRef));
  return [...new Set(refs)].sort();
}

function validatePacketInput(input: AdvancedPlanningDecisionPacketInput) {
  const issues: AdvancedPlanningPacketIssue[] = [];
  if (!input.packetId.trim()) {
    addIssue(issues, "error", "PACKET_ID", "packetId", "Decision packet ID must not be empty.");
  }
  if (!isIsoTimestamp(input.createdAt)) {
    addIssue(issues, "error", "PACKET_CREATED_AT", "createdAt", "Decision packet createdAt must be a valid timestamp.");
  }
  if (!input.lineage.sourceSnapshotId.trim()) {
    addIssue(issues, "error", "SOURCE_SNAPSHOT_ID", "lineage.sourceSnapshotId", "Source snapshot ID is required.");
  }
  if (!isIsoTimestamp(input.lineage.sourceSnapshotAt)) {
    addIssue(issues, "error", "SOURCE_SNAPSHOT_AT", "lineage.sourceSnapshotAt", "Source snapshot timestamp must be valid.");
  }
  if (input.lineage.sourceSha.trim().length < 7) {
    addIssue(issues, "error", "SOURCE_SHA", "lineage.sourceSha", "Source commit SHA must contain at least seven characters.");
  }
  if (input.lineage.sourceInputHash.trim().length < 16) {
    addIssue(issues, "error", "SOURCE_INPUT_HASH", "lineage.sourceInputHash", "Governed source input hash is required.");
  }
  if (!input.lineage.sourceEngineVersion.trim()) {
    addIssue(issues, "error", "SOURCE_ENGINE_VERSION", "lineage.sourceEngineVersion", "Source IBPE engine version is required.");
  }
  if (!input.lineage.approvedPlanId.trim()) {
    addIssue(issues, "error", "APPROVED_PLAN_ID", "lineage.approvedPlanId", "Approved plan ID is required.");
  }
  if (!Number.isInteger(input.lineage.approvedPlanRevision) || input.lineage.approvedPlanRevision < 1) {
    addIssue(issues, "error", "APPROVED_PLAN_REVISION", "lineage.approvedPlanRevision", "Approved plan revision must be a positive integer.");
  }

  const requestIds = new Set<string>();
  for (const [index, request] of (input.ctpRequests ?? []).entries()) {
    if (!request.requestId.trim()) {
      addIssue(issues, "error", "CTP_REQUEST_ID", `ctpRequests[${index}].requestId`, "CTP request ID must not be empty.");
    } else if (requestIds.has(request.requestId)) {
      addIssue(issues, "error", "CTP_DUPLICATE_REQUEST_ID", `ctpRequests[${index}].requestId`, `Duplicate CTP request ID ${request.requestId}.`);
    }
    requestIds.add(request.requestId);
  }
  return issues;
}

export function buildAdvancedPlanningDecisionPacket(
  input: AdvancedPlanningDecisionPacketInput,
): AdvancedPlanningDecisionPacketBuildResult {
  const issues = validatePacketInput(input);
  if (issues.some((row) => row.severity === "error")) {
    return { valid: false, issues };
  }

  const baseline = evaluateDeterministicFeasibility(input.model);
  if (!baseline.modelValid) {
    addIssue(
      issues,
      "error",
      "ADVANCED_MODEL_INVALID",
      "model",
      "Advanced planning model failed deterministic validation; no governed decision packet was emitted.",
    );
    return { valid: false, issues };
  }

  if (baseline.committedStatus === "indeterminate" || baseline.totalStatus === "indeterminate") {
    addIssue(
      issues,
      "warning",
      "BASELINE_INDETERMINATE",
      "baseline",
      "One or more feasibility conclusions remain indeterminate and must stay visible to VIBPE and management.",
    );
  }

  const ctp = (input.ctpRequests ?? []).map((request) => ({
    request: { ...request },
    result: evaluateConstrainedCapableToPromise(input.model, request),
  }));

  const packet: AdvancedPlanningDecisionPacket = {
    packetVersion: ADVANCED_PLANNING_PACKET_VERSION,
    packetId: input.packetId,
    createdAt: input.createdAt,
    lineage: {
      ...input.lineage,
      advancedModelVersion: input.model.modelVersion,
      algorithms: {
        feasibility: DETERMINISTIC_FEASIBILITY_ALGORITHM,
        capableToPromise: CONSTRAINED_CTP_ALGORITHM,
      },
    },
    governance: {
      advisoryOnly: true,
      mayCreateTransactions: false,
      humanApprovalRequiredForBusinessAction: true,
    },
    evidenceRefs: evidenceRefs(input.model),
    baseline,
    capableToPromise: ctp,
    summary: {
      committedStatus: baseline.committedStatus,
      totalStatus: baseline.totalStatus,
      bindingConstraintCount: baseline.bindingConstraints.length,
      indeterminateCount: baseline.indeterminate.length,
      ctpPromiseAvailableCount: ctp.filter((row) => row.result.status === "promise_available").length,
      ctpBlockedOrIndeterminateCount: ctp.filter((row) => row.result.status !== "promise_available").length,
    },
  };

  return { valid: true, packet, issues };
}
