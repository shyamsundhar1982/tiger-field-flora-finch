import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { BLENDED_ASP, BLENDED_COGS, BOM, bomTotal, MIX } from "@/lib/data/bom";
import { ISO_BUDGET, ISO_GATES, ISO_TESTS, LABS } from "@/lib/data/iso";
import { TIERS } from "@/lib/data/company";
import { inr, lakh, pct } from "@/lib/format";

export const Route = createFileRoute("/command/product")({ component: Product });

function Product() {
  const gm = ((BLENDED_ASP - BLENDED_COGS) / BLENDED_ASP) * 100;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedules 3 + 5</p>
        <h1 className="font-display text-4xl">Product & ISO 4210</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Blended ASP" value={inr(BLENDED_ASP)} hint={`Mix ${MIX.core * 100}/${MIX.pro * 100}/${MIX.apex * 100}`} />
        <Kpi label="Blended COGS" value={inr(Math.round(BLENDED_COGS))} hint="vs plan ₹1.10 L (+2.2%)" />
        <Kpi label="Gross margin" value={pct(gm, 1)} />
      </div>

      <Panel title="BOM bridge" kicker="Indicative India-landed ₹">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">Component</th>
                <th className="py-2 font-medium">Core</th>
                <th className="py-2 font-medium">Pro</th>
                <th className="py-2 font-medium">Apex</th>
              </tr>
            </thead>
            <tbody>
              {BOM.map((r) => (
                <tr key={r.item} className="border-t border-border">
                  <td className="py-2 pr-3">
                    {r.item}
                    {r.flag === "hs" ? (
                      <span className="ml-2 text-[10px] uppercase text-warn">Confirm HS</span>
                    ) : null}
                    {r.note ? <p className="text-xs text-muted">{r.note}</p> : null}
                  </td>
                  <td className="py-2 tabular-nums">{inr(r.core)}</td>
                  <td className="py-2 tabular-nums">{inr(r.pro)}</td>
                  <td className="py-2 tabular-nums">{inr(r.apex)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="py-3">Total</td>
                <td className="py-3 tabular-nums">{inr(bomTotal("core"))}</td>
                <td className="py-3 tabular-nums">{inr(bomTotal("pro"))}</td>
                <td className="py-3 tabular-nums">{inr(bomTotal("apex"))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          {TIERS.map((t) => (
            <p key={t.id} className="text-muted">
              {t.name} GM {pct(((t.asp - bomTotal(t.id)) / t.asp) * 100, 1)}
            </p>
          ))}
        </div>
      </Panel>

      <Panel title="ISO 4210 validation" kicker={`Budget ${lakh(ISO_BUDGET)} · 6–8 week lab lag`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">ID</th>
                <th className="py-2 font-medium">Test</th>
                <th className="py-2 font-medium">Samples</th>
                <th className="py-2 font-medium">Weeks</th>
                <th className="py-2 font-medium">₹ L</th>
                <th className="py-2 font-medium">Accept</th>
              </tr>
            </thead>
            <tbody>
              {ISO_TESTS.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 text-accent">{t.id}</td>
                  <td className="py-2">{t.item}</td>
                  <td className="py-2 text-muted">{t.samples}</td>
                  <td className="py-2 tabular-nums">{t.weeks}</td>
                  <td className="py-2 tabular-nums">{t.cost.toFixed(1)}</td>
                  <td className="py-2 text-muted">{t.accept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {ISO_GATES.map((g) => (
            <li key={g}>— {g}</li>
          ))}
        </ul>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {LABS.map((l) => (
            <div key={l.name} className="rounded-md bg-surface p-3 text-sm">
              <p className="text-fg">{l.name}</p>
              <p className="mt-1 text-xs text-muted">{l.fit}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
