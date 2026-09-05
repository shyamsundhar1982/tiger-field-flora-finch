import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MODELS } from "@/lib/data/models";
import { BOM, bomTotal } from "@/lib/data/bom";
import { inr } from "@/lib/format";
import { TIERS } from "@/lib/data/company";

export const Route = createFileRoute("/range/")({ component: RangePage });

const tier = (id: string) => id.startsWith("core") ? "core" : id.startsWith("pro") ? "pro" : "apex";

function RangePage() {
  const [aId, setA] = useState(MODELS[1].id);
  const [bId, setB] = useState(MODELS[3].id);
  const a = MODELS.find((x) => x.id === aId) ?? MODELS[0];
  const b = MODELS.find((x) => x.id === bId) ?? MODELS[1];
  const at = tier(a.id);
  const bt = tier(b.id);
  const bom = useMemo(() => BOM.map((x) => [x.item, x[at], x[bt], x.flag]), [at, bt]);
  const ac = bomTotal(at);
  const bc = bomTotal(bt);
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <div className="mb-5 flex items-center gap-3"><img src="/brand/vayu-logo.svg" alt="Vāyú Shastr" className="h-8 w-auto" /><span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VINDY · The range</span></div>
          <h1 className="mt-3 text-5xl font-bold leading-none tracking-tight text-accent sm:text-6xl">Compare the range.</h1>
          <p className="mt-4 text-lg text-muted">Longitude · Latitude · Altitude. Choose two builds and compare the specification and BOM side-by-side.</p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr_320px]">
          <ProductColumn label="A" id={aId} setId={setA} model={a} />
          <ProductColumn label="B" id={bId} setId={setB} model={b} />
          <aside className="rounded-xl border border-border bg-bg-elevated p-5 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-baseline justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">BOM</p><h2 className="mt-1 text-xl font-semibold text-accent">Build cost</h2></div><span className="text-[10px] uppercase tracking-[0.16em] text-subtle">A / B</span></div>
            <div className="mt-5 grid grid-cols-[1fr_64px_64px] gap-2 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle"><span>Component</span><span className="text-right">A</span><span className="text-right">B</span></div>
            <div className="divide-y divide-border">{bom.map(([name, x, y, flag]) => <div key={String(name)} className="grid grid-cols-[1fr_64px_64px] gap-2 py-2.5 text-xs"><span className="pr-2 leading-4 text-muted">{String(name)}{flag === "hs" ? <span className="ml-1 text-warn">*</span> : null}</span><span className="text-right tabular-nums text-fg">{inr(Number(x))}</span><span className="text-right tabular-nums text-fg">{inr(Number(y))}</span></div>)}</div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4"><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">A total</p><p className="mt-1 text-lg tabular-nums text-accent">{inr(ac)}</p></div><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">B total</p><p className="mt-1 text-lg tabular-nums text-accent">{inr(bc)}</p></div></div>
            <p className="mt-3 text-[10px] leading-4 text-subtle">* Customs / BCD + IGST is an estimate.</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
function ProductColumn({label,id,setId,model}:{label:string;id:string;setId:(value:string)=>void;model:typeof MODELS[number]}) {
  const tierData = TIERS.find((item) => item.id === tier(model.id)) ?? TIERS[0];
  return <section className="overflow-hidden rounded-xl border border-border bg-bg-elevated"><div className="border-b border-border"><img src={tierData.image} alt={`${model.name} carbon bicycle`} className="media aspect-[4/3] w-full object-cover"/><div className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-green">Product {label}</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-accent">{model.name}</h2></div><span className="pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">{model.tier}</span></div><label className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">Build<select value={id} onChange={(event) => setId(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-3 text-sm text-fg outline-none focus:border-accent">{MODELS.map((option) => <option key={option.id} value={option.id}>{option.name} · {inr(option.asp)}</option>)}</select></label></div></div><dl className="divide-y divide-border px-6"><Spec label="Price" value={inr(model.asp)} strong /><Spec label="Groupset" value={model.groupset} /><Spec label="Wheelset" value={model.wheelset} /><Spec label="Tyres" value={model.tyres} /><Spec label="Brand" value={model.brand} /></dl></section>;
}
function Spec({label,value,strong=false}:{label:string;value:string;strong?:boolean}) { return <div className="grid grid-cols-[96px_1fr] gap-4 py-4 text-sm"><dt className="text-subtle">{label}</dt><dd className={strong ? "text-right font-semibold tabular-nums text-accent" : "text-right text-fg"}>{value}</dd></div>; }
