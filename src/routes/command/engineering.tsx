import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { ENGINEERING_REVISIONS, ecrImpact, type Ecr } from "@/lib/finance/engineering-engine";
import { bomTotalInr } from "@/lib/finance/bom-engine";
import { useVeloxis } from "@/lib/store";
import { inr, lakh } from "@/lib/format";

export const Route = createFileRoute("/command/engineering")({ component: Engineering });

const initial: Ecr = {
  id: "ECR-001",
  title: "Carbon layup revision",
  product: "Carbon / Latitude",
  fromRevision: "C3",
  toRevision: "C4",
  reason: "Engineering improvement",
  bomCostDeltaInr: 0,
  weightDeltaG: 0,
  productionImpactPct: 0,
  inventoryImpactLakh: 0,
  affectedSkus: ["Carbon / Latitude"],
  status: "open",
};

function Engineering() {
  const finance = useVeloxis((s) => s.finance);
  const [ecr, setEcr] = useState(initial);
  const impact = useMemo(() => ecrImpact(ecr, finance.bomOverrides ?? {}), [ecr, finance.bomOverrides]);
  const released = ENGINEERING_REVISIONS.filter((revision) => revision.status === "released").length;
  const toolingBaselines = ENGINEERING_REVISIONS.filter((revision) => revision.tooling && revision.tooling !== "—").length;
  const unreleased = ENGINEERING_REVISIONS.filter((revision) => revision.status !== "released");
  const ecrNeedsApproval = ecr.status === "open";

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Engineer · controlled product baseline</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Engineering</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Product definition, controlled revisions, tooling references and engineering-change impact in one workspace. BOM economics and ISO 4210 validation remain specialist records behind the Engineering tabs.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Released baselines" value={`${released}/${ENGINEERING_REVISIONS.length}`} hint="Controlled product revisions" tone={unreleased.length ? "warn" : "ok"} />
        <Kpi label="Latitude BOM" value={inr(Math.round(bomTotalInr("pro", finance.bomOverrides ?? {})))} hint="Live BOM cost engine" />
        <Kpi label="Tooling baselines" value={String(toolingBaselines)} hint="Mould / jig references" tone={toolingBaselines === ENGINEERING_REVISIONS.length ? "ok" : "warn"} />
        <Kpi label="Open change" value={ecr.status.toUpperCase()} hint="Approval before release" tone={ecrNeedsApproval ? "warn" : "ok"} />
      </div>

      <Panel title="Needs attention" kicker="Only engineering exceptions that require action">
        {ecrNeedsApproval || unreleased.length ? (
          <div className="space-y-3">
            {ecrNeedsApproval ? (
              <div className="flex flex-col gap-3 rounded-xl border border-warn/30 bg-warn/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-fg">{ecr.id} · {ecr.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{ecr.product} {ecr.fromRevision} → {ecr.toRevision} is still open. Review BOM, production and inventory impact before release.</p>
                </div>
                <a href="#engineering-change" className="text-xs font-semibold text-accent">Review change →</a>
              </div>
            ) : null}
            {unreleased.map((revision) => (
              <div key={revision.product} className="rounded-xl border border-border p-4">
                <p className="text-sm font-semibold text-fg">{revision.product} · {revision.revision}</p>
                <p className="mt-1 text-xs text-muted">Revision status is {revision.status}; release evidence is still required.</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No open engineering exceptions. All registered product baselines are released.</p>
        )}
      </Panel>

      <Panel title="Controlled product baseline" kicker="Revision · material · tooling · drawing">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="px-3 py-3 text-left">Product</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Revision</th>
                <th className="px-3 py-3 text-left">Definition</th>
                <th className="px-3 py-3 text-left">Tooling</th>
                <th className="px-3 py-3 text-left">Drawing</th>
              </tr>
            </thead>
            <tbody>
              {ENGINEERING_REVISIONS.map((revision) => (
                <tr key={revision.product} className="border-t border-border/70 align-top">
                  <td className="px-3 py-3 font-medium text-fg">{revision.product}</td>
                  <td className="px-3 py-3 text-xs font-semibold uppercase text-green">{revision.status}</td>
                  <td className="px-3 py-3 font-semibold text-accent">{revision.revision}</td>
                  <td className="px-3 py-3 text-muted">
                    <p>{revision.geometry}</p>
                    <p className="mt-1 text-xs">{revision.material} · {revision.layup !== "—" ? revision.layup : revision.alloy}</p>
                  </td>
                  <td className="px-3 py-3 text-muted">{revision.tooling}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">{revision.drawing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <section id="engineering-change">
        <Panel title="Engineering Change Request" kicker="Change → BOM → production → inventory → finance">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-muted">Product
              <select className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" value={ecr.product} onChange={(event) => setEcr({ ...ecr, product: event.target.value })}>
                <option>Carbon / Latitude</option>
                <option>Aluminium / Core</option>
                <option>Premium Carbon / Altitude</option>
              </select>
            </label>
            <label className="text-xs text-muted">Revision change
              <input className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" value={`${ecr.fromRevision} → ${ecr.toRevision}`} onChange={(event) => setEcr({ ...ecr, toRevision: event.target.value.replace(`${ecr.fromRevision} → `, "") })} />
            </label>
            <label className="text-xs text-muted">BOM cost delta ₹
              <input type="number" className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" value={ecr.bomCostDeltaInr} onChange={(event) => setEcr({ ...ecr, bomCostDeltaInr: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">Weight delta g
              <input type="number" className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" value={ecr.weightDeltaG} onChange={(event) => setEcr({ ...ecr, weightDeltaG: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">Production impact %
              <input type="number" className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" value={ecr.productionImpactPct} onChange={(event) => setEcr({ ...ecr, productionImpactPct: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">Inventory impact ₹ L
              <input type="number" className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" value={ecr.inventoryImpactLakh} onChange={(event) => setEcr({ ...ecr, inventoryImpactLakh: Number(event.target.value) })} />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Kpi label="Revised BOM / COGS" value={lakh(impact.revisedCogsLakh)} hint={`Δ ${inr(ecr.bomCostDeltaInr)}`} />
            <Kpi label="Weight impact" value={`${ecr.weightDeltaG} g`} hint="Engineering effect" />
            <Kpi label="Inventory impact" value={`${ecr.inventoryImpactLakh.toFixed(2)} L`} hint="Working-capital effect" />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm">
            <p className="font-medium text-fg">Traceability</p>
            <p className="mt-2 text-muted">ECR → BOM ({impact.bomLinesAffected} affected estimate) → COGS → weight → production ({ecr.productionImpactPct}%) → inventory ({ecr.inventoryImpactLakh.toFixed(2)} L) → affected SKUs → financial review.</p>
          </div>
        </Panel>
      </section>

      <details className="rounded-xl border border-border bg-surface/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg">Engineering release rule</summary>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-muted md:grid-cols-3">
          <p><strong className="text-fg">Product & validation:</strong> ISO 4210 test planning and product economics remain on the Product & Validation tab.</p>
          <p><strong className="text-fg">BOM:</strong> quantity and landed-cost edits remain engineering estimates until explicitly linked to finance COGS.</p>
          <p><strong className="text-fg">Change control:</strong> an ECR must be reviewed for tooling, BOM, inventory and production impact before a new baseline is released.</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/command/product" className="text-xs font-semibold text-accent">Product & validation →</Link>
          <Link to="/command/bom" className="text-xs font-semibold text-accent">BOM →</Link>
          <Link to="/command/bom-control" className="text-xs font-semibold text-accent">BOM control →</Link>
        </div>
      </details>
    </div>
  );
}
