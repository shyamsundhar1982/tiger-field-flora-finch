import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { inr, pct } from "@/lib/format";

export const Route = createFileRoute("/range")({ component: Range });

const GROUPSETS = [
  { id: "sora", name: "Shimano Sora R3000", detail: "2x9 mechanical", price: 45000 },
  { id: "tiagra", name: "Shimano Tiagra 4700", detail: "2x10 mechanical", price: 44250 },
  { id: "105-mech", name: "Shimano 105 R7120", detail: "2x12 mechanical", price: 74900 },
  { id: "105-di2", name: "Shimano 105 R7150 Di2", detail: "2x12 electronic", price: 117500 },
  { id: "ultegra-di2", name: "Shimano Ultegra R8170 Di2", detail: "2x12 electronic", price: 165000 },
] as const;
const TYRES = [
  { id: "ultra-sport", name: "Continental Ultra Sport III", detail: "Training / entry race · pair", price: 7590 },
  { id: "rubino-pro", name: "Vittoria Rubino Pro IV G2.0", detail: "Endurance · pair", price: 9800 },
  { id: "gp5000", name: "Continental Grand Prix 5000", detail: "Performance · pair", price: 17790 },
  { id: "corsa-pro", name: "Vittoria Corsa Pro G2.0", detail: "Race · pair", price: 19000 },
] as const;
const WHEELSETS = [
  { id: "alloy", name: "Performance Alloy", detail: "Training / everyday", price: 30000 },
  { id: "alloy-plus", name: "Light Alloy 30", detail: "Fast endurance", price: 45000 },
  { id: "carbon-50", name: "3T Carbon CW-3T2", detail: "50 mm carbon", price: 65000 },
  { id: "carbon-58", name: "Magene EXAR Pro DB58", detail: "58 mm carbon", price: 78900 },
] as const;

type Option = { id: string; name: string; detail: string; price: number };
const DEFAULTS = {
  core: { groupset: "105-mech", tyre: "rubino-pro", wheelset: "alloy" },
  pro: { groupset: "105-di2", tyre: "rubino-pro", wheelset: "carbon-50" },
  apex: { groupset: "ultegra-di2", tyre: "corsa-pro", wheelset: "carbon-58" },
} as const;
function delta(option: Option, options: readonly Option[], defaultId: string) {
  return option.price - options.find((x) => x.id === defaultId)!.price;
}

