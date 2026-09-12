import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "./command-access.ts";
import { canPerform } from "./page-access.ts";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql, type JsonValue, type SqlRow } from "./db.ts";
import type { RuntimeIbpeInput } from "./ibpe-runtime-parity.ts";
import { ADVANCED_PLANNING_MODEL_VERSION } from "./advanced-planning-constraints.ts";
import { ADVANCED_PLANNING_PACKET_VERSION } from "./advanced-planning-decision-packet.ts";
import { buildAdvancedPlanningFromGovernedIbpe } from "./advanced-planning-ibpe-bridge.ts";

export type PersistedAdvancedPlanningPacket = {
  id: string;
  parentIbpeRunId: string;
  packetVersion: string;
  advancedModelVersion: string;
  sourceSha: string;
  sourceInputHash: string;
  sourceSnapshotAt: string;
  packet: JsonValue;
  authority: JsonValue;
  adapterNotices: JsonValue;
  status: "complete" | "invalidated";
  createdAt: string;
};

type IbpeSourceRow = {
  id: string;
  engine_version: string;
  source_sha: string;
  input_hash: string;
  approved_plan_id: string;
  approved_plan_revision: number | string;
  snapshot_at: string;
  status: "complete" | "invalidated";
  input_json: RuntimeIbpeInput;
};

type CapacityStandardRow = {
  work_centre_id: string;
  work_centre_name: string;
  traveller_operation: string;
  sequence: number | string;
  available_hours_per_month: number | string;
  efficiency: number | string;
  standard_hours_per_unit: number | string;
  planning_status: string;
  source_ref: string;
};

function mapPacket(row: SqlRow): PersistedAdvancedPlanningPacket {
  return {
    id: String(row.id),
    parentIbpeRunId: String(row.parent_ibpe_run_id),
    packetVersion: String(row.packet_version),
    advancedModelVersion: String(row.advanced_model_version),
    sourceSha: String(row.source_sha),
    sourceInputHash: String(row.source_input_hash),
    sourceSnapshotAt: String(row.source_snapshot_at),
    packet: row.packet_json ?? {},
    authority: row.authority_json ?? {},
    adapterNotices: row.adapter_notices_json ?? [],
    status: row.status as PersistedAdvancedPlanningPacket["status"],
    createdAt: String(row.created_at),
  };
}

export const runAdvancedPlanningFromLatestIbpe = createServerFn({ method: "POST" }).handler(async () => {
  const actor = await requireBusinessActor("view");
  const sql = await getSql();

  const sourceRows = await sql.query<IbpeSourceRow>(
    `select id,engine_version,source_sha,input_hash,approved_plan_id,approved_plan_revision,
            snapshot_at::text,status,input_json
       from vyndi_ibpe_runs
      where status='complete'
      order by created_at desc
      limit 1`,
  );
  const source = sourceRows[0];
  if (!source) throw new Error("Advanced planning blocked: no complete governed IBPE run exists.");

  const capacityRows = await sql.query<CapacityStandardRow>(
    `select work_centre_id,work_centre_name,traveller_operation,sequence,
            available_hours_per_month,efficiency,standard_hours_per_unit,planning_status,source_ref
       from vyndi_capacity_standards
      where planning_status<>'retired'
      order by sequence,work_centre_id`,
  );

  const createdAt = new Date().toISOString();
  const packetId = `ADV-${source.id}-${ADVANCED_PLANNING_PACKET_VERSION}-${ADVANCED_PLANNING_MODEL_VERSION}`;
  const built = buildAdvancedPlanningFromGovernedIbpe({
    packetId,
    createdAt,
    lineage: {
      sourceSnapshotId: source.id,
      sourceSnapshotAt: source.snapshot_at,
      sourceSha: source.source_sha,
      sourceInputHash: source.input_hash,
      sourceEngineVersion: source.engine_version,
      approvedPlanId: source.approved_plan_id,
      approvedPlanRevision: Number(source.approved_plan_revision),
    },
    input: source.input_json,
    capacityStandards: capacityRows.map((row) => ({
      workCentreId: row.work_centre_id,
      workCentreName: row.work_centre_name,
      travellerOperation: row.traveller_operation,
      sequence: Number(row.sequence),
      availableHoursPerPeriod: Number(row.available_hours_per_month),
      efficiency: Number(row.efficiency),
      standardHoursPerUnit: Number(row.standard_hours_per_unit),
      sourceRef: `${row.source_ref}:${row.work_centre_id}`,
      planningStatus: row.planning_status,
    })),
  });

  if (!built.packetBuild.valid || !built.packetBuild.packet) {
    const detail = built.packetBuild.issues.map((row) => `${row.code}: ${row.message}`).join(" · ");
    throw new Error(`Advanced planning packet blocked: ${detail || "packet validation failed"}.`);
  }

  const packet = built.packetBuild.packet;
  const rows = await sql.query<{ id: string }>(
    `select persist_vyndi_advanced_planning_packet(
       $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12
     ) as id`,
    [
      packet.packetId,
      source.id,
      packet.packetVersion,
      packet.lineage.advancedModelVersion,
      source.source_sha,
      source.input_hash,
      source.snapshot_at,
      JSON.stringify(packet),
      JSON.stringify(built.authority),
      JSON.stringify(built.adapterNotices),
      actor.userId,
      actor.role,
    ],
  );

  return {
    id: rows[0]?.id ?? packet.packetId,
    parentIbpeRunId: source.id,
    packet,
    authority: built.authority,
    adapterNotices: built.adapterNotices,
    packetIssues: built.packetBuild.issues,
  };
});

export const getLatestAdvancedPlanningPacket = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Advanced planning view permission denied.");
  const sql = await getSql();
  const rows = await sql.query<SqlRow>(
    `select id,parent_ibpe_run_id,packet_version,advanced_model_version,source_sha,source_input_hash,
            source_snapshot_at::text,packet_json,authority_json,adapter_notices_json,status,created_at::text
       from vyndi_advanced_planning_packets
      where status='complete'
      order by created_at desc
      limit 1`,
  );
  return rows[0] ? mapPacket(rows[0]) : null;
});
