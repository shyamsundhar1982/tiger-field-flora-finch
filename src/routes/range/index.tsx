import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MODELS } from "@/lib/data/models";
import { BOM, bomTotal } from "@/lib/data/bom";
import { inr } from "@/lib/format";
import { TIERS } from "@/lib/data/company";
import "../../public-parallax.css";

export const Route = createFileRoute("/range/")({ component: RangePage });

const tier = (id: string) => id.startsWith("core") ? "core" : id.startsWith("pro") ? "pro" : "apex";

function RangePage() {
  const [aId, setA] = useState(MODELS[1].id);
  const [bId, setB] = useState(MODELS[3].id);
  const a = MODELS.find((x) => x.id === aId) ?? MODELS[0];
  const b = MODELS.find((x) => x.id === bId) ?? MODELS[1];
  const at = tier(a.id);
  const bt = tier(b.id);
  const bom = useMemo(() => BOM.map((x) => [x.item, x[at], x[bt], x.flag]), [at, bt]);
  const ac = bomTotal(at);
  const bc = bomTotal(bt);

  return (
    <div className="vyndi-public-page min-h-dvh bg-bg">
      <SiteHeader ghost />

      <section className="vyndi-range-hero vyndi-cinematic-hero">
        <div
          className="vyndi-range-hero__stage vyndi-cinematic-stage"
          onPointerMove={handleScenePointerMove}
          onPointerLeave={resetScenePointer}
        >
          <div className="vyndi-cinematic-scene vyndi-range-cinematic-scene" aria-hidden="true">
            <div className="vyndi-cinematic-scroll vyndi-cinematic-scroll--back">
              <div className="vyndi-cinematic-pointer vyndi-cinematic-pointer--back">
                <img src="/bikes/hero.jpg" alt="" className="media vyndi-range-hero__media vyndi-cinematic-backdrop" />
              </div>
            </div>

            <div className="vyndi-cinematic-grid vyndi-range-hero__grid" />
            <div className="vyndi-cinematic-depth-field" />
            <div className="vyndi-cinematic-orb vyndi-cinematic-orb--lime" />
            <div className="vyndi-cinematic-orb vyndi-cinematic-orb--cyan" />
            <div className="vyndi-cinematic-light-beam" />

            <div className="vyndi-range-fleet">
              <div className="vyndi-range-fleet__plane vyndi-range-fleet__plane--rear">
                <div className="vyndi-cinematic-pointer vyndi-range-fleet__pointer vyndi-range-fleet__pointer--rear">
                  <img src={TIERS[0]?.image ?? "/bikes/core.jpg"} alt="" />
                </div>
              </div>
              <div className="vyndi-range-fleet__plane vyndi-range-fleet__plane--mid">
                <div className="vyndi-cinematic-pointer vyndi-range-fleet__pointer vyndi-range-fleet__pointer--mid">
                  <img src={TIERS[1]?.image ?? "/bikes/pro.jpg"} alt="" />
                </div>
              </div>
              <div className="vyndi-range-fleet__plane vyndi-range-fleet__plane--front">
                <div className="vyndi-cinematic-pointer vyndi-range-fleet__pointer vyndi-range-fleet__pointer--front">
                  <img src={TIERS[2]?.image ?? "/bikes/apex.jpg"} alt="" />
                </div>
              </div>
            </div>

            <div className="vyndi-cinematic-floor" />
            <div className="vyndi-cinematic-scroll vyndi-cinematic-scroll--foreground">
              <div className="vyndi-cinematic-pointer vyndi-cinematic-pointer--foreground">
                <div className="vyndi-cinematic-foreground" />
              </div>
            </div>
            <div className="vyndi-cinematic-vignette" />
            <div className="vyndi-cinematic-grain" />
          </div>

          <div className="vyndi-range-hero__shade" />

          <div className="vyndi-range-hero__content vyndi-cinematic-copy mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-24 sm:px-6">
            <p className="vyndi-public-eyebrow text-[11px] font-semibold uppercase tracking-[0.22em]">VYNDI · The range</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-[0.94] tracking-tight text-accent sm:text-7xl">
              Three altitudes. <span className="vyndi-public-cyan">One</span> aerodynamic language.
            </h1>
            <div className="vyndi-public-spectrum" aria-hidden="true" />
            <p className="mt-5 max-w-2xl text-lg leading-8 text-fg/85 sm:text-xl">
              <span className="vyndi-public-lime font-semibold">Longitude</span> · <span className="vyndi-public-cyan font-semibold">Latitude</span> · Altitude. Compare two builds and move through the range from endurance efficiency to the flagship carbon specification.
            </p>
          </div>
        </div>
      </section>

      <main className="vyndi-range-compare-zone mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <div className="max-w-3xl">
          <p className="vyndi-public-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">Controlled comparison</p>
          <h2 className="mt-3 text-4xl font-bold leading-none tracking-tight text-accent sm:text-5xl">Compare the range.</h2>
          <p className="mt-4 text-lg leading-7 text-muted">Choose any two VYNDI builds and compare specification, pricing and BOM side-by-side.</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr_320px]">
          <ProductColumn label="A" id={aId} setId={setA} model={a} />
          <ProductColumn label="B" id={bId} setId={setB} model={b} />
          <aside className="vyndi-range-bom-card rounded-xl border border-border p-5 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="vyndi-public-cyan text-[11px] font-semibold uppercase tracking-[0.2em]">BOM</p>
                <h2 className="mt-1 text-xl font-semibold text-accent">Build cost</h2>
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-subtle">A / B</span>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_64px_64px] gap-2 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              <span>Component</span><span className="text-right">A</span><span className="text-right">B</span>
            </div>
            <div className="divide-y divide-border">
              {bom.map(([name, x, y, flag]) => (
                <div key={String(name)} className="grid grid-cols-[1fr_64px_64px] gap-2 py-2.5 text-xs">
                  <span className="pr-2 leading-4 text-muted">{String(name)}{flag === "hs" ? <span className="ml-1 text-warn">*</span> : null}</span>
                  <span className="text-right tabular-nums text-fg">{inr(Number(x))}</span>
                  <span className="text-right tabular-nums text-fg">{inr(Number(y))}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">A total</p><p className="mt-1 text-lg tabular-nums text-accent">{inr(ac)}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">B total</p><p className="mt-1 text-lg tabular-nums text-accent">{inr(bc)}</p></div>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-subtle">* Customs / BCD + IGST is an estimate.</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProductColumn({ label, id, setId, model }: { label: string; id: string; setId: (value: string) => void; model: typeof MODELS[number] }) {
  const tierData = TIERS.find((item) => item.id === tier(model.id)) ?? TIERS[0];
  return (
    <section className="vyndi-range-product-card overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border">
        <div className="relative overflow-hidden">
          <img src={tierData.image} alt={`${model.name} carbon bicycle`} className="media aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-[1.035]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/50 via-transparent to-transparent" />
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={label === "A" ? "vyndi-public-lime text-[10px] font-semibold uppercase tracking-[0.2em]" : "vyndi-public-cyan text-[10px] font-semibold uppercase tracking-[0.2em]"}>Product {label}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-accent">{model.name}</h2>
            </div>
            <span className="pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">{tierData.name.replace("VYNDI ", "")}</span>
          </div>
          <label className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
            Build
            <select value={id} onChange={(event) => setId(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-3 text-sm text-fg outline-none focus:border-accent">
              {MODELS.map((option) => <option key={option.id} value={option.id}>{option.name} · {inr(option.asp)}</option>)}
            </select>
          </label>
        </div>
      </div>
      <dl className="divide-y divide-border px-6">
        <Spec label="Price" value={inr(model.asp)} strong />
        <Spec label="Groupset" value={model.groupset} />
        <Spec label="Wheelset" value={model.wheelset} />
        <Spec label="Tyres" value={model.tyres} />
        <Spec label="Brand" value={model.brand} />
      </dl>
    </section>
  );
}

function Spec({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="grid grid-cols-[96px_1fr] gap-4 py-4 text-sm"><dt className="text-subtle">{label}</dt><dd className={strong ? "text-right font-semibold tabular-nums text-accent" : "text-right text-fg"}>{value}</dd></div>;
}

function handleScenePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse") return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
  const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
  event.currentTarget.style.setProperty("--pointer-x", x.toFixed(3));
  event.currentTarget.style.setProperty("--pointer-y", y.toFixed(3));
}

function resetScenePointer(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--pointer-x", "0");
  event.currentTarget.style.setProperty("--pointer-y", "0");
}
