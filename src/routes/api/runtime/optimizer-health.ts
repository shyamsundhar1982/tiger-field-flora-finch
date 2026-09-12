import { createFileRoute } from "@tanstack/react-router";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { readOptimizerProductionReadiness } from "@/lib/optimizer-production-readiness";

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
 * Authenticated optimizer production diagnostic. Returns only safe deployment,
 * migration and evidence state; never connection strings, hosts, credentials or
 * raw business records.
 */
export const Route = createFileRoute("/api/runtime/optimizer-health")({
  server: {
    handlers: {
      GET: async () => {
        const actor = await requireBusinessActor("view");
        const sql = await getSql();
        const readiness = await readOptimizerProductionReadiness(sql);
        return json({ ...readiness, actorRole: actor.role }, readiness.databaseReachable ? 200 : 503);
      },
    },
  },
});
