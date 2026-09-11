import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard operating page shell.
 *
 * Ordering matches the strongest existing pages (e.g. receivables) and what
 * VIBPE Assurance expects for route proof:
 * 1. Context header — title + one-line purpose
 * 2. KPI strip — live numbers from the loader
 * 3. Primary panel — canonical domain records
 * 4. Secondary panel(s) — related records (optional)
 * 5. Action zone — create*/transition* forms (optional)
 *
 * Theme: only existing tokens (border-border, bg-surface, text-accent, text-muted,
 * text-green, font-display). No new palette.
 */
export function WorkspacePage({
  kicker,
  title,
  description,
  actions,
  kpis,
  primary,
  secondary,
  children,
  className,
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
  kpis?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  /** Extra content after primary/secondary (e.g. long tables). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto max-w-7xl space-y-6", className)}>
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">{kicker}</p>
          <h1 className="mt-2 font-display text-4xl text-accent">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      {kpis ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div> : null}

      {primary}
      {secondary}
      {children}
    </main>
  );
}

/** Compact status banner using the same surface language as receivables. */
export function WorkspaceStatus({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted",
        tone === "ok" && "border-ok/30 text-ok",
        tone === "warn" && "border-warn/30 text-warn",
        tone === "danger" && "border-danger/30 text-danger",
      )}
    >
      {message}
    </div>
  );
}
