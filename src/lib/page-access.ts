import { getRouteMeta, type PageDomain, type PageMeta, type PageMode, type PageOwner } from "@/lib/page-metadata";

export type CommandRole =
  | "admin"
  | "management"
  | "board"
  | "finance"
  | "operations"
  | "engineering"
  | "qa"
  | "compliance"
  | "viewer";

export type CommandPermission = "view" | "edit" | "approve" | "admin";

type RolePolicy = {
  modes: PageMode[];
  domains?: PageDomain[];
  owners?: PageOwner[];
  permissions: CommandPermission[];
};

/**
 * Phase E source of truth for VINDY role access.
 *
 * Admin is unrestricted. Functional roles are scoped by mode, domain and
 * ownership. Viewer remains read/presentation-only for compatibility with
 * Phase D. Route metadata remains the single page classification registry.
 */
export const rolePolicies: Record<CommandRole, RolePolicy> = {
  admin: {
    modes: ["observe", "operate", "understand", "showcase"],
    permissions: ["view", "edit", "approve", "admin"],
  },
  management: {
    modes: ["observe", "operate", "understand", "showcase"],
    domains: ["command", "finance", "manufacturing", "inventory", "procurement", "engineering", "epr", "knowledge", "sales", "market", "legal", "risk", "leadership", "admin"],
    permissions: ["view", "edit"],
  },
  board: {
    modes: ["observe", "showcase"],
    domains: ["command", "finance", "manufacturing", "inventory", "procurement", "engineering", "epr", "knowledge", "sales", "market", "legal", "risk", "leadership"],
    permissions: ["view"],
  },
  finance: {
    modes: ["observe", "operate", "understand"],
    domains: ["command", "finance", "knowledge", "risk", "legal"],
    owners: ["founder", "board", "finance", "knowledge", "risk", "legal", "all"],
    permissions: ["view", "edit", "approve"],
  },
  operations: {
    modes: ["observe", "operate", "understand"],
    domains: ["command", "manufacturing", "inventory", "procurement", "engineering", "epr", "knowledge"],
    owners: ["founder", "operations", "engineering", "qa", "compliance", "knowledge", "all"],
    permissions: ["view", "edit", "approve"],
  },
  engineering: {
    modes: ["observe", "operate", "understand"],
    domains: ["command", "engineering", "manufacturing", "knowledge", "inventory"],
    owners: ["founder", "operations", "engineering", "qa", "knowledge", "all"],
    permissions: ["view", "edit", "approve"],
  },
  qa: {
    modes: ["observe", "operate", "understand"],
    domains: ["command", "manufacturing", "engineering", "knowledge", "risk", "epr"],
    owners: ["founder", "engineering", "qa", "operations", "compliance", "knowledge", "risk", "all"],
    permissions: ["view", "edit", "approve"],
  },
  compliance: {
    modes: ["observe", "operate", "understand"],
    domains: ["command", "epr", "legal", "risk", "knowledge", "manufacturing"],
    owners: ["founder", "compliance", "legal", "risk", "qa", "knowledge", "all"],
    permissions: ["view", "edit", "approve"],
  },
  viewer: {
    modes: ["observe", "showcase"],
    permissions: ["view"],
  },
};

export function canAccessPage(role: CommandRole | null, page: PageMeta | undefined): boolean {
  if (!role || !page) return false;
  const policy = rolePolicies[role];
  if (!policy.modes.includes(page.mode)) return false;
  if (policy.domains && !policy.domains.includes(page.domain)) return false;
  if (policy.owners && !policy.owners.includes(page.owner) && !policy.owners.includes("all")) return false;
  return true;
}

export function canAccessRoute(role: CommandRole | null, route: string): boolean {
  return canAccessPage(role, getRouteMeta(route));
}

export function isModeAllowed(role: CommandRole | null, mode: PageMode): boolean {
  if (!role) return false;
  return rolePolicies[role].modes.includes(mode);
}

export function hasPermission(role: CommandRole | null, permission: CommandPermission): boolean {
  if (!role) return false;
  return rolePolicies[role].permissions.includes(permission);
}

export function canPerform(
  role: CommandRole | null,
  permission: CommandPermission,
  page?: PageMeta,
): boolean {
  return hasPermission(role, permission) && (!page || canAccessPage(role, page));
}
