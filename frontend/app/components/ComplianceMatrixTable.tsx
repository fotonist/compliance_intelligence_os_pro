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
        Matrix kaydÄ± bulunamadÄ±.
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
        <span className={codeClassName}>{code || "â€”"}</span>
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
          (Rows {startRow}â€“{endRow} of {totalRows})
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
                        â€“ {row.process_area_title}
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
    <div className="mt-6 space-y-4">

      {pagedRows.map((row, i) => (

        <div
          key={
            row.id ??
            `matrix-card-${row.matrix_instance_id ?? "instance"}-${row.control_id ?? "control"}-${i}`
          }
          onClick={() => onView?.(row)}
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
            hover:shadow-md
            transition
            cursor-pointer
          "
        >

          <div className="flex items-start justify-between gap-4">

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                {row.standard_code ?? "STANDARD"}
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-900">
                {row.control_code ?? "-"}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                {row.control_title ?? "-"}
              </div>
            </div>


            <span
              className="
                rounded-full
                border
                px-3
                py-1
                text-xs
                font-semibold
              "
            >
              {row.coverage_status ?? "UNKNOWN"}
            </span>

          </div>


          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">

            <div>
              <div className="text-xs uppercase text-slate-400">
                Clause
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {row.clause_code ?? "-"}
              </div>

              <div className="text-sm text-slate-500">
                {row.clause_title ?? "-"}
              </div>
            </div>


            <div>
              <div className="text-xs uppercase text-slate-400">
                Evidence Assurance
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-900">
                {row.approved_evidence_count ?? 0}
              </div>

              <div className="text-xs text-slate-500">
                approved evidence
              </div>
            </div>


            <div>
              <div className="text-xs uppercase text-slate-400">
                Risk Exposure
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-900">
                {row.risk_level ?? "No Risk"}
              </div>
            </div>

          </div>


          <div className="mt-6 flex justify-between items-center">

            <div className="text-xs text-slate-400">
              Requirement: {row.requirement_title ?? "-"}
            </div>

            <div className="text-xs font-medium text-blue-600">
              Open Control Intelligence →
            </div>

          </div>

        </div>

      ))}

      <PaginationFooter />

    </div>
  );
}


