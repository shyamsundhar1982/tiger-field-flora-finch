import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SESSION_NAME = "__Host-vyndi-command";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type CommandSession = { unlocked?: boolean };

async function getCommandSession() {
  const password = process.env.COMMAND_PASSWORD;
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
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    },
  });
}

export const getCommandAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getCommandSession();
    return session.data.unlocked === true;
  },
);

export const unlockCommand = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const configuredPassword = process.env.COMMAND_PASSWORD;
    if (!configuredPassword) {
      return { ok: false, error: "Command access is not configured." };
    }

    if (data.password !== configuredPassword) {
      return { ok: false, error: "Incorrect password." };
    }

    const session = await getCommandSession();
    await session.update({ unlocked: true }, { maxAge: SESSION_MAX_AGE });
    return { ok: true, error: null };
  });

export const lockCommand = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await getCommandSession();
    await session.clear();
    return { ok: true };
  },
);
