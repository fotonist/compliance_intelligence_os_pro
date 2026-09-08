"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  Edit3,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type Department = {
  id: number;
  tenant_id?: number | null;
  organization_id?: number | null;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  manager_id?: number | null;
  status?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FormState = {
  name: string;
  code: string;
  organization_id: string;
  manager_id: string;
  status: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  organization_id: "",
  manager_id: "",
  status: "ACTIVE",
  description: "",
};

function normalizeStatus(value?: string | null) {
  return String(value || "ACTIVE").toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] =
    useState<Department | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadDepartments() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/company/departments");
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return departments.filter((department) => {
      const matchesSearch =
        !query ||
        String(department.name || "")
          .toLowerCase()
          .includes(query) ||
        String(department.code || "")
          .toLowerCase()
          .includes(query) ||
        String(department.description || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        normalizeStatus(department.status) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [departments, search, statusFilter]);

  const totalCount = departments.length;

  const activeCount = departments.filter(
    (department) => normalizeStatus(department.status) === "ACTIVE"
  ).length;

  const inactiveCount = departments.filter(
    (department) => normalizeStatus(department.status) !== "ACTIVE"
  ).length;

  function openCreate() {
    setEditingDepartment(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEdit(department: Department) {
    setEditingDepartment(department);
    setForm({
      name: department.name || "",
      code: department.code || "",
      organization_id:
        department.organization_id == null
          ? ""
          : String(department.organization_id),
      manager_id:
        department.manager_id == null ? "" : String(department.manager_id),
      status: normalizeStatus(department.status),
      description: department.description || "",
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingDepartment(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("Department name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        organization_id: form.organization_id
          ? Number(form.organization_id)
          : null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
        status: form.status,
        description: form.description.trim() || null,
      };

      if (editingDepartment) {
        await apiFetch(
          `/company/departments/${editingDepartment.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiFetch("/company/departments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeModal();
      await loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(department: Department) {
    const confirmed = window.confirm(
      `Delete department "${department.name || "this department"}"?`
    );

    if (!confirmed) return;

    setDeletingId(department.id);
    setError("");

    try {
      await apiFetch(`/company/departments/${department.id}`, {
        method: "DELETE",
      });

      await loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Building2 size={14} />
                Administration
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Departments
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Manage the organizational department structure, ownership,
                status, and administrative metadata.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadDepartments}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Plus size={16} />
                New Department
              </button>
            </div>
          </div>
        </header>

        {error && !modalOpen && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total Departments
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {totalCount}
                </p>
              </div>

              <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                <Building2 size={18} />
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Departments in the current tenant
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Active
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {activeCount}
                </p>
              </div>

              <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
                <Users size={18} />
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Currently available for assignment
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Inactive
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {inactiveCount}
                </p>
              </div>

              <div className="rounded-lg bg-slate-100 p-2.5 text-slate-500">
                <Building2 size={18} />
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Departments not currently active
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Department Directory
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredDepartments.length} of {totalCount} departments
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search departments..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
                  />
                </div>

                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-slate-400"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Loading departments...
              </div>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                <Building2 size={20} />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                No departments found
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search || statusFilter !== "ALL"
                  ? "Try adjusting your search or filters."
                  : "Create the first department to establish the organizational structure."}
              </p>

              {!search && statusFilter === "ALL" && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus size={15} />
                  New Department
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Department
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Code
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Manager
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Organization
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Updated
                    </th>
                    <th className="w-24 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredDepartments.map((department) => {
                    const status = normalizeStatus(department.status);

                    return (
                      <tr
                        key={department.id}
                        className="group transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                              <Building2 size={16} />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {department.name || "Unnamed Department"}
                              </div>

                              {department.description && (
                                <div className="mt-0.5 max-w-[360px] truncate text-xs text-slate-500">
                                  {department.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-700">
                          {department.code || "-"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {department.manager_id
                            ? `User #${department.manager_id}`
                            : "Unassigned"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {department.organization_id
                            ? `Organization #${department.organization_id}`
                            : "Unassigned"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={
                              status === "ACTIVE"
                                ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                            }
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(department.updated_at)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(department)}
                              title="Edit department"
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Edit3 size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(department)}
                              disabled={deletingId === department.id}
                              title="Delete department"
                              className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingId === department.id ? (
                                <Loader2
                                  size={15}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>

                            <button
                              type="button"
                              title="More actions"
                              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingDepartment
                    ? "Edit Department"
                    : "Create Department"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Maintain organizational department metadata.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
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

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Department Name *
                  </span>

                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Information Security"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Department Code
                  </span>

                  <input
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="e.g. IS"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Organization ID
                  </span>

                  <input
                    value={form.organization_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        organization_id: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Organization ID"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Manager ID
                  </span>

                  <input
                    value={form.manager_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        manager_id: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="User ID"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Status
                  </span>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
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
                  placeholder="Describe the department purpose and scope."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {editingDepartment ? "Save Changes" : "Create Department"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

