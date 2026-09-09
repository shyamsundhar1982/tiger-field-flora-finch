import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CommandRole } from "@/lib/page-access";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getAssignedCommandRole } from "@/lib/command-user-role.server";

const SESSION_NAME = "__Host-vyndi-command";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type CommandSession = { role?: CommandRole };

type CommandEnv = {
  COMMAND_PASSWORD?: string;
  COMMAND_MANAGEMENT_PASSWORD?: string;
  COMMAND_BOARD_PASSWORD?: string;
  COMMAND_FINANCE_PASSWORD?: string;
  COMMAND_OPERATIONS_PASSWORD?: string;
  COMMAND_ENGINEERING_PASSWORD?: string;
  COMMAND_QA_PASSWORD?: string;
  COMMAND_COMPLIANCE_PASSWORD?: string;
  user?: string;
};

const roleCredentials: Array<{
  username: string;
  role: Exclude<CommandRole, "admin" | "viewer">;
  envKey: keyof CommandEnv;
}> = [
  { username: "management", role: "management", envKey: "COMMAND_MANAGEMENT_PASSWORD" },
  { username: "board", role: "board", envKey: "COMMAND_BOARD_PASSWORD" },
  { username: "finance", role: "finance", envKey: "COMMAND_FINANCE_PASSWORD" },
  { username: "operations", role: "operations", envKey: "COMMAND_OPERATIONS_PASSWORD" },
  { username: "engineering", role: "engineering", envKey: "COMMAND_ENGINEERING_PASSWORD" },
  { username: "qa", role: "qa", envKey: "COMMAND_QA_PASSWORD" },
  { username: "compliance", role: "compliance", envKey: "COMMAND_COMPLIANCE_PASSWORD" },
];

function getCommandEnv(): CommandEnv {
  return process.env as CommandEnv;
}

async function getLegacySession() {
  const password = getCommandEnv().COMMAND_PASSWORD;
  if (!password) throw new Error("COMMAND_PASSWORD is not configured on the Worker.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const sessionPassword = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const { useSession: getServerSession } = await import("@tanstack/react-start/server");
  return getServerSession<CommandSession>({
    name: SESSION_NAME,
    password: sessionPassword,
    cookie: { secure: true, httpOnly: true, sameSite: "lax", maxAge: SESSION_MAX_AGE, path: "/" },
  });
}

async function getLegacyRole(): Promise<CommandRole | null> {
  try {
    const session = await getLegacySession();
    return session.data.role ?? null;
  } catch (error) {
    console.warn("Legacy command session lookup failed; continuing with Better Auth.", error);
    return null;
  }
}

/**
 * Individual Better Auth identity and its assigned VYNDI role are one authority
 * boundary. A stale shared-password cookie must never elevate or otherwise
 * change an authenticated individual's role. Legacy role lookup is permitted
 * only when no individual identity exists.
 */
export const getCommandRole = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    if (context.userId) {
      return (await getAssignedCommandRole(context.userId, context.userEmail)) ?? "viewer";
    }
    return getLegacyRole();
  });

export const getCommandAccess = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    if (context.userId) return true;
    return Boolean(await getLegacyRole());
  });

export const unlockCommand = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const env = getCommandEnv();
    if (!env.COMMAND_PASSWORD) return { ok: false, role: null, error: "Command access is not configured." };
    let role: CommandRole | null = null;
    if (data.username === "admin" && data.password === env.COMMAND_PASSWORD) role = "admin";
    else if (data.username === "user" && env.user && data.password === env.user) role = "viewer";
    else {
      const credential = roleCredentials.find((item) => item.username === data.username);
      if (credential && env[credential.envKey] && data.password === env[credential.envKey]) role = credential.role;
    }
    if (!role) return { ok: false, role: null, error: "Incorrect username or password." };
    const session = await getLegacySession();
    await session.update({ role });
    return { ok: true, role, error: null };
  });

export const lockCommand = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getLegacySession();
  await session.clear();
  return { ok: true };
});
