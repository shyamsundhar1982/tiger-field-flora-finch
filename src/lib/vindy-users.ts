import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CommandRole } from "@/lib/page-access";
import { getCommandRole } from "@/lib/command-access";
import { getSessionUser } from "@/lib/auth/verify.server";
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
  const user = await getSessionUser();
  const role = await getCommandRole();
  return { id: user?.id ?? null, email: user?.email ?? null, role: isRole(role) ? role : null };
});

export const listVindyUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sql = await getSql();
  return sql<{ id: string; name: string | null; email: string | null; role: string | null; created_at: string }[]>`
    select u.id, u.name, u.email, r.role, u."createdAt" as created_at
    from "user" u
    left join vindy_user_roles r on r.user_id = u.id
    order by u."createdAt" desc
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
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();

    const existing = await sql<{ id: string }[]>`
      select id from "user" where lower(email) = ${email} limit 1
    `;
    if (existing[0]) throw new Error("An account with this email already exists.");

    const result = await auth.api.signUpEmail({
      body: { name, email, password: data.password },
    }) as { user?: { id?: string; name?: string | null; email?: string | null; createdAt?: string | Date } | null };

    const userId = result.user?.id;
    if (!userId) throw new Error("Account was not created.");

    await sql`
      insert into vindy_user_roles (user_id, role) values (${userId}, ${data.role})
      on conflict (user_id) do update set role = excluded.role, updated_at = now()
    `;

    const created = await sql<{ id: string; name: string | null; email: string | null; role: string; created_at: string }[]>`
      select u.id, u.name, u.email, r.role, u."createdAt" as created_at
      from "user" u
      join vindy_user_roles r on r.user_id = u.id
      where u.id = ${userId}
      limit 1
    `;
    if (!created[0]) throw new Error("Account was created but could not be verified in the user register.");

    return { ok: true, user: created[0] };
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

export const deleteVindyUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const current = await getSessionUser();
    if (current?.id === data.userId) throw new Error("You cannot delete the account currently in use.");

    const sql = await getSql();
    const existing = await sql<{ id: string }[]>`
      select id from "user" where id = ${data.userId} limit 1
    `;
    if (!existing[0]) throw new Error("User account was not found.");

    await sql`delete from vindy_user_roles where user_id = ${data.userId}`;
    await sql`delete from "user" where id = ${data.userId}`;
    return { ok: true, userId: data.userId };
  });
