import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "VYNDI";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${APP_NAME} · Vāyú Shastr Pvt Ltd` },
      { name: "description", content: "VYNDI by Vāyú Shastr Pvt Ltd — aerospace-grade carbon bicycles, designed in Coimbatore." },
      { name: "theme-color", content: "#0c0c0e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400;1,500&family=Outfit:wght@300;400;500;600&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function LegalFooter() {
  return (
    <footer className="vyndi-legal-footer" aria-label="Vāyú Shastr copyright notice">
      <span className="vyndi-legal-footer__company">© 2026 Vāyú Shastr Pvt. Ltd.</span>
      <span className="vyndi-legal-footer__separator" aria-hidden="true">•</span>
      <span>All Rights Reserved</span>
      <span className="vyndi-legal-footer__separator" aria-hidden="true">•</span>
      <span>Designed &amp; Developed by S. Shyam Sundhar</span>
    </footer>
  );
}

function Root() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <LegalFooter />
        </AuthProvider>
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}
