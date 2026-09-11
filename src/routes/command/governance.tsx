import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi } from "@/components/kpi";
import {
  listGovernanceControls,
  type GovernanceEvidenceStatus,
} from "@/lib/governance-control-authority";
import { saveOperatingActionStatus } from "@/lib/operating-action-authority";

export const Route = createFileRoute("/command/governance")({
  loader: () => listGovernanceControls(),
  component: Governance,
});

type Gate = {
  id: string;
  domain: string;
  decision: string;
  owner: string;
  approver: string;
  status: GovernanceEvidenceStatus;
  evidence: string;
  to: string;
};

const defaults: Gate[] = [
  { id: "GOV-001", domain: "Finance", decision: "Funding tranche release", owner: "Founder / Finance", approver: "Founder / Board", status: "Pending", evidence: "CA verification + cash plan", to: "/command/ca-audit" },
  { id: "GOV-002", domain: "Engineering", decision: "Geometry / design baseline", owner: "Engineering", approver: "Engineering + QA", status: "Approved", evidence: "VEDM baseline + validation record", to: "/command/engineering" },
  { id: "GOV-003", domain: "Manufacturing", decision: "Pilot production release", owner: "Operations", approver: "Operations + QA", status: "Needs evidence", evidence: "Supplier qualification + QC evidence", to: "/command/qa-verification" },
  { id: "GOV-004", domain: "Procurement", decision: "Material / tooling commitment", owner: "Operations", approver: "Finance + Operations", status: "Pending", evidence: "RFQ comparison + budget owner", to: "/command/procurement" },
  { id: "GOV-005", domain: "EPR", decision: "Compliance execution gate", owner: "Compliance", approver: "Compliance + QA", status: "Approved", evidence: "EPR transaction evidence", to: "/command/epr-live" },
  { id: "GOV-006", domain: "Investor", decision: "External presentation release", owner: "Founder", approver: "Founder / Board", status: "Approved", evidence: "Controlled showcase views", to: "/command/investor-pitch" },
];

const auditEvents = [
  ["SHOWCASE", "Investor presentation release reviewed", "Founder"],
  ["EPR", "Compliance execution evidence accepted", "Compliance"],
  ["ENGINEERING", "VEDM baseline marked approved", "Engineering + QA"],
  ["FINANCE", "Funding tranche moved to pending approval", "Finance"],
];

const statusClass: Record<GovernanceEvidenceStatus, string> = {
  Approved: "border-green/30 bg-green/10 text-green",
  Pending: "border-warn/30 bg-warn/10 text-warn",
  "Needs evidence": "border-accent/30 bg-accent/10 text-accent",
  Draft: "border-border bg-surface text-muted",
};

