import { getCommandRole } from "@/lib/command-access";
import { getSessionUser, requireUserId } from "@/lib/auth/verify.server";
import { canPerform, type CommandPermission, type CommandRole } from "@/lib/page-access";

export type BusinessActor = { userId: string; role: CommandRole };

/**
 * Read-only advisory exploration may be performed through an authorised legacy
 * Command session. Mutating permissions still require a stable Better Auth
 * identity so a shared-password compatibility session can never create or
 * approve business commitments.
 */
export async function requireBusinessActor(permission: CommandPermission): Promise<BusinessActor> {
  const role = await getCommandRole();
  if (!role || !canPerform(role, permission)) {
    throw new Error(`Business ${permission} permission denied.`);
  }

  if (permission === "view") {
    const user = await getSessionUser();
    return { userId: user?.id ?? `legacy-command:${role}`, role };
  }

  const userId = await requireUserId();
  return { userId, role };
}
