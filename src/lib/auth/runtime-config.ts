export const CLOUDFLARE_PRODUCTION_ORIGIN =
  "https://tiger-field-flora-finch.shyamsundhar1982.workers.dev";

export const AUTH_ALLOWED_HOSTS = [
  "tiger-field-flora-finch.shyamsundhar1982.workers.dev",
  "tiger-field-flora-finch.vercel.app",
  "tiger-field-flora-finch-*.vercel.app",
  "vindy-architecture.vercel.app",
  "vindy-architecture-*.vercel.app",
  "vindy-architecture-the-final3.vercel.app",
  "vindy-architecture-git-main-the-final3.vercel.app",
  "vindy-architecture-*-the-final3.vercel.app",
  "*.grok-sandbox.com",
  "localhost:*",
  "127.0.0.1:*",
  "[::1]:*",
] as const;

export const AUTH_TRUSTED_ORIGINS = [
  CLOUDFLARE_PRODUCTION_ORIGIN,
  "https://tiger-field-flora-finch.vercel.app",
  "https://tiger-field-flora-finch-*.vercel.app",
  "https://vindy-architecture.vercel.app",
  "https://vindy-architecture-*.vercel.app",
  "https://vindy-architecture-the-final3.vercel.app",
  "https://vindy-architecture-git-main-the-final3.vercel.app",
  "https://vindy-architecture-*-the-final3.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
] as const;

export function resolveAuthBaseURL(explicitBaseURL: string | undefined) {
  return {
    allowedHosts: [...AUTH_ALLOWED_HOSTS],
    fallback: explicitBaseURL ?? CLOUDFLARE_PRODUCTION_ORIGIN,
    protocol: "auto" as const,
  };
}

/**
 * A database-backed deployment must use one stable signing secret. Generating
 * a per-process value causes sessions created by one Worker/serverless isolate
 * to be rejected by the next isolate.
 */
export function resolveAuthSecret(options: {
  configuredSecret: string | undefined;
  databaseUrl: string | undefined;
  authDisabled: boolean;
  previewSecret: () => string;
}): string {
  if (options.configuredSecret) return options.configuredSecret;
  if (options.databaseUrl && !options.authDisabled) {
    throw new Error(
      "BETTER_AUTH_SECRET is required when DATABASE_URL is configured and authentication is enabled.",
    );
  }
  return options.previewSecret();
}
