import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs } from "@/lib/finance/model";
import { buildAccountingModel, DEFAULT_ACCOUNTING_ASSUMPTIONS } from "@/lib/finance/accounting";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/balance-sheet")({ component: BalanceSheet });
const f = (n:number) => `₹${n.toFixed(1)}L`;
const MONTHS = [1, 6, 12, 18, 24, 30, 36];

function BalanceSheet() {
  const { scenario, finance } = useVeloxis();
  const planning = useMemo(() => buildModelWithInputs(scenario, scenario !== "base", finance), [scenario, finance]);
  const rows = useMemo(() => buildAccountingModel(planning, DEFAULT_ACCOUNTING_ASSUMPTIONS), [planning]);
  const total = (key: keyof typeof rows[number]) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const last = rows[rows.length - 1];
  const snapshots = MONTHS.map(m => rows[m - 1]).filter(Boolean);

  return <div className="space-y-6">
    <header><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance · Accounting layer</p><h1 className="font-display text-4xl">Financial Statements</h1><p className="mt-2 max-w-3xl text-sm text-muted">Accrual P&L, working capital, Balance Sheet and cash-flow view generated from the same live planning model.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="Revenue" value={f(total("revenue"))} hint="36-month accrual sales"/><Kpi label="Gross profit" value={f(total("grossProfit"))} hint="Revenue less COGS"/><Kpi label="EBITDA" value={f(total("ebitda"))} hint="Before depreciation"/><Kpi label="Net profit" value={f(total("netProfit"))} hint="After depreciation + tax"/><Kpi label="Closing cash" value={f(last?.closingCash ?? 0)} hint="After AR/AP timing" tone={(last?.closingCash ?? 0) < 0 ? "danger" : "ok"}/></div>
    <Panel title="Profit & Loss" kicker="₹ lakh · accrual basis"><div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">{[["Revenue","revenue"],["COGS","cogs"],["Gross profit","grossProfit"],["Opex","opex"],["Depreciation","depreciation"],["Net profit","netProfit"]].map(([label,key])=><div key={key} className="rounded-lg border border-border bg-surface p-3"><p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p><p className="mt-1 text-xl tabular-nums">{f(total(key as keyof typeof rows[number]))}</p></div>)}</div></Panel>
    <Panel title="Balance Sheet" kicker="Selected month-end snapshots · ₹ lakh"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">Line item</th>{snapshots.map(r=><th key={r.m} className="px-3 py-3 text-right">M{r.m}</th>)}</tr></thead><tbody>{[["Cash & bank","closingCash"],["Trade receivables","receivables"],["Inventory","inventory"],["Net fixed assets","fixedAssetsNet"],["Total assets","totalAssets"],["Trade payables","payables"],["Debt","debt"],["Equity incl. funding","equity"],["Retained earnings","retainedEarnings"],["Total liabilities + equity","totalLiabilitiesEquity"],["Balance check","balanceCheck"]].map(([label,key])=><tr key={key} className="border-t border-border"><td className="px-3 py-3 font-medium">{label}</td>{snapshots.map(r=><td key={r.m} className="px-3 py-3 text-right tabular-nums">{f(Number(r[key as keyof typeof r] || 0))}</td>)}</tr>)}</tbody></table></div></Panel>
    <Panel title="Cash Flow" kicker="Operating · investing · financing"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-border bg-surface p-4"><p className="text-xs text-subtle">Operating</p><p className="mt-2 text-2xl">{f(total("operatingCashFlow"))}</p><p className="mt-1 text-xs text-muted">Collections − supplier payments − opex − tax</p></div><div className="rounded-lg border border-border bg-surface p-4"><p className="text-xs text-subtle">Investing</p><p className="mt-2 text-2xl">{f(total("investingCashFlow"))}</p><p className="mt-1 text-xs text-muted">Capital expenditure</p></div><div className="rounded-lg border border-border bg-surface p-4"><p className="text-xs text-subtle">Financing</p><p className="mt-2 text-2xl">{f(total("financingCashFlow"))}</p><p className="mt-1 text-xs text-muted">Funding inflows</p></div></div></Panel>
    <Panel title="Accounting controls" kicker="CA reconciliation layer"><div className="grid gap-3 md:grid-cols-4"><div><p className="text-xs text-subtle">M36 receivables</p><p className="mt-1 text-lg">{f(last?.receivables ?? 0)}</p></div><div><p className="text-xs text-subtle">M36 payables</p><p className="mt-1 text-lg">{f(last?.payables ?? 0)}</p></div><div><p className="text-xs text-subtle">M36 fixed assets</p><p className="mt-1 text-lg">{f(last?.fixedAssetsNet ?? 0)}</p></div><div><p className="text-xs text-subtle">Max BS error</p><p className="mt-1 text-lg">{f(Math.max(...rows.map(r=>Math.abs(r.balanceCheck))))}</p></div></div><p className="mt-4 rounded-md border border-border bg-surface p-3 text-xs leading-5 text-muted">Defaults: one-month customer collection, one-month supplier credit, 60-month straight-line depreciation and 0% tax/GST placeholders. Funding is temporarily classified as equity. Replace with CA-verified source documents before statutory use.</p></Panel>
  </div>;
}
