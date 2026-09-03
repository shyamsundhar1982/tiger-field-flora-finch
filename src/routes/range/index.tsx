import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MODELS } from "@/lib/data/models";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/range/")({ component: RangePage });

function RangePage() {
  const grouped = {
    core: MODELS.filter((m) => m.tier === "core"),
    pro: MODELS.filter((m) => m.tier === "pro"),
    apex: MODELS.filter((m) => m.tier === "apex"),
  };

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12">
        <p className="text-[11px] uppercase tracking-[0.22em] text-green">Platform</p>
        <h1 className="mt-2 font-display text-5xl text-accent">The VéLOXIS Range</h1>
        <p className="mt-3 text-muted">Configure your ideal performance bicycle.</p>
        <section className="mt-8 rounded-2xl border border-border bg-bg-elevated/30 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-green">Before you configure</p><h2 className="mt-1 font-display text-2xl text-accent">Find your frame size</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Run the Dynamic Bike Fit Calculator using stature, inseam, stem, bar and crank choices. It uses the supplied VEDM-301 fit logic and returns a size recommendation plus dynamic ride-feel evaluation.</p></div>
            <Link to="/fit-calculator" className="shrink-0 rounded-lg border border-accent px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-bg">Open Fit Calculator →</Link>
          </div>
        </section>
        {Object.entries(grouped).map(([tier, models]) => (
          <section key={tier} className="mt-14">
            <h2 className="font-display text-3xl capitalize text-accent">{tier}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {models.map((model) => (
                <Link key={model.id} to="/range/$tier" params={{ tier: model.tier }} className="rounded-xl border border-border p-6 transition-colors hover:border-accent">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl text-accent">{model.name}</h3>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green">{model.brand}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-fg">{model.groupset}</p>
                  <p className="mt-1 text-xs text-muted">{model.wheelset} · {model.tyres}</p>
                  <p className="mt-4 text-lg font-bold tabular-nums text-accent">{inr(model.asp)}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
