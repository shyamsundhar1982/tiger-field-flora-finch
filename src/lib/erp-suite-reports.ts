/**
 * VYNDI ERP Suite — live report server functions.
 * Read-only exportable views over the canonical schema.
 * All handlers require view permission; none mutate business truth.
 */
import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

async function requireReportView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) {
    throw new Error("Report view permission denied.");
  }
  return role;
}

// ---------------------------------------------------------------------------
// 1. Inventory & Supply
// ---------------------------------------------------------------------------

export const getInventoryCutoverReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_master_inventory_cutover_report
    order by reconciliation_class, ledger_id, sku, received_on, legacy_lot_id
  `;
});

export const getReservationHealthReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_reservation_health
    order by health desc, sku, reservation_id
  `;
});

export const getMslHealthReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_msl_health
    order by
      case health when 'BELOW_MSL' then 0 when 'BELOW_MONTHLY_USE' then 1 when 'NO_PLAN' then 2 else 3 end,
      ledger_id, sku
  `;
});

export const getFifoAgingReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_fifo_aging
    order by age_days desc, sku, layer_id
  `;
});

export const getProcurementNetRequirementReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_procurement_net_requirement
    order by net_buy_to_msl desc, net_buy_to_monthly_use desc, sku
  `;
});

export const getReceivingExceptionsReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_receiving_exceptions
    order by exception_class, purchase_order_id
  `;
});

export const getInventoryControlAuditSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  const [msl, fifo, alloc, reservations, cutover] = await Promise.all([
    sql`select count(*)::int as controls,
               count(*) filter(where minimum_stock_level > 0)::int as active_msl,
               count(*) filter(where planned_monthly_use <= 0)::int as missing_plan_use
          from master_inventory_items where active = true`,
    sql`with f as (
          select sku, vyndi_canonical_unit(unit) unit, sum(quantity_remaining) quantity_remaining
            from epr_inventory_fifo_layers group by sku, vyndi_canonical_unit(unit)
        ), k as (
          select sku, unit from vyndi_inventory_balance
          union select sku, unit from f
        )
        select count(*)::int as mismatches,
               coalesce(sum(abs(coalesce(b.quantity_balance,0) - coalesce(f.quantity_remaining,0))),0) as mismatch_units
          from k
          left join vyndi_inventory_balance b on b.sku = k.sku and b.unit = k.unit
          left join f on f.sku = k.sku and f.unit = k.unit
         where abs(coalesce(b.quantity_balance,0) - coalesce(f.quantity_remaining,0)) > 0.0001`,
    sql`select count(*)::int as issue_count,
               count(*) filter(where abs(abs(l.quantity_delta) - coalesce(a.allocated,0)) > 0.0001)::int as allocation_mismatches
          from epr_inventory_ledger l
          left join (
            select issue_ledger_id, sum(quantity) allocated
              from epr_inventory_fifo_allocations group by issue_ledger_id
          ) a on a.issue_ledger_id = l.id
         where l.quantity_delta < 0`,
    sql`select count(*)::int as active_reservations,
               coalesce(sum(quantity_reserved),0) as reserved_units,
               count(*) filter(where quantity_reserved <= 0)::int as invalid_reservations
          from epr_inventory_reservations where status = 'active'`,
    sql`select count(*)::int as outstanding_legacy_lots,
               count(*) filter(where reconciliation_class = 'CATALOGUE_SEED_REVIEW')::int as catalogue_seed_review,
               count(*) filter(where reconciliation_class = 'USER_RECEIPT_REVIEW')::int as user_receipt_review
          from vyndi_master_inventory_cutover_report`,
  ]);
  return {
    msl: msl[0] ?? {},
    fifo: fifo[0] ?? {},
    alloc: alloc[0] ?? {},
    reservations: reservations[0] ?? {},
    cutover: cutover[0] ?? {},
  };
});

// ---------------------------------------------------------------------------
// 2. Engineering → Production
// ---------------------------------------------------------------------------

