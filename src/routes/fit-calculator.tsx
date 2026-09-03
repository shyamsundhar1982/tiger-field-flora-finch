import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { BAR_OPTIONS, CRANK_OPTIONS, FIT_MASTER, FIT_SIZES, STEM_OPTIONS, calculateFit, idealSizeForHeight, type FitSize } from "@/lib/data/fit-calculator";

export const Route = createFileRoute("/fit-calculator")({ component: FitCalculatorPage });

function FitCalculatorPage() {
  const [height, setHeight] = useState(172);
  const [inseam, setInseam] = useState(79);
  const [size, setSize] = useState<FitSize>("M");
  const [bar, setBar] = useState(420);
  const [stem, setStem] = useState(90);
  const [crank, setCrank] = useState(170);
  const result = useMemo(() => calculateFit(height, inseam, size, bar, stem, crank), [height, inseam, size, bar, stem, crank]);
  const ideal = idealSizeForHeight(height);

  const valuationClass = result.valuation === "BEST" ? "border-green/60" : result.valuation === "GOOD" ? "border-blue-400/60" : result.valuation === "WORST" ? "border-warn/60" : "border-red-400/60";
  const valuationText = result.valuation === "BEST" ? "text-green" : result.valuation === "GOOD" ? "text-blue-300" : result.valuation === "WORST" ? "text-warn" : "text-red-300";

  return <div className="min-h-dvh bg-bg text-fg"><SiteHeader/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><Link to="/range" className="text-xs uppercase tracking-[0.18em] text-muted hover:text-accent">Range</Link><p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-green">VEDM-301 · Fit verification</p><h1 className="mt-1 font-display text-4xl text-accent sm:text-5xl">Dynamic Bike Fit Calculator</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Vāyú Dynamic Neutral Architecture (DNA™) + Geometry Progression Optimization (GPO™). Use rider stature, inseam and cockpit choices to test the source fit logic before selecting a frame build.</p></div><Link to="/range" className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent">Back to Range</Link></div>

    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
      <section className="rounded-2xl border border-border bg-bg-elevated/40 p-5 sm:p-6"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">1 · Rider biometrics</p>
        <Slider label="Rider stature" value={height} min={150} max={195} suffix="cm" onChange={setHeight}/><Slider label="Inseam length" value={inseam} min={65} max={95} suffix="cm" onChange={setInseam}/>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-green">2 · Frame & cockpit</p>
        <Select label="Selected frame size" value={size} onChange={v=>setSize(v as FitSize)} options={FIT_SIZES.map(s=>({value:s,label:`${s} · ${FIT_MASTER[s].stack} / ${FIT_MASTER[s].reach} mm`}))}/>
        <Select label="Handlebar width" value={String(bar)} onChange={v=>setBar(Number(v))} options={BAR_OPTIONS.map(v=>({value:String(v),label:`${v} mm`}))}/>
        <Select label="Stem length" value={String(stem)} onChange={v=>setStem(Number(v))} options={STEM_OPTIONS.map(v=>({value:String(v),label:`${v} mm`}))}/>
        <Select label="Crank length" value={String(crank)} onChange={v=>setCrank(Number(v))} options={CRANK_OPTIONS.map(v=>({value:String(v),label:`${v} mm`}))}/>
        <div className="mt-5 rounded-xl border border-border bg-bg/70 p-4 text-xs leading-5 text-muted"><strong className="text-fg">Calculator recommendation:</strong> At {height} cm, the ideal source-model size is <strong className="text-accent">{ideal}</strong>. This is a fit-model recommendation; final fit should be confirmed by an appropriately qualified fitter.</div>
      </section>

      <section className="space-y-4"><div className={`rounded-2xl border bg-bg-elevated/40 p-5 sm:p-6 ${valuationClass}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className={`font-display text-2xl font-bold ${valuationText}`}>{result.valuation} FIT</p><p className="mt-1 text-sm text-muted">{result.subtitle}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-[0.15em] text-subtle">Ideal source size</p><p className="mt-1 text-2xl font-bold text-accent">{ideal}</p></div></div><div className="mt-5 rounded-xl border border-border bg-bg/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-green">Reason for recommendation</p><p className="mt-2 text-sm leading-6 text-fg">{result.reason}</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
          ["Frame stack / reach", `${result.frame.stack} / ${result.frame.reach} mm`],
          ["STR ratio", result.frame.str.toFixed(3)],
          ["Recommended stem / selected", `${result.stemRange} / ${stem} mm`],
          ["Recommended crank / selected", `${result.frame.recCrank} / ${crank} mm`],
          ["Recommended saddle height", `${result.recSaddleHeight.toFixed(1)} cm`],
          ["Estimated drop / bar", `${result.approxDrop} cm / ${result.barRange}`],
        ].map(([label,value])=><div key={label} className="rounded-xl border border-border bg-bg-elevated/30 p-4"><p className="text-[10px] uppercase tracking-[0.13em] text-subtle">{label}</p><p className="mt-2 font-mono text-sm font-semibold text-fg">{value}</p></div>)}</div>
        <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border bg-bg-elevated/30 p-5"><h2 className="font-display text-lg text-accent">Engineering & fit evaluations</h2><div className="mt-4 space-y-3 text-sm leading-6"><p><strong className="text-green">1. Biomechanical & extension:</strong> {result.biomech}</p><p><strong className="text-green">2. Cockpit & handlebar:</strong> {result.cockpit}</p></div></div><div className="rounded-xl border border-border bg-bg-elevated/30 p-5"><h2 className="font-display text-lg text-accent">Dynamic ride feel</h2><p className="mt-4 text-sm leading-6 text-muted">{result.rideFeel}</p></div></div>
      </section>
    </div>

    <section className="mt-8 rounded-2xl border border-border bg-bg-elevated/30 p-5 sm:p-6"><p className="text-[11px] uppercase tracking-[0.18em] text-green">Method note</p><h2 className="mt-1 font-display text-2xl text-accent">What this calculator is doing</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-muted">The implementation preserves the supplied calculator's decision logic: height maps to an ideal size, inseam estimates saddle height using 0.883 × inseam, stem length is checked against the size-specific recommended range, and bar width is evaluated against the source range. The result is then classified as BEST, GOOD, WORST or NO RECOMMENDED.</p><div className="mt-5 grid gap-3 md:grid-cols-5">{FIT_SIZES.map(s=><div key={s} className="rounded-lg border border-border p-3"><p className="font-display text-lg text-accent">{s}</p><p className="mt-1 text-xs text-muted">{FIT_MASTER[s].heightText}</p><p className="mt-1 text-xs text-muted">Stack / Reach {FIT_MASTER[s].stack} / {FIT_MASTER[s].reach}</p><p className="mt-1 text-xs text-muted">Stem {FIT_MASTER[s].recStem[0]}–{FIT_MASTER[s].recStem[1]} · Bar {FIT_MASTER[s].recBar}</p></div>)}</div></section>
    <p className="mt-5 text-center text-xs text-subtle">Source basis: supplied Dynamic Bike Fit calculator · VEDM-301 Rev 5.2. Current GA geometry master is tracked separately as Rev 5.4.</p>
  </main><SiteFooter/></div>;
}

function Slider({label,value,min,max,suffix,onChange}:{label:string;value:number;min:number;max:number;suffix:string;onChange:(v:number)=>void}){return <label className="mt-5 block"><span className="flex items-center justify-between text-sm font-medium"><span>{label}</span><span className="font-mono text-accent">{value} {suffix}</span></span><input className="mt-3 w-full accent-[var(--color-accent)]" type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/><span className="mt-1 flex justify-between text-[10px] text-subtle"><span>{min} {suffix}</span><span>{max} {suffix}</span></span></label>}
function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[]}){return <label className="mt-4 block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-border bg-[#17191b] px-4 py-3 text-sm text-fg outline-none focus:border-accent">{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
