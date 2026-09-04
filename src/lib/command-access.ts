import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "cloudflare:workers";

const SESSION_NAME = "__Host-vyndi-command";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type CommandRole = "admin" | "viewer";
type CommandSession = { role?: CommandRole };

type CommandEnv = {
  COMMAND_PASSWORD?: string;
  user?: string;
};

function getCommandEnv() {
  return env as unknown as CommandEnv;
}

async function getCommandSession() {
  const password = getCommandEnv().COMMAND_PASSWORD;
  if (!password) {
    throw new Error("COMMAND_PASSWORD is not configured on the Worker.");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password),
  );
  const sessionPassword = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const { useSession } = await import("@tanstack/react-start/server");
  return useSession<CommandSession>({
    name: SESSION_NAME,
    password: sessionPassword,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    },
  });
}

export const getCommandRole = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getCommandSession();
    return session.data.role ?? null;
  },
);

export const getCommandAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getCommandSession();
    return session.data.role != null;
  },
);

export const unlockCommand = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z.string().min(1).max(100),
      password: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const { COMMAND_PASSWORD: adminPassword, user: viewerPassword } =
      getCommandEnv();

    if (!adminPassword) {
      return {
        ok: false,
        role: null,
        error: "Command access is not configured.",
      };
    }

    let role: CommandRole | null = null;
    if (data.username === "admin" && data.password === adminPassword) {
      role = "admin";
    }
    if (data.username === "user" && viewerPassword && data.password === viewerPassword) {
      role = "viewer";
    }

    if (!role) {
      return { ok: false, role: null, error: "Incorrect username or password." };
    }

    const session = await getCommandSession();
    await session.update({ role }, { maxAge: SESSION_MAX_AGE });
    return { ok: true, role, error: null };
  });

export const lockCommand = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await getCommandSession();
    await session.clear();
    return { ok: true };
  },
);
