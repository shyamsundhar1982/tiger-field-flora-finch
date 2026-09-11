import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { DEFAULT_EQUIPMENT_LEDGER } from "@/lib/finance/equipment-ledger";
import { buildModelWithInputs } from "@/lib/finance/model";
import {
  DEFAULT_PEOPLE_OFFICE_LEDGER,
  PEOPLE_OFFICE_GROUP_META,
  peopleOfficeExpenseByGroup,
  peopleOfficeExpenseTotal,
  type PeopleOfficeGroup,
  type PeopleOfficeLedgerItem,
} from "@/lib/finance/people-office-ledger";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/people-office")({ component: PeopleOffice });

const GROUPS: PeopleOfficeGroup[] = ["people", "office", "statutory", "outsourcing"];
const money = (value: number) => `₹${value.toFixed(2)}L`;

function NumericInput({ value, onChange, step = 0.1, min = 0 }: { value: number; onChange: (value: number) => void; step?: number; min?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-24 rounded-md border border-border bg-bg px-2 py-1.5 text-right text-xs tabular-nums text-fg outline-none focus:border-accent"
    />
  );
}

function LedgerTable({
  group,
  items,
  update,
  add,
}: {
  group: PeopleOfficeGroup;
  items: PeopleOfficeLedgerItem[];
  update: (id: string, key: Exclude<keyof PeopleOfficeLedgerItem, "id" | "group">, value: string | number) => void;
  add: (group: PeopleOfficeGroup, name: string) => void;
}) {
  const meta = PEOPLE_OFFICE_GROUP_META[group];
  const total = peopleOfficeExpenseByGroup(items, group);
  return (
    <details className="rounded-xl border border-border bg-surface/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-sm font-semibold text-fg">{meta.label}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">{meta.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-fg">{money(total)}</p>
          <p className="text-[10px] uppercase tracking-wider text-subtle">{items.length} line{items.length === 1 ? "" : "s"} · expand</p>
        </div>
      </summary>
      <div className="border-t border-border p-4">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-xs">
            <thead>
              <tr className="border-b border-border text-subtle">
                <th className="pb-2 pr-3 font-normal">Item</th>
                <th className="pb-2 pr-3 font-normal">Stage</th>
                <th className="pb-2 text-right font-normal">Qty / HC</th>
                <th className="pb-2 text-right font-normal">Monthly / unit</th>
                <th className="pb-2 text-right font-normal">Start M</th>
                <th className="pb-2 text-right font-normal">End M</th>
                <th className="pb-2 text-right font-normal">One-time</th>
                <th className="pb-2 text-right font-normal">At M</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <input value={item.name} onChange={(event) => update(item.id, "name", event.target.value)} className="w-full min-w-48 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent" />
                  </td>
                  <td className="py-2 pr-3"><input value={item.stage} onChange={(event) => update(item.id, "stage", event.target.value)} className="w-28 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent" /></td>
                  <td className="py-2 text-right"><NumericInput value={item.quantity} step={1} onChange={(value) => update(item.id, "quantity", Math.max(0, value))} /></td>
                  <td className="py-2 text-right"><NumericInput value={item.monthlyUnitCostLakh} step={0.05} onChange={(value) => update(item.id, "monthlyUnitCostLakh", Math.max(0, value))} /></td>
                  <td className="py-2 text-right"><NumericInput value={item.startMonth} step={1} min={1} onChange={(value) => update(item.id, "startMonth", Math.max(1, Math.min(36, Math.round(value))))} /></td>
                  <td className="py-2 text-right"><NumericInput value={item.endMonth} step={1} min={1} onChange={(value) => update(item.id, "endMonth", Math.max(1, Math.min(36, Math.round(value))))} /></td>
                  <td className="py-2 text-right"><NumericInput value={item.oneTimeCostLakh} step={0.05} onChange={(value) => update(item.id, "oneTimeCostLakh", Math.max(0, value))} /></td>
                  <td className="py-2 text-right"><NumericInput value={item.oneTimeMonth} step={1} min={1} onChange={(value) => update(item.id, "oneTimeMonth", Math.max(1, Math.min(36, Math.round(value))))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => add(group, `New ${meta.label} item`)} className="mt-4 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-fg">+ Add ledger line</button>
      </div>
    </details>
  );
}

