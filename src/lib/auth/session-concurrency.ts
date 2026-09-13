export const MAX_ACTIVE_SESSIONS_PER_USER = 5;

export type SessionForConcurrency = {
  token: string;
  createdAt: Date | string;
  expiresAt: Date | string;
};

const millis = (value: Date | string) =>
  value instanceof Date ? value.getTime() : new Date(value).getTime();

/**
 * Return only the older active session tokens that should be revoked.
 *
 * The newly-created session is always retained even if timestamps tie. Expired
 * sessions are ignored here because Better Auth handles their normal cleanup.
 */
export function excessActiveSessionTokens(
  sessions: readonly SessionForConcurrency[],
  currentToken: string,
  now = new Date(),
  maximum = MAX_ACTIVE_SESSIONS_PER_USER,
): string[] {
  if (maximum < 1) return sessions.map((session) => session.token);

  const active = sessions
    .filter((session) => millis(session.expiresAt) > now.getTime())
    .sort((left, right) => {
      if (left.token === currentToken && right.token !== currentToken) return -1;
      if (right.token === currentToken && left.token !== currentToken) return 1;
      return millis(right.createdAt) - millis(left.createdAt);
    });

  return active.slice(maximum).map((session) => session.token);
}
