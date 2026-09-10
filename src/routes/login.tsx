import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";

type LoginSearch = {
  returnTo?: string;
  email?: string;
  created?: boolean;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    created: search.created === true || search.created === "true" || search.created === "1",
  }),
  component: LoginPage,
});

const BEARER_KEY = "grok-auth.bearer-token";

function safeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/command";
  try {
    const destination = new URL(value, "https://vyndi.local");
    if (destination.origin !== "https://vyndi.local") return "/command";
    if (destination.pathname === "/inventory" || destination.pathname.startsWith("/command")) {
      return destination.pathname;
    }
  } catch {
    // Invalid or external return targets always fall back to Command Centre.
  }
  return "/command";
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      // Keep the Better Auth client out of the server-render path. This page is
      // shared by Node/Vercel and Cloudflare Workers, while authentication itself
      // is only required after the browser submits the form.
      const { authClient } = await import("@/lib/auth/client");
      const normalizedEmail = email.trim().toLowerCase();
      const result = await authClient.signIn.email(
        { email: normalizedEmail, password },
        {
          onSuccess(ctx) {
            if (!window.location.hostname.endsWith(".grok-sandbox.com")) return;
            const token = ctx.response.headers.get("set-auth-token");
            if (token) window.sessionStorage.setItem(BEARER_KEY, token);
          },
        },
      );
      if (result.error) {
        setError(result.error.message ?? "Sign-in failed.");
        return;
      }
      try {
        await authClient.getSession();
      } catch {
        // The preview bearer is used only inside the embedded sandbox. Deployed
        // hosts authenticate through their first-party HttpOnly cookie.
      }

      const destination = safeReturnTo(search.returnTo);
      await navigate({ to: destination as never });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-400">VINDY</p>
        <h1 className="mt-3 text-3xl font-semibold">Secure sign in</h1>
        <p className="mt-2 text-sm text-white/60">Individual account access for the VINDY operating system.</p>
        {search.created ? (
          <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
            Account created successfully. Sign in with the new credentials to continue.
          </p>
        ) : null}
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm text-white/70">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-orange-400" /></label>
          <label className="block text-sm text-white/70">Password<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-orange-400" /></label>
          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-6 text-xs text-white/45">Accounts and permissions are managed individually. Never share passwords.</p>
        <Link to="/" className="mt-6 inline-block text-sm text-orange-300 hover:text-orange-200">← Back</Link>
      </div>
    </main>
  );
}
