import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { BRAND } from "@/lib/brand";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND.consumer },
      { name: "description", content: `${BRAND.consumer} by ${BRAND.parent} — engineered carbon endurance bicycles, developed in Coimbatore, India.` },
      { name: "theme-color", content: "#0c0c0e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: BRAND.logo },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400;1,500&family=Outfit:wght@300;400;500;600&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: BRAND.logo },
    ],
  }),
  component: Root,
});
function Root() { return <html lang="en" className="antialiased" suppressHydrationWarning><head><HeadContent /></head><body className="bg-bg text-fg"><PreviewHostBridge /><AuthProvider><Outlet /></AuthProvider><Scripts /><Analytics /></body></html>; }
