import { createServerFn } from "@tanstack/react-start";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

type CapacityRow = {
  work_centre_id: string;
  work_centre_name: string;
  traveller_operation: string;
  sequence: number | string;
  available_hours_per_month: number | string;
  efficiency: number | string;
  standard_hours_per_unit: number | string;
  planning_status: string;
  source_ref: string;
  source_sha256: string;
  updated_by: string;
  updated_at: string;
};

type RoutingRow = {
  id: string;
  product_id: string;
  revision_code: string;
  status: string;
  source_ref: string;
  approved_by: string | null;
  approved_role: string | null;
  approved_at: string | null;
  operation_count: number | string;
};

type LatestIbpeRow = {
  id: string;
  approved_plan_revision: number | string;
  input_json: {
    demand?: Array<{ productId?: string }>;
    bom?: Array<{ productId?: string; sku?: string; approved?: boolean }>;
  };
};

export type AdvancedPlanningAuthorityReadiness = {
  latestIbpeRunId: string | null;
  approvedPlanRevision: number | null;
  plannedProductIds: string[];
  requiredSkus: string[];
  capacity: {
    rows: CapacityRow[];
    active: number;
    approved: number;
    planningDefault: number;
    ready: boolean;
  };
  routing: {
    rows: RoutingRow[];
    draft: number;
    approved: number;
    coveredProductIds: string[];
    missingProductIds: string[];
    ready: boolean;
  };
  supplierLanes: {
    approvedLaneCount: number;
    coveredSkus: string[];
    missingSkus: string[];
    approvedActiveSuppliers: number;
    approvedSupplierPrices: number;
    ready: boolean;
  };
};

const uniq = (items: Array<string | undefined>) =>
  [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))].sort();

export const getAdvancedPlanningAuthorityReadiness = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdvancedPlanningAuthorityReadiness> => {
    await requireBusinessActor("view");
    const sql = await getSql();
    const [capacityRows, routingRows, latestRows, supplierLaneRows, supplierCounts] = await Promise.all([
      sql.query<CapacityRow>(
        `select work_centre_id,work_centre_name,traveller_operation,sequence,available_hours_per_month,
                efficiency,standard_hours_per_unit,planning_status,source_ref,source_sha256,updated_by,updated_at::text
           from vyndi_capacity_standards
          where planning_status<>'retired'
          order by sequence,work_centre_id`,
      ),
      sql.query<RoutingRow>(
        `select r.id,r.product_id,r.revision_code,r.status,r.source_ref,r.approved_by,r.approved_role,
                r.approved_at::text,count(o.id)::int as operation_count
           from vyndi_routing_revisions r
           left join vyndi_routing_operations o on o.revision_id=r.id
          where r.status<>'retired'
          group by r.id,r.product_id,r.revision_code,r.status,r.source_ref,r.approved_by,r.approved_role,r.approved_at
          order by r.product_id,r.created_at desc`,
      ),
      sql.query<LatestIbpeRow>(
        `select id,approved_plan_revision,input_json
           from vyndi_ibpe_runs
          where status='complete'
          order by created_at desc
          limit 1`,
      ),
      sql.query<{ sku: string }>(`select distinct sku from vyndi_approved_supplier_lanes order by sku`),
      sql.query<{ approved_active_suppliers: number | string; approved_supplier_prices: number | string; approved_lane_count: number | string }>(
        `select
           (select count(*) from vyndi_suppliers where active=true and approval_status='approved') as approved_active_suppliers,
           (select count(*) from vyndi_procurement_prices where status='approved' and price_type='supplier' and supplier_id is not null) as approved_supplier_prices,
           (select count(*) from vyndi_approved_supplier_lanes) as approved_lane_count`,
      ),
    ]);

    const latest = latestRows[0] ?? null;
    const plannedProductIds = latest
      ? uniq([
          ...(latest.input_json.demand ?? []).map((row) => row.productId),
          ...(latest.input_json.bom ?? []).filter((row) => row.approved).map((row) => row.productId),
        ])
      : [];
    const requiredSkus = latest
      ? uniq((latest.input_json.bom ?? []).filter((row) => row.approved).map((row) => row.sku))
      : [];

    const approvedCapacity = capacityRows.filter((row) => row.planning_status === "approved").length;
    const planningDefault = capacityRows.filter((row) => row.planning_status === "planning-default").length;
    const approvedRoutingProducts = uniq(
      routingRows.filter((row) => row.status === "approved").map((row) => row.product_id),
    );
    const missingProductIds = plannedProductIds.filter((id) => !approvedRoutingProducts.includes(id));
    const coveredSkus = supplierLaneRows.map((row) => row.sku);
    const missingSkus = requiredSkus.filter((sku) => !coveredSkus.includes(sku));
    const counts = supplierCounts[0] ?? {
      approved_active_suppliers: 0,
      approved_supplier_prices: 0,
      approved_lane_count: 0,
    };

    return {
      latestIbpeRunId: latest?.id ?? null,
      approvedPlanRevision: latest ? Number(latest.approved_plan_revision) : null,
      plannedProductIds,
      requiredSkus,
      capacity: {
        rows: capacityRows,
        active: capacityRows.length,
        approved: approvedCapacity,
        planningDefault,
        ready: capacityRows.length > 0 && approvedCapacity === capacityRows.length,
      },
      routing: {
        rows: routingRows,
        draft: routingRows.filter((row) => row.status === "draft").length,
        approved: routingRows.filter((row) => row.status === "approved").length,
        coveredProductIds: approvedRoutingProducts,
        missingProductIds,
        ready: plannedProductIds.length > 0 && missingProductIds.length === 0,
      },
      supplierLanes: {
        approvedLaneCount: Number(counts.approved_lane_count),
        coveredSkus,
        missingSkus,
        approvedActiveSuppliers: Number(counts.approved_active_suppliers),
        approvedSupplierPrices: Number(counts.approved_supplier_prices),
        ready: requiredSkus.length > 0 && missingSkus.length === 0,
      },
    };
  },
);

