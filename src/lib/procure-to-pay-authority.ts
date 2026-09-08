import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBusinessActor } from "@/lib/business-actor";
import { getCommandRole } from "@/lib/command-access";
import { getSql, type SqlRow } from "@/lib/db";
import { canPerform } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";

const identifier = z.string().trim().min(1).max(120);
const reference = z.string().trim().min(1).max(500);
const positiveQuantity = z.number().positive().max(1_000_000_000);
const nonNegativeMoney = z.number().min(0).max(1_000_000_000_000);

async function requirePageView(route: string) {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view", getRouteMeta(route))) {
    throw new Error("Procure-to-pay view permission denied.");
  }
  return role;
}

async function requirePageActor(route: string, permission: "edit" | "approve") {
  const actor = await requireBusinessActor(permission);
  if (!canPerform(actor.role, permission, getRouteMeta(route))) {
    throw new Error(`Procure-to-pay ${permission} permission denied.`);
  }
  return actor;
}

export const getPurchaseExecutionData = createServerFn({ method: "GET" }).handler(async () => {
  await requirePageView("/command/purchase-execution");
  const sql = await getSql();
  const [suppliers, purchaseOrders, recommendations, inventoryItems] = await Promise.all([
    sql.query<SqlRow>(
      `select id,name,currency,payment_terms_days,lead_time_days,approval_status,quality_rating,
              delivery_rating,source_reference,active,updated_at::text as updated_at
         from vyndi_suppliers order by active desc,approval_status,name`,
    ),
    sql.query<SqlRow>(`select * from vyndi_purchase_order_status order by expected_receipt_on,id`),
    sql.query<SqlRow>(
      `select a.id,a.requirement_month,a.sku,a.unit,a.quantity,a.status,a.demand_basis,a.note,
              coalesce(p.committed_quantity,0) as committed_quantity
         from epr_procurement_sku_actions a
         left join (
           select source_action_id,sum(quantity) committed_quantity
             from vyndi_purchase_orders
            where status<>'cancelled' and source_action_id is not null
            group by source_action_id
         ) p on p.source_action_id=a.id
        where a.scenario='base' and a.action_type in ('approval','po') and a.status<>'cancelled'
        order by a.requirement_month,a.sku,a.action_type`,
    ),
    sql.query<SqlRow>(
      `select sku,name,unit,ledger_id from master_inventory_items where active=true order by ledger_id,sku`,
    ),
  ]);
  return { suppliers, purchaseOrders, recommendations, inventoryItems };
});

