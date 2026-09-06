import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/command/governance")({ component: Governance });

type Status = "Approved" | "Pending" | "Needs evidence" | "Draft";

type Gate = {
  id: string;
  domain: string;
  decision: string;
  owner: string;
  approver: string;
  status: Status;
  evidence: string;
};

const gates: Gate[] = [
  { id: "GOV-001", domain: "Finance", decision: "Funding tranche release", owner: "Founder / Finance", approver: "Founder / Board", status: "Pending", evidence: "CA verification + cash plan" },
  { id: "GOV-002", domain: "Engineering", decision: "Geometry / design baseline", owner: "Engineering", approver: "Engineering + QA", status: "Approved", evidence: "VEDM baseline + validation record" },
  { id: "GOV-003", domain: "Manufacturing", decision: "Pilot production release", owner: "Operations", approver: "Operations + QA", status: "Needs evidence", evidence: "Supplier qualification + QC evidence" },
  { id: "GOV-004", domain: "Procurement", decision: "Material / tooling commitment", owner: "Operations", approver: "Finance + Operations", status: "Pending", evidence: "RFQ comparison + budget owner" },
  { id: "GOV-005", domain: "EPR", decision: "Compliance execution gate", owner: "Compliance", approver: "Compliance + QA", status: "Approved", evidence: "EPR transaction evidence" },
  { id: "GOV-006", domain: "Investor", decision: "External presentation release", owner: "Founder", approver: "Founder / Board", status: "Approved", evidence: "Controlled showcase views" },
];

const statusClass: Record<Status, string> = {
  Approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "Needs evidence": "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Draft: "border-border bg-surface text-muted",
};

const auditEvents = [
  ["09:42", "SHOWCASE", "Investor presentation release reviewed", "Founder"],
  ["09:18", "EPR", "Compliance execution evidence accepted", "Compliance"],
  ["08:51", "ENGINEERING", "VEDM baseline marked approved", "Engineering + QA"],
  ["08:20", "FINANCE", "Funding tranche moved to pending approval", "Finance"],
];

function Governance() {
  const approved = gates.filter((g) => g.status === "Approved").length;
  const pending = gates.filter((g) => g.status === "Pending").length;
  const evidence = gates.filter((g) => g.status === "Needs evidence").length;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">VINDY · Governance & Control</p>
        <h1 className="mt-1 font-display text-4xl">Approval & Audit Control Plane</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Phase G adds a single governance view for decision gates, approval ownership, evidence requirements and audit visibility across Finance, Engineering, Manufacturing, Procurement, EPR and Investor communications.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/command/actions" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Action Log</Link>
          <Link to="/command/qa-verification" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">QA / Verification</Link>
          <Link to="/command/ca-audit" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">CA Verification</Link>
          <Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Showcase</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Governance gates", String(gates.length), "Controlled decision points"],
          ["Approved", String(approved), "Evidence accepted"],
          ["Pending", String(pending), "Awaiting authorised decision"],
          ["Evidence gaps", String(evidence), "Cannot advance yet"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-subtle">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Decision architecture</p>
            <h2 className="mt-2 font-display text-2xl">No critical decision advances without an owner, approver and evidence rule.</h2>
          </div>
          <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted">Phase G · Governance</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            ["01", "Draft", "Define decision + owner"],
            ["02", "Evidence", "Attach proof / verification"],
            ["03", "Approval", "Authorised role decides"],
            ["04", "Audit", "Record outcome + trace"],
          ].map(([n, title, note]) => (
            <div key={n} className="rounded-lg border border-border p-4">
              <p className="text-xs font-semibold text-accent">{n}</p>
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.18em] text-accent">Approval register</p>
          <h2 className="mt-1 font-display text-2xl">Controlled decision gates</h2>
        </div>
        <div className="space-y-3">
          {gates.map((gate) => (
            <div key={gate.id} className="grid gap-3 rounded-lg border border-border p-4 lg:grid-cols-[6rem_8rem_1.4fr_1fr_1fr_auto] lg:items-center">
              <div><p className="text-xs text-subtle">{gate.id}</p><p className="mt-1 text-xs text-muted">{gate.domain}</p></div>
              <p className="text-sm font-medium">{gate.decision}</p>
              <div><p className="text-xs text-subtle">Owner</p><p className="mt-1 text-sm">{gate.owner}</p></div>
              <div><p className="text-xs text-subtle">Approver</p><p className="mt-1 text-sm">{gate.approver}</p></div>
              <div><p className="text-xs text-subtle">Required evidence</p><p className="mt-1 text-xs leading-5 text-muted">{gate.evidence}</p></div>
              <span className={`rounded-full border px-2.5 py-1 text-center text-[11px] whitespace-nowrap ${statusClass[gate.status]}`}>{gate.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Audit visibility</p>
            <h2 className="mt-1 font-display text-2xl">Recent governance events</h2>
          </div>
          <Link to="/command/actions" className="text-xs text-accent hover:underline">Open full Action Log →</Link>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {auditEvents.map(([time, area, event, actor]) => (
            <div key={`${time}-${area}`} className="grid gap-2 p-4 md:grid-cols-[5rem_8rem_1fr_10rem] md:items-center">
              <span className="text-xs text-subtle">{time}</span>
              <span className="text-xs font-semibold text-accent">{area}</span>
              <span className="text-sm">{event}</span>
              <span className="text-xs text-muted">Actor: {actor}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">Governance boundary</p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Phase G establishes the application governance model and presentation of decision evidence. The current register is an application control/read model; it is not yet an immutable backend audit ledger. Phase H should add durable persistence, authenticated actor identity, server-side approval enforcement, event IDs and retention controls before this is represented as security-grade audit evidence.
        </p>
      </section>
    </div>
  );
}
