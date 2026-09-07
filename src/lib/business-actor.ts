import { getCommandRole } from "@/lib/command-access";
import { requireUserId } from "@/lib/auth/verify.server";
import { canPerform, type CommandPermission, type CommandRole } from "@/lib/page-access";

export type BusinessActor = { userId: string; role: CommandRole };

/**
 * Critical business mutations require a stable Better Auth identity in addition
 * to the VINDY role. This deliberately prevents the legacy shared-password
 * compatibility session from creating new order/plan/inventory commitments.
 */
export async function requireBusinessActor(permission: CommandPermission): Promise<BusinessActor> {
  const [role, userId] = await Promise.all([getCommandRole(), requireUserId()]);
  if (!role || !canPerform(role, permission)) {
    throw new Error(`Business ${permission} permission denied.`);
  }
  return { userId, role };
}
