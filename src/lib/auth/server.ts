import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session.server";
import { GROK_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
  PREVIEW_CLIENT_SECRET,
} from "./preview";
import { requestSafePostgresPoolConfig } from "../postgres-pool";
import { AUTH_TRUSTED_ORIGINS, resolveAuthBaseURL, resolveAuthSecret } from "./runtime-config";

void ensureDbReady();

const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

function validHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString().replace(/\/$/, "")
      : undefined;
  } catch {
    return undefined;
  }
}

const authDisabled = env("VITE_AUTH_ENABLED") === "false";
const grokIssuer = validHttpUrl(env("GROK_AUTH_ISSUER")) ?? GROK_ISSUER_DEFAULT;
const grokClientId = env("GROK_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
const grokClientSecret = env("GROK_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;

export const authConfigured = !authDisabled && Boolean(grokClientId && grokClientSecret);

const explicitBaseURL = validHttpUrl(env("BETTER_AUTH_URL"));
const previewAllowedHosts: string[] = [...PREVIEW_ALLOWED_HOSTS];
// Resolve the concrete base URL from each incoming request. Cloudflare,
// Vercel production aliases and Vercel previews therefore issue host-local
// cookies and callbacks even if BETTER_AUTH_URL is missing or was scoped to a
// different deployment target.
const baseURL = resolveAuthBaseURL(explicitBaseURL);

const trustedOrigins: string[] = [
  ...AUTH_TRUSTED_ORIGINS,
  ...(explicitBaseURL ? [explicitBaseURL] : []),
  ...previewAllowedHosts,
  ...previewAllowedHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
];

const databaseUrl = env("DATABASE_URL");
const authSecret = resolveAuthSecret({
  configuredSecret: env("BETTER_AUTH_SECRET"),
  databaseUrl,
  authDisabled,
  previewSecret: previewAuthSecret,
});
const issuerBase = grokIssuer.replace(/\/+$/, "");
const grokAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
const grokTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
const grokUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;

const database = databaseUrl
  ? new Pool(requestSafePostgresPoolConfig(databaseUrl))
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

const grokOAuthPlugin = authConfigured
  ? genericOAuth({
      config: GROK_PROVIDERS.map(({ providerId, idp }) => ({
        providerId,
        clientId: grokClientId as string,
        clientSecret: grokClientSecret as string,
        authorizationUrl: grokAuthorizationUrl,
        tokenUrl: grokTokenUrl,
        userInfoUrl: grokUserInfoUrl,
        scopes: ["openid", "profile", "email"],
        authorizationUrlParams: { idp, prompt: "login" },
      })),
    })
  : null;

export const auth = betterAuth({
  baseURL,
  secret: authSecret,
  database,
  trustedOrigins,

  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: [...GROK_PROVIDERS.map((p) => p.providerId), GATE_PROVIDER_ID],
      requireLocalEmailVerified: false,
    },
  },

  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // VINDY administrators create accounts for other people. Creating a user must
  // NEVER sign the administrator into the newly-created account. Better Auth's
  // email/password sign-up auto-signs users in by default; disabling that here
  // prevents the admin session cookie from being replaced during user creation.
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true, autoSignIn: false } } : {}),

  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },

  plugins: [
    gateIdentitySessions(),
    ...(grokOAuthPlugin ? [grokOAuthPlugin] : []),
    bearer(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

export { GROK_PROVIDERS } from "./providers";
