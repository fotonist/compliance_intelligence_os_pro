"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cloneRole,
  createRole,
  deactivateRole,
  fetchAvailablePermissions,
  fetchRolePermissions,
  fetchRoleStatistics,
  fetchRoleUsers,
  fetchRoles,
  type Permission,
  type RoleManagement,
  type RoleStatistics,
  type Role,
  updateRole,
  updateRolePermissions,
} from "@/services/admin";

type RoleUser = {
  id: number;
  email?: string | null;
  full_name?: string | null;
  is_active?: boolean;
};

type RoleForm = {
  name: string;
  description: string;
  is_active: boolean;
};

const EMPTY_FORM: RoleForm = {
  name: "",
  description: "",
  is_active: true,
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleManagement[]>([]);
  const [statistics, setStatistics] = useState<RoleStatistics | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleManagement | null>(null);

  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>(
    []
  );

  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    []
  );

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);

  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [cloneName, setCloneName] = useState("");

  const selectedPermissions = useMemo(() => {
    return new Set(selectedPermissionIds);
  }, [selectedPermissionIds]);

  async function loadRoles() {
    setLoading(true);
    setError(null);

    try {
      const [roleRows, stats] = await Promise.all([
        fetchRoles({
          keyword: search.trim() || undefined,
          is_active:
            activeFilter === "all"
              ? undefined
              : activeFilter === "active",
        }),
        fetchRoleStatistics(),
      ]);

      setRoles(roleRows);
      setStatistics(stats);

      if (selectedRoleId !== null) {
        const stillExists = roleRows.some(
          (role) => role.id === selectedRoleId
        );

        if (!stillExists) {
          setSelectedRoleId(null);
          setSelectedRole(null);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadRoleDetail(roleId: number) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const [role, users, assigned, available] = await Promise.all([
        fetchRoles().then((items) => {
          const found = items.find((item) => item.id === roleId);

          if (!found) {
            throw new Error("Role not found.");
          }

          return found;
        }),
        fetchRoleUsers(roleId),
        fetchRolePermissions(roleId),
        fetchAvailablePermissions(roleId),
      ]);

      setSelectedRole(role);
      setRoleUsers(users);
      setPermissions(assigned);
      setAvailablePermissions(available);
      setSelectedPermissionIds(assigned.map((permission) => permission.id));
    } catch (err) {
      setDetailError(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeFilter]);

  useEffect(() => {
    if (selectedRoleId === null) {
      return;
    }

    void loadRoleDetail(selectedRoleId);
  }, [selectedRoleId]);

  function selectRole(role: RoleManagement) {
    setSelectedRoleId(role.id);
    setSuccess(null);
    setDetailError(null);
  }

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
    setShowCreateModal(true);
  }

  function openEditModal() {
    if (!selectedRole) return;

    setForm({
      name: selectedRole.name,
      description: selectedRole.description ?? "",
      is_active: selectedRole.is_active,
    });

    setError(null);
    setSuccess(null);
    setShowEditModal(true);
  }

  function openCloneModal() {
    if (!selectedRole) return;

    setCloneName(`${selectedRole.name} Copy`);
    setError(null);
    setSuccess(null);
    setShowCloneModal(true);
  }

  async function handleCreateRole() {
    if (!form.name.trim()) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createRole({
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active,
      });

      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      setSuccess(`Role "${created.name}" created successfully.`);

      await loadRoles();

      setSelectedRoleId(created.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRole() {
    if (!selectedRole) return;

    if (!form.name.trim()) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateRole(selectedRole.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active,
      });

      setShowEditModal(false);
      setSuccess(`Role "${updated.name}" updated successfully.`);

      await loadRoles();
      await loadRoleDetail(selectedRole.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateRole() {
    if (!selectedRole) return;

    const confirmed = window.confirm(
      `Deactivate role "${selectedRole.name}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await deactivateRole(selectedRole.id);

      setSuccess(`Role "${selectedRole.name}" deactivated successfully.`);

      await loadRoles();
      await loadRoleDetail(selectedRole.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCloneRole() {
    if (!selectedRole) return;

    if (!cloneName.trim()) {
      setError("New role name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cloned = await cloneRole(
        selectedRole.id,
        cloneName.trim()
      );

      setShowCloneModal(false);
      setCloneName("");

      setSuccess(`Role "${cloned.name}" cloned successfully.`);

      await loadRoles();
      setSelectedRoleId(cloned.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePermissions() {
    if (!selectedRole) return;

    setSaving(true);
    setError(null);

    try {
      await updateRolePermissions(
        selectedRole.id,
        selectedPermissionIds
      );

      setSuccess("Role permissions updated successfully.");

      await loadRoleDetail(selectedRole.id);
      await loadRoles();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(permissionId: number) {
    setSelectedPermissionIds((current) => {
      if (current.includes(permissionId)) {
        return current.filter((id) => id !== permissionId);
      }

      return [...current, permissionId];
    });
  }

  function selectAllPermissions() {
    setSelectedPermissionIds(
      availablePermissions.map((permission) => permission.id)
    );
  }

  function clearAllPermissions() {
    setSelectedPermissionIds([]);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>Administration</span>
              <span>/</span>
              <span className="text-slate-900">Role Management</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Role Management
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Manage enterprise roles, permissions, lifecycle status and
              assigned users.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            + Create Role
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6">
          <StatCard
            label="Total Roles"
            value={statistics?.total_roles ?? "—"}
          />
          <StatCard
            label="Active Roles"
            value={statistics?.active_roles ?? "—"}
          />
          <StatCard
            label="Inactive Roles"
            value={statistics?.inactive_roles ?? "—"}
          />
          <StatCard
            label="Assigned Users"
            value={statistics?.assigned_users ?? "—"}
          />
          <StatCard
            label="Assignments"
            value={statistics?.role_assignments ?? "—"}
          />
          <StatCard
            label="Permissions"
            value={statistics?.total_permissions ?? "—"}
          />
        </div>

        <div className="grid min-h-[650px] grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Roles</h2>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {roles.length}
                </span>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />

              <div className="mt-3 grid grid-cols-3 rounded-lg bg-slate-100 p-1">
                {(["all", "active", "inactive"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      activeFilter === filter
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {filter[0].toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[570px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">
                  Loading roles...
                </div>
              ) : roles.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No roles found.
                </div>
              ) : (
                roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role)}
                    className={`w-full border-b border-slate-100 px-5 py-4 text-left transition ${
                      selectedRoleId === role.id
                        ? "bg-slate-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {role.name}
                        </div>

                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {role.description || "No description"}
                        </div>
                      </div>

                      <StatusBadge active={role.is_active} />
                    </div>

                    <div className="mt-3 flex gap-4 text-xs text-slate-500">
                      <span>{role.user_count} users</span>
                      <span>{role.permission_count} permissions</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selectedRoleId ? (
              <div className="flex h-full min-h-[650px] items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500">
                    R
                  </div>
                  <h2 className="font-semibold text-slate-900">
                    Select a role
                  </h2>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Select a role from the list to view users, permissions and
                    lifecycle information.
                  </p>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="flex min-h-[650px] items-center justify-center text-sm text-slate-500">
                Loading role details...
              </div>
            ) : detailError ? (
              <div className="p-6">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              </div>
            ) : selectedRole ? (
              <div>
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-900">
                          {selectedRole.name}
                        </h2>

                        <StatusBadge active={selectedRole.is_active} />
                      </div>

                      <p className="mt-2 max-w-3xl text-sm text-slate-500">
                        {selectedRole.description || "No description provided."}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>
                          Created: {formatDate(selectedRole.created_at)}
                        </span>
                        <span>
                          Updated: {formatDate(selectedRole.updated_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={openCloneModal}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Clone
                      </button>

                      {selectedRole.is_active && (
                        <button
                          type="button"
                          onClick={handleDeactivateRole}
                          disabled={saving}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 p-6 2xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Assigned Users
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Users currently assigned to this role.
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {roleUsers.length}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                      {roleUsers.length === 0 ? (
                        <div className="p-5 text-sm text-slate-500">
                          No users assigned to this role.
                        </div>
                      ) : (
                        roleUsers.map((user) => (
                          <div
                            key={user.id}
                            className="border-b border-slate-100 px-5 py-4 last:border-b-0"
                          >
                            <div className="font-medium text-slate-900">
                              {user.full_name || "Unnamed User"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {user.email || "No email"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Permissions
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Manage capabilities granted to this role.
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {selectedPermissionIds.length}
                        </span>
                      </div>
                    </div>

                    <div className="border-b border-slate-100 px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={selectAllPermissions}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Select all
                        </button>

                        <button
                          type="button"
                          onClick={clearAllPermissions}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Clear all
                        </button>

                        <button
                          type="button"
                          onClick={handleSavePermissions}
                          disabled={saving}
                          className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save Permissions
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto p-3">
                      {availablePermissions.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500">
                          No permissions available.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {availablePermissions.map((permission) => {
                            const checked = selectedPermissions.has(
                              permission.id
                            );

                            return (
                              <label
                                key={permission.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
                                  checked
                                    ? "border-slate-300 bg-slate-50"
                                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    togglePermission(permission.id)
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                />

                                <div className="min-w-0">
                                  <div className="font-mono text-xs font-semibold text-slate-800">
                                    {permission.code}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {permission.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 px-6 py-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <InfoItem
                      label="Users"
                      value={selectedRole.user_count}
                    />
                    <InfoItem
                      label="Permissions"
                      value={selectedRole.permission_count}
                    />
                    <InfoItem
                      label="Status"
                      value={
                        selectedRole.is_active ? "Active" : "Inactive"
                      }
                    />
                    <InfoItem
                      label="Role ID"
                      value={selectedRole.id}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {showCreateModal && (
        <RoleModal
          title="Create Role"
          description="Create a new enterprise role."
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRole}
          submitLabel="Create Role"
        />
      )}

      {showEditModal && selectedRole && (
        <RoleModal
          title="Edit Role"
          description={`Update "${selectedRole.name}".`}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateRole}
          submitLabel="Save Changes"
        />
      )}

      {showCloneModal && selectedRole && (
        <ModalShell
          title="Clone Role"
          description={`Create a new role based on "${selectedRole.name}".`}
          onClose={() => setShowCloneModal(false)}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              New Role Name
            </span>

            <input
              value={cloneName}
              onChange={(event) => setCloneName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="e.g. Compliance Manager"
            />
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCloneModal(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCloneRole}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Cloning..." : "Clone Role"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function RoleModal({
  title,
  description,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string;
  description: string;
  form: RoleForm;
  setForm: React.Dispatch<React.SetStateAction<RoleForm>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <ModalShell
      title={title}
      description={description}
      onClose={onClose}
    >
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Role Name
          </span>

          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="e.g. Compliance Manager"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Description
          </span>

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="Describe the responsibility and purpose of this role."
          />
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                is_active: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-slate-300"
          />

          <span>
            <span className="block text-sm font-medium text-slate-800">
              Active role
            </span>
            <span className="block text-xs text-slate-500">
              Allow this role to remain available for assignment.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </ModalShell>
  );
}
