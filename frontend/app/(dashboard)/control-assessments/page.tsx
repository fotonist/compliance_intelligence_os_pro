"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = "http://localhost:8000";

interface ControlStandard {
  id: number;
  code: string;
}

interface ControlAssessment {
  id: number;
  name: string;
  scope: string | null;
  standard_id: number;
  status: string;
  created_at: string;
}

export default function ControlAssessmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const controlIdFromMatrix = searchParams.get("control_id");

  const [token, setToken] = useState<string | null>(null);

  /* ---------- CREATE ---------- */
  const [standards, setStandards] = useState<ControlStandard[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [standardId, setStandardId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [creating, setCreating] = useState(false);

  /* ---------- LIST ---------- */
  const [assessments, setAssessments] = useState<ControlAssessment[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const t = localStorage.getItem("access_token");
    setToken(t);
  }, []);

  /* ---------- LOAD STANDARDS ---------- */
  useEffect(() => {
    if (!token) return;

    async function loadStandards() {
      try {
        const res = await fetch(
          `${API_BASE}/standards/?type=CONTROL_BASED`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error();
        setStandards(await res.json());
      } catch {
        setStandards([]);
      } finally {
        setLoadingStandards(false);
      }
    }

    loadStandards();
  }, [token]);

  /* ---------- LOAD ASSESSMENTS ---------- */
  async function loadAssessments() {
    if (!token) return;

    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/control-assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setAssessments(await res.json());
    } catch {
      setAssessments([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadAssessments();
  }, [token]);

  /* ---------- CREATE ---------- */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!standardId || !name.trim() || !token) return;

    setCreating(true);

    try {
      const res = await fetch(`${API_BASE}/control-assessments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          scope,
          standard_id: standardId,
        }),
      });

      if (!res.ok) throw new Error();

      setStandardId("");
      setName("");
      setScope("");

      await loadAssessments();
    } finally {
      setCreating(false);
    }
  }

  if (!token) return null;

  return (
    <div className="max-w-6xl space-y-8">
      {/* CONTEXT FROM MATRIX */}
      {controlIdFromMatrix && (
        <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/20 px-5 py-3 text-sm text-indigo-200">
          You came from the Compliance Matrix for{" "}
          <span className="font-semibold">
            Control ID #{controlIdFromMatrix}
          </span>
          .<br />
          You can create a new assessment or open an existing one below.
        </div>
      )}

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">
          Control Assessments
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">
          Create and manage control-based assessments.
        </p>
      </div>

      {/* INLINE CREATE */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            New Control Assessment
          </h2>
        </div>

        <form onSubmit={handleCreate} className="px-6 py-6 space-y-6">
          <select
            disabled={loadingStandards}
            value={standardId}
            onChange={(e) =>
              setStandardId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2 text-sm"
          >
            <option value="">Select a control standard</option>
            {standards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>

          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2 text-sm"
            placeholder="Assessment name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2 text-sm"
            placeholder="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setStandardId("");
                setName("");
                setScope("");
              }}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Assessment"}
            </button>
          </div>
        </form>
      </section>

      {/* LIST */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            Assessments
          </h2>
        </div>

        {loadingList ? (
          <div className="px-6 py-10 text-sm text-slate-400">
            Loading assessments…
          </div>
        ) : assessments.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-400">
            No control assessments found.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {assessments.map((a) => (
              <li
                key={a.id}
                onClick={() =>
                  router.push(`/control-assessments/${a.id}`)
                }
                className="
                  px-6 py-4 flex items-center justify-between
                  cursor-pointer
                  hover:bg-slate-800/40
                  transition
                "
              >
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {a.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {a.status} •{" "}
                    {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>

                <span className="text-xs text-slate-400">
                  View →
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
