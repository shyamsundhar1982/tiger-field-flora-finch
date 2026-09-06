import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getCommandRole } from "@/lib/command-access";
import { canPerform, type CommandPermission } from "@/lib/page-access";

const decisionSchema = z.object({
  gateId: z.string().regex(/^GOV-[0-9]{3}$/),
  decision: z.string().min(1).max(200),
  outcome: z.enum(["approved", "rejected", "pending", "superseded"]),
  evidenceRef: z.string().max(500).optional(),
  requestId: z.string().max(120).optional(),
});

/**
 * Phase H server-side control point. The browser may render governance state,
 * but approval records are only written here after same-site validation and a
 * role-level `approve` permission check.
 */
export const recordGovernanceDecision = createServerFn({ method: "POST" })
  .validator(decisionSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();

    const role = await getCommandRole();
    if (!role || !canPerform(role, "approve" as CommandPermission)) {
      throw new Error("Governance approval permission denied.");
    }

    const sql = await getSql();
    const actorUserId = `command:${role}`;
    const id = crypto.randomUUID();

    await sql`
      insert into governance_audit_events
        (id, event_type, gate_id, actor_user_id, actor_role, decision, evidence_ref, outcome, request_id)
      values
        (${id}, ${"GOVERNANCE_DECISION"}, ${data.gateId}, ${actorUserId}, ${role}, ${data.decision}, ${data.evidenceRef ?? null}, ${data.outcome}, ${data.requestId ?? null})
    `;

    return { ok: true, id, actorRole: role };
  });

export const listGovernanceAudit = createServerFn({ method: "GET" }).handler(
  async () => {
    assertSameSiteRequest();

    const role = await getCommandRole();
    if (!role || !canPerform(role, "view")) {
      throw new Error("Governance audit access denied.");
    }

    const sql = await getSql();
    return sql<{
      id: string;
      event_type: string;
      gate_id: string;
      actor_user_id: string;
      actor_role: string;
      decision: string;
      evidence_ref: string | null;
      outcome: string;
      request_id: string | null;
      created_at: string;
    }>`
      select id, event_type, gate_id, actor_user_id, actor_role, decision,
             evidence_ref, outcome, request_id, created_at::text
      from governance_audit_events
      order by created_at desc
      limit 100
    `;
  },
);
