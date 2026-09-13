import { getCommandRole } from "@/lib/command-access";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSessionUser, UnauthorizedError } from "@/lib/auth/verify.server";
import { getAssignedCommandRole } from "@/lib/command-user-role.server";
import { canPerform, type CommandPermission, type CommandRole } from "@/lib/page-access";

export type BusinessActor = { userId: string; role: CommandRole };
export type VerifiedBusinessIdentity = { userId: string; email?: string | null };

async function getAssignedBusinessIdentity(verified?: VerifiedBusinessIdentity) {
  const user = verified
    ? { id: verified.userId, email: verified.email ?? null }
    : await getSessionUser();
  if (!user) return { user: null, role: null as CommandRole | null };
  const role = await getAssignedCommandRole(user.id, user.email);
  return { user, role };
}

export async function getBusinessWriteReadiness(verified?: VerifiedBusinessIdentity) {
  const { user, role } = await getAssignedBusinessIdentity(verified);
  return {
    role,
    signedIn: Boolean(user),
    email: user?.email ?? null,
    canEdit: Boolean(role && canPerform(role, "edit")),
    canApprove: Boolean(role && canPerform(role, "approve")),
  };
}

/**
 * Read-only advisory exploration may still use an authorised legacy Command
 * session. Mutating business commitments require an individually authenticated
 * identity and are same-site validated here so every authority module inherits
 * the CSRF/origin boundary even if it does not repeat the check locally.
 */
export async function requireBusinessActor(
  permission: CommandPermission,
  verified?: VerifiedBusinessIdentity,
): Promise<BusinessActor> {
  if (permission === "view") {
    const { user, role: assignedRole } = await getAssignedBusinessIdentity(verified);
    if (user && assignedRole && canPerform(assignedRole, permission)) {
      return { userId: user.id, role: assignedRole };
    }

    const legacyRole = await getCommandRole();
    if (!legacyRole || !canPerform(legacyRole, permission)) {
      throw new Error(`Business ${permission} permission denied.`);
    }
    return { userId: `legacy-command:${legacyRole}`, role: legacyRole };
  }

  assertSameSiteRequest();
  const { user, role } = await getAssignedBusinessIdentity(verified);
  if (!user) throw new UnauthorizedError();
  if (!role || !canPerform(role, permission)) {
    throw new Error(`Business ${permission} permission denied.`);
  }

  return { userId: user.id, role };
}
