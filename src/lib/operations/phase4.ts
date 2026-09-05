export type VentureId = "carbon" | "aluminium";
export type Severity = "watch" | "warning" | "critical";
export type ActionType = "replenish" | "approve-po" | "release-production" | "review-pricing" | "escalate";

export type InventorySignal = { venture: VentureId; sku: string; item: string; onHand: number; reorderPoint: number; unitCostInr: number; supplier: string; leadTimeDays: number };
export type DemandSignal = { venture: VentureId; product: string; units: number; orderValueInr: number; componentSku: string; unitsPerBike: number };
export type IntelligenceAlert = { id: string; venture: VentureId; severity: Severity; title: string; detail: string; action: ActionType; impactInr: number };
export type ManagementAction = { id: string; venture: VentureId; action: ActionType; label: string; status: "proposed" | "approved" | "rejected"; impactInr: number; createdAt: string };

export const PHASE4_INVENTORY: InventorySignal[] = [
  { venture: "carbon", sku: "CF-01", item: "Carbon Frame", onHand: 4, reorderPoint: 8, unitCostInr: 42000, supplier: "Carbon Frame Partner", leadTimeDays: 21 },
  { venture: "carbon", sku: "WH-01", item: "Wheelset", onHand: 18, reorderPoint: 10, unitCostInr: 12000, supplier: "Wheel Works", leadTimeDays: 14 },
  { venture: "aluminium", sku: "AF-01", item: "Aluminium Frame", onHand: 12, reorderPoint: 8, unitCostInr: 18000, supplier: "Aluminium Frame Partner", leadTimeDays: 18 },
];

export const PHASE4_DEMAND: DemandSignal[] = [
  { venture: "carbon", product: "VELOXIS Pro", units: 6, orderValueInr: 1050000, componentSku: "CF-01", unitsPerBike: 1 },
  { venture: "carbon", product: "VELOXIS Apex", units: 3, orderValueInr: 975000, componentSku: "CF-01", unitsPerBike: 1 },
  { venture: "aluminium", product: "Aluminium Core", units: 5, orderValueInr: 655000, componentSku: "AF-01", unitsPerBike: 1 },
];

export function generateAlerts(inventory: InventorySignal[], demand: DemandSignal[], venture: VentureId): IntelligenceAlert[] {
  const alerts: IntelligenceAlert[] = [];
  for (const item of inventory.filter(x => x.venture === venture)) {
    const demandUnits = demand.filter(x => x.venture === venture && x.componentSku === item.sku).reduce((n, x) => n + x.units * x.unitsPerBike, 0);
    const projected = item.onHand - demandUnits;
    if (projected < 0) alerts.push({ id: `stock-${item.sku}`, venture, severity: "critical", title: `${item.item} shortage detected`, detail: `${item.item} projects ${Math.abs(projected)} unit(s) short after current demand.`, action: "replenish", impactInr: Math.abs(projected) * item.unitCostInr });
    else if (projected < item.reorderPoint) alerts.push({ id: `reorder-${item.sku}`, venture, severity: "warning", title: `${item.item} below reorder point`, detail: `Projected availability is ${projected}; reorder point is ${item.reorderPoint}.`, action: "replenish", impactInr: Math.max(item.reorderPoint - projected, 0) * item.unitCostInr });
  }
  const demandValue = demand.filter(x => x.venture === venture).reduce((n, x) => n + x.orderValueInr, 0);
  if (demandValue > 1500000) alerts.push({ id: `cash-${venture}`, venture, severity: "watch", title: "Working-capital watch", detail: `Current demand signals represent ${demandValue.toLocaleString("en-IN")} of order value before procurement funding.`, action: "approve-po", impactInr: demandValue });
  return alerts;
}

export function proposeActions(alerts: IntelligenceAlert[], now = new Date().toISOString()): ManagementAction[] {
  return alerts.map((a, i) => ({ id: `ACT-${Date.now()}-${i}`, venture: a.venture, action: a.action, label: a.action === "replenish" ? `Replenish against ${a.title}` : a.action === "approve-po" ? `Review procurement funding for ${a.venture}` : `Review ${a.title}`, status: "proposed", impactInr: a.impactInr, createdAt: now }));
}

export function actionImpact(actions: ManagementAction[]) { return actions.filter(x => x.status === "approved").reduce((n, x) => n + x.impactInr, 0); }
