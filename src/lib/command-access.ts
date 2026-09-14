import { createServerFn } from "@tanstack/react-start";
import type { CommandRole } from "@/lib/page-access";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getAssignedCommandRole } from "@/lib/command-user-role.server";

type CommandAuthContext = {
  userId?: string;
  userEmail?: string | null;
};

async function resolveCommandAuthorization(
  context: CommandAuthContext,
): Promise<{ access: boolean; role: CommandRole | null }> {
  if (!context.userId) return { access: false, role: null };

  const role = (await getAssignedCommandRole(context.userId, context.userEmail)) ?? "viewer";
  return { access: true, role };
}

/**
 * Command is governed exclusively by an individually verified Better Auth
 * identity. There is no shared-password/legacy session fallback: an anonymous
 * request has no Command access, while an authenticated identity resolves its
 * persisted VYNDI role (defaulting to viewer until explicitly assigned).
 */
export const getCommandAuthorization = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => resolveCommandAuthorization(context));

export const getCommandRole = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => (await resolveCommandAuthorization(context)).role);

export const getCommandIdentity = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => ({
    individual: Boolean(context.userId),
    email: context.userEmail ?? null,
  }));

export const getCommandAccess = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => (await resolveCommandAuthorization(context)).access);
