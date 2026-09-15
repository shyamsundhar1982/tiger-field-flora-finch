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

export function BrandLoadingState() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center text-center" role="status">
        <span className="relative flex size-20 items-center justify-center rounded-xl border border-border bg-surface/60 shadow-2xl">
          <span className="absolute inset-0 animate-ping rounded-xl border border-accent/35 motion-reduce:animate-none" aria-hidden="true" />
          <VayuMark decorative className="size-16" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{VAYU_LEGAL_NAME}</p>
        <p className="mt-2 text-xl font-bold text-accent">{VYNDI_OS_NAME}</p>
        <p className="mt-2 text-xs text-subtle">{VIBPE_COPILOT_LABEL} → {VYNDI_PRODUCT_NAME}</p>
        <span className="mt-5 h-0.5 w-24 overflow-hidden bg-border" aria-hidden="true">
          <span className="block h-full w-1/2 animate-pulse bg-accent motion-reduce:animate-none" />
        </span>
        <span className="sr-only">Loading VYNDI OS</span>
      </div>
    </main>
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
