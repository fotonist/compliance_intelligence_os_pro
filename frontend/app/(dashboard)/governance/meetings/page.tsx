"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/api";

type Meeting = {
  id: number;
  meeting_code: string;
  title: string;
  meeting_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  location?: string | null;
  chairperson_id?: number | null;
  created_at: string;
  updated_at: string;
};

type User = {
  id: number;
  full_name?: string | null;
  email?: string | null;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "â€”";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "â€”";
  }

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  switch (status.toUpperCase()) {
    case "SCHEDULED":
      return "bg-blue-50 text-blue-700 ring-blue-600/10";
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-700 ring-amber-600/10";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-600/10";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-600/10";
  }
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function GovernanceMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const [meetingResponse, userResponse] = await Promise.all([
        apiFetch("/governance-meetings"),
        apiFetch("/users"),
      ]);

      const meetingData = await meetingResponse.json();
      const userData = await userResponse.json();

      setMeetings(
        Array.isArray(meetingData)
          ? meetingData
          : Array.isArray(meetingData?.items)
            ? meetingData.items
            : []
      );

      setUsers(
        Array.isArray(userData)
          ? userData
          : Array.isArray(userData?.items)
            ? userData.items
            : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load governance meetings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const filteredMeetings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return meetings.filter((meeting) => {
      const matchesSearch =
        !query ||
        meeting.meeting_code.toLowerCase().includes(query) ||
        meeting.title.toLowerCase().includes(query) ||
        meeting.meeting_type.toLowerCase().includes(query) ||
        (meeting.location || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        meeting.status.toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [meetings, search, statusFilter]);

  const scheduledCount = meetings.filter(
    (meeting) => meeting.status.toUpperCase() === "SCHEDULED"
  ).length;

  const completedCount = meetings.filter(
    (meeting) => meeting.status.toUpperCase() === "COMPLETED"
  ).length;

  const inProgressCount = meetings.filter(
    (meeting) => meeting.status.toUpperCase() === "IN_PROGRESS"
  ).length;

  function chairpersonName(id?: number | null) {
    if (!id) return "â€”";

    const user = users.find((item) => item.id === id);

    return user?.full_name || user?.email || `User #${id}`;
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-8">
        {/* Header */}
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              <Link
                href="/governance"
                className="transition hover:text-slate-900"
              >
                Governance
              </Link>
              <span>/</span>
              <span className="text-slate-700">Meetings</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Governance Meetings
            </h1>

            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
              Plan, manage and maintain the governance meeting record,
              including participants, agenda, decisions, actions and history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshingâ€¦" : "Refresh"}
            </button>

            <Link
              href="/governance/meetings/new"
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              + New Meeting
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Meetings
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {meetings.length}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Scheduled
            </div>
            <div className="mt-2 text-2xl font-semibold text-blue-700">
              {scheduledCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              In Progress
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-700">
              {inProgressCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Completed
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">
              {completedCount}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table container */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Meeting Register
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {filteredMeetings.length} meeting
                  {filteredMeetings.length === 1 ? "" : "s"} shown
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search meetingsâ€¦"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:w-64"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="all">All statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                ?
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                No governance meetings found
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                {meetings.length === 0
                  ? "Create the first governance meeting to begin maintaining the meeting record."
                  : "Try changing the search or status filter."}
              </p>

              {meetings.length === 0 && (
                <Link
                  href="/governance/meetings/new"
                  className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Create Meeting
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Meeting
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Schedule
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Chairperson
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredMeetings.map((meeting) => (
                    <tr
                      key={meeting.id}
                      className="group transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/governance/meetings/${meeting.id}`}
                          className="block"
                        >
                          <div className="font-medium text-slate-900 transition group-hover:text-slate-700">
                            {meeting.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {meeting.meeting_code}
                          </div>
                        </Link>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {meeting.meeting_type}
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-800">
                          {formatDate(meeting.scheduled_at)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatTime(meeting.scheduled_at)}
                          {meeting.duration_minutes
                            ? ` Â· ${meeting.duration_minutes} min`
                            : ""}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {chairpersonName(meeting.chairperson_id)}
                      </td>

                      <td className="max-w-[220px] truncate px-5 py-4 text-sm text-slate-600">
                        {meeting.location || "â€”"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
                            meeting.status
                          )}`}
                        >
                          {statusLabel(meeting.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/governance/meetings/${meeting.id}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-950"
                        >
                          Open â€º
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
