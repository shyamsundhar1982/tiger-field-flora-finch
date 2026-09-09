import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireBusinessActor } from "@/lib/business-actor";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import type { SalesOrder } from "@/lib/finance/sales-engine";
import { MODELS } from "@/lib/data/models";
import { validateConfiguration } from "@/lib/product-configuration";

const statusSchema = z.enum(["lead", "confirmed", "delivered", "cancelled"]);
const channelSchema = z.enum(["direct", "dealer", "online"]);
const tierSchema = z.enum(["core", "pro", "apex"]);
const productSchema = z.enum(["aluminium", "carbon", "premiumCarbon"]);

const orderSchema = z.object({
  id: z.string().min(1).max(100),
  month: z.number().int().min(1).max(36),
  product: productSchema,
  units: z.number().positive().max(1_000_000),
  aspLakh: z.number().min(0).max(1_000_000),
  channel: channelSchema,
  status: statusSchema,
  modelTier: tierSchema.optional(),
  variantId: z.string().min(1).max(120).optional(),
  variantName: z.string().min(1).max(240).optional(),
  configuration: z.record(z.string(), z.string()).optional(),
  changeReason: z.string().trim().max(500).optional(),
}).superRefine((order, context) => {
  if (order.status === "confirmed" || order.status === "delivered") {
    if (!order.modelTier) context.addIssue({ code: "custom", path: ["modelTier"], message: "Committed demand requires a model tier." });
    if (!order.variantId) context.addIssue({ code: "custom", path: ["variantId"], message: "Committed demand requires an exact VINDY variant." });
    if (!order.configuration) context.addIssue({ code: "custom", path: ["configuration"], message: "Committed demand requires the controlled configuration." });
  }
});

function toSalesOrder(row: Record<string, unknown>): SalesOrder {
  return {
    id: String(row.id),
    month: Number(row.plan_month),
    product: row.product_id as SalesOrder["product"],
    units: Number(row.units),
    aspLakh: Number(row.asp_lakh),
    channel: row.channel as SalesOrder["channel"],
    status: row.status as SalesOrder["status"],
    modelTier: (row.model_tier ?? undefined) as SalesOrder["modelTier"],
    variantId: row.variant_id ? String(row.variant_id) : undefined,
    variantName: row.variant_name ? String(row.variant_name) : undefined,
    configuration: (row.configuration ?? undefined) as SalesOrder["configuration"],
  };
}

export const listSalesOrders = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Sales order view permission denied.");
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id,revision,plan_month,product_id,units,asp_lakh,channel,status,model_tier,
           variant_id,variant_name,configuration,updated_at::text as updated_at
    from vyndi_sales_orders
    order by plan_month,id
  `;
  return rows.map(toSalesOrder);
});

export const saveSalesOrder = createServerFn({ method: "POST" })
  .validator(orderSchema)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();

    if (data.variantId) {
      const variant = MODELS.find((entry) => entry.id === data.variantId);
      if (!variant) throw new Error("Unknown VINDY model/variant.");
      if (data.modelTier !== variant.tier) throw new Error("Sales order model tier does not match the selected variant.");
      const expectedProduct = variant.tier === "core" ? "aluminium" : variant.tier === "apex" ? "premiumCarbon" : "carbon";
      if (data.product !== expectedProduct) throw new Error("Sales order product line does not match the selected VINDY variant.");
      if (data.configuration) validateConfiguration(data.variantId, data.configuration);
    }

    const [current] = await sql.query<{
      plan_month: number | string;
      units: number | string;
      variant_id: string | null;
      configuration: Record<string, string> | null;
      status: string;
      job_card_status: string | null;
    }>(
      `select o.plan_month,o.units,o.variant_id,o.configuration,o.status,c.status as job_card_status
         from vyndi_sales_orders o
         left join epr_production_job_cards c on c.sales_order_id=o.id
        where o.id=$1 limit 1`,
      [data.id],
    );
    if (current?.job_card_status === "in_progress") {
      const materialChange =
        Number(current.plan_month) !== data.month ||
        Number(current.units) !== data.units ||
        (current.variant_id ?? null) !== (data.variantId ?? null) ||
        JSON.stringify(current.configuration ?? {}) !== JSON.stringify(data.configuration ?? {}) ||
        current.status !== data.status;
      if (materialChange) {
        throw new Error(
          "This order is already in production. Put the linked job card on controlled hold before revising quantity, timing, configuration or status.",
        );
      }
    }

    if (data.status === "delivered") {
      const rows = await sql.query<{ status: string }>(
        `select status from epr_production_job_cards where sales_order_id=$1 limit 1`,
        [data.id],
      );
      if (rows[0]?.status !== "complete") {
        throw new Error("Order delivery cannot be posted until Production marks the linked job card complete.");
      }
    }

    const rows = await sql.query<{ sales_order_id: string; revision: number; created: boolean }>(
      `select * from save_vyndi_sales_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
      [
        data.id,
        data.month,
        data.product,
        data.units,
        data.aspLakh,
        data.channel,
        data.status,
        data.modelTier ?? null,
        data.variantId ?? null,
        data.variantName ?? null,
        JSON.stringify(data.configuration ?? {}),
        data.changeReason ?? "",
        actor.userId,
        actor.role,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("Sales-order write did not return a revision.");

    const [persisted] = await sql.query<{
      id: string;
      revision: number | string;
      status: string;
      units: number | string;
      variant_id: string | null;
    }>(
      `select id,revision,status,units,variant_id from vyndi_sales_orders where id=$1 limit 1`,
      [row.sales_order_id],
    );
    const [revisionReceipt] = await sql.query<{ revision: number | string }>(
      `select revision from vyndi_sales_order_revisions where sales_order_id=$1 and revision=$2 limit 1`,
      [row.sales_order_id, Number(row.revision)],
    );

    if (!persisted || Number(persisted.revision) !== Number(row.revision) || !revisionReceipt) {
      throw new Error("Sales-order persistence verification failed; no committed order receipt was found.");
    }

    return {
      id: row.sales_order_id,
      revision: Number(row.revision),
      created: Boolean(row.created),
      persisted: true as const,
      status: persisted.status,
      units: Number(persisted.units),
      variantId: persisted.variant_id,
      actorRole: actor.role,
    };
  });
