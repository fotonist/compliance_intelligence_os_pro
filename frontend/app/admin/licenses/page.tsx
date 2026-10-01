"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approveLicenseRequest,
  fetchLicenseRequests,
  PremiumModuleRequest,
  rejectLicenseRequest,
} from "../../../services/admin";

const STATUS_OPTIONS = ["ALL", "PENDING", "APPROVED", "REJECTED"];

function statusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "REJECTED":
      return "bg-red-500/15 text-red-700 border-red-500/30";
    default:
      return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminLicensesPage() {
  const [requests, setRequests] = useState<PremiumModuleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [rejecting, setRejecting] = useState<PremiumModuleRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  async function load() {
    setLoading(true);

    try {
      const data = await fetchLicenseRequests();
      setRequests(data);
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: "Failed to load premium activation requests.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pendingCount = requests.filter((item) => item.status === "PENDING").length;
  const approvedCount = requests.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = requests.filter((item) => item.status === "REJECTED").length;

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;
      if (!matchesStatus) return false;

      if (!query) return true;

      return `${item.module_code} ${item.module_name} ${item.tenant_id} ${item.requested_by} ${item.id}`
        .toLowerCase()
        .includes(query);
    });
  }, [requests, search, status]);

  async function handleApprove(item: PremiumModuleRequest) {
    setBusyId(item.id);

    try {
      await approveLicenseRequest(item.id);
      setMessage({
        type: "success",
        text: `${item.module_name} has been activated successfully.`,
      });
      await load();
    } catch (error: any) {
      console.error(error);
      setMessage({
        type: "error",
        text: error?.message || "Failed to approve activation request.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejecting) return;

    const item = rejecting;
    setBusyId(item.id);

    try {
      await rejectLicenseRequest(item.id, reviewNote);
      setRejecting(null);
      setReviewNote("");
      setMessage({
        type: "success",
        text: `${item.module_name} request has been rejected.`,
      });
      await load();
    } catch (error: any) {
      console.error(error);
      setMessage({
        type: "error",
        text: error?.message || "Failed to reject activation request.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-full bg-[#f6f8fc] p-8 text-[#102a43]">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-sky-400">
              Administration
            </div>
            <h1 className="mt-2 text-3xl font-semibold">License Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Review and activate Premium, PRO, PRIME and enterprise module access
              requests across the platform.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-4">
          <Stat label="Total Requests" value={requests.length} />
          <Stat label="Pending Review" value={pendingCount} emphasis="amber" />
          <Stat label="Approved" value={approvedCount} emphasis="emerald" />
          <Stat label="Rejected" value={rejectedCount} emphasis="red" />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-semibold">Activation Requests</h2>
              <p className="mt-1 text-xs text-slate-500">
                Approving a request activates the module for its tenant.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search module, tenant, requester..."
                className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All Statuses" : option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading activation requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-14 text-center">
              <div className="text-lg font-medium text-slate-600">
                No activation requests found
              </div>
              <div className="mt-2 text-sm text-slate-500">
                New Premium module requests will appear here when submitted.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4">Request</th>
                    <th className="px-5 py-4">Module</th>
                    <th className="px-5 py-4">Tenant</th>
                    <th className="px-5 py-4">Requester</th>
                    <th className="px-5 py-4">Requested</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-200/80 last:border-0 hover:bg-slate-50/30"
                    >
                      <td className="px-5 py-5 align-top">
                        <div className="font-medium text-slate-700">REQ-{item.id}</div>
                        <div className="mt-1 text-xs text-slate-600">ID {item.id}</div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <div className="font-semibold text-slate-900">{item.module_name}</div>
                        <div className="mt-1 text-xs font-mono text-slate-500">
                          {item.module_code}
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <div className="text-slate-600">Tenant #{item.tenant_id}</div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <div className="text-slate-600">User #{item.requested_by}</div>
                      </td>

                      <td className="px-5 py-5 align-top text-slate-400">
                        {formatDate(item.requested_at)}
                      </td>

                      <td className="px-5 py-5 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                        {item.review_note && (
                          <div className="mt-2 max-w-[220px] text-xs text-slate-500">
                            {item.review_note}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-5 align-top text-right">
                        {item.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(item)}
                              disabled={busyId === item.id}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busyId === item.id ? "Processing..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejecting(item);
                                setReviewNote("");
                              }}
                              disabled={busyId === item.id}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">No action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 p-6">
              <div className="text-lg font-semibold text-slate-900">Reject Activation Request</div>
              <div className="mt-2 text-sm text-slate-400">
                {rejecting.module_name} - Tenant #{rejecting.tenant_id}
              </div>
            </div>

            <div className="p-6">
              <label className="text-xs uppercase tracking-wider text-slate-500">
                Review Note
              </label>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                rows={5}
                placeholder="Explain why this activation request was rejected..."
                className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejecting(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={busyId === rejecting.id}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {busyId === rejecting.id ? "Rejecting..." : "Reject Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-[1px]">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div
              className={`px-6 py-4 text-lg font-semibold ${
                message.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {message.type === "success" ? "Operation Successful" : "Operation Failed"}
            </div>
            <div className="px-6 py-6 text-sm text-slate-700">{message.text}</div>
            <div className="flex justify-end border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: "amber" | "emerald" | "red";
}) {
  const valueClass =
    emphasis === "amber"
      ? "text-amber-700"
      : emphasis === "emerald"
        ? "text-emerald-700"
        : emphasis === "red"
          ? "text-red-700"
          : "text-white";

  return (
    <div className="rounded-2xl border border-slate-300 bg-white shadow-sm p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}