function Governance() {
  const controls = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const gates = useMemo(
    () => defaults.map((gate) => {
      const persisted = controls[gate.id];
      return {
        ...gate,
        owner: persisted?.owner ?? gate.owner,
        approver: persisted?.approver ?? gate.approver,
        evidence: persisted?.evidence ?? gate.evidence,
        status: persisted?.evidenceStatus ?? gate.status,
        gateOpen: persisted?.gateOpen ?? true,
      };
    }),
    [controls],
  );

  const approved = gates.filter((gate) => gate.status === "Approved").length;
  const pending = gates.filter((gate) => gate.status === "Pending").length;
  const evidenceGaps = gates.filter((gate) => gate.status === "Needs evidence").length;
  const openControls = gates.filter((gate) => gate.gateOpen);
  const needsAttention = gates.filter((gate) => gate.gateOpen || gate.status !== "Approved");

  async function setGateState(gate: (typeof gates)[number], open: boolean) {
    setBusy(gate.id);
    setMessage("");
    try {
      await saveOperatingActionStatus({
        data: {
          actionId: `governance-gate:${gate.id}`,
          status: open ? "open" : "done",
          owner: gate.owner,
          note: JSON.stringify({
            approver: gate.approver,
            evidence: gate.evidence,
            evidenceStatus: gate.status,
          }),
        },
      });
      setMessage(`${gate.id} is now ${open ? "OPEN" : "CLOSED"}. The change is persisted through the governed operating-action authority.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Governance gate change failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Governance · controlled decisions</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Governance</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          One control plane for approval gates, accountable owners, required evidence and audit visibility. Gate enforcement state is persisted separately from evidence status, so OPEN/CLOSED controls never masquerade as evidence approval.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Governance gates" value={String(gates.length)} hint={`${openControls.length} currently OPEN`} tone={openControls.length ? "warn" : "ok"} />
        <Kpi label="Evidence approved" value={String(approved)} hint="Evidence accepted" tone="ok" />
        <Kpi label="Pending approval" value={String(pending)} hint="Authorised decision required" tone={pending ? "warn" : "ok"} />
        <Kpi label="Evidence gaps" value={String(evidenceGaps)} hint="Cannot advance yet" tone={evidenceGaps ? "danger" : "ok"} />
      </div>

      {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <section className="rounded-xl border border-accent/25 bg-accent/5 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Governed master controls</p>
        <h2 className="mt-1 font-display text-2xl text-accent">Master Data & planning BOM authority</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">These are the controls required by IBPE before a governed planning baseline can be created. Inventory Master approval establishes controlled SKU identity; BOM → Inventory Mapping releases the Longitude, Latitude and Altitude planning BOMs.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/command/master-data" className="rounded-lg border border-accent/40 bg-bg px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Open Master Data Engine →</Link>
          <Link to="/command/bom-inventory-mapping" className="rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-fg hover:border-accent">Open BOM → Inventory Mapping →</Link>
          <Link to="/command/planning" className="rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-fg hover:border-accent">Open Master Plan →</Link>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/35 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Needs attention</p><h2 className="mt-1 font-display text-2xl text-accent">Decisions that cannot be treated as complete</h2></div>
          <span className="text-xs text-muted">{needsAttention.length} controls need review</span>
        </div>
        <div className="mt-4 divide-y divide-border rounded-lg border border-border">
          {needsAttention.map((gate) => (
            <div key={gate.id} className="grid gap-2 p-4 md:grid-cols-[90px_140px_1fr_auto_auto] md:items-center">
              <Link to={gate.to as never} className="text-xs font-semibold text-accent hover:underline">{gate.id}</Link>
              <span className="text-xs text-muted">{gate.domain}</span>
              <div><p className="text-sm font-medium text-fg">{gate.decision}</p><p className="mt-1 text-xs text-muted">Required: {gate.evidence}</p></div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusClass[gate.status]}`}>{gate.status}</span>
              <span className={`rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold ${gate.gateOpen ? "border-warn/40 bg-warn/10 text-warn" : "border-green/40 bg-green/10 text-green"}`}>Gate {gate.gateOpen ? "OPEN" : "CLOSED"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/35 p-5 sm:p-6">
        <div className="mb-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Approval register</p><h2 className="mt-1 font-display text-2xl text-accent">Owner → evidence → approver → decision</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Gate</th><th className="px-3 py-3 text-left">Decision</th><th className="px-3 py-3 text-left">Owner</th><th className="px-3 py-3 text-left">Approver</th><th className="px-3 py-3 text-left">Required evidence</th><th className="px-3 py-3 text-left">Evidence status</th><th className="px-3 py-3 text-left">Enforcement</th></tr></thead>
            <tbody>{gates.map((gate) => (
              <tr key={gate.id} className="border-t border-border/70 align-top">
                <td className="px-3 py-3"><Link to={gate.to as never} className="font-semibold text-accent hover:underline">{gate.id}</Link><p className="mt-1 text-xs text-muted">{gate.domain}</p></td>
                <td className="px-3 py-3 font-medium text-fg">{gate.decision}</td>
                <td className="px-3 py-3 text-muted">{gate.owner}</td>
                <td className="px-3 py-3 text-muted">{gate.approver}</td>
                <td className="px-3 py-3 text-xs leading-5 text-muted">{gate.evidence}</td>
                <td className="px-3 py-3"><span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusClass[gate.status]}`}>{gate.status}</span></td>
                <td className="px-3 py-3">
                  <div className="flex min-w-[150px] flex-col gap-2">
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${gate.gateOpen ? "border-warn/40 text-warn" : "border-green/40 text-green"}`}>{gate.gateOpen ? "OPEN" : "CLOSED"}</span>
                    <button type="button" disabled={busy === gate.id} onClick={() => void setGateState(gate, !gate.gateOpen)} className="rounded border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent disabled:opacity-40">
                      {gate.gateOpen ? "Close gate" : "Re-open gate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <details className="rounded-xl border border-border bg-surface/25 p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-accent">Recent governance events <span className="ml-2 text-xs font-normal text-muted">Audit visibility</span></summary>
        <div className="mt-4 divide-y divide-border rounded-lg border border-border">{auditEvents.map(([area, event, actor]) => <div key={`${area}-${event}`} className="grid gap-2 p-4 md:grid-cols-[120px_1fr_180px]"><span className="text-xs font-semibold text-accent">{area}</span><span className="text-sm text-fg">{event}</span><span className="text-xs text-muted">Actor: {actor}</span></div>)}</div>
        <Link to="/command/actions" className="mt-4 inline-block text-sm font-semibold text-accent">Open Action & Audit Log →</Link>
      </details>

      <section className="rounded-xl border border-border bg-surface/25 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Evidence owners</p>
        <div className="mt-3 flex flex-wrap gap-2"><Link to="/command/master-data" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Master Data Engine</Link><Link to="/command/risk" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Risk register</Link><Link to="/command/legal" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Legal & IP</Link><Link to="/command/qa-verification" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">QA verification</Link><Link to="/command/actions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Action & audit log</Link><Link to="/command/ca-audit" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">CA evidence</Link><Link to="/command/epr-live" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">EPR evidence</Link></div>
        <p className="mt-4 text-xs leading-5 text-muted">Gate OPEN/CLOSED state is persisted through the governed operating-action authority. Evidence approval remains a separate control dimension; closing a gate does not fabricate or alter evidence status.</p>
      </section>
    </div>
  );
}
