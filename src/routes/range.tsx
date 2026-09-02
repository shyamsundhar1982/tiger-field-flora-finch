import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { inr, pct } from "@/lib/format";

export const Route = createFileRoute("/range")({ component: Range });

function Range() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Platform</p>
        <h1 className="mt-2 font-display text-5xl">One geometry. Three altitudes.</h1>
        <p className="mt-4 max-w-xl text-muted">
          Core, Pro and Apex share the same CAD family and ISO 4210 validation path. Mix is 40 / 45 / 15. Blended
          ASP ₹1.80 L, landed COGS ~₹1.08 L, gross margin ~39%.
        </p>
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {TIERS.map((t) => {
            const gm = ((t.asp - t.cogs) / t.asp) * 100;
            return (
              <Link key={t.id} to="/range/$tier" params={{ tier: t.id }} className="group">
                <img
                  src={t.image}
                  alt=""
                  className="media aspect-[4/3] w-full rounded-xl object-cover"
                />
                <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-subtle">{t.epithet}</p>
                <h2 className="font-display text-3xl">{t.name}</h2>
                <p className="mt-2 text-sm text-muted">{t.pitch}</p>
                <p className="mt-4 text-sm tabular-nums text-fg">
                  {inr(t.asp)} · GM {pct(gm, 0)} · {t.weight}
                </p>
              </Link>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
