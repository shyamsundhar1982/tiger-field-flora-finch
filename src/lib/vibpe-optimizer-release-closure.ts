import { createServerFn } from "@tanstack/react-start";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql, type Sql } from "./db.ts";
import { readOptimizerProductionReadiness, type OptimizerProductionReadiness } from "./optimizer-production-readiness.ts";

type LatestPacketRow = {
  id: string;
  parent_ibpe_run_id: string;
  created_at: string;
};

type LatestOptimizationRunRow = {
  id: string;
  parent_advanced_packet_id: string;
  request_id: string;
  accepted: boolean;
  optimization_status: string;
  cash_guardrail_status: string | null;
  governance_json: Record<string, unknown> | null;
  created_by: string;
  created_role: string;
  created_at: string;
};

type AuditRow = {
  id: string;
  actor_user_id: string;
  actor_role: string;
  created_at: string;
};

export type OptimizerReleaseGate = {
  id: string;
  label: string;
  pass: boolean;
  evidence: string;
};

export type VibpeOptimizerReleaseClosure = {
  verdict: "GREEN" | "NOT GREEN";
  readiness: OptimizerProductionReadiness;
  packet: LatestPacketRow | null;
  run: LatestOptimizationRunRow | null;
  audit: AuditRow | null;
  gates: OptimizerReleaseGate[];
};

function governanceFlag(value: Record<string, unknown> | null, key: string) {
  return value?.[key];
}

export async function readVibpeOptimizerReleaseClosure(sql: Sql): Promise<VibpeOptimizerReleaseClosure> {
  const readiness = await readOptimizerProductionReadiness(sql);

  const packetRows = await sql.query<LatestPacketRow>(
    `select id,parent_ibpe_run_id,created_at::text
       from vyndi_advanced_planning_packets
      where status='complete'
      order by created_at desc
      limit 1`,
  ).catch(() => []);
  const packet = packetRows[0] ?? null;

  const runRows = packet
    ? await sql.query<LatestOptimizationRunRow>(
        `select id,parent_advanced_packet_id,request_id,accepted,optimization_status,cash_guardrail_status,
                governance_json,created_by,created_role,created_at::text
           from vyndi_advanced_optimization_runs
          where parent_advanced_packet_id=$1 and status='complete'
          order by created_at desc
          limit 1`,
        [packet.id],
      ).catch(() => [])
    : [];
  const run = runRows[0] ?? null;

  const auditRows = run
    ? await sql.query<AuditRow>(
        `select id,actor_user_id,actor_role,created_at::text
           from vyndi_audit_events
          where entity_type='advanced_optimization_run' and entity_id=$1 and action='computed'
          order by created_at desc
          limit 1`,
        [run.id],
      ).catch(() => [])
    : [];
  const audit = auditRows[0] ?? null;

  const governanceValid = Boolean(
    run
      && governanceFlag(run.governance_json, "advisoryOnly") === true
      && governanceFlag(run.governance_json, "mayCreateTransactions") === false
      && governanceFlag(run.governance_json, "humanApprovalRequiredForBusinessAction") === true,
  );
  const acceptedConsistency = Boolean(
    run
      && (!run.accepted
        || ((run.optimization_status === "optimal" || run.optimization_status === "feasible")
          && run.cash_guardrail_status === "feasible")),
  );
  const runCompleted = Boolean(run && !["error", "blocked"].includes(run.optimization_status));
  const actorAttributed = Boolean(run?.created_by?.trim() && run?.created_role?.trim());
  const auditAttributed = Boolean(audit?.actor_user_id?.trim() && audit?.actor_role?.trim());

  const gates: OptimizerReleaseGate[] = [
    {
      id: "RUNTIME",
      label: "Cloudflare production runtime",
      pass: readiness.productionReady,
      evidence: readiness.productionReady
        ? `DB reachable via ${readiness.transportSource}; migration 0071 and v2 persistence authority present.`
        : readiness.blockers.join(" ") || "Production runtime readiness is incomplete.",
    },
    {
      id: "PACKET",
      label: "Exact governed advanced packet",
      pass: Boolean(packet),
      evidence: packet ? `${packet.id} · parent IBPE ${packet.parent_ibpe_run_id}` : "No complete advanced-planning packet exists.",
    },
    {
      id: "RUN",
      label: "Persisted live optimizer execution",
      pass: runCompleted,
      evidence: run
        ? `${run.id} · math=${run.optimization_status} · cash=${run.cash_guardrail_status ?? "not-evaluated"} · accepted=${run.accepted ? "yes" : "no"}`
        : "No complete optimization run exists for the latest advanced packet.",
    },
    {
      id: "GOVERNANCE",
      label: "Advisory-only transaction boundary",
      pass: governanceValid,
      evidence: governanceValid
        ? "advisoryOnly=true; mayCreateTransactions=false; humanApprovalRequiredForBusinessAction=true."
        : "Persisted governance evidence does not prove the required advisory-only boundary.",
    },
    {
      id: "ACCEPTANCE",
      label: "Math + cash acceptance consistency",
      pass: acceptedConsistency,
      evidence: acceptedConsistency
        ? "Any accepted run is mathematically feasible/optimal and cash-feasible."
        : "Accepted state is inconsistent with mathematical or cash-governance status.",
    },
    {
      id: "ACTOR",
      label: "Attributed execution actor",
      pass: actorAttributed,
      evidence: actorAttributed ? `${run?.created_by} · ${run?.created_role}` : "Optimizer execution actor/role is missing.",
    },
    {
      id: "AUDIT",
      label: "Append-only optimizer audit evidence",
      pass: Boolean(audit) && auditAttributed,
      evidence: audit ? `${audit.id} · ${audit.actor_user_id} · ${audit.actor_role}` : "No computed audit event exists for the latest optimizer run.",
    },
  ];

  return {
    verdict: gates.every((gate) => gate.pass) ? "GREEN" : "NOT GREEN",
    readiness,
    packet,
    run,
    audit,
    gates,
  };
}

export const getVibpeOptimizerReleaseClosure = createServerFn({ method: "GET" }).handler(async () => {
  await requireBusinessActor("view");
  const sql = await getSql();
  return readVibpeOptimizerReleaseClosure(sql);
});
