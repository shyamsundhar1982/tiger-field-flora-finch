import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { STAKEHOLDER_DISCLOSURES, STAKEHOLDER_PORTAL_STATUS, STAKEHOLDER_SECTIONS } from "@/lib/data/stakeholder-portal";

export const Route = createFileRoute("/command/stakeholder-portal")({ component: StakeholderPortal });

const statusClass = (status: string) => status === "ready" ? "text-ok" : status === "blocked" ? "text-danger" : "text-warn";

function StakeholderPortal() {
  const ready = STAKEHOLDER_SECTIONS.filter((item) => item.status === "ready").length;
  const pending = STAKEHOLDER_SECTIONS.filter((item) => item.status !== "ready").length;

  return <div className="space-y-7">
    <header>
      <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Phase J · External Stakeholder</p>
      <h1 className="mt-2 font-display text-4xl">VINDY Stakeholder Portal</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{STAKEHOLDER_PORTAL_STATUS.headline} A presentation-ready view that separates verified evidence, modeled assumptions, pending validation and reserved decisions.</p>
    </header>

    <div className="grid gap-3 sm:grid-cols-4">
      <Kpi label="Current tranche" value={`₹${STAKEHOLDER_PORTAL_STATUS.currentTrancheLakh}L`} hint="Controlled ask" />
      <Kpi label="Maximum ladder" value={`₹${STAKEHOLDER_PORTAL_STATUS.totalLadderLakh / 100}Cr`} hint="Conditional" />
      <Kpi label="Ready sections" value={`${ready}/${STAKEHOLDER_SECTIONS.length}`} hint="Evidence posture" tone="ok" />
      <Kpi label="In progress" value={`${pending}`} hint="Not yet final" tone="warn" />
    </div>

    <Panel title="Stakeholder briefing" kicker="Controlled external narrative">
      <div className="grid gap-3 md:grid-cols-2">{STAKEHOLDER_SECTIONS.map((item) => <Link key={item.id} to={item.route as never} className="rounded-lg border border-border bg-surface p-4 hover:border-accent"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{item.title}</p><span className={`text-[10px] uppercase tracking-wider ${statusClass(item.status)}`}>{item.status}</span></div><p className="mt-2 text-xs leading-5 text-muted">{item.summary}</p><p className="mt-3 text-xs text-accent">Open controlled source →</p></Link>)}</div>
    </Panel>

    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Disclosure discipline" kicker="No unsupported claims">
        <div className="space-y-3">{STAKEHOLDER_DISCLOSURES.map((item) => <div key={item.id} className="rounded-md border border-border p-3"><p className="text-xs font-semibold">{item.id} · {item.title}</p><p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p></div>)}</div>
      </Panel>
      <Panel title="Capital pathway" kicker="Evidence before tranche">
        <div className="space-y-3 text-sm"><div className="rounded-md border border-border p-3"><p className="font-medium">₹15L · Current tranche</p><p className="mt-1 text-xs text-muted">Near-term execution capital; release remains subject to the relevant funding and governance evidence.</p></div><div className="rounded-md border border-border p-3"><p className="font-medium">₹2Cr · Core ladder</p><p className="mt-1 text-xs text-muted">Conditional capital progression tied to engineering, pilot, validation and commercial gates.</p></div><div className="rounded-md border border-border p-3"><p className="font-medium">₹2.25Cr · Maximum ladder</p><p className="mt-1 text-xs text-muted">Includes the conditional standby facility already represented in the controlled investor model.</p></div></div>
      </Panel>
    </div>

    <div className="rounded-lg border border-border bg-surface p-5"><p className="text-[10px] uppercase tracking-wider text-subtle">External disclosure rule</p><p className="mt-2 text-sm leading-6 text-muted">{STAKEHOLDER_PORTAL_STATUS.disclosureRule} Investor-facing material must distinguish <strong>verified</strong>, <strong>modeled</strong>, <strong>pending</strong> and <strong>approval-required</strong> states.</p><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-xs text-accent">Investor Pitch</Link><Link to="/command/investor-board" className="rounded-md border border-border px-3 py-2 text-xs text-accent">Investor / Board</Link><Link to="/command/governance" className="rounded-md border border-border px-3 py-2 text-xs text-accent">Governance</Link><Link to="/command/founder-control" className="rounded-md border border-border px-3 py-2 text-xs text-accent">Founder Control</Link></div></div>
  </div>;
}
