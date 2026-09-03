import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MODELS } from "@/lib/data/models";
import { BOM, bomTotal } from "@/lib/data/bom";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/range/")({ component: RangePage });

const tier = (id: string) =>
  id.startsWith("core") ? "core" : id.startsWith("pro") ? "pro" : "apex";

type FrameColour = {
  name: string;
  hex: string;
  text?: string;
};

const FRAME_COLOURS: FrameColour[] = [
  { name: "Carbon Black", hex: "#17191b" },
  { name: "Raw Carbon", hex: "#596067" },
  { name: "Racing Green", hex: "#285844" },
  { name: "Pearl White", hex: "#e8e7e1", text: "#17191b" },
  { name: "Velocity Red", hex: "#9e3136" },
];

function RangePage() {
  const [aId, setA] = useState(MODELS[1].id);
  const [bId, setB] = useState(MODELS[3].id);
  const [aColour, setAColour] = useState(FRAME_COLOURS[0]);
  const [bColour, setBColour] = useState(FRAME_COLOURS[2]);

  const a = MODELS.find((x) => x.id === aId) ?? MODELS[0];
  const b = MODELS.find((x) => x.id === bId) ?? MODELS[1];
  const at = tier(a.id);
  const bt = tier(b.id);
  const bom = useMemo(
    () => BOM.map((x) => [x.item, x[at], x[bt], x.flag]),
    [at, bt],
  );
  const ac = bomTotal(at);
  const bc = bomTotal(bt);

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-[1500px] px-4 py-8">
        <p className="text-[11px] uppercase tracking-[.22em] text-green">
          Platform · Range selector
        </p>
        <h1 className="mt-2 font-display text-5xl text-accent">Compare two builds</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Two products. One screen. Choose the frame finish visually while specification, price and landed cost stay side-by-side.
        </p>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_1fr_360px]">
          <Card
            label="PRODUCT A"
            id={aId}
            setId={setA}
            model={a}
            cost={ac}
            colour={aColour}
            setColour={setAColour}
          />
          <Card
            label="PRODUCT B"
            id={bId}
            setId={setB}
            model={b}
            cost={bc}
            colour={bColour}
            setColour={setBColour}
          />

          <section className="rounded-2xl border border-border bg-bg-elevated p-5 lg:sticky lg:top-4 lg:self-start">
            <p className="text-[10px] uppercase tracking-[.18em] text-green">
              Right-most · BOM
            </p>
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-3 text-[10px] uppercase text-subtle">
              <span>Component</span>
              <span>A</span>
              <span>B</span>
            </div>
            <div className="mt-3 space-y-2">
              {bom.map(([n, x, y, flag]) => (
                <div
                  key={String(n)}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border pb-2 text-xs"
                >
                  <span className="text-muted">
                    {String(n)}
                    {flag === "hs" ? <b className="ml-1 text-warn">!</b> : null}
                  </span>
                  <span>{inr(Number(x))}</span>
                  <span className="text-accent">{inr(Number(y))}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-accent/30 pt-4 text-xs">
              <div>
                <span className="text-subtle">A total</span>
                <p className="mt-1 text-lg">{inr(ac)}</p>
              </div>
              <div>
                <span className="text-subtle">B total</span>
                <p className="mt-1 text-lg text-accent">{inr(bc)}</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({
  label,
  id,
  setId,
  model,
  cost,
  colour,
  setColour,
}: {
  label: string;
  id: string;
  setId: (v: string) => void;
  model: typeof MODELS[number];
  cost: number;
  colour: FrameColour;
  setColour: (v: FrameColour) => void;
}) {
  const gm = model.asp ? ((model.asp - cost) / model.asp) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
      <div className="border-b border-border p-5 pb-4">
        <p className="text-[10px] uppercase tracking-[.18em] text-green">{label}</p>
        <div className="mt-1 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-accent">{model.name}</h2>
          <span className="text-[10px] uppercase text-subtle">{model.tier}</span>
        </div>

        <div className="relative mt-4 h-36 overflow-hidden rounded-xl border border-border bg-bg px-4">
          <div
            className="absolute inset-x-5 top-1/2 h-px opacity-20"
            style={{ backgroundColor: colour.hex }}
          />
          <BikeVisual colour={colour.hex} />
          <div className="absolute bottom-2 right-3 rounded-full border border-border bg-bg-elevated/90 px-2 py-1 text-[9px] uppercase tracking-[.12em] text-subtle">
            {colour.name}
          </div>
        </div>

        <label className="mt-4 block text-[10px] uppercase tracking-[.16em] text-subtle">
          Model
          <select
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg"
          >
            {MODELS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {inr(x.asp)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[.16em] text-subtle">Frame finish</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FRAME_COLOURS.map((option) => {
              const selected = option.name === colour.name;
              return (
                <button
                  key={option.name}
                  type="button"
                  title={option.name}
                  aria-label={`Select ${option.name} frame finish`}
                  aria-pressed={selected}
                  onClick={() => setColour(option)}
                  className="group flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] transition-transform hover:-translate-y-px"
                  style={{
                    borderColor: selected ? option.hex : "var(--border)",
                    backgroundColor: selected ? `${option.hex}22` : "transparent",
                  }}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-white/20 shadow-inner"
                    style={{ backgroundColor: option.hex }}
                  />
                  <span className={selected ? "text-fg" : "text-subtle"}>{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <Metric l="Price" v={inr(model.asp)} />
          <Metric l="Landed COGS" v={inr(cost)} />
          <Metric l="Gross margin" v={`${gm.toFixed(1)}%`} />
          <Metric l="Brand" v={model.brand} />
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <Row l="Groupset" v={model.groupset} />
          <Row l="Wheelset" v={model.wheelset} />
          <Row l="Tyres" v={model.tyres} />
        </div>
      </div>
    </section>
  );
}

function BikeVisual({ colour }: { colour: string }) {
  return (
    <svg
      viewBox="0 0 640 220"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Bicycle frame finish preview"
    >
      <g fill="none" stroke="currentColor" strokeWidth="5" opacity="0.24">
        <circle cx="145" cy="160" r="43" />
        <circle cx="495" cy="160" r="43" />
      </g>
      <g fill="none" stroke={colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="11">
        <path d="M145 160 L235 78 L335 160 L145 160 L285 160 L235 78 L315 78 L335 160" />
        <path d="M315 78 L350 48 L375 78 L350 92" />
        <path d="M235 78 L215 51 L235 45" />
        <path d="M375 78 L405 78 L432 60" />
      </g>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" opacity="0.38">
        <path d="M405 78 L432 60 L448 62" />
        <path d="M215 51 L208 38" />
      </g>
      <circle cx="350" cy="92" r="7" fill={colour} />
    </svg>
  );
}

const Metric = ({ l, v }: { l: string; v: string }) => (
  <div className="rounded-lg border border-border p-3">
    <span className="text-[10px] uppercase text-subtle">{l}</span>
    <p className="mt-1 text-lg text-fg">{v}</p>
  </div>
);

const Row = ({ l, v }: { l: string; v: string }) => (
  <div className="flex justify-between gap-3 border-b border-border pb-2">
    <span className="text-subtle">{l}</span>
    <span className="text-right">{v}</span>
  </div>
);
