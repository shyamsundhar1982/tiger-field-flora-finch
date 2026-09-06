import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createVindyUser, deleteVindyUser, getVindyUserContext, listVindyUsers, resetVindyUserPassword, setVindyUserRole } from "@/lib/vindy-users";
import type { CommandRole } from "@/lib/page-access";

export const Route = createFileRoute("/command/users")({ component: UsersPage });

const roles: CommandRole[] = ["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"];

type VindyUser = { id: string; name: string | null; email: string | null; role: string | null; created_at: string };

function UsersPage() {
  const [me, setMe] = useState<{ id: string | null; role: CommandRole | null } | null>(null);
  const [users, setUsers] = useState<VindyUser[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [resettingId, setResettingId] = useState("");
  const [resetUser, setResetUser] = useState<VindyUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "viewer" as CommandRole });

  async function refresh() {
    try {
      setError("");
      const context = await getVindyUserContext();
      setMe(context);
      if (context?.role === "admin") setUsers(await listVindyUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function changeRole(userId: string, role: CommandRole) {
    try {
      setError("");
      await setVindyUserRole({ data: { userId, role } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role.");
    }
  }

  async function createUser() {
    try {
      setCreating(true);
      setError("");
      const result = await createVindyUser({ data: form });
      setUsers((current) => [result.user as VindyUser, ...current.filter((user) => user.id !== result.user.id)]);
      setForm({ name: "", email: "", password: "", role: "viewer" });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user.");
    } finally {
      setCreating(false);
    }
  }

  async function resetPasswordForUser() {
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setError("The passwords do not match.");
      return;
    }
    try {
      setResettingId(resetUser.id);
      setError("");
      await resetVindyUserPassword({ data: { userId: resetUser.id, password: resetPassword } });
      setResetUser(null);
      setResetPassword("");
      setResetPasswordConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setResettingId("");
    }
  }

  async function deleteUser(user: VindyUser) {
    if (user.id === me?.id) return;
    if (!window.confirm(`Delete the account for ${user.name || user.email || user.id}? This removes the account and its VINDY role assignment.`)) return;
    try {
      setDeletingId(user.id);
      setError("");
      await deleteVindyUser({ data: { userId: user.id } });
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete user.");
    } finally {
      setDeletingId("");
    }
  }

  if (me?.role !== "admin") return <div className="p-8"><h1 className="text-2xl font-semibold text-slate-950">User Access</h1><p className="mt-2 text-sm font-medium text-slate-700">Administrator access is required.</p>{error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}</div>;

  return (
    <main className="space-y-6 p-8 text-slate-950">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600">VINDY • IDENTITY</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">User Access Control</h1><p className="mt-2 max-w-3xl text-sm font-medium text-slate-700">Create individual accounts, assign least-privilege roles and maintain auditable access. Hover over the register headers and user ID to see why each field exists and how it is sourced.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => void refresh()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">Refresh</button><button type="button" onClick={() => { setError(""); setShowCreate(true); }} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-orange-400">+ Create user</button></div>
      </header>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

      {showCreate && <section className="rounded-2xl border border-orange-300 bg-orange-50 p-5">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Create VINDY user</h2><p className="mt-1 text-xs font-medium text-slate-700">The password is used only to establish the new account and is not stored in this form.</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-sm font-semibold text-slate-700 hover:text-slate-950">Cancel</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-900">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Full name" /></label>
          <label className="text-sm font-semibold text-slate-900">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="name@company.com" /></label>
          <label className="text-sm font-semibold text-slate-900">Temporary password<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Minimum 8 characters" /></label>
          <label className="text-sm font-semibold text-slate-900">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CommandRole })} className="mt-1.5 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
        </div>
        <div className="mt-5 flex justify-end"><button type="button" disabled={creating || !form.name.trim() || !form.email.trim() || form.password.length < 8} onClick={() => void createUser()} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{creating ? "Creating…" : "Create account"}</button></div>
      </section>}

      <section className="overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[minmax(150px,1.1fr)_minmax(210px,1.4fr)_minmax(260px,1.7fr)_minmax(120px,.7fr)_minmax(130px,.8fr)_minmax(190px,1.2fr)] gap-4 border-b border-slate-300 bg-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-700">
            <span title="Why: identifies the person who owns this account. How derived: Better Auth user.name, stored when the account is created.">User</span>
            <span title="Why: the login identity and duplicate-account control. How derived: Better Auth user.email, normalized to lowercase during creation.">Email</span>
            <span title="Why: this is the stable identity key used by VINDY role assignment and access checks. How derived: Better Auth generates the user.id; it is read back from the authoritative user register.">User ID</span>
            <span title="Why: controls what the account can do. How derived: vindy_user_roles.role assigned by an administrator.">Role</span>
            <span title="Why: provides account provenance. How derived: Better Auth user.createdAt, read from the authoritative user register.">Created</span>
            <span title="Why: account administration actions. Password reset changes the credential without deleting or recreating the user; delete removes the account and its VINDY role assignment.">Action</span>
          </div>
          {users.length === 0 && <div className="px-5 py-10 text-center text-sm font-medium text-slate-600">No VINDY users are registered yet.</div>}
          {users.map((user) => <div key={user.id} className="grid grid-cols-[minmax(150px,1.1fr)_minmax(210px,1.4fr)_minmax(260px,1.7fr)_minmax(120px,.7fr)_minmax(130px,.8fr)_minmax(190px,1.2fr)] items-center gap-4 border-b border-slate-200 px-5 py-4 text-sm">
            <span className="font-semibold text-slate-950">{user.name || "Unnamed user"}</span>
            <span className="break-all font-medium text-slate-700">{user.email || "—"}</span>
            <span title={`Why: stable account reference. How derived: Better Auth user.id created with this account.`} className="break-all font-mono text-xs font-semibold text-slate-800">{user.id}</span>
            <select aria-label={`Role for ${user.name || user.email || user.id}`} value={user.role || "viewer"} onChange={(e) => void changeRole(user.id, e.target.value as CommandRole)} className="rounded-lg border border-slate-400 bg-white px-2 py-2 font-semibold text-slate-950">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
            <span className="font-medium text-slate-700">{new Date(user.created_at).toLocaleDateString()}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={deletingId === user.id || resettingId === user.id} onClick={() => { setError(""); setResetUser(user); setResetPassword(""); setResetPasswordConfirm(""); }} title="Set a new password for this user without deleting the account." className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40">Reset password</button>
              <button type="button" disabled={deletingId === user.id || resettingId === user.id || user.id === me?.id} onClick={() => void deleteUser(user)} title={user.id === me?.id ? "The account currently in use cannot be deleted." : "Delete this user account and its VINDY role assignment."} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">{deletingId === user.id ? "Deleting…" : "Delete"}</button>
            </div>
          </div>)}
        </div>
      </section>

      {resetUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target && !resettingId) setResetUser(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">VINDY • CREDENTIAL</p><h2 id="reset-password-title" className="mt-1 text-xl font-semibold text-slate-950">Reset password</h2><p className="mt-1 text-sm font-medium text-slate-600">Set a new login password for <span className="font-semibold text-slate-900">{resetUser.name || resetUser.email || "this user"}</span>.</p></div>
            <button type="button" disabled={!!resettingId} onClick={() => setResetUser(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-950">Close</button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-900">New password<input autoFocus type="password" autoComplete="new-password" minLength={8} maxLength={128} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Minimum 8 characters" /></label>
            <label className="block text-sm font-semibold text-slate-900">Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={resetPasswordConfirm} onChange={(e) => setResetPasswordConfirm(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Re-enter the new password" /></label>
          </div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={!!resettingId} onClick={() => setResetUser(null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40">Cancel</button><button type="button" disabled={!!resettingId || resetPassword.length < 8 || resetPassword !== resetPasswordConfirm} onClick={() => void resetPasswordForUser()} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{resettingId ? "Resetting…" : "Set new password"}</button></div>
        </section>
      </div>}
    </main>
  );
}
