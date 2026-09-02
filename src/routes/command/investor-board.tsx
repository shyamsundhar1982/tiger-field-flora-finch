import { createFileRoute } from "@tanstack/react-router";
import { BOARD_DECISIONS, DILIGENCE_ITEMS, INVESTOR_BOARD_STATUS, INVESTOR_MILESTONES, INVESTOR_NEXT_ACTIONS, INVESTOR_PROOF_POINTS, USE_OF_PROCEEDS } from "@/lib/data/investor-board";

export const Route = createFileRoute("/command/investor-board")({ component: InvestorBoardPage });

const statusClass = (status: string) => status === "ready" || status === "approved" ? "text-emerald-600" : status === "blocked" ? "text-red-600" : status === "decision-needed" ? "text-amber-600" : "text-muted";

function InvestorBoardPage() {
  const readyDiligence = DILIGENCE_ITEMS.filter((item) => item.status === "ready").length;
  const blockedMilestones = INVESTOR_MILESTONES.filter((item) => item.status === "blocked").length;
  const decisionNeeded = BOARD_DECISIONS.filter((item) => item.status === "decision-needed" || item.status === "blocked").length;

  return <div className="space-y-8">
    <header>
      <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Stage 9 · Investor / Board</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Capital, diligence & decisions</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">{INVESTOR_BOARD_STATUS.headline} This layer converts the existing control registers into an investor-facing readiness and board-decision view.</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-4">
      {[
        ["Readiness", "Evidence-building"],
        ["Current tranche", `₹${INVESTOR_BOARD_STATUS.currentAskLakh}L`],
        ["Full ladder", `₹${INVESTOR_BOARD_STATUS.totalLadderLakh / 100}Cr`],
        ["Decisions / blockers", `${decisionNeeded} / ${blockedMilestones}`],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-widest text-subtle">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}
    </section>

    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Investor thesis / proof points</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{INVESTOR_PROOF_POINTS.map((point) => <div key={point} className="rounded-md border border-border p-3 text-sm text-muted">{point}</div>)}</div>
    </section>

    <section>
      <div className="mb-3 flex items-end justify-between"><div><h2 className="text-sm font-semibold">Capital ladder</h2><p className="text-xs text-muted">Each tranche is conditional on the stated evidence gate.</p></div></div>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-4 py-3">Tranche</th><th className="px-4 py-3">Ask</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Gate</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{INVESTOR_MILESTONES.map((item) => <tr key={item.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium">{item.tranche}<div className="text-xs text-subtle">{item.timing}</div></td><td className="px-4 py-3">₹{item.quantumLakh}L</td><td className="px-4 py-3 text-muted">{item.purpose}</td><td className="max-w-sm px-4 py-3 text-muted">{item.requiredEvidence}</td><td className="px-4 py-3 text-muted">{item.decisionGate}</td><td className={`px-4 py-3 ${statusClass(item.status)}`}>{item.status}</td></tr>)}</tbody></table></div>
    </section>

    <section>
      <h2 className="mb-3 text-sm font-semibold">Use of proceeds</h2>
      <div className="grid gap-3 md:grid-cols-5">{USE_OF_PROCEEDS.map((item) => <div key={item.tranche} className="rounded-lg border border-border p-4"><p className="text-xs font-semibold">{item.tranche}</p><p className="mt-2 text-sm font-medium">{item.allocation}</p><p className="mt-2 text-xs text-muted">{item.note}</p></div>)}</div>
    </section>

    <section>
      <h2 className="mb-3 text-sm font-semibold">Board decision register</h2>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-4 py-3">Decision</th><th className="px-4 py-3">Required decision</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Reserved</th></tr></thead><tbody>{BOARD_DECISIONS.map((item) => <tr key={item.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium">{item.id} · {item.title}</td><td className="px-4 py-3 text-muted">{item.decision}<div className="mt-1 text-xs text-subtle">Owner: {item.owner}</div></td><td className={`px-4 py-3 ${statusClass(item.status)}`}>{item.status}</td><td className="px-4 py-3 text-muted">{item.evidence}</td><td className="px-4 py-3">{item.reservedMatter ? "Yes" : "No"}</td></tr>)}</tbody></table></div>
    </section>

    <section>
      <div className="mb-3 flex items-end justify-between"><div><h2 className="text-sm font-semibold">Investor diligence room</h2><p className="text-xs text-muted">{readyDiligence} of {DILIGENCE_ITEMS.length} categories currently marked ready.</p></div></div>
      <div className="grid gap-3 md:grid-cols-3">{DILIGENCE_ITEMS.map((item) => <div key={item.id} className="rounded-lg border border-border p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{item.domain}</span><span className={`text-[10px] uppercase tracking-wider ${statusClass(item.status)}`}>{item.status}</span></div><p className="mt-2 text-sm">{item.item}</p><p className="mt-2 text-xs text-muted">Evidence: {item.evidence}</p></div>)}</div>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-surface p-5"><h2 className="text-sm font-semibold">Next investor actions</h2><ol className="mt-4 space-y-3 text-sm text-muted">{INVESTOR_NEXT_ACTIONS.map((action, index) => <li key={action} className="flex gap-3"><span className="text-xs text-subtle">0{index + 1}</span><span>{action}</span></li>)}</ol></div>
      <div className="rounded-lg border border-border bg-surface p-5"><h2 className="text-sm font-semibold">Fundraise rule</h2><p className="mt-4 text-sm leading-6 text-muted">{INVESTOR_BOARD_STATUS.strategy}</p><div className="mt-4 rounded-md border border-border p-3 text-xs text-muted">Investor-facing claims must remain aligned with the controlled Knowledge, Technical, Finance, Funding, Legal and Manufacturing registers. Pending validation must never be presented as completed validation.</div></div>
    </section>
  </div>;
}
