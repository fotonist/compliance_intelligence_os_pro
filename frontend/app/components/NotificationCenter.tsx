"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Loader2,
} from "lucide-react";
import { apiFetch } from "../lib/api";

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

type NotificationUnreadCountResponse = {
  unread: number;
};

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

function severityClass(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "bg-red-100 text-red-700";
    case "HIGH":
      return "bg-orange-100 text-orange-700";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700";
    case "LOW":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-blue-100 text-blue-700";
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

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await apiFetch(
        "/notifications/unread-count"
      );

      const data: NotificationUnreadCountResponse =
        await res.json();

      setUnreadCount(Number(data?.unread ?? 0));
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        "/notifications?skip=0&limit=8"
      );

      const data: NotificationListResponse =
        await res.json();

      setItems(
        Array.isArray(data?.items)
          ? data.items
          : []
      );

      setUnreadCount(Number(data?.unread ?? 0));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const timer = window.setInterval(
      loadUnreadCount,
      30000
    );

    return () => window.clearInterval(timer);
  }, [loadUnreadCount]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
  }, []);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  async function markRead(
    notification: NotificationItem
  ) {
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
                read_at:
                  new Date().toISOString(),
              }
            : item
        )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    } catch {}
  }

  async function markAllRead() {
    if (
      markingAll ||
      unreadCount === 0
    ) {
      return;
    }

    setMarkingAll(true);

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

      setUnreadCount(0);
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
    markRead(notification);

    if (notification.action_url) {
      window.location.href =
        notification.action_url;
      return;
    }

    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-[#0f2747]"
      >
        <Bell size={17} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[90] w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-[#0f2747]">
                Notifications
              </div>

              <div className="mt-0.5 text-[10px] text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "All notifications are read"}
              </div>
            </div>

            <button
              type="button"
              onClick={markAllRead}
              disabled={
                markingAll ||
                unreadCount === 0
              }
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-[#0f2747] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {markingAll ? (
                <Loader2
                  size={12}
                  className="animate-spin"
                />
              ) : (
                <CheckCheck size={12} />
              )}

              Mark all read
            </button>
          </div>

          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2
                size={18}
                className="animate-spin text-slate-400"
              />
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center">
              <div className="text-xs font-semibold text-red-600">
                Unable to load notifications
              </div>

              <div className="mt-1 text-[10px] text-slate-500">
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
            <div className="flex h-56 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Bell size={18} />
              </div>

              <div className="mt-3 text-xs font-semibold text-slate-700">
                No notifications
              </div>

              <div className="mt-1 text-[10px] text-slate-500">
                You are up to date.
              </div>
            </div>
          ) : (
            <div className="max-h-[430px] overflow-y-auto">
              {items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() =>
                    openNotification(
                      notification
                    )
                  }
                  className={`group flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                    notification.is_read
                      ? "bg-white"
                      : "bg-[#f8fbff]"
                  }`}
                >
                  <div className="mt-1 flex w-2 shrink-0 justify-center">
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wide ${categoryClass(
                          notification.category
                        )}`}
                      >
                        {notification.category}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${severityClass(
                          notification.severity
                        )}`}
                      >
                        {notification.severity}
                      </span>
                    </div>

                    <div className="mt-1 text-xs font-semibold text-[#0f2747]">
                      {notification.title}
                    </div>

                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">
                      {notification.message}
                    </div>

                    <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
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
                    size={14}
                    className="mt-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.location.href =
                  "/notifications";
              }}
              className="flex w-full items-center justify-between text-[10px] font-bold text-[#0f2747] transition hover:text-blue-600"
            >
              <span>
                View all notifications
              </span>

              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


