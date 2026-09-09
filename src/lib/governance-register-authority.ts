import { createServerFn } from "@tanstack/react-start";
import { getSql, type JsonValue } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import type { OperatingActionStatus } from "@/lib/operating-action-authority";

export type GovernanceRegisterRow = {
  id: string;
  open: boolean;
  owner: string | null;
  data: Record<string, JsonValue>;
};

export const listGovernanceRegister = createServerFn({ method: "GET" })
  .validator((input: { prefix: string }) => input)
  .handler(async ({ data }) => {
    const role = await getCommandRole();
    if (!role || !canPerform(role, "view")) throw new Error("Governance register view permission denied.");
    const sql = await getSql();
    const pattern = `${data.prefix}%`;
    const rows = await sql<{ action_id: string; status: OperatingActionStatus; owner: string | null; note: string | null }>`
      select action_id,status,owner,note from vyndi_operating_actions where action_id like ${pattern} order by action_id
    `;
    return rows.map((row) => {
      let parsed: Record<string, JsonValue> = {};
      try { parsed = row.note ? JSON.parse(row.note) as Record<string, JsonValue> : {}; } catch { parsed = {}; }
      return { id: row.action_id.slice(data.prefix.length), open: row.status !== "done", owner: row.owner, data: parsed } satisfies GovernanceRegisterRow;
    });
  });
