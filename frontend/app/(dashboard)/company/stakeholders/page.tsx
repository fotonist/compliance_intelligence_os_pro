"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import {
  Building2,
  ChevronDown,
  Edit3,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Stakeholder = {
  id: number;
  tenant_id?: number;
  organization_id?: number | null;
  name: string;
  stakeholder_type?: string | null;
  relationship?: string | null;
  description?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  importance?: string | null;
  status: string;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Organization = {
  id: number;
  name: string;
};

type FormState = {
  organization_id: string;
  name: string;
  stakeholder_type: string;
  relationship: string;
  description: string;
  contact_person: string;
  email: string;
  phone: string;
  importance: string;
  status: string;
};

type Toast = {
  type: "success" | "error";
  message: string;
};

const TYPE_OPTIONS = [
  "Customer",
  "Supplier",
  "Partner",
  "Regulatory Authority",
  "Government",
  "Certification Body",
  "Employee",
  "Shareholder",
  "Management",
  "Contractor",
  "Service Provider",
  "Community",
  "Other",
];

const IMPORTANCE_OPTIONS = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

const STATUS_OPTIONS = [
  "ACTIVE",
  "INACTIVE",
];

const EMPTY_FORM: FormState = {
  organization_id: "",
  name: "",
  stakeholder_type: "",
  relationship: "",
  description: "",
  contact_person: "",
  email: "",
  phone: "",
  importance: "Medium",
  status: "ACTIVE",
};

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
}

