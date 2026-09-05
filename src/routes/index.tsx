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
        <img src="/bikes/hero.jpg" alt="VINDY carbon endurance bicycle in studio light" className="media absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/20" />
        <div className="relative mx-auto flex min-h-[82dvh] max-w-6xl flex-col justify-end px-4 pb-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">VINDY</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-[0.95] tracking-tight text-accent sm:text-7xl">Wind, rendered in carbon.</h1>
          <p className="mt-4 text-xl font-semibold tracking-tight text-fg sm:text-2xl">One geometry. Three altitudes. Core · Pro · Apex.</p>
          <p className="mt-4 max-w-xl text-base text-fg/85 sm:text-lg">VINDY is a carbon endurance road-bike platform by Vāyú Shastr Pvt Ltd — developed in India around T700/T800 carbon architecture and an ISO 4210-6 validation framework.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/range">The range <ArrowRight /></Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/fit-calculator">Bike fit calculator</Link></Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6"><div className="max-w-3xl"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Engineering doctrine</p><h2 className="mt-2 text-4xl font-bold leading-tight text-accent sm:text-5xl">The Engineering Behind the Ride</h2><p className="mt-3 text-xl font-semibold text-fg">Not just a frame. A flight plan for the road.</p><p className="mt-4 text-base leading-7 text-muted sm:text-lg">We don't build bicycles. We engineer symphonies of carbon and geometry.</p></div></section>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-3">{TIERS.map((t)=><Link key={t.id} to="/range/$tier" params={{tier:t.id}} className="group block"><div className="overflow-hidden rounded-xl border border-border bg-bg-elevated/60 transition-colors duration-200 hover:border-accent/45"><img src={t.image} alt={`${t.name} carbon bicycle`} className="media aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"/><div className="p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">{t.epithet}</p><div className="mt-1 flex items-baseline justify-between gap-3"><h2 className="text-3xl font-bold text-accent">{t.name}</h2><p className="text-sm tabular-nums text-muted">{inr(t.asp)}</p></div><p className="mt-3 text-sm text-muted">{t.pitch}</p></div></div></Link>)}</section>
      <section className="border-y border-border bg-bg-elevated/20"><div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Vāyú Shastr Pvt Ltd</p><h2 className="mt-2 text-4xl font-bold text-accent">Designed and manufactured in India.</h2><p className="mt-4 max-w-md text-muted">Indian design intent, Indian brand ownership and manufacturing for Indian riders.</p></div><ul className="grid gap-4 text-sm">{[["Engineering","T700/T800 carbon architecture developed around a defined ISO 4210-6 validation framework."],["Range","Core ₹1,31,000 · Pro ₹1,75,000 · Apex ₹3,25,000 starting ASP planning."],["Validation","FEA and physical validation remain development milestones; final compliance claims follow completed testing."]].map(([k,v])=><li key={k} className="rounded-lg border border-border bg-bg-elevated/60 p-4 transition-colors duration-200 hover:border-accent/35"><p className="font-semibold text-accent">{k}</p><p className="mt-1 text-muted">{v}</p></li>)}</ul></div></section>
      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6"><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-green">VINDY</p><h2 className="mt-3 text-4xl font-bold tracking-tight text-accent sm:text-6xl">Are You Ready to Fly?</h2><p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg">VINDY is not just another brand. It is a system — an engineering philosophy that respects the rider, the material, and the road.</p></section>
      <SiteFooter />
    </div>
  );
}
