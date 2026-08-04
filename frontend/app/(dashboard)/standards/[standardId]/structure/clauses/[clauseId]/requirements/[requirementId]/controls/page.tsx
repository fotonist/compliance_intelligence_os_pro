"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

/* ================= TYPES ================= */

type Control = {
  id: number;
  code: string;
  title?: string;
};

/* ================= AUTH ================= */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

/* ================= PAGE ================= */

export default function ControlsPage() {
  const { standardId, clauseId, requirementId } = useParams<{
    standardId: string;
    clauseId: string;
    requirementId: string;
  }>();

  const router = useRouter();

  const [rows, setRows] = useState<Control[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===== Pagination ===== */
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function fetchControls() {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(
      `${API_BASE}/controls?requirement_id=${requirementId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setLoading(false);

    if (!res.ok) {
      setError("Failed to load controls");
      return;
    }

    const json = await res.json();
    setRows(Array.isArray(json) ? json : []);
    setPage(1); // reset page on reload
  }

  useEffect(() => {
    if (!requirementId) return;
    fetchControls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirementId]);

  /* ===== Pagination derived ===== */

  const totalPages = Math.max(
    1,
    Math.ceil(rows.length / pageSize)
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  return (
    <div className="p-6 space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">
          Controls
        </h1>

        <button
          onClick={() =>
            router.push(
              `/standards/${standardId}/structure/clauses/${clauseId}/requirements/${requirementId}/controls/create`
            )
          }
          className="text-sm px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          + Add Control
        </button>
      </div>

      <button
        onClick={() => router.push(`/standards/${standardId}/structure`)}
        className="text-sm underline text-slate-400"
      >
        ← Back to Structure
      </button>

      {error && (
        <div className="border border-red-800 bg-red-950/40 text-red-200 p-3 rounded">
          {error}
        </div>
      )}

      {/* TABLE */}
      <div className="border border-slate-800 rounded bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-200">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading && pagedRows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No controls
                </td>
              </tr>
            )}

            {pagedRows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-slate-800 hover:bg-slate-800/60"
              >
                <td className="px-4 py-3 font-mono text-slate-300">
                  {c.code}
                </td>

                <td className="px-4 py-3 text-slate-100">
                  {c.title || ""}
                </td>

                <td className="px-4 py-3">
                  <div className="flex gap-4 text-xs">
                    <button
                      onClick={() =>
                        router.push(`/controls/${c.id}/evidences`)
                      }
                      className="text-sky-400 hover:underline"
                    >
                      View Evidences
                    </button>

                    <button
                      onClick={() =>
                        router.push(
                          `/controls/${c.id}/evidences/create`
                        )
                      }
                      className="text-emerald-400 hover:underline"
                    >
                      + Add Evidence
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>
          Page {page} / {totalPages}
        </span>

        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
          >
            Prev
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
