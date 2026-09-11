import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listCanonicalCashAuthority } from "@/lib/finance-governance-authority";

type Row = Record<string, unknown>;
const num = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return Number(row[key]) || 0; return 0; };
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };
const money = (value: number) => `₹${value.toFixed(2)}L`;

export const Route = createFileRoute("/command/cash")({
  loader: () => listCanonicalCashAuthority(),
  component: Cash,
});

function Cash() {
  const rows = Route.useLoaderData() as Row[];
  const evidenced = rows.filter((row) => Boolean(row.verified));
  const latest = [...evidenced].reverse().find((row) => text(row,"source_reference","sourceReference"));
  const lowest = evidenced.length ? Math.min(...evidenced.map((row) => num(row,"closing_cash_lakh","closingCashLakh"))) : 0;
  const latestMonth = latest ? num(latest,"plan_month","planMonth") : 0;
  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Finance · canonical cash authority</p><h1 className="mt-1 font-display text-4xl text-accent">Cash & Working Capital</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">This route reads transaction-derived and verified monthly actuals from the canonical cash authority. Planning projections remain in the Finance planning surfaces and are no longer presented here as posted cash truth.</p><div className="mt-3 flex gap-3 text-sm font-semibold"><Link to="/command/financial-cockpit" className="text-accent">Finance cockpit →</Link><Link to="/command/balance-sheet" className="text-accent">Balance Sheet →</Link></div></header>
    <div className="grid gap-3 sm:grid-cols-4"><Kpi label="Evidenced months" value={String(evidenced.length)} hint="Verified / transaction-derived" tone={evidenced.length ? "ok" : "warn"}/><Kpi label="Latest evidence" value={latestMonth ? `M${latestMonth}` : "None"} hint={latest ? text(latest,"source_reference","sourceReference") : "No posted cash evidence"}/><Kpi label="Lowest posted cash" value={money(lowest)} hint="Across evidenced months" tone={lowest < 0 ? "danger" : "ok"}/><Kpi label="Authority" value="Canonical" hint="vyndi_cash_authority" tone="ok"/></div>
    <Panel title="Cash Authority Register" kicker="Verified actuals · transaction lineage"> <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Closing cash</th><th className="px-3 py-3 text-right">Receivables</th><th className="px-3 py-3 text-right">Inventory</th><th className="px-3 py-3 text-right">Payables</th><th className="px-3 py-3 text-right">Transaction revenue</th><th className="px-3 py-3 text-left">Evidence</th></tr></thead><tbody>{rows.map((row) => { const verified=Boolean(row.verified); return <tr key={num(row,"plan_month","planMonth")} className="border-t border-border/70"><td className="px-3 py-3 font-semibold">M{num(row,"plan_month","planMonth")}</td><td className="px-3 py-3 text-right tabular-nums">{money(num(row,"closing_cash_lakh","closingCashLakh"))}</td><td className="px-3 py-3 text-right tabular-nums">{money(num(row,"receivables_lakh","receivablesLakh"))}</td><td className="px-3 py-3 text-right tabular-nums">{money(num(row,"inventory_lakh","inventoryLakh"))}</td><td className="px-3 py-3 text-right tabular-nums">{money(num(row,"payables_lakh","payablesLakh"))}</td><td className="px-3 py-3 text-right tabular-nums">{money(num(row,"transaction_revenue_lakh","transactionRevenueLakh"))}</td><td className="px-3 py-3"><span className={verified ? "font-semibold text-ok" : "text-muted"}>{verified ? "VERIFIED" : "No posted evidence"}</span><p className="mt-1 max-w-xs text-[10px] text-muted">{text(row,"source_reference","sourceReference") || "—"}</p></td></tr>; })}</tbody></table></div></Panel>
    <p className="text-xs text-muted">Canonical source: <code>vyndi_cash_authority</code>, built from transaction actuals and verified monthly actuals. An empty month is explicitly not treated as evidence.</p>
  </div>;
}
