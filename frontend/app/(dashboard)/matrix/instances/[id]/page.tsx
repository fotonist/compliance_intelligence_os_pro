"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

type MatrixInstanceDetail = {
  id: number;
  status: string;
  standard_id: number;
  standard_version_id: number;
  created_by: number | null;
  created_at: string;
  row_count: number;
};

type MatrixRow = {
  id: number;
  row_key: string;
  payload: Record<string, any>;
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

export default function MatrixInstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [token, setToken] = useState("");

  const [item, setItem] =
    useState<MatrixInstanceDetail | null>(null);

  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [summary, setSummary] =
    useState<MatrixSummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";

    setToken(t);
  }, []);

  useEffect(() => {
    if (!token || !id) return;

    loadDetail();
    loadSummary();
    loadRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function loadDetail() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/matrix/instances/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setItem(data);
    } catch (e: any) {
      setError(
        e.message || "Failed to load matrix instance"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const res = await fetch(
        `${API_BASE}/matrix/instances/${id}/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) return;

      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadRows(nextOffset: number) {
    setRowsLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/matrix/instances/${id}/rows?limit=${limit}&offset=${nextOffset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
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

  function renderCell(value: any) {
    if (value === null || value === undefined) {
      return "-";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return value;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Matrix Instance #{id}
        </h1>

        <button
          onClick={() => router.back()}
          className="text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
        >
          ← Back
        </button>
      </div>

      {loading && (
        <div className="text-sm text-slate-400">
          Loading…
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && item && (
        <div className="border border-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-400">
              Standard ID
            </div>
            <div>{item.standard_id}</div>
          </div>

          <div>
            <div className="text-xs text-slate-400">
              Status
            </div>
            <span className="inline-block text-xs px-2 py-0.5 rounded bg-emerald-700 text-white">
              {item.status}
            </span>
          </div>

          <div>
            <div className="text-xs text-slate-400">
              Standard Version
            </div>
            <div>{item.standard_version_id}</div>
          </div>

          <div>
            <div className="text-xs text-slate-400">
              Row Count
            </div>
            <div>{item.row_count}</div>
          </div>

          <div>
            <div className="text-xs text-slate-400">
              Created At
            </div>
            <div>
              {new Date(
                item.created_at
              ).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400">
              Compliance
            </div>
            <div className="text-2xl font-bold">
              {summary.compliance_score}%
            </div>
          </div>

          <div className="border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400">
              Evidence Coverage
            </div>
            <div className="text-2xl font-bold">
              {summary.evidence_coverage}%
            </div>
          </div>

          <div className="border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400">
              Open Gaps
            </div>
            <div className="text-2xl font-bold">
              {summary.open_gaps}
            </div>
          </div>

          <div className="border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400">
              High Risks
            </div>
            <div className="text-2xl font-bold">
              {summary.high_risks}
            </div>
          </div>
        </div>
      )}

      <div className="border border-slate-800 rounded-lg">
        <div className="px-4 py-2 border-b border-slate-800 text-sm font-medium">
          Rows
        </div>

        {rowsLoading && (
          <div className="p-4 text-sm text-slate-400">
            Loading rows…
          </div>
        )}

        {!rowsLoading && rows.length === 0 && (
          <div className="p-4 text-sm text-slate-400">
            No rows found.
          </div>
        )}

        {!rowsLoading && rows.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  {Object.keys(
                    rows[0].payload || {}
                  ).map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-left"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-800"
                  >
                    {Object.keys(
                      r.payload || {}
                    ).map((key) => (
                      <td
                        key={key}
                        className="px-3 py-2"
                      >
                        {renderCell(
                          r.payload[key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-sm">
          <div>
            {total === 0
              ? "0"
              : `${offset + 1}–${Math.min(
                  offset + limit,
                  total
                )} / ${total}`}
          </div>

          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() =>
                loadRows(
                  Math.max(
                    0,
                    offset - limit
                  )
                )
              }
              className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
            >
              Prev
            </button>

            <button
              disabled={
                offset + limit >= total
              }
              onClick={() =>
                loadRows(offset + limit)
              }
              className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}