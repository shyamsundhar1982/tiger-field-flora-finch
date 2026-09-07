import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { INVESTOR_BOARD_STATUS, INVESTOR_MILESTONES, INVESTOR_PROOF_POINTS, USE_OF_PROCEEDS } from "@/lib/data/investor-board";
import { TIERS } from "@/lib/data/company";
import { buildModel, totals, GM, ASP_L, COGS_L } from "@/lib/finance/model";

export const Route = createFileRoute("/command/investor-pitch")({ component: InvestorPitch });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;
const OPERATING_GATES = [
  ["M0–M6", "Engineering", "CAD/FEA, prototypes, IP and validation evidence"],
  ["M6–M12", "Pilot", "Tooling, ISO path, factory qualification and pilot production"],
  ["M12–M18", "Launch", "D2C launch, first customers and service feedback"],
  ["M18–M24", "Repeatability", "Yield, warranty, service and working-capital discipline"],
  ["M24–M30", "Scale readiness", "Demand, capacity, contribution margin and cash conversion evidence"],
  ["M30–M36", "Controlled scale", "Capacity expansion only after evidence-backed unit economics"],
] as const;

const SHOWCASE_CARDS = [
  ["External Pitch", "Open the dedicated investor presentation hosted independently.", "/command/investor-pitch-external"],
  ["Investor / Board", "Executive status, milestones and evidence posture.", "/command/investor-board"],
  ["Finance", "Cash, funding, break-even and runway over the 36-month model.", "/command/financial-cockpit"],
  ["CA Verification", "Accounting assumptions and items requiring professional reconciliation.", "/command/ca-audit"],
  ["QA Verification", "Validation, manufacturing and release evidence posture.", "/command/qa-verification"],
  ["EPR Evidence", "Compliance transactions and execution evidence.", "/command/epr-live"],
] as const;

