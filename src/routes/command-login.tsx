import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { unlockCommand } from "@/lib/command-access";

export const Route = createFileRoute("/command-login")({ component: CommandLogin });

function CommandLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const identity = username.trim();

      // VINDY-managed individual users are Better Auth accounts. The previous
      // command-login screen only checked the legacy COMMAND_* environment
      // passwords, so newly created VINDY users could never authenticate here
      // even though their Better Auth credentials were valid.
      if (identity.includes("@")) {
        const normalizedEmail = identity.toLowerCase();
        const result = await authClient.signIn.email({
          email: normalizedEmail,
          password,
        });

        if (result.error) {
          setError(result.error.message ?? "Incorrect email or password.");
          return;
        }

        // The server resolves the user's VINDY role from vindy_user_roles on
        // the authenticated Better Auth session. No legacy command password is
        // created or required for individual users.
        await navigate({ to: "/command" });
        return;
      }

      // Preserve the existing legacy admin/role login path for installations
      // that still use COMMAND_PASSWORD and COMMAND_*_PASSWORD values.
      const result = await unlockCommand({ data: { username: identity, password } });
      if (!result.ok) {
        setError(result.error ?? "Access denied.");
        return;
      }
      await navigate({ to: "/command" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify access. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-16 text-fg sm:px-6">
      <div className="mx-auto flex min-h-[70dvh] max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-border bg-bg/90 p-8 shadow-2xl">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-accent/40 text-accent">
              <LockKeyhole className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">VYNDI BIKES</p>
              <h1 className="text-2xl font-semibold tracking-tight">Command Access</h1>
            </div>
          </div>

          <p className="mb-6 text-sm leading-6 text-muted">
            Admin has full control. Individual VINDY users sign in with their own email and password and receive the role assigned by Admin.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Email or Username</span>
              <input autoFocus type="text" value={username} onChange={(event) => setUsername(event.target.value)} className="control w-full" placeholder="name@company.com or admin" autoComplete="username" disabled={busy} />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control w-full" placeholder="Enter password" autoComplete="current-password" disabled={busy} />
            </label>

            {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}

            <button type="submit" disabled={busy || !username || !password} className="w-full rounded-lg border border-accent bg-accent px-4 py-3 text-sm font-semibold text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Verifying…" : "Enter Command"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
