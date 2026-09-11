import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform, type CommandPermission } from "@/lib/page-access";

const lifecycleSchema = z.enum(["draft", "pending_approval", "approved", "superseded"]);

async function assertSameSiteRequest() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) return;
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;
  const isTopLevelGet = request.headers.get("sec-fetch-mode") === "navigate" && request.method === "GET";
  if (!isTopLevelGet) throw new Error("Forbidden: cross-site request blocked");
}

async function requirePermission(permission: CommandPermission) {
  const role = await getCommandRole();
  if (!role || !canPerform(role, permission)) throw new Error(`People & Office ${permission} permission denied.`);
  return role;
}

const actor = (role: string) => `command:${role}`;

async function audit(
  sql: Awaited<ReturnType<typeof getSql>>,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    role: string;
    sourceReference: string;
    previousState?: string | null;
    newState?: string | null;
    reason?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await sql`
    insert into vyndi_audit_events (
      id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json,
      correlation_id,previous_state,new_state,reason
    ) values (
      ${crypto.randomUUID()},${input.entityType},${input.entityId},${input.action},${actor(input.role)},${input.role},
      ${input.sourceReference},${JSON.stringify(input.payload ?? {})}::jsonb,
      ${`PEOPLE_OFFICE|${input.entityType}|${input.entityId}`},${input.previousState ?? null},${input.newState ?? null},${input.reason ?? null}
    )
  `;
}

export const listPeopleOfficeAuthority = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  const [people, costs, assets, financeFeed, summary, auditEvents] = await Promise.all([
    sql`select * from vyndi_people_records order by updated_at desc`,
    sql`select * from vyndi_people_office_cost_items order by cost_group,name`,
    sql`select * from vyndi_people_office_assets order by asset_class,category,name`,
    sql`select * from vyndi_people_office_finance_feed order by plan_month`,
    sql`select * from vyndi_people_office_authority_summary`,
    sql`
      select id,
             entity_type as "entityType",
             entity_id as "entityId",
             entity_revision as "entityRevision",
             action,
             actor_user_id as "actorUserId",
             actor_role as "actorRole",
             source_reference as "sourceReference",
             payload_json as "payloadJson",
             previous_state as "previousState",
             new_state as "newState",
             reason,
             created_at as "createdAt"
      from vyndi_audit_events
      where entity_type in ('people_record','people_office_cost','people_office_asset','people_office_reconciliation')
      order by created_at desc
      limit 200
    `,
  ]);
  return {
    people: Array.isArray(people) ? [...people] : [],
    costs: Array.isArray(costs) ? [...costs] : [],
    assets: Array.isArray(assets) ? [...assets] : [],
    financeFeed: Array.isArray(financeFeed) ? [...financeFeed] : [],
    summary: summary[0] ?? null,
    auditEvents: Array.isArray(auditEvents) ? [...auditEvents] : [],
  };
});

export const getPeopleOfficeFinanceFeed = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  const rows = await sql<{
    planMonth: number;
    operatingExpenseLakh: string | number;
    officeCapexLakh: string | number;
    officeDepreciationLakh: string | number;
  }>`
    select plan_month as "planMonth",
           operating_expense_lakh as "operatingExpenseLakh",
           office_capex_lakh as "officeCapexLakh",
           office_depreciation_lakh as "officeDepreciationLakh"
    from vyndi_people_office_finance_feed
    order by plan_month
  `;
  return rows.map((row) => ({
    planMonth: Number(row.planMonth),
    operatingExpenseLakh: Number(row.operatingExpenseLakh),
    officeCapexLakh: Number(row.officeCapexLakh),
    officeDepreciationLakh: Number(row.officeDepreciationLakh),
  }));
});

const personSchema = z.object({
  id: z.string().min(1).max(120),
  displayName: z.string().min(1).max(300),
  functionName: z.string().min(1).max(200),
  roleTitle: z.string().min(1).max(200),
  engagementType: z.enum(["employee", "contractor", "consultant", "planned_role"]),
  startMonth: z.number().int().min(1).max(36).nullable().optional(),
  endMonth: z.number().int().min(1).max(36).nullable().optional(),
  sourceReference: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
});

export const savePeopleRecordDraft = createServerFn({ method: "POST" })
  .validator(personSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    if (data.startMonth && data.endMonth && data.endMonth < data.startMonth) throw new Error("People record end month cannot precede start month.");
    const sql = await getSql();
    const existing = await sql<{ lifecycleStatus: string }>`select lifecycle_status as "lifecycleStatus" from vyndi_people_records where id=${data.id} limit 1`;
    if (existing[0] && existing[0].lifecycleStatus !== "draft") throw new Error("Only draft People records may be edited; create a controlled superseding record instead.");
    await sql`
      insert into vyndi_people_records (
        id,display_name,function_name,role_title,engagement_type,lifecycle_status,start_month,end_month,
        source_ref,notes,created_by
      ) values (
        ${data.id},${data.displayName},${data.functionName},${data.roleTitle},${data.engagementType},'draft',
        ${data.startMonth ?? null},${data.endMonth ?? null},${data.sourceReference},${data.notes ?? ""},${actor(role)}
      )
      on conflict (id) do update set
        display_name=excluded.display_name,function_name=excluded.function_name,role_title=excluded.role_title,
        engagement_type=excluded.engagement_type,start_month=excluded.start_month,end_month=excluded.end_month,
        source_ref=excluded.source_ref,notes=excluded.notes,updated_at=now()
      where vyndi_people_records.lifecycle_status='draft'
    `;
    await audit(sql,{ entityType:"people_record",entityId:data.id,action:"PEOPLE_RECORD_DRAFT_SAVED",role,sourceReference:data.sourceReference,newState:"draft",payload:{ engagementType:data.engagementType } });
    return { ok:true,id:data.id,status:"draft" as const };
  });

