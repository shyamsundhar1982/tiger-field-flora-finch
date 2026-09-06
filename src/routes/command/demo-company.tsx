import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { TIERS } from "@/lib/data/company";

export const Route = createFileRoute("/command/demo-company")({ component: DemoCompany });

const CONTROL_LAYERS = [
  ["Command", "Founder Command · Decision Engine · Governance", "Decide"],
  ["Finance", "Financial Planning · Cash · Funding · Finance Control", "Control"],
  ["Product", "Product · BOM & Cost Engine · Engineering Control", "Build"],
  ["Manufacturing", "Production · Procurement · Inventory · Quality", "Execute"],
  ["EPR", "Workflow · Execution · Live Transactions", "Comply"],
  ["Stakeholders", "Investor Demo · Business Story · Platform Walkthrough", "Present"],
];

const DEMO_SCENARIO = [
  ["09:00", "Cash threshold", "Founder Command flags a cash-floor intervention.", "WATCH"],
  ["09:05", "Decision packet", "Decision Engine identifies the owner, dependency and evidence required.", "READY"],
  ["09:20", "Supplier action", "Operations confirms the next production input and attaches evidence.", "ACTIVE"],
  ["10:00", "Approval gate", "Governance records the accountable approval before release.", "APPROVAL"],
  ["10:15", "Executive update", "Financial and operational impact becomes available to the stakeholder view.", "REPORTED"],
];

function DemoCompany() {
  return <div className="space-y-7">
    <header>
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">VINDY · Showcase Mode</p>
      <h1 className="mt-1 font-display text-4xl">Demo Company</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A realistic end-to-end company scenario for demonstrating VINDY without presenting demonstration data as audited company performance. The scenario shows how one business moves from signal to decision, execution, evidence and stakeholder reporting.</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Demonstration dataset</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Mode: Showcase</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Not audited</span></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Product platform" value="VINDY" hint="Connected operating system"/><Kpi label="Capital story" value="₹15L → ₹2Cr" hint="Staged funding ladder"/><Kpi label="Planning horizon" value="36 mo" hint="Evidence-gated execution"/><Kpi label="Control principle" value="Evidence" hint="No silent completion"/></div>

    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.18em] text-accent">The demo company story</p><h2 className="mt-3 max-w-4xl font-display text-3xl leading-tight">A performance-bicycle company uses VINDY to connect product creation with cash, production, compliance and governance.</h2><p className="mt-4 max-w-3xl text-sm leading-6 text-muted">The demonstration begins with a business signal and follows it through the complete operating loop. Each layer remains accountable to its owner while the command layer preserves the executive picture.</p></section>

    <Panel title="Company operating layers" kicker="One business · six connected control layers">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{CONTROL_LAYERS.map(([layer,systems,verb]) => <div key={layer} className="rounded-md border border-border p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{layer}</p><span className="text-[10px] uppercase tracking-[0.16em] text-accent">{verb}</span></div><p className="mt-3 text-xs leading-5 text-muted">{systems}</p></div>)}</div>
    </Panel>

    <Panel title="Live business scenario" kicker="Example control loop · demonstration only">
      <div className="space-y-3">{DEMO_SCENARIO.map(([time,title,description,status]) => <div key={time} className="grid gap-2 rounded-md border border-border p-4 md:grid-cols-[5rem_9rem_1fr_6rem] md:items-center"><span className="text-xs font-semibold text-accent">{time}</span><span className="text-sm font-semibold">{title}</span><span className="text-xs leading-5 text-muted">{description}</span><span className="rounded-full border border-border px-2 py-1 text-center text-[10px] uppercase tracking-[0.12em] text-muted">{status}</span></div>)}</div>
    </Panel>

    <Panel title="Product portfolio" kicker="Demonstration of the same operating system across product tiers">
      <div className="grid gap-3 md:grid-cols-3">{TIERS.map(tier => <div key={tier.id} className="rounded-md border border-border p-5"><p className="text-sm font-semibold">{tier.name}</p><p className="mt-1 text-xs text-subtle">{tier.epithet}</p><p className="mt-4 text-xs leading-5 text-muted">The product master feeds BOM, cost, engineering control, manufacturing planning and the commercial model.</p></div>)}</div>
    </Panel>

    <Panel title="What the stakeholder sees" kicker="Presentation layer stays separate from operational truth">
      <div className="grid gap-3 md:grid-cols-2"><div className="rounded-md border border-border p-5"><p className="text-sm font-semibold">Verified</p><p className="mt-2 text-xs leading-5 text-muted">Evidence-backed facts, completed approvals and reconciled information can be presented as verified.</p></div><div className="rounded-md border border-border p-5"><p className="text-sm font-semibold">Modeled / pending</p><p className="mt-2 text-xs leading-5 text-muted">Management assumptions, forecasts, pending certifications and open decisions remain clearly disclosed.</p></div></div>
    </Panel>

    <section className="rounded-xl border border-border p-6"><h2 className="text-sm font-semibold">Run the full demo</h2><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/platform-walkthrough" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Platform Walkthrough</Link><Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Investor Demo</Link><Link to="/command/stakeholder-portal" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Business Story</Link><Link to="/command/financial-cockpit" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Financial Cockpit</Link></div></section>
  </div>;
}
