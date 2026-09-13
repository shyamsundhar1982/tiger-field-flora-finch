export const VYNDI_OPTIMIZER_DEFAULT_RUNTIME_MS = 12_000;
export const VYNDI_OPTIMIZER_MAX_RUNTIME_MS = 12_000;

export function governedOptimizerRuntimeMs(requested: number | undefined) {
  if (requested === undefined) return VYNDI_OPTIMIZER_DEFAULT_RUNTIME_MS;
  if (!Number.isFinite(requested) || requested <= 0) return Number.NaN;
  return Math.min(requested, VYNDI_OPTIMIZER_MAX_RUNTIME_MS);
}
