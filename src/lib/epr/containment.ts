import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

async function requireCommand(write = false) {
  const role = await getCommandRole();
  if (!role) throw new Error("Command access is required for EPR access.");
  if (write && role !== "admin") throw new Error("Admin Command access is required for EPR mutations.");
  return role;
}

const id = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

export const getContainment = createServerFn({ method: "GET" })
  .validator(z.object({ travellerId: z.string().optional(), serialNumber: z.string().optional() }))
  .handler(async ({ data }) => {
    await requireCommand();
    const sql = await getSql();
    const cases = await sql.query(
      `select * from epr_containment_cases
       where ($1::text is null or source_id=$1)
          or ($2::text is null or id in (select case_id from epr_containment_targets where serial_number=$2))
       order by created_at desc`,
      [data.travellerId ?? null, data.serialNumber ?? null],
    );
    const targets = await sql.query(
      `select t.*, c.reason, c.severity, c.status as case_status
       from epr_containment_targets t
       join epr_containment_cases c on c.id=t.case_id
       where ($1::text is null or t.traveller_id=$1)
         and ($2::text is null or t.serial_number=$2)
       order by t.created_at desc`,
      [data.travellerId ?? null, data.serialNumber ?? null],
    );
    return { cases: cases.rows, targets: targets.rows };
  });

export const createContainmentCase = createServerFn({ method: "POST" })
  .validator(z.object({
    venture: z.enum(["carbon", "aluminium"]),
    sourceType: z.enum(["material_lot", "process_operation", "equipment", "operator", "method", "inspection", "ncr_capa", "serial"]),
    sourceId: z.string().min(1),
    reason: z.string().min(1),
    severity: z.enum(["minor", "major", "critical"]),
    notes: z.string().default(""),
  }))
  .handler(async ({ data }) => {
    const actor = await requireCommand(true);
    const sql = await getSql();
    const caseId = id("CASE");
    await sql.query(
      `select epr_create_containment_case($1,$2,$3,$4,$5,$6,$7,$8)`,
      [caseId, data.venture, data.sourceType, data.sourceId, data.reason, data.severity, actor, data.notes],
    );
    return { caseId };
  });

export const applyContainmentTarget = createServerFn({ method: "POST" })
  .validator(z.object({
    caseId: z.string().min(1),
    travellerId: z.string().min(1),
    action: z.enum(["quarantine", "hold", "rework", "recall", "release"]),
    notes: z.string().default(""),
  }))
  .handler(async ({ data }) => {
    const actor = await requireCommand(true);
    const sql = await getSql();
    const targetId = id("TARGET");
    await sql.query(
      `select epr_apply_containment_target($1,$2,$3,$4,$5,$6)`,
      [targetId, data.caseId, data.travellerId, data.action, actor, data.notes],
    );
    return { targetId };
  });

export const clearContainmentTarget = createServerFn({ method: "POST" })
  .validator(z.object({ targetId: z.string().min(1), notes: z.string().default("") }))
  .handler(async ({ data }) => {
    const actor = await requireCommand(true);
    const sql = await getSql();
    await sql.query(
      `select epr_clear_containment_target($1,$2,$3)`,
      [data.targetId, actor, data.notes],
    );
    return { cleared: true };
  });

export const isTravellerReleaseBlocked = createServerFn({ method: "GET" })
  .validator(z.object({ travellerId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireCommand();
    const sql = await getSql();
    const result = await sql.query<{ blocked: boolean }>(
      `select epr_traveller_release_blocked($1) as blocked`,
      [data.travellerId],
    );
    return { blocked: Boolean(result.rows[0]?.blocked) };
  });
