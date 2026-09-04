import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

const LINKS = [
  { to: "/", label: "House" },
  { to: "/range", label: "Range" },
  { to: "/command", label: "Command" },
] as const;

export function SiteHeader({ ghost = false }: { ghost?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className={cn("sticky top-0 z-40 border-b border-border/80", ghost ? "bg-bg/95" : "bg-bg")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`${BRAND.consumer}, ${BRAND.parent}`}>
          <img src={BRAND.logo} alt="Vayu Shastr" className="size-9 shrink-0 rounded-md object-cover" />
          <span className="min-w-0">
            <span className="block text-base font-bold tracking-[0.08em] text-accent sm:text-lg">{BRAND.consumer}</span>
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-green sm:block">{BRAND.parent}</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => <Link key={l.to} to={l.to} className="text-sm text-muted transition-colors duration-150 hover:text-accent" activeProps={{ className: "text-accent" }}>{l.label}</Link>)}
        </nav>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-md md:hidden" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </div>
      {open ? <nav className="border-t border-border px-4 py-3 md:hidden">{LINKS.map((l) => <Link key={l.to} to={l.to} className="block py-3 text-base text-fg" onClick={() => setOpen(false)}>{l.label}</Link>)}</nav> : null}
    </header>
  );
}

export function SiteFooter() {
  return <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="font-semibold text-accent">{BRAND.parent} · {BRAND.consumer}</p><p>Designed and engineered in India, for riders everywhere.</p></div></footer>;
}
