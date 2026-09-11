import { Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

/**
 * Narrative / investor / reference area.
 * Not an operating workspace — no workflow rail, no domain owners.
 * Uses the same theme tokens as Command so brand stays coherent.
 */
export function StoryShell() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader showNavigation={false} brandHref="/command" />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <Link
            to="/command"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
          >
            <ArrowLeft className="size-3.5" />
            Back to Command
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">
            Story · investor & reference
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
