"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ChecklistQuestion from "@/app/components/assessment/ChecklistQuestion";
import AssessmentFooter from "@/app/components/assessment/AssessmentFooter";

type Dimension = "likelihood" | "impact";
type SourceType = "STANDARD" | "REQUIREMENT" | "CONTROL";

type ChecklistQuestionDTO = {
  id: number;
  title: string;
  description?: string | null;
  dimension: Dimension;
  choices: { key: string; label: string }[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

const CHOICE_SCORE_MAP: Record<string, number> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  almost_certain: 5,
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  catastrophic: 5,
};

function calcLevel(score: number) {
  if (score >= 15) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

export default function CreateRiskPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [sourceType, setSourceType] = useState<SourceType | "">("");
  const [sourceId, setSourceId] = useState<number | "">("");
  const [processId, setProcessId] = useState<number | "">("");
  const [processes, setProcesses] = useState<any[]>([]);

  const [questions, setQuestions] = useState<ChecklistQuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [bootLoading, setBootLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function token() {
    return localStorage.getItem("access_token") || "";
  }

  useEffect(() => {
    (async () => {
      try {
        setBootLoading(true);
        const res = await fetch(`${API_BASE}/risk-assessment/questions`, {
          headers: token()
            ? { Authorization: `Bearer ${token()}` }
            : undefined,
          credentials: "include",
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to load assessment questions");
        }
        const data = await res.json();
        setQuestions(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || "Initialization failed");
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/company/processes`, {
          headers: token()
            ? { Authorization: `Bearer ${token()}` }
            : undefined,
          credentials: "include",
        });

        if (!res.ok) return;

        const data = await res.json();
        setProcesses(Array.isArray(data) ? data : data.items || []);
      } catch {
        setProcesses([]);
      }
    })();
  }, []);

  function dimensionScore(dim: Dimension): number | null {
    const group = questions.filter((q) => q.dimension === dim);
    if (group.length === 0) return null;

    const scores = group
      .map((q) => answers[q.id])
      .filter(Boolean)
      .map((k) => CHOICE_SCORE_MAP[k!])
      .filter((n) => typeof n === "number");

    if (scores.length !== group.length) return null;
    return Math.max(...scores);
  }

  const likelihood = useMemo(
    () => dimensionScore("likelihood"),
    [answers, questions]
  );

  const impact = useMemo(
    () => dimensionScore("impact"),
    [answers, questions]
  );

  const score = useMemo(() => {
    if (typeof likelihood !== "number" || typeof impact !== "number") return null;
    return likelihood * impact;
  }, [likelihood, impact]);

  const level = useMemo(
    () => (typeof score === "number" ? calcLevel(score) : "-"),
    [score]
  );

  const canComplete =
    title.trim().length > 0 &&
    sourceType !== "" &&
    sourceId !== "" &&
    processId !== "" &&
    typeof likelihood === "number" &&
    typeof impact === "number";

  async function handleCreate() {
    if (!canComplete || saving) return;

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`${API_BASE}/risks/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          likelihood,
          impact,
          process_id: Number(processId),
          source_type: sourceType,
          source_id: Number(sourceId),
          action: "assessment",
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Create risk failed");
      }

      router.push("/risks");
    } catch (e: any) {
      setError(e?.message || "Create risk failed");
    } finally {
      setSaving(false);
    }
  }

  if (bootLoading) {
    return <div className="p-6 text-slate-600">Loading…</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-6 md:p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create New Risk
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Register and assess a risk against a standard, requirement or control.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Risk Context</h2>
            <p className="text-sm text-slate-500 mt-1">
              Define where the risk originates and which business process it affects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Source Type</label>
              <select
                value={sourceType}
                onChange={(e) => {
                  setSourceType(e.target.value as SourceType);
                  setSourceId("");
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              >
                <option value="">Select source type…</option>
                <option value="STANDARD">Standard</option>
                <option value="REQUIREMENT">Requirement</option>
                <option value="CONTROL">Control</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Source ID</label>
              <input
                type="number"
                placeholder="Enter source ID"
                value={sourceId}
                disabled={!sourceType}
                onChange={(e) => setSourceId(Number(e.target.value) || "")}
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Process</label>
              <select
                value={processId}
                onChange={(e) =>
                  setProcessId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              >
                <option value="">Select process…</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Risk Definition</h2>
            <p className="text-sm text-slate-500 mt-1">
              Describe the risk clearly enough for assessment, treatment and audit traceability.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Risk Title</label>
            <input
              placeholder="Enter risk title"
              className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              rows={4}
              placeholder="Describe the risk, its cause and potential consequence"
              className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">Risk Assessment</h2>
            <p className="text-sm text-slate-500 mt-1">
              Assess likelihood and impact using the approved assessment questions.
            </p>
          </div>

          <div className="rounded-xl bg-slate-950 p-4 md:p-5 space-y-6">
            {(["likelihood", "impact"] as Dimension[]).map((dim) => {
              const group = questions.filter((q) => q.dimension === dim);
              if (group.length === 0) return null;

              return (
                <div key={dim} className="space-y-3">
                  <div className="text-xs uppercase tracking-wide font-semibold text-slate-400">
                    {dim}
                  </div>

                  {group.map((q) => (
                    <ChecklistQuestion
                      key={q.id}
                      question={q}
                      value={answers[q.id]}
                      onChange={(qid, choiceKey) =>
                        setAnswers((prev) => ({ ...prev, [qid]: choiceKey }))
                      }
                    />
                  ))}
                </div>
              );
            })}

            {!canComplete && (
              <div className="text-xs text-slate-400 border-t border-slate-800 pt-3">
                Complete the risk context, title and all Likelihood and Impact questions to continue.
              </div>
            )}

            <AssessmentFooter
              canComplete={canComplete}
              saving={saving}
              onComplete={handleCreate}
              onClose={() => router.push("/risks")}
            />
          </div>
        </section>

        <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <div className="text-sm text-slate-500">Calculated Risk Score</div>
            <div className="text-2xl font-semibold text-slate-900">{score ?? "-"}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Risk Level</div>
            <div className="text-lg font-semibold text-slate-900">{level}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
