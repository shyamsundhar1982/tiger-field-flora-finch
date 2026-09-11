import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  PackageSearch,
} from "lucide-react";
import { Kpi, Panel } from "@/components/kpi";
import { getDecisionInboxData } from "@/lib/procure-to-pay-authority";

export const Route = createFileRoute("/command/decision-inbox")({
  loader: () => getDecisionInboxData(),
  component: DecisionInbox,
});
const text = (row: Record<string, unknown>, key: string) => String(row[key] ?? "");
const iconFor = (kind: string) =>
  kind.includes("Purchase")
    ? PackageSearch
    : kind.includes("Payable")
      ? CircleDollarSign
      : kind.includes("Plan")
        ? ClipboardCheck
        : AlertTriangle;

function DecisionInbox() {
  const { items } = Route.useLoaderData();
  const high = items.filter((item) => text(item, "priority") === "high").length;
  const approvals = items.filter(
    (item) => text(item, "kind").includes("approval") || text(item, "kind").includes("Payable"),
  ).length;
  const exceptions = items.length - approvals;
  const groups = [...new Set(items.map((item) => text(item, "kind")))];
  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">
          Command Centre · exception first
        </p>
        <h1 className="mt-2 font-display text-4xl text-accent">Business Action Inbox</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          One queue for decisions and exceptions across planning, procurement, receiving, finance
          and governed IBPE management actions. This page never owns protected transactions: each
          item opens its owning workspace and preserves separation of duties.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Needs action"
          value={String(items.length)}
          hint={`${groups.length} business queues`}
          tone={items.length ? "warn" : "ok"}
        />
        <Kpi
          label="High priority"
          value={String(high)}
          hint="Blocks execution or truth"
          tone={high ? "danger" : "ok"}
        />
        <Kpi label="Approvals" value={String(approvals)} hint="Authorised decision required" />
        <Kpi label="Exceptions" value={String(exceptions)} hint="Resolve at source" />
      </div>
      {items.length === 0 ? (
        <section className="rounded-xl border border-ok/30 bg-ok/5 p-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-ok" />
          <h2 className="mt-3 font-display text-xl text-fg">No governed action is waiting</h2>
          <p className="mt-2 text-sm text-muted">
            The monitored plan, purchase, receiving, payable and material queues are clear.
          </p>
        </section>
      ) : null}
      {groups.map((group) => (
        <Panel
          key={group}
          title={group}
          kicker={`${items.filter((item) => text(item, "kind") === group).length} open items`}
        >
          <div className="space-y-3">
            {items
              .filter((item) => text(item, "kind") === group)
              .map((item) => {
                const Icon = iconFor(group);
                return (
                  <article
                    key={`${group}-${text(item, "id")}`}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-bg-elevated/30 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-fg">{text(item, "title")}</h3>
                        <span
                          className={
                            text(item, "priority") === "high"
                              ? "text-[10px] font-bold uppercase tracking-wider text-danger"
                              : "text-[10px] font-bold uppercase tracking-wider text-warn"
                          }
                        >
                          {text(item, "priority")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted">{text(item, "detail")}</p>
                    </div>
                    <Link
                      to={text(item, "route") as never}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:border-accent hover:text-accent"
                    >
                      Open workspace <ArrowRight className="size-4" />
                    </Link>
                  </article>
                );
              })}
          </div>
        </Panel>
      ))}
      <p className="text-xs leading-5 text-subtle">
        Queue scope: pending plan and PO approvals, matched or blocked supplier invoices, receiving
        exceptions, live production-material shortages and open IBPE management actions. Protected
        ERP changes still require an authorised transaction in the owning canonical workspace.
      </p>
    </main>
  );
}
