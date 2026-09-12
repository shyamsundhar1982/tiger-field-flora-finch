import { createServerFn } from "@tanstack/react-start";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql } from "./db.ts";
import type { IntegratedPlanningResult } from "./integrated-business-planning-engine.ts";
import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import type { AdvancedPlanningSourceLineage } from "./advanced-planning-decision-packet.ts";
import type { AdvancedPlanningAuthorityAssessment } from "./advanced-planning-ibpe-bridge.ts";
import { prepareFrozenAdvancedOptimizerEnvelope } from "./advanced-optimizer-preparation.ts";

type FrozenAdvancedPacketRow = {
  id: string;
  parent_ibpe_run_id: string;
  packet_version: string;
  advanced_model_version: string;
  source_sha: string;
  source_input_hash: string;
  source_snapshot_at: string;
  packet_json: unknown;
  model_json: unknown;
  authority_json: unknown;
};

type ParentIbpeRunRow = {
  id: string;
  engine_version: string;
  source_sha: string;
  input_hash: string;
  approved_plan_id: string;
  approved_plan_revision: number | string;
  snapshot_at: string;
  result_json: IntegratedPlanningResult;
};

type PersistedPacketLineage = AdvancedPlanningSourceLineage & {
  advancedModelVersion: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readPacketLineage(value: unknown): PersistedPacketLineage | null {
  if (!isRecord(value) || !isRecord(value.lineage)) return null;
  const lineage = value.lineage;
  const sourceSnapshotId = readString(lineage, "sourceSnapshotId");
  const sourceSnapshotAt = readString(lineage, "sourceSnapshotAt");
  const sourceSha = readString(lineage, "sourceSha");
  const sourceInputHash = readString(lineage, "sourceInputHash");
  const sourceEngineVersion = readString(lineage, "sourceEngineVersion");
  const approvedPlanId = readString(lineage, "approvedPlanId");
  const advancedModelVersion = readString(lineage, "advancedModelVersion");
  const approvedPlanRevision = lineage.approvedPlanRevision;
  if (
    !sourceSnapshotId ||
    !sourceSnapshotAt ||
    !sourceSha ||
    !sourceInputHash ||
    !sourceEngineVersion ||
    !approvedPlanId ||
    !advancedModelVersion ||
    !Number.isInteger(approvedPlanRevision)
  ) {
    return null;
  }
  return {
    sourceSnapshotId,
    sourceSnapshotAt,
    sourceSha,
    sourceInputHash,
    sourceEngineVersion,
    approvedPlanId,
    approvedPlanRevision: Number(approvedPlanRevision),
    advancedModelVersion,
  };
}

function isFrozenModel(value: unknown): value is AdvancedPlanningConstraintModel {
  if (!isRecord(value)) return false;
  return (
    typeof value.modelVersion === "string" &&
    Number.isInteger(value.horizonPeriods) &&
    Array.isArray(value.demands) &&
    Array.isArray(value.bom) &&
    Array.isArray(value.materials) &&
    Array.isArray(value.committedReceipts) &&
    Array.isArray(value.resources) &&
    Array.isArray(value.routingOperations) &&
    Array.isArray(value.supplierLanes) &&
    isRecord(value.objectiveWeights)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((row) => typeof row === "string");
}

function isFrozenAuthority(value: unknown): value is AdvancedPlanningAuthorityAssessment {
  if (!isRecord(value)) return false;
  return (
    value.sourceTruth === "persisted-governed-ibpe-input" &&
    (value.capacityAuthority === "approved-frozen-evidence" || value.capacityAuthority === "not-approved") &&
    isStringArray(value.capacitySourceRefs) &&
    (value.routingMode === "capacity-standard-derived" || value.routingMode === "persisted-approved") &&
    (value.routingAuthority === "provisional" ||
      value.routingAuthority === "approved-capacity-standards" ||
      value.routingAuthority === "approved-persisted") &&
    (value.persistedRoutingRevisionIds === undefined || isStringArray(value.persistedRoutingRevisionIds)) &&
    (value.supplierLaneAuthority === "not-compiled" || value.supplierLaneAuthority === "approved-persisted") &&
    (value.persistedSupplierLaneRevisionIds === undefined || isStringArray(value.persistedSupplierLaneRevisionIds)) &&
    value.firmCtpEligible === false &&
    value.optimisationEligible === false &&
    isStringArray(value.limitations)
  );
}

function sameTimestamp(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function assertExactLineage(
  packet: FrozenAdvancedPacketRow,
  lineage: PersistedPacketLineage,
  parent: ParentIbpeRunRow,
  model: AdvancedPlanningConstraintModel,
) {
  if (lineage.sourceSnapshotId !== packet.parent_ibpe_run_id || lineage.sourceSnapshotId !== parent.id) {
    throw new Error("Optimizer preparation blocked: advanced packet parent IBPE lineage does not match the exact persisted parent run.");
  }
  if (packet.source_sha !== parent.source_sha || lineage.sourceSha !== parent.source_sha) {
    throw new Error("Optimizer preparation blocked: source SHA differs between advanced packet and exact parent IBPE run.");
  }
  if (packet.source_input_hash !== parent.input_hash || lineage.sourceInputHash !== parent.input_hash) {
    throw new Error("Optimizer preparation blocked: source input hash differs between advanced packet and exact parent IBPE run.");
  }
  if (!sameTimestamp(packet.source_snapshot_at, parent.snapshot_at) || !sameTimestamp(lineage.sourceSnapshotAt, parent.snapshot_at)) {
    throw new Error("Optimizer preparation blocked: snapshot timestamp differs between advanced packet and exact parent IBPE run.");
  }
  if (lineage.sourceEngineVersion !== parent.engine_version) {
    throw new Error("Optimizer preparation blocked: source IBPE engine version differs from the exact parent run.");
  }
  if (lineage.approvedPlanId !== parent.approved_plan_id || lineage.approvedPlanRevision !== Number(parent.approved_plan_revision)) {
    throw new Error("Optimizer preparation blocked: approved-plan lineage differs from the exact parent IBPE run.");
  }
  if (packet.advanced_model_version !== lineage.advancedModelVersion || model.modelVersion !== lineage.advancedModelVersion) {
    throw new Error("Optimizer preparation blocked: frozen model version differs from advanced packet lineage.");
  }
}

export const prepareAdvancedOptimizerFromPacket = createServerFn({ method: "POST" })
  .validator((input: { packetId: string }) => ({ packetId: String(input.packetId ?? "").trim().slice(0, 240) }))
  .handler(async ({ data }) => {
    await requireBusinessActor("view");
    if (!data.packetId) throw new Error("Optimizer preparation requires an exact advanced packet ID.");

    const sql = await getSql();
    const packetRows = await sql.query<FrozenAdvancedPacketRow>(
      `select id,parent_ibpe_run_id,packet_version,advanced_model_version,source_sha,source_input_hash,
              source_snapshot_at::text,packet_json,model_json,authority_json
         from vyndi_advanced_planning_packets
        where id=$1 and status='complete'
        limit 1`,
      [data.packetId],
    );
    const packet = packetRows[0];
    if (!packet) throw new Error("Optimizer preparation blocked: exact complete advanced packet was not found.");
    if (!isFrozenModel(packet.model_json)) {
      throw new Error(
        "Optimizer preparation blocked: advanced packet lacks valid frozen model evidence. Create a new governed advanced packet from an exact IBPE snapshot.",
      );
    }
    if (!isFrozenAuthority(packet.authority_json)) {
      throw new Error(
        "Optimizer preparation blocked: advanced packet lacks frozen capacity/routing/supplier authority evidence. Create a new governed advanced packet.",
      );
    }
    const lineage = readPacketLineage(packet.packet_json);
    if (!lineage) throw new Error("Optimizer preparation blocked: advanced packet lineage is incomplete or malformed.");
    if (!isRecord(packet.packet_json) || readString(packet.packet_json, "packetId") !== packet.id) {
      throw new Error("Optimizer preparation blocked: persisted packet ID differs from packet evidence.");
    }

    const parentRows = await sql.query<ParentIbpeRunRow>(
      `select id,engine_version,source_sha,input_hash,approved_plan_id,approved_plan_revision,
              snapshot_at::text,result_json
         from vyndi_ibpe_runs
        where id=$1 and status='complete'
        limit 1`,
      [packet.parent_ibpe_run_id],
    );
    const parent = parentRows[0];
    if (!parent) throw new Error("Optimizer preparation blocked: exact parent governed IBPE run is missing or invalidated.");

    assertExactLineage(packet, lineage, parent, packet.model_json);

    const prepared = prepareFrozenAdvancedOptimizerEnvelope({
      lineage: {
        sourceSnapshotId: lineage.sourceSnapshotId,
        sourceSnapshotAt: lineage.sourceSnapshotAt,
        sourceSha: lineage.sourceSha,
        sourceInputHash: lineage.sourceInputHash,
        sourceEngineVersion: lineage.sourceEngineVersion,
        approvedPlanId: lineage.approvedPlanId,
        approvedPlanRevision: lineage.approvedPlanRevision,
      },
      result: parent.result_json,
      model: packet.model_json,
      authority: packet.authority_json,
      packetId: packet.id,
    });

    return {
      parentIbpeRunId: parent.id,
      packetVersion: packet.packet_version,
      advancedModelVersion: packet.advanced_model_version,
      ...prepared,
    };
  });
