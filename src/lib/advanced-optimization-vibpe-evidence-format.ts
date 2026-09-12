import type {
  AdvancedBindingConstraint,
  AdvancedObjectiveContribution,
  AdvancedOptimizationStatus,
} from "./advanced-planning-optimizer.ts";

export type AdvancedOptimizationVibpeEvidence = {
  runId: string;
  parentAdvancedPacketId: string;
  requestId: string;
  contractVersion: string;
  optimizerId: string;
  optimizerVersion: string;
  optimizerEngine: string;
  solverClass: "lp" | "milp";
  deterministic: boolean;
  accepted: boolean;
  optimizationStatus: AdvancedOptimizationStatus | "blocked";
  objectiveValue?: number;
  objectiveContributions: AdvancedObjectiveContribution[];
  bindingConstraints: AdvancedBindingConstraint[];
  diagnostics: string[];
  issues: Array<{ severity?: string; code?: string; message?: string }>;
  createdAt: string;
};

export function shouldSurfaceOptimizationEvidence(question: string) {
  const q = question.toLowerCase().trim();
  if (!q) return false;
  return /optim|solver|milp|mathemat|best plan|best option|alternative|trade.?off|binding|constraint|bottleneck|production plan|procurement plan|supplier plan|resource plan|why this plan/.test(q);
}

function statusText(status: AdvancedOptimizationVibpeEvidence["optimizationStatus"]) {
  if (status === "optimal") return "optimal under the governed mathematical model";
  if (status === "feasible") return "feasible, but not proven optimal under the governed mathematical model";
  if (status === "infeasible") return "mathematically infeasible under the governed model and evidence set";
  if (status === "indeterminate") return "indeterminate; the solver did not establish a governed feasible optimum";
  if (status === "blocked") return "blocked before a solver proposal could be accepted";
  return "solver error; no executable proposal is implied";
}

export function formatAdvancedOptimizationVibpeEvidence(evidence: AdvancedOptimizationVibpeEvidence) {
  const lines = [
    `Mathematical optimization evidence: ${statusText(evidence.optimizationStatus)}. Governed validator acceptance=${evidence.accepted ? "yes" : "no"}.`,
  ];

  if (evidence.objectiveValue !== undefined && Number.isFinite(evidence.objectiveValue)) {
    lines.push(`Governed objective value: ${evidence.objectiveValue.toFixed(4)}.`);
  }

  const contributions = evidence.objectiveContributions
    .filter((row) => Number.isFinite(row.weightedValue) && Math.abs(row.weightedValue) > 1e-9)
    .sort((a, b) => Math.abs(b.weightedValue) - Math.abs(a.weightedValue))
    .slice(0, 5);
  if (contributions.length) {
    lines.push(
      `Objective contributions: ${contributions.map((row) => `${row.objective}=${row.weightedValue.toFixed(2)} (raw ${row.rawValue.toFixed(2)} × weight ${row.weight})`).join("; ")}.`,
    );
  }

  if (evidence.bindingConstraints.length) {
    lines.push(
      `Solver binding constraints: ${evidence.bindingConstraints.slice(0, 5).map((row) => `${row.code}:${row.entityId}${row.period ? ` M${row.period}` : ""}${row.slack !== undefined ? ` slack=${row.slack.toFixed(4)}` : ""}`).join("; ")}.`,
    );
  } else {
    lines.push("Solver binding constraints: none were retained in this persisted optimization result.");
  }

  const issueSummary = evidence.issues
    .filter((row) => row.code || row.message)
    .slice(0, 3)
    .map((row) => `${row.code ?? row.severity ?? "issue"}: ${row.message ?? "no detail"}`);
  if (issueSummary.length) lines.push(`Optimization validation issues: ${issueSummary.join("; ")}.`);

  lines.push(
    `Optimizer provenance: ${evidence.optimizerEngine} · ${evidence.optimizerId} ${evidence.optimizerVersion} · ${evidence.solverClass.toUpperCase()} · deterministic=${evidence.deterministic ? "yes" : "no"} · request ${evidence.requestId} · run ${evidence.runId}.`,
  );
  lines.push(
    "Governance: advisory optimization evidence only. It cannot create transactions, does not replace the deterministic feasibility baseline, and any business action still requires approval in the owning workspace.",
  );
  return lines.join("\n\n");
}
