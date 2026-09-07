import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/platform-walkthrough")({ component: PlatformWalkthrough });

const STEPS = [
  ["01", "Command Centre", "Start with the executive exception view: cash health, blockers, decisions, accountable actions and operating gates."],
  ["02", "Master Plan", "Show the 36-month roadmap, dependencies, funding gates and the small set of planning exceptions that need action."],
  ["03", "Engineering", "Explain the controlled product baseline, revisions, BOM ownership, tooling references and validation evidence."],
  ["04", "Supply & Production", "Connect procurement, authoritative inventory, production, manufacturing readiness and quality release."],
  ["05", "Commercial & Finance", "Follow demand and orders into collections, liquidity, funding, break-even and runway without mixing plan and actuals."],
  ["06", "Governance", "Close the loop with approvals, risk, legal, QA evidence and an auditable action trail."],
];

const DOMAINS = [
  ["Command", "Command Centre → exceptions → accountable actions"],
  ["Planning", "Master Plan → roadmap → dependencies → scenarios"],
  ["Engineering", "Product → BOM → revisions → validation"],
  ["Supply", "Procurement → inventory → production → manufacturing → quality"],
  ["Commercial", "Demand → orders → GTM → collections"],
  ["Finance & Governance", "Cash → funding → CA evidence → approvals → audit"],
];

function PlatformWalkthrough() {
  return <div className="space-y-7">
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VINDY · Showcase Mode</p>
      <h1 className="mt-1 font-display text-4xl text-accent">Platform Walkthrough</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A guided, read-only demonstration of the seven-workspace VINDY operating system. The walkthrough stays inside presentation-safe views while explaining where authorised teams execute the underlying work.</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Showcase</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">End-to-end</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Evidence-led</span></div>
    </header>

    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">The VINDY flow</p>
      <h2 className="mt-3 max-w-4xl font-display text-3xl leading-tight text-accent">See the company as a connected operating system, not a directory of disconnected pages.</h2>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">Every demonstration should answer three questions: what is happening, what needs to happen next, and what evidence proves the decision is ready.</p>
    </section>

    <Panel title="Six-step walkthrough" kicker="Recommended 8–12 minute platform demonstration">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{STEPS.map(([number,title,description]) => <div key={number} className="rounded-md border border-border p-5"><p className="text-xs font-semibold text-accent">{number}</p><p className="mt-2 text-base font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-muted">{description}</p></div>)}</div>
    </Panel>

    <Panel title="Connected business domains" kicker="One operating spine across the company">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{DOMAINS.map(([domain,flow]) => <div key={domain} className="rounded-md border border-border p-4"><p className="text-sm font-semibold">{domain}</p><p className="mt-2 text-xs leading-5 text-muted">{flow}</p></div>)}</div>
    </Panel>

    <Panel title="Demonstration sequence" kicker="Show the control loop, not just individual screens">
      <div className="space-y-3">{[
        ["Signal", "Cash risk, blocked action, QA issue, funding milestone or compliance deadline"],
        ["Decision", "Command Centre identifies priority, owner, dependency and required evidence"],
        ["Action", "The authorised workspace owner executes the underlying task"],
        ["Evidence", "Documents, verification results, notes or transaction references establish truth"],
        ["Approval", "Governance records the accountable decision before release"],
        ["Impact", "Financial, operational and stakeholder consequences become visible"],
      ].map(([title,note], index) => <div key={title} className="grid gap-2 rounded-md border border-border p-4 md:grid-cols-[2rem_8rem_1fr] md:items-center"><span className="text-xs text-accent">{String(index + 1).padStart(2, "0")}</span><span className="text-sm font-semibold">{title}</span><span className="text-xs leading-5 text-muted">{note}</span></div>)}</div>
    </Panel>

    <section className="rounded-xl border border-border p-6"><h2 className="text-sm font-semibold text-accent">Continue the showcase</h2><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Investor Demo</Link><Link to="/command/stakeholder-portal" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Business Story</Link><Link to="/command/financial-cockpit" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Finance</Link><Link to="/command/qa-verification" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">QA Verification</Link><Link to="/command/epr-live" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">EPR Evidence</Link></div></section>
  </div>;
}
