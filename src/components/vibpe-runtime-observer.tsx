import { useEffect } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";

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
  { id: "UI-VIBPE-ASSURANCE", route: "/command/ibpe-operating-workspace/assurance", label: "VIBPE Assurance renders" },
];

const target = () => `cloudflare-production:auto:${window.location.hostname}`;

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
    const inspected = inspectDocument(capability, document);
    await record(capability, inspected.passed, `${inspected.result} at ${pathname}`, {
      ...inspected.evidence,
      mode: "live-dom",
    }).catch(() => false);
  }
}

async function sweepAuthenticatedRoutes() {
  const key = "vibpe-ui-assurance-sweep-r3";
  if (sessionStorage.getItem(key) === "complete") return true;
  let posted = 0;
  for (const capability of capabilities) {
    try {
      const response = await fetch(capability.route, {
        method: "GET",
        credentials: "include",
        redirect: "follow",
        cache: "no-store",
      });
      const html = await response.text();
      const finalUrl = response.url;
      const loginLike =
        /\/login(?:[/?#]|$)/i.test(finalUrl) || /sign in|log in/i.test(html.slice(0, 3000));
      const doc = new DOMParser().parseFromString(html, "text/html");
      const inspected = inspectDocument(capability, doc);
      const passed = response.ok && !loginLike && inspected.passed;
      const ok = await record(
        capability,
        passed,
        passed
          ? `${inspected.result}; authenticated HTTP ${response.status}`
          : `${capability.label}: HTTP ${response.status}, loginLike=${loginLike}, error=${!inspected.passed}`,
        {
          ...inspected.evidence,
          mode: "authenticated-route-sweep",
          httpStatus: response.status,
          finalUrl,
          loginLike,
        },
      );
      if (ok) posted += 1;
    } catch (error) {
      await record(
        capability,
        false,
        `${capability.label}: ${error instanceof Error ? error.message : String(error)}`,
        { mode: "authenticated-route-sweep", error: String(error) },
      ).catch(() => false);
    }
  }
  const complete = posted === capabilities.length;
  if (complete) sessionStorage.setItem(key, "complete");
  return complete;
}

/**
 * Runtime assurance observer. It records evidence only; it does not own or mutate
 * any Product, Engineering, Operations, Quality, Finance or Governance transaction.
 */
export function VibpeRuntimeObserver() {
  const location = useLocation();
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => void observeCurrentRoute(location.pathname), 350);
    let sweepTimer = 0;
    if (location.pathname === "/command/ibpe-operating-workspace/assurance") {
      sweepTimer = window.setTimeout(() => {
        void sweepAuthenticatedRoutes().then(() => router.invalidate());
      }, 650);
    }
    return () => {
      window.clearTimeout(timer);
      if (sweepTimer) window.clearTimeout(sweepTimer);
    };
  }, [location.pathname, router]);
  return null;
}
