import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { ALL_KNOWLEDGE, type KnowledgeRecord } from "@/lib/data/knowledge";

export const Route = createFileRoute("/command/phase-6a")({ component: Phase6A });

type Gate = { id: string; title: string; owner: string; evidence: string; output: string };
const GATES: Gate[] = [
  { id: "EPR-01", title: "Phase 4 commercial handoff", owner: "Founder / Finance / Sales", evidence: "Approved product mix, ASP/COGS assumptions, launch timing, demand/order inputs and cash impact", output: "Commercial configuration accepted by production/inventory planning" },
  { id: "EPR-02", title: "Phase 5 engineering gate", owner: "Founder / Engineering", evidence: "VEDM-301 Rev 5.3.8 baseline, geometry/CAD revision, ECR disposition and structural/FEA evidence status", output: "Controlled engineering configuration for pilot" },
  { id: "EPR-03", title: "Supplier + tooling readiness", owner: "Supply Chain / Quality", evidence: "NDA, RFQ/MOQ, supplier qualification, tooling ownership/custody and controlled drawing release", output: "Qualified pilot supplier and accepted tooling configuration" },
  { id: "EPR-04", title: "Pilot traveller release", owner: "Manufacturing / Quality", evidence: "Build instruction, BOM/configuration, material lots, layup/cure requirements, inspection points and serial genealogy", output: "Pilot unit may enter controlled build" },
  { id: "EPR-05", title: "Build + traceability", owner: "OEM / Quality", evidence: "Material certificates/lots, layup records, cure cycle, machining/assembly records, serial number and deviations", output: "Complete unit genealogy" },
  { id: "EPR-06", title: "Dimensional + interface inspection", owner: "Quality / Engineering", evidence: "Controlled geometry, critical dimensions, BB/interface checks, fork/front-end and tyre envelope evidence", output: "Dimensionally dispositioned pilot unit" },
  { id: "EPR-07", title: "NDT + cosmetic inspection", owner: "Quality", evidence: "NDT record, finish/cosmetic inspection, defect disposition and NCR/CAPA where required", output: "Quality disposition" },
  { id: "EPR-08", title: "Structural / ISO evidence", owner: "Quality / Test Lab", evidence: "Applicable structural test reports and objective lab evidence; no certification claim without evidence", output: "Validation status recorded" },
  { id: "EPR-09", title: "Deviation / NCR control", owner: "Quality / Engineering", evidence: "NCR, containment, root-cause/CAPA, engineering concession or rework decision", output: "Controlled disposition with no silent acceptance" },
  { id: "EPR-10", title: "Configuration reconciliation", owner: "Founder / Engineering / Finance", evidence: "ECR → BOM/COGS → production → inventory → cash impact and affected SKU reconciliation", output: "Released configuration matches commercial and engineering records" },
  { id: "EPR-11", title: "Pilot release review", owner: "Founder / Quality", evidence: "Complete evidence pack, open-item review, traceability and release checklist", output: "GO / HOLD / REWORK / REJECT decision" },
  { id: "EPR-12", title: "Phase 6A closure", owner: "Founder", evidence: "All critical evidence closed or formally dispositioned; design-freeze prerequisites identified", output: "Controlled handoff to deployment/design-freeze readiness" },
];

