import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { getAllErpSuiteReports } from "@/lib/erp-suite-reports";
import { buildIbpeOperatingWorkspace, type IbpeErpReportPack } from "@/lib/ibpe-operating-workspace";
import {
  applyConfirmedIbpeBusinessUpdate,
  confirmIbpeBusinessUpdate,
  previewIbpeBusinessUpdate,
  saveIbpeReportSnapshot,
} from "@/lib/ibpe-operating-governance";

export const Route = createFileRoute("/command/ibpe-operating-workspace")({
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
  const [updateInput, setUpdateInput] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [updateState, setUpdateState] = useState("No Business Update is pending.");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [snapshotState, setSnapshotState] = useState("No snapshot captured in this session.");

  async function captureSnapshot() {
    setSnapshotState("Capturing governed snapshot…");
    try {
      const result = await saveIbpeReportSnapshot({
        data: {
          schemaVersion: data.schemaVersion,
          evidenceCutoff: data.generatedAt,
          source: data.source,
          payload: data,
        },
      });
      setSnapshotState(`Snapshot saved: ${result.id}`);
    } catch (error) {
      setSnapshotState(error instanceof Error ? error.message : "Snapshot capture failed.");
    }
  }

  async function previewUpdate() {
    if (updateInput.trim().length < 3) {
      setUpdateState("Enter a substantive business update first.");
      return;
    }
    setUpdateState("Interpreting update without changing business truth…");
    try {
      const result = await previewIbpeBusinessUpdate({ data: { input: updateInput } });
      setProposalId(result.proposalId);
      setPreview(result.interpretation as Record<string, unknown>);
      const ambiguity = result.ambiguity.length
        ? ` Ambiguities: ${result.ambiguity.join(" ")}`
        : " No material ambiguity was detected by the deterministic parser.";
      setUpdateState(`Preview created: ${result.proposalId}.${ambiguity}`);
    } catch (error) {
      setUpdateState(error instanceof Error ? error.message : "Business Update preview failed.");
    }
  }

  async function confirmUpdate() {
    if (!proposalId) {
      setUpdateState("Preview an update before confirming it.");
      return;
    }
    setUpdateState("Recording authorised confirmation…");
    try {
      await confirmIbpeBusinessUpdate({
        data: { proposalId, note: "Confirmed from IBPE Operating Workspace after interpretation preview." },
      });
      setUpdateState("Proposal confirmed. No protected business record has changed yet.");
    } catch (error) {
      setUpdateState(error instanceof Error ? error.message : "Confirmation failed.");
    }
  }

  async function applyUpdate() {
    if (!proposalId) {
      setUpdateState("Preview and confirm an update before application.");
      return;
    }
    setUpdateState("Applying through the registered governed adapter…");
    try {
      const result = await applyConfirmedIbpeBusinessUpdate({
        data: { proposalId, note: "Apply only through an explicitly registered canonical adapter." },
      });
      if (result.applied) {
        setUpdateState(`Applied through ${result.adapter}; entity ${result.entityId}. Audit event recorded.`);
      } else {
        setUpdateState(result.reason ?? "Application blocked by governance boundary.");
      }
    } catch (error) {
      setUpdateState(error instanceof Error ? error.message : "Governed application failed.");
    }
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <header className="print:border-b print:border-border print:pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          VYNDI IBPE · Phase 1 · governed operating workspace
        </p>
        <h1 className="mt-1 font-display text-4xl">IBPE Operating Workspace</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Management intelligence derived only from canonical ERP report views. IBPE may calculate, warn,
          recommend, preview and route authorised changes, but it cannot bypass the canonical transaction
          authority for demand, BOM, inventory, procurement, production or finance.
        </p>
        <p className="mt-2 text-xs text-subtle">
          Evidence cut-off {new Date(data.generatedAt).toLocaleString("en-IN")} · schema {data.schemaVersion} · source {data.source}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={captureSnapshot} className="rounded-md border border-accent px-3 py-2 text-xs text-accent hover:bg-accent/10">
            Capture governed snapshot
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">
            Print detailed report
          </button>
          <Link to="/command/control-tower" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">
            Control Tower
          </Link>
        </div>
        <p className="mt-2 text-xs text-subtle print:hidden">{snapshotState}</p>
      </header>

      <Panel title="Today's Control Room" kicker="Exception-first management view">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Governed exceptions" value={number(data.todaysControlRoom.actionRequired)} hint="Rows requiring management attention" tone={data.todaysControlRoom.actionRequired ? "warn" : "ok"} />
          <Kpi label="Unverified areas" value={number(data.todaysControlRoom.unverified)} hint="Empty evidence is never treated as healthy" tone={data.todaysControlRoom.unverified ? "warn" : "ok"} />
          <Kpi label="Open orders" value={number(sop.open_orders)} hint={`${number(sop.open_order_units)} open-order units`} />
          <Kpi label="Open job cards" value={number(sop.open_job_cards)} hint={`${number(sop.active_reservations)} active reservations`} />
        </div>
        <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
          {data.sections.filter((section) => section.status !== "OK").map((section) => (
            <div key={section.key} className="rounded-md border border-border p-3">
              <p className={`font-semibold ${statusClass(section.status)}`}>{section.status} · {section.label}</p>
              <p className="mt-1 text-muted">
                {section.rows.length} evidence rows · {section.attentionCount} exceptions · owner/authority:
                {" "}<Link to={section.authorityRoute as never} className="text-accent hover:underline">{section.authorityRoute}</Link>
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Founder Briefing" kicker="What requires action now">
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
                <Link to={section.authorityRoute as never} className="font-semibold text-accent hover:underline print:hidden">Open authority →</Link>
              </div>
              {section.status === "UNVERIFIED" ? (
                <p className="mt-3 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
                  UNKNOWN — BUSINESS UPDATE REQUIRED
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Business Update" kicker="Input → interpretation preview → authorised confirmation → governed adapter">
        <div className="print:hidden">
          <textarea
            value={updateInput}
            onChange={(event) => setUpdateInput(event.target.value)}
            rows={5}
            placeholder="Example: Supplier quotation RFQ-24-018 confirms revised lead time of 45 days. Review procurement impact."
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={previewUpdate} className="rounded-md border border-accent px-3 py-2 text-xs text-accent hover:bg-accent/10">
              1. Preview interpretation
            </button>
            <button type="button" onClick={confirmUpdate} disabled={!proposalId} className="rounded-md border border-border px-3 py-2 text-xs text-muted disabled:opacity-40">
              2. Authorise proposal
            </button>
            <button type="button" onClick={applyUpdate} disabled={!proposalId} className="rounded-md border border-border px-3 py-2 text-xs text-muted disabled:opacity-40">
              3. Apply governed adapter
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">{updateState}</p>
          {preview ? (
            <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-bg/40 p-3 text-[11px] leading-5 text-muted">
              {JSON.stringify(preview, null, 2)}
            </pre>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Interpretation" value="Preview first" hint="No direct LLM-to-database write" />
          <Kpi label="Approval" value="Required" hint="Approve permission enforced server-side" />
          <Kpi label="Protected domains" value="Adapter only" hint="No bypass of canonical authority" tone="ok" />
          <Kpi label="Autonomous learning" value="Disabled" hint="Not permitted in Phase 1" tone="ok" />
        </div>
      </Panel>

      <section className="rounded-xl border border-border bg-surface/20 p-5 print:border-black print:bg-white" aria-label="Detailed Operating Report">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-subtle">Detailed Operating Report</p>
            <h2 className="mt-1 font-display text-2xl">Evidence-backed Phase 1 operating pack</h2>
          </div>
          <span className="text-xs text-muted">Cut-off {new Date(data.generatedAt).toLocaleString("en-IN")}</span>
        </div>
        <div className="mt-5 grid gap-4 text-sm lg:grid-cols-2">
          <div>
            <p className="font-semibold">Executive Summary</p>
            <p className="mt-1 text-muted">{data.founderBriefing.headline}</p>
          </div>
          <div>
            <p className="font-semibold">Changes Since Previous Report</p>
            <p className="mt-1 text-muted">Compare persisted snapshots in the IBPE snapshot register. No comparison is fabricated when a prior snapshot is unavailable.</p>
          </div>
          <div>
            <p className="font-semibold">Top Risks & Required Actions</p>
            <p className="mt-1 text-muted">{data.todaysControlRoom.attentionAreas.length ? data.todaysControlRoom.attentionAreas.join(" · ") : "No governed exception currently active."}</p>
          </div>
          <div>
            <p className="font-semibold">Cash / Funding</p>
            <p className="mt-1 text-muted">Receivables and payables use canonical finance report views. Missing finance evidence remains UNKNOWN rather than inferred.</p>
          </div>
          <div>
            <p className="font-semibold">Customer / Order</p>
            <p className="mt-1 text-muted">Open orders {number(sop.open_orders)} · units {number(sop.open_order_units)}. Confirmed demand remains owned by Commercial.</p>
          </div>
          <div>
            <p className="font-semibold">Procurement / Inventory</p>
            <p className="mt-1 text-muted">ATP, reservations, MSL, FIFO and net-requirement evidence are consumed read-only from the canonical ERP report pack.</p>
          </div>
          <div>
            <p className="font-semibold">Production / Engineering</p>
            <p className="mt-1 text-muted">Open job cards {number(sop.open_job_cards)}. BOM/configuration and release-gate authority remain with their canonical services.</p>
          </div>
          <div>
            <p className="font-semibold">Decisions / Missing Information</p>
            <p className="mt-1 text-muted">{data.todaysControlRoom.unverified ? `${data.todaysControlRoom.unverified} area(s) are UNVERIFIED — BUSINESS UPDATE REQUIRED.` : "No evidence area is currently unverified."}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted">
          <p><strong>Calculation & audit appendix:</strong> source={data.source}; schema={data.schemaVersion}; exceptions={data.todaysControlRoom.actionRequired}; unverified={data.todaysControlRoom.unverified}. Snapshot, proposal, confirmation and application events are append-audited.</p>
          <p className="mt-2">Governance rule: Evidence → Calculation → Warning/Recommendation → Proposed Change → Authorized Approval → Registered Canonical Adapter → Audit Event.</p>
        </div>
      </section>
    </div>
  );
}
