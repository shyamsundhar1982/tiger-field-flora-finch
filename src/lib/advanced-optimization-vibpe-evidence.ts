import type { Sql } from "./db.ts";
import type {
  AdvancedBindingConstraint,
  AdvancedObjectiveContribution,
  AdvancedOptimizationStatus,
} from "./advanced-planning-optimizer.ts";
import {
  formatAdvancedOptimizationVibpeEvidence,
  shouldSurfaceOptimizationEvidence,
  type AdvancedOptimizationVibpeEvidence,
} from "./advanced-optimization-vibpe-evidence-format.ts";

export {
  formatAdvancedOptimizationVibpeEvidence,
  shouldSurfaceOptimizationEvidence,
  type AdvancedOptimizationVibpeEvidence,
} from "./advanced-optimization-vibpe-evidence-format.ts";

type OptimizationRunRow = {
  id: string;
  parent_advanced_packet_id: string;
  request_id: string;
  contract_version: string;
  optimizer_id: string;
  optimizer_version: string;
  optimizer_engine: string;
  solver_class: "lp" | "milp";
  deterministic: boolean;
  accepted: boolean;
  optimization_status: AdvancedOptimizationStatus | "blocked";
  objective_value: number | string | null;
  governance_json: {
    advisoryOnly?: boolean;
    mayCreateTransactions?: boolean;
    humanApprovalRequiredForBusinessAction?: boolean;
  };
  result_json: {
    status?: AdvancedOptimizationStatus;
    objectiveValue?: number;
    objectiveContributions?: AdvancedObjectiveContribution[];
    bindingConstraints?: AdvancedBindingConstraint[];
    diagnostics?: string[];
  } | null;
  issues_json: Array<{ severity?: string; code?: string; message?: string }>;
  created_at: string;
};

function validStatus(value: unknown): value is AdvancedOptimizationStatus | "blocked" {
  return value === "optimal" || value === "feasible" || value === "infeasible" || value === "indeterminate" || value === "error" || value === "blocked";
}

export async function readAdvancedOptimizationVibpeEvidence(
  sql: Sql,
  parentAdvancedPacketId: string,
): Promise<AdvancedOptimizationVibpeEvidence | null> {
  const rows = await sql.query<OptimizationRunRow>(
    `select id,parent_advanced_packet_id,request_id,contract_version,optimizer_id,optimizer_version,
            optimizer_engine,solver_class,deterministic,accepted,optimization_status,objective_value,
            governance_json,result_json,issues_json,created_at::text
       from vyndi_advanced_optimization_runs
      where status='complete' and parent_advanced_packet_id=$1
      order by created_at desc
      limit 1`,
    [parentAdvancedPacketId],
  );
  const row = rows[0];
  if (!row || !validStatus(row.optimization_status)) return null;
  if (
    row.governance_json?.advisoryOnly !== true ||
    row.governance_json?.mayCreateTransactions !== false ||
    row.governance_json?.humanApprovalRequiredForBusinessAction !== true
  ) {
    return null;
  }
  if (row.accepted && row.optimization_status !== "optimal" && row.optimization_status !== "feasible") return null;
  if (row.result_json?.status && row.result_json.status !== row.optimization_status) return null;

  const objectiveValue = row.objective_value === null ? undefined : Number(row.objective_value);
  if (objectiveValue !== undefined && !Number.isFinite(objectiveValue)) return null;

  return {
    runId: row.id,
    parentAdvancedPacketId: row.parent_advanced_packet_id,
    requestId: row.request_id,
    contractVersion: row.contract_version,
    optimizerId: row.optimizer_id,
    optimizerVersion: row.optimizer_version,
    optimizerEngine: row.optimizer_engine,
    solverClass: row.solver_class,
    deterministic: row.deterministic,
    accepted: row.accepted,
    optimizationStatus: row.optimization_status,
    objectiveValue,
    objectiveContributions: Array.isArray(row.result_json?.objectiveContributions) ? row.result_json.objectiveContributions : [],
    bindingConstraints: Array.isArray(row.result_json?.bindingConstraints) ? row.result_json.bindingConstraints : [],
    diagnostics: Array.isArray(row.result_json?.diagnostics) ? row.result_json.diagnostics : [],
    issues: Array.isArray(row.issues_json) ? row.issues_json : [],
    createdAt: row.created_at,
  };
}
