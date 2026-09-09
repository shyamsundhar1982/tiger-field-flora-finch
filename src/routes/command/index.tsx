import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { DECISION_PACKETS, DECISION_STATE_LABELS, decisionPriorityRank } from "@/lib/data/decision-engine";
import { FOUNDER_GATES, FOUNDER_STATUS_LABELS, resolveFounderActions } from "@/lib/data/founder-command";
import { buildModel, minCash, totals } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";
import { getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";

export const Route = createFileRoute("/command/")({
  loader: () => getCommandRole(),
  component: CommandCentre,
});

const PRIORITY_RANK = { critical: 0, high: 1, normal: 2 } as const;

function CommandCentre() {
  const role = Route.useLoaderData();
  const accessible = (to: string) => canAccessRoute(role, to);
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const actionProgress = useVeloxis((s) => s.actions);
  const founderActions = resolveFounderActions(actionProgress);
  const rows = useMemo(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
  const t = totals(rows);
  const trough = minCash(rows);
  const blockedActions = founderActions.filter((action) => action.status === "blocked");
  const activeActions = founderActions.filter((action) => action.status === "active");
  const nextActions = [...founderActions]
    .filter((action) => action.status !== "complete" && action.status !== "waiting")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const visibleDecisions = DECISION_PACKETS.filter((packet) => accessible(packet.source));
  const decisions = [...visibleDecisions]
    .sort((a, b) => decisionPriorityRank[a.priority] - decisionPriorityRank[b.priority])
    .slice(0, 5);
  const approvals = visibleDecisions.filter((packet) => packet.state === "approval").length;
  const blockedDecisions = visibleDecisions.filter((packet) => packet.state === "blocked").length;
  const cashTone = trough.cash < 0 ? "danger" : trough.cash < 15 ? "warn" : "ok";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-green">VINDY · Executive operating view</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Command Centre</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">One screen for what needs attention now: financial health, blockers, decisions, accountable actions and the next operating gate. Detailed work stays in its specialist workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          {accessible("/command/planning") && <a href="/command/planning" className="text-accent hover:text-fg">Master Plan →</a>}
          {accessible("/command/control-tower") && <a href="/command/control-tower" className="text-accent hover:text-fg">ERP Reports →</a>}
          {accessible("/command/decision-inbox") && <a href="/command/decision-inbox" className="text-accent hover:text-fg">Action Inbox →</a>}
          {accessible("/command/governance") && <a href="/command/governance" className="text-accent hover:text-fg">Governance →</a>}
          {accessible("/command/founder-command") && <a href="/command/founder-command" className="text-muted hover:text-fg">Action & evidence ledger →</a>}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m} · ${scenario}`} tone={cashTone} />
        <Kpi label="Blocked actions" value={String(blockedActions.length)} hint={`${activeActions.length} active`} tone={blockedActions.length ? "warn" : "ok"} />
        <Kpi label="Decisions pending" value={String(approvals + blockedDecisions)} hint={`${approvals} approval · ${blockedDecisions} blocked`} tone={blockedDecisions ? "warn" : "ok"} />
        <Kpi label="36M funding" value={lakh(t.funding, 0)} hint={`${t.units} planned units`} />
      </div>

      <Panel title="Needs attention" kicker="Exceptions only · highest priority first">
        <div className="space-y-2">
          {decisions.map((packet) => (
            <div key={packet.id} className="grid gap-3 rounded-lg border border-border bg-surface p-4 lg:grid-cols-[7rem_1.3fr_1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold text-accent">{packet.id}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-subtle">{packet.priority}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-fg">{packet.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{packet.nextAction}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-subtle">State</p>
                <p className="mt-1 text-xs text-muted">{DECISION_STATE_LABELS[packet.state]}</p>
              </div>
              <a href={packet.source} className="text-xs font-semibold text-accent hover:text-fg">Open workspace →</a>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Next accountable actions" kicker="Do · verify · close">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Dependency / outcome</th>
              </tr>
            </thead>
            <tbody>
              {nextActions.slice(0, 6).map((action) => (
                <tr key={action.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3 text-accent">{action.id}</td>
                  <td className="py-3 pr-3 font-medium text-fg">{action.title}</td>
                  <td className="py-3 pr-3 text-muted">{action.owner}</td>
                  <td className="py-3 pr-3 text-muted">{action.stage}</td>
                  <td className="py-3 pr-3 text-muted">{FOUNDER_STATUS_LABELS[action.status]}</td>
                  <td className="py-3 text-xs leading-5 text-muted">{action.dependency ?? action.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {accessible("/command/founder-command") && <a href="/command/founder-command" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Open full action & evidence ledger</a>}
          {accessible("/command/actions") && <a href="/command/actions" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Action log</a>}
        </div>
      </Panel>

      <Panel title="Operating gates" kicker="Advance only with evidence">
        <div className="grid gap-3 md:grid-cols-5">
          {FOUNDER_GATES.map((gate) => {
            const gateActions = founderActions.filter((action) => gate.controls.includes(action.id as never));
            const blocked = gateActions.some((action) => action.status === "blocked");
            const active = gateActions.some((action) => action.status === "active" || action.status === "next");
            return (
              <div key={gate.gate} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-accent">{gate.gate}</span>
                  <span className={blocked ? "text-[10px] uppercase tracking-wider text-warn" : active ? "text-[10px] uppercase tracking-wider text-green" : "text-[10px] uppercase tracking-wider text-subtle"}>{blocked ? "Blocked" : active ? "Active" : "Waiting"}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-fg">{gate.title}</p>
                <p className="mt-1 text-xs text-muted">{gate.when} · {gate.controls.join(" · ")}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Go to the work" kicker="One canonical destination per function">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Master Plan", "Roadmap, demand, procurement, production, finance and scenarios", "/command/planning"],
            ["Finance", "Cash, assumptions, funding, balance sheet and CA verification", "/command/financial-cockpit"],
            ["Supply & Production", "Plan, buy, receive, inventory, release, production and quality", "/command/operations"],
            ["Engineering", "Product, BOM, revisions, tooling and validation", "/command/engineering"],
            ["Commercial", "Demand, orders, sales forecast and GTM", "/command/sales"],
            ["Governance", "Risks, approvals, evidence and audit trail", "/command/governance"],
          ]
            .filter(([, , to]) => accessible(to))
            .map(([title, note, to]) => (
              <a key={to} href={to} className="rounded-lg border border-border p-4 transition-colors hover:border-accent/50 hover:bg-surface">
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
              </a>
            ))}
        </div>
      </Panel>

      <details className="rounded-lg border border-border bg-surface/40 p-4">
        <summary className="cursor-pointer text-sm font-medium text-fg">Support & methodology</summary>
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Founder action & evidence ledger", "/command/founder-command"],
            ["Investor / board evidence", "/command/investor-board"],
            ["Classification register", "/command/classification"],
          ]
            .filter(([, to]) => accessible(to))
            .map(([label, to]) => (
              <a key={to} href={to} className="rounded-md border border-border p-3 hover:border-accent hover:text-fg">{label}</a>
            ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-subtle">Command Centre surfaces only information that changes a decision, triggers an action, records evidence or explains a material exception. Detailed calculations remain in their canonical functional workspaces.</p>
      </details>
    </div>
  );
}