export const saveSupplier = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      name: z.string().trim().min(2).max(200),
      currency: z.string().trim().length(3).default("INR"),
      paymentTermsDays: z.number().int().min(0).max(365),
      leadTimeDays: z.number().int().min(0).max(730),
      approvalStatus: z.enum(["pending", "approved", "suspended"]),
      qualityRating: z.number().min(0).max(100).nullable(),
      deliveryRating: z.number().min(0).max(100).nullable(),
      sourceReference: reference,
    }),
  )
  .handler(async ({ data }) => {
    const permission = data.approvalStatus === "approved" ? "approve" : "edit";
    const actor = await requirePageActor("/command/purchase-execution", permission);
    const sql = await getSql();
    const rows = await sql.query<{ upsert_vyndi_supplier: string }>(
      `select upsert_vyndi_supplier($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        data.id.toUpperCase(),
        data.name,
        data.currency.toUpperCase(),
        data.paymentTermsDays,
        data.leadTimeDays,
        data.approvalStatus,
        data.qualityRating,
        data.deliveryRating,
        data.sourceReference,
        actor.userId,
        actor.role,
        `AUD-${crypto.randomUUID()}`,
      ],
    );
    return { ok: true, id: rows[0]?.upsert_vyndi_supplier ?? data.id.toUpperCase() };
  });

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      supplierId: identifier,
      sourceActionId: z.string().trim().max(200).optional(),
      requirementMonth: z.number().int().min(1).max(36),
      sku: identifier,
      unit: z.string().trim().min(1).max(30),
      quantity: positiveQuantity,
      unitPriceInr: nonNegativeMoney,
      orderDate: z.string().date(),
      expectedReceiptOn: z.string().date(),
      paymentTermsDays: z.number().int().min(0).max(365),
      sourceReference: reference,
      notes: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requirePageActor("/command/purchase-execution", "edit");
    const sql = await getSql();
    const rows = await sql.query<{ create_vyndi_purchase_order: string }>(
      `select create_vyndi_purchase_order($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12,$13,$14,$15)`,
      [
        data.id.toUpperCase(),
        data.supplierId.toUpperCase(),
        data.sourceActionId ?? "",
        data.requirementMonth,
        data.sku.toUpperCase(),
        data.unit,
        data.quantity,
        data.unitPriceInr,
        data.orderDate,
        data.expectedReceiptOn,
        data.paymentTermsDays,
        data.sourceReference,
        data.notes ?? "",
        actor.userId,
        actor.role,
      ],
    );
    return { ok: true, id: rows[0]?.create_vyndi_purchase_order ?? data.id.toUpperCase() };
  });

export const transitionPurchaseOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      nextStatus: z.enum(["approved", "issued", "cancelled"]),
      sourceReference: reference,
    }),
  )
  .handler(async ({ data }) => {
    const permission = data.nextStatus === "approved" ? "approve" : "edit";
    const actor = await requirePageActor("/command/purchase-execution", permission);
    const sql = await getSql();
    const rows = await sql.query<{ transition_vyndi_purchase_order: string }>(
      `select transition_vyndi_purchase_order($1,$2,$3,$4,$5)`,
      [data.id, data.nextStatus, data.sourceReference, actor.userId, actor.role],
    );
    return { ok: true, id: rows[0]?.transition_vyndi_purchase_order ?? data.id };
  });

export const getReceivingData = createServerFn({ method: "GET" }).handler(async () => {
  await requirePageView("/command/receiving");
  const sql = await getSql();
  const [purchaseOrders, receipts] = await Promise.all([
    sql.query<SqlRow>(
      `select * from vyndi_purchase_order_status where status in ('issued','part_received','received')
       order by case when status='received' then 1 else 0 end,expected_receipt_on,id`,
    ),
    sql.query<SqlRow>(
      `select r.*,p.sku,p.unit,s.name as supplier_name
         from vyndi_goods_receipts r join vyndi_purchase_orders p on p.id=r.purchase_order_id
         join vyndi_suppliers s on s.id=p.supplier_id order by r.received_on desc,r.created_at desc`,
    ),
  ]);
  return { purchaseOrders, receipts };
});

export const postGoodsReceipt = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      purchaseOrderId: identifier,
      receivedOn: z.string().date(),
      quantityReceived: positiveQuantity,
      quantityAccepted: nonNegativeMoney,
      quantityRejected: nonNegativeMoney,
      inspectionStatus: z.enum(["accepted", "quarantine", "rejected"]),
      sourceReference: reference,
      notes: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requirePageActor("/command/receiving", "edit");
    const sql = await getSql();
    const rows = await sql.query<{ post_vyndi_goods_receipt: string }>(
      `select post_vyndi_goods_receipt($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        data.id.toUpperCase(),
        data.purchaseOrderId,
        data.receivedOn,
        data.quantityReceived,
        data.quantityAccepted,
        data.quantityRejected,
        data.inspectionStatus,
        data.sourceReference,
        data.notes ?? "",
        actor.userId,
        actor.role,
      ],
    );
    return { ok: true, id: rows[0]?.post_vyndi_goods_receipt ?? data.id.toUpperCase() };
  });

export const resolveGoodsReceipt = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      resolution: z.enum(["accepted", "rejected"]),
      resolvedOn: z.string().date(),
      sourceReference: reference,
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requirePageActor("/command/receiving", "edit");
    const sql = await getSql();
    await sql.query(`select resolve_vyndi_goods_receipt($1,$2,$3::date,$4,$5,$6)`, [
      data.id,
      data.resolution,
      data.resolvedOn,
      data.sourceReference,
      actor.userId,
      actor.role,
    ]);
    return { ok: true, id: data.id };
  });

export const getPayablesData = createServerFn({ method: "GET" }).handler(async () => {
  await requirePageView("/command/payables");
  const sql = await getSql();
  const [purchaseOrders, payables] = await Promise.all([
    sql.query<SqlRow>(
      `select * from vyndi_purchase_order_status where quantity_accepted>0 order by expected_receipt_on,id`,
    ),
    sql.query<SqlRow>(
      `select * from vyndi_accounts_payable order by case when amount_open_inr>0 then 0 else 1 end,due_on,id`,
    ),
  ]);
  return { purchaseOrders, payables };
});

