"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

/* ================= TYPES ================= */

interface ControlAssessmentDetail {
  id: number;
  name: string;
  scope: string | null;
  status: string;
  standard: {
    id: number;
    code: string;
  };
  created_at: string;
}

interface ControlItem {
  id: number;
  code: string;
  title?: string | null;
  status?: string | null;
}

/* ================= PAGE ================= */

export default function ControlAssessmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const assessmentId = params.id;

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [assessment, setAssessment] =
    useState<ControlAssessmentDetail | null>(null);

  const [controls, setControls] = useState<ControlItem[]>([]);

  /* ================= AUTH ================= */

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  /* ================= LOAD DETAIL ================= */

  useEffect(() => {
    if (!token || !assessmentId) return;

    async function loadDetail() {
      try {
        const res = await fetch(
          `${API_BASE}/control-assessments/${assessmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Failed to load assessment");

        const data = await res.json();

        setAssessment(data.assessment);
        setControls(data.controls ?? []);
      } catch (err) {
        console.error(err);
        setAssessment(null);
        setControls([]);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [token, assessmentId]);

  if (!token || loading) {
    return <div className="text-slate-400">Loading assessment…</div>;
  }

  if (!assessment) {
    return (
      <div className="text-slate-400">
        Assessment not found.
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="max-w-7xl space-y-8">
      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {assessment.name}
          </h1>
          <div className="mt-1 text-sm text-slate-400">
            {assessment.standard.code} •{" "}
            {assessment.status} •{" "}
            {new Date(assessment.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:text-white"
            onClick={() => router.push("/control-assessments")}
          >
            Back to list
          </button>

          <button
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Complete Assessment
          </button>
        </div>
      </div>

      {/* ===== MAIN GRID ===== */}
      <div className="grid grid-cols-3 gap-6">
        {/* ===== CONTROLS ===== */}
        <section className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100">
              Controls
            </h2>
          </div>

          {controls.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-400">
              No controls found for this assessment.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {controls.map((c) => (
                <li
                  key={c.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/40"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {c.code}
                    </div>
                    {c.title && (
                      <div className="text-xs text-slate-400">
                        {c.title}
                      </div>
                    )}
                  </div>

                  <span className="text-xs text-slate-400">
                    {c.status ?? "Not assessed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ===== SIDE PANEL ===== */}
        <aside className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          {/* Progress placeholder */}
          <div>
            <div className="text-sm font-semibold text-slate-100 mb-2">
              Progress
            </div>
            <div className="w-full h-2 rounded bg-slate-800">
              <div
                className="h-2 rounded bg-indigo-600"
                style={{ width: "0%" }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Progress will be calculated after scoring.
            </div>
          </div>

          {/* Evidence placeholder */}
          <div>
            <div className="text-sm font-semibold text-slate-100 mb-2">
              Evidence
            </div>
            <div className="text-xs text-slate-400">
              Select a control to view and link evidence.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
