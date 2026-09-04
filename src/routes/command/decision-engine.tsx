import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildDecisionResult, DECISION_SCENARIOS, DEFAULT_DECISION_OVERRIDES, decisionRecommendation, decisionStatus, sensitivity, type DecisionOverrides, type DecisionScenarioId } from "@/lib/finance/decision-engine";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/decision-engine")({ component: DecisionEngine });
const money = (n: number) => `₹${n.toFixed(1)}L`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const fields: { key: keyof DecisionOverrides; label: string; min: number; max: number; step: number }[] = [
  { key: "aspPct", label: "ASP", min: -30, max: 30, step: 1 },
  { key: "cogsPct", label: "COGS", min: -30, max: 40, step: 1 },
  { key: "unitPct", label: "Units", min: -50, max: 50, step: 1 },
  { key: "launchShift", label: "Launch shift (months)", min: -6, max: 12, step: 1 },
  { key: "opexPct", label: "Opex", min: -20, max: 40, step: 1 },
  { key: "collectionDaysDelta", label: "Collection days", min: -30, max: 60, step: 1 },
  { key: "supplierDaysDelta", label: "Supplier days", min: -30, max: 60, step: 1 },
  { key: "aluminiumVolumePct", label: "Aluminium volume", min: -50, max: 100, step: 1 },
];