function InvestorPitch() {
  const rows = buildModel("base", false);
  const t = totals(rows);
  const m36 = rows[35];
  const committedFunding = 200;
  const maximumFunding = 225;

  return (
    <div className="space-y-7">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VINDY · Investor showcase</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Investment Case</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A concise, evidence-led presentation of VINDY for investors, board members and partners. Operational controls remain role-restricted; every link on this page opens a presentation-safe evidence surface.</p>
        <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">Showcase</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">Evidence-led</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">36-month horizon</span></div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Current tranche" value="₹15L" hint="Foundation stage" />
        <Kpi label="Committed ladder" value="₹2Cr" hint="Excludes standby" />
        <Kpi label="Maximum ladder" value="₹2.25Cr" hint="Includes ₹25L standby" />
        <Kpi label="M36 cash" value={fmt(m36.closing)} hint="Base management model" />
      </div>

      <Panel title="Investor evidence navigator" kicker="Viewer-safe · read-only evidence surfaces">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{SHOWCASE_CARDS.map(([title, description, to]) => <Link key={title} to={to as never} className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-fg">{title}</p><p className="mt-2 text-xs leading-5 text-muted">{description}</p></div><span className="text-lg text-accent">→</span></div></Link>)}</div>
      </Panel>

      <section className="rounded-xl border border-border bg-surface/35 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">Investment thesis</p>
        <h2 className="mt-3 max-w-4xl font-display text-3xl leading-tight text-accent">An India-focused, IP-led performance bicycle platform built around controlled engineering, rider fit, configurable specification and disciplined staged capital.</h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">Vāyú Shastr is building VINDY as an asset-light product company: retain product definition, brand, customer relationship and relevant IP while using qualified manufacturing partners. The proposition is engineered performance, fit and configuration with an evidence-gated path from prototype to scale.</p>
      </section>

      <Panel title="Unit economics" kicker="Management assumptions · validate before formal fundraising use">
        <div className="grid gap-3 md:grid-cols-3">{TIERS.map((tier) => { const margin = ((tier.asp - tier.cogs) / tier.asp) * 100; return <div key={tier.id} className="rounded-xl border border-border p-4"><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-semibold text-fg">{tier.name}</p><p className="text-xs text-subtle">{tier.epithet}</p></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] uppercase text-green">ASP</p><p className="mt-1 text-lg">{fmt(tier.asp / 10000)}</p></div><div><p className="text-[10px] uppercase text-green">COGS</p><p className="mt-1 text-lg">{fmt(tier.cogs / 10000)}</p></div><div><p className="text-[10px] uppercase text-green">GM</p><p className="mt-1 text-lg">{margin.toFixed(1)}%</p></div></div></div>; })}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border p-4"><p className="text-xs text-green">Blended ASP</p><p className="mt-1 text-xl">{fmt(ASP_L)}</p></div><div className="rounded-lg border border-border p-4"><p className="text-xs text-green">Blended COGS</p><p className="mt-1 text-xl">{fmt(COGS_L)}</p></div><div className="rounded-lg border border-border p-4"><p className="text-xs text-green">Blended gross margin</p><p className="mt-1 text-xl">{GM.toFixed(1)}%</p></div></div>
      </Panel>

      <Panel title="36-month operating gates" kicker="Capital follows evidence, not the calendar">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{OPERATING_GATES.map(([period, title, note]) => <div key={period} className="rounded-xl border border-border p-4"><p className="text-xs font-semibold text-accent">{period}</p><p className="mt-2 text-sm font-medium text-fg">{title}</p><p className="mt-2 text-xs leading-5 text-muted">{note}</p></div>)}</div>
      </Panel>

      <Panel title="Why this company" kicker="Controlled proof points">
        <div className="grid gap-3 md:grid-cols-2">{INVESTOR_PROOF_POINTS.map((point, index) => <div key={point} className="rounded-xl border border-border p-4 text-sm leading-6"><span className="mr-2 font-semibold text-accent">0{index + 1}</span>{point}</div>)}</div>
      </Panel>

      <details className="rounded-xl border border-border bg-surface/30 p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green">Capital pathway</p><h2 className="mt-1 font-display text-xl font-semibold text-accent">Funding milestones & use of proceeds</h2></div><span className="text-xs font-semibold text-muted">₹2Cr core · expand</span></summary>
        <div className="mt-5 space-y-3">{INVESTOR_MILESTONES.map((milestone) => <div key={milestone.id} className="grid gap-2 rounded-xl border border-border p-4 md:grid-cols-[7rem_7rem_1fr_10rem] md:items-center"><div><p className="text-xs font-semibold text-accent">{milestone.id}</p><p className="text-xs text-muted">{milestone.tranche}</p></div><div className="font-semibold">₹{milestone.quantumLakh}L</div><div><p className="text-sm text-fg">{milestone.purpose}</p><p className="mt-1 text-xs text-muted">Evidence: {milestone.requiredEvidence}</p></div><div className="text-xs text-muted">{milestone.timing}<br />Gate: {milestone.decisionGate}</div></div>)}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">{USE_OF_PROCEEDS.map((item) => <div key={item.tranche} className="rounded-xl border border-border p-4"><p className="text-xs font-semibold text-accent">{item.tranche}</p><p className="mt-2 text-sm font-medium">{item.allocation}</p><p className="mt-2 text-xs text-muted">{item.note}</p></div>)}</div>
        <p className="mt-4 text-xs text-muted">Committed ladder: ₹{committedFunding / 100}Cr. Maximum planned capital including the conditional ₹25L standby facility: ₹{maximumFunding / 100}Cr. Strategy: {INVESTOR_BOARD_STATUS.strategy}</p>
      </details>

      <Panel title="36-month base case" kicker="Management model · not audited results">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Revenue", fmt(t.revenue)], ["Units", String(t.units)], ["Funding", fmt(t.funding)], ["EBITDA", fmt(t.ebitda)], ["M36 cash", fmt(m36.closing)]].map(([label, value]) => <div key={label} className="rounded-lg border border-border p-4"><p className="text-xs text-green">{label}</p><p className="mt-1 text-xl text-fg">{value}</p></div>)}</div>
        <p className="mt-4 text-xs leading-5 text-muted">Financial figures are management-model assumptions until CA reconciliation. Engineering, manufacturing and market claims remain subject to their evidence gates; do not present pending certification, supplier capacity or statutory accounts as verified.</p>
      </Panel>
    </div>
  );
}
