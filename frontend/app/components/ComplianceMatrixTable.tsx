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

export default function ComplianceMatrixTable({ rows, mode, onView }: Props) {
  const pageSize = 20;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows, mode]);

  const totalRows = rows?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  if (!rows || rows.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400">
        Matrix kaydı bulunamadı.
      </div>
    );
  }

  const badge =
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";

  const coverageColor = (status?: string) => {
    switch (status) {
      case "ACHIEVED":
        return "bg-green-700/30 text-green-300";
      case "PARTIAL":
        return "bg-amber-700/30 text-amber-300";
      case "NOT_COVERED":
        return "bg-red-700/20 text-red-300";
      default:
        return "bg-slate-700/40 text-slate-300";
    }
  };

  const riskColor = (level?: string | null) => {
    switch (level) {
      case "CRITICAL":
        return "bg-red-800/40 text-red-300";
      case "HIGH":
        return "bg-orange-700/40 text-orange-300";
      case "MEDIUM":
        return "bg-yellow-700/40 text-yellow-300";
      case "LOW":
        return "bg-green-700/40 text-green-300";
      default:
        return "bg-slate-700/40 text-slate-300";
    }
  };

  const riskTooltip = (level?: string | null) => {
    if (!level) return "No risk linked";
    return `Max risk severity: ${level}`;
  };

  const hierarchyCell = (
    code?: string,
    title?: string | null,
    description?: string | null,
    codeClassName = "font-medium"
  ) => (
    <div className="min-w-[180px] max-w-[320px]">
      <div className="flex items-center gap-2">
        <span className={codeClassName}>{code || "—"}</span>
        {description && (
          <span
            title={description}
            aria-label="View description"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-400 cursor-help"
          >
            i
          </span>
        )}
      </div>
      {title && (
        <div className="mt-0.5 text-xs text-slate-300 leading-5">
          {title}
        </div>
      )}
    </div>
  );

  const PaginationFooter = () => (
    <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
      <span>
        Page <b>{page}</b> / {totalPages}{" "}
        <span className="text-slate-500">
          (Rows {startRow}–{endRow} of {totalRows})
        </span>
      </span>
      <div className="flex gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
        >
          Prev
        </button>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );

  if (mode === "maturity") {
    return (
      <div className="mt-6">
        <div className="overflow-x-auto rounded-xl bg-slate-900/70 p-4">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-800/70 text-xs uppercase text-slate-300">
              <tr>
                <th className="p-3 text-left">Process Area</th>
                <th className="p-3 text-left">Practice</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-center">Target</th>
                <th className="p-3 text-center">Achieved</th>
                <th className="p-3 text-center">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {pagedRows.map((row, i) => (
                <tr
                  key={row.id ?? `${row.practice_id ?? "practice"}-${i}`}
                  onClick={() => onView?.(row)}
                  className="hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="p-3 font-medium">
                    {row.process_area_code}
                    {row.process_area_title && (
                      <span className="text-slate-400 ml-1">
                        – {row.process_area_title}
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-medium">
                    {row.practice_code}
                    {row.practice_title && (
                      <div className="text-slate-400 text-xs">
                        {row.practice_title}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-slate-300 line-clamp-2">
                    {row.practice_description ?? "-"}
                  </td>
                  <td className="p-3 text-center font-semibold">
                    CL{row.target_level ?? 0}
                  </td>
                  <td className="p-3 text-center font-semibold">
                    CL{row.achieved_level ?? 0}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`${badge} bg-slate-700/40`}>
                      {row.evidence_count ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationFooter />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="overflow-x-auto rounded-xl bg-slate-900/70 p-4">
        <table className="min-w-full text-sm text-slate-200">
          <thead className="bg-slate-800/70 text-xs uppercase text-slate-300">
            <tr>
              <th className="p-3 text-left">Standard</th>
              <th className="p-3 text-left">Clause</th>
              <th className="p-3 text-left">Requirement</th>
              <th className="p-3 text-left">Control</th>
              <th className="p-3 text-center">Coverage</th>
              <th className="p-3 text-center">Evidence</th>
              <th className="p-3 text-center">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {pagedRows.map((row, i) => (
              <tr
                key={
                  row.id ??
                  `matrix-row-${row.matrix_instance_id ?? "instance"}-${row.clause_id ?? "clause"}-${row.requirement_id ?? "requirement"}-${row.control_id ?? "control"}-${i}`
                }
                onClick={() => onView?.(row)}
                className="hover:bg-slate-800/40 cursor-pointer align-top"
              >
                <td className="p-3">
                  {hierarchyCell(
                    row.standard_code,
                    row.standard_title
                  )}
                </td>
                <td className="p-3">
                  {hierarchyCell(
                    row.clause_code,
                    row.clause_title,
                    row.clause_description
                  )}
                </td>
                <td className="p-3">
                  {hierarchyCell(
                    row.requirement_code,
                    row.requirement_title,
                    row.requirement_description
                  )}
                </td>
                <td className="p-3">
                  {hierarchyCell(
                    row.control_code,
                    row.control_title,
                    row.control_description,
                    "font-semibold text-slate-100"
                  )}
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`${badge} ${coverageColor(row.coverage_status)}`}
                  >
                    {row.coverage_status ?? "UNKNOWN"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {row.evidence_count && row.evidence_count > 0 ? (
                    <span className={`${badge} bg-blue-700/30 text-blue-300`}>
                      {row.evidence_count} evidence
                    </span>
                  ) : (
                    <span className="italic text-slate-400">No evidence</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span
                    title={riskTooltip(row.risk_level)}
                    className={`${badge} ${riskColor(row.risk_level)} cursor-help`}
                  >
                    {row.risk_level ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter />
    </div>
  );
}
