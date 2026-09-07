import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs, type ProductLineId, type ScenarioId } from "@/lib/finance/model";
import { buildSalesMonths, productAsp, salesTotals, type SalesChannel, type SalesOrder, type SalesOrderStatus } from "@/lib/finance/sales-engine";
import { createProductionJobCard } from "@/lib/production-job-card";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/sales")({ component: Commercial });

const ORDERS_KEY = "veloxis-sales-orders-v1";
const ACTUALS_KEY = "veloxis-actuals-v1";
const statusOptions: SalesOrderStatus[] = ["lead", "confirmed", "delivered", "cancelled"];
const channelOptions: SalesChannel[] = ["direct", "dealer", "online"];

function Commercial() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [actuals, setActuals] = useState<Record<number, { units?: number | null; revenue?: number | null }>>({});
  const [jobCardMessage, setJobCardMessage] = useState("");
  const [draft, setDraft] = useState({ month: 1, product: "carbon" as ProductLineId, units: 1, channel: "direct" as SalesChannel, status: "confirmed" as SalesOrderStatus });

  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem(ORDERS_KEY);
      if (savedOrders) setOrders(JSON.parse(savedOrders));
      const savedActuals = localStorage.getItem(ACTUALS_KEY);
      if (savedActuals) {
        const parsed = JSON.parse(savedActuals);
        const compact: Record<number, { units?: number | null; revenue?: number | null }> = {};
        Object.entries(parsed).forEach(([month, value]: any) => {
          compact[Number(month)] = { units: value?.units, revenue: value?.revenue };
        });
        setActuals(compact);
      }
    } catch {
      // Missing or malformed local actuals leave the sales actuals map empty.
    }
  }, []);

  const sales = useMemo(() => buildSalesMonths(rows, finance, orders, actuals, accounting), [rows, finance, orders, actuals, accounting]);
  const totals = salesTotals(sales);
  const planned12 = sales.slice(0, 12).reduce((sum, month) => sum + month.plannedUnits, 0);
  const confirmed12 = orders.filter((order) => order.month <= 12 && (order.status === "confirmed" || order.status === "delivered")).reduce((sum, order) => sum + order.units, 0);
  const coverage = planned12 > 0 ? (confirmed12 / planned12) * 100 : 0;
  const confirmedUnits = orders.filter((order) => order.status === "confirmed" || order.status === "delivered").reduce((sum, order) => sum + order.units, 0);
  const leads = orders.filter((order) => order.status === "lead").length;
  const latestActualMonth = Object.entries(actuals).filter(([, value]) => value.revenue != null || value.units != null).map(([month]) => Number(month)).sort((a, b) => b - a)[0] ?? null;
  const latestVariance = latestActualMonth ? sales[latestActualMonth - 1]?.varianceRevenue ?? 0 : null;
  const openReceivables = sales.at(-1)?.openReceivables ?? 0;

  const alerts = [
    ...(planned12 > 0 && coverage < 50 ? [{ tone: "warn", title: "Demand coverage below 50%", detail: `${confirmed12} confirmed/delivered units against ${planned12} planned units through M12.`, to: "/command/sales" }] : []),
    ...(confirmedUnits === 0 ? [{ tone: "warn", title: "No confirmed orders", detail: "The plan contains demand, but the order book has no confirmed or delivered units yet.", to: "/command/sales" }] : []),
    ...(leads > 0 ? [{ tone: "ok", title: `${leads} lead${leads === 1 ? "" : "s"} in pipeline`, detail: "Convert or close leads explicitly so pipeline does not masquerade as committed demand.", to: "/command/sales" }] : []),
    ...(latestVariance !== null && latestVariance < 0 ? [{ tone: "danger", title: "Actual revenue below plan", detail: `Latest actual month M${latestActualMonth} is ${lakh(latestVariance)} versus plan.`, to: "/command/actuals" }] : []),
  ];

  function saveOrders(next: SalesOrder[]) {
    setOrders(next);
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(next)); } catch {
      // Storage may be unavailable; the current order-book state remains in memory.
    }
  }

  async function ensureJobCard(order: SalesOrder) {
    if (order.status === "cancelled") return;
    const productLabel = finance.productLines.find((product) => product.id === order.product)?.label ?? order.product;
    try {
      const result = await createProductionJobCard({ data: { salesOrderId: order.id, productId: order.product, productLabel, units: order.units, dueMonth: order.month, status: order.status === "confirmed" ? "released" : "planned" } });
      setJobCardMessage(result.created ? `Production job card ${result.id} raised for ${order.id}.` : `Production job card ${result.id} already exists for ${order.id}.`);
    } catch (error) {
      setJobCardMessage(error instanceof Error ? `Order ${order.id} saved, but production handoff was not raised: ${error.message}` : `Order ${order.id} saved, but production handoff failed.`);
    }
  }

  async function addOrder() {
    const asp = productAsp(finance, draft.product);
    if (draft.month < 1 || draft.month > 36 || draft.units <= 0 || asp <= 0) return;
    const order: SalesOrder = { id: `SO-${Date.now()}`, month: draft.month, product: draft.product, units: draft.units, aspLakh: asp, channel: draft.channel, status: draft.status };
    saveOrders([...orders, order]);
    await ensureJobCard(order);
  }

  async function updateOrder(id: string, key: "month" | "units" | "status", value: number | string) {
    const next = orders.map((order) => order.id === id ? { ...order, [key]: key === "status" ? value : Number(value) } : order);
    saveOrders(next);
    const updated = next.find((order) => order.id === id);
    if (updated && key === "status" && updated.status === "confirmed") await ensureJobCard(updated);
  }

  return <div className="space-y-6">
    <header>
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Commercial · demand to cash</p>
      <h1 className="mt-1 font-display text-4xl text-accent">Commercial</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">One commercial workspace for planned demand, live orders, channel execution and collections. The financial plan remains separate; confirmed orders hand off to production without overwriting assumptions.</p>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="M1–M12 plan" value={`${planned12} units`} hint={`${scenario} scenario`} />
      <Kpi label="Confirmed coverage" value={`${coverage.toFixed(0)}%`} hint={`${confirmed12} confirmed / delivered`} tone={coverage >= 80 ? "ok" : coverage >= 50 ? "warn" : "danger"} />
      <Kpi label="Order book" value={lakh(totals.ordersRevenue)} hint={`${confirmedUnits} confirmed / delivered units`} />
      <Kpi label="Collections" value={lakh(totals.collections)} hint={`AR ${lakh(openReceivables)}`} />
    </div>

    <Panel title="Needs attention" kicker="Exceptions only">
      {alerts.length === 0 ? <p className="text-sm text-muted">No material commercial exception is currently detected.</p> : <div className="grid gap-3 lg:grid-cols-2">{alerts.map((alert) => <Link key={alert.title} to={alert.to as never} className="rounded-lg border border-border bg-surface p-4 hover:border-accent"><div className="flex gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.tone === "danger" ? "bg-danger" : alert.tone === "warn" ? "bg-warn" : "bg-ok"}`} /><div><p className="font-medium text-fg">{alert.title}</p><p className="mt-1 text-xs leading-5 text-muted">{alert.detail}</p></div></div></Link>)}</div>}
    </Panel>

    <Panel title="Demand & order book" kicker="Confirmed orders feed production">
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-6">
        <label className="text-xs text-muted">Month<input type="number" min="1" max="36" value={draft.month} onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg" /></label>
        <label className="text-xs text-muted">Product<select value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value as ProductLineId })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg">{finance.productLines.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}</select></label>
        <label className="text-xs text-muted">Units<input type="number" min="1" value={draft.units} onChange={(event) => setDraft({ ...draft, units: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg" /></label>
        <label className="text-xs text-muted">Channel<select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as SalesChannel })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg">{channelOptions.map((channel) => <option key={channel}>{channel}</option>)}</select></label>
        <label className="text-xs text-muted">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as SalesOrderStatus })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
        <button type="button" onClick={addOrder} className="self-end rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg">Add demand / order</button>
      </div>
      {jobCardMessage && <p className="mt-3 rounded-lg border border-border bg-bg-elevated/40 px-3 py-2 text-xs text-muted">{jobCardMessage}</p>}
      {orders.length === 0 ? <p className="mt-4 text-sm text-muted">No order-book entries yet. Add leads or confirmed demand here; the financial plan remains unchanged.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3">Month</th><th className="px-3 py-3 text-left">Product</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Value</th><th className="px-3 py-3">Channel</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-border"><td className="px-3 py-3 text-xs text-muted">{order.id}</td><td className="px-3 py-3"><input type="number" min="1" max="36" value={order.month} onChange={(event) => updateOrder(order.id, "month", Number(event.target.value))} className="w-16 rounded border border-border bg-bg px-2 py-1 text-fg" /></td><td className="px-3 py-3 text-fg">{finance.productLines.find((product) => product.id === order.product)?.label ?? order.product}</td><td className="px-3 py-3 text-right"><input type="number" min="1" value={order.units} onChange={(event) => updateOrder(order.id, "units", Number(event.target.value))} className="w-16 rounded border border-border bg-bg px-2 py-1 text-right text-fg" /></td><td className="px-3 py-3 text-right tabular-nums">{lakh(order.units * order.aspLakh)}</td><td className="px-3 py-3 text-center text-xs text-muted">{order.channel}</td><td className="px-3 py-3"><select value={order.status} onChange={(event) => updateOrder(order.id, "status", event.target.value)} className="rounded border border-border bg-bg px-2 py-1 text-xs text-fg">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>}
    </Panel>

    <details className="rounded-xl border border-border bg-surface/30 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-fg">36-month revenue, collections & variance</summary>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Plan units</th><th className="px-3 py-3 text-right">Orders</th><th className="px-3 py-3 text-right">Actual units</th><th className="px-3 py-3 text-right">Plan revenue</th><th className="px-3 py-3 text-right">Orders value</th><th className="px-3 py-3 text-right">Actual revenue</th><th className="px-3 py-3 text-right">Variance</th><th className="px-3 py-3 text-right">Collections</th><th className="px-3 py-3 text-right">AR</th></tr></thead><tbody>{sales.map((month) => <tr key={month.m} className="border-t border-border"><td className="px-3 py-2 font-medium text-fg">M{month.m}</td><td className="px-3 py-2 text-right tabular-nums">{month.plannedUnits}</td><td className="px-3 py-2 text-right tabular-nums">{month.ordersUnits || "—"}</td><td className="px-3 py-2 text-right tabular-nums">{actuals[month.m]?.units ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums">{lakh(month.plannedRevenue)}</td><td className="px-3 py-2 text-right tabular-nums">{lakh(month.ordersRevenue)}</td><td className="px-3 py-2 text-right tabular-nums">{actuals[month.m]?.revenue == null ? "—" : lakh(actuals[month.m]?.revenue ?? 0)}</td><td className={`px-3 py-2 text-right tabular-nums ${month.varianceRevenue < 0 ? "text-danger" : "text-ok"}`}>{(actuals[month.m]?.revenue != null || month.ordersRevenue > 0) ? lakh(month.varianceRevenue) : "—"}</td><td className="px-3 py-2 text-right tabular-nums text-accent">{lakh(month.collections)}</td><td className="px-3 py-2 text-right tabular-nums">{lakh(month.openReceivables)}</td></tr>)}</tbody></table></div>
    </details>

    <Panel title="Connected controls" kicker="One owner per concept"><div className="flex flex-wrap gap-2"><Link to="/command/gtm" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Go to market</Link><Link to="/command/market-survey" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Market evidence</Link><Link to="/command/production-jobcards" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Production handoff</Link><Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Pricing / mix / launch</Link><Link to="/command/actuals" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Actuals</Link></div></Panel>
  </div>;
}