export const approveAdvancedPlanningCapacity = createServerFn({ method: "POST" }).handler(async () => {
  assertSameSiteRequest();
  const actor = await requireBusinessActor("approve");
  const sql = await getSql();
  const rows = await sql.query<{ approved_count: number | string }>(
    `select approve_vyndi_capacity_standards($1,$2) as approved_count`,
    [actor.userId, actor.role],
  );
  return { approvedCount: Number(rows[0]?.approved_count ?? 0) };
});

export const createAdvancedPlanningRoutingDrafts = createServerFn({ method: "POST" }).handler(async () => {
  assertSameSiteRequest();
  const actor = await requireBusinessActor("edit");
  const sql = await getSql();
  const latestRows = await sql.query<{ id: string }>(
    `select id from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`,
  );
  const latest = latestRows[0];
  if (!latest) throw new Error("Routing draft creation blocked: no complete governed IBPE run exists.");
  const rows = await sql.query<{ revision_id: string; product_id: string }>(
    `select * from create_vyndi_routing_drafts_from_capacity($1,$2,$3)`,
    [latest.id, actor.userId, actor.role],
  );
  return { parentIbpeRunId: latest.id, revisions: rows };
});

export const approveAdvancedPlanningRoutingRevision = createServerFn({ method: "POST" })
  .validator((input: { revisionId: string }) => ({ revisionId: String(input.revisionId ?? "").trim().slice(0, 240) }))
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    if (!data.revisionId) throw new Error("Routing revision ID is required.");
    const actor = await requireBusinessActor("approve");
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `select approve_vyndi_routing_revision($1,$2,$3,$4) as id`,
      [data.revisionId, actor.userId, actor.role, "VIBPE-ADVANCED-PLANNING-AUTHORITY"],
    );
    return { id: rows[0]?.id ?? data.revisionId };
  });
