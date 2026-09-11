import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function configuredBridgeToken(): string | null {
  const value = process.env.VIBPE_CHATGPT_BRIDGE_TOKEN?.trim();
  return value ? value : null;
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export const Route = createFileRoute("/api/vibpe/chatgpt-assurance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expectedToken = configuredBridgeToken();
        if (!expectedToken) {
          return json({ ok: false, error: "bridge_not_configured" }, 503);
        }
        if (bearerToken(request) !== expectedToken) {
          return json(
            { ok: false, error: "unauthorized" },
            401,
            { "www-authenticate": 'Bearer realm="vibpe-assurance"' },
          );
        }

        const sql = await getSql();
        const [
          latestSnapshot,
          currentSummary,
          exceptions,
          uiCoverage,
          uiUnobserved,
          uiLatest,
          surfaceGaps,
          gates,
        ] = await Promise.all([
          sql.query(`select id,captured_at,correlation_id,exception_count,critical_count,warning_count,evidence_json
                       from vyndi_vibpe_assurance_snapshots
                      order by captured_at desc,id desc
                      limit 1`),
          sql.query(`select count(*)::int as exception_count,
                            count(*) filter (where severity='critical')::int as critical_count,
                            count(*) filter (where severity='warning')::int as warning_count,
                            count(*) filter (where severity='info')::int as info_count
                       from vyndi_vibpe_assurance_exceptions_all`),
          sql.query(`select exception_key,exception_type,severity,domain,entity_type,entity_id,
                            related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
                       from vyndi_vibpe_assurance_exceptions_all
                      order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
                               domain,exception_type,entity_id`),
          sql.query(`select * from vyndi_vibpe_ui_coverage_summary order by domain`),
          sql.query(`select c.capability_id,c.domain,c.route_path,c.capability_name,c.expected_result,c.critical
                       from vyndi_vibpe_ui_capability_registry c
                      where c.active=true
                        and not exists (
                          select 1 from vyndi_vibpe_ui_observations o
                           where o.capability_id=c.capability_id
                        )
                      order by c.domain,c.route_path,c.capability_id`),
          sql.query(`select distinct on (capability_id)
                            capability_id,observed_at,target,passed,observed_result,route_path,correlation_id,evidence_json
                       from vyndi_vibpe_ui_observations
                      order by capability_id,observed_at desc,id desc`),
          sql.query(`select surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,
                            coverage_status,evidence_source,notes
                       from vyndi_vibpe_surface_registry
                      where coverage_status <> 'full'
                      order by domain,surface_type,surface_name`),
          sql.query(`select gate_id,gate_family,gate_name,domain,entry_criteria,decision_criteria,
                            pass_effect,evidence_sources,critical
                       from vyndi_vibpe_gate_registry
                      where active=true
                      order by gate_id`),
        ]);

        return json({
          ok: true,
          schemaVersion: "vibpe-assurance-bridge/v1",
          generatedAt: new Date().toISOString(),
          latestSnapshot: latestSnapshot[0] ?? null,
          current: {
            summary: currentSummary[0] ?? {
              exception_count: 0,
              critical_count: 0,
              warning_count: 0,
              info_count: 0,
            },
            exceptions,
            surfaceGaps,
            gates,
            ui: {
              coverage: uiCoverage,
              unobserved: uiUnobserved,
              latestObservations: uiLatest,
            },
          },
        });
      },
    },
  },
});