function Range() {
  const [tierId, setTierId] = useState<(typeof TIERS)[number]["id"]>("core");
  const selectedTier = TIERS.find((t) => t.id === tierId) ?? TIERS[0];
  const defaults = DEFAULTS[tierId];
  const [groupset, setGroupset] = useState(defaults.groupset);
  const [tyre, setTyre] = useState(defaults.tyre);
  const [wheelset, setWheelset] = useState(defaults.wheelset);
  const buildAdd = useMemo(() => {
    const g = GROUPSETS.find((x) => x.id === groupset)!;
    const ty = TYRES.find((x) => x.id === tyre)!;
    const w = WHEELSETS.find((x) => x.id === wheelset)!;
    return { groupset: g, tyre: ty, wheelset: w, groupsetAdj: delta(g, GROUPSETS, defaults.groupset), tyreAdj: delta(ty, TYRES, defaults.tyre), wheelsetAdj: delta(w, WHEELSETS, defaults.wheelset) };
  }, [groupset, tyre, wheelset, defaults]);
  const adjustment = buildAdd.groupsetAdj + buildAdd.tyreAdj + buildAdd.wheelsetAdj;
  const buildPrice = selectedTier.asp + adjustment;
  const chooseTier = (id: (typeof TIERS)[number]["id"]) => { setTierId(id); setGroupset(DEFAULTS[id].groupset); setTyre(DEFAULTS[id].tyre); setWheelset(DEFAULTS[id].wheelset); };

  return <div className="min-h-dvh bg-bg"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Platform</p>
    <h1 className="mt-2 cursor-default font-display text-5xl text-accent">One geometry. Three altitudes.</h1>
    <p className="mt-4 max-w-xl text-muted">Core, Pro and Apex share the same CAD family and ISO 4210 validation path. Mix is 40 / 45 / 15. Blended ASP ₹1.80 L, landed COGS ~₹1.08 L, gross margin ~39%.</p>
    <section className="mt-12"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Range selection</p><h2 className="mt-1 cursor-default text-3xl font-bold text-accent">Choose your altitude</h2></div><p className="text-sm text-muted">Select a tier, then configure every component option below.</p></div>
      <div className="grid gap-8 lg:grid-cols-3">{TIERS.map((t) => { const selected = t.id === tierId; const gm = ((t.asp - t.cogs) / t.asp) * 100; return <button key={t.id} type="button" onClick={() => chooseTier(t.id)} aria-pressed={selected} className={`group text-left rounded-xl border p-3 transition-colors duration-200 ${selected ? "border-accent bg-accent/5 shadow-[0_0_28px_rgb(255_116_23/0.12)]" : "border-border bg-bg-elevated/60 hover:border-accent/45"}`}><img src={t.image} alt="" className="media aspect-[4/3] w-full rounded-lg object-cover" /><p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-green">{t.epithet}</p><h3 className="mt-1 text-3xl font-bold text-accent">{t.name}</h3><p className="mt-2 text-sm text-muted">{t.pitch}</p><p className="mt-4 text-sm tabular-nums text-fg">{inr(t.asp)} · GM {pct(gm, 0)} · {t.weight}</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-green">{selected ? "Selected for configuration" : "Configure this tier"}</p></button>; })}</div>
    </section>
    <section className="mt-16 rounded-2xl border border-border bg-bg-elevated/30 p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Full build configurator</p><h2 className="mt-1 cursor-default text-3xl font-bold text-accent">Configure {selectedTier.name}</h2><p className="mt-2 max-w-2xl text-sm text-muted">The published bicycle price is the base specification. Component choices apply only their upgrade or downgrade difference, keeping the configurator aligned with the product price.</p></div><div className="rounded-xl border border-accent/40 bg-bg/90 px-5 py-3 text-right shadow-[0_0_22px_rgb(255_116_23/0.08)]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green">Configured build</p><p className="mt-1 text-2xl font-bold tabular-nums text-accent">{inr(buildPrice)}</p><p className="mt-0.5 text-[10px] text-subtle">Base + option adjustments</p></div></div>
      <div className="mt-7 space-y-6"><Selection title="Groupset" options={GROUPSETS} value={groupset} defaultId={defaults.groupset} onChange={setGroupset} /><Selection title="Tyres · pair" options={TYRES} value={tyre} defaultId={defaults.tyre} onChange={setTyre} /><Selection title="Wheelset" options={WHEELSETS} value={wheelset} defaultId={defaults.wheelset} onChange={setWheelset} /></div>
      <div className="mt-7 rounded-xl border border-border bg-bg-elevated/95 p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-3"><Summary label="Groupset" value={buildAdd.groupset.name} adjustment={buildAdd.groupsetAdj} /><Summary label="Tyres" value={buildAdd.tyre.name} adjustment={buildAdd.tyreAdj} /><Summary label="Wheelset" value={buildAdd.wheelset.name} adjustment={buildAdd.wheelsetAdj} /></div><div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Base bicycle</p><p className="text-sm text-muted">{selectedTier.name} · {inr(selectedTier.asp)}</p></div><div className="text-left sm:text-right"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Final configured price</p><p className="text-2xl font-bold tabular-nums text-accent">{inr(buildPrice)}</p></div></div></div>
      <p className="mt-4 text-[11px] leading-5 text-subtle">Component figures are reference values. The customer-facing price starts from the published Core / Pro / Apex ASP and applies only the difference from that tier's standard specification; full component retail prices are not added again.</p>
    </section>
    <p className="mt-8 text-sm text-muted">Need the detailed page for one tier? <Link to="/range/$tier" params={{ tier: selectedTier.id }} className="text-accent transition-colors hover:text-green">Open {selectedTier.name} detail →</Link></p>
  </main><SiteFooter /></div>;
}

function Selection<T extends Option>({ title, options, value, defaultId, onChange }: { title: string; options: readonly T[]; value: string; defaultId: string; onChange: (value: T["id"]) => void }) { return <div className="rounded-2xl border border-border bg-bg-elevated/25 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-bg/45 px-3 py-2"><h3 className="cursor-default text-base font-bold text-green">{title}</h3><span className="rounded-full border border-border bg-bg/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-green">Select one</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{options.map((option) => { const selected = option.id === value; const d = delta(option, options, defaultId); return <button key={option.id} type="button" aria-pressed={selected} onClick={() => onChange(option.id)} className={`group min-h-[112px] rounded-xl border p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${selected ? "border-accent bg-[#111315]" : "border-border bg-[#17191b] hover:border-accent/45 hover:bg-[#121516]"}`}><div className="flex items-start justify-between gap-3"><span className={`text-sm font-bold leading-5 ${selected ? "text-accent" : "text-fg group-hover:text-accent"}`}>{option.name}</span><span className={`mt-0.5 size-3 shrink-0 rounded-full border-2 ${selected ? "border-accent bg-accent" : "border-subtle group-hover:border-green"}`} /></div><p className="mt-2 text-xs leading-4 text-muted">{option.detail}</p><div className="mt-3 flex items-baseline justify-between gap-2"><span className="text-[10px] uppercase tracking-[0.12em] text-subtle">{d === 0 ? "Included" : d > 0 ? "Upgrade" : "Saving"}</span><span className={`text-base font-bold tabular-nums ${d === 0 ? "text-green" : "text-accent"}`}>{d === 0 ? "₹0" : `${d > 0 ? "+" : "−"}${inr(Math.abs(d))}`}</span></div></button>; })}</div></div>; }
function Summary({ label, value, adjustment: d }: { label: string; value: string; adjustment: number }) { return <div className="rounded-lg border border-border/70 bg-bg/50 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label}</p><p className="mt-1 text-sm font-semibold text-fg">{value}</p><p className="mt-1 text-sm font-bold tabular-nums text-accent">{d === 0 ? "Included" : `${d > 0 ? "+" : "−"}${inr(Math.abs(d))}`}</p></div>; }
