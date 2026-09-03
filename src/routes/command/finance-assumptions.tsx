import { createFileRoute } from "@tanstack/react-router";
import { useVeloxis } from "@/lib/store";
import { SCENARIOS } from "@/lib/finance/model";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/finance-assumptions")({ component: FinanceAssumptions });

function NumberInput({ label, value, onChange, step = 1, suffix, hint }: { label: string; value: number; onChange: (v:number)=>void; step?: number; suffix?: string; hint?: string }) {
  return <label className="block"><span className="text-xs font-medium text-fg">{label}</span>{hint ? <span className="ml-2 text-[10px] text-subtle">{hint}</span> : null}<div className="mt-1 flex items-center rounded-lg border border-border bg-bg px-3 focus-within:border-accent"><input type="number" value={value} step={step} onChange={(e)=>onChange(Number(e.target.value))} className="w-full bg-transparent py-2 text-sm tabular-nums text-fg outline-none" />{suffix ? <span className="text-xs text-subtle">{suffix}</span> : null}</div></label>;
}

function FinanceAssumptions() {
  const finance = useVeloxis((s) => s.finance);
  const updateGlobal = useVeloxis((s) => s.updateGlobalFinance);
  const updateProduct = useVeloxis((s) => s.updateProductLine);
  const updateAl = useVeloxis((s) => s.updateAluminiumVertical);
  const reset = useVeloxis((s) => s.resetFinance);
  const scenario = useVeloxis((s) => s.scenario);
  const setScenario = useVeloxis((s) => s.setScenario);

  return <div className="space-y-6">
    <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Single source of truth</p><h1 className="font-display text-4xl">Plan & assumptions</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">These are the control knobs for the financial model. Change a value here and the cockpit, master finance, Aluminium vertical and scenario outputs recalculate from the same state.</p></div>

    <Panel title="Scenario" kicker="One active planning case"><div className="grid gap-3 md:grid-cols-3">{Object.entries(SCENARIOS).map(([id, s])=><button key={id} type="button" onClick={()=>setScenario(id as keyof typeof SCENARIOS)} className={`rounded-xl border p-4 text-left ${scenario===id ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/50"}`}><p className="text-sm font-semibold text-fg">{s.label}</p><p className="mt-1 text-xs text-accent">{s.probability} planning weight</p><p className="mt-2 text-xs leading-5 text-muted">{s.note}</p></button>)}</div></Panel>

    <Panel title="Portfolio controls" kicker="Relative multipliers"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><NumberInput label="Unit volume" value={finance.unitMultiplier} step={0.05} suffix="×" hint="1.00 = current plan" onChange={(v)=>updateGlobal("unitMultiplier",v)} /><NumberInput label="Opex" value={finance.opexMultiplier} step={0.05} suffix="×" hint="1.00 = current plan" onChange={(v)=>updateGlobal("opexMultiplier",v)} /><NumberInput label="Capex" value={finance.capexMultiplier} step={0.05} suffix="×" hint="1.00 = current plan" onChange={(v)=>updateGlobal("capexMultiplier",v)} /><NumberInput label="Inventory purchases" value={finance.inventoryMultiplier} step={0.05} suffix="×" hint="1.00 = current plan" onChange={(v)=>updateGlobal("inventoryMultiplier",v)} /><NumberInput label="Funding schedule" value={finance.fundingMultiplier} step={0.05} suffix="×" hint="1.00 = current plan" onChange={(v)=>updateGlobal("fundingMultiplier",v)} /><NumberInput label="Opening cash" value={finance.openingCashLakh} step={0.5} suffix="₹L" onChange={(v)=>updateGlobal("openingCashLakh",v)} /></div></Panel>

    <Panel title="Product economics" kicker="ASP · COGS · mix · launch"><div className="space-y-5">{finance.productLines.map((line)=><div key={line.id} className="rounded-xl border border-border bg-surface p-4"><div className="mb-4 flex items-baseline justify-between gap-3"><div><p className="font-medium text-fg">{line.label}</p><p className="text-xs text-muted">{line.priceBand}</p></div><p className="text-xs text-subtle">{line.id}</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><NumberInput label="ASP" value={line.aspLakh} step={0.01} suffix="₹L" onChange={(v)=>updateProduct(line.id,"aspLakh",v)} /><NumberInput label="COGS" value={line.cogsLakh} step={0.01} suffix="₹L" onChange={(v)=>updateProduct(line.id,"cogsLakh",v)} /><NumberInput label="Mix" value={line.mixPct} step={1} suffix="%" onChange={(v)=>updateProduct(line.id,"mixPct",v)} /><NumberInput label="Launch" value={line.launchMonth} step={1} suffix="M" onChange={(v)=>updateProduct(line.id,"launchMonth",v)} /></div></div>)}</div></Panel>

    <Panel title="Aluminium vertical" kicker="Separate investment case"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><NumberInput label="Volume multiplier" value={finance.aluminiumVertical.volumeMultiplier} step={0.05} suffix="×" onChange={(v)=>updateAl("volumeMultiplier",v)} /><NumberInput label="Monthly opex" value={finance.aluminiumVertical.opexLakh} step={0.1} suffix="₹L" onChange={(v)=>updateAl("opexLakh",v)} /><NumberInput label="Launch capex" value={finance.aluminiumVertical.capexLakh} step={1} suffix="₹L" onChange={(v)=>updateAl("capexLakh",v)} /><NumberInput label="Inventory cover" value={finance.aluminiumVertical.inventoryCover} step={0.05} suffix="×" onChange={(v)=>updateAl("inventoryCover",v)} /><NumberInput label="Opening cash" value={finance.aluminiumVertical.openingCashLakh} step={0.5} suffix="₹L" onChange={(v)=>updateAl("openingCashLakh",v)} /><NumberInput label="Funding" value={finance.aluminiumVertical.fundingLakh} step={1} suffix="₹L" onChange={(v)=>updateAl("fundingLakh",v)} /><NumberInput label="Progress" value={finance.aluminiumVertical.progressPct} step={5} suffix="%" onChange={(v)=>updateAl("progressPct",Math.max(0,Math.min(100,v)))} /></div></Panel>

    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"><div><p className="text-sm font-medium text-fg">Reset model assumptions</p><p className="mt-1 text-xs text-muted">Returns every editable input to the current planning baseline.</p></div><button type="button" onClick={reset} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Reset baseline</button></div>
  </div>;
}
