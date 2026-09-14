import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { lazy, Suspense, useEffect, useState } from "react";
import appCss from "../styles.css?url";

const APP_NAME = "VYNDI";

const LazyPreviewHostBridge = lazy(async () => {
  const module = await import("@/components/preview-host-bridge");
  return { default: module.PreviewHostBridge };
});

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

function migrateTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const current = text.nodeValue ?? "";
    const corrected = correctBrandCopy(current);
    if (corrected !== current) text.nodeValue = corrected;
  }
}

function migrateElementAttributes(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[aria-label],[title]").forEach((element) => {
    for (const attribute of ["aria-label", "title"] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const corrected = correctBrandCopy(current);
      if (corrected !== current) element.setAttribute(attribute, corrected);
    }
  });
  root.querySelectorAll<HTMLImageElement>("img[alt]").forEach((image) => {
    const corrected = correctBrandCopy(image.alt);
    if (corrected !== image.alt) image.alt = corrected;
  });
}

function BrandMigration() {
  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let scheduled: number | null = null;

    const flushRoots = (pendingRoots: Set<Text | Element>) => {
      scheduled = null;
      for (const root of pendingRoots) {
        if (root instanceof Text) {
          const current = root.nodeValue ?? "";
          const corrected = correctBrandCopy(current);
          if (corrected !== current) root.nodeValue = corrected;
          continue;
        }
        migrateTextNodes(root);
        migrateElementAttributes(root);
      }
      pendingRoots.clear();
    };

    const startMigration = () => {
      if (disposed || !document.body) return;

      // Compatibility cleanup is intentionally kept off the critical render path.
      // Once installed, only added/changed subtrees are inspected.
      migrateTextNodes(document.body);
      migrateElementAttributes(document.body);
      document.title = "VYNDI · Vāyú Shastr Pvt Ltd";

      const pendingRoots = new Set<Text | Element>();
      observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData" && record.target.nodeType === Node.TEXT_NODE) {
            pendingRoots.add(record.target as Text);
            continue;
          }
          for (const added of record.addedNodes) {
            if (added.nodeType === Node.TEXT_NODE) {
              pendingRoots.add(added as Text);
            } else if (added.nodeType === Node.ELEMENT_NODE) {
              pendingRoots.add(added as Element);
            }
          }
        }
        if (pendingRoots.size === 0 || scheduled != null) return;
        scheduled = window.setTimeout(() => flushRoots(pendingRoots), 50);
      });

      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    };

    // Do not make compatibility branding compete with hydration or route data.
    const startTimer = window.setTimeout(startMigration, 750);

    return () => {
      disposed = true;
      window.clearTimeout(startTimer);
      observer?.disconnect();
      if (scheduled != null) window.clearTimeout(scheduled);
    };
  }, []);
  return null;
}

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
