import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { buildAccountingModel } from "@/lib/finance/accounting";
import { buildModelWithInputs, minCash, totals, type FinanceAssumptions } from "@/lib/finance/model";
import { saveOperatingPlanDraft, submitOperatingPlan } from "@/lib/operating-plan-authority";
import { canPerform, type CommandRole } from "@/lib/page-access";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  calendarMonthForPlanMonth,
  normalizeOperatingPlan,
  operatingPlanHorizonLabel,
  planningRisks,
  rollOperatingPlan,
  shiftOperatingPlan,
  unitsForPlanMonth,
  type OperatingPlan,
} from "@/lib/planning/operating-plan";
import { useVeloxis } from "@/lib/store";

const money = (n: number) => `₹${n.toFixed(1)}L`;
const clampMonth = (n: number) => Math.max(-120, Math.min(36, Math.round(n || 0)));
const clampUnits = (n: number) => Math.max(0, Math.min(1_000_000, Math.round(Number(n) || 0)));

function NumberInput({ label, value, onChange, min = -120, max = 36, step = 1, suffix }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  return <label className="block"><span className="text-xs font-medium text-fg">{label}</span><div className="mt-1 flex items-center rounded-lg border border-border bg-bg px-3 focus-within:border-accent"><input type="number" value={value} min={min} max={max} step={step} onChange={(e)=>onChange(Number(e.target.value))} className="w-full bg-transparent py-2 text-sm tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-50"/>{suffix?<span className="text-xs text-subtle">{suffix}</span>:null}</div></label>;
}

function impact(finance: FinanceAssumptions, plan: OperatingPlan, drawStandby: boolean, accounting: ReturnType<typeof useVeloxis.getState>["accounting"]) {
  const rows = buildModelWithInputs("base", drawStandby, { ...finance, operatingPlan: plan });
  const books = buildAccountingModel(rows, accounting);
  const low = minCash(rows);
  const t = totals(rows);
  return {
    units: t.units,
    revenue: t.revenue,
    funding: t.funding,
    cashTrough: low.cash,
    cashTroughMonth: low.m,
    fundingGap: Math.max(0, plan.cashFloorLakh - low.cash),
    breakEven: books.find((row) => row.ebitda >= 0)?.m ?? null,
  };
}

