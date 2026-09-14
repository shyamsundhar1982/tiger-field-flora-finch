import assert from "node:assert/strict";
import pg from "pg";

const baseURL = process.env.STAGE_D_BASE_URL;
const email = process.env.STAGE_D_USER_EMAIL;
const password = process.env.STAGE_D_USER_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!baseURL) throw new Error("STAGE_D_BASE_URL is required.");
if (!email) throw new Error("STAGE_D_USER_EMAIL is required.");
if (!password) throw new Error("STAGE_D_USER_PASSWORD is required.");
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: baseURL,
  },
  body: JSON.stringify({
    name: "Stage D Acceptance Admin",
    email,
    password,
  }),
});

if (!response.ok) {
  const text = await response.text().catch(() => "");
  throw new Error(
    `Disposable Better Auth user creation failed with HTTP ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`,
  );
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const user = await client.query(
    `select id, email from "user" where lower(email) = lower($1) limit 1`,
    [email],
  );
  assert.equal(user.rows.length, 1, "Disposable Better Auth user was not persisted.");
  const userId = user.rows[0].id;

  await client.query(
    `insert into vindy_user_roles (user_id, role)
     values ($1, 'admin')
     on conflict (user_id) do update set role = excluded.role, updated_at = now()`,
    [userId],
  );

  const role = await client.query(
    `select role from vindy_user_roles where user_id = $1 limit 1`,
    [userId],
  );
  assert.equal(role.rows[0]?.role, "admin", "Disposable Better Auth user did not receive the Stage D admin role.");

  const credential = await client.query(
    `select count(*)::int as count
       from "account"
      where "userId" = $1 and "providerId" = 'credential' and password is not null`,
    [userId],
  );
  assert.equal(credential.rows[0]?.count, 1, "Disposable Better Auth credential account is incomplete.");
} finally {
  await client.end();
}

console.log("[stage-d-auth] disposable individual Better Auth identity is ready");
