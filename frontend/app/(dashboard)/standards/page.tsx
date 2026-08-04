"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
  version?: string | null;
  status?: "draft" | "published" | "archived";
};

export default function StandardsPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [items, setItems] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===== Pagination ===== */
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // create modal state
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"CONTROL_BASED" | "MATURITY_BASED">(
    "CONTROL_BASED"
  );
  const [version, setVersion] = useState("");

  useEffect(() => {
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  async function loadStandards() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/standards/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setPage(1); // reset page
    } catch (e: any) {
      setError(e.message || "Failed to load standards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStandards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createStandard() {
    if (!code.trim()) {
      alert("Code is required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/standards/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          title,
          type,
          version,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      setOpen(false);
      setCode("");
      setTitle("");
      setVersion("");
      setType("CONTROL_BASED");
      loadStandards();
    } catch (e: any) {
      alert(e.message || "Create failed");
    }
  }

  /* ===== Pagination derived ===== */

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / pageSize)
  );

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page]);

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Standards</h1>
        <button
          onClick={() => setOpen(true)}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded"
        >
          New Standard
        </button>
      </div>

      {loading && <div className="text-sm text-slate-400">Loading…</div>}
      {error && (
        <div className="text-sm text-red-400 mb-3">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="overflow-auto border border-slate-800 rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Version</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((s) => {
                  const isDraft = s.status === "draft";

                  return (
                    <tr
                      key={s.id}
                      className="border-t border-slate-800"
                    >
                      <td className="px-3 py-2">{s.code}</td>
                      <td className="px-3 py-2">
                        {s.title || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {s.type || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span>{s.version || "-"}</span>
                          {s.status && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                s.status === "draft"
                                  ? "bg-emerald-700 text-white"
                                  : "bg-slate-700 text-slate-200"
                              }`}
                            >
                              {s.status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 flex gap-2">
                        <button
                          onClick={() =>
                            router.push(
                              `/standards/${s.id}/structure`
                            )
                          }
                          className="text-xs px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
                        >
                          Structure →
                        </button>

                        <button
                          disabled={!isDraft}
                          onClick={() =>
                            router.push(
                              `/matrix/builder?standard_id=${s.id}`
                            )
                          }
                          className={`text-xs px-3 py-1 rounded text-white ${
                            isDraft
                              ? "bg-emerald-800 hover:bg-emerald-700"
                              : "bg-slate-700 cursor-not-allowed"
                          }`}
                        >
                          Build Matrix →
                        </button>

                        <button
                          onClick={() =>
                            router.push(
                              `/matrix/instances?standard_id=${s.id}`
                            )
                          }
                          className="text-xs px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
                        >
                          View Matrices →
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {pagedItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      No standards found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between text-sm text-slate-300 mt-3">
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
        </>
      )}

      {/* CREATE MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md p-5">
            <h2 className="text-md font-semibold mb-4">
              Create New Standard
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">
                  Code *
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as any)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                >
                  <option value="CONTROL_BASED">
                    CONTROL_BASED
                  </option>
                  <option value="MATURITY_BASED">
                    MATURITY_BASED
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">
                  Version
                </label>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={createStandard}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
