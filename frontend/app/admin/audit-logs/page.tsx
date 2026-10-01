"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { fetchAuditLogs } from "../../../services/admin";

type AuditLog = {
  id: number;
  actor_id: number | null;
  actor_role: string | null;
  actor: {
    id: number;
    tenant_id: number | null;
    full_name: string | null;
    email: string | null;
  } | null;
  entity_type: string;
  entity_id: number | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: "",
    };
  }

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date),
  };
}

function formatLabel(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actionClass(action: string) {
  const normalized = action.toLowerCase();

  if (
    normalized.includes("delete") ||
    normalized.includes("reject") ||
    normalized.includes("fail")
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    normalized.includes("create") ||
    normalized.includes("approve") ||
    normalized.includes("login") ||
    normalized.includes("complete")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized.includes("update") ||
    normalized.includes("edit") ||
    normalized.includes("change")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function hasChanges(log: AuditLog) {
  return log.old_value !== null || log.new_value !== null;
}

function getDetail(log: AuditLog) {
  const value = log.new_value;

  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as Record<string, unknown>).detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }

  if (hasChanges(log)) {
    return "Recorded state change";
  }

  return "No additional detail";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchAuditLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Audit events could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const entityTypes = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((item) => item.entity_type)
            .filter(Boolean)
        )
      ).sort(),
    [logs]
  );

  const actions = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((item) => item.action)
            .filter(Boolean)
        )
      ).sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((item) => {
      if (
        entityType !== "ALL" &&
        item.entity_type !== entityType
      ) {
        return false;
      }

      if (
        action !== "ALL" &&
        item.action !== action
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.id,
        item.actor_id,
        item.actor_role,
        item.actor?.full_name,
        item.actor?.email,
        item.entity_type,
        item.entity_id,
        item.action,
        getDetail(item),
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [logs, search, entityType, action]);

  const actorCount = useMemo(
    () =>
      new Set(
        logs
          .map((item) => item.actor_id)
          .filter((value): value is number => value !== null)
      ).size,
    [logs]
  );

  const latestActivity = logs.length
    ? [...logs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )[0]
    : null;

  const latest = latestActivity
    ? formatDate(latestActivity.created_at)
    : null;

  return (
    <div className="min-h-full bg-[#f6f8fc] text-[#102a43]">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              <ShieldCheck size={15} />
              Administration
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Audit Logs
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Immutable activity trail for security, governance and
              administrative events across the compliance platform.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Events"
            value={logs.length.toLocaleString()}
            helper="Recorded audit events"
            icon={<Activity size={19} />}
          />

          <MetricCard
            label="Actors"
            value={actorCount.toLocaleString()}
            helper="Distinct recorded actors"
            icon={<UserRound size={19} />}
          />

          <MetricCard
            label="Entity Types"
            value={entityTypes.length.toLocaleString()}
            helper="Audited object types"
            icon={<Database size={19} />}
          />

          <MetricCard
            label="Last Activity"
            value={latest?.time || "-"}
            helper={latest?.date || "No activity recorded"}
            icon={<Clock3 size={19} />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search actor, entity, action or event detail..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <select
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                className="h-10 min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="ALL">All entity types</option>

                {entityTypes.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>

              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="h-10 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="ALL">All actions</option>

                {actions.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <TableHeader>Time</TableHeader>
                  <TableHeader>Actor</TableHeader>
                  <TableHeader>Entity</TableHeader>
                  <TableHeader>Action</TableHeader>
                  <TableHeader>Event Detail</TableHeader>
                  <TableHeader align="right">Changes</TableHeader>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      Loading audit events...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <div className="text-sm font-medium text-slate-700">
                        No audit events found
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        Adjust the current filters or search query.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const timestamp = formatDate(log.created_at);
                    const expanded = expandedId === log.id;

                    return (
                      <AuditRow
                        key={log.id}
                        log={log}
                        timestamp={timestamp}
                        expanded={expanded}
                        onToggle={() =>
                          setExpandedId(expanded ? null : log.id)
                        }
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredLogs.length.toLocaleString()} of{" "}
              {logs.length.toLocaleString()} events
            </span>

            <span>Audit trail is read-only</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </div>

          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {helper}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500`}
    >
      {children}
    </th>
  );
}

function AuditRow({
  log,
  timestamp,
  expanded,
  onToggle,
}: {
  log: AuditLog;
  timestamp: {
    date: string;
    time: string;
  };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-slate-100 transition hover:bg-slate-50/70">
        <td className="whitespace-nowrap px-5 py-4 align-top">
          <div className="text-sm font-medium text-slate-800">
            {timestamp.date}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {timestamp.time}
          </div>
        </td>

        <td className="px-5 py-4 align-top">
          <div className="text-sm font-semibold text-slate-800">
            {log.actor?.full_name ||
              (log.actor_id !== null ? `User #${log.actor_id}` : "System")}
          </div>

          {log.actor?.email ? (
            <div className="mt-1 text-xs text-slate-500">
              {log.actor.email}
            </div>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            {log.actor_role ? (
              <span>{formatLabel(log.actor_role)}</span>
            ) : null}

            {log.actor_id !== null ? (
              <span>User #{log.actor_id}</span>
            ) : null}

            {log.actor?.tenant_id !== null &&
            log.actor?.tenant_id !== undefined ? (
              <span>Tenant #{log.actor.tenant_id}</span>
            ) : null}
          </div>
        </td>

        <td className="px-5 py-4 align-top">
          <div className="text-sm font-medium text-slate-800">
            {formatLabel(log.entity_type)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {log.entity_id !== null ? `#${log.entity_id}` : "No entity ID"}
          </div>
        </td>

        <td className="px-5 py-4 align-top">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${actionClass(
              log.action
            )}`}
          >
            {formatLabel(log.action)}
          </span>
        </td>

        <td className="max-w-[360px] px-5 py-4 align-top">
          <div className="truncate text-sm text-slate-600">
            {getDetail(log)}
          </div>
        </td>

        <td className="px-5 py-4 text-right align-top">
          {hasChanges(log) ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
            >
              {expanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              {expanded ? "Hide" : "View"}
            </button>
          ) : (
            <span className="text-xs text-slate-400">None</span>
          )}
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={6} className="px-5 py-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChangePanel
                title="Previous State"
                value={log.old_value}
              />
              <ChangePanel
                title="New State"
                value={log.new_value}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ChangePanel({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        {title}
      </div>

      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-5 text-slate-600">
        {value === null || value === undefined
          ? "No recorded value"
          : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
