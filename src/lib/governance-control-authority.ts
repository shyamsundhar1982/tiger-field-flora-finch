import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import type { OperatingActionStatus } from "@/lib/operating-action-authority";

export type GovernanceEvidenceStatus = "Approved" | "Pending" | "Needs evidence" | "Draft";

export type GovernanceControlRecord = {
  actionId: string;
  gateOpen: boolean;
  owner: string | null;
  approver: string | null;
  evidence: string | null;
  evidenceStatus: GovernanceEvidenceStatus | null;
};

const PREFIX = "governance-gate:";

export const listGovernanceControls = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Governance control view permission denied.");

  const sql = await getSql();
  const rows = await sql<{
    action_id: string;
    status: OperatingActionStatus;
    owner: string | null;
    note: string | null;
  }>`
    select action_id,status,owner,note
      from vyndi_operating_actions
     where action_id like 'governance-gate:%'
     order by action_id
  `;

  const result: Record<string, GovernanceControlRecord> = {};
  for (const row of rows) {
    let metadata: Partial<GovernanceControlRecord> = {};
    try {
      metadata = row.note ? JSON.parse(row.note) as Partial<GovernanceControlRecord> : {};
    } catch {
      metadata = {};
    }
    result[row.action_id.slice(PREFIX.length)] = {
      actionId: row.action_id,
      gateOpen: row.status !== "done",
      owner: row.owner ?? null,
      approver: metadata.approver ?? null,
      evidence: metadata.evidence ?? null,
      evidenceStatus: metadata.evidenceStatus ?? null,
    };
  }
  return result;
});
