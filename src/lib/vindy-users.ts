import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CommandRole } from "@/lib/page-access";
import { auth } from "@/lib/auth/server";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const roles: CommandRole[] = ["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"];
const isRole = (value: unknown): value is CommandRole => typeof value === "string" && roles.includes(value as CommandRole);

async function currentRole(userId: string, email?: string | null): Promise<CommandRole | null> {
  const sql = await getSql();
  const rows = await sql<{ role: string }[]>`select role from vindy_user_roles where user_id = ${userId} limit 1`;
  if (rows[0] && isRole(rows[0].role)) return rows[0].role;
  const bootstrapEmails = (process.env.VINDY_ADMIN_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  return email && bootstrapEmails.includes(email.toLowerCase()) ? "admin" : null;
}

async function actor(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql<{ email: string | null }[]>`select email from "user" where id = ${userId} limit 1`;
  return { email: rows[0]?.email ?? null, role: await currentRole(userId, rows[0]?.email) };
}

export const getVindyUserContext = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const sql = await getSql();
  const me = await actor(sql, context.userId);
  return { id: context.userId, email: me.email, role: me.role };
});

export const listVindyUsers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const sql = await getSql();
  const me = await actor(sql, context.userId);
  if (me.role !== "admin") throw new Error("Admin access is required.");
  return sql<{ id: string; name: string | null; email: string | null; role: string | null; created_at: string }[]>`
    select u.id, u.name, u.email, r.role, u.created_at
    from "user" u left join vindy_user_roles r on r.user_id = u.id
    order by u.created_at asc
  `;
});

export const createVindyUser = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(128),
    role: z.enum(["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"]),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await actor(sql, context.userId);
    if (me.role !== "admin") throw new Error("Admin access is required.");

    const result = await auth.api.signUpEmail({
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
      },
    }) as { user?: { id?: string } | null };

    const userId = result.user?.id;
    if (!userId) throw new Error("Account was not created.");

    await sql`
      insert into vindy_user_roles (user_id, role) values (${userId}, ${data.role})
      on conflict (user_id) do update set role = excluded.role, updated_at = now()
    `;

    return { ok: true, userId };
  });

export const setVindyUserRole = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(z.object({ userId: z.string().min(1).max(200), role: z.enum(["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"]) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await actor(sql, context.userId);
    if (me.role !== "admin") throw new Error("Admin access is required.");
    await sql`
      insert into vindy_user_roles (user_id, role) values (${data.userId}, ${data.role})
      on conflict (user_id) do update set role = excluded.role, updated_at = now()
    `;
    return { ok: true };
  });
