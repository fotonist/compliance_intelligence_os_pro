"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddEvidenceMaturityModal from "../../../../evidences/AddEvidenceMaturityModal";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

/* ================= TYPES ================= */

type Evidence = {
  id: number;
  title: string;
  status: string;
  files_count: number;
};

type PracticeRow = {
  id: number; // practice_evaluation_id
  process_area_id: number;
  process_area_name: string;
  practice_code: string | null;
  practice_title: string;
  evidences: Evidence[];
};

type ProcessAreaGroup = {
  process_area_id: number;
  process_area_name: string;
  practices: PracticeRow[];
};

/* ================= HELPERS ================= */

function parseJwt(token: string): any | null {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* ================= PAGE ================= */

export default function MaturityWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PracticeRow[]>([]);

  const [createFor, setCreateFor] = useState<number | null>(null);

  // delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    evidenceId: number;
    title: string;
  } | null>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    const t =
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    if (!t) {
      router.replace("/login");
      return;
    }

    setToken(t);

    const decoded = parseJwt(t);
    if (decoded?.roles && Array.isArray(decoded.roles)) {
      setIsAdmin(decoded.roles.includes("admin"));
    }
  }, [router]);

  /* ================= LOAD ================= */

  async function load() {
    if (!token || !sessionId) return;

    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/maturity/workspace/${sessionId}/practices`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, sessionId]);

  /* ================= DELETE ================= */

  async function confirmDelete() {
    if (!token || !deleteTarget) return;

    const r = await fetch(
      `${API_BASE}/maturity/evidences/${deleteTarget.evidenceId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setDeleteTarget(null);

    if (!r.ok) {
      alert("Delete failed");
      return;
    }

    load();
  }

  /* ================= GROUP ================= */

  const groups: ProcessAreaGroup[] = useMemo(() => {
    const map = new Map<number, ProcessAreaGroup>();
    for (const r of rows) {
      if (!map.has(r.process_area_id)) {
        map.set(r.process_area_id, {
          process_area_id: r.process_area_id,
          process_area_name: r.process_area_name,
          practices: [],
        });
      }
      map.get(r.process_area_id)!.practices.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  if (loading) {
    return <div className="text-slate-400">Loading workspace…</div>;
  }

  return (
    <div className="max-w-7xl space-y-10">
      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-xl font-semibold text-slate-100">
          Maturity Workspace – Session #{sessionId}
        </h1>
      </section>

      {groups.map((pa) => (
        <section
          key={pa.process_area_id}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
        >
          <h2 className="text-lg font-semibold text-indigo-400 mb-4">
            {pa.process_area_name}
          </h2>

          <div className="space-y-4">
            {pa.practices.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-200">
                    {p.practice_code
                      ? `${p.practice_code} – ${p.practice_title}`
                      : p.practice_title}
                  </div>

                  <button
                    onClick={() => setCreateFor(p.id)}
                    className="text-xs bg-indigo-600 px-2 py-1 rounded"
                  >
                    + Evidence
                  </button>
                </div>

                {(!p.evidences || p.evidences.length === 0) ? (
                  <div className="text-xs text-slate-500 italic">
                    No evidence added for this practice
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {p.evidences.map((e) => (
                      <li
                        key={e.id}
                        className="flex justify-between items-center text-xs bg-slate-800/40 px-2 py-1 rounded"
                      >
                        <span>{e.title}</span>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-slate-700 px-2 rounded">
                            {e.status}
                          </span>
                          <span className="text-[10px] bg-slate-700 px-2 rounded">
                            {e.files_count} file
                          </span>

                          {isAdmin && (
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  evidenceId: e.id,
                                  title: e.title,
                                })
                              }
                              className="
                                text-[10px]
                                px-2
                                py-0.5
                                rounded
                                border
                                border-slate-600
                                text-slate-400
                                hover:text-slate-200
                                hover:border-slate-400
                              "
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {createFor && (
        <AddEvidenceMaturityModal
          practiceEvaluationId={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={load}
        />
      )}

      {/* ================= DELETE CONFIRM MODAL ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">
              Delete Evidence
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              “{deleteTarget.title}” will be permanently deleted.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-200 hover:border-slate-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
