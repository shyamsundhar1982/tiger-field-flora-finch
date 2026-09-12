import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "./command-access.ts";
import { canPerform } from "./page-access.ts";
import { getSql, type Sql } from "./db.ts";
import type { AdvancedPlanningDecisionPacket } from "./advanced-planning-decision-packet.ts";
import type { FeasibilityStatus } from "./deterministic-feasibility.ts";
import {
  formatAdvancedPlanningVibpeEvidence,
  shouldSurfaceAdvancedPlanningEvidence,
  type AdvancedPlanningVibpeAuthority,
  type AdvancedPlanningVibpeEvidence,
} from "./advanced-planning-vibpe-evidence-format.ts";
import {
  formatAdvancedOptimizationVibpeEvidence,
  readAdvancedOptimizationVibpeEvidence,
  shouldSurfaceOptimizationEvidence,
} from "./advanced-optimization-vibpe-evidence.ts";

export {
  formatAdvancedPlanningVibpeEvidence,
  shouldSurfaceAdvancedPlanningEvidence,
  type AdvancedPlanningVibpeAuthority,
  type AdvancedPlanningVibpeEvidence,
} from "./advanced-planning-vibpe-evidence-format.ts";

type AdvancedPlanningPacketRow = {
  id: string;
  parent_ibpe_run_id: string;
  packet_version: string;
  advanced_model_version: string;
  source_sha: string;
  source_input_hash: string;
  packet_json: AdvancedPlanningDecisionPacket;
  authority_json: AdvancedPlanningVibpeAuthority;
  adapter_notices_json: Array<{ code?: string; message?: string }>;
  created_at: string;
};

function feasibilityStatus(value: unknown): value is FeasibilityStatus {
  return value === "feasible" || value === "infeasible" || value === "indeterminate";
}

export async function readAdvancedPlanningVibpeEvidence(
  sql: Sql,
  parentIbpeRunId: string,
): Promise<AdvancedPlanningVibpeEvidence | null> {
  const rows = await sql.query<AdvancedPlanningPacketRow>(
    `select id,parent_ibpe_run_id,packet_version,advanced_model_version,source_sha,source_input_hash,
            packet_json,authority_json,adapter_notices_json,created_at::text
       from vyndi_advanced_planning_packets
      where status='complete' and parent_ibpe_run_id=$1
      order by created_at desc
      limit 1`,
    [parentIbpeRunId],
  );
  const row = rows[0];
  if (!row) return null;

  const packet = row.packet_json;
  if (
    !packet ||
    packet.packetId !== row.id ||
    packet.lineage?.sourceSnapshotId !== parentIbpeRunId ||
    packet.lineage?.sourceInputHash !== row.source_input_hash ||
    packet.lineage?.sourceSha !== row.source_sha ||
    packet.governance?.advisoryOnly !== true ||
    packet.governance?.mayCreateTransactions !== false ||
    !feasibilityStatus(packet.summary?.committedStatus) ||
    !feasibilityStatus(packet.summary?.totalStatus)
  ) {
    return null;
  }

  return {
    packetId: packet.packetId,
    parentIbpeRunId: row.parent_ibpe_run_id,
    packetVersion: row.packet_version,
    advancedModelVersion: row.advanced_model_version,
    createdAt: row.created_at,
    committedStatus: packet.summary.committedStatus,
    totalStatus: packet.summary.totalStatus,
    bindingConstraints: packet.baseline.bindingConstraints.slice(0, 6),
    indeterminateCount: packet.summary.indeterminateCount,
    ctpPromiseAvailableCount: packet.summary.ctpPromiseAvailableCount,
    ctpBlockedOrIndeterminateCount: packet.summary.ctpBlockedOrIndeterminateCount,
    authority: row.authority_json ?? {},
    adapterNotices: Array.isArray(row.adapter_notices_json) ? row.adapter_notices_json : [],
    sourceInputHash: row.source_input_hash,
    sourceSha: row.source_sha,
  };
}

export const getAdvancedPlanningVibpeEvidence = createServerFn({ method: "POST" })
  .validator((input: { parentIbpeRunId: string; question: string }) => ({
    parentIbpeRunId: String(input.parentIbpeRunId ?? "").trim().slice(0, 240),
    question: String(input.question ?? "").trim().slice(0, 1800),
  }))
  .handler(async ({ data }) => {
    const role = await getCommandRole();
    if (!role || !canPerform(role, "view")) throw new Error("Advanced VIBPE evidence permission denied.");
    if (!data.parentIbpeRunId || !shouldSurfaceAdvancedPlanningEvidence(data.question)) {
      return { handled: false as const, packetId: null, text: "" };
    }

    try {
      const sql = await getSql();
      const evidence = await readAdvancedPlanningVibpeEvidence(sql, data.parentIbpeRunId);
      if (!evidence) return { handled: false as const, packetId: null, text: "" };

      const blocks = [formatAdvancedPlanningVibpeEvidence(evidence)];
      if (shouldSurfaceOptimizationEvidence(data.question)) {
        try {
          const optimization = await readAdvancedOptimizationVibpeEvidence(sql, evidence.packetId);
          if (optimization) blocks.push(formatAdvancedOptimizationVibpeEvidence(optimization));
        } catch {
          // Mathematical optimization is supplementary to the deterministic
          // advanced-planning baseline. Migration/runtime lag must not suppress
          // the already-governed planning evidence.
        }
      }

      return {
        handled: true as const,
        packetId: evidence.packetId,
        text: blocks.join("\n\n"),
      };
    } catch {
      // The advanced packet is supplementary advisory evidence. A migration or
      // deployment lag must never take down the existing governed VIBPE path.
      return { handled: false as const, packetId: null, text: "" };
    }
  });
