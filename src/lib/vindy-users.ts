import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { CommandRole } from "@/lib/page-access";
import { getCommandRole } from "@/lib/command-access";
import { getSessionUser } from "@/lib/auth/verify.server";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const roles: CommandRole[] = ["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"];
const isRole = (value: unknown): value is CommandRole => typeof value === "string" && roles.includes(value as CommandRole);

function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return (process.env.VINDY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

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

async function ensureCredentialPassword(sql: Awaited<ReturnType<typeof getSql>>, userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const credentials = await sql<{ id: string; account_id: string; password: string | null }[]>`
    select id, "accountId" as account_id, password
    from "account"
    where "userId" = ${userId} and "providerId" = 'credential'
    order by "createdAt" asc
  `;

  // Better Auth resolves email/password identities through the credential
  // account. Older VINDY provisioning attempts could leave more than one
  // credential row behind; that makes the password lookup nondeterministic.
  // Keep exactly one canonical credential row per user.
  const credential = credentials[0];
  if (credential) {
    await sql`
      update "account"
      set "accountId" = ${userId}, "password" = ${passwordHash}, "updatedAt" = now()
      where id = ${credential.id}
    `;

    if (credentials.length > 1) {
      const duplicateIds = credentials.slice(1).map((row) => row.id);
      await sql`
        delete from "account"
        where "userId" = ${userId}
          and "providerId" = 'credential'
          and id = any(${duplicateIds}::text[])
      `;
    }
  } else {
    await sql`
      insert into "account" (
        "id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"
      ) values (
        ${randomUUID()}, ${userId}, 'credential', ${userId}, 'credential', now(), now()
      )
    `;
    await sql`
      update "account"
      set "password" = ${passwordHash}, "updatedAt" = now()
      where "userId" = ${userId} and "providerId" = 'credential'
    `;
  }

  // Verify the exact single credential row we just canonicalized before
  // reporting success. Never expose the password or hash to the client.
  const verified = await sql<{ id: string; account_id: string; password: string | null }[]>`
    select id, "accountId" as account_id, password
    from "account"
    where "userId" = ${userId} and "providerId" = 'credential'
    order by "updatedAt" desc
  `;
  if (verified.length !== 1 || verified[0].account_id !== userId) {
    throw new Error("Password reset could not be verified against the credential store.");
  }
  const storedPassword = verified[0].password;
  if (!storedPassword || !(await verifyPassword({ hash: storedPassword, password }))) {
    throw new Error("Password reset could not be verified against the credential store.");
  }
}

async function verifyWithBetterAuth(sql: Awaited<ReturnType<typeof getSql>>, userId: string, password: string) {
  const user = await sql<{ email: string | null }[]>`
    select email from "user" where id = ${userId} limit 1
  `;
  const email = user[0]?.email?.trim().toLowerCase();
  if (!email) throw new Error("Credential verification could not find the user's email.");

  // Exercise the same Better Auth sign-in path used by the browser. This is
  // deliberately stronger than verifying the hash directly: Better Auth first
  // resolves the user by email, selects the credential account, verifies the
  // password, and then creates a session. A successful result proves that the
  // persisted VINDY identity is compatible with the real authentication path.
  let result: { token?: string; user?: { id?: string } };
  try {
    result = await auth.api.signInEmail({
      body: { email, password },
    }) as { token?: string; user?: { id?: string } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Better Auth error";
    throw new Error(`Better Auth rejected the VINDY credential: ${message}`);
  }

  if (result.user?.id !== userId || !result.token) {
    throw new Error("Better Auth authenticated the credential but returned an unexpected user/session.");
  }

  // signInEmail creates a real session as part of its normal contract. This
  // diagnostic must never leave an administrator-created session behind.
  await sql`delete from "session" where token = ${result.token}`;
}

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
    }) as { user?: { id?: string } | null };
    const userId = result.user?.id;
    if (!userId) throw new Error("Account was not created.");

    await ensureCredentialPassword(sql, userId, data.password);
    await verifyWithBetterAuth(sql, userId, data.password);
    await sql`
      insert into vindy_user_roles (user_id, role) values (${userId}, ${data.role})
      on conflict (user_id) do update set role = excluded.role, updated_at = now()
    `;

    const created = await sql<{ id: string; name: string | null; email: string | null; role: string; created_at: string }[]>`
      select u.id, u.name, u.email, r.role, u."createdAt" as created_at
      from "user" u join vindy_user_roles r on r.user_id = u.id
      where u.id = ${userId} limit 1
    `;
    if (!created[0]) throw new Error("Account was created but could not be verified in the user register.");
    return { ok: true, user: created[0] };
  });

export const resetVindyUserPassword = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1).max(200), password: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const existing = await sql<{ id: string }[]>`
      select id from "user" where id = ${data.userId} limit 1
    `;
    if (!existing[0]) throw new Error("User account was not found.");
    await ensureCredentialPassword(sql, data.userId, data.password);
    await verifyWithBetterAuth(sql, data.userId, data.password);
    return { ok: true };
  });

export const setVindyUserRole = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1).max(200), role: z.enum(["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"]) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const target = await sql<{ email: string | null }[]>`
      select email from "user" where id = ${data.userId} limit 1
    `;
    if (!target[0]) throw new Error("User account was not found.");
    if (isBootstrapAdminEmail(target[0].email) && data.role !== "admin") {
      throw new Error("The configured bootstrap administrator cannot be downgraded.");
    }
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
    const target = await sql<{ email: string | null }[]>`
      select email from "user" where id = ${data.userId} limit 1
    `;
    if (!target[0]) throw new Error("User account was not found.");
    if (isBootstrapAdminEmail(target[0].email)) {
      throw new Error("The configured bootstrap administrator cannot be deleted.");
    }
    await sql`delete from vindy_user_roles where user_id = ${data.userId}`;
    await sql`delete from "user" where id = ${data.userId}`;
    return { ok: true, userId: data.userId };
  });
