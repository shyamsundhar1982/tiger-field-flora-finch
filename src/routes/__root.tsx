import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { useEffect } from "react";
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

function correctBrandCopy(value: string) {
  return value
    .replace(/VéLOXIS/gi, "VYNDI")
    .replace(/\bVINDY\b/g, "VYNDI")
    .replace(/\bVindy\b/g, "VYNDI");
}

function BrandMigration() {
  useEffect(() => {
    const migrate = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) nodes.push(node as Text);
      for (const text of nodes) {
        const current = text.nodeValue ?? "";
        const corrected = correctBrandCopy(current);
        if (corrected !== current) text.nodeValue = corrected;
      }

      document.querySelectorAll<HTMLElement>("[aria-label],[title]").forEach((element) => {
        for (const attribute of ["aria-label", "title"] as const) {
          const current = element.getAttribute(attribute);
          if (!current) continue;
          const corrected = correctBrandCopy(current);
          if (corrected !== current) element.setAttribute(attribute, corrected);
        }
      });
      document.querySelectorAll<HTMLImageElement>("img[alt]").forEach((image) => {
        const corrected = correctBrandCopy(image.alt);
        if (corrected !== image.alt) image.alt = corrected;
      });

      document.title = "VYNDI · Vāyú Shastr Pvt Ltd";
    };
    migrate();
    const observer = new MutationObserver(migrate);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

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
          <BrandMigration />
          <Outlet />
          <LegalFooter />
        </AuthProvider>
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}
