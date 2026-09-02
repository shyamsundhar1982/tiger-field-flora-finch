import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { buildModel } from "@/lib/finance/model";

export const Route = createFileRoute("/command/balance-sheet")({ component: BalanceSheet });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;
const SNAPSHOT_MONTHS = [1, 6, 12, 18, 24, 30, 36];

function BalanceSheet() {
  const rows = buildModel("base", false);
  const snapshots = SNAPSHOT_MONTHS.map((month) => rows[month - 1]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance · Dedicated statement</p>
        <h1 className="mt-1 font-display text-4xl">Projected Balance Sheet</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">Management planning view derived from the 36-month base scenario. It is not a statutory balance sheet and must be reconciled and classified by the CA.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Horizon</p><p className="mt-1 text-2xl">36 months</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Model basis</p><p className="mt-1 text-2xl">Base</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">CA status</p><p className="mt-1 text-2xl">Pending</p></div>
      </div>

      <Panel title="Statement of financial position — planning view" kicker="₹ lakh · selected month-end snapshots">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">Line item</th>{snapshots.map((r) => <th key={r.m} className="px-3 py-3 text-right">M{r.m}</th>)}</tr></thead>
            <tbody>
              <tr className="border-t border-border"><td className="px-3 py-3 font-medium">Cash & bank</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right tabular-nums">{fmt(r.closing)}</td>)}</tr>
              <tr className="border-t border-border"><td className="px-3 py-3 font-medium">Inventory</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right tabular-nums">{fmt(r.inventory)}</td>)}</tr>
              <tr className="border-t border-border"><td className="px-3 py-3 font-medium">Development / I&AD — model tracking</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right tabular-nums">{fmt(r.iaud)}</td>)}</tr>
              <tr className="border-t border-border"><td className="px-3 py-3 font-medium">Tooling — model tracking</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right tabular-nums">{fmt(r.tooling)}</td>)}</tr>
              <tr className="border-t-2 border-border"><td className="px-3 py-3 font-semibold">Modeled asset pool</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right font-semibold tabular-nums">{fmt(r.closing + r.inventory + r.iaud + r.tooling)}</td>)}</tr>
              <tr className="border-t border-border"><td className="px-3 py-3 font-medium">Liabilities / payables</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right text-muted">Not modeled</td>)}</tr>
              <tr className="border-t border-border"><td className="px-3 py-3 font-medium">Equity / grants / retained earnings</td>{snapshots.map((r) => <td key={r.m} className="px-3 py-3 text-right text-muted">CA classification required</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="CA reconciliation checklist" kicker="Before this becomes an accounting statement">
        <div className="grid gap-2 md:grid-cols-2">
          {["Map funding inflows to equity, grant, debt or other appropriate classification.", "Accrue supplier payables, statutory dues, taxes and other liabilities from actual records.", "Determine accounting treatment of development / I&AD expenditure and tooling.", "Reconcile inventory opening, purchases, consumption, closing stock and valuation.", "Add depreciation / amortisation, receivables and working-capital balances from the accounting system.", "Reconcile the management model to bank, books and CA-certified projections."] .map((item, i) => <div key={item} className="rounded-md border border-border p-3 text-sm"><span className="mr-2 text-accent">0{i + 1}</span>{item}</div>)}
        </div>
      </Panel>

      <p className="text-xs text-muted">The page intentionally avoids presenting unverified classifications as statutory accounting. Use the CA Verification / Audit page to track reconciliation and sign-off.</p>
    </div>
  );
}
