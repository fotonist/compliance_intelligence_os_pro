"use client";

import { useEffect, useMemo, useState } from "react";

export interface MatrixRow {
  id?: number;
  standard_id?: number;
  standard_code?: string;
  standard_title?: string;
  session_id?: number;
  matrix_instance_id?: number;
  clause_id?: number;
  requirement_id?: number;
  practice_id?: number;
  control_id?: number;
  process_area_code?: string;
  process_area_title?: string;
  practice_code?: string;
  practice_title?: string;
  practice_description?: string;
  target_level?: number;
  achieved_level?: number;
  evidence_count?: number;
  clause_code?: string;
  clause_title?: string;
  clause_description?: string;
  requirement_code?: string;
  requirement_title?: string;
  requirement_description?: string;
  control_code?: string;
  control_title?: string;
  control_description?: string;
  coverage_status?: string;
  approved_evidence_count?: number;
  risk_level?: string | null;
}

interface Props {
  rows: MatrixRow[];
  mode: "control" | "maturity";
  onView?: (row: MatrixRow) => void;
}

function CapabilityBadge({
  level,
  muted = false,
}: {
  level?: number;
  muted?: boolean;
}) {
  const value = level ?? 0;

  return (
    <span
      className={[
        "inline-flex min-w-[46px] items-center justify-center",
        "border px-2 py-1 text-[11px] font-semibold",
        "tracking-wide",
        muted
          ? "border-slate-200 bg-slate-50 text-slate-500"
          : value > 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-600",
      ].join(" ")}
    >
      CL{value}
    </span>
  );
}

