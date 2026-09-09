import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";

export type OperatingActionStatus = "open" | "doing" | "done";

async function requireOperatingActionActor() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "edit")) {
    throw new Error("Operating action edit permission denied.");
  }
  try {
    return await requireBusinessActor("edit");
  } catch (error) {
    // Governance action status is an internal execution-control record rather
    // than an external commercial/production commitment. Keep the legacy
    // Command admin usable during the auth migration while preserving an
    // explicit, auditable actor id. Commercial orders, production approvals and
    // supplier commitments continue to require an individual Better Auth user.
    if (role === "admin") return { userId: "command:admin", role: "admin" as const };
    throw error;
  }
}

export const listOperatingActionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Operating action view permission denied.");
  const sql = await getSql();
  const rows = await sql<{ action_id: string; status: OperatingActionStatus }>`
    select action_id,status from vyndi_operating_actions order by action_id
  `;
  return Object.fromEntries(rows.map((row) => [row.action_id, row.status])) as Record<string, OperatingActionStatus>;
});

export const saveOperatingActionStatus = createServerFn({ method: "POST" })
  .validator(z.object({
    actionId: z.string().min(1).max(160),
    status: z.enum(["open", "doing", "done"]),
    owner: z.string().max(200).nullable().optional(),
    dueOn: z.string().date().nullable().optional(),
    note: z.string().max(1000).optional(),
  }))
  .handler(async ({ data }) => {
    const actor = await requireOperatingActionActor();
    const sql = await getSql();
    await sql.query(`select set_vyndi_operating_action($1,$2,$3,$4::date,$5,$6,$7)`, [
      data.actionId,
      data.status,
      data.owner ?? null,
      data.dueOn ?? null,
      data.note ?? "",
      actor.userId,
      actor.role,
    ]);
    return { ok: true, actionId: data.actionId, status: data.status };
  });
