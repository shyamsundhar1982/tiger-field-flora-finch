import { createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { CommandShell } from "@/components/command-shell";
import { ProtectedNavigationBridge } from "@/components/protected-navigation-bridge";
import { getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

const LazyIbpeWorkspaceProjection = lazy(async () => {
  const module = await import("@/components/ibpe-workspace-projection");
  return { default: module.IbpeWorkspaceProjection };
});

const LazyControlledDocumentToolbar = lazy(async () => {
  const module = await import("@/components/controlled-document-toolbar");
  return { default: module.ControlledDocumentToolbar };
});

const LazyTraceabilityDocumentCentre = lazy(async () => {
  const module = await import("@/components/traceability-document-centre-v2");
  return { default: module.TraceabilityDocumentCentreV2 };
});

const LazyIbpeCopilot = lazy(async () => {
  const module = await import("@/components/ibpe-copilot");
  return { default: module.IbpeCopilot };
});

const CONTROLLED_DOCUMENT_ROUTES = new Set([
  "/command/sales",
  "/command/production",
  "/command/purchase-execution",
  "/command/receiving",
  "/command/quality",
  "/command/operations",
  "/command/receivables",
]);

function normalizeCommandPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    // One scalar role lookup proves both authenticated Command access and RBAC.
    // This avoids resolving the same Better Auth identity + persisted role two
    // or three times during every protected navigation.
    const role = await getCommandRole();
    if (!role) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }

    const routePath = normalizeCommandPath(location.pathname);
    if (routePath !== "/command" && !canAccessRoute(role, routePath)) {
      const page = getRouteMeta(routePath);
      const preferredTarget =
        page?.adminOnly && page.domain === "inventory" ? "/command/inventory" : "/command";
      throw redirect({
        to: normalizeCommandPath(preferredTarget) === routePath ? "/command" : preferredTarget,
      });
    }

    return { commandRole: role };
  },
  component: CommandRoot,
});

function DeferredCommandTools() {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Keep non-critical floating tools off the first paint. They become
    // available immediately after the protected page has had time to settle.
    const timer = window.setTimeout(() => setReady(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;
  const routePath = normalizeCommandPath(pathname);

  return (
    <Suspense fallback={null}>
      {CONTROLLED_DOCUMENT_ROUTES.has(routePath) ? <LazyControlledDocumentToolbar /> : null}
      <LazyTraceabilityDocumentCentre />
      <LazyIbpeCopilot />
    </Suspense>
  );
}

function CommandRoot() {
  const { commandRole } = Route.useRouteContext();
  useOperatingPlanSync();
  return (
    <>
      <ProtectedNavigationBridge />
      <Suspense fallback={null}>
        <LazyIbpeWorkspaceProjection />
      </Suspense>
      <CommandShell initialRole={commandRole} />
      <DeferredCommandTools />
    </>
  );
}
