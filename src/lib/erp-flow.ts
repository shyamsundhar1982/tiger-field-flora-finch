import type { RouteMeta } from "@/lib/page-metadata";

export interface ErpFlowStep {
  id: string;
  label: string;
  purpose: string;
  inputs: string;
  outputs: string;
  routes: string[];
}

/**
 * One business flow for the ERP. This is navigation metadata only; it does not
 * create or persist business data. Keep it aligned with the authoritative
 * workflow: Draft -> Approve -> Post -> Authoritative.
 */
export const ERP_FLOW: ErpFlowStep[] = [
  {
    id: "foundation",
    label: "1 · Foundation",
    purpose: "Define controlled master records before anything is planned or posted.",
    inputs: "Business definitions and controlled master data",
    outputs: "Approved product and component identities",
    routes: ["/command/master-data", "/command/knowledge", "/command/legal"],
  },
  {
    id: "product",
    label: "2 · Product & BOM",
    purpose: "Define what is being built and how its components and costs relate.",
    inputs: "Approved master records",
    outputs: "Product, engineering and BOM definitions",
    routes: ["/command/product", "/command/engineering", "/command/bom"],
  },
  {
    id: "mapping",
    label: "3 · Mapping",
    purpose: "Connect approved BOM components to approved inventory SKUs before stock can become truth.",
    inputs: "Approved BOM + approved inventory master",
    outputs: "Active BOM → Inventory mapping",
    routes: ["/command/bom-inventory-mapping"],
  },
  {
    id: "inventory",
    label: "4 · Inventory",
    purpose: "Establish controlled openings, then read authoritative stock from the ledger.",
    inputs: "Approved mappings and opening balances",
    outputs: "Authoritative quantity and cost position",
    routes: ["/command/inventory-openings", "/command/inventory-truth", "/command/inventory"],
  },
  {
    id: "operations",
    label: "5 · Operations",
    purpose: "Plan procurement and production using the approved product and inventory foundation.",
    inputs: "Products, BOMs and authoritative inventory",
    outputs: "Controlled procurement, production and quality activity",
    routes: ["/command/operations", "/command/production", "/command/manufacturing", "/command/quality"],
  },
  {
    id: "epr",
    label: "6 · EPR",
    purpose: "Execute EPR controls against the same approved operational records and ledgers.",
    inputs: "Controlled operational and inventory records",
    outputs: "EPR workflow, execution and transaction evidence",
    routes: ["/command/epr-workflow", "/command/epr-execution", "/command/epr-live"],
  },
  {
    id: "commercial",
    label: "7 · Commercial",
    purpose: "Translate the operational foundation into sales and go-to-market planning.",
    inputs: "Product, capacity and controlled assumptions",
    outputs: "Sales plan and GTM plan",
    routes: ["/command/sales", "/command/gtm", "/command/market-survey"],
  },
  {
    id: "finance",
    label: "8 · Finance",
    purpose: "Connect controlled operating facts and explicit assumptions to financial decisions.",
    inputs: "Operational actuals, assumptions and funding data",
    outputs: "Finance, cash, funding and scenario views",
    routes: ["/command/finance", "/command/finance-assumptions", "/command/cash", "/command/funding", "/command/scenarios"],
  },
  {
    id: "decision",
    label: "9 · Decision",
    purpose: "Present the resulting evidence for management and board decisions without replacing source records.",
    inputs: "Validated operational and financial views",
    outputs: "Decisions, actions and board/investor view",
    routes: ["/command/control-tower", "/command/management-intelligence", "/command/investor-board", "/command/actions"],
  },
];

export function getErpFlowStep(route: string): { step: ErpFlowStep; index: number } | null {
  const index = ERP_FLOW.findIndex((step) => step.routes.includes(route));
  return index < 0 ? null : { step: ERP_FLOW[index], index };
}

export function getErpFlowRouteMeta(route: string): RouteMeta | null {
  const match = getErpFlowStep(route);
  return match ? ({ route, label: match.step.label } as RouteMeta) : null;
}
