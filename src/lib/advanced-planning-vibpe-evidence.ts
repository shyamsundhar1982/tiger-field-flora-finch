import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "./command-access.ts";
import { canPerform } from "./page-access.ts";
import { getSql, type Sql } from "./db.ts";
import type { AdvancedPlanningDecisionPacket } from "./advanced-planning-decision-packet.ts";
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
      return {
        handled: true as const,
        packetId: evidence.packetId,
        text: formatAdvancedPlanningVibpeEvidence(evidence),
      };
    } catch {
      // The advanced packet is supplementary advisory evidence. A migration or
      // deployment lag must never take down the existing governed VIBPE path.
      return { handled: false as const, packetId: null, text: "" };
    }
  });
