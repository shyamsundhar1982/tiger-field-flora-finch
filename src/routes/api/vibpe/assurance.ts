import { createFileRoute } from "@tanstack/react-router";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/vibpe/assurance")({
  server: {
    handlers: {
      GET: async () => {
        const actor = await requireBusinessActor("view");
        const sql = await getSql();
        const [exceptions, coverage] = await Promise.all([
          sql.query(`select exception_key,exception_type,severity,domain,entity_type,entity_id,
                            related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
                       from vyndi_vibpe_assurance_exceptions_all
                      order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
                               domain,exception_type,entity_id`),
          sql.query(`select * from vyndi_vibpe_coverage_summary order by domain`),
        ]);
        return json({ ok: true, actor: { userId: actor.userId, role: actor.role }, exceptions, coverage });
      },
      POST: async () => {
        const actor = await requireBusinessActor("approve");
        const sql = await getSql();
        const rows = await sql.query<{
          snapshot_id: string;
          exception_count: number | string;
          critical_count: number | string;
          warning_count: number | string;
        }>("select * from capture_vibpe_assurance_snapshot($1,$2)", [actor.userId, actor.role]);
        const snapshot = rows[0];
        if (!snapshot) return json({ ok: false, error: "snapshot_not_persisted" }, 500);
        return json({
          ok: true,
          snapshotId: snapshot.snapshot_id,
          exceptionCount: Number(snapshot.exception_count),
          criticalCount: Number(snapshot.critical_count),
          warningCount: Number(snapshot.warning_count),
        });
      },
    },
  },
});
