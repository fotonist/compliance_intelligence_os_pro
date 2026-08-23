"use client";

import { useMemo, useState } from "react";

// ✅ DOĞRU PATH
import ChecklistQuestion from "@/app/components/assessment/ChecklistQuestion";
import AssessmentFooter from "@/app/components/assessment/AssessmentFooter";

/* ================= TYPES ================= */

type Dimension = "likelihood" | "impact";

type ChecklistQuestionDTO = {
  id: number;
  title: string;
  description?: string | null;
  dimension: Dimension;
  choices: {
    key: string;
    label: string;
  }[];
};

type Props = {
  riskId: number;
  questions: ChecklistQuestionDTO[];
  onClose: () => void;
  onCompleted?: () => void;
};

/* ================= SCORE MAP ================= */

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

const API_BASE = "http://127.0.0.1:8000";

/* ================= COMPONENT ================= */

export default function RiskAssessmentWizardModal({
  riskId,
  questions,
  onClose,
  onCompleted,
}: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= SCORE CALC ================= */

  function calculateDimensionScore(
    dimension: Dimension
  ): number | null {
    const related = questions.filter(
      (q) => q.dimension === dimension
    );

    if (related.length === 0) return null;

    const scores = related
      .map((q) => answers[q.id])
      .filter(Boolean)
      .map((choiceKey) => CHOICE_SCORE_MAP[choiceKey!])
      .filter((n) => typeof n === "number");

    if (scores.length !== related.length) return null;

    // ISO yaklaşımı: worst-case
    return Math.max(...scores);
  }

  const likelihood = useMemo(
    () => calculateDimensionScore("likelihood"),
    [answers, questions]
  );

  const impact = useMemo(
    () => calculateDimensionScore("impact"),
    [answers, questions]
  );

  const isComplete =
    typeof likelihood === "number" &&
    typeof impact === "number";

  /* ================= ACTION ================= */

  async function handleComplete() {
    if (!isComplete) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/risks/${riskId}/assess`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            likelihood,
            impact,
            action: "assessment",
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Assessment failed");
      }

      onCompleted?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Assessment failed");
    } finally {
      setSaving(false);
    }
  }

  /* ================= RENDER ================= */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-lg font-semibold text-white">
            Risk Assessment
          </div>
          <div className="text-xs text-slate-400">
            Checklist-based scoring (ISO compliant)
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {questions.map((q) => (
            <ChecklistQuestion
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(qid, choiceKey) =>
                setAnswers((prev) => ({
                  ...prev,
                  [qid]: choiceKey,
                }))
              }
            />
          ))}
        </div>

        {/* FOOTER */}
       <AssessmentFooter
  saving={saving}
  canComplete={isComplete}
  onClose={onClose}
  onComplete={handleComplete}
  errorText={error}
  statusText={
    isComplete
      ? `Likelihood ${likelihood} • Impact ${impact}`
      : "Complete all Likelihood and Impact questions"
  }
/>
      </div>
    </div>
  );
}

