import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { getProductionJobCards } from "@/lib/production-job-card";

export const Route = createFileRoute("/command/production-jobcards")({
  loader: () => getProductionJobCards(),
  component: ProductionJobCards,
});

function ProductionJobCards() {
  const { cards, lines } = Route.useLoaderData();
  const released = cards.filter((x: any) => ["released", "in_progress"].includes(x.status)).length;
  const units = cards.reduce((sum: number, x: any) => sum + Number(x.units), 0);
  const stageCount = useMemo(() => new Set(lines.map((x: any) => x.stage_code)).size, [lines]);
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Operations · order handoff</p><h1 className="mt-2 text-4xl font-bold text-accent">Production job cards</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Every confirmed model order is converted into one controlled production handoff. The card carries the model, quantity, BOM tier and stage-wise component/raw-material requirements.</p></div>
      <Link to="/command/production" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent">Back to Production →</Link>
    </header>
    <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Job cards" value={String(cards.length)} hint="One per order"/><Kpi label="Released / active" value={String(released)} hint="Production queue"/><Kpi label="Units" value={String(units)} hint={`${stageCount} controlled stages`}/></div>
    {cards.length === 0 ? <Panel title="Production queue is empty"><p className="text-sm text-muted">No production job cards have been generated yet. Add a confirmed order in Sales & Revenue Engine.</p></Panel> : cards.map((card: any) => {
      const cardLines = lines.filter((x: any) => x.job_card_id === card.id);
      const stages = [...new Map(cardLines.map((x: any) => [x.stage_no, x])).values()];
      return <Panel key={card.id} title={`${card.product_label} · ${card.units} unit${Number(card.units) === 1 ? "" : "s"}`} kicker={`${card.id} · SO ${card.sales_order_id} · ${String(card.status).replaceAll("_", " ")}`}>
        <div className="grid gap-3 md:grid-cols-5 text-sm"><div><span className="text-[10px] uppercase tracking-wider text-subtle">BOM tier</span><p className="mt-1 font-semibold">{card.bom_tier}</p></div><div><span className="text-[10px] uppercase tracking-wider text-subtle">Required month</span><p className="mt-1 font-semibold">M{card.due_month}</p></div><div><span className="text-[10px] uppercase tracking-wider text-subtle">Owner</span><p className="mt-1 font-semibold">{card.production_owner}</p></div><div><span className="text-[10px] uppercase tracking-wider text-subtle">Created</span><p className="mt-1 text-muted">{new Date(card.created_at).toLocaleString()}</p></div><div><span className="text-[10px] uppercase tracking-wider text-subtle">Stage lines</span><p className="mt-1 font-semibold">{cardLines.length}</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">{stages.map((stage: any) => <div key={stage.stage_no} className="rounded-xl border border-border bg-bg-elevated/30 p-4"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{String(stage.stage_no).padStart(2, "0")}</span><p className="mt-2 text-sm font-semibold text-fg">{stage.stage_name}</p><p className="mt-1 text-xs text-muted">{cardLines.filter((x: any) => x.stage_no === stage.stage_no).length} requirement lines</p></div>)}</div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Stage</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-left">Component / raw material</th><th className="px-3 py-3 text-right">Required</th><th className="px-3 py-3 text-left">Issue status</th></tr></thead><tbody>{cardLines.map((line: any) => <tr key={line.id} className="border-t border-border/70"><td className="px-3 py-3">{line.stage_code} · {line.stage_name}</td><td className="px-3 py-3 text-xs uppercase text-muted">{line.line_type.replaceAll("_", " ")}</td><td className="px-3 py-3 font-medium">{line.item}</td><td className="px-3 py-3 text-right tabular-nums">{Number(line.quantity)} {line.unit}</td><td className="px-3 py-3 text-xs uppercase">{line.issue_status}</td></tr>)}</tbody></table></div>
      </Panel>;
    })}
  </main>;
}
