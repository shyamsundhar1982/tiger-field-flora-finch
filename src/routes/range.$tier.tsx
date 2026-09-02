import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { BOM, bomTotal } from "@/lib/data/bom";
import { inr, pct } from "@/lib/format";

export const Route = createFileRoute("/range/$tier")({ component: TierPage });

function TierPage() {
  const { tier } = Route.useParams();
  const t = TIERS.find((x) => x.id === tier);
  if (!t) throw notFound();
  const cogs = bomTotal(t.id);
  const gm = ((t.asp - cogs) / t.asp) * 100;

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link to="/range" className="text-sm text-muted hover:text-fg">
          Range
        </Link>
        <div className="mt-4 grid gap-10 lg:grid-cols-2">
          <img src={t.image} alt={`${t.name} bicycle`} className="media w-full rounded-xl object-cover" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">{t.epithet}</p>
            <h1 className="mt-2 font-display text-5xl">{t.name}</h1>
            <p className="mt-4 text-muted">{t.pitch}</p>
            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-subtle">ASP</dt>
                <dd className="font-display text-2xl tabular-nums">{inr(t.asp)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Landed COGS</dt>
                <dd className="font-display text-2xl tabular-nums">{inr(cogs)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Gross margin</dt>
                <dd className="font-display text-2xl tabular-nums">{pct(gm, 1)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Frame target</dt>
                <dd className="font-display text-2xl">{t.weight}</dd>
              </div>
            </dl>
            <ul className="mt-8 space-y-2 text-sm text-muted">
              {t.highlights.map((h) => (
                <li key={h} className="border-l border-accent pl-3">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <h2 className="mt-16 font-display text-3xl">Indicative BOM</h2>
        <p className="mt-2 text-sm text-muted">Replace yellow-path quotes with OEM numbers before investor use.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">Line</th>
                <th className="py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {BOM.map((row) => (
                <tr key={row.item} className="border-t border-border">
                  <td className="py-2.5 pr-4">
                    {row.item}
                    {row.flag === "hs" ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-warn">HS risk</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 tabular-nums text-muted">{inr(row[t.id])}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="py-3 font-medium">Total landed</td>
                <td className="py-3 tabular-nums">{inr(cogs)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
