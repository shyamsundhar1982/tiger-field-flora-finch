import { cn } from "@/lib/utils";
import {
  VAYU_LEGAL_NAME,
  VAYU_LOGO_PATH,
  VIBPE_COPILOT_LABEL,
  VYNDI_OS_NAME,
  VYNDI_PRODUCT_NAME,
} from "@/lib/brand";

type BrandLockupProps = {
  className?: string;
  compact?: boolean;
  markClassName?: string;
  showFullHierarchy?: boolean;
};

export function VayuMark({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <img
      src={VAYU_LOGO_PATH}
      alt={decorative ? "" : `${VAYU_LEGAL_NAME} hexagon logo`}
      aria-hidden={decorative || undefined}
      className={cn("size-11 shrink-0 object-contain", className)}
    />
  );
}

export function BrandLockup({
  className,
  compact = false,
  markClassName,
  showFullHierarchy = true,
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center", compact ? "gap-2.5" : "gap-3", className)}>
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg", compact ? "size-9" : "size-11", markClassName)}>
        <VayuMark decorative className="size-full" />
      </span>
      <span className="min-w-0 leading-none">
        <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
          {VAYU_LEGAL_NAME}
        </span>
        <span className={cn("mt-1 block truncate font-bold tracking-tight text-accent", compact ? "text-sm" : "text-lg")}>
          {VYNDI_OS_NAME}
        </span>
        {showFullHierarchy ? (
          <span className="mt-1 block truncate text-[9px] font-medium tracking-wide text-subtle">
            {VIBPE_COPILOT_LABEL} <span aria-hidden="true">→</span> {VYNDI_PRODUCT_NAME}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function PrintBrandHeader() {
  return (
    <header className="vyndi-print-brand" aria-hidden="true">
      <VayuMark decorative className="vyndi-print-brand__mark" />
      <span>
        <strong>{VAYU_LEGAL_NAME}</strong>
        <span>{VYNDI_OS_NAME} → {VIBPE_COPILOT_LABEL} → {VYNDI_PRODUCT_NAME}</span>
      </span>
    </header>
  );
}
