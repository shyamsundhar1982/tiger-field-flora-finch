import { createMiddleware } from "@tanstack/react-start";

async function forwardBearer(next: (options?: {
  sendContext?: { bearerToken?: string };
  headers?: HeadersInit;
}) => Promise<unknown>) {
  const { getBearerToken } = await import("./client");
  const token = getBearerToken();
  return next({
    sendContext: { bearerToken: token ?? undefined },
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
}

/**
 * Required auth transport for business mutations. The bearer is sent both in
 * TanStack function context and as the actual Authorization header. The header
 * is important because composed/nested server functions read the ambient
 * request through getRequest(); they must see the same verified identity as the
 * outer function rather than falling back to a legacy or viewer role.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => forwardBearer(next))
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { getSessionUser, UnauthorizedError } = await import("./verify.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context?.bearerToken);
    if (!user) throw new UnauthorizedError();
    return next({ context: { userId: user.id, userEmail: user.email } });
  });

/**
 * Optional auth transport for read-only workspaces. It preserves legacy
 * Command-password viewing when no individual identity exists, while allowing a
 * signed-in Better Auth identity to be recognized through the same bearer/cookie
 * transport used by mutations.
 */
export const optionalAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => forwardBearer(next))
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { getSessionUser } = await import("./verify.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context?.bearerToken);
    return next({
      context: {
        userId: user?.id,
        userEmail: user?.email ?? null,
      },
    });
  });
