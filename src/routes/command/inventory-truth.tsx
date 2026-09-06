import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getAuthoritativeInventoryMovements, getInventoryControlSummary, getInventoryFifoTrace, getInventoryMslWarnings } from "@/lib/inventory-authority";

export const Route = createFileRoute("/command/inventory-truth")({
  loader: async () => {
    const [summary, balances, movements, mslWarnings, fifoTrace] = await Promise.all([
      getInventoryControlSummary(),
      getAuthoritativeInventory(),
      getAuthoritativeInventoryMovements(),
      getInventoryMslWarnings(),
      getInventoryFifoTrace(),
    ]);
    return { summary, balances, movements, mslWarnings, fifoTrace };
  },
  component: InventoryTruth,
});

function InventoryTruth() {
  const { summary, balances, movements, mslWarnings, fifoTrace } = Route.useLoaderData();
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-green">Operate · authoritative data</p>
      <h1 className="mt-2 text-4xl font-bold text-accent">Inventory truth</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">This control view reads only the server-side EPR inventory ledger. Browser seed inventory and localStorage are deliberately excluded from these balances.</p>
    </div>
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Authoritative SKUs" value={String(summary.skuCount)} />
      <Kpi label="Units on ledger" value={String(summary.totalUnits)} />
      <Kpi label="Inventory value" value={inr(summary.inventoryValueInr)} />
      <Kpi label="Posted openings" value={String(summary.postedOpeningBalanceCount)} />
      <Kpi label="FIFO layers" value={String(summary.fifoLayerCount)} hint={`${summary.fifoUnitsRemaining} units remaining`} />
    </div>

    <Panel title="MSL warnings" kicker={mslWarnings.length ? `${mslWarnings.length} replenishment signal${mslWarnings.length === 1 ? "" : "s"}` : "Stock above minimum"} className="mt-6">
      {mslWarnings.length === 0 ? <Empty message="No active MSL warnings. Inventory is above the configured minimum stock levels." /> :
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.14em] text-green"><tr><th className="px-3 py-3">Status</th><th className="px-3 py-3">Venture</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">On hand</th><th className="px-3 py-3">MSL</th><th className="px-3 py-3">Shortfall</th><th className="px-3 py-3">Lead time</th><th className="px-3 py-3">Action</th></tr></thead><tbody>{mslWarnings.map((x: any) => <tr key={`${x.venture}-${x.sku}-${x.unit}`} className="border-t border-border/70"><td className="px-3 py-3 uppercase text-xs font-semibold">{x.status}</td><td className="px-3 py-3 uppercase">{x.venture}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3 tabular-nums">{Number(x.quantity_balance)}</td><td className="px-3 py-3 tabular-nums">{Number(x.minimum_stock_level)}</td><td className="px-3 py-3 tabular-nums">{Number(x.shortage_quantity)}</td><td className="px-3 py-3 tabular-nums">{Number(x.lead_time_days)} d</td><td className="px-3 py-3"><Link to="/command/procurement" className="font-semibold text-accent">Procure →</Link></td></tr>)}</tbody></table></div>}
    </Panel>

    <Panel title="Control status" className="mt-6">
      <div className="grid gap-3 sm:grid-cols-4 text-sm">
        <Status label="Negative balances" value={summary.negativeBalanceCount === 0 ? "PASS" : `${summary.negativeBalanceCount} ISSUE(S)`} />
        <Status label="Quantity source" value="EPR ledger" />
        <Status label="Cost source" value="Weighted-average cost ledger" />
        <Status label="Issue sequence" value="FIFO" />
      </div>
    </Panel>

    <Panel title="Authoritative balances" className="mt-6">
      {balances.length === 0 ? <Empty message="No authoritative inventory has been posted yet. Controlled opening balances must be approved and posted before stock becomes operational truth." /> :
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.14em] text-green"><tr><th className="px-3 py-3">Venture</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">WAC</th><th className="px-3 py-3">Value</th></tr></thead><tbody>{balances.map((x: any) => <tr key={`${x.venture}-${x.sku}-${x.unit}`} className="border-t border-border/70"><td className="px-3 py-3 uppercase">{x.venture}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3">{x.unit}</td><td className="px-3 py-3 tabular-nums">{Number(x.quantity_balance)}</td><td className="px-3 py-3 tabular-nums">{inr(Number(x.weighted_average_cost_inr))}</td><td className="px-3 py-3 tabular-nums">{inr(Number(x.inventory_value_inr))}</td></tr>)}</tbody></table></div>}
    </Panel>

    <Panel title="FIFO layers" kicker="Oldest receipt consumed first" className="mt-6">
      {fifoTrace.length === 0 ? <Empty message="No open FIFO layers yet. A receipt/opening balance will create a layer when posted." /> :
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.14em] text-green"><tr><th className="px-3 py-3">Received</th><th className="px-3 py-3">Venture</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Received qty</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3">Unit cost</th><th className="px-3 py-3">Allocations</th></tr></thead><tbody>{fifoTrace.map((x: any) => <tr key={x.layer_id} className="border-t border-border/70"><td className="px-3 py-3 text-xs text-muted">{new Date(x.received_at).toLocaleDateString()}</td><td className="px-3 py-3 uppercase">{x.venture}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3 tabular-nums">{Number(x.quantity_received)}</td><td className="px-3 py-3 tabular-nums font-semibold">{Number(x.quantity_remaining)}</td><td className="px-3 py-3 tabular-nums">{inr(Number(x.unit_cost_inr))}</td><td className="px-3 py-3 tabular-nums">{Number(x.allocation_count)}</td></tr>)}</tbody></table></div>}
    </Panel>

    <Panel title="Recent ledger movements" className="mt-6">
      {movements.length === 0 ? <Empty message="No authoritative inventory movements recorded." /> :
        <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.14em] text-green"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Delta</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Unit cost</th><th className="px-3 py-3">Serial / traveller</th><th className="px-3 py-3">Recorded by</th></tr></thead><tbody>{movements.slice(0,100).map((x: any) => <tr key={x.id} className="border-t border-border/70"><td className="px-3 py-3 text-xs text-muted">{new Date(x.created_at).toLocaleString()}</td><td className="px-3 py-3 uppercase text-xs">{x.movement_type}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3 tabular-nums">{Number(x.quantity_delta)}</td><td className="px-3 py-3">{x.unit}</td><td className="px-3 py-3 tabular-nums">{inr(Number(x.unit_cost_inr))}</td><td className="px-3 py-3 text-xs">{x.serial_number || x.traveller_id || "—"}</td><td className="px-3 py-3 text-xs text-muted">{x.recorded_by}</td></tr>)}</tbody></table></div>}
    </Panel>
    <p className="mt-5 text-xs leading-5 text-subtle">Control rule: this page is the authoritative operational read model. The existing component seed catalogue remains available for demonstration/configurator reference until each SKU is migrated into controlled master data and opening balances.</p>
  </main>;
}

function Status({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-bg-elevated/30 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label}</p><p className="mt-1 font-semibold text-fg">{value}</p></div>; }
function Empty({ message }: { message: string }) { return <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">{message}</div>; }
