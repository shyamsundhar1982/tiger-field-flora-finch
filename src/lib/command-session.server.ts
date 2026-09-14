import { getRequest, useSession } from "@tanstack/react-start/server";
import type { CommandRole } from "@/lib/page-access";

const PRODUCTION_SESSION_NAME = "__Host-vyndi-command";
const LOOPBACK_SESSION_NAME = "vyndi-command-local";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type CommandSession = { role?: CommandRole };

function isLoopbackHttp(request: Request | undefined) {
  if (!request) return false;
  try {
    const url = new URL(request.url);
    const loopbackHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]";
    return loopbackHost && url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Server-only legacy compatibility session.
 *
 * Production keeps the host-bound Secure cookie. The non-__Host cookie is
 * available only for an actual loopback HTTP request so isolated browser
 * acceptance can exercise the same session lifecycle without weakening any
 * deployed origin.
 */
export async function getLegacyCommandSession() {
  const password = process.env.COMMAND_PASSWORD;
  if (!password) throw new Error("COMMAND_PASSWORD is not configured on the Worker.");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const sessionPassword = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const loopbackHttp = isLoopbackHttp(getRequest());
  return useSession<CommandSession>({
    name: loopbackHttp ? LOOPBACK_SESSION_NAME : PRODUCTION_SESSION_NAME,
    password: sessionPassword,
    cookie: {
      secure: !loopbackHttp,
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    },
  });
}
