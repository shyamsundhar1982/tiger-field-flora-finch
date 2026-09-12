import { createFileRoute } from "@tanstack/react-router";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { resolvePostgresTransport } from "@/lib/postgres-runtime";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Authenticated production diagnostic for database transport activation.
 * Deliberately returns only transport class and query timing: never connection
 * strings, credentials, hosts, environment values or other database metadata.
 */
export const Route = createFileRoute("/api/runtime/db-health")({
  server: {
    handlers: {
      GET: async () => {
        const actor = await requireBusinessActor("view");
        const transport = await resolvePostgresTransport();
        const sql = await getSql();
        const startedAt = performance.now();
        const rows = await sql.query<{ probe: number }>("select 1::int as probe");
        const queryLatencyMs = Math.max(0, performance.now() - startedAt);

        if (rows[0]?.probe !== 1) {
          return json({ ok: false, error: "db_probe_failed" }, 503);
        }

        return json({
          ok: true,
          source: transport?.source ?? "pglite",
          queryLatencyMs: Number(queryLatencyMs.toFixed(1)),
          actorRole: actor.role,
        });
      },
    },
  },
});
