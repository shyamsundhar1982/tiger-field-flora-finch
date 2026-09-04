import { createFileRoute } from "@tanstack/react-router";
import { useVeloxis } from "@/lib/store";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/actuals")({ component: Actuals });

type ActualField = "revenue" | "units" | "cogs" | "opex" | "closingCash" | "inventory" | "receivables" | "payables";
const fields: { key: ActualField; label: string; suffix: string }[] = [
  { key: "revenue", label: "Revenue", suffix: "₹L" },
  { key: "units", label: "Units sold", suffix: "units" },
  { key: "cogs", label: "COGS", suffix: "₹L" },
  { key: "opex", label: "Opex", suffix: "₹L" },
  { key: "closingCash", label: "Closing cash", suffix: "₹L" },
  { key: "inventory", label: "Inventory", suffix: "₹L" },
  { key: "receivables", label: "Receivables", suffix: "₹L" },
  { key: "payables", label: "Payables", suffix: "₹L" },
];

function Actuals() {
  const actuals = useVeloxis(s => s.actuals);
  const updateActual = useVeloxis(s => s.updateActual);
  const clearActualMonth = useVeloxis(s => s.clearActualMonth);
  const enteredMonths = Object.values(actuals).filter(month => Object.values(month).some(v => v !== null && v !== undefined && v !== "")).length;

  return <div className="space-y-6">
    <header><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance · actual books</p><h1 className="font-display text-4xl">Actuals</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Enter verified monthly actuals here. Actuals are stored separately from Plan and Forecast and never overwrite the baseline.</p></header>
    <Panel title="Monthly actual entry" kicker={`${enteredMonths} month${enteredMonths === 1 ? "" : "s"} with data · ₹ lakh unless stated`}>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">Month</th>{fields.map(f=><th key={f.key} className="px-2 py-3 text-right">{f.label}<br/><span className="font-normal">{f.suffix}</span></th>)}<th className="px-3 py-3">Action</th></tr></thead><tbody>{Array.from({ length: 36 }, (_, i) => i + 1).map(month => <tr key={month} className="border-t border-border"><td className="px-3 py-2 font-medium">M{month}</td>{fields.map(field => { const value = actuals[month]?.[field.key]; return <td key={field.key} className="px-2 py-2"><input aria-label={`M${month} ${field.label}`} type="number" min="0" step={field.key === "units" ? "1" : "0.1"} placeholder="—" value={value ?? ""} onChange={e => updateActual(month, field.key, e.target.value === "" ? null : Number(e.target.value))} className="w-24 rounded-md border border-border bg-bg px-2 py-2 text-right text-sm tabular-nums text-fg outline-none focus:border-accent" /></td>; })}<td className="px-3 py-2"><button type="button" onClick={() => clearActualMonth(month)} className="text-xs text-muted hover:text-danger">Clear</button></td></tr>)}</tbody></table></div>
      <p className="mt-4 rounded-md border border-border bg-surface p-3 text-xs leading-5 text-muted">Only enter numbers from verified books, bank records, invoices or inventory records. Blank means “not entered”, not zero. This layer is management capture and should be reconciled to the CA ledger before statutory reporting.</p>
    </Panel>
  </div>;
}
