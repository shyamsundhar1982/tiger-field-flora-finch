import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { MODELS } from "@/lib/data/models";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/range/")({
  component: RangePage,
});

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
        <h1 className="font-display text-5xl">The VéLOXIS Range</h1>
        <p className="mt-3 text-muted">
          Configure your ideal performance bicycle.
        </p>

        {Object.entries(grouped).map(([tier, models]) => (
          <section key={tier} className="mt-14">
            <h2 className="font-display text-3xl capitalize">{tier}</h2>

            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {models.map((model) => (
                <Link
                  key={model.id}
                  to={`/range/${model.tier}`}
                  className="rounded-xl border border-border p-6 hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl">{model.name}</h3>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green">
                      {model.brand}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-fg">
                    {model.groupset}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {model.wheelset} · {model.tyres}
                  </p>
                  <p className="mt-4 text-lg font-bold tabular-nums text-accent">
                    {inr(model.asp)}
                  </p>
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
