import { useMemo, useState } from "react";
import type { MonthRow } from "@/lib/finance/model";

type Kind = "cash" | "revenue" | "units" | "margin";
const config: Record<Kind, { label: string; values: (r: MonthRow) => number; suffix: string }> = {
  cash: { label: "Cash", values: (r) => r.closing, suffix: "₹L" },
  revenue: { label: "Revenue", values: (r) => r.revenue, suffix: "₹L" },
  units: { label: "Units", values: (r) => r.units, suffix: "bikes" },
  margin: { label: "Gross margin", values: (r) => r.revenue > 0 ? (r.gp / r.revenue) * 100 : 0, suffix: "%" },
};

export function FinanceVisual({ rows, title = "Model visualisation" }: { rows: MonthRow[]; title?: string }) {
  const [kind, setKind] = useState<Kind>("cash");
  const [open, setOpen] = useState(false);
  const series = useMemo(() => rows.map(config[kind].values), [rows, kind]);
  const max = Math.max(...series, 1); const min = Math.min(...series, 0); const width = 760; const height = 250;
  const point = (value: number, i: number) => `${16 + (i / Math.max(series.length - 1, 1)) * (width - 32)},${18 + ((max - value) / Math.max(max - min, 1)) * (height - 42)}`;
  const points = series.map(point).join(" "); const latest = series.at(-1) ?? 0; const trough = Math.min(...series);
  const buttons = (large = false) => (Object.keys(config) as Kind[]).map((id) => <button key={id} type="button" onClick={() => setKind(id)} className={`rounded-md ${large ? "px-3 py-2" : "px-2.5 py-1.5"} text-[11px] ${kind === id ? "bg-accent text-bg" : "border border-border text-muted hover:text-fg"}`}>{config[id].label}</button>);
  const chart = (large = false) => <svg viewBox={`0 0 ${width} ${height}`} className={large ? "h-[45vh] min-h-64 w-full" : "h-44 w-full"} role="img" aria-label={`${config[kind].label} over 36 months`}>
    {[0,1,2,3,4].slice(0, large ? 5 : 4).map((n) => <line key={n} x1="16" x2={width - 16} y1={18 + n * (large ? 53 : 63)} y2={18 + n * (large ? 53 : 63)} stroke="currentColor" className="text-border" />)}
    <polyline fill="none" stroke="currentColor" className="text-accent" strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" />
    {series.map((value, i) => (large || i % 6 === 0) ? <circle key={i} cx={Number(point(value,i).split(",")[0])} cy={Number(point(value,i).split(",")[1])} r="3" className="fill-accent" /> : null)}
  </svg>;
  return <>
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-subtle">Live model</p><p className="mt-1 text-sm font-semibold text-fg">{title}</p></div><div className="flex flex-wrap gap-1">{buttons()}<button type="button" onClick={() => setOpen(true)} className="ml-1 rounded-md border border-accent/50 px-2.5 py-1.5 text-[11px] text-accent">Expand ↗</button></div></div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-bg p-2">{chart()}</div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs"><div><span className="text-subtle">Latest</span><p className="mt-1 font-semibold text-fg">{latest.toFixed(1)} {config[kind].suffix}</p></div><div><span className="text-subtle">Low</span><p className="mt-1 font-semibold text-fg">{trough.toFixed(1)} {config[kind].suffix}</p></div><div><span className="text-subtle">Window</span><p className="mt-1 font-semibold text-fg">36 months</p></div></div>
    </div>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-bg-elevated p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.18em] text-green">Interactive financial graphic</p><h2 className="mt-1 font-display text-3xl text-accent">{title}</h2></div><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:text-fg">Close</button></div><div className="mt-5 flex flex-wrap gap-2">{buttons(true)}</div><div className="mt-4 rounded-xl border border-border bg-bg p-3">{chart(true)}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Latest</p><p className="mt-2 text-2xl text-fg">{latest.toFixed(1)} {config[kind].suffix}</p></div><div className="rounded-lg border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Minimum</p><p className="mt-2 text-2xl text-fg">{trough.toFixed(1)} {config[kind].suffix}</p></div><div className="rounded-lg border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Window</p><p className="mt-2 text-2xl text-fg">M1 → M36</p></div></div><p className="mt-4 text-xs leading-5 text-muted">This graphic is driven by the same live assumptions as the tables. Edit an input and the chart, volumetrics and financial outputs move together.</p></div>
    </div> : null}
  </>;
}