function humanize(value?: string | null) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function importanceClass(value?: string | null) {
  switch (value) {
    case "Critical":
      return "border-red-200 bg-red-50 text-red-700";
    case "High":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "Medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Low":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function statusClass(value?: string | null) {
  return value === "ACTIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-600";
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

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {description}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function StakeholdersPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [importanceFilter, setImportanceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(type: Toast["type"], message: string) {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 4000);
  }

  async function loadData() {
    try {
      setLoading(true);

      const [stakeholderRes, organizationRes] = await Promise.all([
        apiFetch("/company/stakeholders"),
        apiFetch("/organizations"),
      ]);

      if (!stakeholderRes.ok) {
        throw new Error(
          (await stakeholderRes.text()) ||
            "Failed to load stakeholders"
        );
      }

      const stakeholderData = await stakeholderRes.json();

      setStakeholders(
        Array.isArray(stakeholderData)
          ? stakeholderData
          : []
      );

      if (organizationRes.ok) {
        const organizationData = await organizationRes.json();

        setOrganizations(
          Array.isArray(organizationData)
            ? organizationData
            : []
        );
      }
    } catch (error: any) {
      showToast(
        "error",
        error?.message || "Failed to load stakeholders"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredStakeholders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return stakeholders.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.name,
          item.stakeholder_type,
          item.relationship,
          item.contact_person,
          item.email,
          item.phone,
          item.description,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      const matchesType =
        typeFilter === "all" ||
        item.stakeholder_type === typeFilter;

      const matchesImportance =
        importanceFilter === "all" ||
        item.importance === importanceFilter;

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesImportance &&
        matchesStatus
      );
    });
  }, [
    stakeholders,
    search,
    typeFilter,
    importanceFilter,
    statusFilter,
  ]);

  const activeCount = stakeholders.filter(
    (item) => item.status === "ACTIVE"
  ).length;

  const criticalCount = stakeholders.filter(
    (item) => item.importance === "Critical"
  ).length;

  const highCount = stakeholders.filter(
    (item) => item.importance === "High"
  ).length;

  function organizationName(id?: number | null) {
    if (!id) return "—";

    return (
      organizations.find((item) => item.id === id)?.name ||
      `Organization #${id}`
    );
  }

  function updateForm(
    key: keyof FormState,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: Stakeholder) {
    setEditingId(item.id);

    setForm({
      organization_id:
        item.organization_id != null
          ? String(item.organization_id)
          : "",
      name: item.name || "",
      stakeholder_type:
        item.stakeholder_type || "",
      relationship:
        item.relationship || "",
      description:
        item.description || "",
      contact_person:
        item.contact_person || "",
      email:
        item.email || "",
      phone:
        item.phone || "",
      importance:
        item.importance || "Medium",
      status:
        item.status || "ACTIVE",
    });

    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function saveStakeholder() {
    if (!form.name.trim()) {
      showToast(
        "error",
        "Stakeholder name is required."
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        organization_id: form.organization_id
          ? Number(form.organization_id)
          : null,
        name: form.name.trim(),
        stakeholder_type:
          form.stakeholder_type || null,
        relationship:
          form.relationship.trim() || null,
        description:
          form.description.trim() || null,
        contact_person:
          form.contact_person.trim() || null,
        email:
          form.email.trim() || null,
        phone:
          form.phone.trim() || null,
        importance:
          form.importance || null,
        status:
          form.status || "ACTIVE",
      };

      const endpoint =
        editingId === null
          ? "/company/stakeholders"
          : `/company/stakeholders/${editingId}`;

      const response = await apiFetch(endpoint, {
        method:
          editingId === null ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            "Failed to save stakeholder"
        );
      }

      await loadData();

      closeModal();

      showToast(
        "success",
        editingId === null
          ? "Stakeholder created successfully."
          : "Stakeholder updated successfully."
      );
    } catch (error: any) {
      showToast(
        "error",
        error?.message || "Failed to save stakeholder"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStakeholder(item: Stakeholder) {
    const confirmed = window.confirm(
      `Delete stakeholder "${item.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(item.id);

      const response = await apiFetch(
        `/company/stakeholders/${item.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            "Failed to delete stakeholder"
        );
      }

      setStakeholders((prev) =>
        prev.filter(
          (stakeholder) =>
            stakeholder.id !== item.id
        )
      );

      showToast(
        "success",
        "Stakeholder deleted successfully."
      );
    } catch (error: any) {
      showToast(
        "error",
        error?.message || "Failed to delete stakeholder"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="space-y-6 p-6">

        {/* HEADER */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <ShieldCheck size={15} />
              Company Foundation
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Stakeholders
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Manage internal and external stakeholders,
              their relationships, strategic importance and
              organizational engagement context.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={17} />
            Add Stakeholder
          </button>
        </div>

        {/* KPI */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Stakeholders"
            value={stakeholders.length}
            description="Registered stakeholder relationships"
            icon={<Users size={18} />}
          />

          <StatCard
            label="Active"
            value={activeCount}
            description="Currently active relationships"
            icon={<ShieldCheck size={18} />}
          />

          <StatCard
            label="Critical"
            value={criticalCount}
            description="Critical strategic stakeholders"
            icon={<Building2 size={18} />}
          />

          <StatCard
            label="High Importance"
            value={highCount}
            description="High-priority relationships"
            icon={<MapPin size={18} />}
          />
        </div>

        {/* CONTROL BAR */}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_180px_160px]">

            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search stakeholders..."
                className={`${inputClass()} pl-9`}
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value)
              }
              className={inputClass()}
            >
              <option value="all">
                All Types
              </option>

              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={importanceFilter}
              onChange={(e) =>
                setImportanceFilter(e.target.value)
              }
              className={inputClass()}
            >
              <option value="all">
                All Importance
              </option>

              {IMPORTANCE_OPTIONS.map(
                (importance) => (
                  <option
                    key={importance}
                    value={importance}
                  >
                    {importance}
                  </option>
                )
              )}
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className={inputClass()}
            >
              <option value="all">
                All Status
              </option>

              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Stakeholder Register
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredStakeholders.length} of{" "}
                {stakeholders.length} stakeholders
              </p>
            </div>

            <div className="hidden text-xs text-slate-400 md:block">
              Enterprise stakeholder registry
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">
              Loading stakeholders...
            </div>
          ) : filteredStakeholders.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-slate-100 p-4 text-slate-400">
                <Users size={24} />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                No stakeholders found
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                No stakeholder records match the
                current search and filter criteria.
              </p>

              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus size={16} />
                Add Stakeholder
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Stakeholder
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Relationship
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Contact
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Importance
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Updated
                    </th>

                    <th className="w-20 px-5 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredStakeholders.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
                              <Building2 size={16} />
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {item.name}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {organizationName(
                                  item.organization_id
                                )}
                              </div>

                              {item.description && (
                                <div className="mt-1 max-w-[280px] truncate text-xs text-slate-400">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {item.stakeholder_type ||
                              "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.relationship || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {item.contact_person && (
                              <div className="text-sm font-medium text-slate-800">
                                {item.contact_person}
                              </div>
                            )}

                            {item.email && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Mail size={12} />
                                {item.email}
                              </div>
                            )}

                            {item.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Phone size={12} />
                                {item.phone}
                              </div>
                            )}

                            {!item.contact_person &&
                              !item.email &&
                              !item.phone && (
                                <span className="text-sm text-slate-400">
                                  —
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${importanceClass(
                              item.importance
                            )}`}
                          >
                            {item.importance ||
                              "Not Rated"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                              item.status
                            )}`}
                          >
                            {humanize(item.status)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500">
                          {formatDate(
                            item.updated_at ||
                              item.created_at
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(item)
                              }
                              title="Edit stakeholder"
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Edit3 size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteStakeholder(item)
                              }
                              disabled={
                                deletingId ===
                                item.id
                              }
                              title="Delete stakeholder"
                              className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 size={15} />
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
        </div>
      </div>

      {/* MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingId === null
                    ? "Add Stakeholder"
                    : "Edit Stakeholder"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Maintain the stakeholder register
                  and governance relationship context.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-145px)] overflow-y-auto px-6 py-5">
              <div className="space-y-6">

                <section>
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Stakeholder Identity
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Stakeholder Name *
                      </label>

                      <input
                        value={form.name}
                        onChange={(e) =>
                          updateForm(
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Information Security Authority"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Stakeholder Type
                      </label>

                      <select
                        value={
                          form.stakeholder_type
                        }
                        onChange={(e) =>
                          updateForm(
                            "stakeholder_type",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        <option value="">
                          Select type
                        </option>

                        {TYPE_OPTIONS.map(
                          (type) => (
                            <option
                              key={type}
                              value={type}
                            >
                              {type}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Organization
                      </label>

                      <select
                        value={
                          form.organization_id
                        }
                        onChange={(e) =>
                          updateForm(
                            "organization_id",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        <option value="">
                          No organization
                        </option>

                        {organizations.map(
                          (organization) => (
                            <option
                              key={organization.id}
                              value={
                                organization.id
                              }
                            >
                              {organization.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Relationship
                      </label>

                      <input
                        value={
                          form.relationship
                        }
                        onChange={(e) =>
                          updateForm(
                            "relationship",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Regulatory oversight, strategic supplier, customer"
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-6">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Governance Classification
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Importance
                      </label>

                      <select
                        value={
                          form.importance
                        }
                        onChange={(e) =>
                          updateForm(
                            "importance",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        {IMPORTANCE_OPTIONS.map(
                          (importance) => (
                            <option
                              key={importance}
                              value={importance}
                            >
                              {importance}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Status
                      </label>

                      <select
                        value={form.status}
                        onChange={(e) =>
                          updateForm(
                            "status",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        {STATUS_OPTIONS.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {humanize(status)}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Description
                      </label>

                      <textarea
                        value={
                          form.description
                        }
                        onChange={(e) =>
                          updateForm(
                            "description",
                            e.target.value
                          )
                        }
                        rows={4}
                        placeholder="Describe the stakeholder's relevance, expectations or governance context."
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-6">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact Information
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Contact Person
                      </label>

                      <input
                        value={
                          form.contact_person
                        }
                        onChange={(e) =>
                          updateForm(
                            "contact_person",
                            e.target.value
                          )
                        }
                        placeholder="Primary contact"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Email
                      </label>

                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          updateForm(
                            "email",
                            e.target.value
                          )
                        }
                        placeholder="contact@example.com"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Phone
                      </label>

                      <input
                        value={form.phone}
                        onChange={(e) =>
                          updateForm(
                            "phone",
                            e.target.value
                          )
                        }
                        placeholder="+90 ..."
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveStakeholder}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Create Stakeholder"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
          <div
            className={`text-sm font-medium ${
              toast.type === "success"
                ? "text-emerald-700"
                : "text-red-700"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
