import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { listMonthlyActuals } from "@/lib/actuals-authority";
import { MODELS } from "@/lib/data/models";
import { buildModelWithInputs, type ProductLineId, type ScenarioId } from "@/lib/finance/model";
import {
  buildSalesMonths,
  productAsp,
  salesTotals,
  type SalesChannel,
  type SalesOrder,
  type SalesOrderStatus,
} from "@/lib/finance/sales-engine";
import { lakh } from "@/lib/format";
import {
  CONFIGURATION_CATEGORIES,
  defaultConfiguration,
  modelFamily,
  optionsFor,
  type ProductConfiguration,
  type ProductTier,
} from "@/lib/product-configuration";
import { syncProductionJobCard } from "@/lib/production-job-card";
import { getSalesOrderWriteReadiness, listSalesOrders, saveSalesOrder } from "@/lib/sales-order-authority";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/sales")({ component: Commercial });
const statusOptions: SalesOrderStatus[] = ["lead", "confirmed", "delivered", "cancelled"];
const channelOptions: SalesChannel[] = ["direct", "dealer", "online"];
const initialVariant = MODELS.find((model) => model.id === "core-105") ?? MODELS[0];
const financeProductFor = (tier: ProductTier): ProductLineId =>
  tier === "core" ? "aluminium" : tier === "apex" ? "premiumCarbon" : "carbon";

type WriteReadiness = {
  role: string | null;
  signedIn: boolean;
  email: string | null;
  canEdit: boolean;
  canApprove: boolean;
};

