import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Compatibility guard for older protected pages that still contain plain
 * same-origin anchors. A hard document navigation cannot transport the
 * preview/deployment bearer stored in sessionStorage to the first SSR request,
 * so it can look like every workspace requires another login. Canonical new UI
 * uses <Link>; this bridge keeps remaining legacy anchors inside the SPA until
 * they are individually migrated.
 */
export function ProtectedNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname !== "/inventory" &&
        destination.pathname !== "/command" &&
        !destination.pathname.startsWith("/command/")
      ) return;

      event.preventDefault();
      const to = `${destination.pathname}${destination.search}${destination.hash}`;
      void navigate({ to: to as never });
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [navigate]);

  return null;
}
