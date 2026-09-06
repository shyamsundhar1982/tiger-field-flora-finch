import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CommandRole } from "@/lib/page-access";
import { getCommandRole } from "@/lib/command-access";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const roles: CommandRole[] = ["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"];
const isRole = (value: unknown): value is CommandRole => typeof value === "string" && roles.includes(value as CommandRole);

async function requireAdmin() {
  const role = await getCommandRole();
  if (role !== "admin") throw new Error("Admin access is required.");
  return role;
}

export const getVindyUserContext = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  return { id: null, email: null, role: isRole(role) ? role : null };
});

export const listVindyUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sql = await getSql();
  return sql<{ id: string; name: string | null; email: string | null; role: string | null; created_at: string }[]>`
    select u.id, u.name, u.email, r.role, u.created_at
    from "user" u left join vindy_user_roles r on r.user_id = u.id
    order by u.created_at asc
  `;
});

export const createVindyUser = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(128),
    role: z.enum(["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"]),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();

    const sql = await getSql();
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

export const setVindyUserRole = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1).max(200), role: z.enum(["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"]) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    await sql`
      insert into vindy_user_roles (user_id, role) values (${data.userId}, ${data.role})
      on conflict (user_id) do update set role = excluded.role, updated_at = now()
    `;
    return { ok: true };
  });
