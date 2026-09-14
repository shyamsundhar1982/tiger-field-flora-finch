// @ts-check
/**
 * The sign-out sequence used by `src/lib/auth/client.ts`, kept here as a pure
 * module so its effects can be unit-tested (`node --test` only covers
 * `scripts/`), the same split `migration-plan.mjs` uses for the two appliers.
 *
 * The two environments authenticate differently, so they need different
 * answers to "the server did not reply":
 *
 * - **Live preview / loopback acceptance** — bearer transport may be used, but
 *   loopback can also carry a real Better Auth cookie. Therefore every logout
 *   must attempt the server-side sign-out before clearing local bearer state.
 *   The request is best effort and bounded so a wedged preview request cannot
 *   strand the button.
 * - **Deployed** — the session rides an HttpOnly `__Host-` cookie that JS
 *   cannot delete. ONLY a completed sign-out response clears it, and
 *   `server.ts` enables `session.cookieCache`, so `/get-session` may otherwise
 *   keep answering from cached state. Redirecting on a timeout would show the
 *   visitor "signed out" while their session is still live — so here we fail
 *   loudly instead of pretending.
 */

export const PREVIEW_SIGN_OUT_TIMEOUT_MS = 1500;
export const DEPLOYED_SIGN_OUT_TIMEOUT_MS = 10_000;

export function signOutTimeoutMs(livePreview) {
  return livePreview ? PREVIEW_SIGN_OUT_TIMEOUT_MS : DEPLOYED_SIGN_OUT_TIMEOUT_MS;
}

export function settleWithin(start, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    const done = (outcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    try {
      Promise.resolve(start()).then(
        () => done("ok"),
        () => done("failed"),
      );
    } catch {
      done("failed");
    }
  });
}

export async function runSignOut({
  livePreview,
  requestSignOut,
  clearToken,
  redirect,
  timeoutMs,
}) {
  if (livePreview) {
    await settleWithin(requestSignOut, timeoutMs ?? signOutTimeoutMs(livePreview));
    clearToken();
    redirect();
    return;
  }

  const outcome = await settleWithin(requestSignOut, timeoutMs ?? signOutTimeoutMs(livePreview));
  if (outcome !== "ok") {
    throw new Error(
      outcome === "timeout"
        ? "Sign-out timed out — you are still signed in. Please try again."
        : "Sign-out failed — you are still signed in. Please try again.",
    );
  }
  clearToken();
  redirect();
}

export async function runPreSignInSignOut({
  livePreview,
  requestSignOut,
  clearToken,
  timeoutMs,
}) {
  await settleWithin(requestSignOut, timeoutMs ?? signOutTimeoutMs(livePreview));
  clearToken();
}
