import { BOM, type BomLine } from "@/lib/data/bom";

export type BomTier = "core" | "pro" | "apex";
export type BomCostSource = "manual" | "bom";
export type BomCell = { quantity?: number; unitCostInr?: number };
export type BomOverrides = Record<string, Partial<Record<BomTier, BomCell>>>;
export const DEFAULT_BOM_OVERRIDES: BomOverrides = {};

function cell(line: BomLine, tier: BomTier, overrides: BomOverrides = DEFAULT_BOM_OVERRIDES): Required<BomCell> {
  const value = overrides[line.item]?.[tier];
  return { quantity: Math.max(0, value?.quantity ?? 1), unitCostInr: Math.max(0, value?.unitCostInr ?? line[tier]) };
}
export function bomBreakdown(tier: BomTier, overrides: BomOverrides = DEFAULT_BOM_OVERRIDES) {
  return BOM.map((line) => { const c = cell(line, tier, overrides); return { ...line, quantity: c.quantity, unitCostInr: c.unitCostInr, extendedCostInr: c.quantity * c.unitCostInr }; });
}
export function bomTotalInr(tier: BomTier, overrides: BomOverrides = DEFAULT_BOM_OVERRIDES) { return bomBreakdown(tier, overrides).reduce((sum, line) => sum + line.extendedCostInr, 0); }
export function bomTotalLakh(tier: BomTier, overrides: BomOverrides = DEFAULT_BOM_OVERRIDES) { return bomTotalInr(tier, overrides) / 100000; }
export function bomBlendedCostInr(overrides: BomOverrides = DEFAULT_BOM_OVERRIDES) { return bomTotalInr("core", overrides) * 0.4 + bomTotalInr("pro", overrides) * 0.45 + bomTotalInr("apex", overrides) * 0.15; }
export function bomCellValue(line: BomLine, tier: BomTier, field: keyof Required<BomCell>, overrides: BomOverrides = DEFAULT_BOM_OVERRIDES) { return cell(line, tier, overrides)[field]; }
