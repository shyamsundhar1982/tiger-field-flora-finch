import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { getAllErpSuiteReports } from "@/lib/erp-suite-reports";
import { buildIbpeOperatingWorkspace, type IbpeErpReportPack } from "@/lib/ibpe-operating-workspace";

export const Route = createFileRoute("/command/control-tower/ibpe-operating-workspace")({
  loader: async () => {
    const reports = await getAllErpSuiteReports();
    return buildIbpeOperatingWorkspace(reports as IbpeErpReportPack);
  },
  component: IbpeOperatingWorkspace,
});

function statusClass(status: "OK" | "ATTENTION" | "UNVERIFIED") {
  if (status === "OK") return "text-ok";
  if (status === "ATTENTION") return "text-warn";
  return "text-muted";
}

function number(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function IbpeOperatingWorkspace() {
  const data = Route.useLoaderData();
  const sop = data.sopSnapshot;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          VYNDI IBPE · Phase 1 · governed read model
        </p>
        <h1 className="mt-1 font-display text-4xl">IBPE Operating Workspace</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Management intelligence derived only from canonical ERP report views. This workspace is advisory and read-only: it cannot confirm demand, alter BOMs, reserve stock, raise purchase orders, release job cards, post production, or write finance truth.
        </p>
        <p className="mt-2 text-xs text-subtle">
          Evidence cut-off {new Date(data.generatedAt).toLocaleString("en-IN")} · schema {data.schemaVersion}
        </p>
      </header>

      <Panel title="Today's Control Room" kicker="Exception-first management view">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Governed exceptions" value={number(data.todaysControlRoom.actionRequired)} hint="Rows requiring management attention" tone={data.todaysControlRoom.actionRequired ? "warn" : "ok"} />
          <Kpi label="Unverified areas" value={number(data.todaysControlRoom.unverified)} hint="Empty evidence is never treated as healthy" tone={data.todaysControlRoom.unverified ? "warn" : "ok"} />
          <Kpi label="Open orders" value={number(sop.open_orders)} hint={`${number(sop.open_order_units)} open-order units`} />
          <Kpi label="Open job cards" value={number(sop.open_job_cards)} hint={`${number(sop.active_reservations)} active reservations`} />
        </div>
      </Panel>

      <Panel title="Founder Briefing" kicker="Governed evidence only">
        <p className="text-base font-medium text-fg">{data.founderBriefing.headline}</p>
        {data.todaysControlRoom.attentionAreas.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.todaysControlRoom.attentionAreas.map((area) => (
              <span key={area} className="rounded-full border border-warn/30 bg-warn/5 px-3 py-1 text-xs text-warn">{area}</span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-1 text-xs text-muted">
          {data.founderBriefing.limitations.map((item) => <p key={item}>• {item}</p>)}
        </div>
      </Panel>

      <Panel title="Management Report" kicker="Demand → BOM → Inventory → Procurement → Production → Finance → Governance">
        <div className="grid gap-3 lg:grid-cols-2">
          {data.sections.map((section) => (
            <article key={section.key} className="rounded-xl border border-border bg-surface/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">{section.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{section.note}</p>
                </div>
                <span className={`text-xs font-semibold ${statusClass(section.status)}`}>{section.status}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted">{section.rows.length} evidence row{section.rows.length === 1 ? "" : "s"} · {section.attentionCount} exception{section.attentionCount === 1 ? "" : "s"}</span>
                <Link to={section.authorityRoute as never} className="font-semibold text-accent hover:underline">Open authority →</Link>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Business Update" kicker="Phase 1 safety boundary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Intake mode" value="Preview only" hint="No canonical business write" />
          <Kpi label="Confirmed write" value="Disabled" hint="Requires explicit governed authorization" tone="ok" />
          <Kpi label="Autonomous learning" value="Disabled" hint="Not permitted in Phase 1" tone="ok" />
          <Kpi label="Autonomous procurement" value="Disabled" hint="No unattended PO/supplier actions" tone="ok" />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          VIBPE Co-Pilot may consume this governed evidence for explanation and analysis. Co-Pilot/chat output is advisory and never becomes canonical business truth by itself.
        </p>
      </Panel>

      <Panel title="Detailed report readiness" kicker="Print/PDF-ready evidence structure">
        <p className="text-sm leading-6 text-muted">
          The read model exposes deterministic section status, evidence counts, authority routes, evidence cut-off, source classification and Phase 1 safety boundaries. Snapshot persistence and governed confirmed-write are intentionally not enabled in this first reconstructed gate.
        </p>
      </Panel>
    </div>
  );
}
