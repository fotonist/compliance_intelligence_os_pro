"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Edit3,
  Eye,
  HardDrive,
  Info,
  Layers3,
  MapPin,
  Plus,
  Search,
  Shield,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { apiFetch } from "@/app/lib/api";

type User = {
  id: number;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type Department = {
  id: number;
  name: string;
  code?: string | null;
};

type Location = {
  id: number;
  name: string;
  code?: string | null;
  city?: string | null;
  country?: string | null;
};

type Asset = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  tenant_id: number;
  asset_type: string;
  criticality: string;
  status: string;
  lifecycle_status: string;
  information_classification?: string | null;
  owner_user_id?: number | null;
  custodian_user_id?: number | null;
  department?: string | null;
  location?: string | null;
  manufacturer?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  acquisition_date?: string | null;
  warranty_expiry?: string | null;
  contract_expiry?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AssetForm = {
  code: string;
  name: string;
  description: string;
  asset_type: string;
  criticality: string;
  status: string;
  lifecycle_status: string;
  information_classification: string;
  owner_user_id: string;
  custodian_user_id: string;
  department: string;
  location: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  acquisition_date: string;
  warranty_expiry: string;
  contract_expiry: string;
  notes: string;
};

const EMPTY_FORM: AssetForm = {
  code: "",
  name: "",
  description: "",
  asset_type: "other",
  criticality: "medium",
  status: "active",
  lifecycle_status: "in_service",
  information_classification: "",
  owner_user_id: "",
  custodian_user_id: "",
  department: "",
  location: "",
  manufacturer: "",
  model_number: "",
  serial_number: "",
  acquisition_date: "",
  warranty_expiry: "",
  contract_expiry: "",
  notes: "",
};

const ASSET_TYPES: [string, string][] = [
  ["information_system", "Information System"],
  ["application", "Application"],
  ["database", "Database"],
  ["server", "Server"],
  ["network", "Network Infrastructure"],
  ["endpoint", "Endpoint / Device"],
  ["cloud_service", "Cloud Service"],
  ["facility", "Facility"],
  ["physical", "Physical Asset"],
  ["service", "Business / IT Service"],
  ["document", "Document / Record"],
  ["data", "Data Asset"],
  ["other", "Other"],
];

const CRITICALITIES: [string, string][] = [
  ["critical", "Critical"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
];

const STATUSES: [string, string][] = [
  ["active", "Active"],
  ["inactive", "Inactive"],
];

const LIFECYCLE: [string, string][] = [
  ["planned", "Planned"],
  ["in_service", "In Service"],
  ["maintenance", "Maintenance"],
  ["retiring", "Retiring"],
  ["retired", "Retired"],
];

const CLASSIFICATIONS: [string, string][] = [
  ["public", "Public"],
  ["internal", "Internal"],
  ["confidential", "Confidential"],
  ["restricted", "Restricted"],
  ["highly_restricted", "Highly Restricted"],
];

function humanize(value?: string | null) {
  if (!value) return "Ã¢â‚¬â€";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Ã¢â‚¬â€";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function getUserName(
  id: number | null | undefined,
  users: User[]
) {
  if (!id) return "Unassigned";

  const user = users.find((item) => item.id === id);

  if (!user) return `User #${id}`;

  return (
    user.full_name ||
    user.username ||
    user.email ||
    `User #${id}`
  );
}

function criticalityClass(value?: string) {
  switch (value) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function statusClass(value?: string) {
  return value === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

function lifecycleClass(value?: string) {
  switch (value) {
    case "retired":
      return "border-slate-300 bg-slate-100 text-slate-600";
    case "retiring":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "maintenance":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const className =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={className}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
        >
          {options.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<
    Department[]
  >([]);
  const [locations, setLocations] = useState<Location[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionKey, setActionKey] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [detailAsset, setDetailAsset] =
    useState<Asset | null>(null);
  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<AssetForm>(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [criticalityFilter, setCriticalityFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [lifecycleFilter, setLifecycleFilter] =
    useState("all");

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(
    type: "success" | "error",
    message: string
  ) {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  async function loadAssets() {
    const res = await apiFetch("/company/assets");

    if (!res.ok) {
      throw new Error(
        (await res.text()) ||
          "Failed to load assets"
      );
    }

    setAssets(await res.json());
  }

  async function loadUsers() {
    try {
      const res = await apiFetch("/users");

      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {}
  }

  async function loadDepartments() {
    try {
      const res = await apiFetch(
        "/company/departments"
      );

      if (res.ok) {
        const data = await res.json();
        setDepartments(
          Array.isArray(data) ? data : []
        );
      }
    } catch {}
  }

  async function loadLocations() {
    try {
      const res = await apiFetch(
        "/company/locations"
      );

      if (res.ok) {
        const data = await res.json();
        setLocations(
          Array.isArray(data) ? data : []
        );
      }
    } catch {}
  }

  async function loadAll() {
    setLoading(true);

    try {
      await Promise.all([
        loadAssets(),
        loadUsers(),
        loadDepartments(),
        loadLocations(),
      ]);
    } catch (err: any) {
      showToast(
        "error",
        err?.message || "Failed to load assets"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const searchable = [
        asset.code,
        asset.name,
        asset.description,
        asset.asset_type,
        asset.criticality,
        asset.department,
        asset.location,
        asset.manufacturer,
        asset.model_number,
        asset.serial_number,
        asset.information_classification,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesType =
        typeFilter === "all" ||
        asset.asset_type === typeFilter;

      const matchesCriticality =
        criticalityFilter === "all" ||
        asset.criticality === criticalityFilter;

      const matchesStatus =
        statusFilter === "all" ||
        asset.status === statusFilter;

      const matchesLifecycle =
        lifecycleFilter === "all" ||
        asset.lifecycle_status === lifecycleFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesCriticality &&
        matchesStatus &&
        matchesLifecycle
      );
    });
  }, [
    assets,
    search,
    typeFilter,
    criticalityFilter,
    statusFilter,
    lifecycleFilter,
  ]);

  const metrics = useMemo(() => {
    const active = assets.filter(
      (asset) => asset.status === "active"
    ).length;

    const critical = assets.filter(
      (asset) => asset.criticality === "critical"
    ).length;

    const high = assets.filter(
      (asset) => asset.criticality === "high"
    ).length;

    const retiring = assets.filter(
      (asset) =>
        asset.lifecycle_status === "retiring"
    ).length;

    const classified = assets.filter(
      (asset) =>
        !!asset.information_classification
    ).length;

    return {
      total: assets.length,
      active,
      critical,
      high,
      retiring,
      classified,
    };
  }, [assets]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditingId(asset.id);

    setForm({
      code: asset.code || "",
      name: asset.name || "",
      description: asset.description || "",
      asset_type: asset.asset_type || "other",
      criticality: asset.criticality || "medium",
      status: asset.status || "active",
      lifecycle_status:
        asset.lifecycle_status || "in_service",
      information_classification:
        asset.information_classification || "",
      owner_user_id: asset.owner_user_id
        ? String(asset.owner_user_id)
        : "",
      custodian_user_id:
        asset.custodian_user_id
          ? String(asset.custodian_user_id)
          : "",
      department: asset.department || "",
      location: asset.location || "",
      manufacturer: asset.manufacturer || "",
      model_number: asset.model_number || "",
      serial_number: asset.serial_number || "",
      acquisition_date: toDateTimeLocal(
        asset.acquisition_date
      ),
      warranty_expiry: toDateTimeLocal(
        asset.warranty_expiry
      ),
      contract_expiry: toDateTimeLocal(
        asset.contract_expiry
      ),
      notes: asset.notes || "",
    });

    setModalOpen(true);
  }

  function updateForm(
    key: keyof AssetForm,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveAsset() {
    if (!form.code.trim()) {
      showToast(
        "error",
        "Asset code is required."
      );
      return;
    }

    if (!form.name.trim()) {
      showToast(
        "error",
        "Asset name is required."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description:
          form.description.trim() || null,
        asset_type: form.asset_type,
        criticality: form.criticality,
        status: form.status,
        lifecycle_status:
          form.lifecycle_status,
        information_classification:
          form.information_classification ||
          null,
        owner_user_id:
          form.owner_user_id
            ? Number(form.owner_user_id)
            : null,
        custodian_user_id:
          form.custodian_user_id
            ? Number(form.custodian_user_id)
            : null,
        department:
          form.department.trim() || null,
        location:
          form.location.trim() || null,
        manufacturer:
          form.manufacturer.trim() || null,
        model_number:
          form.model_number.trim() || null,
        serial_number:
          form.serial_number.trim() || null,
        acquisition_date: toIso(
          form.acquisition_date
        ),
        warranty_expiry: toIso(
          form.warranty_expiry
        ),
        contract_expiry: toIso(
          form.contract_expiry
        ),
        notes: form.notes.trim() || null,
      };

      const endpoint =
        editingId === null
          ? "/company/assets"
          : `/company/assets/${editingId}`;

      const res = await apiFetch(endpoint, {
        method:
          editingId === null ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to save asset"
        );
      }

      await loadAssets();

      setModalOpen(false);

      showToast(
        "success",
        editingId === null
          ? "Asset created successfully."
          : "Asset updated successfully."
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.message || "Failed to save asset"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(asset: Asset) {
    const confirmed = window.confirm(
      `Delete asset "${asset.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setActionKey(`delete-${asset.id}`);

    try {
      const res = await apiFetch(
        `/company/assets/${asset.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to delete asset"
        );
      }

      await loadAssets();

      if (detailAsset?.id === asset.id) {
        setDetailAsset(null);
      }

      showToast(
        "success",
        "Asset deleted successfully."
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.message || "Failed to delete asset"
      );
    } finally {
      setActionKey("");
    }
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setCriticalityFilter("all");
    setStatusFilter("all");
    setLifecycleFilter("all");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-100" />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map(
            (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl bg-slate-100"
              />
            )
          )}
        </div>

        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-[100] flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-white text-emerald-700"
              : "border-red-200 bg-white text-red-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}

          <span>{toast.message}</span>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded p-1 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <HardDrive size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Assets &amp; Resources
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Govern the organization's information,
                technology, physical and service assets
                across their lifecycle.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus size={17} />
          Add Asset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Assets
            </span>
            <Layers3 size={17} className="text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">
            {metrics.total}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Active
            </span>
            <CheckCircle2
              size={17}
              className="text-emerald-600"
            />
          </div>
          <div className="mt-3 text-2xl font-semibold text-emerald-800">
            {metrics.active}
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Critical
            </span>
            <Shield
              size={17}
              className="text-red-600"
            />
          </div>
          <div className="mt-3 text-2xl font-semibold text-red-800">
            {metrics.critical}
          </div>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              High Risk
            </span>
            <AlertTriangle
              size={17}
              className="text-orange-600"
            />
          </div>
          <div className="mt-3 text-2xl font-semibold text-orange-800">
            {metrics.high}
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Retiring
            </span>
            <Archive
              size={17}
              className="text-blue-600"
            />
          </div>
          <div className="mt-3 text-2xl font-semibold text-blue-800">
            {metrics.retiring}
          </div>
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Classified
            </span>
            <Info
              size={17}
              className="text-violet-600"
            />
          </div>
          <div className="mt-3 text-2xl font-semibold text-violet-800">
            {metrics.classified}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search by code, name, owner, department, location, serial number..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:w-[760px]">
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Types
                </option>

                {ASSET_TYPES.map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <select
                value={criticalityFilter}
                onChange={(e) =>
                  setCriticalityFilter(
                    e.target.value
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Criticality
                </option>

                {CRITICALITIES.map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Status
                </option>

                {STATUSES.map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <select
                value={lifecycleFilter}
                onChange={(e) =>
                  setLifecycleFilter(
                    e.target.value
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Lifecycle
                </option>

                {LIFECYCLE.map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {(search ||
            typeFilter !== "all" ||
            criticalityFilter !== "all" ||
            statusFilter !== "all" ||
            lifecycleFilter !== "all") && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing{" "}
                <strong className="text-slate-700">
                  {filteredAssets.length}
                </strong>{" "}
                of {assets.length} assets
              </span>

              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {filteredAssets.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <HardDrive size={21} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No assets found
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              No assets match the current search and
              filter criteria.
            </p>

            {assets.length === 0 ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus size={16} />
                Add First Asset
              </button>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 text-sm font-semibold text-slate-700 underline underline-offset-4"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">
                    Asset
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Criticality
                  </th>
                  <th className="px-4 py-3">
                    Owner
                  </th>
                  <th className="px-4 py-3">
                    Department
                  </th>
                  <th className="px-4 py-3">
                    Location
                  </th>
                  <th className="px-4 py-3">
                    Lifecycle
                  </th>
                  <th className="px-4 py-3">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setDetailAsset(asset)
                        }
                        className="text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <HardDrive size={16} />
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">
                              {asset.name}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-500">
                              {asset.code}
                              {asset.serial_number
                                ? ` Ã‚Â· SN ${asset.serial_number}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </button>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {humanize(
                        asset.asset_type
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${criticalityClass(
                          asset.criticality
                        )}`}
                      >
                        {humanize(
                          asset.criticality
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <UserRound
                          size={14}
                          className="text-slate-400"
                        />
                        {getUserName(
                          asset.owner_user_id,
                          users
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {asset.department || "Ã¢â‚¬â€"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin
                          size={14}
                          className="text-slate-400"
                        />
                        {asset.location || "Ã¢â‚¬â€"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleClass(
                          asset.lifecycle_status
                        )}`}
                      >
                        {humanize(
                          asset.lifecycle_status
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                          asset.status
                        )}`}
                      >
                        {humanize(asset.status)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="View asset"
                          onClick={() =>
                            setDetailAsset(asset)
                          }
                          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          title="Edit asset"
                          onClick={() =>
                            openEdit(asset)
                          }
                          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          type="button"
                          title="Delete asset"
                          disabled={
                            actionKey ===
                            `delete-${asset.id}`
                          }
                          onClick={() =>
                            deleteAsset(asset)
                          }
                          className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <HardDrive size={20} />
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {detailAsset.code}
                  </div>

                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {detailAsset.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDetailAsset(null)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${criticalityClass(
                    detailAsset.criticality
                  )}`}
                >
                  {humanize(
                    detailAsset.criticality
                  )} Criticality
                </span>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleClass(
                    detailAsset.lifecycle_status
                  )}`}
                >
                  {humanize(
                    detailAsset.lifecycle_status
                  )}
                </span>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                    detailAsset.status
                  )}`}
                >
                  {humanize(detailAsset.status)}
                </span>
              </div>

              <Section
                title="Asset Identity"
                description="Core inventory and classification information."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Asset Type
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {humanize(
                        detailAsset.asset_type
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Information Classification
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {humanize(
                        detailAsset.information_classification
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Serial Number
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {detailAsset.serial_number ||
                        "Ã¢â‚¬â€"}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <div className="text-xs font-medium text-slate-500">
                      Description
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {detailAsset.description ||
                        "No description provided."}
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                title="Governance & Ownership"
                description="Accountability and organizational placement."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Asset Owner
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <UserRound
                        size={15}
                        className="text-slate-400"
                      />
                      {getUserName(
                        detailAsset.owner_user_id,
                        users
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Custodian
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <UserRound
                        size={15}
                        className="text-slate-400"
                      />
                      {getUserName(
                        detailAsset.custodian_user_id,
                        users
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Department
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {detailAsset.department ||
                        "Ã¢â‚¬â€"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Location
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {detailAsset.location ||
                        "Ã¢â‚¬â€"}
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                title="Technical & Commercial Information"
                description="Physical, technical and contract information."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Manufacturer
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {detailAsset.manufacturer ||
                        "Ã¢â‚¬â€"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Model
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {detailAsset.model_number ||
                        "Ã¢â‚¬â€"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Serial Number
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {detailAsset.serial_number ||
                        "Ã¢â‚¬â€"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Acquisition Date
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {formatDate(
                        detailAsset.acquisition_date
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Warranty Expiry
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {formatDate(
                        detailAsset.warranty_expiry
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Contract Expiry
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {formatDate(
                        detailAsset.contract_expiry
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              {detailAsset.notes && (
                <Section title="Notes">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailAsset.notes}
                  </p>
                </Section>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setDetailAsset(null);
                  openEdit(detailAsset);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit Asset
              </button>

              <button
                type="button"
                onClick={() =>
                  setDetailAsset(null)
                }
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Asset Registry
                </div>

                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {editingId
                    ? "Edit Asset"
                    : "Register Asset"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Establish ownership, classification,
                  lifecycle and operational context.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                <Section
                  title="Asset Identity"
                  description="Define the asset's unique identity and governance classification."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field
                      label="Asset Code"
                      value={form.code}
                      onChange={(value) =>
                        updateForm(
                          "code",
                          value
                        )
                      }
                      placeholder="e.g. AST-0001"
                      required
                    />

                    <div className="md:col-span-2">
                      <Field
                        label="Asset Name"
                        value={form.name}
                        onChange={(value) =>
                          updateForm(
                            "name",
                            value
                          )
                        }
                        placeholder="e.g. Corporate ERP Platform"
                        required
                      />
                    </div>

                    <SelectField
                      label="Asset Type"
                      value={form.asset_type}
                      onChange={(value) =>
                        updateForm(
                          "asset_type",
                          value
                        )
                      }
                      options={ASSET_TYPES}
                    />

                    <SelectField
                      label="Criticality"
                      value={form.criticality}
                      onChange={(value) =>
                        updateForm(
                          "criticality",
                          value
                        )
                      }
                      options={CRITICALITIES}
                    />

                    <SelectField
                      label="Information Classification"
                      value={
                        form.information_classification
                      }
                      onChange={(value) =>
                        updateForm(
                          "information_classification",
                          value
                        )
                      }
                      options={[
                        ["", "Not Classified"],
                        ...CLASSIFICATIONS,
                      ]}
                    />

                    <div className="md:col-span-3">
                      <Field
                        label="Description"
                        value={form.description}
                        onChange={(value) =>
                          updateForm(
                            "description",
                            value
                          )
                        }
                        placeholder="Describe the asset, its purpose and business context."
                        textarea
                      />
                    </div>
                  </div>
                </Section>

                <Section
                  title="Governance & Ownership"
                  description="Assign accountable ownership and operational custody."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Asset Owner
                      </label>

                      <select
                        value={form.owner_user_id}
                        onChange={(e) =>
                          updateForm(
                            "owner_user_id",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {users.map((user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {getUserName(
                              user.id,
                              users
                            )}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Custodian
                      </label>

                      <select
                        value={
                          form.custodian_user_id
                        }
                        onChange={(e) =>
                          updateForm(
                            "custodian_user_id",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {users.map((user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {getUserName(
                              user.id,
                              users
                            )}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Department
                      </label>

                      <input
                        list="asset-departments"
                        value={form.department}
                        onChange={(e) =>
                          updateForm(
                            "department",
                            e.target.value
                          )
                        }
                        placeholder="Select or enter department"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                      />

                      <datalist id="asset-departments">
                        {departments.map(
                          (department) => (
                            <option
                              key={department.id}
                              value={
                                department.name
                              }
                            />
                          )
                        )}
                      </datalist>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Location
                      </label>

                      <input
                        list="asset-locations"
                        value={form.location}
                        onChange={(e) =>
                          updateForm(
                            "location",
                            e.target.value
                          )
                        }
                        placeholder="Select or enter location"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                      />

                      <datalist id="asset-locations">
                        {locations.map(
                          (location) => (
                            <option
                              key={location.id}
                              value={location.name}
                            />
                          )
                        )}
                      </datalist>
                    </div>
                  </div>
                </Section>

                <Section
                  title="Lifecycle & Operational Status"
                  description="Control the current operating state and lifecycle position."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SelectField
                      label="Status"
                      value={form.status}
                      onChange={(value) =>
                        updateForm(
                          "status",
                          value
                        )
                      }
                      options={STATUSES}
                    />

                    <SelectField
                      label="Lifecycle Status"
                      value={
                        form.lifecycle_status
                      }
                      onChange={(value) =>
                        updateForm(
                          "lifecycle_status",
                          value
                        )
                      }
                      options={LIFECYCLE}
                    />
                  </div>
                </Section>

                <Section
                  title="Technical & Commercial Information"
                  description="Capture technical identity and lifecycle dates where applicable."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field
                      label="Manufacturer"
                      value={form.manufacturer}
                      onChange={(value) =>
                        updateForm(
                          "manufacturer",
                          value
                        )
                      }
                      placeholder="e.g. Microsoft"
                    />

                    <Field
                      label="Model / Version"
                      value={form.model_number}
                      onChange={(value) =>
                        updateForm(
                          "model_number",
                          value
                        )
                      }
                      placeholder="e.g. Dynamics 365"
                    />

                    <Field
                      label="Serial Number"
                      value={form.serial_number}
                      onChange={(value) =>
                        updateForm(
                          "serial_number",
                          value
                        )
                      }
                      placeholder="Asset serial / identifier"
                    />

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Acquisition Date
                      </label>

                      <input
                        type="datetime-local"
                        value={
                          form.acquisition_date
                        }
                        onChange={(e) =>
                          updateForm(
                            "acquisition_date",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Warranty Expiry
                      </label>

                      <input
                        type="datetime-local"
                        value={
                          form.warranty_expiry
                        }
                        onChange={(e) =>
                          updateForm(
                            "warranty_expiry",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Contract Expiry
                      </label>

                      <input
                        type="datetime-local"
                        value={
                          form.contract_expiry
                        }
                        onChange={(e) =>
                          updateForm(
                            "contract_expiry",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </Section>

                <Section
                  title="Notes"
                  description="Additional operational or governance context."
                >
                  <Field
                    label="Notes"
                    value={form.notes}
                    onChange={(value) =>
                      updateForm(
                        "notes",
                        value
                      )
                    }
                    placeholder="Additional notes, dependencies, renewal considerations, exceptions..."
                    textarea
                  />
                </Section>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveAsset}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Save Changes"
                  : "Register Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

