import { getRouteMeta, type PageMeta, type PageMode } from "@/lib/page-metadata";

export type CommandRole = "admin" | "viewer";

/**
 * Phase D access policy.
 *
 * Admin is unrestricted. The existing viewer account is intentionally limited
 * to read-oriented Observe and presentation-oriented Showcase pages.
 * Future Operations / Finance / Board roles can be added here without
 * changing the route metadata model.
 */
export const allowedModesByRole: Record<CommandRole, PageMode[]> = {
  admin: ["observe", "operate", "understand", "showcase"],
  viewer: ["observe", "showcase"],
};

export function canAccessPage(role: CommandRole | null, page: PageMeta | undefined): boolean {
  if (!role || !page) return false;
  return allowedModesByRole[role].includes(page.mode);
}

export function canAccessRoute(role: CommandRole | null, route: string): boolean {
  return canAccessPage(role, getRouteMeta(route));
}

export function isModeAllowed(role: CommandRole | null, mode: PageMode): boolean {
  if (!role) return false;
  return allowedModesByRole[role].includes(mode);
}
