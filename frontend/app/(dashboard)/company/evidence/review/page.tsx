"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type ReviewTask = {
  task_id: number;
  task_title?: string;
  task_type?: string;
  process_id?: number;
  process_code?: string;
  process_name?: string;
};

type ReviewQueueItem = {
  file_id: number;
  evidence_id: number;
  evidence_title?: string;
  file_name?: string;
  version?: number;
  submitted_by?: number | null;
  submitted_at?: string | null;
  status?: string;
  review_due_at?: string | null;
  review_status?: string;
  review_days_remaining?: number | null;
  is_overdue?: boolean;
  tasks?: ReviewTask[];
};

type QueueResponse = {
  total?: number;
  items?: ReviewQueueItem[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function reviewStatusLabel(status?: string) {
  switch ((status ?? "").toUpperCase()) {
    case "OVERDUE":
      return "Overdue";
    case "DUE_SOON":
      return "Due Soon";
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "NOT_SUBMITTED":
      return "Not Submitted";
    default:
      return status || "Pending";
  }
}

function ReviewStatusBadge({
  status,
}: {
  status?: string;
}) {
  const normalized = (status ?? "").toUpperCase();

  const classes =
    normalized === "OVERDUE"
      ? "border-red-200 bg-red-50 text-red-700"
      : normalized === "DUE_SOON"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  const dot =
    normalized === "OVERDUE"
      ? "bg-red-500"
      : normalized === "DUE_SOON"
      ? "bg-amber-500"
      : "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dot}`} />
      {reviewStatusLabel(status)}
    </span>
  );
}

function reviewSlaText(item: ReviewQueueItem) {
  const status = (item.review_status ?? "").toUpperCase();

  if (status === "OVERDUE") {
    const days = Math.abs(item.review_days_remaining ?? 0);
    return days === 1 ? "1 day overdue" : `${days} days overdue`;
  }

  if (status === "DUE_SOON") {
    const days = item.review_days_remaining ?? 0;
    return days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} remaining`;
  }

  if (status === "PENDING") {
    const days = item.review_days_remaining;

    if (days == null) {
      return "SLA pending";
    }

    return `${days} day${days === 1 ? "" : "s"} remaining`;
  }

  return "?";
}

export default function EvidenceReviewQueuePage() {
  const router = useRouter();

  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<ReviewQueueItem | null>(null);

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch("/evidences/review/queue");

      if (!response.ok) {
        throw new Error(`Review Queue request failed (${response.status})`);
      }

      const json = (await response.json()) as QueueResponse;

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Review Queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function approveFile(item: ReviewQueueItem) {
    try {
      setBusyFileId(item.file_id);
      setError(null);

      const response = await apiFetch(
        `/evidences/files/${item.file_id}/approve`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Approval failed (${response.status})`);
      }

      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusyFileId(null);
    }
  }

  async function rejectFile(item: ReviewQueueItem) {
    try {
      setBusyFileId(item.file_id);
      setError(null);

      const response = await apiFetch(
        `/evidences/files/${item.file_id}/reject`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Rejection failed (${response.status})`);
      }

      setRejecting(null);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setBusyFileId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return items;

    return items.filter((item) => {
      const taskText = (item.tasks ?? [])
        .map(
          (task) =>
            `${task.task_id} ${task.task_title ?? ""} ${
              task.task_type ?? ""
            } ${task.process_code ?? ""} ${task.process_name ?? ""}`
        )
        .join(" ");

      const haystack = [
        item.evidence_id,
        item.evidence_title,
        item.file_name,
        item.version,
        item.submitted_by,
        taskText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, search]);

  const latestSubmission = useMemo(() => {
    if (!items.length) return null;

    const sorted = [...items].sort((a, b) => {
      const aTime = a.submitted_at
        ? new Date(a.submitted_at).getTime()
        : 0;
      const bTime = b.submitted_at
        ? new Date(b.submitted_at).getTime()
        : 0;

      return bTime - aTime;
    });

    return sorted[0]?.submitted_at ?? null;
  }, [items]);

  const overdueCount = useMemo(
    () =>
      items.filter(
        (item) => (item.review_status ?? "").toUpperCase() === "OVERDUE"
      ).length,
    [items]
  );

  const dueSoonCount = useMemo(
    () =>
      items.filter(
        (item) => (item.review_status ?? "").toUpperCase() === "DUE_SOON"
      ).length,
    [items]
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span>Evidence</span>
              <span className="text-slate-300">/</span>
              <span>Governance</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Review Queue
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Centralized review workspace for evidence files submitted for
              approval. Review the evidence context, inspect the related task,
              and approve or reject the submitted file.
            </p>
          </div>

          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Queue"}
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pending Reviews
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {items.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Evidence files awaiting reviewer action
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Overdue
            </div>
            <div className="mt-2 text-3xl font-bold text-red-700">
              {overdueCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Files beyond the review SLA
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Due Soon
            </div>
            <div className="mt-2 text-3xl font-bold text-amber-700">
              {dueSoonCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Files approaching the review SLA
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Latest Submission
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatDate(latestSubmission)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Most recent file submitted for review
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pending Evidence Files
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Each row represents a submitted evidence file and its compliance
                context.
              </p>
            </div>

            <div className="w-full lg:w-96">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search evidence, task, process or file..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0f9fb5] focus:bg-white focus:ring-2 focus:ring-[#0f9fb5]/10"
              />
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              Loading Review Queue...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                ✓
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                No pending reviews
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                There are currently no evidence files waiting for reviewer
                action.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">Evidence</th>
                    <th className="px-5 py-4">File</th>
                    <th className="px-5 py-4">Task</th>
                    <th className="px-5 py-4">Process</th>
                    <th className="px-5 py-4">Submitted</th>
                    <th className="px-5 py-4">Review Due</th>
                    <th className="px-5 py-4">SLA</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const task = item.tasks?.[0];
                    const additionalTasks = Math.max(
                      (item.tasks?.length ?? 0) - 1,
                      0
                    );
                    const busy = busyFileId === item.file_id;

                    return (
                      <tr
                        key={item.file_id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4 align-top">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/evidences/${item.evidence_id}`)
                            }
                            className="text-left"
                          >
                            <div className="font-semibold text-slate-900 hover:text-[#0f9fb5]">
                              {item.evidence_title || "Untitled Evidence"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              EVD-{item.evidence_id}
                            </div>
                          </button>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="font-medium text-slate-800">
                            {item.file_name || "Unnamed file"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Version {item.version ?? "—"}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          {task ? (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/company/tasks/${task.task_id}`)
                              }
                              className="text-left"
                            >
                              <div className="font-semibold text-slate-800 hover:text-[#0f9fb5]">
                                TASK-{task.task_id}
                              </div>
                              <div className="mt-1 max-w-[230px] truncate text-xs text-slate-500">
                                {task.task_title || "Untitled Task"}
                              </div>
                              {additionalTasks > 0 && (
                                <div className="mt-1 text-xs font-semibold text-[#0f9fb5]">
                                  +{additionalTasks} related task
                                  {additionalTasks > 1 ? "s" : ""}
                                </div>
                              )}
                            </button>
                          ) : (
                            <span className="text-sm text-slate-400">
                              No task
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="font-medium text-slate-800">
                            {task?.process_code || "—"}
                          </div>
                          <div className="mt-1 max-w-[200px] truncate text-xs text-slate-500">
                            {task?.process_name || "—"}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm text-slate-700">
                            {formatDate(item.submitted_at)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.submitted_by
                              ? `User #${item.submitted_by}`
                              : "Unknown reviewer submitter"}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-medium text-slate-700">
                            {formatDate(item.review_due_at)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Review deadline
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <ReviewStatusBadge status={item.review_status} />
                          <div
                            className={`mt-1 text-xs ${
                              item.is_overdue
                                ? "font-semibold text-red-600"
                                : "text-slate-500"
                            }`}
                          >
                            {reviewSlaText(item)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/evidences/${item.evidence_id}`
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              Review
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => approveFile(item)}
                              className="rounded-lg bg-[#0f9fb5] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0b8799] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? "Working..." : "Approve"}
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setRejecting(item)}
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reject
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
        </div>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Reject Evidence File
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Confirm rejection of{" "}
                <span className="font-semibold text-slate-700">
                  {rejecting.file_name || "this file"}
                </span>
                .
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                The file will leave the Review Queue and its evidence review
                state will be updated by the backend workflow.
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                disabled={busyFileId !== null}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => rejectFile(rejecting)}
                disabled={busyFileId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyFileId !== null ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
