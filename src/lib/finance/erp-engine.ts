export type ErpWorkStatus = "open" | "doing" | "blocked" | "done";
export type ErpPriority = "low" | "normal" | "high" | "critical";
export type ErpArea = "sales" | "procurement" | "production" | "inventory" | "engineering" | "quality" | "finance" | "compliance";

export type ErpWorkItem = {
  id: string;
  area: ErpArea;
  title: string;
  owner: string;
  priority: ErpPriority;
  status: ErpWorkStatus;
  dueMonth: number;
  linkedRoute: string;
};

export const DEFAULT_ERP_WORK: ErpWorkItem[] = [
  { id: "erp-sales-forecast", area: "sales", title: "Review rolling sales forecast", owner: "Commercial", priority: "high", status: "open", dueMonth: 1, linkedRoute: "/command/sales" },
  { id: "erp-procurement", area: "procurement", title: "Review component procurement plan", owner: "Operations", priority: "high", status: "open", dueMonth: 2, linkedRoute: "/command/operations" },
  { id: "erp-production", area: "production", title: "Confirm production ramp", owner: "Operations", priority: "normal", status: "open", dueMonth: 3, linkedRoute: "/command/production" },
  { id: "erp-engineering", area: "engineering", title: "Review engineering revision gates", owner: "Engineering", priority: "normal", status: "open", dueMonth: 3, linkedRoute: "/command/engineering" },
  { id: "erp-quality", area: "quality", title: "Close open quality actions", owner: "Quality", priority: "high", status: "open", dueMonth: 2, linkedRoute: "/command/quality" },
  { id: "erp-finance", area: "finance", title: "Review cash and funding gap", owner: "Founder", priority: "critical", status: "open", dueMonth: 1, linkedRoute: "/command/decision-engine" },
  { id: "erp-compliance", area: "compliance", title: "Prepare CA evidence review", owner: "Finance", priority: "normal", status: "open", dueMonth: 4, linkedRoute: "/command/tax-compliance" },
];
