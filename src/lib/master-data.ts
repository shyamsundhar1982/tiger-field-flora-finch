export type MasterDataStatus = "draft" | "pending_approval" | "approved" | "superseded";

export type MasterDataDomain =
  | "product" | "bom" | "material" | "supplier" | "price" | "inventory"
  | "process" | "quality" | "epr" | "finance" | "document";

export interface MasterDataRecord {
  id: string;
  domain: MasterDataDomain;
  code: string;
  name: string;
  revision: number;
  status: MasterDataStatus;
  ownerRole: string;
  approverRole: string;
  effectiveFrom: string | null;
  sourceRef: string | null;
  attributes: Record<string, string | number | boolean | null>;
}

export interface MasterDataSummary {
  domain: MasterDataDomain;
  label: string;
  count: number;
  approved: number;
  pending: number;
}

export const MASTER_DATA_DOMAINS: Array<{ domain: MasterDataDomain; label: string; owner: string }> = [
  { domain: "product", label: "Product Master", owner: "engineering" },
  { domain: "bom", label: "BOM Master", owner: "engineering" },
  { domain: "material", label: "Material Master", owner: "operations" },
  { domain: "supplier", label: "Supplier Master", owner: "operations" },
  { domain: "price", label: "Price Master", owner: "finance" },
  { domain: "inventory", label: "Inventory Master", owner: "operations" },
  { domain: "process", label: "Process Master", owner: "operations" },
  { domain: "quality", label: "Quality Master", owner: "qa" },
  { domain: "epr", label: "EPR Master", owner: "compliance" },
  { domain: "finance", label: "Finance Master", owner: "finance" },
  { domain: "document", label: "Document Master", owner: "engineering" },
];

export const MASTER_DATA_STATUS_LABELS: Record<MasterDataStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  superseded: "Superseded",
};

export function isMasterDataUsable(record: Pick<MasterDataRecord, "status">) {
  return record.status === "approved";
}

export function nextRevision(currentRevision: number) {
  return Math.max(1, currentRevision + 1);
}
