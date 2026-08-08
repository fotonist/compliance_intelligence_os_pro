"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import EvidenceStatusBadge from "@/app/components/EvidenceStatusBadge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

/* ================= TYPES ================= */

type EvidenceRow = {
  id?: number;
  evidence_id?: number;
  title: string;
  status?: string;
  coverage?: string;
  files_count?: number;
  related_risks_count?: number;
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

export default function ControlEvidencesPage() {
  const { controlId } = useParams<{ controlId: string }>();
  const router = useRouter();

  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===== Pagination ===== */
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function fetchEvidences() {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(
      `${API_BASE}/evidences?control_id=${controlId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setLoading(false);

    if (!res.ok) {
      setError("Failed to load evidences");
      return;
    }

    const json = await res.json();

    const items = Array.isArray(json)
      ? json
      : Array.isArray(json.items)
      ? json.items
      : [];

    setRows(items);
    setPage(1); // reset page on reload
  }

  useEffect(() => {
    if (!controlId) return;
    fetchEvidences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlId]);

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
          Control Evidences
        </h1>

        <button
          onClick={() =>
            router.push(`/controls/${controlId}/evidences/create`)
          }
          className="text-sm px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          + Add Evidence
        </button>
      </div>

      <button
        onClick={() => router.back()}
        className="text-sm underline text-slate-400"
      >
        ← Back
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
              <th className="px-4 py-3 text-left">Evidence</th>
              <th className="px-4 py-3 text-left">Coverage</th>
              <th className="px-4 py-3 text-left">Files</th>
              <th className="px-4 py-3 text-left">Risks</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading && pagedRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No evidences found
                </td>
              </tr>
            )}

            {pagedRows.map((e, idx) => {
              const evidenceId = e.id ?? e.evidence_id;
              const key = evidenceId ?? `${controlId}-${idx}`;

              return (
                <tr
                  key={key}
                  onClick={() => {
                    if (evidenceId) {
                      router.push(`/evidences/${evidenceId}`);
                    }
                  }}
                  className="border-t border-slate-800 hover:bg-slate-800/60 cursor-pointer"
                >
                  <td className="px-4 py-3 text-slate-100 font-medium">
                    {e.title}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {e.coverage || "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {typeof e.files_count === "number"
                      ? e.files_count
                      : "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {typeof e.related_risks_count === "number"
                      ? e.related_risks_count
                      : "-"}
                  </td>

                  <td className="px-4 py-3">
                    <EvidenceStatusBadge status={e.status} />
                  </td>
                </tr>
              );
            })}
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
