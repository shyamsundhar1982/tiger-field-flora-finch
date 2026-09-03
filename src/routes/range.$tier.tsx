import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { BOM, bomTotal } from "@/lib/data/bom";
import { listInventory, type InventoryItem } from "@/lib/data/inventory";
import { inr, pct } from "@/lib/format";

export const Route = createFileRoute("/range/$tier")({ loader: () => listInventory(), component: TierPage });
const DEFAULTS = {
  core: { groupset: "gs-105-r7000", tyre: "ty-rubino-pro", wheelset: "ws-alloy" },
  pro: { groupset: "gs-105-r7000", tyre: "ty-gp5000", wheelset: "ws-carbon-50" },
  apex: { groupset: "gs-ultegra-r8170", tyre: "ty-corsa-pro", wheelset: "ws-carbon-58" },
} as const;

type Category = InventoryItem["category"];
function tierEnabled(item: InventoryItem, tier: keyof typeof DEFAULTS) { return tier === "core" ? item.coreEnabled : tier === "pro" ? item.proEnabled : item.apexEnabled; }
function optionLabel(item: InventoryItem) { return `${item.brand} ${item.model}`; }
function delta(item: InventoryItem, options: readonly InventoryItem[], defaultId: string) { const standard = options.find((x) => x.id === defaultId); return standard ? item.priceInr - standard.priceInr : 0; }

function TierPage() {
  const { tier } = Route.useParams();
  const inventory = Route.useLoaderData();
  const t = TIERS.find((x) => x.id === tier);
  if (!t) throw notFound();
  const defaults = DEFAULTS[t.id];
  const available = inventory.filter((x) => x.stockQty > 0 && tierEnabled(x, t.id));
  const options = {
    groupset: available.filter((x) => x.category === "groupset"),
    tyre: available.filter((x) => x.category === "tyre"),
    wheelset: available.filter((x) => x.category === "wheelset"),
  } satisfies Record<Category, InventoryItem[]>;
  const [groupset, setGroupset] = useState(defaults.groupset);
  const [tyre, setTyre] = useState(defaults.tyre);
  const [wheelset, setWheelset] = useState(defaults.wheelset);
  useEffect(() => {
    if (!options.groupset.some((x) => x.id === groupset)) setGroupset(options.groupset[0]?.id ?? "");
    if (!options.tyre.some((x) => x.id === tyre)) setTyre(options.tyre[0]?.id ?? "");
    if (!options.wheelset.some((x) => x.id === wheelset)) setWheelset(options.wheelset[0]?.id ?? "");
  }, [inventory, tier]);
  const selected = useMemo(() => ({
    groupset: options.groupset.find((x) => x.id === groupset) ?? options.groupset[0],
    tyre: options.tyre.find((x) => x.id === tyre) ?? options.tyre[0],
    wheelset: options.wheelset.find((x) => x.id === wheelset) ?? options.wheelset[0],
  }), [options, groupset, tyre, wheelset]);
  const adjustment = (selected.groupset ? delta(selected.groupset, options.groupset, defaults.groupset) : 0) + (selected.tyre ? delta(selected.tyre, options.tyre, defaults.tyre) : 0) + (selected.wheelset ? delta(selected.wheelset, options.wheelset, defaults.wheelset) : 0);
  const buildPrice = t.asp + adjustment;
  const cogs = bomTotal(t.id);
  const gm = ((t.asp - cogs) / t.asp) * 100;
  return <div className="min-h-dvh bg-bg"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <Link to="/range" className="text-sm text-muted transition-colors hover:text-accent">Range</Link>
    <div className="mt-4 grid gap-10 lg:grid-cols-2"><img src={t.image} alt={`${t.name} bicycle`} className="media w-full rounded-xl object-cover" /><div><p className="text-[11px] uppercase tracking-[0.22em] text-green">{t.epithet}</p><h1 className="mt-2 text-5xl font-bold text-accent">{t.name}</h1><p className="mt-4 text-muted">{t.pitch}</p><dl className="mt-8 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-subtle">Starting price</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-accent">{inr(t.asp)}</dd></div><div><dt className="text-subtle">Landed COGS</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-fg">{inr(cogs)}</dd></div><div><dt className="text-subtle">Gross margin</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-fg">{pct(gm, 1)}</dd></div><div><dt className="text-subtle">Frame target</dt><dd className="mt-1 text-2xl font-bold text-fg">{t.weight}</dd></div></dl><ul className="mt-8 space-y-2 text-sm text-muted">{t.highlights.map((h) => <li key={h} className="border-l border-accent pl-3">{h}</li>)}</ul></div></div>
    <section className="mt-16 rounded-2xl border border-border bg-bg-elevated/30 p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Build configurator</p><h2 className="mt-1 text-3xl font-bold text-accent">Configure from inventory</h2><p className="mt-2 max-w-2xl text-sm text-muted">Choose only from stocked components approved for this range. The configurator is inventory-driven, not a free-form text form.</p></div><div className="rounded-xl border border-accent/40 bg-bg/90 px-5 py-3 text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green">Configured build</p><p className="mt-1 text-2xl font-bold tabular-nums text-accent">{inr(buildPrice)}</p><p className="mt-0.5 text-[10px] text-subtle">Base + option adjustments</p></div></div>
      <div className="mt-7 space-y-5"><Dropdown title="Groupset" options={options.groupset} value={selected.groupset?.id ?? ""} defaultId={defaults.groupset} onChange={setGroupset} /><Dropdown title="Tyres · pair" options={options.tyre} value={selected.tyre?.id ?? ""} defaultId={defaults.tyre} onChange={setTyre} /><Dropdown title="Wheelset" options={options.wheelset} value={selected.wheelset?.id ?? ""} defaultId={defaults.wheelset} onChange={setWheelset} /></div>
      <div className="mt-7 rounded-xl border border-border bg-bg-elevated/95 p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-3"><Summary label="Groupset" value={selected.groupset ? optionLabel(selected.groupset) : "Unavailable"} adjustment={selected.groupset ? delta(selected.groupset, options.groupset, defaults.groupset) : 0} /><Summary label="Tyres" value={selected.tyre ? optionLabel(selected.tyre) : "Unavailable"} adjustment={selected.tyre ? delta(selected.tyre, options.tyre, defaults.tyre) : 0} /><Summary label="Wheelset" value={selected.wheelset ? optionLabel(selected.wheelset) : "Unavailable"} adjustment={selected.wheelset ? delta(selected.wheelset, options.wheelset, defaults.wheelset) : 0} /></div><div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Base bicycle</p><p className="text-sm text-muted">{t.name} · {inr(t.asp)}</p></div><div className="text-left sm:text-right"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Final configured price</p><p className="text-2xl font-bold tabular-nums text-accent">{inr(buildPrice)}</p></div></div></div>
    </section>
    <div className="mt-6 rounded-xl border border-border bg-bg-elevated/30 p-4 text-xs leading-5 text-muted"><strong className="text-fg">Tier guardrails:</strong> Core stays entry/performance; Pro adds premium mechanical/electronic and carbon options; Apex is restricted to premium electronic groupsets, carbon aero wheels and race tyres. Stocking a cheaper component does not make it an Apex option.</div>
    <h2 className="mt-16 text-3xl font-bold text-accent">Indicative BOM</h2><p className="mt-2 text-sm text-muted">Replace yellow-path quotes with OEM numbers before investor use.</p><div className="mt-6 overflow-x-auto rounded-xl border border-border bg-bg-elevated/90"><table className="w-full min-w-[32rem] text-left text-sm"><thead className="bg-green/5 text-[11px] uppercase tracking-[0.14em] text-green"><tr><th className="px-4 py-3 font-medium">Line</th><th className="px-4 py-3 font-medium">Amount</th></tr></thead><tbody>{BOM.map((row) => <tr key={row.item} className="border-t border-border/70"><td className="px-4 py-2.5 pr-4">{row.item}{row.flag === "hs" ? <span className="ml-2 text-[10px] uppercase tracking-wider text-warn">HS risk</span> : null}</td><td className="px-4 py-2.5 tabular-nums text-muted">{inr(row[t.id])}</td></tr>)}<tr className="border-t border-accent/30 bg-accent/5"><td className="px-4 py-3 font-semibold text-accent">Total landed</td><td className="px-4 py-3 font-semibold tabular-nums text-accent">{inr(cogs)}</td></tr></tbody></table></div>
  </main><SiteFooter /></div>;
}

