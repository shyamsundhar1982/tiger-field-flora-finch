import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand-lockup";
import { VYNDI_BRAND_HIERARCHY_LABEL } from "@/lib/brand";

const LINKS = [
  { to: "/", label: "House" },
  { to: "/range", label: "Range" },
] as const;

const COMMAND_RETURN_TO = "/command";
type SiteHeaderProps = {
  ghost?: boolean;
  showNavigation?: boolean;
  brandHref?: string;
};

export function SiteHeader({ ghost = false, showNavigation = true, brandHref = "/" }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className={cn("sticky top-0 z-40 border-b border-border/80", ghost ? "bg-bg/95" : "bg-bg")}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link to={brandHref as never} className="min-w-0" aria-label={VYNDI_BRAND_HIERARCHY_LABEL}>
          <BrandLockup compact className="max-w-[min(70vw,24rem)]" />
        </Link>
        {showNavigation ? (
          <>
            <nav className="hidden items-center gap-8 md:flex">
              {LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="text-sm text-muted transition-colors duration-150 hover:text-accent" activeProps={{ className: "text-accent" }}>
                  {l.label}
                </Link>
              ))}
              <Link
                to="/login"
                search={{ returnTo: COMMAND_RETURN_TO }}
                className="text-sm text-muted transition-colors duration-150 hover:text-accent"
              >
                Command
              </Link>
            </nav>
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-md md:hidden" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </>
        ) : null}
      </div>
      {showNavigation && open ? (
        <nav className="border-t border-border px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="block py-3 text-base text-fg" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <Link
            to="/login"
            search={{ returnTo: COMMAND_RETURN_TO }}
            className="block py-3 text-base text-fg"
            onClick={() => setOpen(false)}
          >
            Command
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-semibold text-accent">VĀYÚ SHASTR PVT. LTD. → VYNDI OS → VIBPE Co-Pilot 2.0 → VYNDI</p>
        <p>Designed and developed in India, for Indian riders.</p>
      </div>
    </footer>
  );
}
