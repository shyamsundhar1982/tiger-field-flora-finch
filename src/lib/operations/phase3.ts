export type VentureId = "carbon" | "aluminium";
export type SalesStatus = "draft" | "confirmed" | "in-production" | "ready" | "delivered" | "cancelled";
export type PurchaseStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";
export type ProductionStatus = "planned" | "allocated" | "assembly" | "qc" | "finished" | "released";
export type InventoryTxnType = "receipt" | "reserve" | "consume" | "release" | "adjustment";

export type SalesOrder = { id:string; venture:VentureId; customer:string; product:string; units:number; valueInr:number; status:SalesStatus; month:number; createdAt:string };
export type PurchaseOrder = { id:string; venture:VentureId; supplier:string; sku:string; item:string; qty:number; unitCostInr:number; status:PurchaseStatus; expectedMonth:number; };
export type ProductionOrder = { id:string; venture:VentureId; salesOrderId:string; product:string; units:number; status:ProductionStatus; qcPassed:boolean };
export type InventoryTxn = { id:string; venture:VentureId; sku:string; type:InventoryTxnType; qty:number; ref:string; at:string };

export const PHASE3_SALES: SalesOrder[] = [];
export const PHASE3_PURCHASES: PurchaseOrder[] = [];
export const PHASE3_PRODUCTION: ProductionOrder[] = [];
export const PHASE3_INVENTORY: InventoryTxn[] = [];

export const SALES_STATUSES: SalesStatus[] = ["draft","confirmed","in-production","ready","delivered","cancelled"];
export const PURCHASE_STATUSES: PurchaseStatus[] = ["draft","ordered","partial","received","cancelled"];
export const PRODUCTION_STATUSES: ProductionStatus[] = ["planned","allocated","assembly","qc","finished","released"];

export function activeSales(orders: SalesOrder[]) { return orders.filter(x => x.status !== "cancelled"); }
export function openPurchases(orders: PurchaseOrder[]) { return orders.filter(x => !["received","cancelled"].includes(x.status)); }
export function activeProduction(orders: ProductionOrder[]) { return orders.filter(x => !["finished","released"].includes(x.status)); }
export function inventoryNet(txns: InventoryTxn[], sku: string) {
  return txns.filter(x=>x.sku===sku).reduce((n,x)=>n + (x.type === "receipt" || x.type === "release" ? x.qty : x.type === "consume" || x.type === "reserve" ? -x.qty : x.qty), 0);
}
export function ventureTotals(orders: SalesOrder[]) {
  return (["carbon","aluminium"] as VentureId[]).map(venture => ({ venture, units: activeSales(orders).filter(x=>x.venture===venture).reduce((n,x)=>n+x.units,0), valueInr: activeSales(orders).filter(x=>x.venture===venture).reduce((n,x)=>n+x.valueInr,0) }));
}
