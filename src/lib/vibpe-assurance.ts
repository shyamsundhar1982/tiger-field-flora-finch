import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

export type VibpeAssuranceException = {
  exceptionKey: string;
  exceptionType: string;
  severity: "critical" | "warning" | "info";
  domain: string;
  entityType: string;
  entityId: string;
  relatedEntityType: string;
  relatedEntityId: string;
  gateId: string;
  correlationId: string;
  evidence: Record<string, string | number | boolean | null>;
};

const text = (value: unknown) => String(value ?? "");

const toException = (row: Record<string, unknown>): VibpeAssuranceException => ({
  exceptionKey: text(row.exception_key),
  exceptionType: text(row.exception_type),
  severity: text(row.severity) as VibpeAssuranceException["severity"],
  domain: text(row.domain),
  entityType: text(row.entity_type),
  entityId: text(row.entity_id),
  relatedEntityType: text(row.related_entity_type),
  relatedEntityId: text(row.related_entity_id),
  gateId: text(row.gate_id),
  correlationId: text(row.correlation_id),
  evidence: Object.fromEntries(
    Object.entries((row.evidence_json ?? {}) as Record<string, unknown>).map(([key, value]) => [
      key,
      value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : JSON.stringify(value),
    ]),
  ),
});

export const getVibpeAssuranceCoverage = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const sql = await getSql();
    const [entities, gates, workflow, surfaces, coverageSummary] = await Promise.all([
      sql.query("select * from vyndi_vibpe_entity_registry order by domain,entity_type"),
      sql.query("select * from vyndi_vibpe_gate_registry where active=true order by gate_id"),
      sql.query("select * from vyndi_vibpe_workflow_registry order by workflow_id,sequence_no"),
      sql.query("select * from vyndi_vibpe_surface_registry order by domain,surface_type,surface_name"),
      sql.query("select * from vyndi_vibpe_coverage_summary order by domain"),
    ]);
    return { entities, gates, workflow, surfaces, coverageSummary };
  });

export const listVibpeAssuranceExceptions = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select exception_key,exception_type,severity,domain,entity_type,entity_id,
              related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
         from vyndi_vibpe_assurance_exceptions_all
        order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
                 domain,exception_type,entity_id`,
    );
    return rows.map(toException);
  });

/**
 * First-render payload for the Assurance page.
 *
 * The full assurance APIs remain authoritative and unchanged. This read model
 * deliberately omits large registries that the first paint does not need and
 * caps live-exception rows; users can request the full detail from the page.
 */
export const getVibpeAssurancePageData = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );

    const sql = await getSql();
    const exceptionPreviewLimit = 80;
    const [gates, workflow, surfaces, exceptionSummaryRows, exceptionRows, uiCoverage, uiCapabilityCountRows] =
      await Promise.all([
        sql.query("select * from vyndi_vibpe_gate_registry where active=true order by gate_id"),
        sql.query("select * from vyndi_vibpe_workflow_registry order by workflow_id,sequence_no"),
        sql.query("select * from vyndi_vibpe_surface_registry order by domain,surface_type,surface_name"),
        sql.query<{
          exception_count: number | string;
          critical_count: number | string;
          warning_count: number | string;
        }>(`select count(*)::int as exception_count,
                  count(*) filter (where severity='critical')::int as critical_count,
                  count(*) filter (where severity='warning')::int as warning_count
             from vyndi_vibpe_assurance_exceptions_all`),
        sql.query<Record<string, unknown>>(
          `select exception_key,exception_type,severity,domain,entity_type,entity_id,
                  related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
             from vyndi_vibpe_assurance_exceptions_all
            order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
                     domain,exception_type,entity_id
            limit ${exceptionPreviewLimit}`,
        ),
        sql.query("select * from vyndi_vibpe_ui_coverage_summary order by domain"),
        sql.query<{ capability_count: number | string }>(
          "select count(*)::int as capability_count from vyndi_vibpe_ui_capability_registry where active=true",
        ),
      ]);

    const exceptionSummary = exceptionSummaryRows[0] ?? {
      exception_count: 0,
      critical_count: 0,
      warning_count: 0,
    };

    return {
      gates,
      workflow,
      surfaces,
      exceptions: exceptionRows.map(toException),
      exceptionSummary: {
        total: Number(exceptionSummary.exception_count),
        critical: Number(exceptionSummary.critical_count),
        warnings: Number(exceptionSummary.warning_count),
      },
      exceptionPreviewLimit,
      uiCoverage,
      uiCapabilityCount: Number(uiCapabilityCountRows[0]?.capability_count ?? 0),
    };
  });

export const captureVibpeAssuranceSnapshot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    const actor = await requireBusinessActor(
      "approve",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const sql = await getSql();
    const rows = await sql.query<{
      snapshot_id: string;
      exception_count: number | string;
      critical_count: number | string;
      warning_count: number | string;
    }>(
      "select * from capture_vibpe_assurance_snapshot($1,$2)",
      [actor.userId, actor.role],
    );
    const row = rows[0];
    if (!row) throw new Error("VIBPE assurance snapshot did not persist.");
    return {
      snapshotId: row.snapshot_id,
      exceptionCount: Number(row.exception_count),
      criticalCount: Number(row.critical_count),
      warningCount: Number(row.warning_count),
    };
  });
