"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Database, RefreshCw } from "lucide-react";
import { apiFetch } from "../lib/api";

type Dataset = {
  code: string;
  name: string;
  read_only: boolean;
};

type ExplorerResponse = {
  dataset: string;
  page: number;
  page_size: number;
  total: number;
  rows: Record<string, unknown>[];
};

function formatValue(
  value: unknown,
  column: string
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (
    column === "created_at" ||
    column === "updated_at" ||
    column === "due_date"
  ) {
    const date = new Date(String(value));

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function isDescriptionColumn(column: string) {
  return column === "description";
}

function isStatusColumn(column: string) {
  return column === "status";
}

function isRiskLevelColumn(column: string) {
  return column === "risk_level";
}

function isCompactColumn(column: string) {
  return [
    "id",
    "impact",
    "likelihood",
    "score",
    "priority_score",
    "control_id",
    "requirement_id",
    "standard_id",
    "standard_version_id",
    "process_id",
    "source_id",
  ].includes(column);
}

export default function DataExplorerPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 50;

  async function loadMetadata() {
    const res = await apiFetch("/data-explorer/metadata");
    const data = await res.json();

    setDatasets(data.datasets || []);

    if (!dataset && data.datasets?.length) {
      setDataset(data.datasets[0].code);
    }
  }

  async function loadData(
    selectedDataset: string,
    selectedPage = page,
    selectedSearch = search
  ) {
    if (!selectedDataset) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(selectedPage),
        page_size: String(pageSize),
      });

      if (selectedSearch.trim()) {
        params.set("search", selectedSearch.trim());
      }

      const res = await apiFetch(
        `/data-explorer/${selectedDataset}?${params.toString()}`
      );

      const data: ExplorerResponse = await res.json();

      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error("Data Explorer error:", err);
      setError(err?.message || "Unable to load dataset");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetadata().catch((err) => {
      console.error("Data Explorer metadata error:", err);
      setError(err?.message || "Unable to load Data Explorer");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (dataset) {
      loadData(dataset, page, search);
    }
  }, [dataset, page]);

  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function changeDataset(code: string) {
    setDataset(code);
    setPage(1);
    setSearch("");
  }

  function executeSearch() {
    setPage(1);
    loadData(dataset, 1, search);
  }

  function refresh() {
    loadData(dataset, page, search);
  }

  function renderCell(row: Record<string, unknown>, column: string) {
    const value = row[column];
    const formatted = formatValue(value, column);

    if (formatted === "—") {
      return (
        <span className="text-slate-400">
          —
        </span>
      );
    }

    if (isDescriptionColumn(column)) {
      return (
        <div
          title={formatted}
          className="max-w-[420px] whitespace-normal break-words leading-5 text-slate-700 line-clamp-3"
        >
          {formatted}
        </div>
      );
    }

    if (isStatusColumn(column)) {
      const status = formatted.toUpperCase();

      let badgeClass =
        "border-slate-200 bg-slate-50 text-slate-600";

      if (
        ["APPROVED", "ACTIVE", "COMPLETED", "CLOSED", "DONE"].includes(
          status
        )
      ) {
        badgeClass =
          "border-emerald-200 bg-emerald-50 text-emerald-700";
      } else if (
        ["OPEN", "PENDING", "IN_PROGRESS", "IN PROGRESS"].includes(
          status
        )
      ) {
        badgeClass =
          "border-amber-200 bg-amber-50 text-amber-700";
      } else if (
        ["REJECTED", "FAILED", "OVERDUE", "CANCELLED"].includes(status)
      ) {
        badgeClass =
          "border-red-200 bg-red-50 text-red-700";
      }

      return (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass}`}
        >
          {formatted}
        </span>
      );
    }

    if (isRiskLevelColumn(column)) {
      const level = formatted.toUpperCase();

      let badgeClass =
        "border-slate-200 bg-slate-50 text-slate-600";

      if (level === "HIGH" || level === "CRITICAL") {
        badgeClass =
          "border-red-200 bg-red-50 text-red-700";
      } else if (level === "MEDIUM" || level === "MODERATE") {
        badgeClass =
          "border-amber-200 bg-amber-50 text-amber-700";
      } else if (level === "LOW") {
        badgeClass =
          "border-emerald-200 bg-emerald-50 text-emerald-700";
      }

      return (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass}`}
        >
          {formatted}
        </span>
      );
    }

    return (
      <span
        title={formatted}
        className={
          isCompactColumn(column)
            ? "whitespace-nowrap text-slate-700"
            : "block max-w-[300px] truncate whitespace-nowrap text-slate-700"
        }
      >
        {formatted}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1600px]">

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#0f2747] p-2 text-white shadow-sm">
              <Database size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Data Explorer
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Read-only enterprise data inspection across tenant datasets.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* DATASET TABS */}
          <div className="border-b border-slate-200 px-5 pt-4">
            <div className="flex flex-wrap gap-1">
              {datasets.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => changeDataset(item.code)}
                  className={`rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    dataset === item.code
                      ? "border-[#0f2747] bg-slate-50 text-[#0f2747]"
                      : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">

            <div className="flex flex-1 gap-2">
              <div className="relative max-w-2xl flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      executeSearch();
                    }
                  }}
                  placeholder="Search current dataset..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#0f2747] focus:ring-2 focus:ring-[#0f2747]/10"
                />
              </div>

              <button
                type="button"
                onClick={executeSearch}
                className="rounded-lg bg-[#0f2747] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#17385f]"
              >
                Search
              </button>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {/* DATASET META */}
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">
                {total.toLocaleString()} records
              </span>

              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-500">
                Read-only
              </span>
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-auto text-left text-sm">

              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                        isDescriptionColumn(column)
                          ? "min-w-[360px]"
                          : isCompactColumn(column)
                            ? "w-[90px]"
                            : "min-w-[140px]"
                      }`}
                    >
                      {column.replaceAll("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading ? (
                  <tr>
                    <td
                      colSpan={Math.max(columns.length, 1)}
                      className="px-4 py-14 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw
                          size={18}
                          className="animate-spin text-slate-400"
                        />
                        <span>
                          Loading dataset...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(columns.length, 1)}
                      className="px-4 py-14 text-center text-slate-500"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${dataset}-${String(row.id ?? index)}`}
                      className="transition-colors hover:bg-slate-50"
                    >
                      {columns.map((column) => (
                        <td
                          key={column}
                          className={`px-4 py-3 align-top ${
                            isDescriptionColumn(column)
                              ? "min-w-[360px] max-w-[460px]"
                              : isCompactColumn(column)
                                ? "whitespace-nowrap"
                                : "max-w-[320px] whitespace-nowrap"
                          }`}
                        >
                          {renderCell(row, column)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4">

            <span className="text-xs font-medium text-slate-500">
              Page {page} of {totalPages}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
