import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "./command-access.ts";
import { canPerform } from "./page-access.ts";
import { getSql } from "./db.ts";
import { runAdvancedOptimizerFromPacket } from "./advanced-optimizer-execution.ts";
import {
  formatAdvancedOptimizationVibpeEvidence,
  readAdvancedOptimizationVibpeEvidence,
} from "./advanced-optimization-vibpe-evidence.ts";

export function isExplicitAdvancedOptimizationRequest(question: string) {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return false;
  const hasOptimizeVerb = /\b(optimi[sz]e|optimization|optimizer|solve|milp|highs)\b/.test(normalized);
  const hasExecutionIntent = /\b(run|execute|calculate|compute|perform|start|now)\b/.test(normalized);
  return hasOptimizeVerb && hasExecutionIntent;
}

export const runAdvancedOptimizationVibpeAction = createServerFn({ method: "POST" })
  .validator((input: { parentIbpeRunId: string; question: string; requestId?: string }) => ({
    parentIbpeRunId: String(input.parentIbpeRunId ?? "").trim().slice(0, 240),
    question: String(input.question ?? "").trim().slice(0, 1800),
    requestId: String(input.requestId ?? "").trim().slice(0, 240),
  }))
  .handler(async ({ data }) => {
    if (!isExplicitAdvancedOptimizationRequest(data.question)) {
      return { handled: false as const, text: "", packetId: null, optimizationRunId: null };
    }

    const role = await getCommandRole();
    if (!role || !canPerform(role, "edit")) {
      throw new Error("Governed optimization requires business edit permission.");
    }
    if (!data.parentIbpeRunId) {
      throw new Error("Governed optimization requires an exact parent IBPE run.");
    }

    const sql = await getSql();
    const packetRows = await sql.query<{ id: string }>(
      `select id
         from vyndi_advanced_planning_packets
        where parent_ibpe_run_id=$1 and status='complete'
        order by created_at desc
        limit 1`,
      [data.parentIbpeRunId],
    );
    const packetId = packetRows[0]?.id;
    if (!packetId) {
      throw new Error("Governed optimization blocked: no complete advanced-planning packet exists for this IBPE run.");
    }

    const requestId = data.requestId || `VIBPE-OPT-${crypto.randomUUID()}`;
    const run = await runAdvancedOptimizerFromPacket({
      data: { packetId, requestId },
    });

    const evidence = await readAdvancedOptimizationVibpeEvidence(sql, packetId);
    const text = evidence
      ? formatAdvancedOptimizationVibpeEvidence(evidence)
      : `Governed optimization completed and persisted as ${run.optimizationRunId}.`;

    return {
      handled: true as const,
      text,
      packetId,
      optimizationRunId: run.optimizationRunId,
      accepted: run.accepted,
      cashGovernanceStatus: run.cashGovernance.status,
    };
  });
