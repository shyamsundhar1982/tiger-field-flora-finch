import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Better Auth can persist a successful sign-in before TanStack Start forwards
 * its pending session cookie. On Worker runtimes the Response returned by the
 * auth handler can carry an immutable header guard, which prevents the final
 * cookie handoff and turns a valid sign-in into a generic HTTP 500.
 *
 * Re-wrap the handler result with a fresh Headers object at the route boundary.
 * This preserves status/body/header values while guaranteeing that TanStack's
 * response finalization may append Set-Cookie. Keep this compatibility shim
 * outside src/lib/auth/* so the prewired authentication infrastructure remains
 * untouched.
 */
async function handleAuthRequest(request: Request): Promise<Response> {
  const response = await auth.handler(request);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

/**
 * Better Auth catch-all endpoint.
 *
 * This route is required for all Better Auth operations, including
 * email/password sign-in for VINDY-managed users.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
