import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CommandRole } from "@/lib/page-access";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";

const roles: CommandRole[] = [
  "admin",
  "management",
  "board",
  "finance",
  "operations",
  "engineering",
  "qa",
  "compliance",
  "viewer",
];

function isRole(value: unknown): value is CommandRole {
  return typeof value === "string" && roles.includes(value as CommandRole);
}

async function currentRole(userId: string, email?: string | null): Promise<CommandRole | null> {
  const sql = await getSql();
  const rows = await sql<{ role: string }[]>`
    select role from vindy_user_roles where user_id = ${userId} limit 1
  `;
  if (rows[0] && isRole(rows[0].role)) return rows[0].role;

  const bootstrapEmails = (process.env.VINDY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (email && bootstrapEmails.includes(email.toLowerCase())) return "admin";
  return null;
}

export const getVindyUserContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await getSessionUser();
    if (!user || user.id !== context.userId) return null;
    const role = await currentRole(user.id, user.email);
    return { id: user.id, email: user.email, role };
  });

export const listVindyUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await getSessionUser();
    if (!user || user.id !== context.userId) throw new Error("Unauthorized");
    const role = await currentRole(user.id, user.email);
    if (role !== "admin") throw new Error("Admin access is required.");

    const sql = await getSql();
    return sql<{
      id: string;
      name: string | null;
      email: string | null;
      role: string | null;
      created_at: string;
    }[]>`
      select u.id, u.name, u.email, r.role, u.created_at
      from "user" u
      left join vindy_user_roles r on r.user_id = u.id
      order by u.created_at asc
    `;
  });

export const setVindyUserRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1).max(200),
      role: z.enum(["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const actor = await getSessionUser();
    if (!actor || actor.id !== context.userId) throw new Error("Unauthorized");
    const actorRole = await currentRole(actor.id, actor.email);
    if (actorRole !== "admin") throw new Error("Admin access is required.");

    const sql = await getSql();
    await sql`
      insert into vindy_user_roles (user_id, role)
      values (${data.userId}, ${data.role})
      on conflict (user_id) do update
      set role = excluded.role, updated_at = now()
    `;
    return { ok: true };
  });