export function PlanningStudio({ role, approvedFinance, draftFinance, draftId }: {
  role: CommandRole | null;
  approvedFinance?: FinanceAssumptions | null;
  draftFinance?: FinanceAssumptions | null;
  draftId?: string | null;
}) {
  const router = useRouter();
  const storeFinance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const setFinance = useVeloxis((s) => s.setFinance);
  const basisFinance = draftFinance ?? approvedFinance ?? storeFinance;
  const approvedPlan = normalizeOperatingPlan(approvedFinance?.operatingPlan ?? DEFAULT_APPROVED_OPERATING_PLAN);
  const [draft, setDraft] = useState<OperatingPlan>(() => normalizeOperatingPlan(basisFinance.operatingPlan ?? approvedPlan));
  const [reason, setReason] = useState("Review launch timing, demand and funding capacity.");
  const [message, setMessage] = useState("Working scenario is not company truth until submitted and approved.");
  const [busy, setBusy] = useState(false);
  const editable = Boolean(role && canPerform(role, "edit"));

  useEffect(() => {
    setDraft(normalizeOperatingPlan((draftFinance ?? approvedFinance ?? storeFinance).operatingPlan ?? approvedPlan));
  }, [approvedFinance, approvedPlan, draftFinance, storeFinance]);

  const approvedImpact = useMemo(() => impact(approvedFinance ?? storeFinance, approvedPlan, drawStandby, accounting), [approvedFinance, storeFinance, approvedPlan, drawStandby, accounting]);
  const draftImpact = useMemo(() => impact(basisFinance, draft, drawStandby, accounting), [basisFinance, draft, drawStandby, accounting]);
  const risks = useMemo(() => planningRisks(draft), [draft]);
  const monthlyRows = useMemo(() => {
    const withoutOverrides = normalizeOperatingPlan({ ...draft, monthlyDemandOverrides: {} });
    return Array.from({ length: 36 }, (_, index) => {
      const month = index + 1;
      const override = draft.monthlyDemandOverrides?.[String(month)];
      return {
        month,
        units: override ?? unitsForPlanMonth(withoutOverrides, month, "base"),
        overridden: override !== undefined,
      };
    });
  }, [draft]);

  function update(next: OperatingPlan) {
    setDraft(normalizeOperatingPlan(next));
    setMessage("Unsaved working scenario. Review impact before saving.");
  }

  function setMonthUnits(month: number, units: number) {
    update({
      ...draft,
      monthlyDemandOverrides: {
        ...(draft.monthlyDemandOverrides ?? {}),
        [String(month)]: clampUnits(units),
      },
    });
  }

  function resetMonthUnits(month: number) {
    const next = { ...(draft.monthlyDemandOverrides ?? {}) };
    delete next[String(month)];
    update({ ...draft, monthlyDemandOverrides: next });
  }

  async function save() {
    if (!editable || busy) return;
    setBusy(true);
    try {
      const nextFinance = { ...basisFinance, operatingPlan: draft, unitMultiplier: draft.demandScale };
      const saved = await saveOperatingPlanDraft({ data: { scenario, drawStandby, horizonMonths: 36, finance: nextFinance, accounting, changeReason: reason } });
      setFinance(nextFinance);
      setMessage(`Draft revision R${saved.revision} saved. Approved company plan is unchanged.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the scenario draft.");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!editable || !draftId || busy) return;
    setBusy(true);
    try {
      const result = await submitOperatingPlan({ data: { planId: draftId } });
      setMessage(`Revision R${result.revision} submitted for approval. Operations still use the current approved plan.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit the draft.");
    } finally { setBusy(false); }
  }

  const delta = draft.milestoneMonths.commercialLaunch - approvedPlan.milestoneMonths.commercialLaunch;
  return <div className="space-y-5">
    <Panel title="Rolling 36-month Scenario Studio" kicker="Edit → simulate → save draft → submit → approve → publish">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-green">Approved horizon</p><p className="mt-2 font-semibold">{operatingPlanHorizonLabel(approvedPlan)}</p></div>
        <div className="rounded-xl border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-green">Approved launch</p><p className="mt-2 text-xl font-semibold text-accent">M{approvedPlan.milestoneMonths.commercialLaunch}</p><p className="text-xs text-muted">{calendarMonthForPlanMonth(approvedPlan, approvedPlan.milestoneMonths.commercialLaunch)}</p></div>
        <div className="rounded-xl border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-green">Scenario launch</p><p className="mt-2 text-xl font-semibold text-accent">M{draft.milestoneMonths.commercialLaunch}</p><p className="text-xs text-muted">{delta===0?"No timing variance":`${delta>0?"+":""}${delta} month(s)`}</p></div>
        <div className="rounded-xl border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-green">36M units</p><p className="mt-2 text-xl font-semibold">{draftImpact.units}</p><p className="text-xs text-muted">Approved {approvedImpact.units}</p></div>
        <div className="rounded-xl border border-border p-4"><p className="text-[10px] uppercase tracking-wider text-green">Funding gap</p><p className={`mt-2 text-xl font-semibold ${draftImpact.fundingGap>0?"text-danger":"text-ok"}`}>{money(draftImpact.fundingGap)}</p><p className="text-xs text-muted">Cash floor {money(draft.cashFloorLakh)}</p></div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button disabled={!editable||busy} onClick={()=>update(shiftOperatingPlan(draft,-1))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Accelerate 1 month</button>
        <button disabled={!editable||busy} onClick={()=>update(shiftOperatingPlan(draft,1))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Delay 1 month</button>
        <button disabled={!editable||busy} onClick={()=>update(rollOperatingPlan(draft,1))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Roll horizon +1 month</button>
        <button disabled={!editable||busy} onClick={()=>update(approvedPlan)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Reset to approved</button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 disabled:opacity-60">
            <label className="block"><span className="text-xs font-medium">Horizon start</span><input type="month" value={draft.horizonStart} onChange={(e)=>update({...draft,horizonStart:e.target.value})} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"/></label>
            <NumberInput label="Engineering baseline" value={draft.milestoneMonths.engineeringBaseline} suffix="M" onChange={(v)=>update({...draft,milestoneMonths:{...draft.milestoneMonths,engineeringBaseline:clampMonth(v)}})}/>
            <NumberInput label="Prototype / validation" value={draft.milestoneMonths.prototypeValidation} suffix="M" onChange={(v)=>update({...draft,milestoneMonths:{...draft.milestoneMonths,prototypeValidation:clampMonth(v)}})}/>
            <NumberInput label="Tooling / pilot" value={draft.milestoneMonths.toolingPilot} suffix="M" onChange={(v)=>update({...draft,milestoneMonths:{...draft.milestoneMonths,toolingPilot:clampMonth(v)}})}/>
            <NumberInput label="Commercial launch" value={draft.milestoneMonths.commercialLaunch} suffix="M" onChange={(v)=>update({...draft,milestoneMonths:{...draft.milestoneMonths,commercialLaunch:clampMonth(v)}})}/>
            <NumberInput label="Demand scale" value={draft.demandScale} min={0} max={5} step={0.05} suffix="×" onChange={(v)=>update({...draft,demandScale:v})}/>
            <NumberInput label="Funding timing" value={draft.fundingTimingOffsetMonths} min={-12} max={24} suffix="mo" onChange={(v)=>update({...draft,fundingTimingOffsetMonths:Math.round(v)})}/>
            <NumberInput label="Minimum cash floor" value={draft.cashFloorLakh} min={0} max={500} suffix="₹L" onChange={(v)=>update({...draft,cashFloorLakh:v})}/>
            <NumberInput label="Longitude launch" value={draft.productLaunchMonths.longitude} suffix="M" onChange={(v)=>update({...draft,productLaunchMonths:{...draft.productLaunchMonths,longitude:clampMonth(v)}})}/>
            <NumberInput label="Latitude launch" value={draft.productLaunchMonths.latitude} suffix="M" onChange={(v)=>update({...draft,productLaunchMonths:{...draft.productLaunchMonths,latitude:clampMonth(v)}})}/>
            <NumberInput label="Altitude launch" value={draft.productLaunchMonths.altitude} suffix="M" onChange={(v)=>update({...draft,productLaunchMonths:{...draft.productLaunchMonths,altitude:clampMonth(v)}})}/>
          </fieldset>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-green">Impact report</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Revenue</span><span>{money(draftImpact.revenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Scheduled funding</span><span>{money(draftImpact.funding)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Cash trough</span><span>{money(draftImpact.cashTrough)} · M{draftImpact.cashTroughMonth}</span></div>
            <div className="flex justify-between"><span className="text-muted">Break-even</span><span>{draftImpact.breakEven?`M${draftImpact.breakEven}`:"Beyond horizon"}</span></div>
          </div>
          <div className="mt-4 space-y-2">{risks.length?risks.map((risk)=><div key={risk.code} className="rounded-lg border border-border p-3"><p className={`text-xs font-semibold ${risk.severity==="high"?"text-danger":risk.severity==="medium"?"text-warn":"text-muted"}`}>{risk.severity.toUpperCase()} · {risk.code}</p><p className="mt-1 text-xs text-muted">{risk.message}</p></div>):<p className="text-sm text-ok">No structural planning risks detected.</p>}</div>
        </div>
      </div>

      <details className="mt-5 rounded-xl border border-border bg-bg/30 p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-fg">Month-by-month base production / demand units</summary>
        <p className="mt-2 max-w-4xl text-xs leading-5 text-muted">Admin-editable planning inputs only. A monthly override recalculates demand, product mix, revenue, COGS, inventory purchases and funding forecasts. It never creates a Commercial order, Production job card, traveller, inventory movement or supplier commitment.</p>
        <fieldset disabled={!editable} className="mt-4 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 disabled:opacity-60">
          {monthlyRows.map((row) => (
            <label key={row.month} className={`rounded-lg border p-2 ${row.overridden ? "border-accent/50 bg-accent/5" : "border-border bg-surface/30"}`}>
              <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-subtle"><span>M{row.month}</span>{row.overridden ? <button type="button" onClick={() => resetMonthUnits(row.month)} className="font-semibold text-accent hover:underline">reset</button> : null}</span>
              <input type="number" min="0" max="1000000" step="1" value={row.units} onChange={(event) => setMonthUnits(row.month, Number(event.target.value))} className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-right text-sm font-semibold tabular-nums outline-none focus:border-accent" />
            </label>
          ))}
        </fieldset>
      </details>

      <label className="mt-5 block"><span className="text-xs font-medium">Change reason / decision context</span><textarea value={reason} disabled={!editable} onChange={(e)=>setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"/></label>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={!editable||busy} onClick={()=>void save()} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg disabled:opacity-40">Save governed draft</button><button disabled={!editable||!draftId||busy} onClick={()=>void submit()} className="rounded-lg border border-accent px-4 py-2 text-xs font-semibold text-accent disabled:opacity-40">Submit current draft</button><span className="text-xs text-muted">{message}</span></div>
    </Panel>
  </div>;
}
