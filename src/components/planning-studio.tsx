import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { useVeloxis } from "@/lib/store";
import { buildAccountingModel } from "@/lib/finance/accounting";
import { buildModelWithInputs, totals } from "@/lib/finance/model";
import { canPerform, type CommandRole } from "@/lib/page-access";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  calendarMonthForPlanMonth,
  operatingPlanHorizonLabel,
  planningRisks,
  rollOperatingPlan,
  shiftOperatingPlan,
  type OperatingPlan,
  type OperatingPlanMilestoneId,
  type OperatingPlanProductId,
} from "@/lib/planning/operating-plan";
import {
  approveAndPublishOperatingPlan,
  createOperatingPlanDraft,
  listOperatingPlanVersions,
  rejectOperatingPlan,
  submitOperatingPlan,
  type OperatingPlanVersionRecord,
} from "@/lib/planning/planning-control";

function money(value: number) {
  return `₹${value.toFixed(1)}L`;
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

function signedNumber(value: number, suffix = "") {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

function PlanNumberInput({
  label,
  value,
  onChange,
  suffix,
  min = 1,
  max = 36,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-fg">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-bg px-3 focus-within:border-accent">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full bg-transparent py-2 text-sm tabular-nums text-fg outline-none"
        />
        {suffix ? <span className="text-xs text-subtle">{suffix}</span> : null}
      </div>
    </label>
  );
}

function summarizePlan(
  plan: OperatingPlan,
  drawStandby: boolean,
  finance: ReturnType<typeof useVeloxis.getState>["finance"],
  accounting: ReturnType<typeof useVeloxis.getState>["accounting"],
) {
  const rows = buildModelWithInputs("base", drawStandby, { ...finance, operatingPlan: plan });
  const accountingRows = buildAccountingModel(rows, accounting);
  const t = totals(rows);
  const trough = accountingRows.reduce(
    (minimum, row) => (row.closingCash < minimum.closingCash ? row : minimum),
    accountingRows[0],
  );
  const breakEven = accountingRows.find((row) => row.ebitda >= 0)?.m ?? null;
  return {
    revenue: t.revenue,
    units: t.units,
    plannedFunding: t.funding,
    troughCash: trough?.closingCash ?? 0,
    troughMonth: trough?.m ?? 1,
    additionalFundingGap: Math.max(0, plan.cashFloorLakh - (trough?.closingCash ?? 0)),
    breakEven,
  };
}

export function PlanningStudio({ role }: { role: CommandRole | null }) {
  const finance = useVeloxis((state) => state.finance);
  const accounting = useVeloxis((state) => state.accounting);
  const drawStandby = useVeloxis((state) => state.drawStandby);
  const setFinance = useVeloxis((state) => state.setFinance);
  const approvedPlan = finance.operatingPlan ?? DEFAULT_APPROVED_OPERATING_PLAN;
  const [draft, setDraft] = useState<OperatingPlan>(approvedPlan);
  const [changeReason, setChangeReason] = useState("Review launch timing and funding capacity.");
  const [savedVersion, setSavedVersion] = useState<OperatingPlanVersionRecord | null>(null);
  const [versions, setVersions] = useState<OperatingPlanVersionRecord[]>([]);
  const [stateMessage, setStateMessage] = useState("Working scenario is not part of the approved plan.");
  const [busy, setBusy] = useState(false);

  const editable = canPerform(role, "edit");
  const admin = role === "admin";

  useEffect(() => {
    setDraft(approvedPlan);
  }, [approvedPlan]);

  async function refreshVersions() {
    try {
      const records = await listOperatingPlanVersions();
      setVersions(records);
    } catch {
      setVersions([]);
    }
  }

  useEffect(() => {
    void refreshVersions();
  }, []);

  const approvedImpact = useMemo(
    () => summarizePlan(approvedPlan, drawStandby, finance, accounting),
    [approvedPlan, drawStandby, finance, accounting],
  );
  const draftImpact = useMemo(
    () => summarizePlan(draft, drawStandby, finance, accounting),
    [draft, drawStandby, finance, accounting],
  );
  const risks = useMemo(() => planningRisks(draft), [draft]);
  const publishedVersion = versions.find((version) => version.status === "published") ?? null;

  function mutateDraft(next: OperatingPlan) {
    setDraft(next);
    setSavedVersion(null);
    setStateMessage("Unsaved working scenario. Run the impact report below before submission.");
  }

  function updateMilestone(id: OperatingPlanMilestoneId, value: number) {
    mutateDraft({
      ...draft,
      milestoneMonths: { ...draft.milestoneMonths, [id]: Math.max(1, Math.min(36, Math.round(value))) },
    });
  }

  function updateProduct(id: OperatingPlanProductId, value: number) {
    mutateDraft({
      ...draft,
      productLaunchMonths: {
        ...draft.productLaunchMonths,
        [id]: Math.max(1, Math.min(36, Math.round(value))),
      },
    });
  }

  async function saveDraft() {
    if (!editable || busy) return;
    setBusy(true);
    setStateMessage("Saving governed draft…");
    try {
      const record = await createOperatingPlanDraft({
        data: {
          plan: draft,
          changeReason,
          sourceVersionId: publishedVersion?.id ?? null,
        },
      });
      setSavedVersion(record);
      setStateMessage(`Draft V${record.revisionNo} saved. It does not affect operations until approved.`);
      await refreshVersions();
    } catch (error) {
      setStateMessage(error instanceof Error ? error.message : "Could not save the operating-plan draft.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft() {
    if (!savedVersion || savedVersion.status !== "draft" || busy) return;
    setBusy(true);
    setStateMessage("Submitting plan for approval…");
    try {
      const record = await submitOperatingPlan({ data: { id: savedVersion.id } });
      setSavedVersion(record);
      setStateMessage(`V${record.revisionNo} submitted. The approved plan is unchanged.`);
      await refreshVersions();
    } catch (error) {
      setStateMessage(error instanceof Error ? error.message : "Could not submit the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function publishDraft() {
    if (!admin || !savedVersion || savedVersion.status !== "submitted" || busy) return;
    setBusy(true);
    setStateMessage("Publishing approved plan…");
    try {
      const record = await approveAndPublishOperatingPlan({ data: { id: savedVersion.id } });
      setSavedVersion(record);
      setFinance({ ...finance, operatingPlan: record.plan });
      setDraft(record.plan);
      setStateMessage(`V${record.revisionNo} approved and published. All forecast consumers now use it.`);
      await refreshVersions();
    } catch (error) {
      setStateMessage(error instanceof Error ? error.message : "Could not publish the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectDraft() {
    if (!admin || !savedVersion || savedVersion.status !== "submitted" || busy) return;
    setBusy(true);
    try {
      const record = await rejectOperatingPlan({
        data: { id: savedVersion.id, reason: "Returned by administrator from Planning Studio." },
      });
      setSavedVersion(record);
      setStateMessage(`V${record.revisionNo} rejected. The approved plan is unchanged.`);
      await refreshVersions();
    } catch (error) {
      setStateMessage(error instanceof Error ? error.message : "Could not reject the plan.");
    } finally {
      setBusy(false);
    }
  }

  const launchDelta = draft.milestoneMonths.commercialLaunch - approvedPlan.milestoneMonths.commercialLaunch;

  return (
    <div className="space-y-5">
      <Panel title="Approved plan & current forecast" kicker="Plan ≠ forecast ≠ scenario ≠ actual">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.13em] text-green">Published plan</p>
            <p className="mt-2 text-xl font-semibold text-fg">
              {publishedVersion ? `V${publishedVersion.revisionNo}` : "Baseline V1.0"}
            </p>
            <p className="mt-1 text-xs text-muted">{operatingPlanHorizonLabel(approvedPlan)}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.13em] text-green">Commercial launch</p>
            <p className="mt-2 text-xl font-semibold text-accent">
              M{approvedPlan.milestoneMonths.commercialLaunch}
            </p>
            <p className="mt-1 text-xs text-muted">
              {calendarMonthForPlanMonth(approvedPlan, approvedPlan.milestoneMonths.commercialLaunch)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.13em] text-green">36M modeled units</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-fg">{approvedImpact.units}</p>
            <p className="mt-1 text-xs text-muted">Demand-driven forecast</p>
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.13em] text-green">Cash trough</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-fg">{money(approvedImpact.troughCash)}</p>
            <p className="mt-1 text-xs text-muted">M{approvedImpact.troughMonth}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.13em] text-green">Additional funding gap</p>
            <p className={`mt-2 text-xl font-semibold tabular-nums ${approvedImpact.additionalFundingGap > 0 ? "text-danger" : "text-ok"}`}>
              {money(approvedImpact.additionalFundingGap)}
            </p>
            <p className="mt-1 text-xs text-muted">Against {money(approvedPlan.cashFloorLakh)} cash floor</p>
          </div>
        </div>
      </Panel>

      <Panel title="Scenario Studio" kicker="Edit → simulate → submit → admin approve → publish">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!editable || busy}
            onClick={() => mutateDraft(shiftOperatingPlan(draft, -1))}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-fg disabled:opacity-40"
          >
            Accelerate whole plan 1 month
          </button>
          <button
            type="button"
            disabled={!editable || busy}
            onClick={() => mutateDraft(shiftOperatingPlan(draft, 1))}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-fg disabled:opacity-40"
          >
            Delay whole plan 1 month
          </button>
          <button
            type="button"
            disabled={!editable || busy}
            onClick={() => mutateDraft(rollOperatingPlan(draft, 1))}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-fg disabled:opacity-40"
          >
            Roll horizon +1 month
          </button>
          <button
            type="button"
            disabled={!editable || busy}
            onClick={() => mutateDraft(approvedPlan)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-fg disabled:opacity-40"
          >
            Reset to approved
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border bg-surface/25 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-fg">Rolling horizon starts</span>
                <input
                  type="month"
                  value={draft.horizonStart}
                  disabled={!editable}
                  onChange={(event) => mutateDraft({ ...draft, horizonStart: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                />
              </label>
              <PlanNumberInput
                label="Demand scale"
                value={draft.demandScale}
                min={0}
                max={5}
                step={0.05}
                suffix="×"
                onChange={(value) => mutateDraft({ ...draft, demandScale: Math.max(0, Math.min(5, value)) })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PlanNumberInput label="Engineering baseline" value={draft.milestoneMonths.engineeringBaseline} suffix="M" onChange={(value) => updateMilestone("engineeringBaseline", value)} />
              <PlanNumberInput label="Prototype / validation" value={draft.milestoneMonths.prototypeValidation} suffix="M" onChange={(value) => updateMilestone("prototypeValidation", value)} />
              <PlanNumberInput label="Tooling / pilot" value={draft.milestoneMonths.toolingPilot} suffix="M" onChange={(value) => updateMilestone("toolingPilot", value)} />
              <PlanNumberInput label="Commercial launch" value={draft.milestoneMonths.commercialLaunch} suffix="M" onChange={(value) => updateMilestone("commercialLaunch", value)} />
              <PlanNumberInput label="Funding timing" value={draft.fundingTimingOffsetMonths} min={-12} max={24} suffix="mo" onChange={(value) => mutateDraft({ ...draft, fundingTimingOffsetMonths: Math.max(-12, Math.min(24, Math.round(value))) })} />
              <PlanNumberInput label="Minimum cash floor" value={draft.cashFloorLakh} min={0} max={500} step={1} suffix="₹L" onChange={(value) => mutateDraft({ ...draft, cashFloorLakh: Math.max(0, value) })} />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-surface/25 p-4">
            <div>
              <p className="text-xs font-semibold text-fg">VINDY product launch schedule</p>
              <p className="mt-1 text-[11px] leading-5 text-muted">Commercial product truth is Longitude, Latitude and Altitude. Material/BOM choices remain underneath each model.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <PlanNumberInput label="Longitude" value={draft.productLaunchMonths.longitude} suffix="M" onChange={(value) => updateProduct("longitude", value)} />
              <PlanNumberInput label="Latitude" value={draft.productLaunchMonths.latitude} suffix="M" onChange={(value) => updateProduct("latitude", value)} />
              <PlanNumberInput label="Altitude" value={draft.productLaunchMonths.altitude} suffix="M" onChange={(value) => updateProduct("altitude", value)} />
            </div>
            <label className="block">
              <span className="text-xs font-medium text-fg">Planning note</span>
              <textarea
                value={draft.note}
                disabled={!editable}
                maxLength={1000}
                rows={3}
                onChange={(event) => mutateDraft({ ...draft, note: event.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
              />
            </label>
          </div>
        </div>
      </Panel>

      <Panel title="Scenario impact report" kicker="Compared with the currently approved plan">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Launch shift", `${launchDelta >= 0 ? "+" : ""}${launchDelta} mo`],
            ["36M revenue", signedMoney(draftImpact.revenue - approvedImpact.revenue)],
            ["36M units", signedNumber(draftImpact.units - approvedImpact.units)],
            ["Planned funding", signedMoney(draftImpact.plannedFunding - approvedImpact.plannedFunding)],
            ["Cash trough", signedMoney(draftImpact.troughCash - approvedImpact.troughCash)],
            ["Extra funding gap", signedMoney(draftImpact.additionalFundingGap - approvedImpact.additionalFundingGap)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface/35 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-green">{label}</p>
              <p className="mt-2 text-base font-semibold tabular-nums text-fg">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface/25 p-4">
            <p className="text-xs font-semibold text-fg">Draft outcome</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted">Launch</span><p className="mt-1 font-semibold text-accent">M{draft.milestoneMonths.commercialLaunch} · {calendarMonthForPlanMonth(draft, draft.milestoneMonths.commercialLaunch)}</p></div>
              <div><span className="text-muted">36M revenue</span><p className="mt-1 font-semibold text-fg">{money(draftImpact.revenue)}</p></div>
              <div><span className="text-muted">Cash trough</span><p className="mt-1 font-semibold text-fg">{money(draftImpact.troughCash)} · M{draftImpact.troughMonth}</p></div>
              <div><span className="text-muted">Additional funding gap</span><p className="mt-1 font-semibold text-fg">{money(draftImpact.additionalFundingGap)}</p></div>
              <div><span className="text-muted">Break-even</span><p className="mt-1 font-semibold text-fg">{draftImpact.breakEven ? `M${draftImpact.breakEven}` : "Not reached"}</p></div>
              <div><span className="text-muted">Rolling horizon</span><p className="mt-1 font-semibold text-fg">{operatingPlanHorizonLabel(draft)}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface/25 p-4">
            <p className="text-xs font-semibold text-fg">Constraint warnings</p>
            {risks.length ? (
              <div className="mt-3 space-y-2">
                {risks.map((risk) => (
                  <div key={risk.code} className="rounded-lg border border-border bg-bg/40 p-3 text-xs">
                    <span className={`font-semibold uppercase ${risk.severity === "high" ? "text-danger" : risk.severity === "medium" ? "text-warn" : "text-muted"}`}>{risk.severity}</span>
                    <p className="mt-1 leading-5 text-muted">{risk.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ok">No structural timeline warning detected. Operational evidence still governs feasibility.</p>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Approval & publication" kicker="Working scenarios never rewrite the approved plan directly">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-medium text-fg">Reason for change</span>
            <textarea
              value={changeReason}
              disabled={!editable || busy}
              rows={2}
              maxLength={1000}
              onChange={(event) => setChangeReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!editable || busy || changeReason.trim().length < 3} onClick={saveDraft} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-fg disabled:opacity-40">Save draft</button>
            <button type="button" disabled={!savedVersion || savedVersion.status !== "draft" || busy} onClick={submitDraft} className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-40">Submit for approval</button>
            {admin ? <button type="button" disabled={!savedVersion || savedVersion.status !== "submitted" || busy} onClick={publishDraft} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg disabled:opacity-40">Approve & publish</button> : null}
            {admin ? <button type="button" disabled={!savedVersion || savedVersion.status !== "submitted" || busy} onClick={rejectDraft} className="rounded-lg border border-danger/40 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-40">Reject</button> : null}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">{stateMessage}</p>
        {!admin ? <p className="mt-1 text-[11px] text-subtle">Only an Admin can promote a submitted scenario into the published operating plan.</p> : null}
      </Panel>

      <details className="rounded-xl border border-border bg-surface/20 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Plan versions & audit trail</summary>
        <div className="mt-4 space-y-2">
          {versions.length ? versions.map((version) => (
            <div key={version.id} className="grid gap-2 rounded-lg border border-border bg-bg/30 p-3 text-xs md:grid-cols-[90px_110px_1fr_180px] md:items-center">
              <span className="font-semibold text-fg">V{version.revisionNo}</span>
              <span className="uppercase text-green">{version.status}</span>
              <span className="text-muted">{version.changeReason}</span>
              <span className="text-subtle">{version.publishedAt ?? version.submittedAt ?? version.createdAt}</span>
            </div>
          )) : <p className="text-xs text-muted">No persisted revisions yet. The repository baseline remains the active plan until the first Admin publication.</p>}
        </div>
        <div className="mt-4 text-xs text-muted">
          <Link to="/command/financial-cockpit" className="font-semibold text-accent">Open downstream Finance forecast →</Link>
        </div>
      </details>
    </div>
  );
}
