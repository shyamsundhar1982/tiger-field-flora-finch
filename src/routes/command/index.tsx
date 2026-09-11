import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { getCommandRole } from "@/lib/command-access";
import { FOUNDER_GATES, FOUNDER_STATUS_LABELS, resolveFounderActions } from "@/lib/data/founder-command";
import { buildModel, minCash } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { getOperatingLineage } from "@/lib/operating-lineage";
import { canAccessRoute } from "@/lib/page-access";
import { getDecisionInboxData } from "@/lib/procure-to-pay-authority";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/")({
  loader: async () => {
    const [role, lineage, inbox] = await Promise.all([
      getCommandRole(),
      getOperatingLineage(),
      getDecisionInboxData(),
    ]);
    return { role, lineage, inbox };
  },
  component: CommandCentre,
});

const PRIORITY_RANK = { critical: 0, high: 1, normal: 2 } as const;
const text = (row: Record<string, unknown>, key: string) => String(row[key] ?? "");

function CommandCentre() {
  const { role, lineage, inbox } = Route.useLoaderData();
  const accessible = (to: string) => canAccessRoute(role, to);
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const actionProgress = useVeloxis((s) => s.actions);
  const founderActions = resolveFounderActions(actionProgress);
  const rows = useMemo(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
  const trough = minCash(rows);
  const cashTone = trough.cash < 0 ? "danger" : trough.cash < 15 ? "warn" : "ok";

  const actionItems = (inbox.items ?? []) as Record<string, unknown>[];
  const shortageLines = lineage.reduce((sum, row) => sum + row.shortageLines, 0);
  const currentJobCards = lineage.filter((row) => Boolean(row.jobCardId)).length;
  const linkedPos = lineage.reduce((sum, row) => sum + row.purchaseOrderCount, 0);
  const grns = lineage.reduce((sum, row) => sum + row.goodsReceiptCount, 0);
  const travellers = lineage.reduce((sum, row) => sum + row.travellerCount, 0);
  const shipments = lineage.reduce((sum, row) => sum + row.shipmentCount, 0);
  const invoices = lineage.reduce((sum, row) => sum + row.invoiceCount, 0);
  const collections = lineage.reduce((sum, row) => sum + row.collectionCount, 0);

  const nextActions = [...founderActions]
    .filter((action) => action.status !== "complete" && action.status !== "waiting")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const WorkLink = ({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) => (
    <Link to={to as never} className={className}>{children}</Link>
  );

  const workflow = [
    ["Demand / Orders", `${lineage.length} committed order${lineage.length === 1 ? "" : "s"}`, "/command/sales"],
    ["Job Card / BOM", `${currentJobCards}/${lineage.length} current job-card lineage`, "/command/production"],
    ["Material", shortageLines ? `${shortageLines} live shortage line(s)` : "No live order-linked shortage", "/command/inventory"],
    ["Purchase", `${linkedPos} linked PO record(s)`, "/command/purchase-execution"],
    ["Receiving", `${grns} GRN record(s)`, "/command/receiving"],
    ["Traveller / Build", `${travellers} traveller(s)`, "/command/production"],
    ["Quality", "Specialist inspection / NCR control", "/command/quality"],
    ["Shipment → Collection", `${shipments} shipment · ${invoices} invoice · ${collections} collection`, "/command/receivables"],
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-green">Command · today’s operating control</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Command Centre</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Start here for what needs attention now, where the fulfillment chain stands, which decision is waiting, and where to act. Detailed transactions remain in their owning workspaces.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          {accessible("/command/decision-inbox") && <WorkLink to="/command/decision-inbox" className="text-accent hover:text-fg">Action Inbox →</WorkLink>}
          {accessible("/command/control-tower") && <WorkLink to="/command/control-tower" className="text-accent hover:text-fg">ERP Reports →</WorkLink>}
          {accessible("/command/ibpe-operating-workspace") && <WorkLink to="/command/ibpe-operating-workspace" className="text-accent hover:text-fg">VIBPE Workspace →</WorkLink>}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Needs action" value={String(actionItems.length)} hint="Governed Action Inbox" tone={actionItems.length ? "warn" : "ok"} />
        <Kpi label="Orders in flow" value={String(lineage.length)} hint={`${currentJobCards}/${lineage.length} current Job Cards`} tone={lineage.length && currentJobCards === lineage.length ? "ok" : "warn"} />
        <Kpi label="Live shortage lines" value={String(shortageLines)} hint={`${linkedPos} linked PO records`} tone={shortageLines ? "danger" : "ok"} />
        <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m} · ${scenario}`} tone={cashTone} />
      </div>

      <Panel title="Today’s control room" kicker="Four canonical places to understand → decide → act">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Action Inbox", `${actionItems.length} governed action(s) waiting`, "/command/decision-inbox"],
            ["Operations", `${lineage.length} order lineage row(s) · ${shortageLines} shortages`, "/command/operations"],
            ["ERP Reports", "Read-only cross-functional evidence pack", "/command/control-tower"],
            ["VIBPE Workspace", "Briefing, report snapshots and advisory intelligence", "/command/ibpe-operating-workspace"],
          ]
            .filter(([, , to]) => accessible(to))
            .map(([title, detail, to]) => (
              <WorkLink key={to} to={to} className="rounded-xl border border-border bg-surface/30 p-4 transition-colors hover:border-accent/50 hover:bg-surface">
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
                <p className="mt-3 text-xs font-semibold text-accent">Open →</p>
              </WorkLink>
            ))}
        </div>
      </Panel>

      <Panel title="Exceptions now" kicker="Action Inbox evidence · compact · highest priority remains in the source queue">
        {actionItems.length === 0 ? (
          <p className="text-sm text-muted">No governed action is waiting.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
                <tr><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Evidence / context</th><th className="px-3 py-2 text-right">Owner</th></tr>
              </thead>
              <tbody>
                {actionItems.slice(0, 8).map((item, index) => (
                  <tr key={`${text(item, "kind")}-${text(item, "id")}-${index}`} className="border-t border-border/70 align-top">
                    <td className={text(item, "priority") === "high" ? "px-3 py-3 font-bold uppercase text-danger" : "px-3 py-3 font-bold uppercase text-warn"}>{text(item, "priority") || "normal"}</td>
                    <td className="px-3 py-3 text-muted">{text(item, "kind")}</td>
                    <td className="px-3 py-3 font-medium text-fg">{text(item, "title")}</td>
                    <td className="px-3 py-3 text-muted">{text(item, "detail")}</td>
                    <td className="px-3 py-3 text-right"><WorkLink to={text(item, "route") || "/command/decision-inbox"} className="font-semibold text-accent">Open →</WorkLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {actionItems.length > 8 && accessible("/command/decision-inbox") ? <WorkLink to="/command/decision-inbox" className="mt-3 inline-block text-xs font-semibold text-accent">Open all {actionItems.length} actions →</WorkLink> : null}
      </Panel>

      <Panel title="Fulfillment workflow" kicker="One business object across owning controls">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Current signal</th><th className="px-3 py-2 text-right">Open owner</th></tr></thead>
            <tbody>
              {workflow.filter(([, , to]) => accessible(to)).map(([stage, signal, to]) => (
                <tr key={stage} className="border-t border-border/70"><td className="px-3 py-3 font-semibold text-fg">{stage}</td><td className="px-3 py-3 text-muted">{signal}</td><td className="px-3 py-3 text-right"><WorkLink to={to} className="font-semibold text-accent">Open →</WorkLink></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Go to the work" kicker="One canonical destination per operating owner">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Plan & Sales", "Operating plan, demand, orders, GTM, market and scenarios", "/command/planning"],
            ["Product & Engineering", "Product definition, controlled BOM, revisions and validation", "/command/engineering"],
            ["Operations", "Requirements, purchase, receiving, inventory, build genealogy and quality", "/command/operations"],
            ["People & Office", "People, payroll inputs, office, statutory services, outsourcing and assets", "/command/people-office"],
            ["Finance & Governance", "Cash, AR/AP, accounting, approvals, risk, legal and audit evidence", "/command/financial-cockpit"],
            ["Admin", "Users, roles and controlled master data", "/command/users"],
          ]
            .filter(([, , to]) => accessible(to))
            .map(([title, note, to]) => (
              <WorkLink key={to} to={to} className="rounded-lg border border-border p-4 transition-colors hover:border-accent/50 hover:bg-surface">
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
              </WorkLink>
            ))}
        </div>
      </Panel>

      <details className="rounded-xl border border-border bg-surface/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg">Program / founder governance <span className="ml-2 text-xs font-normal text-muted">secondary to day-to-day operating control</span></summary>
        <div className="mt-4 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-accent">Next accountable program actions</h2><span className="text-xs text-muted">Do · verify · close</span></div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Status</th><th className="py-2">Dependency / outcome</th></tr></thead>
                <tbody>
                  {nextActions.slice(0, 8).map((action) => (
                    <tr key={action.id} className="border-t border-border align-top"><td className="py-3 pr-3 text-accent">{action.id}</td><td className="py-3 pr-3 font-medium text-fg">{action.title}</td><td className="py-3 pr-3 text-muted">{action.owner}</td><td className="py-3 pr-3 text-muted">{action.stage}</td><td className="py-3 pr-3 text-muted">{FOUNDER_STATUS_LABELS[action.status]}</td><td className="py-3 text-muted">{action.dependency ?? action.outcome}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-accent">Program gates</h2>
            <div className="grid gap-3 md:grid-cols-5">
              {FOUNDER_GATES.map((gate) => {
                const gateActions = founderActions.filter((action) => gate.controls.includes(action.id as never));
                const blocked = gateActions.some((action) => action.status === "blocked");
                const active = gateActions.some((action) => action.status === "active" || action.status === "next");
                return (
                  <div key={gate.gate} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-accent">{gate.gate}</span><span className={blocked ? "text-[10px] uppercase text-warn" : active ? "text-[10px] uppercase text-green" : "text-[10px] uppercase text-subtle"}>{blocked ? "Blocked" : active ? "Active" : "Waiting"}</span></div>
                    <p className="mt-2 text-xs font-medium text-fg">{gate.title}</p>
                    <p className="mt-1 text-[10px] text-muted">{gate.when} · {gate.controls.join(" · ")}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {accessible("/command/founder-command") && <WorkLink to="/command/founder-command" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Founder action & evidence ledger</WorkLink>}
            {accessible("/command/actions") && <WorkLink to="/command/actions" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Audit & action log</WorkLink>}
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-border bg-surface/25 p-4">
        <summary className="cursor-pointer text-sm font-medium text-fg">Support & methodology</summary>
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Investor / board evidence", "/command/investor-board"],
            ["Classification register", "/command/classification"],
            ["Governance approvals", "/command/governance"],
          ]
            .filter(([, to]) => accessible(to))
            .map(([label, to]) => <WorkLink key={to} to={to} className="rounded-md border border-border p-3 hover:border-accent hover:text-fg">{label}</WorkLink>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-subtle">Command summarizes evidence; it does not own detailed transactions. Action Inbox remains the governed queue, Operations reconciles fulfillment lineage, ERP Reports provide read-only evidence and VIBPE remains advisory.</p>
      </details>
    </div>
  );
}
