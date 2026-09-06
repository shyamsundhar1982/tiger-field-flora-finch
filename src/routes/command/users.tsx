import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createVindyUser, getVindyUserContext, listVindyUsers, setVindyUserRole } from "@/lib/vindy-users";
import type { CommandRole } from "@/lib/page-access";

export const Route = createFileRoute("/command/users")({ component: UsersPage });

const roles: CommandRole[] = ["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"];

type VindyUser = { id: string; name: string | null; email: string | null; role: string | null; created_at: string };

function UsersPage() {
  const [me, setMe] = useState<{ role: CommandRole | null } | null>(null);
  const [users, setUsers] = useState<VindyUser[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
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
      // Re-read the authoritative register after the immediate UI update.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user.");
    } finally {
      setCreating(false);
    }
  }

  if (me?.role !== "admin") return <div className="p-8"><h1 className="text-2xl font-semibold text-slate-950">User Access</h1><p className="mt-2 text-sm font-medium text-slate-700">Administrator access is required.</p>{error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}</div>;

  return (
    <main className="space-y-6 p-8 text-slate-950">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600">VINDY • IDENTITY</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">User Access Control</h1><p className="mt-2 text-sm font-medium text-slate-700">Create individual accounts, assign least-privilege roles and maintain auditable access.</p></div>
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

      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
        <div className="grid grid-cols-[1.3fr_1.5fr_1fr_1fr] gap-4 border-b border-slate-300 bg-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-700"><span>User</span><span>Email</span><span>Role</span><span>Created</span></div>
        {users.length === 0 && <div className="px-5 py-10 text-center text-sm font-medium text-slate-600">No VINDY users are registered yet.</div>}
        {users.map((user) => <div key={user.id} className="grid grid-cols-[1.3fr_1.5fr_1fr_1fr] items-center gap-4 border-b border-slate-200 px-5 py-4 text-sm"><span className="font-semibold text-slate-950">{user.name || "Unnamed user"}</span><span className="font-medium text-slate-700">{user.email || "—"}</span><select value={user.role || "viewer"} onChange={(e) => void changeRole(user.id, e.target.value as CommandRole)} className="rounded-lg border border-slate-400 bg-white px-2 py-2 font-semibold text-slate-950">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><span className="font-medium text-slate-700">{new Date(user.created_at).toLocaleDateString()}</span></div>)}
      </section>
    </main>
  );
}
