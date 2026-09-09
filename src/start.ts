import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "./lib/auth/middleware";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Every server-function request carries the same optional Better Auth identity.
 * This prevents composed server functions (IBPE -> role lookup, report -> role
 * lookup, inventory -> role lookup, etc.) from losing a preview bearer token
 * and silently degrading an authenticated Admin to viewer/null.
 *
 * CSRF is explicit because defining src/start.ts replaces TanStack Start's
 * automatic default CSRF registration.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [optionalAuthMiddleware],
}));
