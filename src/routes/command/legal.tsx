import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { AGREEMENTS, IP_FILINGS, WARRANTY } from "@/lib/data/legal";
import { COMPANY } from "@/lib/data/company";

export const Route = createFileRoute("/command/legal")({ component: Legal });

function Legal() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedule 6</p>
        <h1 className="font-display text-4xl">IP & legal</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {COMPANY.para58Trigger}. ESOP {COMPANY.esopPool}% and founder {COMPANY.founderHold}% at CoI.
        </p>
      </div>

      <Panel title="Filing schedule">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">Asset</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">₹ L</th>
                <th className="py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {IP_FILINGS.map((f) => (
                <tr key={f.asset} className="border-t border-border">
                  <td className="py-2">{f.asset}</td>
                  <td className="py-2 text-muted">{f.type}</td>
                  <td className="py-2 tabular-nums">{f.when}</td>
                  <td className="py-2 tabular-nums">{f.cost}</td>
                  <td className="py-2 text-muted">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Agreement stack">
        <ol className="space-y-2 text-sm">
          {AGREEMENTS.map((a) => (
            <li key={a.name} className="flex flex-wrap items-baseline gap-2 border-t border-border py-2">
              <span className="w-6 text-accent">{a.order}</span>
              <span className="flex-1">{a.name}</span>
              <span className="text-muted">{a.when}</span>
              <span className="text-[11px] uppercase tracking-wider text-warn">{a.status}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Warranty — corrected">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries(WARRANTY).map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface p-4">
              <dt className="capitalize text-accent">{k}</dt>
              <dd className="mt-1 text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
