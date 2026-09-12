import type { Sql } from "./db.ts";
import { loadPreparedAdvancedOptimizerEnvelope } from "./advanced-optimizer-authority.ts";
import {
  GOVERNED_OPTIMIZER_ROUTE,
  isGovernedOptimizerExecutionRequest,
} from "./vibpe-optimizer-intent.ts";

export { GOVERNED_OPTIMIZER_ROUTE, isGovernedOptimizerExecutionRequest } from "./vibpe-optimizer-intent.ts";

type LatestPacketRow = {
  id: string;
  parent_ibpe_run_id: string;
  created_at: string;
};

export async function answerGovernedOptimizerExecutionRequest(sql: Sql, question: string) {
  if (!isGovernedOptimizerExecutionRequest(question)) return null;

  const packets = await sql.query<LatestPacketRow>(
    `select id,parent_ibpe_run_id,created_at::text
       from vyndi_advanced_planning_packets
      where status='complete'
      order by created_at desc
      limit 1`,
  );
  const packet = packets[0];
  if (!packet) {
    return [
      "Governed optimizer execution is BLOCKED — no complete immutable advanced-planning packet is available.",
      "Create/capture the governed IBPE baseline and advanced packet first. VIBPE will not fabricate solver input or execute against transient data.",
      `Execution authority remains at ${GOVERNED_OPTIMIZER_ROUTE}; chat text never starts the solver automatically.`,
    ].join("\n\n");
  }

  try {
    const prepared = await loadPreparedAdvancedOptimizerEnvelope(packet.id);
    const errors = prepared.issues.filter((issue) => issue.severity === "error");
    if (!prepared.readyForGovernedOptimization) {
      return [
        `Governed optimizer execution is BLOCKED for packet ${packet.id}.`,
        errors.length
          ? `Preparation gates: ${errors.map((issue) => `${issue.code} — ${issue.message}`).join("; ")}`
          : "The exact packet is not yet eligible for governed mathematical optimization.",
        `Review the gate evidence at ${GOVERNED_OPTIMIZER_ROUTE}. VIBPE chat cannot bypass readiness gates or start HiGHS automatically.`,
      ].join("\n\n");
    }

    return [
      `Governed optimizer is READY for exact packet ${packet.id}, parent IBPE run ${prepared.parentIbpeRunId}.`,
      "The solver is advisory only. Mathematical feasibility is independently checked against cash governance, and no purchase order, production order, inventory movement, funding action or sales commitment can be created by the solver.",
      `Open ${GOVERNED_OPTIMIZER_ROUTE} and press “Run governed HiGHS optimization” to give the required explicit human execution instruction. VIBPE chat deliberately does not execute it from a text request.`,
    ].join("\n\n");
  } catch (error) {
    return [
      `Governed optimizer execution is BLOCKED for packet ${packet.id}.`,
      error instanceof Error ? error.message : "Optimizer preparation could not be verified.",
      `Inspect the governed packet at ${GOVERNED_OPTIMIZER_ROUTE}; chat execution remains disabled.`,
    ].join("\n\n");
  }
}
