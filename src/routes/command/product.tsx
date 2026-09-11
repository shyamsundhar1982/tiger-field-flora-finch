import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listCanonicalProductCatalog } from "@/lib/product-authority";

export const Route = createFileRoute("/command/product")({
  loader: () => listCanonicalProductCatalog(),
  component: Product,
});

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function Product() {
  const catalog = Route.useLoaderData();
  const families = new Set(catalog.map((row) => row.familyCode));
  const released = catalog.filter((row) => row.familyStatus === "released" && row.variantStatus === "released" && row.active).length;
  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Product · canonical authority</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Product</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Longitude, Latitude and Altitude are rendered directly from the canonical Product family/variant authority. This page no longer carries a competing static product master.</p>
        <div className="mt-3 flex gap-3 text-sm font-semibold"><Link to="/command/engineering" className="text-accent">Engineering baseline →</Link><Link to="/command/bom-control" className="text-accent">BOM control →</Link></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Families" value={String(families.size)} hint="Canonical VYNDI families"/><Kpi label="Variants" value={String(catalog.length)} hint="Current catalogue"/><Kpi label="Released + active" value={String(released)} hint="Eligible controlled variants" tone={released ? "ok" : "warn"}/></div>
      <Panel title="Canonical Product Register" kicker="Family → variant → configuration identity">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Family</th><th className="px-3 py-3 text-left">Variant</th><th className="px-3 py-3 text-left">Groupset</th><th className="px-3 py-3 text-left">Wheelset</th><th className="px-3 py-3 text-left">Tyres</th><th className="px-3 py-3 text-right">ASP</th><th className="px-3 py-3 text-left">Status</th></tr></thead><tbody>{catalog.map((row) => <tr key={row.variantId} className="border-t border-border/70"><td className="px-3 py-3"><p className="font-semibold text-fg">{row.familyName}</p><p className="text-[10px] text-muted">{row.familyCode} · R{row.familyRevision} · {row.materialClass}</p></td><td className="px-3 py-3"><p className="font-semibold text-accent">{row.variantName}</p><p className="font-mono text-[10px] text-muted">{row.businessCode} · {row.variantId}</p></td><td className="px-3 py-3 text-muted">{row.groupset}</td><td className="px-3 py-3 text-muted">{row.wheelset}</td><td className="px-3 py-3 text-muted">{row.tyres}</td><td className="px-3 py-3 text-right tabular-nums">{money(row.aspInr)}</td><td className="px-3 py-3"><span className={row.active && row.variantStatus === "released" ? "text-ok" : "text-warn"}>{row.variantStatus}</span><p className="text-[10px] text-muted">R{row.variantRevision}</p></td></tr>)}</tbody></table></div>
      </Panel>
      <p className="text-xs text-muted">Source authority: <code>vyndi_product_families</code> + <code>vyndi_product_variants</code> through <code>src/lib/product-authority.ts</code>.</p>
    </div>
  );
}
