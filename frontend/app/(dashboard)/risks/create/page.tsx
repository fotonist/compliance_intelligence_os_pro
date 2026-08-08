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

/** Choice key → numeric score */
const CHOICE_SCORE_MAP: Record<string, number> = {
  // Likelihood
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  almost_certain: 5,
  // Impact
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

  /* ================= BASIC ================= */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  /* ================= SOURCE ================= */
  const [sourceType, setSourceType] = useState<SourceType | "">("");
  const [sourceId, setSourceId] = useState<number | "">("");
  const [processId, setProcessId] = useState<number | "">("");
  const [processes, setProcesses] = useState<any[]>([]);

  /* ================= ASSESSMENT ================= */
  const [questions, setQuestions] = useState<ChecklistQuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [bootLoading, setBootLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function token() {
    return localStorage.getItem("access_token") || "";
  }

  /* ================= LOAD QUESTIONS ================= */
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


/* ================= LOAD PROCESSES ================= */
useEffect(() => {
  (async () => {
    try {
      const res = await fetch(
        `${API_BASE}/company/processes`,
        {
          headers: token()
            ? {
                Authorization: `Bearer ${token()}`,
              }
            : undefined,
          credentials: "include",
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      setProcesses(
        Array.isArray(data)
          ? data
          : data.items || []
      );
    } catch {
      setProcesses([]);
    }
  })();
}, []);
  /* ================= SCORE CALC ================= */
  function dimensionScore(dim: Dimension): number | null {
    const group = questions.filter((q) => q.dimension === dim);
    if (group.length === 0) return null;

    const scores = group
      .map((q) => answers[q.id])
      .filter(Boolean)
      .map((k) => CHOICE_SCORE_MAP[k!])
      .filter((n) => typeof n === "number");

    if (scores.length !== group.length) return null;
    return Math.max(...scores); // ISO worst-case
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

  /* ================= CREATE ================= */
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

      // ✅ FINAL DAVRANIŞ: CREATE → RISK LIST
      router.push("/risks");
    } catch (e: any) {
      setError(e?.message || "Create risk failed");
    } finally {
      setSaving(false);
    }
  }

  if (bootLoading) {
    return <div className="p-6 text-slate-300">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-white">
      <h1 className="text-xl font-semibold">Create New Risk</h1>

      {error && (
        <div className="text-red-400 bg-red-950/40 border border-red-700 rounded p-2">
          {error}
        </div>
      )}

      {/* SOURCE */}
      <div className="grid grid-cols-3 gap-3">
        <select
          value={sourceType}
          onChange={(e) => {
            setSourceType(e.target.value as SourceType);
            setSourceId("");
          }}
          className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
        >
          <option value="">Select source type…</option>
          <option value="STANDARD">Standard</option>
          <option value="REQUIREMENT">Requirement</option>
          <option value="CONTROL">Control</option>
        </select>

        <input
          type="number"
          placeholder="Source ID"
          value={sourceId}
          disabled={!sourceType}
          onChange={(e) => setSourceId(Number(e.target.value) || "")}
          className="px-3 py-2 rounded bg-slate-900 border border-slate-700 disabled:opacity-50"
        />
<select
  value={processId}
  onChange={(e) =>
  setProcessId(
    e.target.value
      ? Number(e.target.value)
      : ""
  )
}
  className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
>
  <option value="">
    Select process…
  </option>

  {processes.map((p) => (
    <option
      key={p.id}
      value={p.id}
    >
      {p.name}
    </option>
  ))}
</select>
      </div>

      {/* BASIC */}
      <input
        placeholder="Risk title"
        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        rows={3}
        placeholder="Description"
        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {/* CHECKLIST */}
      <div className="border border-slate-800 rounded-md bg-slate-950 p-4 space-y-6">
        <h2 className="text-sm font-semibold">Risk Assessment</h2>

        {(["likelihood", "impact"] as Dimension[]).map((dim) => {
          const group = questions.filter((q) => q.dimension === dim);
          if (group.length === 0) return null;

          return (
            <div key={dim} className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">
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
          <div className="text-xs text-slate-400">
            Please answer all Likelihood and Impact questions to continue.
          </div>
        )}

        <AssessmentFooter
          canComplete={canComplete}
          saving={saving}
          onComplete={handleCreate}
          onClose={() => router.push("/risks")}
        />
      </div>

      {/* RESULT */}
      <div className="flex justify-between text-sm border border-slate-800 rounded bg-slate-950 p-3">
        <div>
          Score: <strong>{score ?? "-"}</strong>
        </div>
        <div>
          Level: <strong>{level}</strong>
        </div>
      </div>
    </div>
  );
}
