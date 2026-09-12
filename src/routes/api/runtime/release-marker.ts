import { createFileRoute } from "@tanstack/react-router";

export const VIBPE_OPTIMIZER_RELEASE_CONTRACT = "VIBPE-OPTIMIZER-CLOSURE-3";

export const Route = createFileRoute("/api/runtime/release-marker")({
  server: {
    handlers: {
      GET: async () => new Response(
        JSON.stringify({
          ok: true,
          component: "vibpe-governed-optimizer",
          releaseContract: VIBPE_OPTIMIZER_RELEASE_CONTRACT,
          productionTarget: "cloudflare-workers",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      ),
    },
  },
});
