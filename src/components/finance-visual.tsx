import { useMemo, useState } from "react";
import type { MonthRow } from "@/lib/finance/model";

type Kind = "cash" | "revenue" | "units" | "margin";
const config: Record<Kind, { label: string; values: (r: MonthRow) => number; suffix: string; axis: string }> = {
  cash: { label: "Cash", values: (r) => r.closing, suffix: "₹L", axis: "Closing cash (₹ lakh)" },
  revenue: { label: "Revenue", values: (r) => r.revenue, suffix: "₹L", axis: "Revenue (₹ lakh)" },
  units: { label: "Units", values: (r) => r.units, suffix: "bikes", axis: "Bicycles sold (units)" },
  margin: { label: "Gross margin", values: (r) => r.revenue > 0 ? (r.gp / r.revenue) * 100 : 0, suffix: "%", axis: "Gross margin (%)" },
};

const fmt = (value: number, suffix: string) => `${value.toFixed(1)} ${suffix}`;

export function FinanceVisual({ rows, title = "Model visualisation" }: { rows: MonthRow[]; title?: string }) {
  const [kind, setKind] = useState<Kind>("cash");
  const [open, setOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const series = useMemo(() => rows.map(config[kind].values), [rows, kind]);
  const max = Math.max(...series, 1); const min = Math.min(...series, 0);
  const width = 760; const height = 300; const left = 62; const right = 18; const top = 28; const bottom = 52;
  const plotW = width - left - right; const plotH = height - top - bottom;
  const yFor = (value: number) => top + ((max - value) / Math.max(max - min, 1)) * plotH;
  const xFor = (i: number) => left + (i / Math.max(series.length - 1, 1)) * plotW;
  const point = (value: number, i: number) => `${xFor(i)},${yFor(value)}`;
  const points = series.map(point).join(" "); const latest = series.at(-1) ?? 0; const trough = Math.min(...series);
  const tickValues = Array.from({ length: 5 }, (_, i) => max - ((max - min) * i) / 4);
  const xTickIndexes = Array.from(new Set([0, 5, 11, 17, 23, 29, Math.max(series.length - 1, 0)])).filter((i) => i < series.length);
  const buttons = (large = false) => (Object.keys(config) as Kind[]).map((id) => <button key={id} type="button" onClick={() => { setKind(id); setHoverIndex(null); }} className={`rounded-md ${large ? "px-3 py-2" : "px-2.5 py-1.5"} text-[11px] ${kind === id ? "bg-accent text-bg" : "border border-border text-muted hover:text-fg"}`}>{config[id].label}</button>);
  const chart = (large = false) => {
    const chartHeight = large ? 360 : height;
    const move = (event: React.MouseEvent<SVGRectElement>) => {
      if (!series.length) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const localX = ((event.clientX - rect.left) / rect.width) * width;
      const ratio = Math.max(0, Math.min(1, (localX - left) / plotW));
      setHoverIndex(Math.max(0, Math.min(series.length - 1, Math.round(ratio * Math.max(series.length - 1, 1)))));
    };
    const active = hoverIndex === null ? null : series[hoverIndex];
    const tx = hoverIndex === null ? 0 : Math.min(Math.max(xFor(hoverIndex) - 70, left), width - right - 145);
    const ty = hoverIndex === null ? 0 : Math.max(yFor(active ?? 0) - 62, top + 4);
    return <svg viewBox={`0 0 ${width} ${chartHeight}`} className={large ? "h-[52vh] min-h-[330px] w-full" : "h-56 w-full"} role="img" aria-label={`${config[kind].label} over 36 months`}>
      {tickValues.map((value, i) => <g key={i}><line x1={left} x2={width - right} y1={yFor(value)} y2={yFor(value)} stroke="currentColor" className="text-border" /><text x={left - 9} y={yFor(value) + 4} textAnchor="end" className="fill-muted text-[11px]">{value.toFixed(1)}</text></g>)}
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="currentColor" className="text-muted" />
      <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="currentColor" className="text-muted" />
      <polyline fill="none" stroke="currentColor" className="text-accent" strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" />
      {xTickIndexes.map((i) => <g key={i}><line x1={xFor(i)} x2={xFor(i)} y1={height - bottom} y2={height - bottom + 5} stroke="currentColor" className="text-muted" /><text x={xFor(i)} y={height - bottom + 19} textAnchor="middle" className="fill-muted text-[10px]">M{i + 1}</text></g>)}
      {series.map((value, i) => (large || i % 6 === 0 || i === hoverIndex) ? <circle key={i} cx={xFor(i)} cy={yFor(value)} r={i === hoverIndex ? 5 : 3} className="fill-accent" /> : null)}
      <text x={left + plotW / 2} y={height - 8} textAnchor="middle" className="fill-subtle text-[11px]">Months</text>
      <text x="14" y={top + plotH / 2} textAnchor="middle" transform={`rotate(-90 14 ${top + plotH / 2})`} className="fill-subtle text-[11px]">{config[kind].axis}</text>
      <rect x={left} y={top} width={plotW} height={plotH} fill="transparent" onMouseMove={move} onMouseLeave={() => setHoverIndex(null)} />
      {hoverIndex !== null && active !== undefined ? <g pointerEvents="none"><rect x={tx} y={ty} width="145" height="48" rx="7" className="fill-bg-elevated" stroke="currentColor" /><text x={tx + 10} y={ty + 18} className="fill-fg text-[11px] font-semibold">Month {hoverIndex + 1}</text><text x={tx + 10} y={ty + 36} className="fill-accent text-[12px] font-bold">{fmt(active, config[kind].suffix)}</text></g> : null}
    </svg>;
  };
  return <>
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-subtle">Live model</p><p className="mt-1 text-sm font-semibold text-fg">{title}</p></div><div className="flex flex-wrap gap-1">{buttons()}<button type="button" onClick={() => setOpen(true)} className="ml-1 rounded-md border border-accent/50 px-2.5 py-1.5 text-[11px] text-accent">Expand ↗</button></div></div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-bg p-2"><div className="mb-1 flex justify-between px-2 text-[10px] uppercase tracking-[0.12em] text-subtle"><span>Y-axis: {config[kind].axis}</span><span>X-axis: Month</span></div>{chart()}</div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs"><div><span className="text-subtle">Latest</span><p className="mt-1 font-semibold text-fg">{latest.toFixed(1)} {config[kind].suffix}</p></div><div><span className="text-subtle">Low</span><p className="mt-1 font-semibold text-fg">{trough.toFixed(1)} {config[kind].suffix}</p></div><div><span className="text-subtle">Window</span><p className="mt-1 font-semibold text-fg">36 months</p></div></div>
    </div>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-bg-elevated p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.18em] text-green">Interactive financial graphic</p><h2 className="mt-1 font-display text-3xl text-accent">{title}</h2></div><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:text-fg">Close</button></div><div className="mt-5 flex flex-wrap gap-2">{buttons(true)}</div><div className="mt-4 rounded-xl border border-border bg-bg p-3"><div className="mb-1 flex justify-between px-2 text-[10px] uppercase tracking-[0.12em] text-subtle"><span>Y-axis: {config[kind].axis}</span><span>X-axis: Month</span></div>{chart(true)}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Latest</p><p className="mt-2 text-2xl text-fg">{latest.toFixed(1)} {config[kind].suffix}</p></div><div className="rounded-lg border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Minimum</p><p className="mt-2 text-2xl text-fg">{trough.toFixed(1)} {config[kind].suffix}</p></div><div className="rounded-lg border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Window</p><p className="mt-2 text-2xl text-fg">M1 → M36</p></div></div><p className="mt-4 text-xs leading-5 text-muted">Hover over the graph to inspect the value for each month. The axes are labelled with units so the relationship between time and the selected financial measure is explicit. This graphic is driven by the same live assumptions as the tables.</p></div>
    </div> : null}
  </>;
}
