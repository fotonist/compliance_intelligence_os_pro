"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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

export default function MatrixInstancesClient() {
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
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const resolved: MatrixInstance[] = Array.isArray(data)
        ? data
        : (data?.items ?? []);

      setItems(resolved);
    } catch (err: any) {
      setError(err.message || "Failed to load matrix instances");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Matrix Instances</h1>

        <button
          onClick={() => router.back()}
          className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
        >
          ← Back
        </button>
      </div>

      {loading && (
        <div className="text-sm text-slate-400">
          Loading...
        </div>
      )}

      {error && (
        <div className="mb-3 text-sm text-red-400">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-auto rounded border border-slate-800">
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
                <tr
                  key={m.id}
                  className="border-t border-slate-800"
                >
                  <td className="px-3 py-2 font-mono">
                    #{m.id}
                  </td>

                  <td className="px-3 py-2">
                    {m.standard_code ??
                      (m.standard_id ? `#${m.standard_id}` : "-")}
                  </td>

                  <td className="px-3 py-2">
                    {m.standard_version_id ?? "-"}

                    {m.standard_version_status && (
                      <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                        {m.standard_version_status}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white">
                      {m.status}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : "-"}
                  </td>

                  <td className="px-3 py-2">
                    <Link
                      href={`/matrix/instances/${m.id}`}
                      className="inline-block rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
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
