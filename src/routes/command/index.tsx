import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel } from "@/components/kpi";
import { TRANCHES } from "@/lib/data/company";
import { ACTIONS } from "@/lib/data/actions";
import { buildModel, minCash, totals } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/")({ component: Board });

const STAGES = [
  { n: 1, label: "Command Board", to: "/command" as const },
  { n: 2, label: "Knowledge Base", to: "/command/knowledge" as const },
  { n: 3, label: "Engineering Control", to: "/command/technical" as const },
  { n: 4, label: "Financial Control · 36M", to: "/command/finance-control" as const },
  { n: 5, label: "Funding Intelligence", to: "/command/funding" as const },
  { n: 6, label: "Legal / IP / CA Control", to: "/command/legal-control" as const },
  { n: 7, label: "Manufacturing Control", to: "/command/manufacturing" as const },
  { n: 8, label: "Founder Command", to: "/command/founder-command" as const },
  { n: 9, label: "Investor / Board", to: "/command/investor-board" as const },
  { n: 10, label: "AI / Knowledge", to: "/command/ai-knowledge" as const },
  { n: 11, label: "QA / Verification", to: "/command/qa-verification" as const },
  { n: 12, label: "Final Deployment Readiness", to: "/command/deployment-readiness" as const },
];

const FINANCE_WORKSPACES = [
  { label: "Portfolio Finance", to: "/command/finance-control" as const, note: "Editable 36-month portfolio model across Aluminium, Carbon and Premium Carbon" },
  { label: "Aluminium Financial Vertical", to: "/command/aluminium-finance" as const, note: "Standalone entity: own ASP, COGS, launch, opex, capex, inventory, funding and cash" },
  { label: "Balance Sheet", to: "/command/balance-sheet" as const, note: "36-month management position view + CA reconciliation checklist" },
  { label: "CA Verification / Audit", to: "/command/ca-audit" as const, note: "Professional-review queue, evidence and sign-off protocol" },
  { label: "Investor Pitch", to: "/command/investor-pitch" as const, note: "Controlled investor narrative and 24-month operating view" },
];

const OPERATIONS_WORKSPACES = [
  { label: "Inventory Control", to: "/inventory" as const, note: "Components, stock, reorder levels, tier eligibility and configuration availability" },
  { label: "Market Survey", to: "/command/market-survey" as const, note: "India market evidence, material mix and VéLOXIS price-positioning framework" },
];

function Board() {
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const actionState = useVeloxis((s) => s.actions);
  const rows = useMemo(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
  const cashRows = rows.slice(0, 24);
  const t = totals(rows);
  const trough = minCash(rows);
  const openActions = ACTIONS.filter((a) => a.window === "2w" && actionState[a.id] !== "done");
  const m11 = rows[10];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Board pack · M1</p>
        <h1 className="font-display text-4xl">VéLOXIS command</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Review findings are now in the live model: T4 tooling at M10, ₹25 L standby CN, 10% ESOP at incorporation, provisional patents at M3, D2C-first.</p>
      </div>

      <Panel title="12-stage execution roadmap" kicker="Command architecture">
        <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {STAGES.map((stage) => (
              <Link key={stage.n} to={stage.to} activeOptions={{ exact: stage.n === 1 }} className="group flex items-start gap-3 rounded-lg border border-border bg-bg-elevated/95 p-3 transition-colors duration-200 hover:border-accent/45 hover:bg-bg" activeProps={{ className: "bg-bg border-accent" }}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs tabular-nums text-accent transition-colors group-hover:border-accent">{stage.n}</span>
                <span className="min-w-0"><span className="block text-[10px] uppercase tracking-[0.14em] text-subtle transition-colors group-hover:text-green">Stage {stage.n}</span><span className="mt-0.5 block text-sm font-medium text-fg transition-colors group-hover:text-accent">{stage.label}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Dedicated finance & fundraising workspaces" kicker="Controlled pages">
        <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {FINANCE_WORKSPACES.map((page) => (
              <Link key={page.to} to={page.to} className="group rounded-lg border border-border bg-bg-elevated/95 p-4 transition-colors duration-200 hover:border-accent/45 hover:bg-bg">
                <p className="text-sm font-medium text-fg transition-colors group-hover:text-accent">{page.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted group-hover:text-fg/80">{page.note}</p>
              </Link>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Operations & market intelligence" kicker="Controlled internal workspaces">
        <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            {OPERATIONS_WORKSPACES.map((page) => (
              <Link key={page.to} to={page.to} className="group rounded-lg border border-border bg-bg-elevated/95 p-4 transition-colors duration-200 hover:border-accent/45 hover:bg-bg">
                <p className="text-sm font-medium text-fg transition-colors group-hover:text-accent">{page.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted group-hover:text-fg/80">{page.note}</p>
              </Link>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="36-mo funding" value={lakh(t.funding, 0)} hint={`${scenario} scenario`} />
        <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m}`} tone={trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"} />
        <Kpi label="M9–M11 gap" value={drawStandby ? "Closed" : "Open"} hint={drawStandby ? `Standby on · M11 close ${lakh(m11.closing)}` : "Enable standby CN"} tone={drawStandby ? "ok" : "danger"} />
        <Kpi label="Units by M36" value={String(t.units)} hint={`Revenue ${lakh(t.revenue, 0)}`} />
      </div>

      <Panel title="Cash" kicker="Opening → close, ₹ L · 24 months">
        <div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashRows}><CartesianGrid stroke="rgba(236,234,228,0.06)" vertical={false} /><XAxis dataKey="m" tickFormatter={(v) => `M${v}`} stroke="#8e8b84" fontSize={11} /><YAxis stroke="#8e8b84" fontSize={11} /><Tooltip contentStyle={{ background: "#131316", border: "1px solid #2a2a2e", borderRadius: 8 }} labelFormatter={(v) => `Month ${v}`} formatter={(v) => lakh(Number(v))} /><Area type="monotone" dataKey="closing" stroke="#c9c4b8" fill="rgba(201,196,184,0.15)" /></AreaChart></ResponsiveContainer></div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tranches" kicker="Preserved architecture"><ol className="space-y-3"><>{TRANCHES.map((tr) => <li key={tr.id} className="flex gap-3 text-sm"><span className="w-12 shrink-0 tabular-nums text-accent">{tr.id}</span><span className="flex-1"><span className="text-fg">{tr.name} · {lakh(tr.amount, 0)} · M{tr.month}</span><span className="mt-0.5 block text-xs text-muted">{tr.deliverable}</span></span></li>)}</></ol></Panel>
        <Panel title="This fortnight" kicker={`${openActions.length} open`}><ul className="space-y-3 text-sm">{openActions.slice(0, 6).map((a) => <li key={a.id}><p className="text-fg">{a.title}</p><p className="text-xs text-muted">{a.why}</p></li>)}</ul><Link to="/command/actions" className="mt-4 inline-block text-sm text-accent hover:text-fg">Open action log</Link></Panel>
      </div>
    </div>
  );
}
