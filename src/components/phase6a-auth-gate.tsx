import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { bootstrapPhase6AFounder } from "@/lib/operations/phase6a";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthoritativeErp } from "./authoritative-erp";

export function Phase6AAuthGate() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (isPending) return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Checking secure session…</div>;
  if (user) return <AuthoritativeErp />;

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
        if (result.error) throw new Error(result.error.message ?? "Account creation failed");
      } else {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error(result.error.message ?? "Sign-in failed");
      }
      try {
        await bootstrapPhase6AFounder();
      } catch {
        // Existing users with assigned roles continue normally; only the first
        // account needs the one-time founder bootstrap.
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">VELOXIS · secure operations</p>
      <h1 className="mt-2 font-display text-3xl">{mode === "signup" ? "Create Founder Account" : "Sign in to ERP"}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Phase 6A uses the app's own database-backed authentication. No external OAuth credentials are required for this operating console.</p>
      <div className="mt-6 space-y-3">
        {mode === "signup" && <input className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" placeholder="Your name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />}
        <input className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" placeholder="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" placeholder="Password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} />
        {message && <div className="rounded-md border border-border p-3 text-sm text-muted">{message}</div>}
        <button type="button" disabled={busy || !email || password.length < 8 || (mode === "signup" && !name.trim())} onClick={() => void submit()} className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button type="button" disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium">
          {mode === "signin" ? "Create the first account" : "I already have an account"}
        </button>
      </div>
    </div>
  );
}
