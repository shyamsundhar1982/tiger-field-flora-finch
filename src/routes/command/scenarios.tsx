import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, Banknote, Boxes, Gauge, GitCompareArrows, Play, RefreshCcw, ShieldCheck, Sparkles, TimerReset, TrendingUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel } from "@/components/kpi";
import { VIBPE_COPILOT_NAME } from "@/lib/ibpe-brand";
import { runIbpeScenario, type IbpeScenarioPacket, type IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";

export const Route = createFileRoute("/command/scenarios")({ component: ScenarioStudio });

const money = (value: number) => `₹${value.toFixed(1)}L`;
const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}₹${Math.abs(value).toFixed(1)}L`;
const signed = (value: number, digits = 0) => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

const DEFAULT_SCENARIO: IbpeScenarioRequest = {
  id: "custom",
  label: "Custom scenario",
  demandMultiplier: 1,
  capacityMultiplier: 1,
  procurementCostMultiplier: 1,
  leadTimeMultiplier: 1,
  receiptDelayMonths: 0,
  cashInjectionLakh: 0,
  cashInjectionPeriod: 6,
};

const PRESETS: Array<{ label: string; note: string; scenario: Partial<IbpeScenarioRequest> }> = [
  { label: "Growth +25%", note: "Demand acceleration", scenario: { demandMultiplier: 1.25 } },
  { label: "Supply shock", note: "Lead time +50%, receipts +2M", scenario: { leadTimeMultiplier: 1.5, receiptDelayMonths: 2, procurementCostMultiplier: 1.12 } },
  { label: "Capacity lift", note: "Add 30% productive capacity", scenario: { capacityMultiplier: 1.3 } },
  { label: "Cash protect", note: "Demand −15%, tighter buy profile", scenario: { demandMultiplier: 0.85, procurementCostMultiplier: 0.95 } },
  { label: "Funding bridge", note: "Inject ₹50L in M6", scenario: { cashInjectionLakh: 50, cashInjectionPeriod: 6 } },
  { label: "Severe stress", note: "Demand −35%, cost +20%, delay +3M", scenario: { demandMultiplier: 0.65, procurementCostMultiplier: 1.2, leadTimeMultiplier: 1.6, receiptDelayMonths: 3, capacityMultiplier: 0.85 } },
];

function SliderField({ label, value, min, max, step, suffix, onChange, icon: Icon }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
  icon: typeof Activity;
}) {
  return <label className="block rounded-xl border border-border bg-surface/30 p-4">
    <span className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-medium text-fg"><Icon className="size-4 text-accent" />{label}</span>
      <span className="font-display text-lg font-semibold tabular-nums text-fg">{suffix === "%" ? `${Math.round(value * 100)}%` : `${value}${suffix}`}</span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-4 w-full accent-[var(--color-accent)]" />
    <span className="mt-2 flex justify-between text-[10px] text-subtle"><span>{suffix === "%" ? `${Math.round(min * 100)}%` : `${min}${suffix}`}</span><span>{suffix === "%" ? `${Math.round(max * 100)}%` : `${max}${suffix}`}</span></span>
  </label>;
}

function ScenarioStudio() {
  const [scenario, setScenario] = useState<IbpeScenarioRequest>(DEFAULT_SCENARIO);
  const [packet, setPacket] = useState<IbpeScenarioPacket | null>(null);
  const [history, setHistory] = useState<IbpeScenarioPacket[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patch(values: Partial<IbpeScenarioRequest>) {
    setScenario((current) => ({ ...current, ...values, id: current.id || "custom" }));
  }

  function preset(label: string, values: Partial<IbpeScenarioRequest>) {
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setScenario({ ...DEFAULT_SCENARIO, ...values, id, label });
  }

  async function run() {
    setBusy(true);
    setError("");
    try {
      const next = await runIbpeScenario({ data: scenario });
      setPacket(next);
      setHistory((current) => [next, ...current.filter((item) => item.scenario.id !== next.scenario.id)].slice(0, 5));
      window.dispatchEvent(new CustomEvent("vyndi:ibpe-scenario", { detail: next.scenario }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario execution failed.");
    } finally {
      setBusy(false);
    }
  }

  const chart = useMemo(() => {
    if (!packet) return [];
    const baseline = new Map(packet.baseline.cash.map((row) => [row.period, row]));
    return packet.result.cash.map((row) => ({
      month: `M${row.period}`,
      baseline: baseline.get(row.period)?.freeLiquidityAfterRecommendationsLakh ?? 0,
      scenario: row.freeLiquidityAfterRecommendationsLakh,
    }));
  }, [packet]);

  const scenarioRisks = useMemo(() => packet?.result.findings.slice(0, 8) ?? [], [packet]);
  const supply = useMemo(() => packet?.result.supply.filter((row) => row.committedFulfillmentShortageQty > 0 || row.recommendedPurchaseQty > 0).slice(0, 10) ?? [], [packet]);

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-border pb-6 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent/25 bg-accent/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">IBPE Scenario Studio</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/30 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted"><ShieldCheck className="size-3 text-green" /> Advisory · no transactions</span>
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-fg">Model the decision before committing it.</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Flex demand, capacity, supplier lead time, procurement cost, receipt timing and funding against the latest governed IBPE snapshot. Approved plan, actuals and contractual commitments remain untouched.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/command/planning" className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:border-accent/45 hover:text-fg">Master Plan</Link>
        <Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:border-accent/45 hover:text-fg">Approved assumptions</Link>
      </div>
    </header>

    <section>
      <div className="mb-3 flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green">Starting points</p><h2 className="mt-1 font-display text-xl font-semibold text-fg">Fast scenario presets</h2></div><button type="button" onClick={() => setScenario(DEFAULT_SCENARIO)} className="inline-flex items-center gap-2 text-sm text-accent hover:text-fg"><RefreshCcw className="size-4" />Reset</button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{PRESETS.map((item) => <button key={item.label} type="button" onClick={() => preset(item.label, item.scenario)} className="rounded-xl border border-border bg-surface/30 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/45 hover:bg-surface/60"><p className="font-medium text-fg">{item.label}</p><p className="mt-1 text-xs leading-5 text-muted">{item.note}</p></button>)}</div>
    </section>

    <div className="grid gap-6 2xl:grid-cols-[0.86fr_1.14fr]">
      <Panel title="Scenario drivers" kicker="Interactive what-if engine">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted">Scenario name</span><input value={scenario.label} maxLength={80} onChange={(event) => patch({ label: event.target.value, id: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64) || "custom" })} className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent/55" /></label>
          <button type="button" disabled={busy} onClick={() => void run()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-45"><Play className="size-4" />{busy ? "Running IBPE…" : "Run scenario"}</button>
        </div>
        {error ? <div className="mb-4 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">{error}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <SliderField label="Demand outlook" value={scenario.demandMultiplier ?? 1} min={0.25} max={2} step={0.05} suffix="%" onChange={(value) => patch({ demandMultiplier: value })} icon={TrendingUp} />
          <SliderField label="Available capacity" value={scenario.capacityMultiplier ?? 1} min={0.5} max={2} step={0.05} suffix="%" onChange={(value) => patch({ capacityMultiplier: value })} icon={Gauge} />
          <SliderField label="Procurement cost" value={scenario.procurementCostMultiplier ?? 1} min={0.6} max={1.8} step={0.05} suffix="%" onChange={(value) => patch({ procurementCostMultiplier: value })} icon={Banknote} />
          <SliderField label="Supplier lead time" value={scenario.leadTimeMultiplier ?? 1} min={0.5} max={2.5} step={0.05} suffix="%" onChange={(value) => patch({ leadTimeMultiplier: value })} icon={TimerReset} />
          <SliderField label="Receipt delay" value={scenario.receiptDelayMonths ?? 0} min={0} max={12} step={1} suffix="M" onChange={(value) => patch({ receiptDelayMonths: value })} icon={Boxes} />
          <label className="block rounded-xl border border-border bg-surface/30 p-4"><span className="flex items-center gap-2 text-sm font-medium text-fg"><Banknote className="size-4 text-accent" />Funding bridge</span><div className="mt-4 grid grid-cols-2 gap-2"><div><span className="mb-1 block text-[10px] uppercase tracking-wider text-subtle">₹ lakh</span><input type="number" min={0} max={10000} step={5} value={scenario.cashInjectionLakh ?? 0} onChange={(event) => patch({ cashInjectionLakh: Number(event.target.value) })} className="min-h-10 w-full rounded-lg border border-border bg-bg px-2 text-sm tabular-nums text-fg outline-none focus:border-accent/55" /></div><div><span className="mb-1 block text-[10px] uppercase tracking-wider text-subtle">Month</span><input type="number" min={1} max={36} value={scenario.cashInjectionPeriod ?? 1} onChange={(event) => patch({ cashInjectionPeriod: Number(event.target.value) })} className="min-h-10 w-full rounded-lg border border-border bg-bg px-2 text-sm tabular-nums text-fg outline-none focus:border-accent/55" /></div></div></label>
        </div>
        <p className="mt-4 text-xs leading-5 text-subtle">Scenario levers flex only analytical forecast assumptions. Actual quantities, confirmed demand, approved-plan values and transactional commitments are preserved in the scenario input.</p>
      </Panel>

      <Panel title={packet ? packet.scenario.label : "Run a scenario to see feasibility"} kicker="Decision packet">
        {!packet ? <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg/25 px-6 text-center"><Sparkles className="size-8 text-accent" /><p className="mt-4 max-w-md font-medium text-fg">The deterministic engine will compare your scenario against the latest governed IBPE run.</p><p className="mt-2 max-w-lg text-sm leading-6 text-muted">Outputs include cash/funding, procurement, shortages, capacity, findings and business-health deltas—with provenance back to the governed snapshot.</p></div> : <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi label="Health score" value={`${packet.result.summary.businessHealthScore}/100`} hint={`${signed(packet.comparison.healthScoreDelta)} vs baseline`} tone={packet.result.summary.businessHealthScore >= 75 ? "ok" : packet.result.summary.businessHealthScore >= 50 ? "warn" : "danger"} />
            <Kpi label="Expected units" value={packet.result.summary.expectedUnits.toFixed(0)} hint={`${signed(packet.comparison.expectedUnitsDelta)} units vs baseline`} />
            <Kpi label="Recommended procurement" value={money(packet.result.summary.totalRecommendedProcurementLakh)} hint={`${signedMoney(packet.comparison.procurementLakhDelta)} vs baseline`} tone={packet.comparison.procurementLakhDelta > 0 ? "warn" : "default"} />
            <Kpi label="Min free liquidity" value={money(packet.result.summary.minimumFreeLiquidityAfterRecommendationsLakh)} hint={`${signedMoney(packet.comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh)} vs baseline`} tone={packet.result.summary.minimumFreeLiquidityAfterRecommendationsLakh < 0 ? "danger" : packet.result.summary.minimumFreeLiquidityAfterRecommendationsLakh < 10 ? "warn" : "ok"} />
            <Kpi label="Incremental funding need" value={money(packet.result.funding.incrementalFundingNeedLakh)} hint={`${signedMoney(packet.comparison.fundingNeedDeltaLakh)} vs baseline`} tone={packet.result.funding.incrementalFundingNeedLakh > 0 ? "danger" : "ok"} />
            <Kpi label="Findings" value={String(packet.result.findings.length)} hint={`${signed(packet.comparison.findingDelta)} vs baseline`} tone={packet.result.summary.findingCounts.critical > 0 ? "danger" : packet.result.summary.findingCounts.high > 0 ? "warn" : "ok"} />
          </div>
          <div className="rounded-xl border border-border bg-bg/35 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-fg">Governed lineage</p><span className="text-[10px] uppercase tracking-wider text-green">R{packet.lineage.approvedPlanRevision} · {packet.lineage.inputHash.slice(0, 10)} · {packet.lineage.sourceSha.slice(0, 7)}</span></div><p className="mt-2 text-xs leading-5 text-muted">Scenario result is derived from governed run <span className="text-fg">{packet.lineage.governedRunId}</span>. It does not modify that run or any operating ledger.</p></div>
        </div>}
      </Panel>
    </div>

    {packet ? <>
      <Panel title="Liquidity trajectory" kicker="Baseline vs scenario after recommended procurement">
        <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="month" tick={{ fontSize: 11 }} interval={2} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${value}L`} width={62} /><Tooltip formatter={(value) => money(Number(value))} /><Legend /><Line type="monotone" dataKey="baseline" name="Governed baseline" stroke="currentColor" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="scenario" name={packet.scenario.label} stroke="var(--color-accent)" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Priority findings" kicker="Exception-first workflow">
          <div className="space-y-2">{scenarioRisks.length ? scenarioRisks.map((finding) => <div key={finding.id} className="rounded-lg border border-border bg-bg/30 p-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-fg">{finding.title}</p><span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">{finding.severity}</span></div><p className="mt-1 text-xs leading-5 text-muted">{finding.problem}</p><p className="mt-2 flex items-start gap-2 text-xs leading-5 text-fg"><ArrowRight className="mt-0.5 size-3.5 shrink-0 text-accent" />{finding.recommendedAction}</p></div>) : <p className="text-sm text-muted">No scenario findings.</p>}</div>
        </Panel>
        <Panel title="Material & purchase actions" kicker="MRP / ATP / procurement">
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-xs"><thead><tr className="border-b border-border text-left text-subtle"><th className="px-2 py-2">Month</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">Demand basis</th><th className="px-2 py-2 text-right">Plan / exact</th><th className="px-2 py-2 text-right">Shortage</th><th className="px-2 py-2 text-right">Recommend buy</th><th className="px-2 py-2 text-right">Cost</th></tr></thead><tbody>{supply.map((row) => <tr key={`${row.period}-${row.sku}`} className="border-b border-border/60"><td className="px-2 py-2 text-muted">M{row.period}</td><td className="px-2 py-2 font-medium text-fg">{row.sku}</td><td className="px-2 py-2 capitalize text-muted">{row.demandBasis}</td><td className="px-2 py-2 text-right tabular-nums text-muted">{row.plannedRequirementQty.toFixed(1)} / {row.committedRequirementQty.toFixed(1)}</td><td className="px-2 py-2 text-right tabular-nums text-fg">{row.committedFulfillmentShortageQty.toFixed(1)}</td><td className="px-2 py-2 text-right tabular-nums text-fg">{row.recommendedPurchaseQty.toFixed(1)}</td><td className="px-2 py-2 text-right tabular-nums text-muted">{row.purchaseCostLakh == null ? "—" : money(row.purchaseCostLakh)}</td></tr>)}</tbody></table>{!supply.length ? <p className="py-5 text-sm text-muted">No material exceptions or purchase recommendations in this scenario.</p> : null}</div>
        </Panel>
      </div>

      {history.length > 1 ? <Panel title="Scenario comparison memory" kicker="This session"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-subtle"><th className="px-3 py-3">Scenario</th><th className="px-3 py-3 text-right">Health</th><th className="px-3 py-3 text-right">Units Δ</th><th className="px-3 py-3 text-right">Procurement Δ</th><th className="px-3 py-3 text-right">Liquidity Δ</th><th className="px-3 py-3 text-right">Funding need</th></tr></thead><tbody>{history.map((item) => <tr key={`${item.scenario.id}-${item.lineage.inputHash}`} className="border-b border-border/60"><td className="px-3 py-3"><p className="font-medium text-fg">{item.scenario.label}</p><p className="mt-0.5 text-[10px] text-subtle">R{item.lineage.approvedPlanRevision} · {item.lineage.inputHash.slice(0, 8)}</p></td><td className="px-3 py-3 text-right tabular-nums text-fg">{item.result.summary.businessHealthScore}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{signed(item.comparison.expectedUnitsDelta)}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{signedMoney(item.comparison.procurementLakhDelta)}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{signedMoney(item.comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh)}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{money(item.result.funding.incrementalFundingNeedLakh)}</td></tr>)}</tbody></table></div></Panel> : null}

      <div className="flex flex-col gap-3 rounded-xl border border-accent/25 bg-accent/8 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-bg/50 text-accent"><GitCompareArrows className="size-5" /></span><div><p className="font-medium text-fg">Explore this result with {VIBPE_COPILOT_NAME}</p><p className="mt-1 text-xs leading-5 text-muted">{VIBPE_COPILOT_NAME} now has <strong className="text-fg">{packet.scenario.label}</strong> as its scenario context. Ask why a number changed, what drives a shortage, or which controlled action improves feasibility.</p></div></div><span className="shrink-0 text-xs font-medium text-accent">Open “{VIBPE_COPILOT_NAME}” →</span></div>
    </> : null}
  </div>;
}
