import { getCommandRole } from "@/lib/command-access";
import { getSessionUser, UnauthorizedError } from "@/lib/auth/verify.server";
import { getAssignedCommandRole } from "@/lib/command-user-role.server";
import { canPerform, type CommandPermission, type CommandRole } from "@/lib/page-access";

export type BusinessActor = { userId: string; role: CommandRole };

async function getAssignedBusinessIdentity() {
  const user = await getSessionUser();
  if (!user) return { user: null, role: null as CommandRole | null };
  const role = await getAssignedCommandRole(user.id, user.email);
  return { user, role };
}

export async function getBusinessWriteReadiness() {
  const { user, role } = await getAssignedBusinessIdentity();
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
 * session. Mutating business commitments resolve the verified Better Auth user
 * and that same user's explicit role assignment inside ONE request context.
 * This prevents a readiness GET from succeeding while a later POST loses the
 * identity after a nested server-function role lookup.
 */
export async function requireBusinessActor(permission: CommandPermission): Promise<BusinessActor> {
  if (permission === "view") {
    const { user, role: assignedRole } = await getAssignedBusinessIdentity();
    if (user && assignedRole && canPerform(assignedRole, permission)) {
      return { userId: user.id, role: assignedRole };
    }

    const legacyRole = await getCommandRole();
    if (!legacyRole || !canPerform(legacyRole, permission)) {
      throw new Error(`Business ${permission} permission denied.`);
    }
    return { userId: `legacy-command:${legacyRole}`, role: legacyRole };
  }

  const { user, role } = await getAssignedBusinessIdentity();
  if (!user) throw new UnauthorizedError();
  if (!role || !canPerform(role, permission)) {
    throw new Error(`Business ${permission} permission denied.`);
  }

  return { userId: user.id, role };
}
