"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Layers3,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/services/api";

type MatrixInstance = {
  id: number;
  standard_id?: number;
  standard_code?: string;
  standard_version_id?: number;
  standard_version_status?: string;
  status: string;
  created_by?: number | null;
  created_at: string;
};

function normalizeStatus(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function statusLabel(value?: string) {
  const normalized = normalizeStatus(value);

  switch (normalized) {
    case "generated":
      return "Generated";
    case "in_progress":
      return "In Progress";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "closed":
      return "Closed";
    default:
      return value
        ? value
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "Unknown";
  }
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = normalizeStatus(status);

  let classes =
    "border-slate-200 bg-slate-50 text-slate-600";

  let dot = "bg-slate-400";

  if (normalized === "generated") {
    classes = "border-blue-200 bg-blue-50 text-blue-700";
    dot = "bg-blue-500";
  }

  if (normalized === "in_progress") {
    classes = "border-amber-200 bg-amber-50 text-amber-700";
    dot = "bg-amber-500";
  }

  if (normalized === "submitted") {
    classes = "border-indigo-200 bg-indigo-50 text-indigo-700";
    dot = "bg-indigo-500";
  }

  if (normalized === "approved") {
    classes = "border-emerald-200 bg-emerald-50 text-emerald-700";
    dot = "bg-emerald-500";
  }

  if (normalized === "closed") {
    classes = "border-slate-200 bg-slate-100 text-slate-600";
    dot = "bg-slate-500";
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {statusLabel(status)}
    </span>
  );
}

function VersionBadge({
  version,
  status,
}: {
  version?: number;
  status?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="whitespace-nowrap font-medium text-slate-800">
        {version != null ? `Version ${version}` : "Version —"}
      </span>

      {status && (
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {statusLabel(status)}
        </span>
      )}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function KpiCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="min-w-0 border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div className="shrink-0 text-slate-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function MatrixInstancesClient() {
  const router = useRouter();
  const params = useSearchParams();
  const standardId = params.get("standard_id");
const [items, setItems] = useState<MatrixInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [versionFilter, setVersionFilter] = useState("all");
  const [menuId, setMenuId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<MatrixInstance | null>(null);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);
  useEffect(() => {
    loadInstances();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardId]);

  async function loadInstances() {
    setLoading(true);
    setError(null);

    try {
      const query = standardId
        ? `?standard_id=${encodeURIComponent(standardId)}`
        : "";

      const res = await apiFetch(
        `/matrix/instances${query}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const resolved: MatrixInstance[] = Array.isArray(data)
        ? data
        : (data?.items ?? []);

      setItems(resolved);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load matrix instances"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteInstance() {
    if (!deleteTarget) return;

    const id = deleteTarget.id;

    setDeletingId(id);
    setError(null);

    try {
      const res = await apiFetch(
        `/matrix/instances/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const responseText = await res.text();

        let message = `HTTP ${res.status}`;

        try {
          const data = JSON.parse(responseText);

          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          if (responseText) {
            message = responseText;
          }
        }

        throw new Error(message);
      }

      setDeleteTarget(null);
      setMenuId(null);

      await loadInstances();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete matrix instance"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const versions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.standard_version_id)
            .filter((v): v is number => v != null)
        )
      ).sort((a, b) => a - b),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        String(item.id).includes(query) ||
        String(item.standard_id ?? "").includes(query) ||
        String(item.standard_code ?? "")
          .toLowerCase()
          .includes(query) ||
        normalizeStatus(item.status).includes(query) ||
        normalizeStatus(item.standard_version_status).includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        normalizeStatus(item.status) === statusFilter;

      const matchesVersion =
        versionFilter === "all" ||
        String(item.standard_version_id) === versionFilter;

      return matchesSearch && matchesStatus && matchesVersion;
    });
  }, [items, search, statusFilter, versionFilter]);

  const total = items.length;

  const active = items.filter((item) =>
    ["generated", "in_progress"].includes(
      normalizeStatus(item.status)
    )
  ).length;

  const submitted = items.filter(
    (item) => normalizeStatus(item.status) === "submitted"
  ).length;

  const approved = items.filter(
    (item) => normalizeStatus(item.status) === "approved"
  ).length;

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    versionFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setVersionFilter("all");
  }

  return (
    <main className="min-w-0 bg-slate-50">
      <div className="mx-auto w-full max-w-[1680px] px-6 py-7 lg:px-8">

        {/* Page header */}
        <div className="mb-7 flex min-w-0 items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              <Layers3 className="h-3.5 w-3.5" />
              Compliance Management
            </div>

            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
              Matrix Instances
            </h1>

            <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
              Generated compliance assessment matrices and their lifecycle
              status.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => loadInstances()}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mb-6 grid grid-cols-1 border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Layers3 className="h-5 w-5" />}
            label="Total Instances"
            value={total}
            description="All generated matrices"
          />

          <KpiCard
            icon={<Activity className="h-5 w-5" />}
            label="Active"
            value={active}
            description="Generated or in progress"
          />

          <KpiCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Submitted"
            value={submitted}
            description="Awaiting approval"
          />

          <KpiCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Approved"
            value={approved}
            description="Approved instances"
          />
        </div>

        {/* Filters */}
        <section className="mb-5 border border-slate-200 bg-white">
          <div className="flex min-w-0 flex-col gap-3 p-3 lg:flex-row lg:items-center">

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by instance, standard or status"
                className="h-9 w-full min-w-0 border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <select
                  value={versionFilter}
                  onChange={(e) => setVersionFilter(e.target.value)}
                  className="h-9 min-w-[145px] appearance-none border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="all">All versions</option>

                  {versions.map((version) => (
                    <option key={version} value={String(version)}>
                      Version {version}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 min-w-[145px] appearance-none border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="all">All statuses</option>
                  <option value="generated">Generated</option>
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="closed">Closed</option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center justify-center gap-1.5 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {filteredItems.length}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {items.length}
                </span>{" "}
                instances
              </span>
            </div>

            {standardId && (
              <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                Standard #{standardId}
              </span>
            )}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">
              Unable to load matrix instances
            </p>

            <p className="mt-1 break-words text-xs text-red-600">
              {error}
            </p>
          </div>
        )}

        {/* Table */}
        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-[110px] px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Instance
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Standard
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Version
                  </th>

                  <th className="w-[170px] px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Status
                  </th>

                  <th className="w-[210px] px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Created
                  </th>

                  <th className="w-[135px] px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={6} className="px-5 py-4">
                        <div className="h-10 animate-pulse bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-md">
                        <Layers3 className="mx-auto h-7 w-7 text-slate-300" />

                        <p className="mt-3 text-sm font-medium text-slate-700">
                          {hasFilters
                            ? "No matching matrix instances"
                            : "No matrix instances found"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {hasFilters
                            ? "Adjust the search criteria or filters."
                            : "Generated compliance matrices will appear here."}
                        </p>

                        {hasFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-slate-50/80"
                    >

                      {/* Instance */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            #{item.id}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              Matrix Instance
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Assessment matrix
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Standard */}
                      <td className="px-5 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {item.standard_code ??
                              (item.standard_id
                                ? `Standard #${item.standard_id}`
                                : "Unknown")}
                          </p>

                          {item.standard_id && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Standard ID {item.standard_id}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Version */}
                      <td className="px-5 py-4">
                        <VersionBadge
                          version={item.standard_version_id}
                          status={item.standard_version_status}
                        />
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={item.status} />
                      </td>

                      {/* Created */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />

                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-700">
                              {formatDate(item.created_at)}
                            </p>

                            {item.created_by != null && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                Created by user #{item.created_by}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="relative flex items-center justify-end gap-1">

                          <Link
                            href={`/matrix/instances/${item.id}`}
                            className="inline-flex h-8 items-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                          >
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              setMenuId(
                                menuId === item.id
                                  ? null
                                  : item.id
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label={`Actions for Matrix ${item.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {menuId === item.id && (
                            <div className="absolute right-0 top-10 z-30 w-48 border border-slate-200 bg-white p-1 shadow-lg">

                              <Link
                                href={`/matrix/instances/${item.id}`}
                                onClick={() => setMenuId(null)}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                View instance
                              </Link>

                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null);
                                  setDeleteTarget(item);
                                }}
                                disabled={
                                  deletingId === item.id ||
                                  [
                                    "submitted",
                                    "approved",
                                    "completed",
                                    "closed",
                                  ].includes(
                                    normalizeStatus(item.status)
                                  )
                                }
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
                              >
                                <X className="h-3.5 w-3.5" />
                                Delete instance
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredItems.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <p className="text-xs text-slate-500">
                {filteredItems.length} instance
                {filteredItems.length === 1 ? "" : "s"}
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="inline-flex h-7 w-7 items-center justify-center border border-slate-200 bg-white text-slate-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>

                <span className="px-2 text-xs font-medium text-slate-600">
                  1
                </span>

                <button
                  type="button"
                  disabled
                  className="inline-flex h-7 w-7 items-center justify-center border border-slate-200 bg-white text-slate-300"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    {deleteTarget && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-matrix-title"
      >
        <div className="w-full max-w-md border border-slate-200 bg-white shadow-2xl">

          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600">
                  Destructive action
                </p>

                <h2
                  id="delete-matrix-title"
                  className="mt-1 text-lg font-semibold text-slate-900"
                >
                  Delete matrix instance?
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className="inline-flex h-8 w-8 items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-mono text-xs font-semibold text-slate-700">
                Matrix Instance #{deleteTarget.id}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {deleteTarget.standard_code ?? "Unknown standard"}
                {" · "}
                {deleteTarget.standard_version_id != null
                  ? `Version ${deleteTarget.standard_version_id}`
                  : "Version —"}
              </p>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              This will permanently remove this matrix instance
              and its generated matrix rows.
            </p>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Canonical controls, practices, evidence, risks,
              tasks and gaps are not deleted by this action.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingId === deleteTarget.id}
              className="h-9 border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={deleteInstance}
              disabled={deletingId === deleteTarget.id}
              className="inline-flex h-9 items-center gap-2 bg-red-700 px-4 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingId === deleteTarget.id ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5" />
                  Delete instance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    </main>
  );
}
