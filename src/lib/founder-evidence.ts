import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";

const evidenceSchema = z.object({
  actionId: z.string().regex(/^FC-[0-9]{2}$/),
  evidenceType: z.enum(["document", "decision", "measurement", "quotation", "test", "link", "note"]),
  evidenceRef: z.string().max(500).optional(),
  note: z.string().min(3).max(1000),
});

export const recordFounderEvidence = createServerFn({ method: "POST" })
  .validator(evidenceSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await getCommandRole();
    if (!role || !canPerform(role, "edit")) {
      throw new Error("Founder evidence write access denied.");
    }

    const sql = await getSql();
    const id = crypto.randomUUID();
    const actorUserId = `command:${role}`;
    await sql`
      insert into founder_evidence_events
        (id, action_id, evidence_type, evidence_ref, note, actor_user_id, actor_role)
      values
        (${id}, ${data.actionId}, ${data.evidenceType}, ${data.evidenceRef ?? null}, ${data.note}, ${actorUserId}, ${role})
    `;

    return { ok: true, id, actorRole: role };
  });

export const listFounderEvidence = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) {
    throw new Error("Founder evidence access denied.");
  }

  const sql = await getSql();
  return sql<{
    id: string;
    action_id: string;
    evidence_type: string;
    evidence_ref: string | null;
    note: string;
    actor_role: string;
    created_at: string;
  }>`
    select id, action_id, evidence_type, evidence_ref, note, actor_role, created_at::text
    from founder_evidence_events
    order by created_at desc
    limit 100
  `;
});
