"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/services/api";

type MatrixInstanceDetail = {
  id: number;
  status: string;
  standard_id: number;
  standard_version_id: number;
  created_by: number | null;
  created_at: string;
  row_count: number;

  started_at?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: number | null;

  standard_code?: string | null;
  standard_name?: string | null;
  standard_version_code?: string | null;

  column_snapshot?: Array<{
    key: string;
    label: string;
    visible: boolean;
    sourceType?: string;
    entity?: string;
    field?: string;
    fixedValue?: string | null;
    position?: number;
  }> | null;
};

type MatrixRow = {
  id: number;
  row_key: string;
  payload: Record<string, unknown>;
};

type MatrixSummary = {
  total_controls: number;
  compliance_score: number;
  control_coverage: number;
  evidence_coverage: number;
  open_gaps: number;
  high_risks: number;
  open_tasks: number;
  compliant: number;
  non_compliant: number;
  not_started: number;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatPercent(value: number | undefined | null) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function statusLabel(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "SUBMITTED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "IN_PROGRESS":
    case "IN-PROGRESS":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "GENERATED":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function riskClass(value: unknown) {
  const risk = String(value ?? "").toUpperCase();

  if (risk === "CRITICAL") {
    return "text-red-700 bg-red-50 border-red-200";
  }

  if (risk === "HIGH") {
    return "text-orange-700 bg-orange-50 border-orange-200";
  }

  if (risk === "MEDIUM") {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }

  if (risk === "LOW") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }

  return "text-slate-600 bg-slate-50 border-slate-200";
}

function coverageClass(value: unknown) {
  const coverage = String(value ?? "").toUpperCase();

  if (coverage === "COVERED") {
    return "text-emerald-700 bg-emerald-50";
  }

  if (coverage === "PARTIAL") {
    return "text-amber-700 bg-amber-50";
  }

  if (coverage === "NOT_COVERED" || coverage === "NOT-COVERED") {
    return "text-red-700 bg-red-50";
  }

  return "text-slate-600 bg-slate-50";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneMap = {
    neutral: "text-slate-950",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </div>
          <div className={`mt-2 text-2xl font-semibold tracking-tight ${toneMap[tone]}`}>
            {value}
          </div>
          {detail && (
            <div className="mt-1 text-xs text-slate-500">
              {detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MatrixInstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");

  const [item, setItem] = useState<MatrixInstanceDetail | null>(null);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [summary, setSummary] = useState<MatrixSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");

  useEffect(() => {
    if (!id) return;

    loadDetail();
    loadSummary();
    loadRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadDetail() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/matrix/instances/${id}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      setItem(await res.json());
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to load matrix instance"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const res = await apiFetch(
        `/matrix/instances/${id}/summary`
      );

      if (!res.ok) return;

      setSummary(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  async function loadRows(nextOffset: number) {
    setRowsLoading(true);

    try {
      const res = await apiFetch(
        `/matrix/instances/${id}/rows?limit=${limit}&offset=${nextOffset}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setRows(data.items || []);
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (e) {
      console.error(e);
    } finally {
      setRowsLoading(false);
    }
  }

  const columns = useMemo(() => {
    const available = new Set(
      rows.flatMap((row) =>
        Object.keys(row.payload || {})
      )
    );

    const snapshot = Array.isArray(item?.column_snapshot)
      ? item.column_snapshot
          .filter((column) => column?.visible && column?.key)
          .sort(
            (a, b) =>
              (a.position ?? 0) - (b.position ?? 0)
          )
      : [];

    if (snapshot.length > 0) {
      return snapshot.filter((column) =>
        available.has(column.key)
      );
    }

    const preferred = [
      "control_code",
      "control_description",
      "clause_code",
      "clause_description",
      "requirement_code",
      "requirement_description",
      "coverage_status",
      "risk_level",
      "approved_evidence_count",
      "open_gap_count",
      "open_task_count",
    ];

    return preferred
      .filter((column) => available.has(column))
      .map((key, index) => ({
        key,
        label: key.replace(/_/g, " "),
        visible: true,
        position: index + 1,
      }));
  }, [item?.column_snapshot, rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const payload = row.payload || {};

      const haystack = [
        row.row_key,
        ...Object.values(payload).map(displayValue),
      ]
        .join(" ")
        .toLowerCase();

      const coverage = String(
        payload.coverage_status ?? ""
      ).toUpperCase();

      const risk = String(
        payload.risk_level ?? ""
      ).toUpperCase();

      const matchesSearch =
        !query || haystack.includes(query);

      const matchesCoverage =
        coverageFilter === "ALL" ||
        coverage === coverageFilter;

      const matchesRisk =
        riskFilter === "ALL" ||
        risk === riskFilter;

      return (
        matchesSearch &&
        matchesCoverage &&
        matchesRisk
      );
    });
  }, [rows, search, coverageFilter, riskFilter]);

  const compliance = summary?.compliance_score ?? 0;

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* Header */}
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
              <button
                onClick={() => router.back()}
                className="transition hover:text-slate-900"
              >
                Control Matrix
              </button>
              <span>/</span>
              <span>Instances</span>
              <span>/</span>
              <span className="text-slate-700">#{id}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Matrix Instance #{id}
              </h1>

              {item && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                    item.status
                  )}`}
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                  {statusLabel(item.status)}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Control coverage, evidence posture, risks and remediation
              status for this assessment instance.
            </p>
          </div>

          <button
            onClick={() => router.back()}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
          >
            ← Back to instances
          </button>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Instance identity */}
        {!loading && item && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Instance Overview
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Assessment identity and lifecycle metadata
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-5 py-5 md:grid-cols-4 xl:grid-cols-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Standard
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {item.standard_code || `Standard #${item.standard_id}`}
                </div>
                {item.standard_name && (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {item.standard_name}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Version
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {item.standard_version_code ||
                    `Version #${item.standard_version_id}`}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Controls
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {formatNumber(item.row_count)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Created
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {formatDate(item.created_at)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Started
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {formatDate(item.started_at)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Submitted
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {formatDate(item.submitted_at)}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* KPI / posture */}
        {summary && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Compliance"
                value={formatPercent(summary.compliance_score)}
                detail={`${formatNumber(summary.total_controls)} controls assessed`}
                tone={
                  compliance >= 80
                    ? "success"
                    : compliance >= 50
                    ? "warning"
                    : "danger"
                }
              />

              <MetricCard
                label="Evidence Coverage"
                value={formatPercent(summary.evidence_coverage)}
                detail="Controls with approved evidence"
                tone={
                  summary.evidence_coverage >= 80
                    ? "success"
                    : summary.evidence_coverage >= 50
                    ? "warning"
                    : "danger"
                }
              />

              <MetricCard
                label="Open Gaps"
                value={formatNumber(summary.open_gaps)}
                detail={`${formatNumber(summary.open_tasks)} open tasks`}
                tone={summary.open_gaps > 0 ? "warning" : "success"}
              />

              <MetricCard
                label="High / Critical Risk"
                value={formatNumber(summary.high_risks)}
                detail={`${formatNumber(summary.non_compliant)} non-compliant controls`}
                tone={summary.high_risks > 0 ? "danger" : "success"}
              />
            </section>

            {/* Compliance posture */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Compliance Posture
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Weighted control coverage for this matrix instance
                  </div>
                </div>

                <div className="text-sm font-semibold text-slate-900">
                  {formatPercent(summary.control_coverage)}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, summary.control_coverage || 0)
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <div className="text-emerald-600">Compliant</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-800">
                    {formatNumber(summary.compliant)}
                  </div>
                </div>

                <div className="rounded-lg bg-red-50 px-3 py-2">
                  <div className="text-red-600">Non-compliant</div>
                  <div className="mt-1 text-sm font-semibold text-red-800">
                    {formatNumber(summary.non_compliant)}
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <div className="text-amber-600">Not started</div>
                  <div className="mt-1 text-sm font-semibold text-amber-800">
                    {formatNumber(summary.not_started)}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-100 px-3 py-2">
                  <div className="text-slate-500">Evidence</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {formatPercent(summary.evidence_coverage)}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Control register */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Control Register
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Canonical controls and current compliance posture
                </div>
              </div>

              <div className="text-xs text-slate-500">
                {formatNumber(total)} total records
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search controls, requirements, practices..."
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={coverageFilter}
                onChange={(event) =>
                  setCoverageFilter(event.target.value)
                }
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value="ALL">All coverage</option>
                <option value="COVERED">Covered</option>
                <option value="PARTIAL">Partial</option>
                <option value="NOT_COVERED">Not covered</option>
              </select>

              <select
                value={riskFilter}
                onChange={(event) =>
                  setRiskFilter(event.target.value)
                }
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value="ALL">All risks</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {rowsLoading ? (
            <div className="px-5 py-16 text-center">
              <div className="text-sm font-medium text-slate-700">
                Loading control register
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Retrieving matrix records...
              </div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="text-sm font-medium text-slate-700">
                No controls found
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Adjust the search or filters to continue.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1650px] table-fixed text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {columns.map((column) => {
                      const isCodeColumn =
                        column.key === "control_code" ||
                        column.key === "clause_code" ||
                        column.key === "requirement_code" ||
                        column.key === "practice_code";

                      const isDefinitionColumn =
                        column.key === "control_description" ||
                        column.key === "clause_description" ||
                        column.key === "requirement_description";

                      const isStatusColumn =
                        column.key === "coverage_status" ||
                        column.key === "risk_level";

                      const widthClass = isDefinitionColumn
                        ? "w-[360px]"
                        : isCodeColumn
                        ? "w-[125px]"
                        : isStatusColumn
                        ? "w-[140px]"
                        : "w-[135px]";

                      return (
                        <th
                          key={column.key}
                          className={`${widthClass} whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500`}
                        >
                          {column.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition hover:bg-slate-50"
                    >
                      {columns.map((column) => {
                        const columnKey = column.key;
                        const value = row.payload?.[columnKey];

                        if (columnKey === "coverage_status") {
                          return (
                            <td
                              key={column.key}
                              className="whitespace-nowrap px-4 py-3"
                            >
                              <span
                                className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${coverageClass(
                                  value
                                )}`}
                              >
                                {displayValue(value)}
                              </span>
                            </td>
                          );
                        }

                        if (columnKey === "risk_level") {
                          return (
                            <td
                              key={column.key}
                              className="whitespace-nowrap px-4 py-3"
                            >
                              <span
                                className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${riskClass(
                                  value
                                )}`}
                              >
                                {displayValue(value)}
                              </span>
                            </td>
                          );
                        }

                        if (
                          columnKey === "control_code" ||
                          columnKey === "clause_code" ||
                          columnKey === "requirement_code" ||
                          columnKey === "practice_code"
                        ) {
                          return (
                            <td
                              key={column.key}
                              className="whitespace-nowrap px-4 py-3 font-medium text-slate-800"
                            >
                              {displayValue(value)}
                            </td>
                          );
                        }

                        const isDefinitionColumn =
                          columnKey === "control_description" ||
                          columnKey === "clause_description" ||
                          columnKey === "requirement_description";

                        return (
                          <td
                            key={column.key}
                            className={
                              isDefinitionColumn
                                ? "w-[360px] max-w-[360px] whitespace-normal break-words px-4 py-3 align-top leading-5 text-slate-600"
                                : "w-[135px] max-w-[135px] whitespace-normal break-words px-4 py-3 align-top text-slate-600"
                            }
                            title={displayValue(value)}
                          >
                            {displayValue(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {total === 0
                ? "0 records"
                : `${offset + 1}–${Math.min(
                    offset + limit,
                    total
                  )} of ${formatNumber(total)}`}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={offset === 0 || rowsLoading}
                onClick={() =>
                  loadRows(Math.max(0, offset - limit))
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                disabled={
                  offset + limit >= total || rowsLoading
                }
                onClick={() => loadRows(offset + limit)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
