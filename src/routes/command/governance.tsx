import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi } from "@/components/kpi";
import { listGovernanceControls, type GovernanceEvidenceStatus } from "@/lib/governance-control-authority";
import { saveOperatingActionStatus } from "@/lib/operating-action-authority";

export const Route = createFileRoute("/command/governance")({ component: Governance });

type Gate = { id: string; domain: string; decision: string; owner: string; approver: string; status: GovernanceEvidenceStatus; evidence: string; to: string };

const defaults: Gate[] = [
  { id: "GOV-001", domain: "Finance", decision: "Funding tranche release", owner: "Founder / Finance", approver: "Founder / Board", status: "Pending", evidence: "CA verification + cash plan", to: "/command/ca-audit" },
  { id: "GOV-002", domain: "Engineering", decision: "Geometry / design baseline", owner: "Engineering", approver: "Engineering + QA", status: "Approved", evidence: "VEDM baseline + validation record", to: "/command/engineering" },
  { id: "GOV-003", domain: "Manufacturing", decision: "Pilot production release", owner: "Operations", approver: "Operations + QA", status: "Needs evidence", evidence: "Supplier qualification + QC evidence", to: "/command/qa-verification" },
  { id: "GOV-004", domain: "Procurement", decision: "Material / tooling commitment", owner: "Operations", approver: "Finance + Operations", status: "Pending", evidence: "RFQ comparison + budget owner", to: "/command/procurement" },
  { id: "GOV-005", domain: "EPR", decision: "Compliance execution gate", owner: "Compliance", approver: "Compliance + QA", status: "Approved", evidence: "EPR transaction evidence", to: "/command/epr-live" },
  { id: "GOV-006", domain: "Investor", decision: "External presentation release", owner: "Founder", approver: "Founder / Board", status: "Approved", evidence: "Controlled showcase views", to: "/command/investor-pitch" },
];

const statuses: GovernanceEvidenceStatus[] = ["Approved", "Pending", "Needs evidence", "Draft"];
const statusClass: Record<GovernanceEvidenceStatus, string> = {
  Approved: "border-green/30 bg-green/10 text-green",
  Pending: "border-warn/30 bg-warn/10 text-warn",
  "Needs evidence": "border-accent/30 bg-accent/10 text-accent",
  Draft: "border-border bg-surface text-muted",
};

type EditableGate = Gate & { gateOpen: boolean };
const gateKey = (id: string) => `governance-gate:${id}`;