export const getBomComplianceReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_bom_compliance
    order by compliance desc, job_card_id
  `;
});

export const getProductionReleaseGateReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_production_release_gate
    order by gate_status, job_card_id
  `;
});

// ---------------------------------------------------------------------------
// 3. Commercial
// ---------------------------------------------------------------------------

export const getOrderBookSyncReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_order_book_sync
    order by sync_status desc, sales_order_id
  `;
});

export const getOrderBacklogReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_order_backlog
    order by plan_month, sales_order_id
  `;
});

// ---------------------------------------------------------------------------
// 4. Financial
// ---------------------------------------------------------------------------

export const getMonthlyTransactionActualsReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_monthly_transaction_actuals
    order by plan_month
  `;
});

export const getReceivablesAgingReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_receivables_aging
    order by age_days desc, invoice_id
  `;
});

export const getPayablesAgingReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`
    select * from vyndi_report_payables_aging
    order by age_days desc, purchase_order_id
  `;
});

// ---------------------------------------------------------------------------
// 5. Governance
// ---------------------------------------------------------------------------

export const getAuditCoverageReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`select * from vyndi_report_audit_coverage`;
});

export const getRecentAuditEventsReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  return sql`select * from vyndi_report_recent_audit_events`;
});

// ---------------------------------------------------------------------------
// 6. Cross-cutting
// ---------------------------------------------------------------------------

export const getSopSnapshotReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();
  const rows = await sql`select * from vyndi_report_sop_snapshot`;
  return rows[0] ?? {};
});

/** Bundle every report for export / Control Tower. */
export const getAllErpSuiteReports = createServerFn({ method: "GET" }).handler(async () => {
  await requireReportView();
  const sql = await getSql();

  const [
    cutover,
    reservationHealth,
    mslHealth,
    fifoAging,
    procurementNet,
    receivingExceptions,
    bomCompliance,
    productionGate,
    orderSync,
    orderBacklog,
    monthlyActuals,
    receivablesAging,
    payablesAging,
    auditCoverage,
    recentAudit,
    sopSnapshot,
  ] = await Promise.all([
    sql`select * from vyndi_master_inventory_cutover_report order by reconciliation_class, ledger_id, sku`,
    sql`select * from vyndi_report_reservation_health order by health desc, sku`,
    sql`select * from vyndi_report_msl_health order by health, ledger_id, sku`,
    sql`select * from vyndi_report_fifo_aging order by age_days desc, sku`,
    sql`select * from vyndi_report_procurement_net_requirement order by net_buy_to_msl desc, sku`,
    sql`select * from vyndi_report_receiving_exceptions order by exception_class, purchase_order_id`,
    sql`select * from vyndi_report_bom_compliance order by compliance desc, job_card_id`,
    sql`select * from vyndi_report_production_release_gate order by gate_status, job_card_id`,
    sql`select * from vyndi_report_order_book_sync order by sync_status desc, sales_order_id`,
    sql`select * from vyndi_report_order_backlog order by plan_month, sales_order_id`,
    sql`select * from vyndi_monthly_transaction_actuals order by plan_month`,
    sql`select * from vyndi_report_receivables_aging order by age_days desc`,
    sql`select * from vyndi_report_payables_aging order by age_days desc`,
    sql`select * from vyndi_report_audit_coverage`,
    sql`select * from vyndi_report_recent_audit_events`,
    sql`select * from vyndi_report_sop_snapshot`,
  ]);

  return {
    generatedAt: new Date().toISOString(),
    inventory: {
      cutover,
      reservationHealth,
      mslHealth,
      fifoAging,
      procurementNetRequirement: procurementNet,
      receivingExceptions,
    },
    engineeringProduction: {
      bomCompliance,
      productionReleaseGate: productionGate,
    },
    commercial: {
      orderBookSync: orderSync,
      orderBacklog,
    },
    finance: {
      monthlyTransactionActuals: monthlyActuals,
      receivablesAging,
      payablesAging,
    },
    governance: {
      auditCoverage,
      recentAuditEvents: recentAudit,
    },
    crossCutting: {
      sopSnapshot: sopSnapshot[0] ?? {},
    },
  };
});
