"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Person = {
  id: number;
  name?: string | null;
};

type MasterDocument = {
  document_id: number | null;
  procedure_id: number;
  document_name: string;
  document_type: string;
  procedure_code: string;
  owner: Person | null;
  version: string;
  status: string;
  procedure_status: string;
  document_status: string | null;
  effective_date: string | null;
  review_definition: string | null;
  next_review: string | null;
  review_status: string;
  approver: Person | null;
  last_updated: string | null;
  control_count: number;
  has_current_document: boolean;
};

type Summary = {
  master_documents: number;
  effective: number;
  under_review: number;
  draft: number;
  expired: number;
  review_due_30d: number;
};

type ApiResponse = {
  items: MasterDocument[];
  total: number;
  summary: Summary;
};

const EMPTY_SUMMARY: Summary = {
  master_documents: 0,
  effective: 0,
  under_review: 0,
  draft: 0,
  expired: 0,
  review_due_30d: 0,
};

const STATUS_OPTIONS = [
  ["all", "All statuses"],
  ["effective", "Effective"],
  ["under_review", "Under Review"],
  ["draft", "Draft"],
  ["expired", "Expired"],
  ["archived", "Archived"],
];

const REVIEW_OPTIONS = [
  ["all", "All review states"],
  ["current", "Current"],
  ["due_soon", "Due Soon"],
  ["due_today", "Due Today"],
  ["overdue", "Overdue"],
  ["not_scheduled", "Not Scheduled"],
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function statusLabel(value?: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function personName(person?: Person | null) {
  if (!person) return "Unassigned";
  return person.name || `User #${person.id}`;
}

function statusClasses(status: string) {
  switch (status) {
    case "effective":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "expired":
      return "border-red-200 bg-red-50 text-red-700";
    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function reviewClasses(status: string) {
  switch (status) {
    case "overdue":
      return "border-red-200 bg-red-50 text-red-700";
    case "due_today":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "due_soon":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "current":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
          <div className="mt-1 text-xs text-slate-500">{detail}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DocumentControlPage() {
  const router = useRouter();

  const [items, setItems] = useState<MasterDocument[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");

  const [selected, setSelected] = useState<MasterDocument | null>(null);

  async function loadData(initial = false) {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await apiFetch("/governance/documents");

      if (!response.ok) {
        throw new Error(
          (await response.text()) || "Failed to load document register"
        );
      }

      const data = (await response.json()) as ApiResponse;

      setItems(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary || EMPTY_SUMMARY);
    } catch (err: any) {
      setError(err?.message || "Failed to load document register");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(true);
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.document_name.toLowerCase().includes(query) ||
        item.procedure_code.toLowerCase().includes(query) ||
        item.document_type.toLowerCase().includes(query) ||
        personName(item.owner).toLowerCase().includes(query) ||
        personName(item.approver).toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesReview =
        reviewFilter === "all" || item.review_status === reviewFilter;

      return matchesSearch && matchesStatus && matchesReview;
    });
  }, [items, search, statusFilter, reviewFilter]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setReviewFilter("all");
  }

  function openProcedure(item: MasterDocument) {
    router.push(`/governance/procedures/${item.procedure_id}`);
  }

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-72 rounded bg-slate-200" />
            <div className="h-4 w-[520px] rounded bg-slate-200" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 rounded-xl bg-white ring-1 ring-slate-200"
                />
              ))}
            </div>
            <div className="h-[520px] rounded-xl bg-white ring-1 ring-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Governance</span>
              <span>/</span>
              <span className="text-slate-700">Document Control</span>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <ShieldCheck size={20} className="text-slate-700" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Document Control
              </h1>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Maintain the authoritative register of controlled master
              documents, ownership, effective versions and review obligations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadData()}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 text-red-600" />
              <div>
                <div className="text-sm font-semibold text-red-800">
                  Document register could not be loaded
                </div>
                <div className="mt-1 text-sm text-red-700">{error}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadData(true)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Master Documents"
            value={summary.master_documents}
            detail="Controlled register"
            icon={<FileText size={16} />}
          />
          <MetricCard
            label="Effective"
            value={summary.effective}
            detail="Current approved"
            icon={<CheckCircle2 size={16} />}
          />
          <MetricCard
            label="Under Review"
            value={summary.under_review}
            detail="Review in progress"
            icon={<Clock3 size={16} />}
          />
          <MetricCard
            label="Draft"
            value={summary.draft}
            detail="Not yet effective"
            icon={<FileText size={16} />}
          />
          <MetricCard
            label="Expired"
            value={summary.expired}
            detail="Requires attention"
            icon={<XCircle size={16} />}
          />
          <MetricCard
            label="Review Due < 30d"
            value={summary.review_due_30d}
            detail="Upcoming review"
            icon={<CalendarClock size={16} />}
          />
        </div>

        <div className="mt-7 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-950">
                    Master Document Register
                  </h2>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {filteredItems.length} records
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Authoritative view of current controlled governance
                  documents.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Filter size={14} />
                <span>
                  {search ||
                  statusFilter !== "all" ||
                  reviewFilter !== "all"
                    ? "Filters applied"
                    : "All records"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(320px,1fr)_190px_190px_auto]">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search document, code, owner or approver..."
                  className={`${inputClass()} pl-9`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass()}
              >
                {STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value)}
                className={inputClass()}
              >
                {REVIEW_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Archive size={28} className="mx-auto text-slate-300" />
              <div className="mt-3 text-sm font-semibold text-slate-900">
                No master documents found
              </div>
              <div className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                No controlled document matches the current filters.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] w-full">
                <thead>
                  <tr className="border-t border-slate-100 bg-slate-50 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Document
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Owner
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Version
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Effective Date
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Review Definition
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Next Review
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Review Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Approver
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Controls
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Last Updated
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.procedure_id}
                      className="group transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelected(item)}
                          className="text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm">
                              <FileText size={15} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 group-hover:text-slate-700">
                                {item.document_name}
                              </div>
                              <div className="mt-1 text-xs font-medium text-slate-400">
                                {item.procedure_code} · {item.document_type}
                              </div>
                            </div>
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <UserRound size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-600">
                            {personName(item.owner)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                        v{item.version}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                            item.status
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(item.effective_date)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-700">
                          {item.review_definition || "No Scheduled Review"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-slate-700">
                          {formatDate(item.next_review)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${reviewClasses(
                            item.review_status
                          )}`}
                        >
                          {statusLabel(item.review_status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {personName(item.approver)}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex min-w-8 justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                          {item.control_count}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(item.last_updated)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openProcedure(item)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-600">
                  {filteredItems.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-600">
                  {summary.master_documents}
                </span>{" "}
                master documents
              </span>

              <span>Tenant-scoped register</span>
            </div>
          </div>
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 bg-slate-950/30">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelected(null)}
              className="absolute inset-0 cursor-default"
            />

            <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Master Document
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    {selected.document_name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  X
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Version
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      v{selected.version}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Status
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                          selected.status
                        )}`}
                      >
                        {statusLabel(selected.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Governance
                  </div>

                  <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">Owner</span>
                      <span className="text-sm font-medium text-slate-800">
                        {personName(selected.owner)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">Approver</span>
                      <span className="text-sm font-medium text-slate-800">
                        {personName(selected.approver)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Effective Date
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {formatDate(selected.effective_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Review Definition
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {selected.review_definition || "No Scheduled Review"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Next Review
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {formatDate(selected.next_review)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Review Status
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${reviewClasses(
                          selected.review_status
                        )}`}
                      >
                        {statusLabel(selected.review_status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Control Coverage
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Related controls
                      </span>
                      <span className="text-lg font-semibold text-slate-900">
                        {selected.control_count}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Register State
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {selected.has_current_document
                      ? "A current controlled document is registered for this master document."
                      : "No current controlled document is registered for this master document."}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => openProcedure(selected)}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Open Procedure
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}