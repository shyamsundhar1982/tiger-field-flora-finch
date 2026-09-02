import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Kpi, Panel } from "@/components/kpi";
import {
  BREAKEVEN_EARLY,
  BREAKEVEN_SCALE,
  GM,
  SCENARIOS,
  buildModel,
  minCash,
  totals,
  type ScenarioId,
} from "@/lib/finance/model";
import { lakh, pct } from "@/lib/format";
import { useVeloxis } from "@/lib/store";
import { TRANCHES } from "@/lib/data/company";

export const Route = createFileRoute("/command/finance")({ component: Finance });

function Finance() {
  const scenario = useVeloxis((s) => s.scenario);
  const setScenario = useVeloxis((s) => s.setScenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const setDrawStandby = useVeloxis((s) => s.setDrawStandby);
  const rows = useMemo(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
  const t = totals(rows);
  const trough = minCash(rows);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedule 1 + 2 + 8</p>
        <h1 className="font-display text-4xl">Finance</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setScenario(id)}
            className={`h-10 rounded-md px-4 text-sm ${scenario === id ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}
          >
            {SCENARIOS[id].label} · {SCENARIOS[id].probability}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDrawStandby(!drawStandby)}
          className={`h-10 rounded-md px-4 text-sm ${drawStandby ? "bg-ok text-accent-fg" : "bg-surface text-muted"}`}
        >
          Standby CN {drawStandby ? "on" : "off"}
        </button>
      </div>
      <p className="text-sm text-muted">{SCENARIOS[scenario].note}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Gross margin" value={pct(GM, 1)} hint="Blended ASP ₹1.80 L" />
        <Kpi label="Break-even" value={`${BREAKEVEN_EARLY} u/mo`} hint={`Scale phase ${BREAKEVEN_SCALE} after M14 opex`} />
        <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m}`} tone={trough.cash < 8 ? "danger" : "ok"} />
        <Kpi label="24-mo EBITDA" value={lakh(t.ebitda, 0)} />
      </div>

      <Panel title="Revenue · COGS · OPEX" kicker="₹ Lakh">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid stroke="rgba(236,234,228,0.06)" vertical={false} />
              <XAxis dataKey="m" tickFormatter={(v) => `M${v}`} stroke="#8e8b84" fontSize={11} />
              <YAxis stroke="#8e8b84" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#131316", border: "1px solid #2a2a2e" }}
                formatter={(v) => lakh(Number(v))}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#8fa38a" name="Revenue" />
              <Bar dataKey="cogs" fill="#6a6760" name="COGS" />
              <Bar dataKey="opex" fill="#c4a574" name="OPEX" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="₹2 Cr utilisation" kicker="Line items against T1–T5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">Gate</th>
                <th className="py-2 font-medium">M</th>
                <th className="py-2 font-medium">₹</th>
                <th className="py-2 font-medium">Deliverable</th>
              </tr>
            </thead>
            <tbody>
              {TRANCHES.map((tr) => (
                <tr key={tr.id} className="border-t border-border">
                  <td className="py-2.5">{tr.id} {tr.name}</td>
                  <td className="py-2.5 tabular-nums">M{tr.month}</td>
                  <td className="py-2.5 tabular-nums">{lakh(tr.amount, 0)}</td>
                  <td className="py-2.5 text-muted">{tr.deliverable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Monthly P&L + cash" kicker="All figures ₹ L">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                {["M", "U", "Rev", "COGS", "GP", "OPEX", "EBITDA", "Capex", "Fund", "Cash"].map((h) => (
                  <th key={h} className="py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.m} className="border-t border-border tabular-nums">
                  <td className="py-1.5">{r.m}</td>
                  <td className="py-1.5">{r.units}</td>
                  <td className="py-1.5">{r.revenue.toFixed(1)}</td>
                  <td className="py-1.5">{r.cogs.toFixed(1)}</td>
                  <td className="py-1.5">{r.gp.toFixed(1)}</td>
                  <td className="py-1.5">{r.opex.toFixed(1)}</td>
                  <td className={r.ebitda < 0 ? "py-1.5 text-danger" : "py-1.5 text-ok"}>
                    {r.ebitda.toFixed(1)}
                  </td>
                  <td className="py-1.5">{r.capex.toFixed(1)}</td>
                  <td className="py-1.5">{r.funding ? r.funding.toFixed(0) : "—"}</td>
                  <td className={r.closing < 8 ? "py-1.5 text-warn" : "py-1.5"}>{r.closing.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
