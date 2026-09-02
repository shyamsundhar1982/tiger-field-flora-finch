export type BomLine = {
  item: string;
  core: number;
  pro: number;
  apex: number;
  note?: string;
  flag?: "hs" | "freight" | "warranty";
};

export const BOM: BomLine[] = [
  { item: "Frame (landed, ex-tooling amort.)", core: 28000, pro: 38000, apex: 52000 },
  { item: "Fork", core: 6500, pro: 8500, apex: 12000 },
  { item: "Groupset", core: 18000, pro: 28000, apex: 45000 },
  { item: "Wheelset", core: 12000, pro: 18000, apex: 32000 },
  { item: "Cockpit / bar-stem / tape", core: 4200, pro: 5800, apex: 8200 },
  { item: "Saddle + seatpost", core: 2800, pro: 3200, apex: 4800 },
  { item: "Tyres + tubes / sealant", core: 2600, pro: 2800, apex: 3800 },
  { item: "Assembly + QC + packaging", core: 3300, pro: 4000, apex: 5500 },
  {
    item: "Freight (sea, 15–20% buffer in model)",
    core: 3500,
    pro: 4000,
    apex: 5000,
    flag: "freight",
    note: "Volatile. Hold 15–20% buffer until contracted.",
  },
  {
    item: "Customs / BCD + IGST (estimate)",
    core: 4500,
    pro: 6000,
    apex: 8500,
    flag: "hs",
    note: "HIGH RISK — confirm HS with CA / CHA before locking COGS.",
  },
  {
    item: "Warranty reserve + gateway",
    core: 4500,
    pro: 5600,
    apex: 7300,
    flag: "warranty",
    note: "2–3% warranty. Reassess after first 100 units.",
  },
];

export function bomTotal(tier: "core" | "pro" | "apex") {
  return BOM.reduce((s, r) => s + r[tier], 0);
}

export const MIX = { core: 0.4, pro: 0.45, apex: 0.15 } as const;

export const BLENDED_COGS =
  bomTotal("core") * MIX.core + bomTotal("pro") * MIX.pro + bomTotal("apex") * MIX.apex;

// Keep the blended commercial model tied to the published tier ASPs.
// This prevents stale pricing from diverging from the Range page / product model.
export const BLENDED_ASP =
  129900 * MIX.core + 179900 * MIX.pro + 264900 * MIX.apex;

export const CHANNEL = {
  d2cShare: 0.7,
  dealerShare: 0.3,
  dealerMargin: 0.26,
  d2cVariable: 3500,
  d2cCac: 8000,
  dealerCac: 3000,
} as const;
