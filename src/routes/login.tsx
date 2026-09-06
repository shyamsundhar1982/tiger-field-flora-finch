import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed.");
      setBusy(false);
      return;
    }
    await navigate({ to: "/command" });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-400">VINDY</p>
        <h1 className="mt-3 text-3xl font-semibold">Secure sign in</h1>
        <p className="mt-2 text-sm text-white/60">Individual account access for the VINDY operating system.</p>
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
