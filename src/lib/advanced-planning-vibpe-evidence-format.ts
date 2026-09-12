import type { FeasibilityBindingConstraint, FeasibilityStatus } from "./deterministic-feasibility.ts";

export type AdvancedPlanningVibpeAuthority = {
  sourceTruth?: string;
  routingMode?: string;
  routingAuthority?: string;
  supplierLaneAuthority?: string;
  firmCtpEligible?: boolean;
  optimisationEligible?: boolean;
  limitations?: string[];
};

export type AdvancedPlanningVibpeEvidence = {
  packetId: string;
  parentIbpeRunId: string;
  packetVersion: string;
  advancedModelVersion: string;
  createdAt: string;
  committedStatus: FeasibilityStatus;
  totalStatus: FeasibilityStatus;
  bindingConstraints: FeasibilityBindingConstraint[];
  indeterminateCount: number;
  ctpPromiseAvailableCount: number;
  ctpBlockedOrIndeterminateCount: number;
  authority: AdvancedPlanningVibpeAuthority;
  adapterNotices: Array<{ code?: string; message?: string }>;
  sourceInputHash: string;
  sourceSha: string;
};

export function shouldSurfaceAdvancedPlanningEvidence(question: string) {
  const q = question.toLowerCase();
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|how are you|how r you)[!?.,\s]*$/.test(q.trim())) {
    return false;
  }
  return /executive|assessment|status|report|health|risk|issue|constraint|bottleneck|feasib|capacity|production|manufactur|material|inventory|stock|procure|purchase|supplier|commit|promise|ctp|deliver|fulfil|plan|action/.test(q);
}

function statusText(status: FeasibilityStatus) {
  if (status === "feasible") return "feasible on currently governed committed supply/capacity evidence";
  if (status === "infeasible") return "infeasible on currently governed committed supply/capacity evidence";
  return "indeterminate because one or more governed constraints are not yet resolvable";
}

export function formatAdvancedPlanningVibpeEvidence(evidence: AdvancedPlanningVibpeEvidence) {
  const lines = [
    `Advanced planning evidence (governed baseline): committed feasibility is ${statusText(evidence.committedStatus)}; total forecast feasibility is ${statusText(evidence.totalStatus)}.`,
  ];

  if (evidence.bindingConstraints.length) {
    lines.push(
      `Binding constraints: ${evidence.bindingConstraints.slice(0, 4).map((row) => `${row.entityId} M${row.period} ${row.truth} ${row.code} (${row.amount.toFixed(2)} ${row.unit})`).join("; ")}.`,
    );
  } else {
    lines.push("Binding constraints: none are proven in the current deterministic advanced-planning baseline.");
  }

  const authorityBits = [
    evidence.authority.routingAuthority ? `routing=${evidence.authority.routingAuthority}` : undefined,
    evidence.authority.supplierLaneAuthority ? `supplier lanes=${evidence.authority.supplierLaneAuthority}` : undefined,
    `firm CTP=${evidence.authority.firmCtpEligible === true ? "eligible" : "not yet eligible"}`,
    `mathematical optimisation=${evidence.authority.optimisationEligible === true ? "eligible" : "not yet eligible"}`,
  ].filter(Boolean);
  lines.push(`Authority maturity: ${authorityBits.join("; ")}.`);

  const limitations = evidence.authority.limitations?.filter(Boolean).slice(0, 2) ?? [];
  if (limitations.length) lines.push(`Advanced-planning limitations: ${limitations.join(" ")}`);
  if (evidence.indeterminateCount > 0) {
    lines.push(`Indeterminate advanced constraints: ${evidence.indeterminateCount}. These remain visible rather than being converted into assumptions.`);
  }
  if (evidence.ctpPromiseAvailableCount || evidence.ctpBlockedOrIndeterminateCount) {
    lines.push(`CTP evidence in this packet: ${evidence.ctpPromiseAvailableCount} promise-available request(s); ${evidence.ctpBlockedOrIndeterminateCount} blocked/indeterminate request(s).`);
  }

  lines.push(`Advanced lineage: ${evidence.packetId} · ${evidence.advancedModelVersion} · IBPE ${evidence.parentIbpeRunId} · input ${evidence.sourceInputHash.slice(0, 12)}. Advisory evidence only; it does not alter IBPE financial metrics or create business transactions.`);
  return lines.join("\n\n");
}
