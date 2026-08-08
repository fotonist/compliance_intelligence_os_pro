"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddEvidenceMaturityModal from "../../evidences/AddEvidenceMaturityModal";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

/* ================= TYPES ================= */

type Evidence = {
  id: number;
  title: string;
  status: string;
  files_count: number;
};

type PracticeRow = {
  id: number;
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
    return JSON.parse(atob(token.split(".")[1]));
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
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const [openAreas, setOpenAreas] = useState<Record<number, boolean>>({});

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
    if (decoded?.roles?.includes("admin")) {
      setIsAdmin(true);
    }
  }, [router]);

  /* ================= LOAD ================= */

  async function load() {
    if (!token || !sessionId) return;

    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/maturity/workspace/${sessionId}/practices`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) throw new Error();

      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, sessionId]);

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

  // init toggle (only for visible areas)
  useEffect(() => {
    const init: Record<number, boolean> = {};
    groups.forEach((g) => {
      if (g.practices.length > 0) init[g.process_area_id] = true;
    });
    setOpenAreas(init);
  }, [groups]);

  if (loading) {
    return <div className="text-slate-400">Loading workspace…</div>;
  }

  return (
    <div className="max-w-7xl space-y-8">
      {groups
        .filter((pa) => pa.practices.length > 0) // 🔥 tekrarları keser
        .map((pa) => (
          <div
            key={pa.process_area_id}
            className="rounded-xl border border-slate-800 bg-slate-900/60"
          >
            {/* TOGGLE HEADER */}
            <button
              type="button"
              onClick={() =>
                setOpenAreas((p) => ({
                  ...p,
                  [pa.process_area_id]: !p[pa.process_area_id],
                }))
              }
              className="w-full flex justify-between items-center px-6 py-4 text-left"
            >
              <span className="text-lg font-semibold text-indigo-400">
                {pa.process_area_name}
              </span>
              <span className="text-slate-400">
                {openAreas[pa.process_area_id] ? "−" : "+"}
              </span>
            </button>

            {openAreas[pa.process_area_id] && (
              <div className="px-6 pb-6 space-y-4">
                {pa.practices.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-200">
                        {p.practice_code
                          ? `${p.practice_code} – ${p.practice_title}`
                          : p.practice_title}
                      </div>

                      <button
                        onClick={() => setCreateFor(p.id)}
                        className="text-xs border border-slate-600 px-2 py-1 rounded text-slate-300"
                      >
                        + Evidence
                      </button>
                    </div>

                    {p.evidences.length === 0 ? (
                      <div className="text-xs text-slate-500 italic">
                        No evidence added
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {p.evidences.map((e) => (
                          <li
                            key={e.id}
                            className="flex justify-between items-center text-xs bg-slate-800/40 px-2 py-1 rounded"
                          >
                            <span>{e.title}</span>
                            <div className="flex gap-2">
                              <span className="text-[10px] bg-slate-700 px-2 rounded">
                                {e.status}
                              </span>
                              <span className="text-[10px] bg-slate-700 px-2 rounded">
                                {e.files_count} file
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

      {createFor && (
        <AddEvidenceMaturityModal
          practiceEvaluationId={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
