import { createMiddleware } from "@tanstack/react-start";

async function forwardBearer(next: (args: { sendContext: { bearerToken?: string } }) => Promise<unknown>) {
  const { getBearerToken } = await import("./client");
  return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
}

/**
 * Required auth transport for business mutations. The client forwards the
 * session bearer token when one is available (including rotating Vercel preview
 * hosts); the server verifies that token or the same-origin cookie and exposes
 * one stable verified identity to the handler.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => forwardBearer(next))
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { getSessionUser, UnauthorizedError } = await import("./verify.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken);
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
    const user = await getSessionUser(context.bearerToken);
    return next({
      context: {
        userId: user?.id,
        userEmail: user?.email ?? null,
      },
    });
  });
