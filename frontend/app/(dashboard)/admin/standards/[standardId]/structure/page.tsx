"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = "http://localhost:8000";

/* ================= TYPES ================= */

type Clause = {
  id: number;
  code: string;
  title?: string;
};

type ProcessArea = {
  id: number;
  code: string;
  title?: string;
};

type StructureResponse = {
  standard_id: number;
  standard_code: string;
  type: "CONTROL_BASED" | "MATURITY_BASED";
  version: string;
  status: "draft" | "published" | "archived";
  clauses?: Clause[];
  process_areas?: ProcessArea[];
};

/* ================= PAGE ================= */

export default function StructurePage() {
  const params = useParams();
  const standardId = params.standardId as string;

  const [token, setToken] = useState("");
  const [data, setData] = useState<StructureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = data?.status === "draft";

  /* ================= TOKEN ================= */

  useEffect(() => {
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  /* ================= LOAD STRUCTURE ================= */

  useEffect(() => {
    if (!token || !standardId) return;

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/standards/${standardId}/structure`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, standardId]);

  /* ================= ACTIONS ================= */

  async function addClause() {
    if (!isDraft) return;

    const code = prompt("Clause code?");
    if (!code) return;

    await fetch(`${API_BASE}/standards/${standardId}/clauses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });

    location.reload();
  }

  async function addProcessArea() {
    if (!isDraft) return;

    const code = prompt("Process Area code?");
    if (!code) return;

    await fetch(`${API_BASE}/standards/${standardId}/process-areas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });

    location.reload();
  }

  /* ================= RENDER ================= */

  if (loading) return <div className="p-6 text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-6 space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-lg font-semibold">
          {data.standard_code} · Structure
        </h1>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>v{data.version}</span>
          <span
            className={`px-2 py-0.5 rounded ${
              isDraft
                ? "bg-emerald-700 text-white"
                : "bg-slate-700 text-slate-200"
            }`}
          >
            {isDraft ? "Draft (editable)" : "Published (read-only)"}
          </span>
        </div>
      </div>

      {!isDraft && (
        <div className="text-xs text-amber-400">
          This version is published. Editing is disabled.
        </div>
      )}

      {/* CONTROL BASED */}
      {data.type === "CONTROL_BASED" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Clauses</h2>
            <button
              disabled={!isDraft}
              onClick={addClause}
              className={`text-xs px-3 py-1 rounded ${
                isDraft
                  ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                  : "bg-slate-700 cursor-not-allowed"
              }`}
            >
              + Add Clause
            </button>
          </div>

          <ul className="space-y-1 text-sm">
            {data.clauses?.map((c) => (
              <li
                key={c.id}
                className="border border-slate-800 rounded px-3 py-2"
              >
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded mr-2">
                  {c.code}
                </span>
                {c.title || ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MATURITY BASED */}
      {data.type === "MATURITY_BASED" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Process Areas</h2>
            <button
              disabled={!isDraft}
              onClick={addProcessArea}
              className={`text-xs px-3 py-1 rounded ${
                isDraft
                  ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                  : "bg-slate-700 cursor-not-allowed"
              }`}
            >
              + Add Process Area
            </button>
          </div>

          <ul className="space-y-1 text-sm">
            {data.process_areas?.map((pa) => (
              <li
                key={pa.id}
                className="border border-slate-800 rounded px-3 py-2"
              >
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded mr-2">
                  {pa.code}
                </span>
                {pa.title || ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
