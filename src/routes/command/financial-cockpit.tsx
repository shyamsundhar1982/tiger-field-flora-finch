import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { FinanceVisual } from "@/components/finance-visual";
import { buildModelWithInputs, minCash, totals, runwayMonths } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/financial-cockpit")({ component: FinancialCockpit });

const money = (n: number) => `₹${n.toFixed(1)}L`;

function FinancialCockpit() {
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const t = totals(rows);
  const trough = minCash(rows);
  const m1 = rows[0];
  const last = rows.at(-1)!;
  const burn = Math.max(0, (rows[0]?.opex ?? 0) + (rows[0]?.capex ?? 0) + (rows[0]?.inventoryBuy ?? 0) - (rows[0]?.revenue ?? 0));
  const runway = runwayMonths(rows, 1);
  const breakEven = rows.find((r) => r.ebitda >= 0)?.m ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Financial operating system</p>
        <h1 className="font-display text-4xl">Financial cockpit</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">The page for one decision: <span className="text-fg">are we financially safe, and what changes that answer?</span> Every figure below comes from the shared live model.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 text-xs">
        <span className="uppercase tracking-[0.14em] text-subtle">Scenario</span>
        <span className="rounded-md bg-accent px-2.5 py-1.5 text-bg">{scenario}</span>
        <span className="text-muted">Edit the assumptions once; portfolio outputs update together.</span>
        <Link to="/command/finance-assumptions" className="ml-auto text-accent hover:text-fg">Open assumptions →</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cash trough" value={money(trough.cash)} hint={`Month ${trough.m}`} tone={trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"} />
        <Kpi label="Funding required" value={money(t.funding)} hint="36-month model" />
        <Kpi label="Gross profit" value={money(rows.reduce((s, r) => s + r.gp, 0))} hint={`${((t.revenue ? rows.reduce((s,r)=>s+r.gp,0)/t.revenue : 0)*100).toFixed(1)}% blended margin`} />
        <Kpi label="Break-even" value={breakEven ? `M${breakEven}` : "Not reached"} hint={`Runway ${runway.toFixed(1)} months`} tone={breakEven ? "ok" : "warn"} />
      </div>

      <Panel title="How the money moves" kicker="The model chain">
        <div className="grid gap-2 md:grid-cols-5">
          {[
            ["1", "Units", `${t.units} bikes`],
            ["2", "Revenue", lakh(t.revenue, 1)],
            ["3", "COGS", lakh(rows.reduce((s,r)=>s+r.cogs,0), 1)],
            ["4", "Gross profit", lakh(rows.reduce((s,r)=>s+r.gp,0), 1)],
            ["5", "Cash trough", money(trough.cash)],
          ].map(([n, label, value], i) => <div key={label} className="relative rounded-xl border border-border bg-surface p-4">{i < 4 ? <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-subtle md:block">→</span> : null}<span className="text-[10px] text-accent">{n}</span><p className="mt-2 text-xs uppercase tracking-[0.12em] text-subtle">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-fg">{value}</p></div>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">ASP and volume drive revenue. Revenue less COGS creates gross profit. Opex, inventory purchases and capex then determine cash. Funding changes the cash trough, not the operating economics.</p>
      </Panel>

      <FinanceVisual rows={rows} title="36-month financial trajectory" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Where are we spending?" kicker="36-month total"><div className="space-y-3 text-sm">{[["COGS", rows.reduce((s,r)=>s+r.cogs,0)], ["Opex", t.opex], ["Capex", rows.reduce((s,r)=>s+r.capex,0)], ["Inventory buy", rows.reduce((s,r)=>s+r.inventoryBuy,0)]].map(([label,value])=><div key={label} className="flex justify-between border-b border-border pb-2"><span className="text-muted">{label}</span><span className="tabular-nums text-fg">{money(Number(value))}</span></div>)}</div></Panel>
        <Panel title="What is working?" kicker="Operating signal"><div className="space-y-3 text-sm"><div><span className="text-muted">Revenue by M36</span><p className="mt-1 text-xl text-fg">{money(last.revenue)}</p></div><div><span className="text-muted">M1 net burn</span><p className="mt-1 text-xl text-fg">{money(burn)}</p></div><div><span className="text-muted">Ending inventory</span><p className="mt-1 text-xl text-fg">{money(last.inventory)}</p></div></div></Panel>
        <Panel title="What changes the answer?" kicker="Decision controls"><div className="space-y-2 text-sm"><Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/finance-assumptions">ASP · COGS · volume · opex · capex</Link><Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/scenarios">Base · Delayed · Stress</Link><Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/master-finance">Consolidated financial view</Link></div></Panel>
      </div>

      <p className="text-[11px] leading-5 text-subtle">Planning model only. Actual accounting, tax, working-capital treatment and statutory reporting should be reconciled with the CA before being treated as accounts.</p>
    </div>
  );
}
