import { createServerFn } from "@tanstack/react-start";
import highsWasm from "../generated/highs.wasm";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql } from "./db.ts";
import { loadPreparedAdvancedOptimizerEnvelope } from "./advanced-optimizer-authority.ts";
import { createPrecompiledHighsOptimizer } from "./advanced-planning-highs-runtime.ts";
import { runGovernedAdvancedOptimizer } from "./advanced-planning-optimizer.ts";
import { applyCashGovernanceToOptimizationRun } from "./advanced-planning-cash-governance.ts";

export type RunAdvancedOptimizerFromPacketInput = {
  packetId: string;
  requestId: string;
  maxRuntimeMs?: number;
  mipGap?: number;
};

function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export const runAdvancedOptimizerFromPacket = createServerFn({ method: "POST" })
  .validator((input: RunAdvancedOptimizerFromPacketInput) => ({
    packetId: String(input.packetId ?? "").trim().slice(0, 240),
    requestId: String(input.requestId ?? "").trim().slice(0, 240),
    maxRuntimeMs: normalizeOptionalNumber(input.maxRuntimeMs),
    mipGap: normalizeOptionalNumber(input.mipGap),
  }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    if (!data.packetId) throw new Error("Governed optimization requires an exact advanced packet ID.");
    if (!data.requestId) throw new Error("Governed optimization requires a request ID.");

    const prepared = await loadPreparedAdvancedOptimizerEnvelope(data.packetId);
    if (!prepared.readyForGovernedOptimization) {
      const reasons = prepared.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join(" ");
      throw new Error(`Governed optimization blocked by preparation gate.${reasons ? ` ${reasons}` : ""}`);
    }

    const optimizer = await createPrecompiledHighsOptimizer(highsWasm);
    const request = {
      requestId: data.requestId,
      ...(data.maxRuntimeMs === undefined ? {} : { maxRuntimeMs: data.maxRuntimeMs }),
      ...(data.mipGap === undefined ? {} : { mipGap: data.mipGap }),
    };
    const mathematicalRun = await runGovernedAdvancedOptimizer(prepared.model, optimizer, request);
    const governedRun = applyCashGovernanceToOptimizationRun(
      mathematicalRun,
      prepared.model,
      prepared.cashGuardrails,
    );

    const optimizationStatus = governedRun.result?.status ?? "error";
    const runId = `OPT-${crypto.randomUUID()}`;
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `select persist_vyndi_advanced_optimization_run_v2(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         $13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19::jsonb,$20,$21
       ) as id`,
      [
        runId,
        prepared.packetId,
        governedRun.requestId,
        governedRun.contractVersion,
        governedRun.optimizer.id,
        governedRun.optimizer.version,
        governedRun.optimizer.engine,
        governedRun.optimizer.solverClass,
        governedRun.optimizer.deterministic,
        governedRun.accepted,
        optimizationStatus,
        governedRun.result?.objectiveValue ?? null,
        JSON.stringify({
          ...request,
          packetId: prepared.packetId,
          preparationVersion: prepared.version,
          lineage: prepared.lineage,
          evidence: prepared.evidence,
        }),
        JSON.stringify(governedRun.governance),
        JSON.stringify(governedRun.baseline),
        governedRun.result ? JSON.stringify(governedRun.result) : null,
        JSON.stringify(governedRun.issues),
        governedRun.cashGovernance.status,
        JSON.stringify(governedRun.cashGovernance),
        actor.userId,
        actor.role,
      ],
    );

    return {
      optimizationRunId: rows[0]?.id ?? runId,
      parentIbpeRunId: prepared.parentIbpeRunId,
      packetId: prepared.packetId,
      preparationVersion: prepared.version,
      readyForGovernedOptimization: prepared.readyForGovernedOptimization,
      ...governedRun,
    };
  });
