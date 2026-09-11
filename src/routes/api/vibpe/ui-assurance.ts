import { createFileRoute } from "@tanstack/react-router";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/vibpe/ui-assurance")({
  server: {
    handlers: {
      GET: async () => {
        const actor = await requireBusinessActor("view");
        const sql = await getSql();
        const [capabilities, coverage, exceptions] = await Promise.all([
          sql.query("select * from vyndi_vibpe_ui_capability_registry where active=true order by domain,route_path,capability_id"),
          sql.query("select * from vyndi_vibpe_ui_coverage_summary order by domain"),
          sql.query(`select * from vyndi_vibpe_ui_assurance_exceptions
                     order by case severity when 'critical' then 1 else 2 end,domain,entity_id`),
        ]);
        return json({ ok: true, actor: { userId: actor.userId, role: actor.role }, capabilities, coverage, exceptions });
      },
      POST: async ({ request }) => {
        const actor = await requireBusinessActor("edit");
        const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!payload) return json({ ok: false, error: "invalid_json" }, 400);
        const capabilityId = String(payload.capabilityId ?? "").trim().slice(0, 120);
        const target = String(payload.target ?? "").trim().slice(0, 120);
        const routePath = String(payload.routePath ?? "").trim().slice(0, 240);
        const observedResult = String(payload.observedResult ?? "").trim().slice(0, 1000);
        if (!capabilityId || !target || !routePath || !observedResult) {
          return json({ ok: false, error: "incomplete_observation" }, 400);
        }
        const sql = await getSql();
        const registered = await sql.query<{ route_path: string }>(
          "select route_path from vyndi_vibpe_ui_capability_registry where capability_id=$1 and active=true",
          [capabilityId],
        );
        if (!registered[0]) return json({ ok: false, error: "unknown_capability" }, 404);
        if (capabilityId !== "UI-AUTH-SESSION" && registered[0].route_path !== routePath) {
          return json({ ok: false, error: "route_mismatch" }, 409);
        }
        const id = `VIBPE-UI-${crypto.randomUUID()}`;
        const evidence = payload.evidence && typeof payload.evidence === "object" ? payload.evidence : {};
        await sql.query(
          `insert into vyndi_vibpe_ui_observations
            (id,capability_id,target,actor_user_id,actor_role,passed,observed_result,route_path,correlation_id,evidence_json)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [id,capabilityId,target,actor.userId,actor.role,Boolean(payload.passed),observedResult,routePath,
           String(payload.correlationId ?? "").trim().slice(0,200) || null,JSON.stringify(evidence)],
        );
        return json({ ok: true, id, capabilityId, target, passed: Boolean(payload.passed) }, 201);
      },
    },
  },
});
