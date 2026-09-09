import { getSql } from "@/lib/db";
import type { CommandRole } from "@/lib/page-access";

function getBootstrapAdminEmails(): string[] {
  return (process.env.VINDY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve the role assigned to one verified Better Auth identity.
 *
 * This is intentionally a plain server helper rather than a createServerFn so
 * mutation authorities can resolve identity + role inside one request context.
 */
export async function getAssignedCommandRole(
  userId: string,
  email?: string | null,
): Promise<CommandRole | null> {
  const sql = await getSql();
  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail && getBootstrapAdminEmails().includes(normalizedEmail)) {
    await sql`
      insert into vindy_user_roles (user_id, role) values (${userId}, 'admin')
      on conflict (user_id) do update set role = 'admin', updated_at = now()
    `;
    return "admin";
  }

  const rows = await sql<{ role: string }>`
    select role from vindy_user_roles where user_id = ${userId} limit 1
  `;
  return (rows[0]?.role as CommandRole | undefined) ?? null;
}
