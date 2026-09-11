import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Kpi } from "@/components/kpi";
import { getDecisionInboxData } from "@/lib/procure-to-pay-authority";
import { updateIbpeManagementActionLifecycle } from "@/lib/ibpe-operating-governance";

export const Route = createFileRoute("/command/decision-inbox")({
  loader: () => getDecisionInboxData(),
  component: DecisionInbox,
});

type Item = Record<string, unknown>;
const text = (row: Item, key: string) => String(row[key] ?? "");

function DecisionInbox() {
  const { items } = Route.useLoaderData();
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function transitionIbpeAction(actionId: string, status: "in_progress" | "done") {
    setBusyAction(actionId);
    setMessage("");
    try {
      await updateIbpeManagementActionLifecycle({ data: { actionId, status } });
      setMessage(status === "done"
        ? "Management action completed and removed from the active inbox."
        : "Management action moved to in progress.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update management action.");
    } finally {
      setBusyAction(null);
    }
  }

  const high = items.filter((item) => text(item, "priority") === "high").length;
  const approvals = items.filter(
    (item) => text(item, "kind").includes("approval") || text(item, "kind").includes("Payable"),
  ).length;
  const exceptions = items.length - approvals;
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = text(item, "kind") || "Other";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">Command Centre · exception first</p>
        <h1 className="mt-2 font-display text-4xl text-accent">Business Action Inbox</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Compact governed register across planning, procurement, receiving, finance and IBPE actions.
          Related queues stay collapsed by default; expand only the evidence you need. Protected transactions
          remain owned by their canonical workspaces.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Needs action" value={String(items.length)} hint={`${groups.length} grouped queues`} tone={items.length ? "warn" : "ok"} />
        <Kpi label="High priority" value={String(high)} hint="Blocks execution or truth" tone={high ? "danger" : "ok"} />
        <Kpi label="Approvals" value={String(approvals)} hint="Authorised decision required" />
        <Kpi label="Exceptions" value={String(exceptions)} hint="Resolve at source" />
      </div>

      {message ? <p className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">{message}</p> : null}

      {items.length === 0 ? (
        <section className="rounded-xl border border-ok/30 bg-ok/5 p-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-ok" />
          <h2 className="mt-3 font-display text-xl text-fg">No governed action is waiting</h2>
        </section>
      ) : null}

      <div className="space-y-3">
        {groups.map(([group, rows]) => (
          <details key={group} className="rounded-xl border border-border bg-surface/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="font-semibold text-fg">{group}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-subtle">{rows.length} open record{rows.length === 1 ? "" : "s"}</p>
              </div>
              <span className="text-xs font-semibold text-accent">Expand register</span>
            </summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full table-auto text-left text-xs">
                <thead className="sticky top-0 bg-bg-elevated text-[10px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Action / item</th>
                    <th className="px-3 py-2">Evidence / lineage</th>
                    <th className="px-3 py-2">Lifecycle</th>
                    <th className="px-3 py-2 text-right">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const id = text(item, "id");
                    const isIbpe = group === "IBPE management action";
                    const status = text(item, "status") || "open";
                    return (
                      <tr key={`${group}-${id}`} className="border-t border-border/70 align-top">
                        <td className="px-3 py-3">
                          <span className={text(item, "priority") === "high" ? "font-bold uppercase text-danger" : "font-bold uppercase text-warn"}>
                            {text(item, "priority")}
                          </span>
                        </td>
                        <td className="max-w-[320px] px-3 py-3 font-medium text-fg">{text(item, "title")}</td>
                        <td className="max-w-[420px] px-3 py-3 text-muted">{text(item, "detail")}</td>
                        <td className="px-3 py-3 text-muted">{isIbpe ? status.replaceAll("_", " ") : "source-owned"}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            {isIbpe && status === "open" ? (
                              <button
                                type="button"
                                disabled={busyAction === id}
                                onClick={() => transitionIbpeAction(id, "in_progress")}
                                className="rounded-md border border-border px-3 py-1.5 font-semibold text-fg hover:border-accent hover:text-accent disabled:opacity-50"
                              >
                                Start
                              </button>
                            ) : null}
                            {isIbpe ? (
                              <button
                                type="button"
                                disabled={busyAction === id}
                                onClick={() => transitionIbpeAction(id, "done")}
                                className="rounded-md border border-ok/40 px-3 py-1.5 font-semibold text-ok disabled:opacity-50"
                              >
                                Complete
                              </button>
                            ) : null}
                            <Link
                              to={text(item, "route") as never}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 font-semibold text-accent hover:border-accent"
                            >
                              Open <ArrowRight className="size-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs leading-5 text-subtle">
        Queue scope: pending plan and PO approvals, matched or blocked supplier invoices, receiving exceptions,
        current-revision active production-material shortages and open IBPE management actions.
      </p>
    </main>
  );
}