const CORRECTIONS = [
  ["VINDY-01", "VINDY identity", "VINDY is the controlled product/identity layer requested for Phase 6A; company identity remains Vāyú Shastr Pvt Ltd."],
  ["VAYU-01", "Vāyú mark", "Use the Vāyú Shastr logo on the execution surface and controlled Phase 6A materials."],
  ["ENG-01", "VEDM authority", "VEDM-301 Rev 5.3.8 is the current controlled engineering authority. Older geometry is historical/superseded."],
  ["ENG-02", "Fork A-C", "Approximately 380 mm is the current development direction. The earlier ~378 mm value is treated as an indicated clearance correction, not a locked production dimension. Fork offset/trail remain unvalidated."],
  ["ENG-03", "Tyre envelope", "35 mm is the controlled baseline/target. 700×40 is a development target requiring CAD/physical verification."],
  ["ENG-04", "T47i", "T47i, 85.5 mm shell width is the current configuration. The historical 68 mm value must not return to release records."],
  ["ENG-05", "Carbon", "T700/T800 mixed carbon is the planned platform. Final laminate schedule remains controlled engineering IP."],
  ["ENG-06", "Wall thickness", "2.5 mm is a working baseline only; laminate/FEA evidence must confirm structural adequacy."],
  ["ENG-07", "Frame weight", "850–950 g painted is the Medium target; prototype weighing and structural evidence remain required."],
  ["ENG-08", "VAEA / VEDM-503", "DT 3.5:1 truncated Kammtail/KVF, TT 3.2:1 flattened aero ellipse with VTS™ intent, ST 3.0:1 KVF are working design-language baselines."],
];

const STAGE_LINKS = [
  ["04", "Sales & Revenue", "/command/phase-4", "Plan → orders → revenue → receivables → collections → cash"],
  ["05", "Engineering + Tooling + Quality", "/command/phase-5", "ECR → supplier → tooling → QC → ISO path"],
  ["06", "Pilot Production", "/command/phase-6", "Controlled build and pilot release gates"],
  ["06A", "EPR Execution", "/command/phase-6a", "Execute → evidence → deviation → validation → release"],
  ["DR", "Deployment Readiness", "/command/deployment-readiness", "Final evidence and design-freeze readiness"],
];

function statusTone(status: string) {
  if (status === "Passed") return "ok" as const;
  if (status === "Blocked") return "danger" as const;
  if (status === "In progress") return "warn" as const;
  return undefined;
}

