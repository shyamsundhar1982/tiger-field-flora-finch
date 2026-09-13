import { createServerFn } from "@tanstack/react-start";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql } from "./db.ts";
import { loadPreparedAdvancedOptimizerEnvelope } from "./advanced-optimizer-authority.ts";

type LatestPacketRow = {
  id: string;
  parent_ibpe_run_id: string;
  packet_version: string;
  advanced_model_version: string;
  created_at: string;
};

type LatestRunRow = {
  id: string;
  request_id: string;
  accepted: boolean;
  optimization_status: string;
  cash_guardrail_status: string | null;
  cash_planning_disposition: string | null;
  minimum_additional_funding_lakh: string | number | null;
  funding_required_by_period: string | number | null;
  baseline_reserve_funding_need_lakh: string | number | null;
  objective_value: string | number | null;
  created_at: string;
};

export type AdvancedOptimizerControlState = {
  packet: LatestPacketRow | null;
  readyForGovernedOptimization: boolean;
  issues: Array<{ severity: string; code: string; message: string }>;
  recentRun: LatestRunRow | null;
};

export const getAdvancedOptimizerControlState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdvancedOptimizerControlState> => {
    await requireBusinessActor("view");
    const sql = await getSql();
    const packets = await sql.query<LatestPacketRow>(
      `select id,parent_ibpe_run_id,packet_version,advanced_model_version,created_at::text
         from vyndi_advanced_planning_packets
        where status='complete'
        order by created_at desc
        limit 1`,
    );
    const packet = packets[0] ?? null;
    if (!packet) {
      return {
        packet: null,
        readyForGovernedOptimization: false,
        issues: [
          {
            severity: "error",
            code: "NO_ADVANCED_PACKET",
            message: "No complete governed advanced-planning packet is available yet.",
          },
        ],
        recentRun: null,
      };
    }

    const recentRuns = await sql.query<LatestRunRow>(
      `select id,request_id,accepted,optimization_status,cash_guardrail_status,
              cash_guardrail_json->>'planningDisposition' as cash_planning_disposition,
              cash_guardrail_json#>>'{fundingRequirement,minimumAdditionalFundingLakh}' as minimum_additional_funding_lakh,
              cash_guardrail_json#>>'{fundingRequirement,requiredByPeriod}' as funding_required_by_period,
              cash_guardrail_json#>>'{fundingRequirement,baselineReserveFundingNeedLakh}' as baseline_reserve_funding_need_lakh,
              objective_value,created_at::text
         from vyndi_advanced_optimization_runs
        where parent_advanced_packet_id=$1 and status='complete'
        order by created_at desc
        limit 1`,
      [packet.id],
    );

    try {
      const prepared = await loadPreparedAdvancedOptimizerEnvelope(packet.id);
      return {
        packet,
        readyForGovernedOptimization: prepared.readyForGovernedOptimization,
        issues: prepared.issues.map((issue) => ({
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
        })),
        recentRun: recentRuns[0] ?? null,
      };
    } catch (error) {
      return {
        packet,
        readyForGovernedOptimization: false,
        issues: [
          {
            severity: "error",
            code: "PREPARATION_FAILED",
            message: error instanceof Error ? error.message : "Governed optimizer preparation failed.",
          },
        ],
        recentRun: recentRuns[0] ?? null,
      };
    }
  },
);
