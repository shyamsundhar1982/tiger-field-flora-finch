import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { INVESTOR_BOARD_STATUS, INVESTOR_MILESTONES, INVESTOR_PROOF_POINTS, USE_OF_PROCEEDS } from "@/lib/data/investor-board";
import { buildModel, totals } from "@/lib/finance/model";

export const Route = createFileRoute("/command/investor-pitch")({ component: InvestorPitch });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;

function InvestorPitch() {
  const rows = buildModel("base", false);
  const t = totals(rows);
  const m36 = rows[35];
  const m29 = rows[28];

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Investor relations · Dedicated pitch page</p>
        <h1 className="mt-1 font-display text-4xl">VéLOXIS Investor Pitch</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">A concise investor-facing narrative generated from the controlled command registers. Every financial number below is a planning assumption until CA reconciliation and every engineering claim remains subject to its evidence gate.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs"><Link to="/command/investor-board" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Investor / Board Control</Link><Link to="/command/ca-audit" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">CA Verification</Link><Link to="/command/finance-control" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">36-Month Finance</Link></div>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.18em] text-accent">Investment thesis</p><h2 className="mt-3 max-w-4xl font-display text-3xl leading-tight">An India-focused, IP-led carbon bicycle platform built around controlled engineering, qualified contract manufacturing and disciplined staged capital.</h2><p className="mt-4 max-w-3xl text-sm leading-6 text-muted">Vāyú Shastr is building VéLOXIS as an asset-light product company: retain product definition, brand, customer relationship and relevant IP while using qualified manufacturing partners for carbon production. The command system links engineering, finance, funding, legal and manufacturing evidence into one decision layer.</p></section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Current tranche" value="₹15L" hint="Foundation stage" /><Kpi label="Funding ladder" value="₹2Cr" hint="Staged, not immediate" /><Kpi label="Scale breakeven" value={`M${m29.m}`} hint="Planning marker" /><Kpi label="36-mo units" value={String(t.units)} hint={`Revenue ${fmt(t.revenue)}`} /></div>

      <Panel title="Why this company" kicker="Controlled proof points"><div className="grid gap-3 md:grid-cols-2">{INVESTOR_PROOF_POINTS.map((p, i) => <div key={p} className="rounded-md border border-border p-4 text-sm"><span className="mr-2 text-accent">0{i + 1}</span>{p}</div>)}</div></Panel>

      <Panel title="Capital request" kicker="Evidence-led funding ladder"><div className="space-y-3">{INVESTOR_MILESTONES.map((m) => <div key={m.id} className="grid gap-2 rounded-md border border-border p-4 md:grid-cols-[8rem_7rem_1fr_10rem] md:items-center"><div><p className="text-xs text-subtle">{m.id}</p><p className="text-sm font-medium">{m.tranche}</p></div><div className="text-sm font-medium">₹{m.quantumLakh}L</div><div><p className="text-sm">{m.purpose}</p><p className="mt-1 text-xs text-muted">Evidence: {m.requiredEvidence}</p></div><div className="text-xs text-muted">{m.timing}<br />Gate: {m.decisionGate}</div></div>)}</div><p className="mt-4 text-xs text-muted">Strategy: {INVESTOR_BOARD_STATUS.strategy}</p></Panel>

      <Panel title="Use of proceeds" kicker="At each tranche"><div className="grid gap-3 md:grid-cols-5">{USE_OF_PROCEEDS.map((p) => <div key={p.tranche} className="rounded-md border border-border p-4"><p className="text-xs font-semibold text-accent">{p.tranche}</p><p className="mt-2 text-sm font-medium">{p.allocation}</p><p className="mt-2 text-xs text-muted">{p.note}</p></div>)}</div></Panel>

      <Panel title="36-month base-case snapshot" kicker="Planning model · ₹ lakh"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Cumulative revenue</p><p className="mt-1 text-xl">{fmt(t.revenue)}</p></div><div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Cumulative units</p><p className="mt-1 text-xl">{t.units}</p></div><div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Cumulative funding</p><p className="mt-1 text-xl">{fmt(t.funding)}</p></div><div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Cumulative EBITDA</p><p className="mt-1 text-xl">{fmt(t.ebitda)}</p></div><div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">M36 closing cash</p><p className="mt-1 text-xl">{fmt(m36.closing)}</p></div></div><p className="mt-4 text-xs text-muted">These figures are management-model outputs, not forecasts or audited results. They should be replaced/reconciled against actual accounts and CA-certified projections before formal fundraising use.</p></Panel>

      <section className="rounded-xl border border-border p-6"><h2 className="text-sm font-semibold">Investor diligence rule</h2><p className="mt-3 text-sm leading-6 text-muted">Do not state that grants are awarded, engineering is validated, products are certified, or statutory accounts are audited unless the corresponding evidence exists. The pitch page is a controlled presentation layer over the command registers, not a substitute for the evidence room.</p></section>
    </div>
  );
}
