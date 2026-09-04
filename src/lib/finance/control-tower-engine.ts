import type { AccountingRow } from "@/lib/finance/accounting";
import type { ModelRow } from "@/lib/finance/model";
import type { PeopleOpexMonth } from "@/lib/finance/people-opex-engine";
import type { VentureScope } from "@/lib/finance/venture-scope";
import { VENTURE_OWNERS } from "@/lib/finance/venture-scope";

export type ControlTowerStatus = "clear" | "watch" | "critical";
export type ControlTowerArea = "cash" | "sales" | "production" | "inventory" | "quality" | "engineering" | "people" | "compliance";
export type ControlTowerAlert = { id:string; area:ControlTowerArea; title:string; detail:string; status:ControlTowerStatus; month?:number; action:string; owner:string };
export type ControlTowerSnapshot = { status:ControlTowerStatus; alerts:ControlTowerAlert[]; metrics:{units:number;revenue:number;cash:number;inventory:number;receivables:number;payables:number;headcount:number} };
const statusRank:Record<ControlTowerStatus,number>={clear:0,watch:1,critical:2};
const alert=(scope:VentureScope,id:string,area:ControlTowerArea,title:string,detail:string,status:ControlTowerStatus,action:string,month?:number):ControlTowerAlert=>({id,area,title,detail,status,action,month,owner:VENTURE_OWNERS[scope]});
export function buildControlTowerSnapshot(rows:ModelRow[], accounting:AccountingRow[], people:PeopleOpexMonth[], managementCashFloorLakh:number, scope:VentureScope="consolidated"):ControlTowerSnapshot{
 const last=accounting.at(-1), first=accounting[0], trough=accounting.reduce((min,row)=>row.closingCash<min.closingCash?row:min,first); const alerts:ControlTowerAlert[]=[]; const revenue=accounting.reduce((s,r)=>s+r.revenue,0),units=rows.reduce((s,r)=>s+r.units,0); const latestPeople=people.at(-1);
 if(trough&&trough.closingCash<0) alerts.push(alert(scope,"cash-negative","cash","Cash breach",`Accounting cash falls below zero in M${trough.m}.`,"critical","Review funding and collection assumptions",trough.m)); else if(trough&&trough.closingCash<managementCashFloorLakh) alerts.push(alert(scope,"cash-floor","cash","Cash floor at risk",`Cash trough is ₹${trough.closingCash.toFixed(1)}L against the ₹${managementCashFloorLakh.toFixed(1)}L floor.`,"watch","Open Decision Engine",trough.m));
 if(revenue<=0||units<=0) alerts.push(alert(scope,"sales-plan","sales","Commercial output gap","Revenue or unit plan is currently zero.","watch","Review Product and Sales assumptions"));
 const latest=rows.at(-1); if((latest?.units??0)<=0&&rows.some(r=>r.units>0)) alerts.push(alert(scope,"production-ramp","production","Production ramp gap","Current-period output is below the modeled production plan.","watch","Review Operations & Procurement",latest?.m));
 if((last?.inventory??0)<=0&&units>0) alerts.push(alert(scope,"inventory","inventory","Inventory coverage watch","Modeled ending inventory is zero while production demand exists.","watch","Review Inventory Planning",36));
 if(rows.some(r=>r.gp<0)) alerts.push(alert(scope,"quality-margin","quality","Quality / yield risk","At least one modeled month has negative gross profit, indicating yield, pricing or quality-cost pressure.","watch","Review Quality and BOM controls"));
 if(rows.some(r=>r.cogs>r.revenue&&r.units>0)) alerts.push(alert(scope,"engineering-cost","engineering","Engineering cost drift","COGS exceeds revenue in a production month.","critical","Review engineering revisions and BOM"));
 if(latestPeople&&latestPeople.headcount<=0) alerts.push(alert(scope,"people-plan","people","No headcount plan","People plan has no active headcount by M36.","watch","Review People & Opex Control"));
 const ar=last?.receivables??0,ap=last?.payables??0; if(ar>revenue*.25) alerts.push(alert(scope,"compliance-ar","compliance","Receivables concentration","Ending receivables exceed 25% of modeled revenue.","watch","Review collections and compliance evidence")); if(ap<0) alerts.push(alert(scope,"compliance-ap","compliance","Payables integrity exception","Accounting payables are negative.","critical","Review accounting controls"));
 if(!alerts.length) alerts.push(alert(scope,"all-clear","cash","Control tower clear","No automated management exceptions detected in the current scope.","clear","Continue monitoring"));
 const status=alerts.reduce<ControlTowerStatus>((cur,a)=>statusRank[a.status]>statusRank[cur]?a.status:cur,"clear"); return {status,alerts,metrics:{units,revenue,cash:last?.closingCash??0,inventory:last?.inventory??0,receivables:ar,payables:ap,headcount:latestPeople?.headcount??0}};
}
