import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, ExternalLink } from "lucide-react";
import { Kpi, Panel } from "@/components/kpi";
import { getAllErpSuiteReports } from "@/lib/erp-suite-reports";

export const Route = createFileRoute("/command/control-tower")({
  loader: () => getAllErpSuiteReports(),
  component: ErpControlTower,
});

type Row = Record<string, unknown>;
type Report = {
  key: string;
  label: string;
  rows: Row[];
  route: string;
  exception?: (row: Row) => boolean;
};

const text = (row: Row, key: string) => String(row[key] ?? "");
const number = (row: Row, key: string) => Number(row[key] ?? 0);
const formatNumber = (value: unknown) => Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const formatLakhs = (value: unknown) => `₹${formatNumber(value)}L`;

function escapeCsv(value: unknown) {
  if (value == null) return "";
  const source = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

function download(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: Row[]) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const body = [keys.join(","), ...rows.map((row) => keys.map((key) => escapeCsv(row[key])).join(","))].join("\n");
  download(filename, body, "text/csv;charset=utf-8");
}

function severityLabel(report: Report) {
  if (!report.exception) return `${report.rows.length} rows`;
  const exceptions = report.rows.filter(report.exception).length;
  return exceptions ? `${exceptions} action required` : "Healthy";
}

function ReportCard({ report }: { report: Report }) {
  const exceptions = report.exception ? report.rows.filter(report.exception) : [];
  const preview = (exceptions.length ? exceptions : report.rows).slice(0, 5);
  const keys = Array.from(new Set(preview.flatMap((row) => Object.keys(row)))).slice(0, 6);
  return (
    <details className="rounded-xl border border-border bg-surface/30">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{report.label}</p>
          <p className="mt-1 text-xs text-muted">{severityLabel(report)}</p>
        </div>
        <Link to={report.route as never} className="text-xs font-semibold text-accent hover:underline" onClick={(event) => event.stopPropagation()}>
          Open authority <ExternalLink className="ml-1 inline size-3" />
        </Link>
      </summary>
      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Showing {preview.length} of {report.rows.length} rows{exceptions.length ? " · exceptions first" : ""}</p>
          <button
            type="button"
            onClick={() => downloadCsv(`vyndi-${report.key}.csv`, report.rows)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-fg hover:border-accent/40 hover:text-accent"
          >
            <Download className="size-3.5" /> CSV
          </button>
        </div>
        {preview.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                <tr>{keys.map((key) => <th key={key} className="px-2 py-2">{key.replaceAll("_", " ")}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={`${report.key}-${index}`} className="border-t border-border/70">
                    {keys.map((key) => <td key={key} className="max-w-[260px] truncate px-2 py-2 text-muted" title={text(row, key)}>{text(row, key) || "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No rows currently returned.</p>}
      </div>
    </details>
  );
}

function ErpControlTower() {
  const data = Route.useLoaderData();
  const sop = data.crossCutting.sopSnapshot as Row;
  const reports: Report[] = [
    {
      key: "reservation-health",
      label: "Inventory · Reservation health",
      rows: data.inventory.reservationHealth as Row[],
      route: "/command/inventory",
      exception: (row) => text(row, "health") !== "OK",
    },
    {
      key: "msl-health",
      label: "Inventory · MSL & forecast health",
      rows: data.inventory.mslHealth as Row[],
      route: "/command/inventory",
      exception: (row) => text(row, "health") !== "OK",
    },
    {
      key: "fifo-aging",
      label: "Inventory · FIFO ageing",
      rows: data.inventory.fifoAging as Row[],
      route: "/command/inventory",
      exception: (row) => !["", "FRESH"].includes(text(row, "aging_bucket")),
    },
    {
      key: "procurement-net-requirement",
      label: "Procurement · Net requirement",
      rows: data.inventory.procurementNetRequirement as Row[],
      route: "/command/procurement-planning",
      exception: (row) => number(row, "net_buy_to_msl") > 0 || number(row, "net_buy_to_monthly_use") > 0,
    },
    {
      key: "receiving-exceptions",
      label: "Procurement · Receiving exceptions",
      rows: data.inventory.receivingExceptions as Row[],
      route: "/command/receiving",
      exception: (row) => text(row, "exception_class") !== "OK",
    },
    {
      key: "bom-compliance",
      label: "Engineering → Production · BOM compliance",
      rows: data.engineeringProduction.bomCompliance as Row[],
      route: "/command/bom-control",
      exception: (row) => text(row, "compliance") !== "OK",
    },
    {
      key: "production-release-gate",
      label: "Production · Release gates",
      rows: data.engineeringProduction.productionReleaseGate as Row[],
      route: "/command/production",
      exception: (row) => ["AWAITING_RELEASE", "HOLD"].includes(text(row, "gate_status")),
    },
    {
      key: "order-book-sync",
      label: "Commercial · Order book synchronization",
      rows: data.commercial.orderBookSync as Row[],
      route: "/command/sales",
      exception: (row) => text(row, "sync_status") !== "SYNCED",
    },
    {
      key: "order-backlog",
      label: "Commercial · Order backlog",
      rows: data.commercial.orderBacklog as Row[],
      route: "/command/sales",
    },
    {
      key: "receivables-aging",
      label: "Finance · Receivables ageing",
      rows: data.finance.receivablesAging as Row[],
      route: "/command/receivables",
      exception: (row) => !["", "CURRENT"].includes(text(row, "aging_bucket")),
    },
    {
      key: "payables-aging",
      label: "Finance · Payables ageing",
      rows: data.finance.payablesAging as Row[],
      route: "/command/payables",
      exception: (row) => text(row, "payable_class") === "BLOCKED" || !["", "CURRENT"].includes(text(row, "aging_bucket")),
    },
    {
      key: "audit-coverage",
      label: "Governance · Audit coverage",
      rows: data.governance.auditCoverage as Row[],
      route: "/command/actions",
    },
    {
      key: "recent-audit-events",
      label: "Governance · Recent audit events",
      rows: data.governance.recentAuditEvents as Row[],
      route: "/command/actions",
    },
  ];
  const actionCount = reports.reduce((total, report) => total + (report.exception ? report.rows.filter(report.exception).length : 0), 0);
  const criticalReports = reports.filter((report) => report.exception && report.rows.some(report.exception));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Command Centre · read-only ERP intelligence</p>
          <h1 className="mt-1 font-display text-4xl">ERP Control Tower</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Exception-first operating view across Commercial, Engineering, Production, Inventory, Procurement, Finance and Governance. Every metric is sourced from canonical report views; this surface cannot post or mutate business truth.
          </p>
          <p className="mt-2 text-xs text-subtle">Generated {new Date(data.generatedAt).toLocaleString("en-IN")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/command/control-tower/ibpe-operating-workspace"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-green/40 bg-green/10 px-4 py-2.5 text-sm font-semibold text-green hover:bg-green/15"
          >
            Open IBPE Operating Workspace <ExternalLink className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => download("vyndi-erp-report-pack.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/15"
          >
            <Download className="size-4" /> Download full ERP pack
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open orders" value={formatNumber(sop.open_orders)} hint={`${formatNumber(sop.open_order_units)} units in open order book`} />
        <Kpi label="Open job cards" value={formatNumber(sop.open_job_cards)} hint={`${formatNumber(sop.active_reservations)} active reservations`} />
        <Kpi label="SKUs below MSL" value={formatNumber(sop.skus_below_msl)} hint={`${formatNumber(sop.open_pos)} open purchase orders`} tone={Number(sop.skus_below_msl ?? 0) > 0 ? "warn" : "ok"} />
        <Kpi label="Open receivables" value={formatLakhs(sop.open_receivables_lakh)} hint={`${formatNumber(sop.audit_events_7d)} audit events in last 7 days`} />
      </div>

      <Panel title="Action queue" kicker="Exceptions before tables">
        <div className="grid gap-3 md:grid-cols-3">
          <Kpi label="Action-required rows" value={String(actionCount)} hint="Across all controlled reports" tone={actionCount ? "warn" : "ok"} />
          <Kpi label="Affected control areas" value={String(criticalReports.length)} hint={criticalReports.length ? criticalReports.map((item) => item.label.split(" · ")[0]).filter((value, index, all) => all.indexOf(value) === index).join(" · ") : "No active exceptions"} tone={criticalReports.length ? "warn" : "ok"} />
          <Kpi label="Audit coverage" value={String((data.governance.auditCoverage as Row[]).length)} hint="Entity types represented in append-only audit trail" />
        </div>
        {criticalReports.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {criticalReports.map((report) => {
              const count = report.rows.filter(report.exception!).length;
              return <Link key={report.key} to={report.route as never} className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-4 py-3 text-sm hover:border-accent/35">
                <span><span className="font-medium text-fg">{report.label}</span><span className="ml-2 text-muted">{count} exception{count === 1 ? "" : "s"}</span></span>
                <span className="text-xs font-semibold text-accent">Resolve →</span>
              </Link>;
            })}
          </div>
        ) : <p className="mt-4 text-sm text-ok">No report-level exceptions are currently active.</p>}
      </Panel>

      <Panel title="Live report catalogue" kicker="Expandable · exportable · authority-linked">
        <div className="space-y-3">{reports.map((report) => <ReportCard key={report.key} report={report} />)}</div>
      </Panel>
    </div>
  );
}
