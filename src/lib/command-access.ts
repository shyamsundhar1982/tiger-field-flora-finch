import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
 * identity. Anonymous requests have no Command access; an authenticated
 * identity resolves its persisted VYNDI role, defaulting to viewer until an
 * administrator explicitly assigns another role.
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

/**
 * Compatibility endpoint retained only so an old /command-login bundle cannot
 * fail at import time. Shared Command credentials are retired: this endpoint
 * never creates a session and never grants a role.
 */
export const unlockCommand = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }))
  .handler(async () => ({
    ok: false as const,
    role: null,
    error: "Legacy Command access is retired. Use the individual VYNDI sign in.",
  }));

/** No legacy session exists anymore; retained as a harmless compatibility no-op. */
export const lockCommand = createServerFn({ method: "POST" }).handler(async () => ({ ok: true as const }));