function Governance() {
  const [gates, setGates] = useState<EditableGate[]>(defaults.map((gate) => ({ ...gate, gateOpen: true })));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const persisted = await listGovernanceControls();
    setGates(defaults.map((gate) => {
      const saved = persisted[gate.id];
      return {
        ...gate,
        gateOpen: saved?.gateOpen ?? true,
        owner: saved?.owner ?? gate.owner,
        approver: saved?.approver ?? gate.approver,
        evidence: saved?.evidence ?? gate.evidence,
        status: saved?.evidenceStatus ?? gate.status,
      };
    }));
  }

  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load governance controls.")); }, []);

  const approved = gates.filter((gate) => gate.status === "Approved").length;
  const pending = gates.filter((gate) => gate.status === "Pending").length;
  const evidenceGaps = gates.filter((gate) => gate.status === "Needs evidence").length;
  const closed = gates.filter((gate) => !gate.gateOpen).length;
  const allOpen = closed === 0;

  function edit(id: string, patch: Partial<EditableGate>) {
    setGates((current) => current.map((gate) => gate.id === id ? { ...gate, ...patch } : gate));
  }

  async function save(gate: EditableGate) {
    setBusy(gate.id);
    setMessage("");
    try {
      await saveOperatingActionStatus({ data: {
        actionId: gateKey(gate.id),
        status: gate.gateOpen ? "open" : "done",
        owner: gate.owner,
        note: JSON.stringify({ approver: gate.approver, evidence: gate.evidence, evidenceStatus: gate.status }),
      }});
      await refresh();
      setMessage(`${gate.id} saved. Workflow gate is ${gate.gateOpen ? "OPEN" : "CLOSED"}; evidence status remains ${gate.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Governance control save failed.");
    } finally {
      setBusy(null);
    }
  }

  const needsAttention = useMemo(() => gates.filter((gate) => gate.status !== "Approved"), [gates]);

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Governance · editable control plane</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Governance</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Workflow enforcement and evidence maturity are separate. Gates are open by default for workflow testing; authorised users can edit the register and deliberately close a gate without falsifying the underlying evidence state.</p>
      </header>

      <div className={`rounded-xl border p-4 text-sm ${allOpen ? "border-green/30 bg-green/5 text-green" : "border-warn/40 bg-warn/5 text-warn"}`}>
        {allOpen ? "OPEN FOR WORKFLOW TESTING — no governance gate is currently enforcing a stop." : `${closed} governance gate${closed === 1 ? " is" : "s are"} deliberately CLOSED.`}
      </div>
      {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Governance gates" value={String(gates.length)} hint="Controlled decision points" />
        <Kpi label="Workflow open" value={String(gates.length - closed)} hint="Currently non-blocking" tone="ok" />
        <Kpi label="Approved evidence" value={String(approved)} hint="Evidence accepted" tone="ok" />
        <Kpi label="Pending" value={String(pending)} hint="Decision outstanding" tone={pending ? "warn" : "ok"} />
        <Kpi label="Evidence gaps" value={String(evidenceGaps)} hint="Evidence maturity only" tone={evidenceGaps ? "danger" : "ok"} />
      </div>

      <section className="rounded-xl border border-border bg-surface/35 p-5 sm:p-6">
        <div className="mb-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Editable approval register</p><h2 className="mt-1 font-display text-2xl text-accent">Owner → evidence → approver → decision → enforcement</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Gate</th><th className="px-3 py-3 text-left">Decision</th><th className="px-3 py-3 text-left">Owner</th><th className="px-3 py-3 text-left">Approver</th><th className="px-3 py-3 text-left">Required evidence</th><th className="px-3 py-3 text-left">Evidence status</th><th className="px-3 py-3 text-left">Workflow gate</th><th className="px-3 py-3 text-left">Save</th></tr></thead>
            <tbody>{gates.map((gate) => <tr key={gate.id} className="border-t border-border/70 align-top">
              <td className="px-3 py-3"><Link to={gate.to as never} className="font-semibold text-accent hover:underline">{gate.id}</Link><p className="mt-1 text-xs text-muted">{gate.domain}</p></td>
              <td className="px-3 py-3 font-medium text-fg">{gate.decision}</td>
              <td className="px-3 py-3"><input className="control min-w-40" value={gate.owner} onChange={(e) => edit(gate.id, { owner: e.target.value })} /></td>
              <td className="px-3 py-3"><input className="control min-w-40" value={gate.approver} onChange={(e) => edit(gate.id, { approver: e.target.value })} /></td>
              <td className="px-3 py-3"><input className="control min-w-56" value={gate.evidence} onChange={(e) => edit(gate.id, { evidence: e.target.value })} /></td>
              <td className="px-3 py-3"><select className={`control ${statusClass[gate.status]}`} value={gate.status} onChange={(e) => edit(gate.id, { status: e.target.value as GovernanceEvidenceStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
              <td className="px-3 py-3"><button type="button" onClick={() => edit(gate.id, { gateOpen: !gate.gateOpen })} className={`rounded-md border px-3 py-2 text-xs font-semibold ${gate.gateOpen ? "border-green/40 bg-green/10 text-green" : "border-warn/40 bg-warn/10 text-warn"}`}>Gate {gate.gateOpen ? "OPEN" : "CLOSED"}</button></td>
              <td className="px-3 py-3"><button type="button" disabled={busy === gate.id} onClick={() => void save(gate)} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-50">Save</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/35 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Evidence attention</p><h2 className="mt-1 font-display text-2xl text-accent">Incomplete evidence remains visible without automatically stopping the app</h2></div><span className="text-xs text-muted">{needsAttention.length} evidence items</span></div>
        <div className="mt-4 divide-y divide-border rounded-lg border border-border">{needsAttention.map((gate) => <Link key={gate.id} to={gate.to as never} className="grid gap-2 p-4 hover:bg-bg/50 md:grid-cols-[90px_140px_1fr_auto]"><span className="text-xs font-semibold text-accent">{gate.id}</span><span className="text-xs text-muted">{gate.domain}</span><div><p className="text-sm font-medium text-fg">{gate.decision}</p><p className="mt-1 text-xs text-muted">Required: {gate.evidence}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusClass[gate.status]}`}>{gate.status}</span></Link>)}</div>
      </section>

      <section className="rounded-xl border border-border bg-surface/25 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green">Governance registers</p>
        <div className="mt-3 flex flex-wrap gap-2"><Link to="/command/master-data" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Master Data</Link><Link to="/command/risk" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Risk register</Link><Link to="/command/legal" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Legal & IP</Link><Link to="/command/qa-verification" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">QA verification</Link><Link to="/command/actions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Action & audit log</Link><Link to="/command/ca-audit" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">CA evidence</Link><Link to="/command/epr-live" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">EPR evidence</Link></div>
        <p className="mt-4 text-xs leading-5 text-muted">Register records may be corrected by authorised users. Historical audit events remain append-only; opening a workflow gate does not rewrite evidence as approved.</p>
      </section>
    </div>
  );
}
