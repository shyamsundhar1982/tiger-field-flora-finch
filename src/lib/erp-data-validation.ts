import { ERP_FLOW } from "@/lib/erp-flow";
import { routeRegistry } from "@/lib/page-metadata";
import { DEFAULT_FINANCE_ASSUMPTIONS } from "@/lib/finance/model";

export interface ErpValidationResult {
  ok: boolean;
  checks: string[];
  issues: string[];
}

/** Structural checks only. No business records are created or changed. */
export function validateErpStructure(): ErpValidationResult {
  const checks: string[] = [];
  const issues: string[] = [];
  const lines = DEFAULT_FINANCE_ASSUMPTIONS.productLines;

  if (new Set(lines.map((line) => line.id)).size === lines.length) checks.push("Product line IDs are unique");
  else issues.push("Duplicate product line ID");

  const mix = lines.reduce((sum, line) => sum + line.mixPct, 0);
  if (Math.abs(mix - 100) < 0.001) checks.push("Product mix totals 100%");
  else issues.push(`Product mix totals ${mix}% instead of 100%`);

  for (const line of lines) {
    if (line.aspLakh > 0 && line.cogsLakh > 0 && line.cogsLakh <= line.aspLakh) checks.push(`${line.label}: ASP/COGS relationship is valid`);
    else issues.push(`${line.label}: invalid ASP/COGS relationship`);
    if (line.launchMonth >= 1 && line.launchMonth <= 36) checks.push(`${line.label}: launch month is within model horizon`);
    else issues.push(`${line.label}: launch month is outside M1–M36`);
  }

  const a = DEFAULT_FINANCE_ASSUMPTIONS;
  for (const [name, value] of Object.entries({ unitMultiplier: a.unitMultiplier, opexMultiplier: a.opexMultiplier, capexMultiplier: a.capexMultiplier, inventoryMultiplier: a.inventoryMultiplier, fundingMultiplier: a.fundingMultiplier })) {
    if (value > 0) checks.push(`${name} is positive`);
    else issues.push(`${name} must be positive`);
  }

  const missingRoutes = ERP_FLOW.flatMap((step) => step.routes.filter((route) => !routeRegistry[route]));
  if (!missingRoutes.length) checks.push("Every flow step points to a registered route");
  else issues.push(`Unregistered flow route: ${missingRoutes.join(", ")}`);

  return { ok: issues.length === 0, checks, issues };
}
