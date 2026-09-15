import {
  absoluteVayuLogoUrl,
  VAYU_LEGAL_NAME,
  VIBPE_COPILOT_LABEL,
  VYNDI_OS_NAME,
  VYNDI_PRODUCT_NAME,
} from "@/lib/brand";

export const VYNDI_PRINT_BRAND_CSS = `
  .vyndi-brand-lockup { display: flex; align-items: center; gap: 9px; }
  .vyndi-brand-lockup img { width: 38px; height: 38px; object-fit: contain; }
  .vyndi-brand-company { font-size: 8px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
  .vyndi-brand-os { margin-top: 2px; font-size: 15px; font-weight: 800; letter-spacing: .04em; }
  .vyndi-brand-lineage { margin-top: 2px; color: #555; font-size: 7px; letter-spacing: .035em; }
`;

export function vyndiPrintBrandMarkup(origin: string) {
  return `<div class="vyndi-brand-lockup">
    <img src="${absoluteVayuLogoUrl(origin)}" alt="" />
    <div>
      <div class="vyndi-brand-company">${VAYU_LEGAL_NAME}</div>
      <div class="vyndi-brand-os">${VYNDI_OS_NAME}</div>
      <div class="vyndi-brand-lineage">${VIBPE_COPILOT_LABEL} → ${VYNDI_PRODUCT_NAME}</div>
    </div>
  </div>`;
}
