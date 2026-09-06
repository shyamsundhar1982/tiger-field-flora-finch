import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExplainableValueProps {
  value: string;
  label?: string;
  confidence?: string;
  reasoning?: string[];
  source?: string;
  className?: string;
}

export function ExplainableValue({ value, label, confidence, reasoning = [], source, className }: ExplainableValueProps) {
  const hasExplanation = Boolean(confidence || reasoning.length || source);
  return (
    <div className={cn("group relative", className)}>
      <div className="flex items-center gap-1">
        {label && <p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p>}
        {hasExplanation && <Info className="size-3 text-subtle transition-colors group-hover:text-accent" aria-hidden="true" />}
      </div>
      <p className="mt-1 text-lg tabular-nums text-fg">{value}</p>
      {hasExplanation && (
        <div className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 hidden w-72 rounded-xl border border-border bg-bg/95 p-4 text-left shadow-xl backdrop-blur-xl group-hover:block group-focus-within:block">
          {confidence && <p className="text-xs font-semibold text-accent">{confidence} confidence</p>}
          {reasoning.length > 0 && (
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted">
              {reasoning.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          )}
          {source && <p className="mt-3 border-t border-border pt-2 text-[10px] uppercase tracking-wider text-subtle">Source · {source}</p>}
        </div>
      )}
    </div>
  );
}
