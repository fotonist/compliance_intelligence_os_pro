"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, KeyRound, Lock, Mail, Plus, RefreshCw, Search, ShieldCheck, Unlock, UserCheck, UserPlus, Users, X } from "lucide-react";

import { fetchRoles, fetchTenants, type AdminTenant, type RoleManagement } from "../../../services/admin";
import { activatePlatformUser, createPlatformUser, deactivatePlatformUser, fetchPlatformUsers, lockPlatformUser, resetPlatformUserPassword, unlockPlatformUser, updatePlatformUser, updatePlatformUserRoles, type PlatformUser } from "../../../services/adminUsers";

function initials(user: PlatformUser) {
  const source = user.full_name?.trim() || user.email;
  return source.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function roleLabel(user: PlatformUser) {
  if (!user.roles.length) return "No role";
  if (user.roles.length === 1) return user.roles[0].name;
  return `${user.roles[0].name} +${user.roles.length - 1}`;
}

function StatusPill({ user }: { user: PlatformUser }) {
  if (!user.is_active) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Inactive</span>;
  if (user.is_locked) return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Locked</span>;
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>;
}

function SecurityBadge({ user }: { user: PlatformUser }) {
  if (user.mfa_enabled) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><ShieldCheck size={14} /> MFA enabled</span>;
  return <span className="text-xs font-medium text-slate-500">No MFA</span>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [roles, setRoles] = useState<RoleManagement[]>([]);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [tenantFilter, setTenantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editMfa, setEditMfa] = useState(false);
  const [editRoles, setEditRoles] = useState<number[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [newRoleId, setNewRoleId] = useState("");

  function notify(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function loadUsers(showSpinner = true) {
    if (showSpinner) setRefreshing(true);
    try {
      const data = await fetchPlatformUsers({ tenant_id: tenantFilter === "all" ? undefined : Number(tenantFilter), keyword: search, role_id: roleFilter === "all" ? undefined : Number(roleFilter), is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined, is_locked: statusFilter === "locked" ? true : undefined, limit: 250 });
      setUsers(data);
      if (selectedUser) {
        const fresh = data.find((item) => item.id === selectedUser.id);
        if (fresh) setSelectedUser(fresh);
      }
    } catch (error) {
      console.error(error);
      notify("error", error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadReferenceData() {
    try {
      const [tenantData, roleData] = await Promise.all([fetchTenants(), fetchRoles({ is_active: true })]);
      setTenants(tenantData);
      setRoles(roleData);
      if (!newTenantId && tenantData.length) {
        const active = tenantData.find((tenant) => tenant.status === "active");
        setNewTenantId(String(active?.id ?? tenantData[0].id));
      }
    } catch (error) {
      console.error(error);
      notify("error", "Failed to load tenant or role catalog.");
    }
  }

  useEffect(() => { loadReferenceData(); }, []);
  useEffect(() => { const timer = window.setTimeout(() => loadUsers(true), 250); return () => window.clearTimeout(timer); }, [tenantFilter, statusFilter, roleFilter, search]);
  useEffect(() => {
    if (!selectedUser) return;
    setEditName(selectedUser.full_name ?? "");
    setEditPhone(selectedUser.phone ?? "");
    setEditMfa(selectedUser.mfa_enabled);
    setEditRoles(selectedUser.roles.map((role) => role.id));
    setNewPassword("");
  }, [selectedUser]);

  const stats = useMemo(() => {
    const active = users.filter((user) => user.is_active).length;
    const locked = users.filter((user) => user.is_locked).length;
    const mfa = users.filter((user) => user.mfa_enabled).length;
    return { total: users.length, active, locked, mfa };
  }, [users]);

  const activeTenants = tenants.filter((tenant) => tenant.status === "active");

  function openUser(user: PlatformUser) {
    setSelectedUser(user);
    setDrawerOpen(true);
  }

  async function saveUser() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await updatePlatformUser(selectedUser.id, { full_name: editName.trim() || null, phone: editPhone.trim() || null, mfa_enabled: editMfa });
      await updatePlatformUserRoles(selectedUser.id, editRoles);
      await loadUsers(false);
      notify("success", "User profile and access updated.");
    } catch (error) {
      console.error(error);
      notify("error", error instanceof Error ? error.message : "Failed to update user.");
    } finally { setSaving(false); }
  }

  async function changeState(action: "activate" | "deactivate" | "lock" | "unlock") {
    if (!selectedUser) return;
    setSaving(true);
    try {
      if (action === "activate") await activatePlatformUser(selectedUser.id);
      if (action === "deactivate") await deactivatePlatformUser(selectedUser.id);
      if (action === "lock") await lockPlatformUser(selectedUser.id);
      if (action === "unlock") await unlockPlatformUser(selectedUser.id);
      await loadUsers(false);
      notify("success", "Account state updated.");
    } catch (error) {
      console.error(error);
      notify("error", error instanceof Error ? error.message : "Failed to update account state.");
    } finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!selectedUser || newPassword.length < 12) { notify("error", "Temporary password must contain at least 12 characters."); return; }
    setSaving(true);
    try {
      await resetPlatformUserPassword(selectedUser.id, newPassword, true);
      setNewPassword("");
      await loadUsers(false);
      notify("success", "Password reset. User must change it at next sign-in.");
    } catch (error) {
      console.error(error);
      notify("error", error instanceof Error ? error.message : "Failed to reset password.");
    } finally { setSaving(false); }
  }

  async function createUser() {
    if (!newTenantId || !newEmail.trim() || newPasswordValue.length < 12) { notify("error", "Tenant, email and a 12+ character temporary password are required."); return; }
    setSaving(true);
    try {
      const created = await createPlatformUser({ tenant_id: Number(newTenantId), email: newEmail.trim(), full_name: newName.trim() || null, password: newPasswordValue, must_change_password: true, role_ids: newRoleId ? [Number(newRoleId)] : [] });
      setCreateOpen(false); setNewName(""); setNewEmail(""); setNewPasswordValue(""); setNewRoleId("");
      await loadUsers(false); setSelectedUser(created); setDrawerOpen(true);
      notify("success", "User created successfully.");
    } catch (error) {
      console.error(error);
      notify("error", error instanceof Error ? error.message : "Failed to create user.");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {toast && <div className={`fixed right-6 top-6 z-[70] flex max-w-md items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-xl ${toast.type === "success" ? "border-emerald-200" : "border-rose-200"}`}>{toast.type === "success" ? <CheckCircle2 className="text-emerald-600" size={18} /> : <CircleAlert className="text-rose-600" size={18} />}<span>{toast.text}</span><button onClick={() => setToast(null)}><X size={16} /></button></div>}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-8 py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"><ShieldCheck size={15} /> Platform Administration</div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Identity & User Administration</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Govern user identities across every customer tenant, control access lifecycle, and maintain security posture from a single platform control plane.</p>
            </div>
            <button onClick={() => setCreateOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"><UserPlus size={17} /> Create user</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-8 py-7">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Identities in view", value: stats.total, icon: Users, note: tenantFilter === "all" ? "Across all tenants" : "Selected tenant" },
            { label: "Active accounts", value: stats.active, icon: UserCheck, note: `${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% of visible users` },
            { label: "Locked accounts", value: stats.locked, icon: Lock, note: stats.locked ? "Requires attention" : "No lockouts in view" },
            { label: "MFA coverage", value: `${stats.total ? Math.round((stats.mfa / stats.total) * 100) : 0}%`, icon: ShieldCheck, note: `${stats.mfa} protected identities` },
          ].map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.note}</p></div><div className="rounded-lg bg-slate-50 p-2.5 text-slate-600"><Icon size={19} /></div></div></div>; })}
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-lg font-semibold text-slate-950">Identity registry</h2><p className="mt-1 text-sm text-slate-500">Cross-tenant directory with lifecycle and access controls.</p></div><button onClick={() => loadUsers(true)} className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 xl:self-auto"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh</button></div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_220px_180px_170px]">
              <div className="relative"><Search className="absolute left-3.5 top-3 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, tenant or code..." className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400" /></div>
              <select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"><option value="all">All tenants</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.code}</option>)}</select>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"><option value="all">All roles</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="locked">Locked</option></select>
            </div>
          </div>

          <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left"><thead className="border-b border-slate-200 bg-slate-50/70"><tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"><th className="px-6 py-3.5">Identity</th><th className="px-4 py-3.5">Tenant</th><th className="px-4 py-3.5">Role</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Security</th><th className="px-4 py-3.5">Last sign-in</th><th className="px-6 py-3.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">Loading identity registry...</td></tr> : users.length === 0 ? <tr><td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">No identities match the current filters.</td></tr> : users.map((user) => <tr key={user.id} className="group hover:bg-slate-50/70"><td className="px-6 py-4"><button onClick={() => openUser(user)} className="flex items-center gap-3 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{initials(user)}</span><span><span className="block text-sm font-semibold text-slate-900">{user.full_name || "Unnamed user"}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Mail size={12} />{user.email}</span></span></button></td><td className="px-4 py-4"><div className="text-sm font-medium text-slate-800">{user.tenant_name || "—"}</div><div className="mt-0.5 text-xs text-slate-500">{user.tenant_code || "—"}</div></td><td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{roleLabel(user)}</span></td><td className="px-4 py-4"><StatusPill user={user} /></td><td className="px-4 py-4"><SecurityBadge user={user} /></td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(user.last_login_at)}</td><td className="px-6 py-4 text-right"><button onClick={() => openUser(user)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">Manage <ChevronDown size={14} /></button></td></tr>)}
          </tbody></table></div>
          <div className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">Showing {users.length} identities · Platform-level access requires SuperAdmin authorization.</div>
        </section>
      </main>

      {drawerOpen && selectedUser && <div className="fixed inset-0 z-50 bg-slate-950/20" onMouseDown={() => setDrawerOpen(false)}><aside onMouseDown={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"><div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">{initials(selectedUser)}</span><div><h2 className="text-lg font-semibold text-slate-950">{selectedUser.full_name || "Unnamed user"}</h2><p className="text-sm text-slate-500">{selectedUser.email}</p></div></div><button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button></div></div>
        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tenant context</p><p className="mt-1 font-semibold text-slate-900">{selectedUser.tenant_name}</p><p className="text-xs text-slate-500">{selectedUser.tenant_code} · Tenant ID #{selectedUser.tenant_id}</p></div><StatusPill user={selectedUser} /></div></div>
          <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Identity profile</h3><span className="text-xs text-slate-400">User ID #{selectedUser.id}</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-500">Full name<input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400" /></label><label className="text-xs font-medium text-slate-500">Phone<input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400" /></label></div></section>
          <section><h3 className="mb-3 text-sm font-semibold text-slate-900">Access roles</h3><div className="space-y-2 rounded-xl border border-slate-200 p-4">{roles.map((role) => <label key={role.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50"><span><span className="block text-sm font-medium text-slate-800">{role.name}</span><span className="text-xs text-slate-500">{role.description || "Role-based access"}</span></span><input type="checkbox" checked={editRoles.includes(role.id)} onChange={(event) => setEditRoles((current) => event.target.checked ? [...new Set([...current, role.id])] : current.filter((id) => id !== role.id))} className="h-4 w-4 rounded border-slate-300" /></label>)}</div></section>
          <section><h3 className="mb-3 text-sm font-semibold text-slate-900">Security controls</h3><div className="space-y-3 rounded-xl border border-slate-200 p-4"><label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-medium text-slate-800">Multi-factor authentication</span><span className="text-xs text-slate-500">Require MFA for this identity.</span></span><input type="checkbox" checked={editMfa} onChange={(event) => setEditMfa(event.target.checked)} className="h-4 w-4 rounded border-slate-300" /></label><div className="grid grid-cols-2 gap-2 pt-2">{selectedUser.is_locked ? <button onClick={() => changeState("unlock")} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Unlock size={15} /> Unlock</button> : <button onClick={() => changeState("lock")} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Lock size={15} /> Lock</button>}{selectedUser.is_active ? <button onClick={() => changeState("deactivate")} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">Deactivate</button> : <button onClick={() => changeState("activate")} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Activate</button>}</div></div></section>
          <section><h3 className="mb-3 text-sm font-semibold text-slate-900">Credential administration</h3><div className="rounded-xl border border-slate-200 p-4"><div className="relative"><KeyRound className="absolute left-3 top-3 text-slate-400" size={16} /><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="Temporary password · 12+ characters" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-400" /></div><button onClick={resetPassword} disabled={saving || newPassword.length < 12} className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Reset password</button><p className="mt-2 text-xs text-slate-500">The user will be required to change the temporary password at next sign-in.</p></div></section>
          <div className="sticky bottom-0 border-t border-slate-200 bg-white pt-4"><button onClick={saveUser} disabled={saving} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving..." : "Save identity changes"}</button></div>
        </div>
      </aside></div>}

      {createOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-6" onMouseDown={() => setCreateOpen(false)}><div onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><h2 className="text-lg font-semibold text-slate-950">Create platform identity</h2><p className="mt-1 text-sm text-slate-500">Provision a user inside an active customer tenant.</p></div><button onClick={() => setCreateOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2"><label className="text-xs font-medium text-slate-500 sm:col-span-2">Tenant<select value={newTenantId} onChange={(event) => setNewTenantId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"><option value="">Select tenant</option>{activeTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.code}</option>)}</select></label><label className="text-xs font-medium text-slate-500">Full name<input value={newName} onChange={(event) => setNewName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Jane Smith" /></label><label className="text-xs font-medium text-slate-500">Email<input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="jane@example.com" /></label><label className="text-xs font-medium text-slate-500 sm:col-span-2">Temporary password<input type="password" value={newPasswordValue} onChange={(event) => setNewPasswordValue(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="At least 12 characters" /></label><label className="text-xs font-medium text-slate-500 sm:col-span-2">Initial role<select value={newRoleId} onChange={(event) => setNewRoleId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">No role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div><div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4"><button onClick={() => setCreateOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button><button onClick={createUser} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Plus size={16} />{saving ? "Creating..." : "Create identity"}</button></div></div></div>}
    </div>
  );
}
