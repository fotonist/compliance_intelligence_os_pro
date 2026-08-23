"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type ProcessType = "core" | "support" | "management";
type ProcessStatus = "draft" | "active" | "archived";

type ProcessRow = {
  id: number;
  code: string;
  name: string;
  type: ProcessType;
  owner: string;
  status: ProcessStatus;
  updated_at?: string | null;
};

const TYPE_LABEL: Record<ProcessType, string> = {
  core: "Core",
  support: "Support",
  management: "Management",
};

function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "border border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
      : variant === "secondary"
      ? "border border-emerald-700 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

function Input({
  className = "",
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      value={value ?? ""}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  );
}

function Select({
  className = "",
  value,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      value={value ?? ""}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  );
}

function StatusBadge({ status }: { status: ProcessStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Active
      </span>
    );
  }

  if (status === "archived") {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        Archived
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      Draft
    </span>
  );
}

function TypeBadge({ type }: { type: ProcessType }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
      {TYPE_LABEL[type]}
    </span>
  );
}

export default function ProcessesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<ProcessRow[]>([]);
  const [q, setQ] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [create, setCreate] = useState<{
    code: string;
    name: string;
    type: ProcessType;
    owner: string;
    status: ProcessStatus;
  }>({
    code: "",
    name: "",
    type: "core",
    owner: "",
    status: "draft",
  });

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();

    if (!search) {
      return rows;
    }

    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(search) ||
        r.name.toLowerCase().includes(search) ||
        (r.owner || "").toLowerCase().includes(search)
    );
  }, [rows, q]);

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch("/company/processes", {
        method: "GET",
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(
          text || `Failed to load processes (${res.status})`
        );
      }

      const json = await res.json();

      setRows(
        Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
          ? json.items
          : []
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load processes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function createProcess() {
    if (!create.code.trim() || !create.name.trim()) {
      setError("Code and Name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = {
        code: create.code.trim(),
        name: create.name.trim(),
        type: create.type,
        owner: create.owner.trim(),
        status: create.status,
      };

      const res = await apiFetch("/company/processes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(
          text || `Create failed (${res.status})`
        );
      }

      setNotice("Process created successfully.");

      setShowCreate(false);

      setCreate({
        code: "",
        name: "",
        type: "core",
        owner: "",
        status: "draft",
      });

      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to create process.");
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setError(null);
    setNotice(null);
    setShowCreate(true);
  }

  function closeCreate() {
    if (saving) return;

    setShowCreate(false);

    setCreate({
      code: "",
      name: "",
      type: "core",
      owner: "",
      status: "draft",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Processes
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Process catalog for linking risks, controls, evidence and KPIs
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={load}
            disabled={loading || saving}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>

          <Button
            variant="primary"
            onClick={openCreate}
            disabled={loading || saving}
          >
            + Create Process
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-700">
              Search Processes
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              Search by code, process name or owner
            </div>
          </div>

          <div className="w-full sm:max-w-md">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="code, name, owner..."
            />
          </div>
        </div>
      </div>

      {/* Create Process */}
      {showCreate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Create Process
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Define a process that can later be connected to risks,
                controls, evidence and KPIs.
              </p>
            </div>

            <button
              type="button"
              onClick={closeCreate}
              disabled={saving}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-900 disabled:opacity-50"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Code *
              </label>

              <Input
                value={create.code}
                onChange={(e) =>
                  setCreate((p) => ({
                    ...p,
                    code: e.target.value,
                  }))
                }
                placeholder="PRC-001"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Name *
              </label>

              <Input
                value={create.name}
                onChange={(e) =>
                  setCreate((p) => ({
                    ...p,
                    name: e.target.value,
                  }))
                }
                placeholder="Information Security Management"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Type
              </label>

              <Select
                value={create.type}
                onChange={(e) =>
                  setCreate((p) => ({
                    ...p,
                    type: e.target.value as ProcessType,
                  }))
                }
              >
                <option value="core">Core</option>
                <option value="support">Support</option>
                <option value="management">Management</option>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Owner
              </label>

              <Input
                value={create.owner}
                onChange={(e) =>
                  setCreate((p) => ({
                    ...p,
                    owner: e.target.value,
                  }))
                }
                placeholder="Role / Responsible Person"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Status
              </label>

              <Select
                value={create.status}
                onChange={(e) =>
                  setCreate((p) => ({
                    ...p,
                    status: e.target.value as ProcessStatus,
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={createProcess}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Process"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Process Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left font-semibold text-slate-700">
                  Code
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-700">
                  Process
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-700">
                  Type
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-700">
                  Owner
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-700">
                  Status
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-700">
                  Updated
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading processes...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No processes found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() =>
                      router.push(`/company/processes/${r.id}`)
                    }
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {r.code}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {r.name}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <TypeBadge type={r.type} />
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {r.owner || "-"}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>

                    <td className="px-5 py-4 text-slate-500">
                      {r.updated_at ? formatDate(r.updated_at) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading ? (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
            <div className="text-xs text-slate-500">
              {filtered.length} process
              {filtered.length === 1 ? "" : "es"}
              {q.trim() ? " matching your search" : ""}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  } catch {
    return value;
  }
}

async function safeText(res: Response) {
  try {
    const text = await res.text();
    return (text || "").slice(0, 500);
  } catch {
    return "";
  }
}