function EvidenceBadge({ count }: { count?: number }) {
  const value = count ?? 0;

  return (
    <span
      className={[
        "inline-flex min-w-[32px] items-center justify-center",
        "border px-2 py-1 text-[11px] font-semibold",
        value > 0
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-50 text-slate-500",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function CoverageBadge({ status }: { status?: string }) {
  const normalized = String(status ?? "").toUpperCase();

  const config =
    normalized === "ACHIEVED"
      ? {
          label: "Achieved",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : normalized === "PARTIAL"
        ? {
            label: "Partial",
            className:
              "border-amber-200 bg-amber-50 text-amber-700",
          }
        : normalized === "NOT_COVERED"
          ? {
              label: "Not Covered",
              className:
                "border-red-200 bg-red-50 text-red-700",
            }
          : {
              label: status || "Unknown",
              className:
                "border-slate-200 bg-slate-50 text-slate-500",
            };

  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}

function PaginationFooter({
  page,
  totalPages,
  startRow,
  endRow,
  totalRows,
  setPage,
}: {
  page: number;
  totalPages: number;
  startRow: number;
  endRow: number;
  totalRows: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-slate-500">
        Showing{" "}
        <span className="font-medium text-slate-700">
          {totalRows === 0 ? 0 : startRow}
        </span>
        {"–"}
        <span className="font-medium text-slate-700">
          {endRow}
        </span>{" "}
        of{" "}
        <span className="font-medium text-slate-700">
          {totalRows}
        </span>{" "}
        practices
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        <span className="min-w-[72px] px-3 py-1.5 text-center text-xs font-medium text-slate-600">
          Page {page} / {totalPages}
        </span>

        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ComplianceMatrixTable({
  rows,
  mode,
  onView,
}: Props) {
  const pageSize = 20;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows, mode]);

  const totalRows = rows?.length || 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRows / pageSize)
  );

  const startRow =
    totalRows === 0 ? 0 : (page - 1) * pageSize + 1;

  const endRow =
    Math.min(page * pageSize, totalRows);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  if (!rows || rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="text-sm font-medium text-slate-700">
          No matrix rows available
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Generate the matrix structure before assessment.
        </div>
      </div>
    );
  }

  if (mode === "maturity") {
    return (
      <div className="overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Maturity Assessment
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              Process Capability Matrix
            </h2>
          </div>

          <div className="text-xs text-slate-500">
            {totalRows} practices in assessment scope
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-[190px] px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Process Area
                </th>

                <th className="w-[260px] px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Practice
                </th>

                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Description
                </th>

                <th className="w-[120px] px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Target
                </th>

                <th className="w-[150px] px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Achieved
                </th>

                <th className="w-[110px] px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Evidence
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pagedRows.map((row, i) => {
                const target = row.target_level ?? 0;
                const achieved = row.achieved_level ?? 0;

                const progress =
                  target > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (achieved / target) * 100
                        )
                      )
                    : 0;

                return (
                  <tr
                    key={
                      row.id ??
                      `${row.practice_id ?? "practice"}-${i}`
                    }
                    onClick={() => onView?.(row)}
                    className="group cursor-pointer bg-white transition-colors hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600">
                          {row.process_area_code
                            ?.slice(0, 3)
                            .toUpperCase() || "—"}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800">
                            {row.process_area_code || "—"}
                          </div>

                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            {row.process_area_title || "Process Area"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold text-slate-800">
                        {row.practice_code || "—"}
                      </div>

                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {row.practice_title || "Practice"}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div
                        className="max-w-[420px] truncate text-xs leading-5 text-slate-500"
                        title={
                          row.practice_description || undefined
                        }
                      >
                        {row.practice_description || "No description available"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center align-top">
                      <CapabilityBadge
                        level={target}
                        muted
                      />
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col items-center gap-2">
                        <CapabilityBadge level={achieved} />

                        <div className="h-1 w-20 overflow-hidden bg-slate-100">
                          <div
                            className="h-full bg-slate-500 transition-all"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>

                        <span className="text-[10px] text-slate-400">
                          {progress}% of target
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center align-top">
                      <EvidenceBadge
                        count={row.evidence_count}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          page={page}
          totalPages={totalPages}
          startRow={startRow}
          endRow={endRow}
          totalRows={totalRows}
          setPage={setPage}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="flex items-end justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Control Assessment
          </div>
          <h2 className="mt-1 text-sm font-semibold text-slate-900">
            Compliance Control Matrix
          </h2>
        </div>

        <div className="text-xs text-slate-500">
          {totalRows} controls in assessment scope
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Standard
              </th>

              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Control
              </th>

              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Requirement
              </th>

              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Clause
              </th>

              <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Coverage
              </th>

              <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Evidence
              </th>

              <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Risk
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {pagedRows.map((row, i) => (
              <tr
                key={
                  row.id ??
                  `control-${row.control_id ?? "control"}-${i}`
                }
                onClick={() => onView?.(row)}
                className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
              >
                <td className="px-5 py-4 align-top">
                  <div className="font-semibold text-slate-800">
                    {row.standard_code || "—"}
                  </div>
                </td>

                <td className="px-5 py-4 align-top">
                  <div className="font-semibold text-slate-800">
                    {row.control_code || "—"}
                  </div>

                  <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                    {row.control_description || row.control_title || "Control"}
                  </div>
                </td>

                <td className="px-5 py-4 align-top">
                  <div className="max-w-[250px] truncate text-xs font-medium text-slate-700">
                    {row.requirement_code || "—"}
                  </div>

                  <div className="mt-1 max-w-[250px] truncate text-xs text-slate-500">
                    {row.requirement_description || row.requirement_title || "Requirement"}
                  </div>
                </td>

                <td className="px-5 py-4 align-top">
                  <div className="text-xs font-medium text-slate-700">
                    {row.clause_code || "—"}
                  </div>

                  <div className="mt-1 max-w-[180px] truncate text-xs text-slate-500">
                    {row.clause_description || row.clause_title || "Clause"}
                  </div>
                </td>

                <td className="px-5 py-4 text-center align-top">
                  <CoverageBadge status={row.coverage_status} />
                </td>

                <td className="px-5 py-4 text-center align-top">
                  <EvidenceBadge
                    count={row.approved_evidence_count}
                  />
                </td>

                <td className="px-5 py-4 text-center align-top">
                  <span className="text-xs font-medium text-slate-500">
                    {row.risk_level || "None"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        startRow={startRow}
        endRow={endRow}
        totalRows={totalRows}
        setPage={setPage}
      />
    </div>
  );
}
