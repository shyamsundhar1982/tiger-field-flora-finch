import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await authClient.signUp.email({ name, email, password });
    if (result.error) {
      setError(result.error.message ?? "Account creation failed.");
      setBusy(false);
      return;
    }
    await navigate({ to: "/command" });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-400">VINDY</p>
        <h1 className="mt-3 text-3xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-white/60">New accounts start as Viewer until an administrator assigns a role.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm text-white/70">Name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>
          <label className="block text-sm text-white/70">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>
          <label className="block text-sm text-white/70">Password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" /></label>
          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
        </form>
        <Link to="/login" className="mt-6 inline-block text-sm text-orange-300">Already have an account? Sign in</Link>
      </div>
    </main>
  );
}
