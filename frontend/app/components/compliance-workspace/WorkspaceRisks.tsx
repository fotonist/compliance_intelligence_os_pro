"use client";

import { useMemo, useState } from "react";
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

interface Props {
  workspace: any;
}

function normalize(value: any) {
  return String(value ?? "").trim().toUpperCase();
}

function severityConfig(level: any) {
  const value = normalize(level);

  if (value === "CRITICAL") {
    return {
      label: "Critical",
      className: "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-600",
    };
  }

  if (value === "HIGH") {
    return {
      label: "High",
      className: "border-orange-200 bg-orange-50 text-orange-700",
      dot: "bg-orange-500",
    };
  }

  if (value === "MEDIUM") {
    return {
      label: "Medium",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    };
  }

  if (value === "LOW") {
    return {
      label: "Low",
      className: "border-slate-200 bg-slate-50 text-slate-600",
      dot: "bg-slate-400",
    };
  }

  return {
    label: level || "Unclassified",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  };
}

function SeverityBadge({ level }: { level: any }) {
  const config = severityConfig(level);

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function Metric({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "default" | "danger" | "warning";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-slate-900";

  return (
    <div className="bg-white px-5 py-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </div>

      <div
        className={`mt-1.5 text-xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-0.5 text-[10px] text-slate-500">
        {description}
      </div>
    </div>
  );
}

export default function WorkspaceRisks({
  workspace,
}: Props) {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState("all");

  const risks = Array.isArray(workspace?.risks)
    ? workspace.risks
    : [];

  const counts = useMemo(() => {
    return {
      total: risks.length,
      critical: risks.filter(
        (risk: any) =>
          normalize(
            risk.risk_level ?? risk.severity
          ) === "CRITICAL"
      ).length,
      high: risks.filter(
        (risk: any) =>
          normalize(
            risk.risk_level ?? risk.severity
          ) === "HIGH"
      ).length,
      medium: risks.filter(
        (risk: any) =>
          normalize(
            risk.risk_level ?? risk.severity
          ) === "MEDIUM"
      ).length,
    };
  }, [risks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return risks.filter((risk: any) => {
      const level = normalize(
        risk.risk_level ?? risk.severity
      );

      const searchable = [
        risk.title,
        risk.name,
        risk.description,
        risk.owner,
        risk.treatment,
        risk.risk_treatment,
        risk.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !q || searchable.includes(q);

      const matchesSeverity =
        severityFilter === "all" ||
        level === severityFilter;

      return matchesQuery && matchesSeverity;
    });
  }, [risks, query, severityFilter]);

  return (
    <div className="space-y-5">

      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Risk Management
              </div>

              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Risk Register
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Risk exposure and treatment items associated with
                the current compliance object.
              </p>
            </div>

            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-1.5">
              <ShieldExclamationIcon className="h-3.5 w-3.5 text-slate-500" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {filtered.length} of {counts.total} risks
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 xl:grid-cols-4">
          <Metric
            label="Total"
            value={counts.total}
            description="Registered risks"
          />

          <Metric
            label="Critical"
            value={counts.critical}
            description="Immediate attention"
            tone={
              counts.critical > 0
                ? "danger"
                : "default"
            }
          />

          <Metric
            label="High"
            value={counts.high}
            description="Priority review"
            tone={
              counts.high > 0
                ? "warning"
                : "default"
            }
          />

          <Metric
            label="Medium"
            value={counts.medium}
            description="Managed exposure"
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Search risks..."
              className="h-9 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) =>
              setSeverityFilter(e.target.value)
            }
            className="h-9 border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="all">
              All severities
            </option>
            <option value="CRITICAL">
              Critical
            </option>
            <option value="HIGH">
              High
            </option>
            <option value="MEDIUM">
              Medium
            </option>
            <option value="LOW">
              Low
            </option>
          </select>
        </div>

      </section>

      <section className="border border-slate-200 bg-white">

        <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_110px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:grid">
          <div>Risk</div>
          <div>Severity</div>
          <div>Treatment / Owner</div>
          <div className="text-right">
            Status
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-slate-300" />

            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              No risk records
            </h3>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              No risks match the current search and
              severity filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(
              (risk: any, index: number) => {
                const level =
                  risk.risk_level ??
                  risk.severity;

                const title =
                  risk.title ??
                  risk.name ??
                  "Untitled risk";

                const treatment =
                  risk.treatment ??
                  risk.risk_treatment ??
                  "Not specified";

                const owner =
                  risk.owner ??
                  risk.risk_owner ??
                  "Unassigned";

                const status =
                  risk.status ??
                  "Open";

                return (
                  <div
                    key={
                      risk.id ??
                      risk.risk_id ??
                      index
                    }
                    className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_120px_150px_110px] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
                          <ShieldExclamationIcon className="h-4 w-4 text-slate-500" />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">
                            {title}
                          </div>

                          {risk.description && (
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {risk.description}
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-slate-400">
                            Risk #{risk.id ?? index + 1}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <SeverityBadge level={level} />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-600">
                        {treatment}
                      </div>

                      <div className="mt-1 truncate text-[10px] text-slate-400">
                        Owner: {owner}
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <span className="inline-flex border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                        {status}
                      </span>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

      </section>

    </div>
  );
}
