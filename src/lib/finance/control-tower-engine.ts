import type { AccountingRow } from "@/lib/finance/accounting";
import type { ModelRow } from "@/lib/finance/model";
import type { PeopleOpexMonth } from "@/lib/finance/people-opex-engine";

export type ControlTowerStatus = "clear" | "watch" | "critical";
export type ControlTowerArea = "cash" | "sales" | "production" | "inventory" | "quality" | "engineering" | "people" | "compliance";

export type ControlTowerAlert = {
  id: string;
  area: ControlTowerArea;
  title: string;
  detail: string;
  status: ControlTowerStatus;
  month?: number;
  action: string;
};

export type ControlTowerSnapshot = {
  status: ControlTowerStatus;
  alerts: ControlTowerAlert[];
  metrics: {
    units: number;
    revenue: number;
    cash: number;
    inventory: number;
    receivables: number;
    payables: number;
    headcount: number;
  };
};

const statusRank: Record<ControlTowerStatus, number> = { clear: 0, watch: 1, critical: 2 };

export function buildControlTowerSnapshot(
  rows: ModelRow[],
  accounting: AccountingRow[],
  people: PeopleOpexMonth[],
  managementCashFloorLakh: number,
): ControlTowerSnapshot {
  const last = accounting.at(-1);
  const cashTrough = accounting.reduce((min, row) => (row.closingCash < min.closingCash ? row : min), accounting[0]);
  const alerts: ControlTowerAlert[] = [];

  if (cashTrough && cashTrough.closingCash < 0) {
    alerts.push({ id: "cash-negative", area: "cash", title: "Cash breach", detail: `Accounting cash falls below zero in M${cashTrough.m}.`, status: "critical", month: cashTrough.m, action: "Review funding and collection assumptions" });
  } else if (cashTrough && cashTrough.closingCash < managementCashFloorLakh) {
    alerts.push({ id: "cash-floor", area: "cash", title: "Cash floor at risk", detail: `Cash trough is ₹${cashTrough.closingCash.toFixed(1)}L against the ₹${managementCashFloorLakh.toFixed(1)}L management floor.`, status: "watch", month: cashTrough.m, action: "Open Decision Engine" });
  }

  const revenue = accounting.reduce((sum, row) => sum + row.revenue, 0);
  const units = rows.reduce((sum, row) => sum + row.units, 0);
  if (revenue <= 0 || units <= 0) alerts.push({ id: "sales-plan", area: "sales", title: "No modeled commercial output", detail: "Revenue or unit plan is currently zero.", status: "watch", action: "Review Product and Sales assumptions" });

  const latestPeople = people.at(-1);
  if (latestPeople && latestPeople.headcount <= 0) alerts.push({ id: "people-plan", area: "people", title: "No headcount plan", detail: "People plan has no active headcount by M36.", status: "watch", action: "Review People & Opex Control" });

  if ((last?.inventory ?? 0) <= 0 && units > 0) alerts.push({ id: "inventory", area: "inventory", title: "Inventory coverage watch", detail: "Modeled M36 inventory is zero while production demand exists.", status: "watch", month: 36, action: "Review Inventory Planning" });

  if (!alerts.length) alerts.push({ id: "all-clear", area: "cash", title: "Control tower clear", detail: "No automated management exceptions detected in the current model.", status: "clear", action: "Continue monitoring" });

  const status = alerts.reduce<ControlTowerStatus>((current, alert) => statusRank[alert.status] > statusRank[current] ? alert.status : current, "clear");
  return {
    status,
    alerts,
    metrics: {
      units,
      revenue,
      cash: last?.closingCash ?? 0,
      inventory: last?.inventory ?? 0,
      receivables: last?.receivables ?? 0,
      payables: last?.payables ?? 0,
      headcount: latestPeople?.headcount ?? 0,
    },
  };
}
