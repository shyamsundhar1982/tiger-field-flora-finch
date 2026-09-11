import { useRef, type ReactNode } from "react";
import { printControlledElement } from "@/lib/controlled-print";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  return (
    <div className="relative min-h-[112px] rounded-xl border border-border bg-surface/45 p-4 transition-colors duration-200 hover:border-accent/35 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-3 break-words font-display text-2xl font-semibold tabular-nums tracking-tight text-fg sm:text-3xl",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  kicker,
  children,
  className,
  printable,
  printTitle,
  printRecordType,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
  printable?: boolean;
  printTitle?: string;
  printRecordType?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldPrint = printable ?? /\b(ledger|register|registers)\b/i.test(title);

  function printPanel() {
    if (!sectionRef.current) return;
    try {
      printControlledElement(sectionRef.current, {
        title: printTitle || title,
        recordType: printRecordType || "Controlled Ledger / Register Extract",
        subtitle: kicker,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The controlled print record could not be opened.");
    }
  }

  return (
    <section ref={sectionRef} className={cn("rounded-xl border border-border bg-surface/35 p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green">{kicker}</p> : null}
          <h2 className={cn("font-display text-xl font-semibold text-accent", kicker && "mt-1")}>{title}</h2>
        </div>
        {shouldPrint ? (
          <button
            type="button"
            data-print-exclude="true"
            onClick={printPanel}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
          >
            Print / Export PDF
          </button>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
