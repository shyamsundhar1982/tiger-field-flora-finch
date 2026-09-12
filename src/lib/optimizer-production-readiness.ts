import { createServerFn } from "@tanstack/react-start";
import { requireBusinessActor } from "./business-actor.ts";
import { getSql, type Sql } from "./db.ts";
import { resolvePostgresTransport } from "./postgres-runtime.ts";

export const OPTIMIZER_MIGRATION_NAME = "0071_live_governed_optimizer_execution.sql";
export const OPTIMIZER_PERSISTENCE_FUNCTION = "persist_vyndi_advanced_optimization_run_v2";

export type OptimizerProductionReadiness = {
  databaseReachable: boolean;
  transportSource: "hyperdrive" | "database-url" | "pglite";
  hyperdriveActive: boolean;
  migration0071Applied: boolean;
  persistenceFunctionPresent: boolean;
  completeAdvancedPacketCount: number;
  optimizationRunCount: number;
  auditEventCount: number;
  productionReady: boolean;
  blockers: string[];
};

async function scalarCount(sql: Sql, query: string, params: unknown[] = []) {
  const rows = await sql.query<{ count: string | number }>(query, params);
  return Number(rows[0]?.count ?? 0);
}

export async function readOptimizerProductionReadiness(sql: Sql): Promise<OptimizerProductionReadiness> {
  const transport = await resolvePostgresTransport();
  const transportSource = transport?.source ?? "pglite";

  let databaseReachable = false;
  try {
    const probe = await sql.query<{ probe: number }>("select 1::int as probe");
    databaseReachable = probe[0]?.probe === 1;
  } catch {
    databaseReachable = false;
  }

  let migration0071Applied = false;
  try {
    const rows = await sql.query<{ present: boolean }>(
      `select exists(select 1 from _migrations where name=$1) as present`,
      [OPTIMIZER_MIGRATION_NAME],
    );
    migration0071Applied = rows[0]?.present === true;
  } catch {
    migration0071Applied = false;
  }

  let persistenceFunctionPresent = false;
  try {
    const rows = await sql.query<{ present: boolean }>(
      `select exists(select 1 from pg_proc where proname=$1) as present`,
      [OPTIMIZER_PERSISTENCE_FUNCTION],
    );
    persistenceFunctionPresent = rows[0]?.present === true;
  } catch {
    persistenceFunctionPresent = false;
  }

  let completeAdvancedPacketCount = 0;
  let optimizationRunCount = 0;
  let auditEventCount = 0;
  try {
    completeAdvancedPacketCount = await scalarCount(
      sql,
      `select count(*)::int as count from vyndi_advanced_planning_packets where status='complete'`,
    );
  } catch {
    completeAdvancedPacketCount = 0;
  }
  try {
    optimizationRunCount = await scalarCount(
      sql,
      `select count(*)::int as count from vyndi_advanced_optimization_runs where status='complete'`,
    );
  } catch {
    optimizationRunCount = 0;
  }
  try {
    auditEventCount = await scalarCount(
      sql,
      `select count(*)::int as count from vyndi_audit_events where entity_type='advanced_optimization_run' and action='computed'`,
    );
  } catch {
    auditEventCount = 0;
  }

  const hyperdriveActive = transportSource === "hyperdrive";
  const blockers: string[] = [];
  if (!databaseReachable) blockers.push("Production database probe failed.");
  if (!hyperdriveActive) blockers.push(`Expected Cloudflare Hyperdrive but active transport is ${transportSource}.`);
  if (!migration0071Applied) blockers.push(`Migration ${OPTIMIZER_MIGRATION_NAME} is not recorded as applied.`);
  if (!persistenceFunctionPresent) blockers.push(`Persistence function ${OPTIMIZER_PERSISTENCE_FUNCTION} is missing.`);

  return {
    databaseReachable,
    transportSource,
    hyperdriveActive,
    migration0071Applied,
    persistenceFunctionPresent,
    completeAdvancedPacketCount,
    optimizationRunCount,
    auditEventCount,
    productionReady: blockers.length === 0,
    blockers,
  };
}

export const getOptimizerProductionReadiness = createServerFn({ method: "GET" }).handler(async () => {
  await requireBusinessActor("view");
  const sql = await getSql();
  return readOptimizerProductionReadiness(sql);
});