const costSchema = z.object({
  id: z.string().min(1).max(120),
  costGroup: z.enum(["payroll", "office", "statutory", "outsourcing"]),
  personId: z.string().min(1).max(120).nullable().optional(),
  name: z.string().min(1).max(300),
  stage: z.string().min(1).max(200),
  quantity: z.number().min(0),
  monthlyUnitCostLakh: z.number().min(0),
  startMonth: z.number().int().min(1).max(36),
  endMonth: z.number().int().min(1).max(36),
  oneTimeCostLakh: z.number().min(0),
  oneTimeMonth: z.number().int().min(1).max(36),
  sourceReference: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
});

export const savePeopleOfficeCostDraft = createServerFn({ method: "POST" })
  .validator(costSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    if (data.endMonth < data.startMonth) throw new Error("People & Office cost end month cannot precede start month.");
    const sql = await getSql();
    if (data.personId) {
      const person = await sql<{ id: string }>`select id from vyndi_people_records where id=${data.personId} and lifecycle_status in ('draft','pending_approval','approved') limit 1`;
      if (!person[0]) throw new Error("Payroll input references an unavailable People record.");
    }
    const existing = await sql<{ lifecycleStatus: string }>`select lifecycle_status as "lifecycleStatus" from vyndi_people_office_cost_items where id=${data.id} limit 1`;
    if (existing[0] && existing[0].lifecycleStatus !== "draft") throw new Error("Only draft People & Office cost items may be edited.");
    await sql`
      insert into vyndi_people_office_cost_items (
        id,cost_group,person_id,name,stage,quantity,monthly_unit_cost_lakh,start_month,end_month,
        one_time_cost_lakh,one_time_month,lifecycle_status,source_ref,notes,created_by
      ) values (
        ${data.id},${data.costGroup},${data.personId ?? null},${data.name},${data.stage},${data.quantity},
        ${data.monthlyUnitCostLakh},${data.startMonth},${data.endMonth},${data.oneTimeCostLakh},${data.oneTimeMonth},
        'draft',${data.sourceReference},${data.notes ?? ""},${actor(role)}
      )
      on conflict (id) do update set
        cost_group=excluded.cost_group,person_id=excluded.person_id,name=excluded.name,stage=excluded.stage,
        quantity=excluded.quantity,monthly_unit_cost_lakh=excluded.monthly_unit_cost_lakh,start_month=excluded.start_month,
        end_month=excluded.end_month,one_time_cost_lakh=excluded.one_time_cost_lakh,one_time_month=excluded.one_time_month,
        source_ref=excluded.source_ref,notes=excluded.notes,record_revision=vyndi_people_office_cost_items.record_revision+1,updated_at=now()
      where vyndi_people_office_cost_items.lifecycle_status='draft'
    `;
    await audit(sql,{ entityType:"people_office_cost",entityId:data.id,action:"PEOPLE_OFFICE_COST_DRAFT_SAVED",role,sourceReference:data.sourceReference,newState:"draft",payload:{ costGroup:data.costGroup,personId:data.personId ?? null } });
    return { ok:true,id:data.id,status:"draft" as const };
  });

const assetSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(300),
  category: z.string().min(1).max(200),
  assetClass: z.enum(["office_admin", "office_consumable"]),
  costLakh: z.number().min(0),
  monthlyCostLakh: z.number().min(0),
  purchaseMonth: z.number().int().min(1).max(36),
  usefulLifeMonths: z.number().int().positive(),
  allocationPct: z.number().min(0).max(100),
  sourceReference: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
});

