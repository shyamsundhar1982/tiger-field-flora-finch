import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs } from "@/lib/finance/model";
import { accountingTotals, buildAccountingModel } from "@/lib/finance/accounting";
import { boardSummary, buildBoardKpis, DEFAULT_BOARD_RISKS, type BoardStatus, type BoardRisk } from "@/lib/finance/board-engine";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/board-control")({ component: BoardControl });
const money = (n: number) => `₹${n.toFixed(1)}L`;
const statusTone: Record<BoardStatus, string> = { ahead: "text-ok", "on-track": "text-ok", watch: "text-warn", critical: "text-danger" };

function BoardControl() {
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const people = finance.peopleOpex?.people ?? [];
  const [risks, setRisks] = useState<BoardRisk[]>(DEFAULT_BOARD_RISKS);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const planRows = useMemo(() => buildModelWithInputs("base", drawStandby, finance), [drawStandby, finance]);
  const acc = useMemo(() => buildAccountingModel(rows, accounting), [rows, accounting]);
  const planAcc = useMemo(() => buildAccountingModel(planRows, accounting), [planRows, accounting]);
  const t = accountingTotals(acc);
  const summary = boardSummary(acc, planAcc);
  const kpis = buildBoardKpis(acc, planAcc, people.length ? [{ headcount: people.length } as never] : []);
  const openRisks = risks.filter((r) => r.status !== "closed").length;
  const critical = kpis.filter((k) => k.status === "critical").length;
  const decisionStatus = critical ? "Decision required" : openRisks >= 3 ? "Watch list" : "On track";

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Phase 8 · Board / Investor Control</p><h1 className="font-display text-4xl">Board Control</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A live management view built from the same finance, accounting, people and operating assumptions. The board view shows signal, variance, cash and decisions—not a second spreadsheet.</p></div>
      <div className="flex gap-2"><Link to="/command/investor-board" className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-fg">Investor / Board register →</Link><Link to="/command/financial-cockpit" className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-fg">Financial cockpit →</Link></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Board status" value={decisionStatus} hint={`${critical} critical KPI${critical === 1 ? "" : "s"}`} tone={critical ? "danger" : openRisks >= 3 ? "warn" : "ok"}/><Kpi label="Cash trough" value={money(summary.cashTrough)} hint={`M${summary.cashTroughMonth}`}/><Kpi label="Runway" value={`${summary.runway} mo`} hint="Accounting cash" tone={summary.runway >= 12 ? "ok" : summary.runway >= 6 ? "warn" : "danger"}/><Kpi label="Funding modeled" value={money(summary.funding)} hint="Equity + debt + grants"/></div>

    <Panel title="Board scorecard" kicker="Current scenario vs base plan · M36"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><th className="px-2 py-3">KPI</th><th>Current</th><th>Base plan</th><th>Variance</th><th>Status</th></tr></thead><tbody>{kpis.map((k) => <tr key={k.label} className="border-b border-border last:border-0"><td className="px-2 py-3 font-medium">{k.label}</td><td className="py-3 tabular-nums">{k.label.includes("margin") ? `${k.value.toFixed(1)}%` : k.label.includes("Headcount") ? k.value.toFixed(0) : money(k.value)}</td><td className="py-3 tabular-nums">{k.label.includes("margin") ? `${k.plan.toFixed(1)}%` : k.label.includes("Headcount") ? k.plan.toFixed(0) : money(k.plan)}</td><td className={`py-3 tabular-nums ${k.variancePct >= 0 ? "text-ok" : "text-warn"}`}>{k.variancePct.toFixed(1)}%</td><td className={`py-3 font-medium ${statusTone[k.status]}`}>{k.status}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted">Every KPI is compared with the controlled base plan. Definitions should remain stable between board cycles.</p></Panel>

    <div className="grid gap-4 lg:grid-cols-3"><Panel title="Financial state" kicker="Accounting layer"><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted">Revenue</span><span className="tabular-nums">{money(t.revenue)}</span></div><div className="flex justify-between"><span className="text-muted">Gross profit</span><span className="tabular-nums">{money(t.grossProfit)}</span></div><div className="flex justify-between"><span className="text-muted">EBITDA</span><span className="tabular-nums">{money(t.ebitda)}</span></div><div className="flex justify-between"><span className="text-muted">Closing cash</span><span className="tabular-nums">{money(acc.at(-1)?.closingCash ?? 0)}</span></div><div className="flex justify-between"><span className="text-muted">Plan cash trough</span><span className="tabular-nums">{money(summary.planCashTrough)}</span></div></div></Panel><Panel title="Capital & runway" kicker="Decision context"><p className="text-sm text-muted">Current scenario <span className="text-fg">{scenario}</span> reaches its lowest accounting cash at M{summary.cashTroughMonth}.</p><p className="mt-3 font-display text-2xl">{money(summary.cashTrough)}</p><p className="mt-1 text-xs text-muted">Base plan trough: {money(summary.planCashTrough)} · first EBITDA-positive month: {summary.breakEven ? `M${summary.breakEven}` : "not reached"}</p><Link to="/command/funding" className="mt-4 inline-block text-sm text-accent">Open funding control →</Link></Panel><Panel title="People & organisation" kicker="Operating capacity"><p className="text-sm text-muted">Headcount is linked to the People & Opex plan and flows into the financial model.</p><p className="mt-3 font-display text-2xl">{people.length}</p><p className="text-xs text-muted">planned roles at M36</p><Link to="/command/people-opex" className="mt-4 inline-block text-sm text-accent">Open people & opex →</Link></Panel></div>

    <Panel title="Board decisions & risks" kicker="Keep the meeting focused on action"><div className="grid gap-3 md:grid-cols-2">{risks.map((risk) => <div key={risk.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-subtle">{risk.id} · {risk.impact}</p><p className="mt-1 text-sm font-medium">{risk.title}</p></div><select value={risk.status} onChange={(e) => setRisks((items) => items.map((r) => r.id === risk.id ? { ...r, status: e.target.value as BoardRisk["status"] } : r))} className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg"><option value="open">Open</option><option value="mitigating">Mitigating</option><option value="closed">Closed</option></select></div><p className="mt-3 text-xs text-muted">Owner: {risk.owner}</p></div>)}</div></Panel>

    <Panel title="Board meeting agenda" kicker="Decision-oriented, not data-dump"><div className="grid gap-3 md:grid-cols-5">{[["01","State", "What changed vs plan?"],["02","Cash", "How long can we fund the plan?"],["03","Execution", "Are production and sales converting?"],["04","Risk", "What can materially change the forecast?"],["05","Ask", "What decision or help is required?"]].map(([n,l,v]) => <div key={n} className="rounded-lg border border-border p-3"><span className="text-[10px] text-accent">{n}</span><p className="mt-2 text-xs uppercase tracking-wider text-subtle">{l}</p><p className="mt-1 text-sm text-muted">{v}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-3 text-sm"><Link to="/command/balance-sheet" className="text-accent">Financial statements →</Link><Link to="/command/tax-compliance" className="text-accent">Tax & compliance →</Link><Link to="/command/sales" className="text-accent">Sales →</Link><Link to="/command/operations" className="text-accent">Operations →</Link><Link to="/command/quality" className="text-accent">Quality →</Link></div></Panel>

    <div className="rounded-xl border border-border bg-surface p-4 text-xs leading-5 text-muted"><span className="text-fg">Board control principle:</span> show a small, stable KPI set with trend/variance and tie every material movement to a decision. This follows current board-reporting practice: focused KPIs, cash/runway, risks and explicit asks rather than a data dump. citeturn0search0turn0search2</div>
  </div>;
}
