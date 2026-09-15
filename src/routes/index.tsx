import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { inr } from "@/lib/format";
import "../public-parallax.css";

export const Route = createFileRoute("/")({ component: Home });
const VAYU_LOGO = "/brand/vayu-official.svg";

function Home() {
  return (
    <div className="vyndi-public-page min-h-dvh bg-bg">
      <SiteHeader ghost />

      <section className="vyndi-public-hero">
        <div className="vyndi-public-hero__stage">
          <img
            src="/bikes/hero.jpg"
            alt="VYNDI carbon endurance bicycle in studio light"
            className="media vyndi-public-hero__media"
          />
          <div className="vyndi-public-hero__shade" />
          <div className="vyndi-public-hero__grid" />
          <div className="vyndi-public-hero__orb vyndi-public-hero__orb--lime" />
          <div className="vyndi-public-hero__orb vyndi-public-hero__orb--cyan" />

          <div className="vyndi-public-hero__content mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 sm:px-6 sm:pb-20">
            <div className="mb-6 flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/75 sm:size-16">
                <img src={VAYU_LOGO} alt="Vāyú Shastr" className="size-full object-contain" />
              </span>
              <div className="h-10 w-px bg-white/15" aria-hidden="true" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-fg">Vāyú Shastr Pvt. Ltd.</span>
            </div>

            <p className="vyndi-public-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">VYNDI · endurance engineering</p>
            <h1 className="mt-3 max-w-4xl text-5xl font-bold leading-[0.94] tracking-tight text-accent sm:text-7xl lg:text-8xl">
              Wind, rendered <span className="vyndi-public-cyan">in</span> carbon.
            </h1>
            <div className="vyndi-public-spectrum" aria-hidden="true" />
            <p className="mt-5 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              One geometry. Three altitudes. <span className="vyndi-public-lime">Longitude</span> · <span className="vyndi-public-cyan">Latitude</span> · Altitude.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-fg/85 sm:text-lg">
              VYNDI is a carbon endurance road-bike platform by Vāyú Shastr Pvt Ltd — developed in India around T700/T800 carbon architecture and an ISO 4210-6 validation framework.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/range">The range <ArrowRight /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/fit-calculator">Bike fit calculator</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-3xl">
          <p className="vyndi-public-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">Engineering doctrine</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight text-accent sm:text-5xl">The Engineering Behind the Ride</h2>
          <p className="mt-3 text-xl font-semibold text-fg">Not just a frame. A flight plan for the road.</p>
          <p className="mt-4 text-base leading-7 text-muted sm:text-lg">We don't build bicycles. We engineer symphonies of carbon and geometry.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-3">
        {TIERS.map((t) => (
          <Link key={t.id} to="/range/$tier" params={{ tier: t.id }} className="group block">
            <div className="vyndi-public-card overflow-hidden rounded-xl border border-border transition-colors duration-200 hover:border-accent/45">
              <img src={t.image} alt={`${t.name} carbon bicycle`} className="media aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
              <div className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">{t.epithet}</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <h2 className="text-3xl font-bold text-accent">{t.name}</h2>
                  <p className="text-sm tabular-nums text-muted">{inr(t.asp)}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{t.pitch}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="border-y border-white/10 bg-bg-elevated/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/75">
                <img src={VAYU_LOGO} alt="Vāyú Shastr" className="size-full object-contain" />
              </span>
              <p className="vyndi-public-cyan text-[11px] font-semibold uppercase tracking-[0.2em]">Vāyú Shastr Pvt Ltd</p>
            </div>
            <h2 className="mt-2 text-4xl font-bold text-accent">Designed and manufactured in India.</h2>
            <p className="mt-4 max-w-md text-muted">Indian design intent, Indian brand ownership and manufacturing for Indian riders.</p>
          </div>
          <ul className="grid gap-4 text-sm">
            {[
              ["Engineering", "T700/T800 carbon architecture developed around a defined ISO 4210-6 validation framework."],
              ["Range", "Longitude ₹1,31,000 · Latitude ₹1,75,000 · Altitude ₹3,25,000 starting ASP planning."],
              ["Validation", "FEA and physical validation remain development milestones; final compliance claims follow completed testing."],
            ].map(([k, v], index) => (
              <li key={k} className="vyndi-public-card rounded-lg border p-4 transition-colors duration-200">
                <p className={index === 1 ? "vyndi-public-cyan font-semibold" : "font-semibold text-accent"}>{k}</p>
                <p className="mt-1 leading-6 text-muted">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <p className="vyndi-public-eyebrow justify-center text-[11px] font-semibold uppercase tracking-[0.24em]">VYNDI</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-accent sm:text-6xl">Are You Ready to <span className="vyndi-public-cyan">Fly?</span></h2>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg">VYNDI is not just another brand. It is a system — an engineering philosophy that respects the rider, the material, and the road.</p>
      </section>

      <SiteFooter />
    </div>
  );
}
