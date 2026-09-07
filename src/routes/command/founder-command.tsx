import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/kpi";
import {
  FOUNDER_ACTIONS,
  FOUNDER_GATES,
  FOUNDER_STATUS_LABELS,
  resolveFounderActions,
} from "@/lib/data/founder-command";
import { listFounderEvidence, recordFounderEvidence } from "@/lib/founder-evidence";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/founder-command")({ component: FounderCommand });

type EvidenceRow = {
  id: string;
  action_id: string;
  evidence_type: string;
  evidence_ref: string | null;
  note: string;
  actor_role: string;
  created_at: string;
};

function FounderCommand() {
  const actionProgress = useVeloxis((s) => s.actions);
  const setAction = useVeloxis((s) => s.setAction);
  const founderActions = resolveFounderActions(actionProgress);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [selectedAction, setSelectedAction] = useState(FOUNDER_ACTIONS[0]?.id ?? "FC-01");
  const [evidenceType, setEvidenceType] = useState("document");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [note, setNote] = useState("");
  const [evidenceState, setEvidenceState] = useState("Loading evidence ledger…");

  const evidenceByAction = useMemo(
    () => new Set(evidence.map((item) => item.action_id)),
    [evidence],
  );
  const blocked = founderActions.filter((action) => action.status === "blocked").length;
  const active = founderActions.filter((action) => action.status === "active").length;
  const next = founderActions.filter((action) => action.status === "next").length;

  useEffect(() => {
    let mounted = true;
    listFounderEvidence()
      .then((items) => {
        if (!mounted) return;
        setEvidence(items as EvidenceRow[]);
        setEvidenceState(`${items.length} evidence record${items.length === 1 ? "" : "s"} loaded`);
      })
      .catch(() => {
        if (mounted) setEvidenceState("Evidence ledger unavailable — no completion is assumed.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function submitEvidence() {
    if (note.trim().length < 3) {
      setEvidenceState("Add a short evidence note before recording.");
      return;
    }
    setEvidenceState("Recording evidence…");
    try {
      await recordFounderEvidence({
        data: {
          actionId: selectedAction,
          evidenceType: evidenceType as
            | "document"
            | "decision"
            | "measurement"
            | "quotation"
            | "test"
            | "link"
            | "note",
          evidenceRef: evidenceRef.trim() || undefined,
          note: note.trim(),
        },
      });
      const latest = await listFounderEvidence();
      setEvidence(latest as EvidenceRow[]);
      setNote("");
      setEvidenceRef("");
      setEvidenceState("Evidence recorded and linked to the action.");
    } catch (error) {
      setEvidenceState(error instanceof Error ? error.message : "Evidence could not be recorded.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-green">Governance · action & evidence</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Founder Action & Evidence Ledger</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Accountable founder actions, gates and durable evidence. Financial health is intentionally
            owned by the canonical Command Centre and Financial Cockpit rather than duplicated here.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command" className="text-accent hover:text-fg">Command Centre →</Link>
          <Link to="/command/financial-cockpit" className="text-accent hover:text-fg">Finance →</Link>
          <Link to="/command/governance" className="text-accent hover:text-fg">Governance →</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="Actions" value={founderActions.length} />
        <Summary label="Blocked" value={blocked} tone={blocked ? "text-warn" : "text-green"} />
        <Summary label="Active" value={active} />
        <Summary label="Next" value={next} />
      </div>

      <Panel title="Founder action queue" kicker="Owner → status → evidence → outcome">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[70rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Evidence</th>
                <th className="py-2">Outcome / dependency</th>
              </tr>
            </thead>
            <tbody>
              {founderActions.map((action) => (
                <tr key={action.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3 font-semibold text-accent">{action.id}</td>
                  <td className="py-3 pr-3 text-[10px] uppercase tracking-wider">{action.priority}</td>
                  <td className="py-3 pr-3 font-medium text-fg">{action.title}</td>
                  <td className="py-3 pr-3 text-muted">{action.owner}</td>
                  <td className="py-3 pr-3 text-muted">{action.stage}</td>
                  <td className="py-3 pr-3">
                    <select
                      aria-label={`${action.id} progress`}
                      value={
                        actionProgress[action.id] ??
                        (action.status === "active" ? "doing" : action.status === "complete" ? "done" : "open")
                      }
                      onChange={(event) =>
                        setAction(action.id, event.target.value as "open" | "doing" | "done")
                      }
                      className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg"
                    >
                      <option value="open">
                        {FOUNDER_STATUS_LABELS[FOUNDER_ACTIONS.find((item) => item.id === action.id)?.status ?? "next"]}
                      </option>
                      <option value="doing">Active</option>
                      <option value="done">Complete</option>
                    </select>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {evidenceByAction.has(action.id) ? (
                      <span className="text-green">Evidence linked</span>
                    ) : (
                      <span className="text-subtle">No evidence</span>
                    )}
                  </td>
                  <td className="py-3 text-xs leading-5 text-muted">
                    {action.outcome}{action.dependency ? ` · Depends on ${action.dependency}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Command gates" kicker="Advance only with recorded evidence">
        <div className="grid gap-3 md:grid-cols-5">
          {FOUNDER_GATES.map((gate) => (
            <div key={gate.gate} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs font-semibold text-accent">{gate.gate}</p>
              <p className="mt-2 text-sm font-medium text-fg">{gate.title}</p>
              <p className="mt-1 text-xs text-muted">{gate.when}</p>
              <p className="mt-2 text-[10px] leading-4 text-subtle">{gate.controls.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Record evidence" kicker={evidenceState}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs text-muted">
              Action
              <select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value)} className="control mt-1.5">
                {FOUNDER_ACTIONS.map((action) => (
                  <option key={action.id} value={action.id}>{action.id} · {action.title}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Evidence type
              <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="control mt-1.5">
                <option value="document">Document</option>
                <option value="decision">Decision</option>
                <option value="measurement">Measurement</option>
                <option value="quotation">Quotation</option>
                <option value="test">Test</option>
                <option value="link">Link</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label className="block text-xs text-muted">
              Evidence reference
              <input value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} className="control mt-1.5" placeholder="Document, URL or reference" />
            </label>
            <label className="block text-xs text-muted">
              Note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} className="control mt-1.5 min-h-24" placeholder="What does this evidence establish?" />
            </label>
            <button type="button" onClick={() => void submitEvidence()} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg">
              Record evidence
            </button>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-surface">
            {evidence.length === 0 ? (
              <p className="p-5 text-sm text-muted">No evidence records are available.</p>
            ) : (
              evidence.map((item) => (
                <div key={item.id} className="border-b border-border p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-accent">{item.action_id}</span>
                    <span className="text-[10px] uppercase tracking-wider text-subtle">{item.evidence_type}</span>
                  </div>
                  <p className="mt-2 text-sm text-fg">{item.note}</p>
                  <p className="mt-2 text-xs text-muted">
                    {item.evidence_ref || "No external reference"} · {item.actor_role} · {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Summary({ label, value, tone = "text-fg" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className={`mt-1 text-2xl tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