function Commercial() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const rows = useMemo(
    () => buildModelWithInputs(scenario, drawStandby, finance),
    [scenario, drawStandby, finance],
  );
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [orderEdits, setOrderEdits] = useState<Record<string, SalesOrder>>({});
  const [actuals, setActuals] = useState<Record<number, { units?: number | null; revenue?: number | null }>>({});
  const [writeReadiness, setWriteReadiness] = useState<WriteReadiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    month: 1,
    variantId: initialVariant.id,
    units: 1,
    channel: "direct" as SalesChannel,
    status: "confirmed" as SalesOrderStatus,
    configuration: defaultConfiguration(initialVariant.id),
  });

  async function refresh() {
    const [orderRows, actualRows, readiness] = await Promise.all([
      listSalesOrders(),
      listMonthlyActuals(),
      getSalesOrderWriteReadiness(),
    ]);
    setOrders(orderRows);
    setOrderEdits(Object.fromEntries(orderRows.map((order) => [order.id, { ...order, configuration: { ...(order.configuration ?? {}) } }])));
    setWriteReadiness(readiness);
    const compact: Record<number, { units?: number | null; revenue?: number | null }> = {};
    Object.entries(actualRows).forEach(([month, value]) => {
      compact[Number(month)] = { units: value.units, revenue: value.revenue };
    });
    setActuals(compact);
  }

  useEffect(() => {
    void refresh().catch((error) =>
      setMessage(error instanceof Error ? error.message : "Unable to load the central order book."),
    );
  }, []);

  const sales = useMemo(
    () => buildSalesMonths(rows, finance, orders, actuals, accounting),
    [rows, finance, orders, actuals, accounting],
  );
  const totals = salesTotals(sales);
  const planned12 = sales.slice(0, 12).reduce((sum, month) => sum + month.plannedUnits, 0);
  const confirmed12 = orders
    .filter((order) => order.month <= 12 && (order.status === "confirmed" || order.status === "delivered"))
    .reduce((sum, order) => sum + order.units, 0);
  const coverage = planned12 > 0 ? (confirmed12 / planned12) * 100 : 0;
  const committedUnits = orders
    .filter((order) => order.status === "confirmed" || order.status === "delivered")
    .reduce((sum, order) => sum + order.units, 0);
  const leads = orders.filter((order) => order.status === "lead").length;
  const openReceivables = sales.at(-1)?.openReceivables ?? 0;
  const canWrite = Boolean(writeReadiness?.canEdit);

  async function persist(order: SalesOrder, reason: string) {
    setBusy(true);
    setMessage("");

    let write: Awaited<ReturnType<typeof saveSalesOrder>>;
    try {
      write = await saveSalesOrder({ data: { ...order, changeReason: reason } });
      await refresh();
      setMessage(
        `${write.id} revision ${write.revision} is persisted in the central Commercial order ledger. Production synchronization is now being evaluated.`,
      );
    } catch (error) {
      await refresh().catch(() => undefined);
      const detail = error instanceof Error ? error.message : "Order update failed.";
      setMessage(
        detail === "Unauthorized"
          ? "Order was NOT saved. The Command password only unlocks the workspace; sign in with an individual VYNDI account before creating business transactions."
          : `Order was NOT saved: ${detail}`,
      );
      setBusy(false);
      return;
    }

    try {
      const projection = await syncProductionJobCard({ data: { salesOrderId: order.id } });
      await refresh();
      setMessage(
        projection.state === "pipeline"
          ? `${order.id} revision ${write.revision} is persisted as pipeline demand; no Production job card is required yet.`
          : projection.state === "released"
            ? `${order.id} revision ${write.revision} is persisted and synchronized to Production build ${projection.id} using ${projection.bomAuthority === "family-standard" ? "the released family-standard BOM" : "the exact variant BOM"}.`
            : `${order.id} revision ${write.revision} is persisted; Production state is ${projection.state}.`,
      );
    } catch (error) {
      await refresh().catch(() => undefined);
      const detail = error instanceof Error ? error.message : "Production synchronization failed.";
      setMessage(
        `${order.id} revision ${write.revision} IS persisted in Commercial, but Production synchronization failed: ${detail}. The order remains in the Order register for reconciliation.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function addOrder() {
    const variant = MODELS.find((entry) => entry.id === draft.variantId);
    if (!variant || draft.month < 1 || draft.month > 36 || draft.units <= 0 || !canWrite) return;
    const product = financeProductFor(variant.tier);
    const asp = variant.asp / 100_000 || productAsp(finance, product);
    if (asp <= 0) return;
    const order: SalesOrder = {
      id: `SO-${crypto.randomUUID()}`,
      month: draft.month,
      product,
      units: draft.units,
      aspLakh: asp,
      channel: draft.channel,
      status: draft.status,
      modelTier: variant.tier,
      variantId: variant.id,
      variantName: variant.name,
      configuration: draft.configuration,
    };
    await persist(order, "Created in Commercial workspace");
  }

  function editOrder(id: string, patch: Partial<SalesOrder>) {
    setOrderEdits((current) => {
      const basis = current[id] ?? orders.find((order) => order.id === id);
      if (!basis) return current;
      return { ...current, [id]: { ...basis, ...patch } };
    });
  }

  function editOrderVariant(id: string, variantId: string) {
    const variant = MODELS.find((entry) => entry.id === variantId);
    if (!variant) return;
    const product = financeProductFor(variant.tier);
    editOrder(id, {
      product,
      aspLakh: variant.asp / 100_000 || productAsp(finance, product),
      modelTier: variant.tier,
      variantId: variant.id,
      variantName: variant.name,
      configuration: defaultConfiguration(variant.id),
    });
  }

  function editOrderConfiguration(id: string, key: keyof ProductConfiguration, value: string) {
    const current = orderEdits[id] ?? orders.find((order) => order.id === id);
    if (!current) return;
    editOrder(id, { configuration: { ...(current.configuration ?? {}), [key]: value } as ProductConfiguration });
  }

  async function saveOrderRevision(id: string) {
    const original = orders.find((order) => order.id === id);
    const updated = orderEdits[id];
    if (!original || !updated || !canWrite) return;
    if (updated.month < 1 || updated.month > 36 || updated.units <= 0) {
      setMessage("Order revision was not saved: month must be M1–M36 and units must be greater than zero.");
      return;
    }
    await persist(updated, "Controlled Commercial order revision");
  }

  const currentVariant = MODELS.find((entry) => entry.id === draft.variantId)!;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Commercial · single bicycle selection to controlled build</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Commercial</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Select the bicycle model/variant and quantity. Its standard component configuration is loaded automatically. A confirmed order is first persisted to the central order ledger, then synchronized to one controlled Production job card.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="M1–M12 plan" value={`${planned12} units`} hint={`${scenario} scenario`} />
        <Kpi label="Confirmed coverage" value={`${coverage.toFixed(0)}%`} hint={`${confirmed12} committed units`} tone={coverage >= 80 ? "ok" : coverage >= 50 ? "warn" : "danger"} />
        <Kpi label="Committed order book" value={lakh(totals.ordersRevenue)} hint={`${committedUnits} units · ${leads} leads`} />
        <Kpi label="Collections" value={lakh(totals.collections)} hint={`AR ${lakh(openReceivables)}`} />
      </div>

      {writeReadiness && !writeReadiness.canEdit ? (
        <div className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3 text-sm text-muted">
          {writeReadiness.signedIn ? (
            <>
              Signed in as <span className="font-semibold text-fg">{writeReadiness.email ?? "VYNDI user"}</span>, but role <span className="font-semibold text-fg">{writeReadiness.role ?? "unassigned"}</span> does not have Commercial edit authority.
            </>
          ) : (
            <>
              Workspace access is unlocked as <span className="font-semibold text-fg">{writeReadiness.role ?? "legacy user"}</span>, but no individual VYNDI identity is signed in. Business transactions are intentionally blocked for shared Command-password sessions. <Link to="/login" className="font-semibold text-accent hover:underline">Sign in to create orders →</Link>
            </>
          )}
        </div>
      ) : writeReadiness?.canEdit ? (
        <div className="rounded-lg border border-green/30 bg-green/5 px-4 py-3 text-sm text-muted">
          Business write authority verified · {writeReadiness.email ?? "signed-in user"} · role {writeReadiness.role}. Every order write must return a persisted revision receipt before Production synchronization starts.
        </div>
      ) : null}

      {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <Panel title="Create bicycle demand / order" kicker="Persist Commercial truth first · then synchronize Production">
        <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-5">
          <Field label="Month"><input type="number" min="1" max="36" value={draft.month} onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })} className="control mt-1" /></Field>
          <Field label="Model & variant"><select value={draft.variantId} onChange={(event) => { const variantId = event.target.value; setDraft({ ...draft, variantId, configuration: defaultConfiguration(variantId) }); }} className="control mt-1">{MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
          <Field label="Units"><input type="number" min="1" value={draft.units} onChange={(event) => setDraft({ ...draft, units: Number(event.target.value) })} className="control mt-1" /></Field>
          <Field label="Channel"><select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as SalesChannel })} className="control mt-1">{channelOptions.map((channel) => <option key={channel}>{channel}</option>)}</select></Field>
          <Field label="Status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as SalesOrderStatus })} className="control mt-1">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <button type="button" disabled={busy || !canWrite} onClick={() => void addOrder()} className="self-end rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">
            {canWrite ? "Add demand / order" : "Sign in to create order"}
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-green/30 bg-green/5 p-4">
          <p className="text-xs font-semibold text-green">Automatic build selection</p>
          <p className="mt-1 text-xs leading-5 text-muted">{currentVariant.name} has {CONFIGURATION_CATEGORIES.length} standard component categories preselected. Confirmed demand carries these selections into the released BOM/job-card workflow only after the order persistence receipt succeeds.</p>
        </div>
        <details className="mt-3 rounded-xl border border-border bg-bg-elevated/30 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-fg">Optional component customization · defaults already selected</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIGURATION_CATEGORIES.map(({ key, label }) => {
              const choices = optionsFor(currentVariant.tier, key);
              return <Field key={key} label={label}><select value={draft.configuration[key] ?? ""} disabled={key === "groupset"} onChange={(event) => setDraft({ ...draft, configuration: { ...draft.configuration, [key]: event.target.value } as ProductConfiguration })} className="control mt-1 disabled:opacity-70">{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.brand} {choice.model} · {choice.sku}</option>)}</select></Field>;
            })}
          </div>
          <p className="mt-3 text-xs text-warn">If customization differs from the released family-standard BOM, VYNDI will require an exact variant BOM release before Production. No silent substitution is allowed.</p>
        </details>
      </Panel>

      <Panel title="Order register" kicker="Centrally persisted Commercial commitments · revise here, never inside the Job Card">
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No centrally persisted orders yet. A successful creation will appear here immediately before Production synchronization is attempted.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => {
              const edit = orderEdits[order.id] ?? order;
              const editVariant = MODELS.find((entry) => entry.id === edit.variantId) ?? initialVariant;
              const changed = JSON.stringify(edit) !== JSON.stringify(order);
              return (
                <article key={order.id} className="rounded-xl border border-border bg-bg-elevated/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold text-fg">{order.variantName ?? order.variantId ?? order.product}</p><p className="mt-1 font-mono text-[10px] text-subtle">{order.id}</p></div>
                    <span className="text-[10px] font-bold uppercase text-accent">{order.status}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <Mini label="Family" value={order.modelTier ? modelFamily(order.modelTier) : "—"} />
                    <Mini label="Configuration" value={`${Object.keys(order.configuration ?? {}).length} controlled selections`} />
                    <Mini label="Value" value={lakh(order.units * order.aspLakh)} />
                    <Mini label="Channel" value={order.channel} />
                  </div>

                  <details className="mt-4 rounded-lg border border-border bg-bg/40 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-fg">Revise order / configuration</summary>
                    <fieldset disabled={busy || !canWrite} className="mt-3 space-y-3 disabled:opacity-60">
                      <Field label="Model & variant"><select value={edit.variantId ?? editVariant.id} onChange={(event) => editOrderVariant(order.id, event.target.value)} className="control mt-1">{MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Month"><input type="number" min="1" max="36" value={edit.month} onChange={(event) => editOrder(order.id, { month: Number(event.target.value) })} className="control mt-1" /></Field>
                        <Field label="Units"><input type="number" min="1" value={edit.units} onChange={(event) => editOrder(order.id, { units: Number(event.target.value) })} className="control mt-1" /></Field>
                        <Field label="Channel"><select value={edit.channel} onChange={(event) => editOrder(order.id, { channel: event.target.value as SalesChannel })} className="control mt-1">{channelOptions.map((channel) => <option key={channel}>{channel}</option>)}</select></Field>
                        <Field label="Status"><select value={edit.status} onChange={(event) => editOrder(order.id, { status: event.target.value as SalesOrderStatus })} className="control mt-1">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>
                      </div>
                      <details className="rounded-lg border border-border/70 p-3">
                        <summary className="cursor-pointer text-[11px] font-semibold text-muted">Component configuration</summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {CONFIGURATION_CATEGORIES.map(({ key, label }) => {
                            const choices = optionsFor(editVariant.tier, key);
                            return <Field key={key} label={label}><select value={edit.configuration?.[key] ?? ""} disabled={key === "groupset"} onChange={(event) => editOrderConfiguration(order.id, key, event.target.value)} className="control mt-1 disabled:opacity-70">{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.brand} {choice.model}</option>)}</select></Field>;
                          })}
                        </div>
                      </details>
                    </fieldset>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" disabled={busy || !canWrite || !changed} onClick={() => void saveOrderRevision(order.id)} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">Save & synchronize revision</button>
                      {changed ? <span className="text-[10px] font-semibold text-warn">Unsaved revision</span> : <span className="text-[10px] text-subtle">Matches persisted order</span>}
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-subtle">Saving creates a Commercial revision first, then revalidates the released BOM and reconciles the Job Card. An already-approved build cannot be silently replaced; it requires a controlled production change.</p>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <details className="rounded-xl border border-border bg-surface/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg">36-month plan, commitments, actuals & collections</summary>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sales.map((month) => <div key={month.m} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between"><span className="font-semibold">M{month.m}</span><span className="text-xs text-accent">Plan {month.plannedUnits}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Mini label="Orders" value={String(month.ordersUnits || "—")} /><Mini label="Actual units" value={String(actuals[month.m]?.units ?? "—")} /><Mini label="Plan revenue" value={lakh(month.plannedRevenue)} /><Mini label="Orders value" value={lakh(month.ordersRevenue)} /><Mini label="Actual revenue" value={actuals[month.m]?.revenue == null ? "—" : lakh(actuals[month.m]?.revenue ?? 0)} /><Mini label="Collections" value={lakh(month.collections)} /></div></div>)}
        </div>
      </details>

      <Panel title="Connected controls" kicker="One owner per concept">
        <div className="flex flex-wrap gap-2">
          <Link to="/command/production" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Production release</Link>
          <Link to="/command/procurement-planning" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Procurement reconciliation</Link>
          <Link to="/command/actuals" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Actuals</Link>
          <Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Plan assumptions</Link>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-muted"><span className="block">{label}</span>{children}</label>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] uppercase tracking-wider text-subtle">{label}</p><p className="mt-1 break-words font-semibold text-fg">{value}</p></div>;
}
