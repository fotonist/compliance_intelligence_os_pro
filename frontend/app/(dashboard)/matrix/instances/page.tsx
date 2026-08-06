"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

type MatrixInstance = {
  id: number;
  standard_id?: number;
  standard_code?: string;
  standard_version_id?: number;
  standard_version_status?: string;
  status: string;
  created_by?: number | null;
  created_at: string;
};

function MatrixInstancesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const standardId = params.get("standard_id");

  const [token, setToken] = useState("");
  const [items, setItems] = useState<MatrixInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, standardId]);

  async function loadInstances() {
    setLoading(true);
    setError(null);

    try {
      const url = standardId
        ? `${API_BASE}/matrix/instances?standard_id=${standardId}`
        : `${API_BASE}/matrix/instances`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // backend bazen [..] döner, bazen {items:[..]}
      const resolved: MatrixInstance[] = Array.isArray(data)
        ? data
        : (data?.items ?? []);

      setItems(resolved);
    } catch (e: any) {
      setError(e.message || "Failed to load matrix instances");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Matrix Instances</h1>

        <button
          onClick={() => router.back()}
          className="text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
        >
          ← Back
        </button>
      </div>

      {/* STATUS */}
      {loading && <div className="text-sm text-slate-400">Loading…</div>}
      {error && <div className="text-sm text-red-400 mb-3">Error: {error}</div>}

      {/* TABLE */}
      {!loading && !error && (
        <div className="overflow-auto border border-slate-800 rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Standard</th>
                <th className="px-3 py-2 text-left">Version</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created At</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono">#{m.id}</td>

                  <td className="px-3 py-2">
                    {m.standard_code ?? (m.standard_id ? `#${m.standard_id}` : "-")}
                  </td>

                  <td className="px-3 py-2">
                    {m.standard_version_id ?? "-"}
                    {m.standard_version_status ? (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                        {m.standard_version_status}
                      </span>
                    ) : null}
                  </td>

                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-700 text-white">
                      {m.status}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    {m.created_at ? new Date(m.created_at).toLocaleString() : "-"}
                  </td>

                  <td className="px-3 py-2">
                    <Link
                      href={`/matrix/instances/${m.id}`}
                      className="text-xs px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 inline-block"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No matrix instances found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default function MatrixInstancesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <MatrixInstancesContent />
    </Suspense>
  );
}
