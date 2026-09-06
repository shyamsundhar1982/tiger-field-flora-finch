import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { FOUNDER_ACTIONS, FOUNDER_GATES, FOUNDER_STATUS_LABELS } from "@/lib/data/founder-command";
import { buildModelWithInputs, totals } from "@/lib/finance/model";
import { accountingTotals, buildAccountingModel } from "@/lib/finance/accounting";
import { listFounderEvidence, recordFounderEvidence } from "@/lib/founder-evidence";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/founder-command")({ component: FounderCommand });

const money = (n: number, digits = 1) => `₹${n.toFixed(digits)}L`;

type EvidenceRow = {
  id: string;
  action_id: string;
  evidence_type: string;
  evidence_ref: string | null;
  note: string;
  actor_role: string;
  created_at: string;
};

function FounderCommand() {
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const accountingRows = useMemo(() => buildAccountingModel(rows, accounting), [rows, accounting]);
  const at = accountingTotals(accountingRows);
  const t = totals(rows);
  const trough = accountingRows.reduce((min, row) => (row.closingCash < min.closingCash ? row : min), accountingRows[0]);
  const breakEven = accountingRows.find((row) => row.ebitda >= 0)?.m ?? null;
  const cashFloor = 15;
  const health = trough.closingCash < 0 ? "FUNDING GAP" : trough.closingCash < cashFloor ? "WATCH" : "SAFE";
  const blocked = FOUNDER_ACTIONS.filter((a) => a.status === "blocked").length;
  const next = FOUNDER_ACTIONS.filter((a) => a.status === "next").length;
  const active = FOUNDER_ACTIONS.filter((a) => a.status === "active").length;
  const waiting = FOUNDER_ACTIONS.filter((a) => a.status === "waiting").length;
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [selectedAction, setSelectedAction] = useState(FOUNDER_ACTIONS[0]?.id ?? "FC-01");
  const [evidenceType, setEvidenceType] = useState("document");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [note, setNote] = useState("");
  const [evidenceState, setEvidenceState] = useState("Loading evidence ledger…");

  const evidenceByAction = useMemo(() => new Set(evidence.map((item) => item.action_id)), [evidence]);

  useEffect(() => {
    let mounted = true;
    listFounderEvidence()
      .then((items) => {
        if (mounted) {
          setEvidence(items as EvidenceRow[]);
          setEvidenceState(`${items.length} evidence record${items.length === 1 ? "" : "s"} loaded`);
        }
      })
      .catch(() => mounted && setEvidenceState("Evidence ledger unavailable — no completion is assumed."));
    return () => {
      mounted = false;
    };
  }, []);

  const alerts = [
    ...(health !== "SAFE" ? [{ tone: "danger", title: `Cash guardrail: ${health}`, detail: `Modeled trough ${money(trough.closingCash)} in M${trough.m}; management floor is ${money(cashFloor)}.`, to: "/command/cash" }] : []),
    ...(blocked > 0 ? [{ tone: "warn", title: `${blocked} execution blocker${blocked > 1 ? "s" : ""}`, detail: "Engineering and dependency gates require evidence before downstream work advances.", to: "/command/governance" }] : []),
    ...(breakEven === null ? [{ tone: "warn", title: "Break-even not reached", detail: "Current operating model does not reach EBITDA break-even within 36 months.", to: "/command/scenarios" }] : []),
    { tone: "ok", title: `${active} active founder action${active !== 1 ? "s" : ""}`, detail: `${next} next actions and ${waiting} gated actions are in the controlled queue.`, to: "/command/actions" },
  ];

  const submitEvidence = async () => {
    if (note.trim().length < 3) {
      setEvidenceState("Add a short evidence note before recording.");
      return;
    }
    setEvidenceState("Recording evidence…");
    try {
      await recordFounderEvidence({ data: { actionId: selectedAction, evidenceType: evidenceType as "document" | "decision" | "measurement" | "quotation" | "test" | "link" | "note", evidenceRef: evidenceRef.trim() || undefined, note: note.trim() } });
      const latest = await listFounderEvidence();
      setEvidence(latest as EvidenceRow[]);
      setNote("");
      setEvidenceRef("");
      setEvidenceState("Evidence recorded and linked to the action.");
    } catch (error) {
      setEvidenceState(error instanceof Error ? error.message : "Evidence could not be recorded.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Phase I · Live operating system</p>
          <h1 className="font-display text-4xl">Founder Command Centre</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">One operating view for the founder: live financial health, execution blockers, accountable actions, decision gates and the next intervention.</p>
        </div>
        <div className="flex gap-3 text-sm"><Link to="/command/financial-cockpit" className="text-accent hover:text-fg">Financial cockpit →</Link><Link to="/command/governance" className="text-accent hover:text-fg">Governance →</Link></div>
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[10px] uppercase tracking-[0.18em] text-subtle">Founder operating health</p><div className="mt-1 flex items-baseline gap-3"><h2 className="font-display text-3xl">{health}</h2><span className="text-xs text-muted">{scenario} plan · live model</span></div><p className="mt-2 max-w-2xl text-xs leading-5 text-muted">This layer turns the existing Finance, Governance and Founder queues into an intervention screen. It does not silently advance gates or claim evidence that has not been recorded.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Kpi label="Cash trough" value={money(trough.closingCash)} hint={`M${trough.m}`} tone={health === "SAFE" ? "ok" : health === "WATCH" ? "warn" : "danger"}/><Kpi label="Funding" value={money(at.financingCashFlow)} hint="Modeled inflow"/><Kpi label="Revenue" value={money(at.revenue)} hint="36M"/><Kpi label="Break-even" value={breakEven ? `M${breakEven}` : "Not reached"} hint="EBITDA ≥ 0" tone={breakEven ? "ok" : "warn"}/></div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Actions</p><p className="mt-1 text-2xl tabular-nums">{FOUNDER_ACTIONS.length}</p></div><div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Blocked</p><p className="mt-1 text-2xl tabular-nums">{blocked}</p></div><div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Next</p><p className="mt-1 text-2xl tabular-nums">{next}</p></div><div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Active</p><p className="mt-1 text-2xl tabular-nums">{active}</p></div></div>

      <Panel title="Intervention queue" kicker="Live rules · model + execution state"><div className="grid gap-3 lg:grid-cols-2">{alerts.map((alert, index) => <Link key={`${alert.title}-${index}`} to={alert.to as never} className="rounded-lg border border-border bg-surface p-4 transition hover:border-accent"><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.tone === "danger" ? "bg-danger" : alert.tone === "warn" ? "bg-warn" : "bg-ok"}`} /><div><p className="font-medium text-fg">{alert.title}</p><p className="mt-1 text-xs leading-5 text-muted">{alert.detail}</p><p className="mt-2 text-xs text-accent">Open control →</p></div></div></Link>)}</div></Panel>

      <Panel title="Command gates" kicker="Owner → evidence → decision"><div className="space-y-2">{FOUNDER_GATES.map((g) => <div key={g.gate} className="flex flex-wrap items-baseline gap-3 border-t border-border py-3 text-sm"><span className="w-8 text-accent">{g.gate}</span><span className="w-24 text-muted">{g.when}</span><span className="flex-1 font-medium">{g.title}</span><span className="text-xs text-muted">{g.controls.join(" · ")}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/governance" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Governance control plane</Link><Link to="/command/qa-verification" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">QA evidence</Link><Link to="/command/ca-audit" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">CA audit</Link></div></Panel>

      <Panel title="Founder action queue" kicker="Execution control"><div className="overflow-x-auto"><table className="w-full min-w-[65rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Priority</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Evidence</th><th className="py-2 pr-3">Outcome</th><th className="py-2">Dependency</th></tr></thead><tbody>{FOUNDER_ACTIONS.map((a) => <tr key={a.id} className="border-t border-border align-top"><td className="py-3 pr-3 text-accent">{a.id}</td><td className="py-3 pr-3 uppercase text-[10px] tracking-wider">{a.priority}</td><td className="py-3 pr-3 font-medium">{a.title}</td><td className="py-3 pr-3 whitespace-nowrap">{FOUNDER_STATUS_LABELS[a.status]}</td><td className="py-3 pr-3 whitespace-nowrap text-muted">{a.stage}</td><td className="py-3 pr-3 whitespace-nowrap text-muted">{a.owner}</td><td className="py-3 pr-3 whitespace-nowrap text-xs">{evidenceByAction.has(a.id) ? <span className="text-ok">Evidence linked</span> : <span className="text-subtle">No evidence</span>}</td><td className="py-3 pr-3 text-muted">{a.outcome}</td><td className="py-3 text-muted">{a.dependency ?? "—"}</td></tr>)}</tbody></table></div></Panel>

      <Panel title="Evidence control" kicker="Durable action evidence · role checked"><div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]"><div className="space-y-3"><label className="block text-xs text-muted">Action<select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">{FOUNDER_ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.title}</option>)}</select></label><label className="block text-xs text-muted">Evidence type<select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"><option value="document">Document</option><option value="decision">Decision</option><option value="measurement">Measurement</option><option value="quotation">Quotation</option><option value="test">Test</option><option value="link">Link</option><option value="note">Note</option></select></label><label className="block text-xs text-muted">Evidence reference<input value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} placeholder="Document ID, URL, test report, quotation…" className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" /></label><label className="block text-xs text-muted">Evidence note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was established, measured, approved or received?" rows={4} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" /></label><button type="button" onClick={submitEvidence} className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10">Record evidence</button><p className="text-xs text-muted">{evidenceState}</p></div><div className="rounded-lg border border-border bg-surface p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium">Recent evidence</p><span className="text-[10px] uppercase tracking-wider text-subtle">Last 100</span></div><div className="mt-3 max-h-80 space-y-2 overflow-auto">{evidence.length === 0 ? <p className="text-xs text-muted">No evidence records yet. That is a valid state.</p> : evidence.slice(0, 12).map((item) => <div key={item.id} className="rounded-md border border-border p-3"><div className="flex justify-between gap-3 text-xs"><span className="text-accent">{item.action_id}</span><span className="text-subtle">{item.actor_role}</span></div><p className="mt-1 text-xs font-medium">{item.evidence_type}</p><p className="mt-1 text-xs leading-5 text-muted">{item.note}</p>{item.evidence_ref && <p className="mt-1 truncate text-[11px] text-subtle">Ref: {item.evidence_ref}</p>}<p className="mt-1 text-[10px] text-subtle">{new Date(item.created_at).toLocaleString()}</p></div>)}</div></div></div></Panel>

      <div className="grid gap-4 lg:grid-cols-3"><Panel title="Live operating links" kicker="Change once, see the impact"><Link className="block rounded-lg border border-border p-3 text-sm hover:border-accent" to="/command/financial-cockpit">Financial Cockpit · cash + inventory + production + sales + funding</Link><Link className="mt-2 block rounded-lg border border-border p-3 text-sm hover:border-accent" to="/command/production">Production · manufacturing + inventory execution</Link><Link className="mt-2 block rounded-lg border border-border p-3 text-sm hover:border-accent" to="/command/sales">Sales · revenue and sell-through</Link></Panel><Panel title="Capital control" kicker="Liquidity decision"><p className="text-sm text-muted">Planned funding <span className="text-fg">{money(at.financingCashFlow)}</span> supports liquidity but does not improve operating margin.</p><p className="mt-3 text-xs text-muted">Cash trough: {money(trough.closingCash)} · Scenario: {scenario}</p><Link to="/command/funding" className="mt-4 inline-block text-sm text-accent hover:text-fg">Open funding control →</Link></Panel><Panel title="Operating truth" kicker="No automatic completion"><p className="text-sm text-muted">A milestone is only complete when the relevant evidence and approval exist. The command centre surfaces risk; it does not manufacture evidence.</p><Link to="/command/actions" className="mt-4 inline-block text-sm text-accent hover:text-fg">Open action log →</Link></Panel></div>

      <Panel title="Operating rule"><p className="text-sm text-muted">Founder Command is the intervention layer. Financial Cockpit owns the detailed model, Governance owns decision approvals, and the domain pages own execution evidence. This separation keeps the live operating system traceable.</p><p className="mt-2 text-xs text-subtle">Model basis: {t.units} planned units across the active 36-month scenario.</p></Panel>
    </div>
  );
}
