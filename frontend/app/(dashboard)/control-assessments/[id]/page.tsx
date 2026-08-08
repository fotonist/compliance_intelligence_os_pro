"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

/* ================= TYPES ================= */

interface Assessment {
  id: number;
  name: string;
  status: string;
  created_at: string;
  standard: {
    id: number;
    code: string;
  };
}

interface Control {
  id: number;
  code: string;
  title?: string | null;
}

interface Evidence {
  id: number;
  title: string;
  status: string;
  coverage: string;
}

/* ================= PAGE ================= */

export default function ControlAssessmentDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [controls, setControls] = useState<Control[]>([]);

  // ✅ TEK KAYNAK
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);

  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [availableEvidences, setAvailableEvidences] = useState<Evidence[]>([]);
  const [linkEvidenceId, setLinkEvidenceId] = useState<number | "">("");

  const [progress, setProgress] = useState<number>(0);

  /* ================= AUTH ================= */

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  /* ================= LOAD ASSESSMENT ================= */

  useEffect(() => {
    if (!token) return;

    async function loadDetail() {
      try {
        const res = await fetch(
          `${API_BASE}/control-assessments/${id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await res.json();
        setAssessment(data.assessment);
        setControls(data.controls);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [token, id]);

  /* ================= LOAD EVIDENCES ================= */

  async function loadEvidences(controlId: number) {
    const res = await fetch(
      `${API_BASE}/evidences/by-control/${controlId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await res.json();
    setEvidences(data);

    if (!data || data.length === 0) {
      setProgress(0);
    } else {
      const approved = data.filter(
        (e: any) => e.status === "APPROVED"
      ).length;

      setProgress(
        Math.round((approved / data.length) * 100)
      );
    }
  }

  async function loadAvailableEvidences() {
    const res = await fetch(
      `${API_BASE}/evidences?page=1&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await res.json();

    setAvailableEvidences(
      (data.items ?? []).map((i: any) => ({
        id: i.evidence_id,
        title: i.evidence_title,
        status: i.status,
        coverage: i.coverage,
      }))
    );
  }

  /* ================= ACTIONS ================= */

  async function unlinkEvidence(evidenceId: number) {
    if (!selectedControlId) return;

    await fetch(
      `${API_BASE}/evidences/unlink-from-control/${selectedControlId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ evidence_id: evidenceId }),
      }
    );

    loadEvidences(selectedControlId);
  }

  async function linkEvidence() {
    if (!selectedControlId || !linkEvidenceId) return;

    await fetch(
      `${API_BASE}/evidences/link-to-control/${selectedControlId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ evidence_id: linkEvidenceId }),
      }
    );

    setLinkEvidenceId("");
    loadEvidences(selectedControlId);
  }

  if (loading || !assessment) {
    return <div className="text-slate-400">Loading assessment…</div>;
  }

  /* ================= UI ================= */

  return (
    <div className="max-w-7xl space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {assessment.name}
          </h1>
          <div className="text-sm text-slate-400">
            {assessment.standard.code} • {assessment.status}
          </div>
        </div>

        <button
          onClick={() => router.push("/control-assessments")}
          className="px-4 py-2 text-sm border border-slate-700 rounded-lg text-slate-300 hover:text-white"
        >
          Back
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-3 gap-6">
        {/* CONTROLS */}
        <section className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100">
              Controls
            </h2>
          </div>

          <ul className="divide-y divide-slate-800">
            {controls.map((c) => (
              <li
                key={c.id}
                onClick={() => {
                  setSelectedControlId(c.id);
                  loadEvidences(c.id);
                  loadAvailableEvidences();
                }}
                className={`px-6 py-4 cursor-pointer hover:bg-slate-800/40 ${
                  selectedControlId === c.id
                    ? "bg-slate-800/40"
                    : ""
                }`}
              >
                <div className="text-sm font-medium text-slate-100">
                  {c.code}
                </div>
                {c.title && (
                  <div className="text-xs text-slate-400">
                    {c.title}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* EVIDENCE PANEL */}
        <aside className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          {selectedControlId === null ? (
            <div className="text-sm text-slate-400">
              Select a control to manage evidence.
            </div>
          ) : (
            <>
              {/* PROGRESS */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-indigo-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* LINKED EVIDENCE */}
              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">
                  Linked Evidence
                </h3>

                {evidences.length === 0 ? (
                  <div className="text-xs text-slate-400">
                    No evidence linked.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {evidences.map((e) => (
                      <li
                        key={e.id}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-slate-200">
                          {e.title}
                        </span>
                        <button
                          onClick={() => unlinkEvidence(e.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Unlink
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* LINK EVIDENCE */}
              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">
                  Link Evidence
                </h3>

                <select
                  value={linkEvidenceId}
                  onChange={(e) =>
                    setLinkEvidenceId(
                      e.target.value
                        ? Number(e.target.value)
                        : ""
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select evidence</option>
                  {availableEvidences.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>

                <button
                  onClick={linkEvidence}
                  className="mt-3 w-full px-3 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Link Evidence
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