export const savePeopleOfficeAssetDraft = createServerFn({ method: "POST" })
  .validator(assetSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    const sql = await getSql();
    const existing = await sql<{ lifecycleStatus: string }>`select lifecycle_status as "lifecycleStatus" from vyndi_people_office_assets where id=${data.id} limit 1`;
    if (existing[0] && existing[0].lifecycleStatus !== "draft") throw new Error("Only draft People & Office assets may be edited.");
    await sql`
      insert into vyndi_people_office_assets (
        id,name,category,asset_class,cost_lakh,monthly_cost_lakh,purchase_month,useful_life_months,
        allocation_pct,lifecycle_status,source_ref,notes,created_by
      ) values (
        ${data.id},${data.name},${data.category},${data.assetClass},${data.costLakh},${data.monthlyCostLakh},
        ${data.purchaseMonth},${data.usefulLifeMonths},${data.allocationPct},'draft',${data.sourceReference},${data.notes ?? ""},${actor(role)}
      )
      on conflict (id) do update set
        name=excluded.name,category=excluded.category,asset_class=excluded.asset_class,cost_lakh=excluded.cost_lakh,
        monthly_cost_lakh=excluded.monthly_cost_lakh,purchase_month=excluded.purchase_month,useful_life_months=excluded.useful_life_months,
        allocation_pct=excluded.allocation_pct,source_ref=excluded.source_ref,notes=excluded.notes,
        record_revision=vyndi_people_office_assets.record_revision+1,updated_at=now()
      where vyndi_people_office_assets.lifecycle_status='draft'
    `;
    await audit(sql,{ entityType:"people_office_asset",entityId:data.id,action:"PEOPLE_OFFICE_ASSET_DRAFT_SAVED",role,sourceReference:data.sourceReference,newState:"draft",payload:{ assetClass:data.assetClass } });
    return { ok:true,id:data.id,status:"draft" as const };
  });

const transitionSchema = z.object({
  id: z.string().min(1).max(120),
  toStatus: lifecycleSchema,
  sourceReference: z.string().min(1).max(500),
  note: z.string().min(1).max(2000),
});

function validTransition(fromStatus: string, toStatus: string) {
  return (fromStatus === "draft" && toStatus === "pending_approval")
    || (fromStatus === "pending_approval" && ["draft", "approved"].includes(toStatus))
    || (fromStatus === "approved" && toStatus === "superseded");
}

export const transitionPeopleOfficeCost = createServerFn({ method: "POST" })
  .validator(transitionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission(["approved","superseded"].includes(data.toStatus) ? "approve" : "edit");
    const sql = await getSql();
    const rows = await sql<{ status:string; revision:number }>`select lifecycle_status as status,record_revision as revision from vyndi_people_office_cost_items where id=${data.id} limit 1`;
    const current=rows[0]; if(!current) throw new Error("People & Office cost item not found.");
    if(!validTransition(current.status,data.toStatus)) throw new Error(`Invalid People & Office cost transition: ${current.status} → ${data.toStatus}`);
    await sql`update vyndi_people_office_cost_items set lifecycle_status=${data.toStatus},record_revision=${current.revision+1},approved_by=case when ${data.toStatus}='approved' then ${actor(role)} else approved_by end,updated_at=now() where id=${data.id}`;
    await audit(sql,{entityType:"people_office_cost",entityId:data.id,action:"PEOPLE_OFFICE_COST_STATUS_CHANGED",role,sourceReference:data.sourceReference,previousState:current.status,newState:data.toStatus,reason:data.note});
    return {ok:true,fromStatus:current.status,toStatus:data.toStatus};
  });

export const transitionPeopleOfficeAsset = createServerFn({ method: "POST" })
  .validator(transitionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission(["approved","superseded"].includes(data.toStatus) ? "approve" : "edit");
    const sql = await getSql();
    const rows = await sql<{ status:string; revision:number }>`select lifecycle_status as status,record_revision as revision from vyndi_people_office_assets where id=${data.id} limit 1`;
    const current=rows[0]; if(!current) throw new Error("People & Office asset not found.");
    if(!validTransition(current.status,data.toStatus)) throw new Error(`Invalid People & Office asset transition: ${current.status} → ${data.toStatus}`);
    await sql`update vyndi_people_office_assets set lifecycle_status=${data.toStatus},record_revision=${current.revision+1},approved_by=case when ${data.toStatus}='approved' then ${actor(role)} else approved_by end,updated_at=now() where id=${data.id}`;
    await audit(sql,{entityType:"people_office_asset",entityId:data.id,action:"PEOPLE_OFFICE_ASSET_STATUS_CHANGED",role,sourceReference:data.sourceReference,previousState:current.status,newState:data.toStatus,reason:data.note});
    return {ok:true,fromStatus:current.status,toStatus:data.toStatus};
  });

export const transitionPeopleRecord = createServerFn({ method: "POST" })
  .validator(transitionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission(["approved","superseded"].includes(data.toStatus) ? "approve" : "edit");
    const sql = await getSql();
    const rows = await sql<{ status:string }>`select lifecycle_status as status from vyndi_people_records where id=${data.id} limit 1`;
    const current=rows[0]; if(!current) throw new Error("People record not found.");
    if(!validTransition(current.status,data.toStatus)) throw new Error(`Invalid People record transition: ${current.status} → ${data.toStatus}`);
    await sql`update vyndi_people_records set lifecycle_status=${data.toStatus},approved_by=case when ${data.toStatus}='approved' then ${actor(role)} else approved_by end,updated_at=now() where id=${data.id}`;
    await audit(sql,{entityType:"people_record",entityId:data.id,action:"PEOPLE_RECORD_STATUS_CHANGED",role,sourceReference:data.sourceReference,previousState:current.status,newState:data.toStatus,reason:data.note});
    return {ok:true,fromStatus:current.status,toStatus:data.toStatus};
  });
