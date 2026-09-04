export type QualityStage = "incoming" | "in-process" | "final";
export type QualityDisposition = "accepted" | "rework" | "rejected" | "quarantine";
export type QualityRecord = { id: string; stage: QualityStage; sku: string; lot: string; inspection: string; disposition: QualityDisposition; defectRatePct: number; notes: string };
export type Ncr = { id: string; date: string; sku: string; severity: "minor" | "major" | "critical"; description: string; containment: string; capa: string; status: "open" | "capa" | "closed" };
export type WarrantyCase = { id: string; sku: string; failure: string; rootCause: string; units: number; reserveLakh: number; status: "open" | "investigating" | "closed" };

export const QUALITY_CHECKS: QualityRecord[] = [
  { id: "IQC-001", stage: "incoming", sku: "Carbon / Pro", lot: "SUP-CARBON-01", inspection: "Material / visual / certificate", disposition: "accepted", defectRatePct: 0, notes: "Baseline gate" },
  { id: "IPQC-001", stage: "in-process", sku: "Carbon / Pro", lot: "FRAME-C3", inspection: "Layup / cure / dimensional", disposition: "accepted", defectRatePct: 0, notes: "Revision C3" },
  { id: "FQC-001", stage: "final", sku: "Aluminium / Core", lot: "ASSY-A2", inspection: "Torque / finish / ride safety", disposition: "accepted", defectRatePct: 0, notes: "Release gate" },
];

export const NCRS: Ncr[] = [
  { id: "NCR-001", date: "2026-09-01", sku: "Carbon / Pro", severity: "major", description: "Example layup inspection deviation", containment: "Quarantine affected lot", capa: "Engineering review pending", status: "capa" },
];

export const WARRANTY_CASES: WarrantyCase[] = [
  { id: "WAR-001", sku: "Carbon / Pro", failure: "Example field failure", rootCause: "Under investigation", units: 0, reserveLakh: 0, status: "investigating" },
];

export function qualitySummary(records = QUALITY_CHECKS, ncrs = NCRS, warranty = WARRANTY_CASES) {
  return { inspections: records.length, openNcr: ncrs.filter((n) => n.status !== "closed").length, warrantyOpen: warranty.filter((w) => w.status !== "closed").length, averageDefectRatePct: records.length ? records.reduce((s, r) => s + r.defectRatePct, 0) / records.length : 0 };
}
