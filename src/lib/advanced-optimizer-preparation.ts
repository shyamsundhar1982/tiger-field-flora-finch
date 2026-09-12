import type { IntegratedPlanningResult } from "./integrated-business-planning-engine.ts";
import type { RuntimeIbpeInput } from "./ibpe-runtime-parity.ts";
import type {
  RoutingOperation,
  SupplierLane,
} from "./advanced-planning-constraints.ts";
import type { AdvancedPlanningSourceLineage } from "./advanced-planning-decision-packet.ts";
import {
  buildAdvancedPlanningFromGovernedIbpe,
  type AdvancedPlanningAuthorityAssessment,
  type IbpeCapacityStandardEvidence,
} from "./advanced-planning-ibpe-bridge.ts";
import {
  compileCashGuardrailsFromIbpe,
  type AdvancedCashGuardrail,
} from "./advanced-planning-cash-guardrails.ts";

export const ADVANCED_OPTIMIZER_PREPARATION_VERSION = "VYNDI-OPTIMIZER-PREPARATION-0.1" as const;

export type AdvancedOptimizerPreparationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type AdvancedOptimizerPreparationEnvelope = {
  version: typeof ADVANCED_OPTIMIZER_PREPARATION_VERSION;
  lineage: AdvancedPlanningSourceLineage;
  packetId: string;
  authority: AdvancedPlanningAuthorityAssessment;
  model: ReturnType<typeof buildAdvancedPlanningFromGovernedIbpe>["model"];
  cashGuardrails: AdvancedCashGuardrail[];
  readyForGovernedOptimization: boolean;
  issues: AdvancedOptimizerPreparationIssue[];
  evidence: {
    sourceSnapshotId: string;
    sourceInputHash: string;
    sourceSha: string;
    persistedRoutingRevisionIds: string[];
    persistedSupplierLaneRevisionIds: string[];
    cashSourceRef: string;
  };
};

export type PrepareAdvancedOptimizerInput = {
  lineage: AdvancedPlanningSourceLineage;
  input: RuntimeIbpeInput;
  result: IntegratedPlanningResult;
  capacityStandards: IbpeCapacityStandardEvidence[];
  governedRoutingOperations?: RoutingOperation[];
  persistedRoutingRevisionIds?: string[];
  supplierLanes?: SupplierLane[];
  persistedSupplierLaneRevisionIds?: string[];
  packetId: string;
  createdAt: string;
};

export function prepareAdvancedOptimizerEnvelope(
  source: PrepareAdvancedOptimizerInput,
): AdvancedOptimizerPreparationEnvelope {
  const issues: AdvancedOptimizerPreparationIssue[] = [];
  const built = buildAdvancedPlanningFromGovernedIbpe({
    lineage: source.lineage,
    input: source.input,
    capacityStandards: source.capacityStandards,
    governedRoutingOperations: source.governedRoutingOperations,
    persistedRoutingRevisionIds: source.persistedRoutingRevisionIds,
    supplierLanes: source.supplierLanes,
    persistedSupplierLaneRevisionIds: source.persistedSupplierLaneRevisionIds,
    packetId: source.packetId,
    createdAt: source.createdAt,
  });

  for (const issue of built.packetBuild.issues) {
    issues.push({ severity: issue.severity, code: `PACKET_${issue.code}`, message: issue.message });
  }
  for (const notice of built.adapterNotices) {
    if (notice.severity === "error") {
      issues.push({ severity: "error", code: `MODEL_${notice.code}`, message: notice.message });
    }
  }

  if (built.authority.routingAuthority !== "approved-persisted") {
    issues.push({
      severity: "error",
      code: "ROUTING_AUTHORITY_NOT_PERSISTED",
      message: "Governed optimization requires complete approved persisted routing authority; capacity-derived routing remains advisory only.",
    });
  }
  if (built.authority.supplierLaneAuthority !== "approved-persisted") {
    issues.push({
      severity: "error",
      code: "SUPPLIER_LANE_AUTHORITY_NOT_PERSISTED",
      message: "Governed optimization requires complete approved persisted supplier-lane authority.",
    });
  }

  const cashSourceRef = `${source.lineage.sourceSnapshotId}:${source.lineage.sourceInputHash}:CASH`;
  const cash = compileCashGuardrailsFromIbpe(source.result.cash ?? [], built.model.horizonPeriods, cashSourceRef);
  for (const issue of cash.issues) {
    issues.push({ severity: issue.severity, code: `CASH_${issue.code}`, message: issue.message });
  }

  if (!source.lineage.sourceSnapshotId.trim() || !source.lineage.sourceInputHash.trim() || !source.lineage.sourceSha.trim()) {
    issues.push({
      severity: "error",
      code: "SOURCE_LINEAGE_INCOMPLETE",
      message: "Optimizer preparation requires exact governed IBPE snapshot ID, input hash and source SHA.",
    });
  }

  const readyForGovernedOptimization =
    built.packetBuild.valid &&
    built.authority.routingAuthority === "approved-persisted" &&
    built.authority.supplierLaneAuthority === "approved-persisted" &&
    cash.valid &&
    !issues.some((issue) => issue.severity === "error");

  return {
    version: ADVANCED_OPTIMIZER_PREPARATION_VERSION,
    lineage: { ...source.lineage },
    packetId: source.packetId,
    authority: built.authority,
    model: built.model,
    cashGuardrails: cash.valid ? cash.guardrails : [],
    readyForGovernedOptimization,
    issues,
    evidence: {
      sourceSnapshotId: source.lineage.sourceSnapshotId,
      sourceInputHash: source.lineage.sourceInputHash,
      sourceSha: source.lineage.sourceSha,
      persistedRoutingRevisionIds: [...(source.persistedRoutingRevisionIds ?? [])].sort(),
      persistedSupplierLaneRevisionIds: [...(source.persistedSupplierLaneRevisionIds ?? [])].sort(),
      cashSourceRef,
    },
  };
}