function DecisionEngine() {
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const [selected, setSelected] = useState<DecisionScenarioId>("base");
  const [custom, setCustom] = useState<DecisionOverrides>(DEFAULT_DECISION_OVERRIDES.base);
  const scenarios = useMemo(() => DECISION_SCENARIOS.map((s) => buildDecisionResult(s, finance, accounting, drawStandby)), [finance, accounting, drawStandby]);
  const base = scenarios[0];
  const customScenario = useMemo(() => buildDecisionResult({ id: "custom", label: "Custom", description: "Your decision assumptions.", overrides: custom }, finance, accounting, drawStandby), [custom, finance, accounting, drawStandby]);
  const active = selected === "custom" ? customScenario : scenarios.find((s) => s.scenario.id === selected) ?? base;
  const status = decisionStatus(active, base);
  const sens = useMemo(() => sensitivity(finance, accounting, drawStandby, "aspPct"), [finance, accounting, drawStandby]);
  const update = (key: keyof DecisionOverrides, value: number) => setCustom((v) => ({ ...v, [key]: value }));

  return <div className="space-y-6">
    <header><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Phase 9 · Scenario / Decision Engine</p><h1 className="font-display text-4xl">Decision Cockpit</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Change a controlled assumption once and see the effect propagate through units, revenue, COGS, Opex, working capital, cash, runway and funding.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Decision status" value={status} hint={decisionRecommendation(active, base)} tone={status === "proceed" ? "ok" : status === "watch" ? "warn" : "danger"}/><Kpi label="Cash trough" value={money(active.cashTrough)} hint={`M${active.cashTroughMonth}`} tone={active.cashTrough >= base.cashTrough ? "ok" : "warn"}/><Kpi label="Runway" value={`${active.runway.toFixed(1)} mo`} hint="Management model" tone={active.runway >= 12 ? "ok" : active.runway >= 6 ? "warn" : "danger"}/><Kpi label="Funding" value={money(active.funding)} hint={`${pct(active.funding - base.funding)} vs base`}/></div>
    <Panel title="Scenario selector" kicker="Base · Upside · Downside · Stress · Custom"><div className="flex flex-wrap gap-2">{[...DECISION_SCENARIOS.map((s) => s.id), "custom" as DecisionScenarioId].map((id) => { const label = id === "custom" ? "Custom" : DECISION_SCENARIOS.find((s) => s.id === id)?.label ?? id; return <button key={id} type="button" onClick={() => setSelected(id)} className={`rounded-md border px-4 py-2 text-sm ${selected === id ? "border-accent bg-surface text-fg" : "border-border text-muted hover:text-fg"}`}>{label}</button> })}</div><p className="mt-3 text-sm text-muted">{active.scenario.description}</p></Panel>
    <Panel title="What-if controls" kicker="Custom scenario · all values are relative to the approved plan"><div className="grid gap-4 md:grid-cols-2">{fields.map((f) => <label key={f.key} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3 text-sm"><span>{f.label}</span><span className="tabular-nums text-accent">{f.key === "launchShift" ? `${custom[f.key] > 0 ? "+" : ""}${custom[f.key]} mo` : pct(custom[f.key])}</span></div><input type="range" min={f.min} max={f.max} step={f.step} value={custom[f.key]} onChange={(e) => update(f.key, Number(e.target.value))} className="mt-3 w-full"/><div className="mt-1 flex justify-between text-[10px] text-subtle"><span>{f.min}{f.key === "launchShift" ? " mo" : "%"}</span><span>{f.max}{f.key === "launchShift" ? " mo" : "%"}</span></div></label>)}</div></Panel>
    <Panel title="Scenario comparison" kicker="36-month financial outcome"><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead><tr className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><th className="px-2 py-3">Scenario</th><th>Revenue</th><th>Gross profit</th><th>EBITDA</th><th>Cash trough</th><th>Runway</th><th>Funding</th><th>Break-even</th></tr></thead><tbody>{[...scenarios, customScenario].map((r) => <tr key={r.scenario.id} className={`border-b border-border last:border-0 ${r.scenario.id === active.scenario.id ? "bg-surface" : ""}`}><td className="px-2 py-3 font-medium">{r.scenario.label}</td><td>{money(r.revenue)}</td><td>{money(r.grossProfit)}</td><td>{money(r.ebitda)}</td><td>{money(r.cashTrough)} <span className="text-xs text-muted">M{r.cashTroughMonth}</span></td><td>{r.runway.toFixed(1)} mo</td><td>{money(r.funding)}</td><td>{r.breakEvenMonth ? `M${r.breakEvenMonth}` : "—"}</td></tr>)}</tbody></table></div></Panel>
    <div className="grid gap-4 lg:grid-cols-2"><Panel title="Decision answer" kicker="What should management do?"><p className="text-sm leading-6">{decisionRecommendation(active, base)}</p><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted">Revenue vs base</span><span>{money(active.revenue - base.revenue)}</span></div><div className="flex justify-between"><span className="text-muted">Cash trough vs base</span><span>{money(active.cashTrough - base.cashTrough)}</span></div><div className="flex justify-between"><span className="text-muted">Funding change</span><span>{money(active.funding - base.funding)}</span></div><div className="flex justify-between"><span className="text-muted">Runway change</span><span>{(active.runway - base.runway).toFixed(1)} mo</span></div></div></Panel><Panel title="Sensitivity: ASP" kicker="Same engine, one variable at a time"><div className="space-y-2">{sens.map((r) => <div key={r.scenario.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"><span>ASP {r.scenario.label}</span><span>{money(r.cashTrough)} cash trough · {r.runway.toFixed(1)} mo runway</span></div>)}</div></Panel></div>
    <Panel title="The five questions" kicker="Founder / board decision loop"><div className="grid gap-3 md:grid-cols-5">{[["01","Where is our money?","Cash + working capital"],["02","Where is it going?","COGS + Opex + capex"],["03","What are we getting back?","Revenue + gross profit"],["04","When do we run out?","Cash trough + runway"],["05","What changes if we act?","Scenario impact + decision"]].map(([n,q,a]) => <div key={n} className="rounded-lg border border-border p-3"><span className="text-[10px] text-accent">{n}</span><p className="mt-2 text-sm font-medium">{q}</p><p className="mt-1 text-xs text-muted">{a}</p></div>)}</div></Panel>
    <div className="rounded-xl border border-border bg-surface p-4 text-xs leading-5 text-muted"><span className="text-fg">Decision engine:</span> this is a management planning and sensitivity layer. It does not replace accounting, tax, statutory or CA review.</div>
  </div>;
}
