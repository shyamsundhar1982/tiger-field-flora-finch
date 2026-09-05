import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const databaseUrl = process.env.DATABASE_URL?.trim();
          if (process.env.NODE_ENV === "production" && !databaseUrl) {
            return new Response(JSON.stringify({ ok: false, backend: "unconfigured", reason: "DATABASE_URL is required in production" }), { status: 503, headers: { "content-type": "application/json" } });
          }
          const sql = await getSql();
          const rows = await sql.query("select count(*)::int as applied from _migrations");
          return new Response(JSON.stringify({ ok: true, backend: databaseUrl ? "neon" : "pglite", migrationsApplied: rows[0]?.applied ?? 0 }), { status: 200, headers: { "content-type": "application/json" } });
        } catch (error) {
          return new Response(JSON.stringify({ ok: false, backend: "unavailable", reason: error instanceof Error ? error.message : "database unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
