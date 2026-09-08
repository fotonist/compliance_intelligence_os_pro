"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileWarning,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type RemediationSource = "AUDIT_FINDING" | "ACTION" | "TASK";

type RemediationItem = {
  source: RemediationSource;
  source_id: number;
  title: string;
  description?: string | null;
  status: string;
  normalized_status: string;
  priority?: string | null;
  priority_score?: number | null;
  severity?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
  process_id?: number | null;
  control_id?: number | null;
  due_date?: string | null;
  overdue: boolean;
  due_soon: boolean;
  awaiting_review: boolean;
  action_url: string;
};

type RemediationSummary = {
  total: number;
  active: number;
  overdue: number;
  due_soon: number;
  high_priority: number;
  awaiting_review: number;
  completed: number;
};

type RemediationResponse = {
  summary: RemediationSummary;
  items: RemediationItem[];
};

type SourceFilter = "ALL" | RemediationSource;
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "AWAITING_REVIEW";

function sourceLabel(source: RemediationSource) {
  if (source === "AUDIT_FINDING") return "Audit Finding";
  if (source === "ACTION") return "Corrective Action";
  return "Task";
}

function sourceClass(source: RemediationSource) {
  if (source === "AUDIT_FINDING") {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  if (source === "ACTION") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-200";
}

function statusClass(item: RemediationItem) {
  if (item.normalized_status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (item.awaiting_review) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (item.overdue) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function priorityClass(priority?: string | null) {
  const value = String(priority || "").toUpperCase();

  if (value === "CRITICAL") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (value === "HIGH") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  if (value === "MEDIUM") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString();
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RemediationCenterPage() {
  const [data, setData] = useState<RemediationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [selectedItem, setSelectedItem] =
    useState<RemediationItem | null>(null);

  async function loadRemediation(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const res = await apiFetch("/company/remediation");

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `API ERROR ${res.status}`);
      }

      const json = (await res.json()) as RemediationResponse;

      setData(json);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load remediation data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRemediation();
  }, []);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (source !== "ALL" && item.source !== source) {
        return false;
      }

      if (
        status === "ACTIVE" &&
        item.normalized_status !== "ACTIVE"
      ) {
        return false;
      }

      if (
        status === "COMPLETED" &&
        item.normalized_status !== "COMPLETED"
      ) {
        return false;
      }

      if (
        status === "AWAITING_REVIEW" &&
        !item.awaiting_review
      ) {
        return false;
      }

      if (!query) return true;

      return [
        item.title,
        item.description,
        item.owner_name,
        item.reviewer_name,
        item.status,
        item.source,
        item.source_id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [data, search, source, status]);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
            <Loader2 size={17} className="animate-spin" />
            Loading remediation center...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle size={20} />
              <span className="font-semibold">
                Unable to load remediation center
              </span>
            </div>

            <div className="mt-3 text-sm text-slate-600">
              {error}
            </div>

            <button
              type="button"
              onClick={() => loadRemediation()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2 text-sm font-medium text-white hover:bg-[#18385f]"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary ?? {
    total: 0,
    active: 0,
    overdue: 0,
    due_soon: 0,
    high_priority: 0,
    awaiting_review: 0,
    completed: 0,
  };

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0f2747] shadow-sm">
                <ShieldCheck size={19} />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Governance / Remediation
                </div>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0f2747]">
                  Remediation Center
                </h1>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Unified operational view of findings, corrective actions,
              and compliance tasks.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadRemediation(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard
            label="Total"
            value={summary.total}
            icon={<Target size={17} />}
          />

          <KpiCard
            label="Active"
            value={summary.active}
            icon={<ShieldAlert size={17} />}
          />

          <KpiCard
            label="Overdue"
            value={summary.overdue}
            icon={<AlertCircle size={17} />}
            alert={summary.overdue > 0}
          />

          <KpiCard
            label="Due Soon"
            value={summary.due_soon}
            icon={<Clock3 size={17} />}
          />

          <KpiCard
            label="High Priority"
            value={summary.high_priority}
            icon={<FileWarning size={17} />}
            alert={summary.high_priority > 0}
          />

          <KpiCard
            label="Awaiting Review"
            value={summary.awaiting_review}
            icon={<Clock3 size={17} />}
          />

          <KpiCard
            label="Completed"
            value={summary.completed}
            icon={<CheckCircle2 size={17} />}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search remediation items..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={15} className="text-slate-400" />

                <select
                  value={source}
                  onChange={(event) =>
                    setSource(event.target.value as SourceFilter)
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                >
                  <option value="ALL">All Sources</option>
                  <option value="AUDIT_FINDING">
                    Audit Findings
                  </option>
                  <option value="ACTION">
                    Corrective Actions
                  </option>
                  <option value="TASK">Tasks</option>
                </select>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as StatusFilter)
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="AWAITING_REVIEW">
                    Awaiting Review
                  </option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Showing {filteredItems.length} of {summary.total} items
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center p-8 text-center">
              <div>
                <Target
                  size={28}
                  className="mx-auto text-slate-300"
                />

                <div className="mt-3 text-sm font-medium text-slate-700">
                  No remediation items found
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Try changing the current search or filters.
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Remediation Item
                    </th>

                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Source
                    </th>

                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Owner
                    </th>

                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Priority
                    </th>

                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Due
                    </th>

                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </th>

                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr
                      key={`${item.source}-${item.source_id}`}
                      onClick={() => setSelectedItem(item)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="max-w-[420px]">
                          <div className="truncate text-sm font-semibold text-[#0f2747]">
                            {item.title}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                            <span>#{item.source_id}</span>

                            {item.control_id && (
                              <>
                                <span className="text-slate-300">|</span>
                                <span>
                                  Control {item.control_id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${sourceClass(
                            item.source
                          )}`}
                        >
                          {sourceLabel(item.source)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-700">
                          {item.owner_name || "Unassigned"}
                        </div>

                        {item.reviewer_name && (
                          <div className="mt-1 text-xs text-slate-400">
                            Reviewer: {item.reviewer_name}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {item.priority ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityClass(
                              item.priority
                            )}`}
                          >
                            {String(item.priority).toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div
                          className={`text-sm ${
                            item.overdue
                              ? "font-semibold text-red-600"
                              : "text-slate-700"
                          }`}
                        >
                          {formatDate(item.due_date)}
                        </div>

                        {item.overdue && (
                          <div className="mt-1 text-[11px] font-medium text-red-500">
                            Overdue
                          </div>
                        )}

                        {!item.overdue && item.due_soon && (
                          <div className="mt-1 text-[11px] font-medium text-amber-600">
                            Due soon
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(
                            item
                          )}`}
                        >
                          {formatStatus(item.status)}
                        </span>

                        {item.awaiting_review && (
                          <div className="mt-1 text-[11px] font-medium text-amber-600">
                            Review queue
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <ArrowUpRight
                          size={16}
                          className="text-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {sourceLabel(selectedItem.source)} #
                  {selectedItem.source_id}
                </div>

                <div className="mt-1 text-lg font-semibold text-[#0f2747]">
                  Remediation Details
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${sourceClass(
                    selectedItem.source
                  )}`}
                >
                  {sourceLabel(selectedItem.source)}
                </span>

                <h2 className="mt-3 text-xl font-semibold text-[#0f2747]">
                  {selectedItem.title}
                </h2>

                {selectedItem.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {selectedItem.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="Status"
                  value={formatStatus(selectedItem.status)}
                />

                <DetailField
                  label="Priority"
                  value={
                    selectedItem.priority
                      ? String(selectedItem.priority).toUpperCase()
                      : "-"
                  }
                />

                <DetailField
                  label="Owner"
                  value={selectedItem.owner_name || "Unassigned"}
                />

                <DetailField
                  label="Reviewer"
                  value={selectedItem.reviewer_name || "-"}
                />

                <DetailField
                  label="Due Date"
                  value={formatDate(selectedItem.due_date)}
                />

                <DetailField
                  label="Process"
                  value={
                    selectedItem.process_id
                      ? String(selectedItem.process_id)
                      : "-"
                  }
                />

                <DetailField
                  label="Control"
                  value={
                    selectedItem.control_id
                      ? String(selectedItem.control_id)
                      : "-"
                  }
                />

                <DetailField
                  label="Source ID"
                  value={String(selectedItem.source_id)}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Operational Signals
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <Signal
                    label="Overdue"
                    active={selectedItem.overdue}
                  />

                  <Signal
                    label="Due within 7 days"
                    active={selectedItem.due_soon}
                  />

                  <Signal
                    label="Awaiting review"
                    active={selectedItem.awaiting_review}
                  />

                  <Signal
                    label="Completed"
                    active={
                      selectedItem.normalized_status ===
                      "COMPLETED"
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      selectedItem.action_url;
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2 text-sm font-medium text-white hover:bg-[#18385f]"
                >
                  Open Source
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  alert = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">
          {label}
        </div>

        <div
          className={
            alert
              ? "text-red-500"
              : "text-slate-400"
          }
        >
          {icon}
        </div>
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${
          alert ? "text-red-600" : "text-[#0f2747]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-700">
        {value}
      </div>
    </div>
  );
}

function Signal({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>

      {active ? (
        <CheckCircle2 size={16} className="text-emerald-500" />
      ) : (
        <span className="text-xs text-slate-400">No</span>
      )}
    </div>
  );
}

