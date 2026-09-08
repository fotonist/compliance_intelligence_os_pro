"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type NotificationItem = {
  id: number;
  category: string;
  severity: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: number | null;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};

type NotificationListResponse = {
  items: NotificationItem[];
  total: number;
  unread: number;
};

type Filter = "ALL" | "UNREAD";

const PAGE_SIZE = 20;

const categories = [
  "ALL",
  "SYSTEM",
  "COMPLIANCE",
  "RISK",
  "AUDIT",
  "TASK",
  "EVIDENCE",
  "INTEGRATION",
  "SECURITY",
];

const severities = [
  "ALL",
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function severityClass(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "border-red-200 bg-red-50 text-red-700";
    case "HIGH":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "LOW":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function categoryClass(category: string) {
  switch (category.toUpperCase()) {
    case "SECURITY":
      return "text-red-600";
    case "RISK":
      return "text-orange-600";
    case "AUDIT":
      return "text-purple-600";
    case "TASK":
      return "text-blue-600";
    case "EVIDENCE":
      return "text-emerald-600";
    case "INTEGRATION":
      return "text-indigo-600";
    case "COMPLIANCE":
      return "text-teal-600";
    default:
      return "text-slate-500";
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");

  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] =
    useState<NotificationItem | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      params.set("skip", String(page * PAGE_SIZE));
      params.set("limit", String(PAGE_SIZE));

      if (category !== "ALL") {
        params.set("category", category);
      }

      if (severity !== "ALL") {
        params.set("severity", severity);
      }

      if (filter === "UNREAD") {
        params.set("unread_only", "true");
      }

      const res = await apiFetch(
        `/notifications?${params.toString()}`
      );

      const data: NotificationListResponse =
        await res.json();

      setItems(
        Array.isArray(data?.items)
          ? data.items
          : []
      );

      setTotal(Number(data?.total ?? 0));
      setUnread(Number(data?.unread ?? 0));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, [page, filter, category, severity]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    setPage(0);
  }, [filter, category, severity]);

  async function markRead(notification: NotificationItem) {
    if (notification.is_read) {
      return;
    }

    try {
      await apiFetch(
        `/notifications/${notification.id}/read`,
        {
          method: "POST",
        }
      );

      setItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : item
        )
      );

      setUnread((current) =>
        Math.max(0, current - 1)
      );

      setSelected((current) =>
        current?.id === notification.id
          ? {
              ...current,
              is_read: true,
              read_at: new Date().toISOString(),
            }
          : current
      );
    } catch {
      setError("Unable to mark notification as read.");
    }
  }

  async function markAllRead() {
    if (markingAll || unread === 0) {
      return;
    }

    setMarkingAll(true);
    setError(null);

    try {
      await apiFetch(
        "/notifications/read-all",
        {
          method: "POST",
        }
      );

      setItems((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at:
            item.read_at ||
            new Date().toISOString(),
        }))
      );

      setUnread(0);

      if (filter === "UNREAD") {
        await loadNotifications();
      }
    } catch {
      setError(
        "Unable to mark notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  function openNotification(
    notification: NotificationItem
  ) {
    setSelected(notification);
    void markRead(notification);
  }

  function navigateToAction(
    notification: NotificationItem
  ) {
    if (!notification.action_url) {
      return;
    }

    window.location.href =
      notification.action_url;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  const firstItem =
    total === 0
      ? 0
      : page * PAGE_SIZE + 1;

  const lastItem = Math.min(
    (page + 1) * PAGE_SIZE,
    total
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eaf1fb] text-[#0f2747]">
              <Bell size={18} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0f2747]">
                Notifications
              </h1>

              <p className="mt-0.5 text-xs text-slate-500">
                Your notification inbox
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllRead}
            disabled={
              markingAll || unread === 0
            }
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {markingAll ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : (
              <CheckCheck size={13} />
            )}
            Mark all read
          </button>

          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0f2747]">
            {total.toLocaleString()}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Unread
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {unread.toLocaleString()}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Current View
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0f2747]">
            {filter === "UNREAD"
              ? "Unread"
              : "All"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(["ALL", "UNREAD"] as Filter[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(value)
                  }
                  className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition ${
                    filter === value
                      ? "bg-white text-[#0f2747] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {value === "ALL"
                    ? "All"
                    : "Unread"}
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-300"
            >
              {categories.map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  Category: {value}
                </option>
              ))}
            </select>

            <select
              value={severity}
              onChange={(event) =>
                setSeverity(
                  event.target.value
                )
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-300"
            >
              {severities.map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  Severity: {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-bold text-[#0f2747]">
              Notification Inbox
            </div>

            <div className="mt-0.5 text-[10px] text-slate-400">
              {total === 0
                ? "No notifications found"
                : `Showing ${firstItem}-${lastItem} of ${total}`}
            </div>
          </div>

          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Tenant scoped
          </div>
        </div>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2
              size={22}
              className="animate-spin text-slate-400"
            />
          </div>
        ) : error ? (
          <div className="flex h-72 flex-col items-center justify-center px-6 text-center">
            <AlertCircle
              size={22}
              className="text-red-500"
            />

            <div className="mt-3 text-xs font-semibold text-red-600">
              Unable to load notifications
            </div>

            <div className="mt-1 max-w-md text-[10px] text-slate-500">
              {error}
            </div>

            <button
              type="button"
              onClick={loadNotifications}
              className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Bell size={20} />
            </div>

            <div className="mt-3 text-xs font-semibold text-slate-700">
              No notifications
            </div>

            <div className="mt-1 text-[10px] text-slate-500">
              Your notification inbox is up to date.
            </div>
          </div>
        ) : (
          <div>
            {items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() =>
                  openNotification(
                    notification
                  )
                }
                className={`group flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-50 ${
                  notification.is_read
                    ? "bg-white"
                    : "bg-[#f8fbff]"
                }`}
              >
                <div className="mt-1.5 flex w-2 shrink-0 justify-center">
                  {!notification.is_read && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider ${categoryClass(
                        notification.category
                      )}`}
                    >
                      {notification.category}
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${severityClass(
                        notification.severity
                      )}`}
                    >
                      {notification.severity}
                    </span>
                  </div>

                  <div className="mt-1 text-sm font-semibold text-[#0f2747]">
                    {notification.title}
                  </div>

                  <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                    {notification.message}
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-400">
                    <Clock3 size={10} />
                    {formatRelativeTime(
                      notification.created_at
                    )}

                    {notification.is_read && (
                      <>
                        <span className="mx-1">
                          •
                        </span>
                        <Check size={10} />
                        Read
                      </>
                    )}
                  </div>
                </div>

                <ChevronRight
                  size={15}
                  className="mt-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <div className="text-[9px] text-slate-400">
            Page {page + 1} of {totalPages}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() =>
                setPage((current) =>
                  Math.max(0, current - 1)
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight
                size={13}
                className="rotate-180"
              />
            </button>

            <button
              type="button"
              disabled={
                page >= totalPages - 1
              }
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    totalPages - 1,
                    current + 1
                  )
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div
                  className={`text-[9px] font-bold uppercase tracking-wider ${categoryClass(
                    selected.category
                  )}`}
                >
                  {selected.category}
                </div>

                <h2 className="mt-1 text-sm font-bold text-[#0f2747]">
                  {selected.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <span className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase ${severityClass(
                    selected.severity
                  )}`}
                >
                  {selected.severity}
                </span>

                {selected.is_read && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500">
                    <Check size={10} />
                    READ
                  </span>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selected.message}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Created
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">
                    {formatDate(
                      selected.created_at
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Entity
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-600">
                    {selected.entity_type ||
                      "-"}
                  </div>
                </div>

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Entity ID
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-600">
                    {selected.entity_id ??
                      "-"}
                  </div>
                </div>

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Read
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">
                    {selected.read_at
                      ? formatDate(
                          selected.read_at
                        )
                      : "Not read"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div>
                {selected.action_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigateToAction(
                        selected
                      )
                    }
                    className="flex items-center gap-1.5 rounded-md bg-[#0f2747] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#16365f]"
                  >
                    Open related item
                    <ChevronRight size={12} />
                  </button>
                ) : (
                  <span className="text-[9px] text-slate-400">
                    No related action
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
