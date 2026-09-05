/**
 * Local email/password authentication for the app's own Better Auth database.
 *
 * This is intentionally the only switch for email/password auth. The pre-wired
 * Better Auth server reads this flag and already has the required
 * `account.password` schema column.
 */
export const emailAndPasswordEnabled = true;
