import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/platform-walkthrough")({ component: PlatformWalkthrough });

const STEPS = [
  ["01", "Command", "Start with Board, Command Tower and Management Intelligence to understand the business at executive level."],
  ["02", "Understand", "Move into Knowledge Base, Technical and Design Philosophy for the product and engineering story."],
  ["03", "Observe", "Inspect Balance Sheet, Finance Dashboard, CA Verification, Scenario Analysis, QA Verification and live EPR transactions."],
  ["04", "Operate", "Execute finance, funding, cash, procurement, inventory, manufacturing, engineering, quality and EPR workflows."],
  ["05", "Decide", "Use Founder Command and Decision Engine to connect signals, actions, evidence, approvals and business impact."],
  ["06", "Govern", "Route material decisions through ownership, approval and durable evidence rather than silent completion."],
];

const DOMAINS = [
  ["Finance", "Planning → cash → funding → control → CA verification"],
  ["Engineering", "Product → BOM → engineering control → QA evidence"],
  ["Manufacturing", "Production → suppliers → quality → execution"],
  ["EPR", "Workflow → execution → live transactions → compliance"],
  ["Command", "Founder control → decision engine → governance"],
  ["Stakeholders", "Investor demo → business story → controlled presentation"],
];

function PlatformWalkthrough() {
  return <div className="space-y-7">
    <header>
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">VINDY · Showcase Mode</p>
      <h1 className="mt-1 font-display text-4xl">Platform Walkthrough</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A guided demonstration of how VINDY turns a business operating model into one connected command system — from knowledge and observation through execution, decision and governance.</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Showcase</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">End-to-end</span><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs">Evidence-led</span></div>
    </header>

    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-accent">The VINDY flow</p>
      <h2 className="mt-3 max-w-4xl font-display text-3xl leading-tight">See the company as a connected system, not a collection of disconnected spreadsheets and pages.</h2>
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
        ["Decision", "Decision Engine identifies priority, owner, dependency and required evidence"],
        ["Action", "Owner executes the underlying operational task"],
        ["Evidence", "Documents, verification results, notes or transaction references establish truth"],
        ["Approval", "Governance gate records the accountable decision"],
        ["Impact", "Financial, operational and stakeholder consequences become visible"],
      ].map(([title,note], index) => <div key={title} className="grid gap-2 rounded-md border border-border p-4 md:grid-cols-[2rem_8rem_1fr] md:items-center"><span className="text-xs text-accent">{String(index + 1).padStart(2, "0")}</span><span className="text-sm font-semibold">{title}</span><span className="text-xs leading-5 text-muted">{note}</span></div>)}</div>
    </Panel>

    <section className="rounded-xl border border-border p-6"><h2 className="text-sm font-semibold">Continue the showcase</h2><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Investor Demo</Link><Link to="/command/stakeholder-portal" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Business Story</Link><Link to="/command/decision-engine" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Decision Engine</Link><Link to="/command/founder-command" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Founder Command</Link></div></section>
  </div>;
}
