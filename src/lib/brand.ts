export const VAYU_LEGAL_NAME = "VĀYÚ SHASTR PVT. LTD.";
export const VYNDI_OS_NAME = "VYNDI OS";
export const VIBPE_COPILOT_LABEL = "VIBPE Co-Pilot 2.0";
export const VYNDI_PRODUCT_NAME = "VYNDI";
export const VAYU_LOGO_PATH = "/brand/vayu-official.svg";

export const VYNDI_BRAND_HIERARCHY = [
  VAYU_LEGAL_NAME,
  VYNDI_OS_NAME,
  VIBPE_COPILOT_LABEL,
  VYNDI_PRODUCT_NAME,
] as const;

export const VYNDI_BRAND_HIERARCHY_LABEL = VYNDI_BRAND_HIERARCHY.join(" → ");

export function absoluteVayuLogoUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}${VAYU_LOGO_PATH}`;
}
