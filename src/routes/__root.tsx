import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { PrintBrandHeader } from "@/components/brand-lockup";
import { VAYU_LEGAL_NAME, VYNDI_BRAND_HIERARCHY_LABEL, VYNDI_OS_NAME } from "@/lib/brand";
import { lazy, Suspense, useEffect, useState } from "react";
import "../styles.css";

const LazyPreviewHostBridge = lazy(async () => {
  const module = await import("@/components/preview-host-bridge");
  return { default: module.PreviewHostBridge };
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${VYNDI_OS_NAME} · ${VAYU_LEGAL_NAME}` },
      { name: "application-name", content: VYNDI_OS_NAME },
      { name: "apple-mobile-web-app-title", content: VYNDI_OS_NAME },
      { name: "description", content: `${VYNDI_BRAND_HIERARCHY_LABEL}. Governed business execution for Vāyú's VYNDI carbon bicycle platform.` },
      { name: "theme-color", content: "#0c0c0e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/brand/vayu-official.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400;1,500&display=swap" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function PreviewBridgeBoundary() {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(window.parent !== window);
  }, []);

  if (!embedded) return null;
  return (
    <Suspense fallback={null}>
      <LazyPreviewHostBridge />
    </Suspense>
  );
}

function LegalFooter() {
  return (
    <footer className="vyndi-legal-footer" aria-label="Vāyú Shastr copyright notice">
      <span className="vyndi-legal-footer__company">© 2026 Vāyú Shastr Pvt. Ltd.</span>
      <span className="vyndi-legal-footer__separator" aria-hidden="true">•</span>
      <span>All Rights Reserved</span>
      <span className="vyndi-legal-footer__separator" aria-hidden="true">•</span>
      <span>Designed & Developed by S. Shyam Sundhar</span>
    </footer>
  );
}

function Root() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body className="bg-bg text-fg">
        <PreviewBridgeBoundary />
        <AuthProvider>
          <PrintBrandHeader />
          <Outlet />
          <LegalFooter />
        </AuthProvider>
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}
