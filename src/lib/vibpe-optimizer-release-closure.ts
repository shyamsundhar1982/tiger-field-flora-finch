import { createServerFn } from "@tanstack/react-start";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql, type Sql } from "./db.ts";
import { readOptimizerProductionReadiness, type OptimizerProductionReadiness } from "./optimizer-production-readiness.ts";
import {
  hasExactReleaseLineage,
  isReleaseGovernanceReady,
  isReleaseMathAndCashReady,
} from "./vibpe-optimizer-release-policy.ts";

type LatestPacketRow = {
  id: string;
  parent_ibpe_run_id: string;
  source_sha: string;
  created_at: string;
};

type LatestIbpeRow = {
  id: string;
  source_sha: string;
  created_at: string;
};

type LatestOptimizationRunDbRow = {
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

type LatestOptimizationRunRow = Omit<LatestOptimizationRunDbRow, "governance_json">;

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

function currentDeployedSourceSha() {
  return (
    process.env.VYNDI_SOURCE_SHA
    || process.env.WORKERS_CI_COMMIT_SHA
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.CF_PAGES_COMMIT_SHA
    || process.env.GITHUB_SHA
    || ""
  ).trim();
}

export async function readVibpeOptimizerReleaseClosure(sql: Sql): Promise<VibpeOptimizerReleaseClosure> {
  const readiness = await readOptimizerProductionReadiness(sql);
  const deployedSourceSha = currentDeployedSourceSha();

  const packetRows = await sql.query<LatestPacketRow>(
    `select id,parent_ibpe_run_id,source_sha,created_at::text
       from vyndi_advanced_planning_packets
      where status='complete'
      order by created_at desc
      limit 1`,
  ).catch(() => []);
  const packet = packetRows[0] ?? null;

  const ibpeRows = packet
    ? await sql.query<LatestIbpeRow>(
        `select id,source_sha,created_at::text
           from vyndi_ibpe_runs
          where id=$1 and status='complete'
          limit 1`,
        [packet.parent_ibpe_run_id],
      ).catch(() => [])
    : [];
  const ibpe = ibpeRows[0] ?? null;

  const runRows = packet
    ? await sql.query<LatestOptimizationRunDbRow>(
        `select id,parent_advanced_packet_id,request_id,accepted,optimization_status,cash_guardrail_status,
                governance_json,created_by,created_role,created_at::text
           from vyndi_advanced_optimization_runs
          where parent_advanced_packet_id=$1 and status='complete'
          order by created_at desc
          limit 1`,
        [packet.id],
      ).catch(() => [])
    : [];
  const runDb = runRows[0] ?? null;
  const run: LatestOptimizationRunRow | null = runDb
    ? {
        id: runDb.id,
        parent_advanced_packet_id: runDb.parent_advanced_packet_id,
        request_id: runDb.request_id,
        accepted: runDb.accepted,
        optimization_status: runDb.optimization_status,
        cash_guardrail_status: runDb.cash_guardrail_status,
        created_by: runDb.created_by,
        created_role: runDb.created_role,
        created_at: runDb.created_at,
      }
    : null;

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

  const governanceValid = isReleaseGovernanceReady(runDb?.governance_json);
  const mathStatusEligible = run?.optimization_status === "optimal" || run?.optimization_status === "feasible";
  const cashStatusEligible = run?.cash_guardrail_status === "feasible";
  const mathAndCashReady = Boolean(
    run
      && mathStatusEligible
      && cashStatusEligible
      && isReleaseMathAndCashReady(run.optimization_status, run.cash_guardrail_status),
  );
  const accepted = Boolean(run?.accepted && mathAndCashReady);
  const exactLineage = hasExactReleaseLineage({
    deployedSourceSha,
    ibpeSourceSha: ibpe?.source_sha,
    packetSourceSha: packet?.source_sha,
    packetId: packet?.id,
    runParentPacketId: run?.parent_advanced_packet_id,
  });
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
      label: "Governed advanced packet and parent IBPE",
      pass: Boolean(packet && ibpe),
      evidence: packet && ibpe
        ? `${packet.id} · parent IBPE ${ibpe.id}`
        : "No complete advanced-planning packet with a complete parent IBPE run exists.",
    },
    {
      id: "SOURCE-LINEAGE",
      label: "Exact deployed source lineage",
      pass: exactLineage,
      evidence: exactLineage
        ? `deployed=${deployedSourceSha} · IBPE=${ibpe?.source_sha} · packet=${packet?.source_sha}`
        : `Source lineage mismatch or missing evidence: deployed=${deployedSourceSha || "missing"} · IBPE=${ibpe?.source_sha ?? "missing"} · packet=${packet?.source_sha ?? "missing"}.`,
    },
    {
      id: "RUN",
      label: "Mathematically and cash-feasible optimizer execution",
      pass: mathAndCashReady,
      evidence: run
        ? `${run.id} · math=${run.optimization_status} · cash=${run.cash_guardrail_status ?? "not-evaluated"}`
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
      label: "Accepted feasible governed run",
      pass: accepted,
      evidence: accepted
        ? "Run is accepted with feasible/optimal mathematics and feasible cash governance."
        : "Release remains blocked until the exact governed run is accepted and both mathematics and cash governance are feasible.",
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
