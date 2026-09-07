import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useVeloxis } from "@/lib/store";
import {
  PLAN_PRODUCT_BY_FINANCE_ID,
  SCENARIOS,
  buildModelWithInputs,
} from "@/lib/finance/model";
import { Panel } from "@/components/kpi";
import type { FundingType } from "@/lib/finance/accounting";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  calendarMonthForPlanMonth,
  effectiveProductLaunchMonth,
} from "@/lib/planning/operating-plan";

export const Route = createFileRoute("/command/finance-assumptions")({
  component: FinanceAssumptions,
});

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-fg">{label}</span>
      {hint ? <span className="ml-2 text-[10px] text-subtle">{hint}</span> : null}
      <div className="mt-1 flex items-center rounded-lg border border-border bg-bg px-3 focus-within:border-accent">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full bg-transparent py-2 text-sm tabular-nums text-fg outline-none"
        />
        {suffix ? <span className="text-xs text-subtle">{suffix}</span> : null}
      </div>
    </label>
  );
}

function FinanceAssumptions() {
  const finance = useVeloxis((state) => state.finance);
  const accounting = useVeloxis((state) => state.accounting);
  const updateGlobal = useVeloxis((state) => state.updateGlobalFinance);
  const updateProduct = useVeloxis((state) => state.updateProductLine);
  const updateAccounting = useVeloxis((state) => state.updateAccounting);
  const setFundingType = useVeloxis((state) => state.setFundingType);
  const scenario = useVeloxis((state) => state.scenario);
  const setScenario = useVeloxis((state) => state.setScenario);
  const drawStandby = useVeloxis((state) => state.drawStandby);
  const plan = finance.operatingPlan ?? DEFAULT_APPROVED_OPERATING_PLAN;

  const fundingMonths = useMemo(
    () => buildModelWithInputs(scenario, drawStandby, finance).filter((row) => row.funding > 0),
    [scenario, drawStandby, finance],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-green">Finance · editable financial assumptions</p>
        <h1 className="font-display text-4xl text-accent">Financial Plan Inputs</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          This page owns financial and accounting assumptions only. Demand scale, milestone timing and VINDY
          model launch months are governed by the approved Rolling Operating Plan and cannot be changed here.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command/planning" className="text-accent">Open Planning & Scenario Studio →</Link>
          <Link to="/command/financial-cockpit" className="text-accent">Financial cockpit →</Link>
          <Link to="/command/inventory" className="text-accent">Master Inventory →</Link>
        </div>
      </div>

      <Panel title="Plan-controlled drivers" kicker="Read-only here · edit through governed Planning Studio">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-green">Demand scale</p>
            <p className="mt-2 text-xl font-semibold text-fg">{plan.demandScale.toFixed(2)}×</p>
          </div>
          {finance.productLines.map((line) => {
            const product = PLAN_PRODUCT_BY_FINANCE_ID[line.id];
            const launch = effectiveProductLaunchMonth(plan, product, "base");
            return (
              <div key={line.id} className="rounded-xl border border-border bg-surface/35 p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-green">{line.label}</p>
                <p className="mt-2 text-xl font-semibold text-accent">M{launch}</p>
                <p className="mt-1 text-xs text-muted">{calendarMonthForPlanMonth(plan, launch)}</p>
              </div>
            );
          })}
          <div className="rounded-xl border border-border bg-surface/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-green">Cash floor</p>
            <p className="mt-2 text-xl font-semibold text-fg">₹{plan.cashFloorLakh.toFixed(1)}L</p>
          </div>
        </div>
      </Panel>

      <Panel title="Scenario" kicker="Forecast lens · approved plan remains unchanged">
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(SCENARIOS).map(([id, item]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScenario(id as keyof typeof SCENARIOS)}
              className={`rounded-xl border p-4 text-left ${
                scenario === id ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/50"
              }`}
            >
              <p className="text-sm font-semibold text-fg">{item.label}</p>
              <p className="mt-1 text-xs text-accent">{item.probability} planning weight</p>
              <p className="mt-2 text-xs leading-5 text-muted">{item.note}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Financial sensitivities" kicker="Cost and liquidity drivers only">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberInput label="Opex" value={finance.opexMultiplier} step={0.05} suffix="×" hint="1.00 = approved assumption" onChange={(value) => updateGlobal("opexMultiplier", Math.max(0, value))} />
          <NumberInput label="Capex" value={finance.capexMultiplier} step={0.05} suffix="×" hint="1.00 = approved assumption" onChange={(value) => updateGlobal("capexMultiplier", Math.max(0, value))} />
          <NumberInput label="Inventory purchase cost" value={finance.inventoryMultiplier} step={0.05} suffix="×" hint="1.00 = approved assumption" onChange={(value) => updateGlobal("inventoryMultiplier", Math.max(0, value))} />
          <NumberInput label="Scheduled funding draw" value={finance.fundingMultiplier} step={0.05} suffix="×" hint="Applied to approved funding envelopes" onChange={(value) => updateGlobal("fundingMultiplier", Math.max(0, value))} />
          <NumberInput label="Opening cash" value={finance.openingCashLakh} step={0.5} suffix="₹L" onChange={(value) => updateGlobal("openingCashLakh", value)} />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          Funding envelopes are scheduled by the approved plan. The Financial Cockpit separately calculates
          the cash trough and additional funding gap; scheduled funding is not treated as proof that enough cash exists.
        </p>
      </Panel>

      <Panel title="VINDY product economics" kicker="ASP · COGS · mix · launch comes from Planning">
        <div className="space-y-5">
          {finance.productLines.map((line) => {
            const product = PLAN_PRODUCT_BY_FINANCE_ID[line.id];
            const launch = effectiveProductLaunchMonth(plan, product, "base");
            return (
              <div key={line.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium text-fg">{line.label}</p>
                    <p className="text-xs text-muted">{line.priceBand}</p>
                  </div>
                  <p className="text-xs text-subtle">
                    Launch M{launch} · {calendarMonthForPlanMonth(plan, launch)} · Plan-controlled
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberInput label="ASP" value={line.aspLakh} step={0.01} suffix="₹L" onChange={(value) => updateProduct(line.id, "aspLakh", Math.max(0, value))} />
                  <NumberInput label="Manual COGS" value={line.cogsLakh} step={0.01} suffix="₹L" hint="Use BOM source when verified" onChange={(value) => updateProduct(line.id, "cogsLakh", Math.max(0, value))} />
                  <NumberInput label="Portfolio mix" value={line.mixPct} step={1} suffix="%" onChange={(value) => updateProduct(line.id, "mixPct", Math.max(0, value))} />
                </div>
              </div>
            );
          })}
        </div>
        <Link to="/command/bom" className="mt-4 inline-block text-sm font-semibold text-accent">Open BOM & Cost Engine →</Link>
      </Panel>

      <Panel title="Accounting controls" kicker="Timed working capital + statutory inputs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberInput label="Customer collection" value={accounting.collectionDays ?? accounting.collectionMonths * 30} step={5} suffix="days" hint="30 = one month" onChange={(value) => updateAccounting("collectionDays", Math.max(0, value))} />
          <NumberInput label="Supplier payment" value={accounting.supplierPaymentDays ?? accounting.supplierCreditMonths * 30} step={5} suffix="days" hint="30 = one month" onChange={(value) => updateAccounting("supplierPaymentDays", Math.max(0, value))} />
          <NumberInput label="Depreciation life" value={accounting.depreciationMonths} step={1} suffix="months" onChange={(value) => updateAccounting("depreciationMonths", Math.max(1, value))} />
          <NumberInput label="GST settlement" value={accounting.gstSettlementMonths} step={1} suffix="months" onChange={(value) => updateAccounting("gstSettlementMonths", Math.max(0, value))} />
          <NumberInput label="Tax rate" value={accounting.taxRatePct} step={1} suffix="%" onChange={(value) => updateAccounting("taxRatePct", Math.max(0, value))} />
          <NumberInput label="GST rate" value={accounting.gstRatePct} step={1} suffix="%" onChange={(value) => updateAccounting("gstRatePct", Math.max(0, value))} />
          <NumberInput label="Opening receivables" value={accounting.openingReceivablesLakh} step={0.5} suffix="₹L" onChange={(value) => updateAccounting("openingReceivablesLakh", Math.max(0, value))} />
          <NumberInput label="Opening payables" value={accounting.openingPayablesLakh} step={0.5} suffix="₹L" onChange={(value) => updateAccounting("openingPayablesLakh", Math.max(0, value))} />
          <NumberInput label="Opening fixed assets" value={accounting.openingFixedAssetsLakh} step={0.5} suffix="₹L" onChange={(value) => updateAccounting("openingFixedAssetsLakh", Math.max(0, value))} />
          <NumberInput label="Opening equity" value={accounting.openingEquityLakh} step={0.5} suffix="₹L" onChange={(value) => updateAccounting("openingEquityLakh", value)} />
          <NumberInput label="Opening debt" value={accounting.openingDebtLakh} step={0.5} suffix="₹L" onChange={(value) => updateAccounting("openingDebtLakh", Math.max(0, value))} />
          <NumberInput label="Retained earnings" value={accounting.openingRetainedEarningsLakh} step={0.5} suffix="₹L" onChange={(value) => updateAccounting("openingRetainedEarningsLakh", value)} />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          Day-based controls are the source of truth; legacy month fields remain for backward compatibility.
          Enter CA-verified opening balances, tax and GST treatment before statutory use.
        </p>
      </Panel>

      <Panel title="Funding classification" kicker="Classification only · timing is owned by the approved plan">
        <div className="grid gap-3 md:grid-cols-2">
          {fundingMonths.map((row) => (
            <label key={row.m} className="rounded-xl border border-border bg-surface p-3">
              <span className="flex items-center justify-between text-xs text-muted">
                <span>Month {row.m}</span>
                <strong className="text-fg">₹{row.funding.toFixed(1)}L</strong>
              </span>
              <select
                value={(accounting.fundingTypeByMonth?.[row.m] ?? "equity") as FundingType}
                onChange={(event) => setFundingType(row.m, event.target.value as FundingType)}
                className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg"
              >
                <option value="equity">Equity</option>
                <option value="debt">Debt</option>
                <option value="grant">Grant</option>
              </select>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Funding classification does not change the approved envelope or milestone timing. Debt principal,
          interest and repayment schedules still require a verified loan schedule before statutory use.
        </p>
      </Panel>
    </div>
  );
}
