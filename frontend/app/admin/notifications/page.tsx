"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  X,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type Delivery = {
  id: number;
  channel: string;
  status: string;
  provider?: string | null;
  provider_message_id?: string | null;
  attempt_count: number;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
  created_at: string;
};

type NotificationItem = {
  id: number;
  tenant_id: number;
  recipient_user_id: number;
  recipient_email?: string | null;
  recipient_name?: string | null;
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
  deliveries: Delivery[];
};

type AdminListResponse = {
  items: NotificationItem[];
  total: number;
  unread: number;
  failed_deliveries: number;
};

const PAGE_SIZE = 25;

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

const deliveryStatuses = [
  "ALL",
  "PENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
];

function formatDate(value?: string | null) {
  if (!value) return "-";

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

  const diff = Math.max(
    0,
    Date.now() - date.getTime()
  );

  const minutes = Math.floor(
    diff / 60000
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(
    hours / 24
  );

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

function deliveryClass(status: string) {
  switch (status.toUpperCase()) {
    case "DELIVERED":
    case "SENT":
      return "text-emerald-600";
    case "FAILED":
      return "text-red-600";
    case "SKIPPED":
      return "text-slate-400";
    case "PENDING":
      return "text-amber-600";
    default:
      return "text-slate-500";
  }
}

function deliveryIcon(
  channel: string,
  size = 13
) {
  if (channel === "EMAIL") {
    return <Mail size={size} />;
  }

  if (channel === "SMS") {
    return <Smartphone size={size} />;
  }

  return <Bell size={size} />;
}

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<
    NotificationItem[]
  >([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [failedDeliveries, setFailedDeliveries] =
    useState(0);

  const [category, setCategory] =
    useState("ALL");
  const [severity, setSeverity] =
    useState("ALL");
  const [deliveryStatus, setDeliveryStatus] =
    useState("ALL");

  const [page, setPage] = useState(0);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const [selected, setSelected] =
    useState<NotificationItem | null>(null);

  const loadNotifications = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        params.set(
          "skip",
          String(page * PAGE_SIZE)
        );

        params.set(
          "limit",
          String(PAGE_SIZE)
        );

        if (category !== "ALL") {
          params.set("category", category);
        }

        if (severity !== "ALL") {
          params.set("severity", severity);
        }

        if (deliveryStatus !== "ALL") {
          params.set(
            "delivery_status",
            deliveryStatus
          );
        }

        const res = await apiFetch(
          `/admin/notifications?${params.toString()}`
        );

        const data: AdminListResponse =
          await res.json();

        setItems(
          Array.isArray(data?.items)
            ? data.items
            : []
        );

        setTotal(
          Number(data?.total ?? 0)
        );

        setUnread(
          Number(data?.unread ?? 0)
        );

        setFailedDeliveries(
          Number(
            data?.failed_deliveries ?? 0
          )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load notifications."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      category,
      severity,
      deliveryStatus,
    ]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    setPage(0);
  }, [
    category,
    severity,
    deliveryStatus,
  ]);

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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eaf1fb] text-[#0f2747]">
              <Bell size={17} />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-[#0f2747]">
              Notification Monitoring
            </h1>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Notification delivery and activity
            management
          </p>
        </div>

        <button
          type="button"
          onClick={loadNotifications}
          disabled={loading}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total
              </div>
              <div className="mt-1 text-2xl font-bold text-[#0f2747]">
                {total.toLocaleString()}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Bell size={17} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Unread
              </div>
              <div className="mt-1 text-2xl font-bold text-[#0f2747]">
                {unread.toLocaleString()}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Eye size={17} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Failed Deliveries
              </div>
              <div className="mt-1 text-2xl font-bold text-[#0f2747]">
                {failedDeliveries.toLocaleString()}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <ShieldAlert size={17} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter
            size={14}
            className="text-slate-400"
          />

          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Filters
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

          <select
            value={deliveryStatus}
            onChange={(event) =>
              setDeliveryStatus(
                event.target.value
              )
            }
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-300"
          >
            {deliveryStatuses.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  Delivery: {value}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-bold text-[#0f2747]">
              Notification Activity
            </div>

            <div className="mt-0.5 text-[10px] text-slate-400">
              {total === 0
                ? "No notifications found"
                : `Showing ${firstItem}-${lastItem} of ${total}`}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Search size={11} />
            Tenant scoped
          </div>
        </div>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2
              size={20}
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
          <div className="flex h-72 flex-col items-center justify-center">
            <Bell
              size={24}
              className="text-slate-300"
            />

            <div className="mt-3 text-xs font-semibold text-slate-600">
              No notifications
            </div>

            <div className="mt-1 text-[10px] text-slate-400">
              No records match the selected
              filters.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Notification
                  </th>

                  <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Recipient
                  </th>

                  <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Category
                  </th>

                  <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Severity
                  </th>

                  <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Delivery
                  </th>

                  <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Created
                  </th>

                  <th className="px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map(
                  (notification) => {
                    const failed =
                      notification.deliveries.some(
                        (delivery) =>
                          delivery.status ===
                          "FAILED"
                      );

                    return (
                      <tr
                        key={notification.id}
                        className={`border-b border-slate-100 transition hover:bg-slate-50/70 ${
                          notification.is_read
                            ? ""
                            : "bg-[#f8fbff]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-2 w-2 shrink-0 items-center justify-center">
                              {!notification.is_read && (
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="max-w-[310px] truncate text-xs font-semibold text-[#0f2747]">
                                  {
                                    notification.title
                                  }
                                </span>

                                {failed && (
                                  <AlertCircle
                                    size={12}
                                    className="shrink-0 text-red-500"
                                  />
                                )}
                              </div>

                              <div className="mt-0.5 max-w-[350px] truncate text-[10px] text-slate-400">
                                {
                                  notification.message
                                }
                              </div>

                              <div className="mt-1 text-[9px] text-slate-400">
                                #
                                {
                                  notification.id
                                }
                                {notification.entity_type &&
                                  ` · ${notification.entity_type}`}
                                {notification.entity_id &&
                                  ` #${notification.entity_id}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[180px]">
                            <div className="truncate text-[10px] font-semibold text-slate-700">
                              {notification.recipient_name ||
                                "Unknown user"}
                            </div>

                            <div className="truncate text-[9px] text-slate-400">
                              {notification.recipient_email ||
                                "-"}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                            {
                              notification.category
                            }
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${severityClass(
                              notification.severity
                            )}`}
                          >
                            {
                              notification.severity
                            }
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {notification.deliveries.length ===
                            0 ? (
                              <span className="text-[9px] text-slate-400">
                                No delivery
                              </span>
                            ) : (
                              notification.deliveries.map(
                                (
                                  delivery
                                ) => (
                                  <div
                                    key={
                                      delivery.id
                                    }
                                    className={`flex items-center gap-1.5 text-[9px] font-semibold ${deliveryClass(
                                      delivery.status
                                    )}`}
                                  >
                                    {deliveryIcon(
                                      delivery.channel,
                                      11
                                    )}

                                    <span>
                                      {
                                        delivery.channel
                                      }
                                    </span>

                                    <span className="text-slate-300">
                                      ·
                                    </span>

                                    <span>
                                      {
                                        delivery.status
                                      }
                                    </span>

                                    {delivery.attempt_count >
                                      0 && (
                                      <span className="text-slate-400">
                                        (
                                        {
                                          delivery.attempt_count
                                        }
                                        )
                                      </span>
                                    )}
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Clock3
                              size={11}
                              className="text-slate-300"
                            />

                            <div>
                              <div className="text-[10px] text-slate-600">
                                {formatRelativeTime(
                                  notification.created_at
                                )}
                              </div>

                              <div className="text-[8px] text-slate-400">
                                {formatDate(
                                  notification.created_at
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelected(
                                notification
                              )
                            }
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2 text-[9px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-[#0f2747]"
                          >
                            <Eye size={11} />
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <div className="text-[9px] text-slate-400">
            Page {page + 1} of{" "}
            {totalPages}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      0,
                      current - 1
                    )
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={13} />
            </button>

            <button
              type="button"
              disabled={
                page >= totalPages - 1
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.min(
                      totalPages - 1,
                      current + 1
                    )
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
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
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Notification #
                    {selected.id}
                  </span>

                  {!selected.is_read && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-bold text-blue-600">
                      UNREAD
                    </span>
                  )}
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
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Category
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-700">
                    {selected.category}
                  </div>
                </div>

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Severity
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-bold ${severityClass(
                        selected.severity
                      )}`}
                    >
                      {selected.severity}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Recipient
                  </div>
                  <div className="mt-1 truncate text-[10px] font-semibold text-slate-700">
                    {selected.recipient_name ||
                      "-"}
                  </div>
                </div>

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
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  Message
                </div>

                <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                  {selected.message}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  Delivery Attempts
                </div>

                <div className="space-y-2">
                  {selected.deliveries.length ===
                  0 ? (
                    <div className="rounded-lg border border-slate-200 px-4 py-3 text-[10px] text-slate-400">
                      No delivery records.
                    </div>
                  ) : (
                    selected.deliveries.map(
                      (delivery) => (
                        <div
                          key={delivery.id}
                          className="rounded-lg border border-slate-200 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">
                                {deliveryIcon(
                                  delivery.channel,
                                  14
                                )}
                              </span>

                              <span className="text-[10px] font-bold text-slate-700">
                                {
                                  delivery.channel
                                }
                              </span>

                              <span
                                className={`text-[9px] font-bold ${deliveryClass(
                                  delivery.status
                                )}`}
                              >
                                {
                                  delivery.status
                                }
                              </span>
                            </div>

                            <div className="text-[9px] text-slate-400">
                              Attempts:{" "}
                              {
                                delivery.attempt_count
                              }
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-3 text-[9px] md:grid-cols-4">
                            <div>
                              <div className="text-slate-400">
                                Provider
                              </div>
                              <div className="mt-0.5 font-semibold text-slate-600">
                                {delivery.provider ||
                                  "-"}
                              </div>
                            </div>

                            <div>
                              <div className="text-slate-400">
                                Last Attempt
                              </div>
                              <div className="mt-0.5 font-semibold text-slate-600">
                                {formatDate(
                                  delivery.last_attempt_at
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-slate-400">
                                Delivered
                              </div>
                              <div className="mt-0.5 font-semibold text-slate-600">
                                {formatDate(
                                  delivery.delivered_at
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-slate-400">
                                Failed
                              </div>
                              <div className="mt-0.5 font-semibold text-slate-600">
                                {formatDate(
                                  delivery.failed_at
                                )}
                              </div>
                            </div>
                          </div>

                          {delivery.error_message && (
                            <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-[9px] text-red-600">
                              <AlertCircle
                                size={12}
                                className="mt-0.5 shrink-0"
                              />
                              <span>
                                {
                                  delivery.error_message
                                }
                              </span>
                            </div>
                          )}

                          {delivery.status ===
                            "SENT" && (
                            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-600">
                              <CheckCircle2
                                size={11}
                              />
                              Delivery completed
                            </div>
                          )}
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
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
