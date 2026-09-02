import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader ghost />
      <section className="relative min-h-[82dvh] overflow-hidden">
        <img
          src="/bikes/hero.jpg"
          alt="VéLOXIS carbon endurance bicycle in studio light"
          className="media absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/20" />
        <div className="relative mx-auto flex min-h-[82dvh] max-w-6xl flex-col justify-end px-4 pb-16 sm:px-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-accent">Designed in Coimbatore</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] tracking-tight text-fg sm:text-7xl">
            Wind, rendered in carbon.
          </h1>
          <p className="mt-5 max-w-md text-base text-fg/80 sm:text-lg">
            VéLOXIS is an IP-led carbon platform — T700/T800 frames engineered to ISO 4210, built with qualified
            contract OEMs, owned in India.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/range">
                The range <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/command">Founder command</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-3">
        {TIERS.map((t) => (
          <Link key={t.id} to="/range/$tier" params={{ tier: t.id }} className="group block">
            <div className="overflow-hidden rounded-xl bg-bg-elevated shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              <img
                src={t.image}
                alt={`${t.name} carbon bicycle`}
                className="media aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">{t.epithet}</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-3xl">{t.name}</h2>
                  <p className="text-sm tabular-nums text-muted">{inr(t.asp)}</p>
                </div>
                <p className="mt-3 text-sm text-muted">{t.pitch}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Model</p>
            <h2 className="mt-2 font-display text-4xl">Asset-light. IP-heavy.</h2>
            <p className="mt-4 max-w-md text-muted">
              Geometry, layup, FEA and tooling IP sit in Vāyú Shastr. Production sits with qualified carbon houses
              in Taiwan and Vietnam. India keeps design, brand, and the customer.
            </p>
          </div>
          <ul className="grid gap-4 text-sm">
            {[
              ["Para 58", "Research expensed. Development capitalised from the M3 CAD + FEA lock — never reinstated."],
              ["Capital", "₹15 L → ₹50 L → ₹85 L → ₹1.35 Cr → ₹2 Cr. Grants first. Equity last."],
              ["Channel", "D2C is 3.9× the dealer contribution. Dealers capped at 30% in year one."],
            ].map(([k, v]) => (
              <li key={k} className="rounded-lg bg-bg-elevated p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                <p className="text-accent">{k}</p>
                <p className="mt-1 text-muted">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