function Phase6A() {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const relevant = useMemo(() => ALL_KNOWLEDGE.filter((r) => ["engineering", "product", "quality", "manufacturing", "finance", "funding", "legal"].includes(r.domain)), []);
  const counts = GATES.reduce((s, g) => { const v = statuses[g.id] ?? "Planned"; s[v] = (s[v] ?? 0) + 1; return s; }, {} as Record<string, number>);
  const blocking = GATES.filter((g) => statuses[g.id] === "Blocked").length;
  const passed = GATES.filter((g) => statuses[g.id] === "Passed").length;
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Vāyú Shastr · VINDY · VéLOXIS</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Phase 6A · EPR Master Execution Control</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Recovered as the execution layer that ties the Phase 4 commercial plan and Phase 5 engineering/tooling prerequisites into Phase 6 pilot production, evidence control and final release readiness.</p>
        </div>
        <img src="/brand/vayu-logo.svg" alt="Vāyú Shastr" className="h-16 w-auto" />
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="EPR gates" value={String(GATES.length)} hint={`${passed} passed`} /><Kpi label="Planned" value={String(counts["Planned"] ?? 0)} /><Kpi label="In progress" value={String(counts["In progress"] ?? 0)} tone="warn" /><Kpi label="Blocked" value={String(blocking)} tone={blocking ? "danger" : "ok"} /><Kpi label="Evidence rule" value="No evidence" hint="No release" tone="danger" /></div>

    <Panel title="Recovered Phase 4 → Phase 6A chain" kicker="Do not skip upstream gates"><div className="grid gap-2 md:grid-cols-5">{STAGE_LINKS.map(([n,title,to,note])=><Link key={n} to={to as any} className="rounded-xl border border-border bg-bg-elevated/40 p-4 hover:border-accent"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{n}</span><p className="mt-2 text-sm font-semibold text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{note}</p></Link>)}</div></Panel>

    <Panel title="EPR execution register" kicker="Execute · Prove · Release">
      <div className="overflow-hidden rounded-xl border border-border"><div className="hidden grid-cols-[80px_220px_180px_1fr_1fr_150px] gap-3 border-b border-border bg-bg-elevated/50 p-3 text-[10px] uppercase tracking-[0.12em] text-subtle md:grid"><span>ID</span><span>Gate</span><span>Owner</span><span>Evidence required</span><span>Output</span><span>Status</span></div>{GATES.map((g)=><div key={g.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[80px_220px_180px_1fr_1fr_150px] md:items-start"><span className="text-xs font-semibold text-accent">{g.id}</span><span className="text-sm font-medium text-fg">{g.title}</span><span className="text-xs leading-5 text-muted">{g.owner}</span><span className="text-xs leading-5 text-muted">{g.evidence}</span><span className="text-xs leading-5 text-muted">{g.output}</span><select value={statuses[g.id] ?? "Planned"} onChange={(e)=>setStatuses({...statuses,[g.id]:e.target.value})} className={`rounded-md border border-border bg-bg px-2 py-2 text-xs ${statusTone(statuses[g.id] ?? "Planned") === "danger" ? "text-red-300" : "text-fg"}`}><option>Planned</option><option>In progress</option><option>Blocked</option><option>Passed</option></select></div>)}</div>
    </Panel>

    <Panel title="VINDY · Vāyú · VéLOXIS controlled correction register" kicker="Engineering authority / identity discipline"><div className="overflow-hidden rounded-xl border border-border">{CORRECTIONS.map(([id,title,detail])=><div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_190px_1fr]"><span className="text-xs font-semibold text-accent">{id}</span><span className="text-sm font-medium text-fg">{title}</span><span className="text-sm leading-6 text-muted">{detail}</span></div>)}</div></Panel>

    <Panel title="Master Execution Package · 45-point register" kicker={`${relevant.length} records across engineering, product, quality, manufacturing, finance, funding and legal`}>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="px-2 py-3">Domain</th><th className="px-2 py-3">Control</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Owner</th><th className="px-2 py-3">Evidence / review</th></tr></thead><tbody>{relevant.map((r: KnowledgeRecord)=><tr key={r.id} className="border-t border-border/70 align-top"><td className="px-2 py-3 text-accent">{r.domain}</td><td className="px-2 py-3 font-medium text-fg">{r.title}<span className="mt-1 block font-normal leading-5 text-muted">{r.value}</span></td><td className="px-2 py-3 whitespace-nowrap">{r.status}</td><td className="px-2 py-3 text-muted">{r.owner}</td><td className="px-2 py-3 text-muted">{r.review}<span className="mt-1 block text-[10px] text-subtle">Source: {r.source}</span></td></tr>)}</tbody></table></div>
    </Panel>

    <div className="grid gap-4 md:grid-cols-3"><Panel title="INPUT" kicker="Controlled only"><p className="text-sm leading-6 text-muted">Approved engineering baseline, drawings/CAD, BOM/configuration, supplier/tooling records, process instructions, inspection criteria, financial assumptions and applicable test requirements.</p></Panel><Panel title="EVIDENCE" kicker="No evidence · no release"><p className="text-sm leading-6 text-muted">Every pilot decision must point to objective evidence. Planned, in-progress, blocked and passed remain separate states. Founder-only controls stay identified rather than silently exposed as facts.</p></Panel><Panel title="OUTPUT" kicker="Controlled disposition"><p className="text-sm leading-6 text-muted">GO, HOLD, REWORK or REJECT with traceability into ECR, BOM, inventory, cash, quality, validation and deployment readiness.</p></Panel></div>

    <Panel title="Phase 6A closure rule" kicker="Evidence-gated"><div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm leading-6 text-muted"><strong className="text-fg">No automatic release:</strong> a gate marked Passed here is only a working execution status. Final validation/release still requires the corresponding evidence record. Any critical unresolved item keeps the configuration on HOLD.</div></Panel>
  </div>;
}
