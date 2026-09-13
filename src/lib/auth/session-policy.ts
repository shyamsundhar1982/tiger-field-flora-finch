export const SESSION_EXPIRES_IN_SECONDS = 24 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60;
export const SESSION_COOKIE_CACHE_MAX_AGE_SECONDS = 60;

/**
 * VYNDI production session policy.
 *
 * Sessions expire after 24 hours instead of Better Auth's longer default.
 * Sliding refresh is limited to once per hour. Cookie-cached session state is
 * kept to one minute so server-side revocation or role/session changes become
 * effective quickly without disabling the cache entirely.
 */
export const VYNDI_SESSION_POLICY = {
  expiresIn: SESSION_EXPIRES_IN_SECONDS,
  updateAge: SESSION_UPDATE_AGE_SECONDS,
  cookieCache: {
    enabled: true,
    maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
  },
} as const;
