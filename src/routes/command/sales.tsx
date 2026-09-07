import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { MODELS } from "@/lib/data/models";
import { listMonthlyActuals } from "@/lib/actuals-authority";
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
import { listSalesOrders, saveSalesOrder } from "@/lib/sales-order-authority";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/sales")({ component: Commercial });

const statusOptions: SalesOrderStatus[] = ["lead", "confirmed", "delivered", "cancelled"];
const channelOptions: SalesChannel[] = ["direct", "dealer", "online"];
const initialVariant = MODELS[0];
const financeProductFor = (tier: ProductTier): ProductLineId =>
  tier === "core" ? "aluminium" : tier === "apex" ? "premiumCarbon" : "carbon";

function Commercial() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [actuals, setActuals] = useState<Record<number, { units?: number | null; revenue?: number | null }>>({});
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
    const [orderRows, actualRows] = await Promise.all([listSalesOrders(), listMonthlyActuals()]);
    setOrders(orderRows);
    const compact: Record<number, { units?: number | null; revenue?: number | null }> = {};
    Object.entries(actualRows).forEach(([month, value]) => {
      compact[Number(month)] = { units: value.units, revenue: value.revenue };
    });
    setActuals(compact);
  }

  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load the central order book."));
  }, []);

  const sales = useMemo(() => buildSalesMonths(rows, finance, orders, actuals, accounting), [rows, finance, orders, actuals, accounting]);
  const totals = salesTotals(sales);
  const planned12 = sales.slice(0, 12).reduce((sum, month) => sum + month.plannedUnits, 0);
  const confirmed12 = orders.filter((o) => o.month <= 12 && (o.status === "confirmed" || o.status === "delivered")).reduce((s, o) => s + o.units, 0);
  const coverage = planned12 > 0 ? (confirmed12 / planned12) * 100 : 0;
  const committedUnits = orders.filter((o) => o.status === "confirmed" || o.status === "delivered").reduce((s, o) => s + o.units, 0);
  const leads = orders.filter((o) => o.status === "lead").length;
  const openReceivables = sales.at(-1)?.openReceivables ?? 0;

  async function persist(order: SalesOrder, reason: string) {
    setBusy(true);
    setMessage("");
    try {
      const write = await saveSalesOrder({ data: { ...order, changeReason: reason } });
      const projection = await syncProductionJobCard({ data: { salesOrderId: order.id } });
      await refresh();
      setMessage(
        projection.state === "pipeline"
          ? `${order.id} revision ${write.revision} saved as pipeline demand.`
          : projection.state === "released"
            ? `${order.id} revision ${write.revision} synchronized to Production job card ${projection.id}.`
            : `${order.id} revision ${write.revision} saved; Production state is ${projection.state}.`,
      );
    } catch (error) {
      await refresh().catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Order update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addOrder() {
    const variant = MODELS.find((entry) => entry.id === draft.variantId);
    if (!variant || draft.month < 1 || draft.month > 36 || draft.units <= 0) return;
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

  async function updateOrder(id: string, key: "month" | "units" | "status", value: number | string) {
    const current = orders.find((order) => order.id === id);
    if (!current) return;
    const updated = { ...current, [key]: key === "status" ? value : Number(value) } as SalesOrder;
    await persist(updated, `Commercial revision: ${key} changed`);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Commercial · central demand to cash</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Commercial</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          One centrally persisted order book. Leads remain pipeline; confirmed orders become committed demand and must synchronize through the exact released variant BOM before Production can reserve inventory.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="M1–M12 plan" value={`${planned12} units`} hint={`${scenario} scenario`} />
        <Kpi label="Confirmed coverage" value={`${coverage.toFixed(0)}%`} hint={`${confirmed12} committed units`} tone={coverage >= 80 ? "ok" : coverage >= 50 ? "warn" : "danger"} />
        <Kpi label="Committed order book" value={lakh(totals.ordersRevenue)} hint={`${committedUnits} units · ${leads} leads`} />
        <Kpi label="Collections" value={lakh(totals.collections)} hint={`AR ${lakh(openReceivables)}`} />
      </div>

      {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <Panel title="Demand & order book" kicker="Exact VINDY variant + controlled options">
        <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-5">
          <Field label="Month"><input type="number" min="1" max="36" value={draft.month} onChange={(e) => setDraft({ ...draft, month: Number(e.target.value) })} className="control mt-1" /></Field>
          <Field label="Model & variant"><select value={draft.variantId} onChange={(e) => { const variantId=e.target.value; setDraft({ ...draft, variantId, configuration: defaultConfiguration(variantId) }); }} className="control mt-1">{MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
          <Field label="Units"><input type="number" min="1" value={draft.units} onChange={(e) => setDraft({ ...draft, units: Number(e.target.value) })} className="control mt-1" /></Field>
          <Field label="Channel"><select value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as SalesChannel })} className="control mt-1">{channelOptions.map((channel)=><option key={channel}>{channel}</option>)}</select></Field>
          <Field label="Status"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as SalesOrderStatus })} className="control mt-1">{statusOptions.map((status)=><option key={status}>{status}</option>)}</select></Field>
          <button type="button" disabled={busy} onClick={() => void addOrder()} className="self-end rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">Add demand / order</button>
        </div>

        <details className="mt-3 rounded-xl border border-border bg-bg-elevated/30 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-fg">Component options · catalogue eligibility is not production release</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIGURATION_CATEGORIES.map(({ key, label }) => {
              const variant = MODELS.find((entry) => entry.id === draft.variantId)!;
              const choices = optionsFor(variant.tier, key);
              return <Field key={key} label={label}><select value={draft.configuration[key] ?? ""} disabled={key === "groupset"} onChange={(e) => setDraft({ ...draft, configuration: { ...draft.configuration, [key]: e.target.value } as ProductConfiguration })} className="control mt-1 disabled:opacity-70">{choices.map((choice)=><option key={choice.id} value={choice.id}>{choice.brand} {choice.model} · {choice.sku}</option>)}</select></Field>;
            })}
          </div>
          <p className="mt-3 text-xs text-warn">A confirmed order does not create stock. Production release also requires an approved exact-variant BOM mapping for every selected option.</p>
        </details>

        {orders.length === 0 ? <p className="mt-4 text-sm text-muted">No centrally persisted orders yet.</p> : (
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3">Month</th><th className="px-3 py-3 text-left">Variant</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Value</th><th className="px-3 py-3">Channel</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{orders.map((order)=><tr key={order.id} className="border-t border-border"><td className="px-3 py-3 font-mono text-xs text-muted">{order.id}</td><td className="px-3 py-3"><input disabled={busy} type="number" min="1" max="36" value={order.month} onChange={(e)=>void updateOrder(order.id,"month",Number(e.target.value))} className="w-16 rounded border border-border bg-bg px-2 py-1 text-fg" /></td><td className="px-3 py-3 text-fg">{order.variantName ?? order.variantId ?? order.product}{order.modelTier ? <span className="block text-[10px] uppercase text-subtle">{modelFamily(order.modelTier)} · {Object.keys(order.configuration ?? {}).length} options</span> : null}</td><td className="px-3 py-3 text-right"><input disabled={busy} type="number" min="1" value={order.units} onChange={(e)=>void updateOrder(order.id,"units",Number(e.target.value))} className="w-16 rounded border border-border bg-bg px-2 py-1 text-right text-fg" /></td><td className="px-3 py-3 text-right tabular-nums">{lakh(order.units * order.aspLakh)}</td><td className="px-3 py-3 text-center text-xs text-muted">{order.channel}</td><td className="px-3 py-3"><select disabled={busy} value={order.status} onChange={(e)=>void updateOrder(order.id,"status",e.target.value)} className="rounded border border-border bg-bg px-2 py-1 text-xs text-fg">{statusOptions.map((status)=><option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>
        )}
      </Panel>

      <details className="rounded-xl border border-border bg-surface/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg">36-month plan, commitments, actuals & collections</summary>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[950px] text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Plan units</th><th className="px-3 py-3 text-right">Orders</th><th className="px-3 py-3 text-right">Actual units</th><th className="px-3 py-3 text-right">Plan revenue</th><th className="px-3 py-3 text-right">Orders value</th><th className="px-3 py-3 text-right">Actual revenue</th><th className="px-3 py-3 text-right">Collections</th></tr></thead><tbody>{sales.map((month)=><tr key={month.m} className="border-t border-border"><td className="px-3 py-2 font-medium">M{month.m}</td><td className="px-3 py-2 text-right">{month.plannedUnits}</td><td className="px-3 py-2 text-right">{month.ordersUnits || "—"}</td><td className="px-3 py-2 text-right">{actuals[month.m]?.units ?? "—"}</td><td className="px-3 py-2 text-right">{lakh(month.plannedRevenue)}</td><td className="px-3 py-2 text-right">{lakh(month.ordersRevenue)}</td><td className="px-3 py-2 text-right">{actuals[month.m]?.revenue == null ? "—" : lakh(actuals[month.m]?.revenue ?? 0)}</td><td className="px-3 py-2 text-right text-accent">{lakh(month.collections)}</td></tr>)}</tbody></table></div>
      </details>

      <Panel title="Connected controls" kicker="One owner per concept"><div className="flex flex-wrap gap-2"><Link to="/command/production-jobcards" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Production handoff</Link><Link to="/command/procurement-planning" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Procurement reconciliation</Link><Link to="/command/actuals" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Actuals</Link><Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Plan assumptions</Link></div></Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-muted">{label}{children}</label>;
}