export const postSupplierInvoice = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      purchaseOrderId: identifier,
      invoiceNumber: identifier,
      invoiceOn: z.string().date(),
      quantityInvoiced: positiveQuantity,
      amountExGstInr: nonNegativeMoney,
      gstInr: nonNegativeMoney,
      sourceReference: reference,
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requirePageActor("/command/payables", "edit");
    const sql = await getSql();
    const rows = await sql.query<{
      invoice_id: string;
      match_status: string;
      match_message: string;
    }>(`select * from post_vyndi_supplier_invoice($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10)`, [
      data.id.toUpperCase(),
      data.purchaseOrderId,
      data.invoiceNumber,
      data.invoiceOn,
      data.quantityInvoiced,
      data.amountExGstInr,
      data.gstInr,
      data.sourceReference,
      actor.userId,
      actor.role,
    ]);
    if (!rows[0]) throw new Error("Supplier invoice did not return a controlled record.");
    return { id: rows[0].invoice_id, status: rows[0].match_status, message: rows[0].match_message };
  });

export const approveSupplierInvoice = createServerFn({ method: "POST" })
  .validator(z.object({ id: identifier }))
  .handler(async ({ data }) => {
    const actor = await requirePageActor("/command/payables", "approve");
    const sql = await getSql();
    await sql.query(`select approve_vyndi_supplier_invoice($1,$2,$3)`, [
      data.id,
      actor.userId,
      actor.role,
    ]);
    return { ok: true, id: data.id };
  });

export const postSupplierPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: identifier,
      supplierInvoiceId: identifier,
      paidOn: z.string().date(),
      amountInr: z.number().positive().max(1_000_000_000_000),
      sourceReference: reference,
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requirePageActor("/command/payables", "edit");
    const sql = await getSql();
    await sql.query(`select post_vyndi_supplier_payment($1,$2,$3::date,$4,$5,$6,$7)`, [
      data.id.toUpperCase(),
      data.supplierInvoiceId,
      data.paidOn,
      data.amountInr,
      data.sourceReference,
      actor.userId,
      actor.role,
    ]);
    return { ok: true, id: data.id.toUpperCase() };
  });

export const getDecisionInboxData = createServerFn({ method: "GET" }).handler(async () => {
  const role = await requirePageView("/command/decision-inbox");
  const sql = await getSql();
  const [
    purchaseApprovals,
    receivingExceptions,
    payableApprovals,
    planApprovals,
    materialExceptions,
  ] = await Promise.all([
    sql.query<SqlRow>(
      `select id,'Purchase approval' as kind,'high' as priority,
              'Approve '||id||' · '||quantity||' '||unit||' '||sku as title,
              '₹'||round(quantity*unit_price_inr,2)||' · '||source_reference as detail,
              '/command/purchase-execution' as route,created_at::text as created_at
         from vyndi_purchase_orders where status='pending_approval' order by created_at`,
    ),
    sql.query<SqlRow>(
      `select id,'Receiving exception' as kind,'high' as priority,
              inspection_status||' · '||id as title,
              quantity_received||' received · '||quantity_rejected||' rejected · '||source_reference as detail,
              '/command/receiving' as route,created_at::text as created_at
         from vyndi_goods_receipts where inspection_status in ('quarantine','rejected') order by created_at`,
    ),
    sql.query<SqlRow>(
      `select id,'Payable review' as kind,case when status='blocked' then 'high' else 'medium' end as priority,
              case when status='blocked' then 'Resolve invoice mismatch · ' else 'Approve matched invoice · ' end||invoice_number as title,
              match_message as detail,'/command/payables' as route,invoice_on::text as created_at
         from vyndi_supplier_invoices where status in ('matched','blocked') order by invoice_on`,
    ),
    sql.query<SqlRow>(
      `select id,'Plan approval' as kind,'high' as priority,'Approve operating plan revision '||revision as title,
              coalesce(nullif(change_reason,''),'Governed plan revision awaiting approval') as detail,
              '/command/governance' as route,coalesce(submitted_at,created_at)::text as created_at
         from vyndi_plan_revisions where status='pending_approval' order by revision`,
    ),
    sql.query<SqlRow>(
      `select job_card_line_id as id,'Material shortage' as kind,'high' as priority,
              sku||' short by '||shortage_quantity||' '||unit as title,
              'Job card '||job_card_id||' · required M'||due_month as detail,
              '/command/procurement-planning' as route,null::text as created_at
         from vyndi_live_job_card_requirements where shortage_quantity>0 order by due_month,sku`,
    ),
  ]);
  const items = [
    ...purchaseApprovals,
    ...receivingExceptions,
    ...payableApprovals,
    ...planApprovals,
    ...materialExceptions,
  ].filter((item) => canPerform(role, "view", getRouteMeta(String(item.route))));
  return { items };
});
