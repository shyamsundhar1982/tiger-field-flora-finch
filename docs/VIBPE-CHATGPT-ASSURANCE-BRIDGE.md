# VIBPE Assurance ↔ ChatGPT Bridge

## Purpose

Expose VIBPE Assurance as a narrow, read-only machine interface so an external ChatGPT connector can retrieve current assurance state without receiving transaction-writing authority.

The bridge is deliberately separate from the canonical business writers. It may read assurance snapshots, the unified exception stream, UI coverage/observations, route/backend gaps, and gate definitions. It cannot capture snapshots, approve actions, mutate ERP truth, or close findings.

## Endpoint

`GET /api/vibpe/chatgpt-assurance`

Authentication uses a dedicated server secret:

`VIBPE_CHATGPT_BRIDGE_TOKEN`

Clients send:

`Authorization: Bearer <token>`

If the secret is not configured the route returns `503 bridge_not_configured`. Invalid or missing credentials return `401 unauthorized`.

## Payload

The response schema is `vibpe-assurance-bridge/v1` and includes:

- latest captured VIBPE Assurance snapshot
- current counts from `vyndi_vibpe_assurance_exceptions_all`
- full current unified exception records and evidence
- VIBPE surface records that are not `full`
- active assurance gates
- UI assurance coverage by domain
- currently unobserved UI capabilities
- latest recorded observation for each UI capability

`generatedAt` is the bridge read time. `latestSnapshot` remains the immutable user-captured snapshot and must not be confused with the current live exception projection.

## Security model

1. Use a dedicated high-entropy bridge token. Do not reuse `DATABASE_URL`, `BETTER_AUTH_SECRET`, user passwords, or deployment credentials.
2. Store the token only as a Cloudflare server secret and in the authorized ChatGPT connector credential store.
3. The endpoint is GET-only and contains no transaction writer, snapshot capture, approval, or lifecycle mutation path.
4. The existing authenticated browser APIs remain unchanged for VINDY users.
5. VIBPE remains the evidence authority. ChatGPT may diagnose and prepare repository remediations, but findings close only after VIBPE records new runtime evidence.

## Remediation loop

`VIBPE detect → bridge read → ChatGPT diagnose → GitHub PR → CI/CodeQL/Cloudflare → VIBPE re-observe → new snapshot → close`

The bridge does not auto-merge code and does not silently change production data.

## Deployment setup

After this route is deployed, configure `VIBPE_CHATGPT_BRIDGE_TOKEN` in the authoritative Cloudflare Worker environment and redeploy. Then connect the endpoint through a ChatGPT App / connector with bearer authentication.

No public unauthenticated endpoint should be created as a shortcut.
