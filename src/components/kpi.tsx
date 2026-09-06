import type { ReactNode } from "react";
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
  const explanation = hint
    ? hint
    : `Based on the underlying data and model used for ${label.toLowerCase()}.`;

  return (
    <div className="group relative min-h-[128px] rounded-2xl border border-border bg-bg-elevated p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-fg/30 hover:shadow-lg">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-4 break-words font-display text-3xl tabular-nums tracking-tight text-fg",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-muted">
        Hover for context
      </p>

      <div className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-3 px-1 opacity-0 transition-all duration-200 group-hover:translate-y-1 group-hover:opacity-100">
        <div className="rounded-2xl border border-white/15 bg-black/25 p-4 text-xs leading-6 text-fg shadow-2xl backdrop-blur-xl">
          <p>{explanation}</p>
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, kicker, children, className }: { title: string; kicker?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-bg-elevated p-5", className)}>
      {kicker ? <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{kicker}</p> : null}
      <h2 className="font-display text-xl text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
