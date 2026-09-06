import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExplainableValueProps {
  value: string;
  label?: string;
  confidence?: string;
  reasoning?: string[];
  source?: string;
  className?: string;
  explanationId?: string;
  explanation?: { title?: string; reasoning?: string[]; source?: string };
}

export function ExplainableValue({ value, label, confidence, reasoning = [], source, className, explanationId, explanation }: ExplainableValueProps) {
  const details = explanation ?? { reasoning, source };
  const hasExplanation = Boolean(confidence || details.reasoning?.length || details.source || details.title);
  return (
    <div className={cn("group relative", className)}>
      <div className="flex items-center gap-1">
        {label && <p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p>}
        {hasExplanation && <Info className="size-3 text-subtle transition-colors group-hover:text-accent" aria-hidden="true" />}
      </div>
      <p className="mt-1 text-lg tabular-nums text-fg">{value}</p>
      {hasExplanation && (
        <div data-explanation-id={explanationId} className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-72 -translate-x-1/2 rounded-xl border border-border bg-bg/95 p-4 text-left shadow-xl backdrop-blur-xl group-hover:block group-focus-within:block">
          {details.title && <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{details.title}</p>}
          {confidence && <p className="mt-1 text-xs font-semibold text-accent">{confidence} confidence</p>}
          {details.reasoning?.length ? <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted">{details.reasoning.map(item => <li key={item}>• {item}</li>)}</ul> : null}
          {details.source && <p className="mt-3 border-t border-border pt-2 text-[10px] uppercase tracking-wider text-subtle">Source · {details.source}</p>}
        </div>
      )}
    </div>
  );
}