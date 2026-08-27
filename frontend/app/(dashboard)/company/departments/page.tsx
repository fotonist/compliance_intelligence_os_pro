"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Layers3,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Department = {
  id: number;
  tenant_id?: number | null;
  organization_id?: number | null;
  name: string;
  code?: string | null;
  description?: string | null;
  manager_id?: number | null;
  status?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type User = {
  id: number;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
};

type DepartmentForm = {
  name: string;
  code: string;
  description: string;
  manager_id: string;
  status: string;
};

const EMPTY_FORM: DepartmentForm = {
  name: "",
  code: "",
  description: "",
  manager_id: "",
  status: "ACTIVE",
};

function userName(users: User[], id?: number | null) {
  if (!id) return "Unassigned";

  const user = users.find((item) => item.id === id);

  return (
    user?.full_name ||
    user?.username ||
    user?.email ||
    `User #${id}`
  );
}

function statusLabel(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "INACTIVE":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "ARCHIVED":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [managerFilter, setManagerFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DepartmentForm>(EMPTY_FORM);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [departmentRes, userRes] = await Promise.all([
        apiFetch("/company/departments"),
        apiFetch("/users"),
      ]);

      if (!departmentRes.ok) {
        throw new Error(
          (await departmentRes.text()) ||
            "Failed to load departments"
        );
      }

      const departmentData = await departmentRes.json();

      const userData = userRes.ok
        ? await userRes.json()
        : [];

      setDepartments(
        Array.isArray(departmentData)
          ? departmentData
          : departmentData?.items || []
      );

      setUsers(
        Array.isArray(userData)
          ? userData
          : userData?.items || userData?.users || []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to load department information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return departments.filter((department) => {
      const matchesSearch =
        !query ||
        department.name?.toLowerCase().includes(query) ||
        department.code?.toLowerCase().includes(query) ||
        department.description
          ?.toLowerCase()
          .includes(query) ||
        userName(users, department.manager_id)
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        (department.status || "ACTIVE").toUpperCase() ===
          statusFilter;

      const matchesManager =
        managerFilter === "ALL" ||
        String(department.manager_id || "") ===
          managerFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesManager
      );
    });
  }, [
    departments,
    users,
    search,
    statusFilter,
    managerFilter,
  ]);

  const activeCount = departments.filter(
    (item) =>
      (item.status || "ACTIVE").toUpperCase() ===
      "ACTIVE"
  ).length;

  const inactiveCount = departments.filter(
    (item) =>
      (item.status || "").toUpperCase() ===
      "INACTIVE"
  ).length;

  const assignedManagerCount = departments.filter(
    (item) => item.manager_id
  ).length;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEdit(department: Department) {
    setEditingId(department.id);

    setForm({
      name: department.name || "",
      code: department.code || "",
      description: department.description || "",
      manager_id: department.manager_id
        ? String(department.manager_id)
        : "",
      status:
        department.status?.toUpperCase() ||
        "ACTIVE",
    });

    setError("");
    setNotice("");
    setModalOpen(true);
  }

  async function saveDepartment() {
    if (!form.name.trim()) {
      setError("Department name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description:
          form.description.trim() || null,
        manager_id: form.manager_id
          ? Number(form.manager_id)
          : null,
        status: form.status,
      };

      const url = editingId
        ? `/company/departments/${editingId}`
        : "/company/departments";

      const method = editingId
        ? "PUT"
        : "POST";

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to save department"
        );
      }

      await loadData();

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      setNotice(
        editingId
          ? "Department updated successfully."
          : "Department created successfully."
      );

      window.setTimeout(() => {
        setNotice("");
      }, 3500);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save department."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(
    department: Department
  ) {
    const confirmed = window.confirm(
      `Delete department "${department.name}"?`
    );

    if (!confirmed) return;

    try {
      setActionId(department.id);
      setError("");

      const res = await apiFetch(
        `/company/departments/${department.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to delete department"
        );
      }

      await loadData();

      setNotice(
        "Department deleted successfully."
      );

      window.setTimeout(() => {
        setNotice("");
      }, 3500);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to delete department."
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-full space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Building2 size={14} />
            Company Foundation
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Departments
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Manage the organizational structure,
            department ownership and operational
            accountability across the enterprise.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus size={17} />
          Add Department
        </button>
      </div>

      {/* NOTICES */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Departments
            </span>
            <Layers3
              size={18}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {departments.length}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Defined organizational units
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Active
            </span>
            <CheckCircle2
              size={18}
              className="text-emerald-500"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {activeCount}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Currently operational
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Inactive
            </span>
            <Building2
              size={18}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {inactiveCount}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Non-operational units
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Manager Assigned
            </span>
            <Users
              size={18}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {assignedManagerCount}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Departments with accountable owners
          </p>
        </div>
      </div>

      {/* DIRECTORY */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Department Directory
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Organizational units and accountability
                assignments.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search departments..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:w-64"
                />
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  className="appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="ALL">
                    All Statuses
                  </option>
                  <option value="ACTIVE">
                    Active
                  </option>
                  <option value="INACTIVE">
                    Inactive
                  </option>
                  <option value="ARCHIVED">
                    Archived
                  </option>
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              <div className="relative">
                <select
                  value={managerFilter}
                  onChange={(e) =>
                    setManagerFilter(e.target.value)
                  }
                  className="appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="ALL">
                    All Managers
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={String(user.id)}
                    >
                      {userName(users, user.id)}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            Loading departments...
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Building2
              size={28}
              className="mx-auto text-slate-300"
            />

            <div className="mt-3 text-sm font-semibold text-slate-700">
              No departments found
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Create a department or adjust the
              current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Department
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Code
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Manager
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Last Updated
                  </th>

                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDepartments.map(
                  (department) => (
                    <tr
                      key={department.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <Building2 size={17} />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {department.name}
                            </div>

                            <div className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                              {department.description ||
                                "No description provided"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-medium text-slate-600">
                          {department.code ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-700">
                            {department.manager_id
                              ? userName(
                                  users,
                                  department.manager_id
                                )
                                  .slice(0, 2)
                                  .toUpperCase()
                              : "—"}
                          </div>

                          <span className="text-sm text-slate-700">
                            {userName(
                              users,
                              department.manager_id
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            department.status
                          )}`}
                        >
                          {statusLabel(
                            department.status ||
                              "ACTIVE"
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(
                          department.updated_at ||
                            department.created_at
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(department)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit department"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={
                              actionId ===
                              department.id
                            }
                            onClick={() =>
                              deleteDepartment(
                                department
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="Delete department"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingId
                    ? "Edit Department"
                    : "Create Department"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Define organizational ownership
                  and operational accountability.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Department Name *
                  </label>

                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g. Information Security"
                    className={inputClass()}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Department Code
                  </label>

                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        code: e.target.value,
                      }))
                    }
                    placeholder="e.g. IS"
                    className={inputClass()}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Department Manager
                </label>

                <select
                  value={form.manager_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      manager_id: e.target.value,
                    }))
                  }
                  className={inputClass()}
                >
                  <option value="">
                    No manager assigned
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={String(user.id)}
                    >
                      {userName(users, user.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className={inputClass()}
                  >
                    <option value="ACTIVE">
                      Active
                    </option>
                    <option value="INACTIVE">
                      Inactive
                    </option>
                    <option value="ARCHIVED">
                      Archived
                    </option>
                  </select>
                </div>

                <div className="hidden sm:block" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description:
                        e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Describe the department's purpose and responsibilities."
                  className={inputClass()}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={saveDepartment}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Department"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
