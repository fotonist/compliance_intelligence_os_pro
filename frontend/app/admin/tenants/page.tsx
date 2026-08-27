"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import {
  createTenant,
  fetchTenants,
  updateTenant,
  type AdminTenant,
} from "../../../services/admin";

type Toast = {
  type: "success" | "error";
  text: string;
} | null;

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<AdminTenant | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    status: "active" as "active" | "suspended",
  });

  const [toast, setToast] = useState<Toast>(null);

  async function loadTenants() {
    setLoading(true);

    try {
      const data = await fetchTenants();
      setTenants(data);
    } catch (error) {
      console.error(error);
      setToast({
        type: "error",
        text: "Unable to load tenant registry.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tenants.filter((tenant) => {
      const matchesSearch =
        !query ||
        tenant.name.toLowerCase().includes(query) ||
        tenant.code.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        tenant.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tenants, search, statusFilter]);

  const statistics = useMemo(
    () => ({
      total: tenants.length,
      active: tenants.filter((t) => t.status.toLowerCase() === "active")
        .length,
      suspended: tenants.filter(
        (t) => t.status.toLowerCase() === "suspended"
      ).length,
      users: tenants.reduce(
        (sum, tenant) => sum + (tenant.user_count || 0),
        0
      ),
    }),
    [tenants]
  );

  function openCreate() {
    setEditTenant(null);
    setForm({
      code: "",
      name: "",
      status: "active",
    });
    setModalOpen(true);
  }

  function openEdit(tenant: AdminTenant) {
    setEditTenant(tenant);
    setForm({
      code: tenant.code,
      name: tenant.name,
      status:
        tenant.status.toLowerCase() === "suspended"
          ? "suspended"
          : "active",
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditTenant(null);
  }

  async function submitTenant() {
    const code = form.code.trim();
    const name = form.name.trim();

    if (!name || !code) {
      setToast({
        type: "error",
        text: "Organization name and tenant code are required.",
      });
      return;
    }

    setSaving(true);

    try {
      if (editTenant) {
        await updateTenant(editTenant.id, {
          name,
          status: form.status,
        });

        setToast({
          type: "success",
          text: "Tenant configuration updated successfully.",
        });
      } else {
        await createTenant({
          code,
          name,
          status: form.status,
        });

        setToast({
          type: "success",
          text: "Tenant created successfully.",
        });
      }

      closeModal();
      await loadTenants();
    } catch (error) {
      console.error(error);

      setToast({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Tenant operation failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-8 py-10 text-slate-600">
        <div className="mx-auto max-w-[1600px]">
          <div className="animate-pulse space-y-5">
            <div className="h-4 w-44 rounded bg-slate-200" />
            <div className="h-10 w-72 rounded bg-slate-200" />
            <div className="h-4 w-[520px] max-w-full rounded bg-slate-200" />
            <div className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-32 rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ShieldCheck size={15} />
              Platform Administration
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
              Tenant Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Govern customer organizations, tenant lifecycle and
              platform-level access from a single control plane.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={17} />
            Create Tenant
          </button>
        </header>

        <section className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Building2 size={19} />}
            label="Total Tenants"
            value={statistics.total}
            description="Registered organizations"
          />

          <MetricCard
            icon={<CheckCircle2 size={19} />}
            label="Active"
            value={statistics.active}
            description="Operational environments"
            tone="success"
          />

          <MetricCard
            icon={<CircleAlert size={19} />}
            label="Suspended"
            value={statistics.suspended}
            description="Restricted environments"
            tone="warning"
          />

          <MetricCard
            icon={<Users size={19} />}
            label="Total Users"
            value={statistics.users}
            description="Across all organizations"
          />
        </section>

        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Tenant Registry
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {filteredTenants.length}{" "}
                    {filteredTenants.length === 1 ? "tenant" : "tenants"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Platform organizations currently available to
                  administration.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search organization or code..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 md:w-80"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Tenant Code</th>
                  <th className="px-6 py-4">Users</th>
                  <th className="px-6 py-4">Lifecycle</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((tenant) => {
                  const active =
                    tenant.status.toLowerCase() === "active";

                  return (
                    <tr
                      key={tenant.id}
                      className="group transition hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                            <Building2 size={18} />
                          </div>

                          <div>
                            <div className="font-semibold text-slate-900">
                              {tenant.name}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              Tenant ID #{tenant.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-medium text-slate-700">
                          {tenant.code}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Users size={15} className="text-slate-400" />
                          {tenant.user_count}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge
                          status={tenant.status}
                          active={active}
                        />
                      </td>

                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(tenant)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Manage
                          <MoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredTenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <Search size={20} />
                      </div>

                      <div className="mt-4 text-sm font-semibold text-slate-800">
                        No tenants found
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        Adjust your search or status filter.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-xl ${
            toast.type === "success"
              ? "border-emerald-200 text-emerald-700"
              : "border-red-200 text-red-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={17} />
          ) : (
            <CircleAlert size={17} />
          )}

          <span>{toast.text}</span>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-[2px]">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Platform Tenant
                </div>

                <h2 className="mt-1.5 text-xl font-semibold text-slate-950">
                  {editTenant ? "Manage Tenant" : "Create Tenant"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editTenant
                    ? "Update the organization's platform lifecycle."
                    : "Register a new customer organization on the platform."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <Field
                label="Organization Name"
                required
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
                placeholder="Example Corporation"
              />

              <Field
                label="Tenant Code"
                required
                value={form.code}
                disabled={!!editTenant}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    code: value.toUpperCase(),
                  }))
                }
                placeholder="EXAMPLE"
                hint={
                  editTenant
                    ? "Tenant codes are immutable after creation."
                    : "Use a short, unique platform identifier."
                }
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Lifecycle Status
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      status: e.target.value as
                        | "active"
                        | "suspended",
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex gap-3">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-slate-500"
                  />

                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Platform-level tenant
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Tenant isolation remains enforced by the backend
                      security and authorization layer.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={submitTenant}
                className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editTenant
                    ? "Save Changes"
                    : "Create Tenant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const iconClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "warning"
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
          {label}
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function StatusBadge({
  status,
  active,
}: {
  status: string;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />

      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />

      {hint && (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
