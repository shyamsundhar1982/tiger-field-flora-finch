import type { AccountingAssumptions } from "@/lib/finance/accounting";
import type { FinanceAssumptions, MonthRow, ProductLineId } from "@/lib/finance/model";

export type SalesOrderStatus = "lead" | "confirmed" | "delivered" | "cancelled";
export type SalesChannel = "direct" | "dealer" | "online";
export type SalesOrder = { id:string; month:number; product:ProductLineId; units:number; aspLakh:number; channel:SalesChannel; status:SalesOrderStatus };
export type SalesMonth = { m:number; plannedUnits:number; plannedRevenue:number; actualUnits:number; actualRevenue:number; ordersUnits:number; ordersRevenue:number; collections:number; openReceivables:number; varianceUnits:number; varianceRevenue:number };

export function productAsp(finance:FinanceAssumptions,id:ProductLineId){ return finance.productLines.find(p=>p.id===id)?.aspLakh ?? 0; }
export function salesPlan(rows:MonthRow[], finance:FinanceAssumptions): SalesMonth[] {
  return rows.map(r=>({m:r.m,plannedUnits:r.units,plannedRevenue:r.revenue,actualUnits:0,actualRevenue:0,ordersUnits:0,ordersRevenue:0,collections:0,openReceivables:0,varianceUnits:0,varianceRevenue:0}));
}
export function buildSalesMonths(rows:MonthRow[], finance:FinanceAssumptions, orders:SalesOrder[], actuals:Record<number,{units?:number|null;revenue?:number|null}> = {}, accounting?:AccountingAssumptions):SalesMonth[]{
  const collectionDays=accounting?.collectionDays ?? ((accounting?.collectionMonths ?? 1)*30);
  const byMonth=new Map<number,SalesOrder[]>(); for(const o of orders){if(o.status!=="cancelled"){const list=byMonth.get(o.month)??[];list.push(o);byMonth.set(o.month,list)}}
  let receivables=accounting?.openingReceivablesLakh??0;
  return rows.map((r,i)=>{const m=r.m, entered=actuals[m]??{}, actualUnits=entered.units??0,actualRevenue=entered.revenue??0, os=byMonth.get(m)??[], ordersUnits=os.reduce((s,o)=>s+o.units,0), ordersRevenue=os.reduce((s,o)=>s+o.units*o.aspLakh,0); const sameMonthFactor=Math.max(0,1-Math.min(collectionDays,30)/30); const priorOrders=byMonth.get(m-1)??[]; const priorRevenue=priorOrders.reduce((s,o)=>s+o.units*o.aspLakh,0); const collections=ordersRevenue*sameMonthFactor+priorRevenue*(1-sameMonthFactor)+(m===1?receivables:0); receivables=Math.max(0,receivables+ordersRevenue-collections); return {m,plannedUnits:r.units,plannedRevenue:r.revenue,actualUnits,actualRevenue,ordersUnits,ordersRevenue,collections,openReceivables:receivables,varianceUnits:(actuals[m]?.units!=null?actualUnits-r.units:ordersUnits-r.units),varianceRevenue:(actuals[m]?.revenue!=null?actualRevenue-r.revenue:ordersRevenue-r.revenue)} });
}
export function salesTotals(rows:SalesMonth[]){return rows.reduce((a,r)=>({plannedUnits:a.plannedUnits+r.plannedUnits,plannedRevenue:a.plannedRevenue+r.plannedRevenue,ordersUnits:a.ordersUnits+r.ordersUnits,ordersRevenue:a.ordersRevenue+r.ordersRevenue,actualUnits:a.actualUnits+r.actualUnits,actualRevenue:a.actualRevenue+r.actualRevenue,collections:a.collections+r.collections}),{plannedUnits:0,plannedRevenue:0,ordersUnits:0,ordersRevenue:0,actualUnits:0,actualRevenue:0,collections:0});}
