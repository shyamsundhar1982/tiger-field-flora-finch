import { BOM } from "@/lib/data/bom";
import type { BomOverrides, BomTier } from "@/lib/finance/bom-engine";
import { bomTotalInr } from "@/lib/finance/bom-engine";

export type EngineeringRevision = { product: string; revision: string; status: "released" | "draft" | "superseded"; geometry: string; material: string; layup: string; alloy: string; tooling: string; drawing: string };
export type Ecr = { id: string; title: string; product: string; fromRevision: string; toRevision: string; reason: string; bomCostDeltaInr: number; weightDeltaG: number; productionImpactPct: number; inventoryImpactLakh: number; affectedSkus: string[]; status: "open" | "approved" | "implemented" | "rejected" };

export const ENGINEERING_REVISIONS: EngineeringRevision[] = [
  { product: "Carbon / Latitude", revision: "C3", status: "released", geometry: "Race endurance geometry · Rev C", material: "High-modulus carbon", layup: "C3 production layup", alloy: "—", tooling: "Carbon frame mould set C", drawing: "VX-CARBON-C3" },
  { product: "Aluminium / Core", revision: "A2", status: "released", geometry: "All-road geometry · Rev A", material: "6061-T6 aluminium", layup: "—", alloy: "6061-T6", tooling: "Aluminium jig set A", drawing: "VX-ALU-A2" },
  { product: "Premium Carbon / Altitude", revision: "C2", status: "released", geometry: "Aero performance geometry · Rev B", material: "High-modulus carbon", layup: "C2 production layup", alloy: "—", tooling: "Altitude mould set B", drawing: "VX-APEX-C2" },
];

export function engineeringTier(product: string): BomTier { return product.toLowerCase().includes("aluminium") ? "core" : product.toLowerCase().includes("apex") || product.toLowerCase().includes("premium") ? "apex" : "pro"; }
export function ecrImpact(ecr: Ecr, overrides: BomOverrides = {}) {
  const tier = engineeringTier(ecr.product);
  const current = bomTotalInr(tier, overrides);
  return { ...ecr, currentBomCostInr: current, revisedBomCostInr: current + ecr.bomCostDeltaInr, revisedCogsLakh: (current + ecr.bomCostDeltaInr) / 100000, bomLinesAffected: BOM.filter((line) => /frame|fork|assembly|qc/i.test(line.item)).length };
}
