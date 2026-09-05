import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

const id = z.string().min(1);
const resultSchema = z.enum(["pass", "fail", "conditional"]);

async function admin() {
  const role = await getCommandRole();
  if (role !== "admin") throw new Error("Admin Command access is required for 5M controls.");
  return role;
}

export const startControlledOperation = createServerFn({ method: "POST" })
  .validator(z.object({
    travellerId: id,
    operationId: id,
    operatorId: id,
    qualificationId: id,
    equipmentId: id.optional(),
    methodId: id,
  }))
  .handler(async ({ data }) => {
    const actor = await admin();
    const sql = await getSql();
    const rows = await sql.query<{
      traveller_id: string;
      operator_id: string;
      qualification_id: string;
      equipment_id: string | null;
      method_id: string;
    }>(`select traveller_id,operator_id,qualification_id,equipment_id,method_id from epr_operation_controls where operation_id=$1 limit 1`, [data.operationId]);
    if (rows[0]) throw new Error("Operation already has an execution control record.");

    const qualification = await sql.query<{ id: string }>(
      `select q.id from epr_operator_qualifications q join epr_operators o on o.id=q.operator_id where q.id=$1 and q.operator_id=$2 and o.active=true and q.status='active' and q.valid_from<=now() and (q.valid_to is null or q.valid_to>now())`,
      [data.qualificationId, data.operatorId],
    );
    if (!qualification[0]) throw new Error("Operator qualification is not active or is not valid for this operation.");

    const method = await sql.query<{ id: string }>(`select id from epr_methods where id=$1 and status='approved' and (effective_from is null or effective_from<=now())`, [data.methodId]);
    if (!method[0]) throw new Error("Execution method is not approved/effective.");

    if (data.equipmentId) {
      const equipment = await sql.query<{ id: string }>(
        `select id from epr_equipment where id=$1 and status='available' and (calibration_required=false or (calibration_due_at is not null and calibration_due_at>now())) and (maintenance_due_at is null or maintenance_due_at>now())`,
        [data.equipmentId],
      );
      if (!equipment[0]) throw new Error("Equipment is unavailable, overdue for calibration, or overdue for maintenance.");
    }

    const traveller = await sql.query<{ id: string }>(`select id from epr_travellers where id=$1`, [data.travellerId]);
    if (!traveller[0]) throw new Error("Traveller not found.");

    await sql.query(`insert into epr_operation_controls (id,traveller_id,operation_id,operator_id,qualification_id,equipment_id,method_id,started_at,status) values ($1,$2,$3,$4,$5,$6,$7,now(),'open')`, [crypto.randomUUID(), data.travellerId, data.operationId, data.operatorId, data.qualificationId, data.equipmentId ?? null, data.methodId]);
    await sql.query(`insert into epr_audit_events (id,venture,entity_type,entity_id,action,actor,payload_json) select $1,venture,'operation_control',$2,'started',$3,$4 from epr_travellers where id=$5`, [crypto.randomUUID(), data.operationId, actor, JSON.stringify(data), data.travellerId]);
    return { ok: true };
  });

export const recordControlledParameter = createServerFn({ method: "POST" })
  .validator(z.object({
    travellerId: id,
    operationId: id,
    methodId: id,
    parameterCode: z.string().min(1).max(120),
    parameterName: z.string().min(1).max(200),
    nominalValue: z.number().optional(),
    lowerLimit: z.number().optional(),
    upperLimit: z.number().optional(),
    actualValue: z.number(),
    unit: z.string().min(1).max(40),
    result: resultSchema,
  }))
  .handler(async ({ data }) => {
    const actor = await admin();
    const sql = await getSql();
    const control = await sql.query<{ method_id: string }>(`select method_id from epr_operation_controls where operation_id=$1 and traveller_id=$2 and status='open'`, [data.operationId, data.travellerId]);
    if (control[0]?.method_id !== data.methodId) throw new Error("Operation method does not match the controlled method.");
    if (!control[0]) throw new Error("No open controlled operation exists.");
    if (data.lowerLimit !== undefined && data.upperLimit !== undefined && data.lowerLimit > data.upperLimit) throw new Error("Lower limit cannot exceed upper limit.");
    if (data.result === "pass" && data.lowerLimit !== undefined && data.actualValue < data.lowerLimit) throw new Error("Passing result is below the lower limit.");
    if (data.result === "pass" && data.upperLimit !== undefined && data.actualValue > data.upperLimit) throw new Error("Passing result is above the upper limit.");
    const parameterId = crypto.randomUUID();
    await sql.query(`insert into epr_process_parameters (id,traveller_id,operation_id,method_id,parameter_code,parameter_name,nominal_value,lower_limit,upper_limit,actual_value,unit,result,recorded_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [parameterId,data.travellerId,data.operationId,data.methodId,data.parameterCode,data.parameterName,data.nominalValue ?? null,data.lowerLimit ?? null,data.upperLimit ?? null,data.actualValue,data.unit,data.result,actor]);
    const traveller = await sql.query<{ venture: "carbon" | "aluminium" }>(`select venture from epr_travellers where id=$1`, [data.travellerId]);
    await sql.query(`insert into epr_audit_events (id,venture,entity_type,entity_id,action,actor,payload_json) values ($1,$2,'process_parameter',$3,'recorded',$4,$5)`, [crypto.randomUUID(),traveller[0]?.venture ?? "carbon",parameterId,actor,JSON.stringify(data)]);
    return { ok: true, parameterId };
  });