function PeopleOffice() {
  const finance = useVeloxis((state) => state.finance);
  const scenario = useVeloxis((state) => state.scenario);
  const drawStandby = useVeloxis((state) => state.drawStandby);
  const setUseItemized = useVeloxis((state) => state.setPeopleOfficeUseItemized);
  const updatePeopleOfficeItem = useVeloxis((state) => state.updatePeopleOfficeItem);
  const addPeopleOfficeItem = useVeloxis((state) => state.addPeopleOfficeItem);
  const updateEquipmentItem = useVeloxis((state) => state.updateEquipmentItem);

  const ledger = finance.peopleOfficeLedger ?? DEFAULT_PEOPLE_OFFICE_LEDGER;
  const equipment = finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER;
  const officeAssets = equipment.filter((item) => item.ledger === "officeAdmin");
  const officeConsumables = equipment.find((item) => item.id === "office-consumables");

  const itemizedTotal = peopleOfficeExpenseTotal(ledger);
  const legacyRows = useMemo(() => buildModelWithInputs(scenario, drawStandby, { ...finance, peopleOfficeUseItemized: false }), [scenario, drawStandby, finance]);
  const itemizedRows = useMemo(() => buildModelWithInputs(scenario, drawStandby, { ...finance, peopleOfficeUseItemized: true }), [scenario, drawStandby, finance]);
  const currentRows = finance.peopleOfficeUseItemized ? itemizedRows : legacyRows;
  const legacyOpex = legacyRows.reduce((sum, row) => sum + row.opex, 0);
  const itemizedOpex = itemizedRows.reduce((sum, row) => sum + row.opex, 0);
  const currentOpex = currentRows.reduce((sum, row) => sum + row.opex, 0);
  const officeAssetCapex = officeAssets.reduce((sum, item) => sum + Math.max(0, item.costLakh), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">People & Office · operating administration</p>
          <h1 className="mt-1 font-display text-4xl text-accent">People & Office</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Operational home for manpower and payroll inputs, office/facility overhead, statutory and professional services, outsourcing, office assets and recurring administration. Finance consumes the approved cost model downstream; it does not own these operating records.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command/planning" className="text-accent hover:text-fg">Plan & staffing timing →</Link>
          <Link to="/command/financial-cockpit" className="text-accent hover:text-fg">Downstream Finance →</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="People & Office ledger" value={money(itemizedTotal)} hint="36-month operating ledger" />
        <Kpi label="Current modeled OPEX" value={money(currentOpex)} hint={finance.peopleOfficeUseItemized ? "Itemized authority active" : "Legacy aggregate authority active"} tone={finance.peopleOfficeUseItemized ? "ok" : "warn"} />
        <Kpi label="Office assets / CAPEX" value={money(officeAssetCapex)} hint="Office/admin equipment" />
        <Kpi label="Legacy vs itemized" value={money(itemizedOpex - legacyOpex)} hint="36M OPEX delta" tone={Math.abs(itemizedOpex - legacyOpex) < 0.01 ? "ok" : "warn"} />
      </div>

      <Panel title="Operating cost authority" kicker="One owner · no double counting">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-fg">{finance.peopleOfficeUseItemized ? "Itemized People & Office ledger is driving core OPEX" : "Legacy aggregate OPEX remains active"}</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">The restored operating ledgers begin with zero values so no historical cost is fabricated. Populate and reconcile People & Office first; only then enable itemized authority. Finance reads the resulting OPEX but does not duplicate the entries.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <input type="checkbox" checked={Boolean(finance.peopleOfficeUseItemized)} onChange={(event) => setUseItemized(event.target.checked)} className="accent-current" />
            <span className="font-semibold text-fg">Use itemized ledger for core OPEX</span>
          </label>
        </div>
      </Panel>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green">Operating registers</p><h2 className="mt-1 font-display text-2xl text-accent">People, office and services</h2></div>
          <p className="text-xs text-muted">Collapsed by default · expand only the register you need</p>
        </div>
        {GROUPS.map((group) => (
          <LedgerTable key={group} group={group} items={ledger.filter((item) => item.group === group)} update={updatePeopleOfficeItem} add={addPeopleOfficeItem} />
        ))}
      </section>

      <Panel title="36-month group reconciliation" kicker="Summary before Finance consumption">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map((group) => (
            <div key={group} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-green">{PEOPLE_OFFICE_GROUP_META[group].label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-fg">{money(peopleOfficeExpenseByGroup(ledger, group))}</p>
            </div>
          ))}
        </div>
      </Panel>

      <details className="rounded-xl border border-border bg-surface/25">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div><p className="text-sm font-semibold text-fg">Office assets / equipment</p><p className="mt-1 text-[11px] text-muted">CAPEX / depreciation · not payroll OPEX</p></div>
          <div className="text-right"><p className="text-lg font-semibold tabular-nums text-fg">{money(officeAssetCapex)}</p><p className="text-[10px] uppercase tracking-wider text-subtle">{officeAssets.length} assets · expand</p></div>
        </summary>
        <div className="border-t border-border p-4">
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-xs">
              <thead><tr className="border-b border-border text-subtle"><th className="pb-2 font-normal">Item</th><th className="pb-2 font-normal">Category</th><th className="pb-2 text-right font-normal">Cost</th><th className="pb-2 text-right font-normal">Purchase M</th><th className="pb-2 text-right font-normal">Life</th></tr></thead>
              <tbody>
                {officeAssets.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-fg">{item.name}</td>
                    <td className="py-2 text-muted">{item.category}</td>
                    <td className="py-2 text-right"><NumericInput value={item.costLakh} step={0.1} onChange={(value) => updateEquipmentItem(item.id, "costLakh", Math.max(0, value))} /></td>
                    <td className="py-2 text-right"><NumericInput value={item.purchaseMonth} step={1} min={1} onChange={(value) => updateEquipmentItem(item.id, "purchaseMonth", Math.max(1, Math.min(36, Math.round(value))))} /></td>
                    <td className="py-2 text-right"><NumericInput value={item.usefulLifeMonths} step={1} min={1} onChange={(value) => updateEquipmentItem(item.id, "usefulLifeMonths", Math.max(1, Math.round(value)))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {officeConsumables ? (
        <details className="rounded-xl border border-border bg-surface/25">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <div><p className="text-sm font-semibold text-fg">Office consumables</p><p className="mt-1 text-[11px] text-muted">Recurring administration consumables already included in modeled OPEX</p></div>
            <span className="text-xs font-semibold text-accent">Expand</span>
          </summary>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-3">
            <div><p className="text-xs text-muted">Item</p><p className="mt-1 text-sm font-semibold text-fg">{officeConsumables.name}</p></div>
            <label><span className="text-xs text-muted">Monthly cost</span><div className="mt-1"><NumericInput value={officeConsumables.monthlyCostLakh} step={0.05} onChange={(value) => updateEquipmentItem(officeConsumables.id, "monthlyCostLakh", Math.max(0, value))} /></div></label>
            <label><span className="text-xs text-muted">Start month</span><div className="mt-1"><NumericInput value={officeConsumables.purchaseMonth} step={1} min={1} onChange={(value) => updateEquipmentItem(officeConsumables.id, "purchaseMonth", Math.max(1, Math.min(36, Math.round(value))))} /></div></label>
          </div>
        </details>
      ) : null}
    </div>
  );
}
