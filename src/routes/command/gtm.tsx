import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { BLENDED_ASP, BLENDED_COGS, CHANNEL } from "@/lib/data/bom";
import { FIRST_100, GRANTS, LAUNCH } from "@/lib/data/gtm";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/command/gtm")({ component: Gtm });

function Gtm() {
  const gp = BLENDED_ASP - BLENDED_COGS;
  const d2cContrib = gp - CHANNEL.d2cVariable;
  const dealerContrib = gp - BLENDED_ASP * CHANNEL.dealerMargin;
  const d2cNet = d2cContrib - CHANNEL.d2cCac;
  const dealerNet = dealerContrib - CHANNEL.dealerCac;
  const ratio = d2cNet / dealerNet;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedule 7</p>
        <h1 className="font-display text-4xl">Go to market</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="D2C net contribution" value={inr(Math.round(d2cNet))} />
        <Kpi label="Dealer net contribution" value={inr(Math.round(dealerNet))} />
        <Kpi label="D2C advantage" value={`${ratio.toFixed(1)}×`} hint="Keep dealers ≤ 30% in year one" tone="ok" />
        <Kpi label="Early mix" value="70 / 30" hint="D2C / dealer" />
      </div>

      <Panel title="Unit economics after channel cost">
        <p className="text-sm text-muted">
          39% gross margin is not 39% contribution. D2C pays gateway + shipping (₹3,500) and CAC (₹8,000).
          Dealer pays ~26% margin. First 20 dealers may need 30–32% — still cap the channel.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="First 100">
          <ul className="space-y-3 text-sm">
            {FIRST_100.map((f) => (
              <li key={f.n}>
                <p className="text-accent">{f.n}</p>
                <p>{f.who}</p>
                <p className="text-xs text-muted">{f.note}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Launch sequence">
          {LAUNCH.map((p) => (
            <div key={p.phase} className="mb-4">
              <p className="text-sm text-fg">{p.phase}</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-muted">
                {p.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Grant pipeline" kicker="SISFS and TIDE are not base-case">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">Scheme</th>
                <th className="py-2 font-medium">Quantum</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {GRANTS.map((g) => (
                <tr key={g.name} className="border-t border-border">
                  <td className="py-2">
                    {g.name}
                    <p className="text-xs text-muted">{g.body}</p>
                  </td>
                  <td className="py-2">{g.quantum}</td>
                  <td className={g.live ? "py-2 text-ok" : "py-2 text-danger"}>{g.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