function Dropdown({ title, options, value, defaultId, onChange }: { title: string; options: readonly InventoryItem[]; value: string; defaultId: string; onChange: (value: string) => void }) {
  const standard = options.find((x) => x.id === defaultId);
  return <div className="rounded-2xl border border-border bg-bg-elevated/25 p-4"><div className="mb-2 flex items-center justify-between gap-3"><label className="text-base font-bold text-green">{title}</label><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{options.length} in-stock choices</span></div><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-[#17191b] px-4 py-3 text-sm text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"><option value="" disabled>Select {title.toLowerCase()}</option>{options.map((option) => { const d = standard ? option.priceInr - standard.priceInr : 0; return <option key={option.id} value={option.id}>{optionLabel(option)} · {option.detail} · {d === 0 ? "Included" : d > 0 ? `+${inr(d)}` : `−${inr(Math.abs(d))}`}</option>; })}</select><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">{value ? <span>Inventory price: <strong className="text-fg">{inr(options.find((x) => x.id === value)?.priceInr ?? 0)}</strong></span> : null}{value ? <span>Available: <strong className="text-green">{options.find((x) => x.id === value)?.stockQty ?? 0}</strong></span> : null}</div></div>;
}
function Summary({ label, value, adjustment: d }: { label: string; value: string; adjustment: number }) { return <div className="rounded-lg border border-border/70 bg-bg/50 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label}</p><p className="mt-1 text-sm font-semibold text-fg">{value}</p><p className="mt-1 text-sm font-bold tabular-nums text-accent">{d === 0 ? "Included" : `${d > 0 ? "+" : "−"}${inr(Math.abs(d))}`}</p></div>; }
