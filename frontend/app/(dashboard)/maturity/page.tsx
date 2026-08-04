"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

interface MaturitySession {
  id: number;
  name: string;
  scope?: string;
  status: string;
  created_at?: string;
}

interface MaturityStandard {
  id: number;
  code: string;
  title?: string;
}

export default function MaturityPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [sessions, setSessions] = useState<MaturitySession[]>([]);
  const [standards, setStandards] = useState<MaturityStandard[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);

  const [standardId, setStandardId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");

  /* ---------------- AUTH ---------------- */

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  /* ---------------- LOAD STANDARDS ---------------- */

  useEffect(() => {
    if (!token) return;

    async function loadStandards() {
      try {
        const res = await fetch(
          `${API_BASE}/standards?type=MATURITY_BASED`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error();
        setStandards(await res.json());
      } catch {
        setStandards([]);
      } finally {
        setLoading(false);
      }
    }

    loadStandards();
  }, [token]);

  /* ---------------- LOAD SESSIONS ---------------- */

  async function loadSessions() {
    if (!token) return;

    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/maturity/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setSessions(await res.json());
    } catch {
      setSessions([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, [token]);

  /* ---------------- CREATE SESSION ---------------- */

  async function createSession() {
    if (!token || !name.trim() || !standardId) return;

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/maturity/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          standard_id: standardId,
          name,
          scope,
        }),
      });

      if (!res.ok) return;

      setName("");
      setScope("");
      setStandardId("");

      await loadSessions();
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="text-slate-400 text-sm">
        Loading maturity standards…
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          Maturity Assessments
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Create and manage capability-based maturity assessments.
        </p>
      </div>

      {/* CREATE */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            New Maturity Assessment
          </h2>
        </div>

        <div className="px-6 py-5 space-y-6">
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2 text-sm"
            value={standardId}
            onChange={(e) =>
              setStandardId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Select a maturity standard</option>
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
        </div>

        <div className="border-t border-slate-800 px-6 py-4 flex justify-end gap-3">
          <button
            className="text-sm text-slate-300"
            onClick={() => {
              setName("");
              setScope("");
              setStandardId("");
            }}
          >
            Cancel
          </button>

          <button
            onClick={createSession}
            disabled={creating || !name.trim() || !standardId}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Assessment"}
          </button>
        </div>
      </section>

      {/* LIST */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            Assessments
          </h2>
        </div>

        {loadingList ? (
          <div className="px-6 py-8 text-sm text-slate-400">
            Loading assessments…
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-400">
            No maturity assessments have been created yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {sessions.map((s) => (
              <li
                key={s.id}
                onClick={() => router.push(`/maturity/${s.id}`)}
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition"
              >
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {s.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {s.status}
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
