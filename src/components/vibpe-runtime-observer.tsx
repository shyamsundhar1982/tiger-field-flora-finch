import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

type Capability = { id: string; route: string; label: string; kind?: "route" | "sales-confirm" | "action-lifecycle" };

const capabilities: Capability[] = [
  { id: "UI-AUTH-SESSION", route: "/command", label: "Authenticated Command navigation persists" },
  { id: "UI-SALES-LOAD", route: "/command/sales", label: "Demand & Orders renders" },
  { id: "UI-SALES-CONFIRM", route: "/command/sales", label: "Sales confirmation control contract", kind: "sales-confirm" },
  { id: "UI-PRODUCT-LOAD", route: "/command/product", label: "Product authority renders" },
  { id: "UI-ENGINEERING-LOAD", route: "/command/engineering", label: "Engineering authority renders" },
  { id: "UI-BOM-LOAD", route: "/command/bom-control", label: "BOM Control renders" },
  { id: "UI-INVENTORY-LOAD", route: "/command/inventory", label: "Inventory renders" },
  { id: "UI-PROCUREMENT-LOAD", route: "/command/procurement-planning", label: "Procurement Planning renders" },
  { id: "UI-PRODUCTION-LOAD", route: "/command/production", label: "Production renders" },
  { id: "UI-QUALITY-LOAD", route: "/command/quality", label: "Quality authority renders" },
  { id: "UI-PEOPLE-OFFICE-LOAD", route: "/command/people-office", label: "People & Office authority renders" },
  { id: "UI-DISPATCH-VISIBILITY", route: "/command/operations", label: "Operations dispatch visibility renders" },
  { id: "UI-ACTION-INBOX", route: "/command/actions", label: "Business Action Inbox renders" },
  { id: "UI-ACTION-LIFECYCLE", route: "/command/actions", label: "Action lifecycle control is singular", kind: "action-lifecycle" },
  { id: "UI-CONTROL-TOWER", route: "/command/control-tower", label: "Control Tower renders" },
  { id: "UI-VIBPE-WORKSPACE", route: "/command/ibpe-operating-workspace", label: "VIBPE Operating Workspace renders" },
  { id: "UI-VIBPE-AUTHORITY", route: "/command/ibpe-operating-workspace/authority", label: "Advanced Planning Authority renders" },
  { id: "UI-VIBPE-OPTIMIZER", route: "/command/ibpe-operating-workspace/optimizer", label: "Governed Optimizer renders" },
  { id: "UI-VIBPE-OUTPUTS", route: "/command/ibpe-operating-workspace/outputs", label: "Outputs & Evidence renders" },
  { id: "UI-VIBPE-ASSURANCE", route: "/command/ibpe-operating-workspace/assurance", label: "VIBPE Assurance renders" },
  { id: "UI-VIBPE-RELEASE", route: "/command/ibpe-operating-workspace/release", label: "Release Readiness renders" },
];

function target() {
  const hostname = window.location.hostname;
  const provider = hostname.endsWith(".workers.dev")
    ? "cloudflare-production"
    : hostname.endsWith(".vercel.app")
      ? "vercel-production"
      : "production";
  return `${provider}:auto:${hostname}`;
}

async function record(capability: Capability, passed: boolean, observedResult: string, evidence: Record<string, unknown>) {
  const response = await fetch("/api/vibpe/ui-assurance", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: capability.id,
      target: target(),
      passed,
      observedResult,
      routePath: capability.route,
      evidence: { ...evidence, automatedRuntimeObserver: true, observedAt: new Date().toISOString() },
    }),
  });
  return response.ok;
}

function inspectDocument(capability: Capability, doc: Document) {
  const bodyText = (doc.body?.innerText ?? "").slice(0, 5000);
  const errorLike = /something went wrong|application error|internal server error/i.test(bodyText);
  if (capability.kind === "action-lifecycle") {
    const controls = [...doc.querySelectorAll("button")].filter((button) =>
      /^(start|complete)$/i.test((button.textContent ?? "").trim()),
    );
    return {
      passed: !errorLike && controls.length <= 1,
      result:
        controls.length <= 1
          ? `Action lifecycle observed with ${controls.length} eligible Start/Complete control.`
          : `Action lifecycle rendered ${controls.length} simultaneous Start/Complete controls.`,
      evidence: { errorLike, lifecycleControls: controls.length },
    };
  }
  if (capability.kind === "sales-confirm") {
    const controls = [...doc.querySelectorAll("button")].filter((button) =>
      /confirm/i.test((button.textContent ?? "").trim()),
    );
    return {
      passed: !errorLike,
      result: controls.length
        ? `Sales confirmation contract observed with ${controls.length} confirm control(s).`
        : "Sales route observed successfully; no confirmation control is currently eligible in this state.",
      evidence: { errorLike, confirmControls: controls.length, eligibleStateObserved: controls.length > 0 },
    };
  }
  return { passed: !errorLike, result: `${capability.label}: rendered`, evidence: { errorLike } };
}

async function observeCurrentRoute(pathname: string) {
  const matches = capabilities.filter((capability) => capability.route === pathname);
  if (!matches.length) return;
  for (const capability of matches) {
    // Persistence is a temporal property: a single live API probe cannot prove
    // that a session survives navigation or reload. The explicit Playwright
    // assurance runner owns UI-AUTH-SESSION and records it only after a real
    // document reload. Avoid manufacturing a false-positive persistence record
    // (and an unnecessary POST) on every Command mount.
    if (capability.id === "UI-AUTH-SESSION") continue;

    const inspected = inspectDocument(capability, document);
    await record(capability, inspected.passed, `${inspected.result} at ${pathname}`, {
      ...inspected.evidence,
      mode: "live-dom",
    }).catch(() => false);
  }
}

/**
 * Lightweight runtime assurance observer. It records evidence for the route the
 * operator is actually using; it does not crawl the whole application from a
 * live business session. Full cross-route and temporal session assurance belong
 * to the explicit Playwright audit runner, avoiding self-generated request
 * storms and misleading one-shot persistence evidence in workerd.
 */
export function VibpeRuntimeObserver() {
  const location = useLocation();
  useEffect(() => {
    const timer = window.setTimeout(() => void observeCurrentRoute(location.pathname), 350);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);
  return null;
}
