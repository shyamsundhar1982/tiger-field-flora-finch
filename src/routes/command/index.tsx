import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Kpi, Panel } from "@/components/kpi";
import { TRANCHES } from "@/lib/data/company";
import { ACTIONS } from "@/lib/data/actions";
import { buildModel, minCash, totals } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/")({ component: Board });

function Board() {
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const actionState = useVeloxis((s) => s.actions);
  const rows = useMemo(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
  const t = totals(rows);
  const trough = minCash(rows);
  const openActions = ACTIONS.filter((a) => a.window === "2w" && actionState[a.id] !== "done");
  const m11 = rows[10];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Board pack · M1</p>
        <h1 className="font-display text-4xl">VéLOXIS command</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Review findings are now in the live model: T4 tooling at M10, ₹25 L standby CN, 10% ESOP at
          incorporation, provisional patents at M3, D2C-first.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="24-mo funding" value={lakh(t.funding, 0)} hint={`${scenario} scenario`} />
        <Kpi
          label="Cash trough"
          value={lakh(trough.cash)}
          hint={`M${trough.m}`}
          tone={trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"}
        />
        <Kpi
          label="M9–M11 gap"
          value={drawStandby ? "Closed" : "Open"}
          hint={drawStandby ? `Standby on · M11 close ${lakh(m11.closing)}` : "Enable standby CN"}
          tone={drawStandby ? "ok" : "danger"}
        />
        <Kpi label="Units by M24" value={String(t.units)} hint={`Revenue ${lakh(t.revenue, 0)}`} />
      </div>

      <Panel title="Cash" kicker="Opening → close, ₹ L">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid stroke="rgba(236,234,228,0.06)" vertical={false} />
              <XAxis dataKey="m" tickFormatter={(v) => `M${v}`} stroke="#8e8b84" fontSize={11} />
              <YAxis stroke="#8e8b84" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#131316", border: "1px solid #2a2a2e", borderRadius: 8 }}
                labelFormatter={(v) => `Month ${v}`}
                formatter={(v) => lakh(Number(v))}
              />
              <Area type="monotone" dataKey="closing" stroke="#c9c4b8" fill="rgba(201,196,184,0.15)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tranches" kicker="Preserved architecture">
          <ol className="space-y-3">
            {TRANCHES.map((tr) => (
              <li key={tr.id} className="flex gap-3 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-accent">{tr.id}</span>
                <span className="flex-1">
                  <span className="text-fg">
                    {tr.name} · {lakh(tr.amount, 0)} · M{tr.month}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{tr.deliverable}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="This fortnight" kicker={`${openActions.length} open`}>
          <ul className="space-y-3 text-sm">
            {openActions.slice(0, 6).map((a) => (
              <li key={a.id}>
                <p className="text-fg">{a.title}</p>
                <p className="text-xs text-muted">{a.why}</p>
              </li>
            ))}
          </ul>
          <Link to="/command/actions" className="mt-4 inline-block text-sm text-accent hover:text-fg">
            Open action log
          </Link>
        </Panel>
      </div>
    </div>
  );
}
