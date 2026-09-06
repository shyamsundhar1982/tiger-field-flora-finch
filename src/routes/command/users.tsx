import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getVindyUserContext, listVindyUsers, setVindyUserRole } from "@/lib/vindy-users";
import type { CommandRole } from "@/lib/page-access";

export const Route = createFileRoute("/command/users")({ component: UsersPage });

const roles: CommandRole[] = ["admin", "management", "board", "finance", "operations", "engineering", "qa", "compliance", "viewer"];

type VindyUser = { id: string; name: string | null; email: string | null; role: string | null; created_at: string };

function UsersPage() {
  const [me, setMe] = useState<{ role: CommandRole | null } | null>(null);
  const [users, setUsers] = useState<VindyUser[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try {
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
      await setVindyUserRole({ data: { userId, role } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role.");
    }
  }

  if (me?.role !== "admin") return <div className="p-8"><h1 className="text-2xl font-semibold">User Access</h1><p className="mt-2 text-sm text-slate-500">Administrator access is required.</p>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}</div>;

  return (
    <main className="space-y-6 p-8">
      <header><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-500">VINDY • IDENTITY</p><h1 className="mt-2 text-3xl font-semibold">User Access Control</h1><p className="mt-2 text-sm text-slate-500">Individual accounts, least-privilege roles and auditable role changes.</p></header>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.3fr_1.5fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>User</span><span>Email</span><span>Role</span><span>Created</span></div>
        {users.map((user) => <div key={user.id} className="grid grid-cols-[1.3fr_1.5fr_1fr_1fr] items-center gap-4 border-b border-slate-100 px-5 py-4 text-sm"><span className="font-medium">{user.name || "Unnamed user"}</span><span className="text-slate-500">{user.email || "—"}</span><select value={user.role || "viewer"} onChange={(e) => void changeRole(user.id, e.target.value as CommandRole)} className="rounded-lg border border-slate-200 px-2 py-2">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><span className="text-slate-500">{new Date(user.created_at).toLocaleDateString()}</span></div>)}
      </section>
    </main>
  );
}
