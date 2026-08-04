"use client";

import { useEffect, useState } from "react";
import CheckListQuestion, {
  ChecklistQuestionDTO,
} from "./assessment/CheckListQuestion";
import AssessmentFooter from "./assessment/AssessmentFooter";

const API_BASE = "http://127.0.0.1:8000";

const CHOICE_SCORE_MAP: Record<string, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

type Props = {
  open: boolean;
  risk: any | null;
  onClose: () => void;
};

export default function RiskDetailModal({ open, risk, onClose }: Props) {
  const [questions, setQuestions] = useState<ChecklistQuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // manual override
  const [manualLikelihood, setManualLikelihood] = useState<number | null>(null);
  const [manualImpact, setManualImpact] = useState<number | null>(null);

  const [likelihood, setLikelihood] = useState<number | null>(null);
  const [impact, setImpact] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<string | null>(null);
  const [actionText, setActionText] = useState("");

  if (!open) return null;

  /* =========================
     LOAD CHECKLIST (BACKEND → FALLBACK)
     ========================= */
  useEffect(() => {
    async function loadChecklist() {
      try {
        const res = await fetch(`${API_BASE}/risk-checklists`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          setQuestions(data);
          return;
        }
      } catch {}

      // fallback (build-safe)
      setQuestions([
        {
          id: 1,
          key: "Has this risk occurred before?",
          dimension: "likelihood",
          weight: 1,
          choices: [
            { key: "VERY_LOW", label: "Never" },
            { key: "LOW", label: "Rare" },
            { key: "MEDIUM", label: "Sometimes" },
            { key: "HIGH", label: "Often" },
            { key: "VERY_HIGH", label: "Frequently" },
          ],
        },
        {
          id: 2,
          key: "What is the potential impact?",
          dimension: "impact",
          weight: 1,
          choices: [
            { key: "VERY_LOW", label: "Negligible" },
            { key: "LOW", label: "Minor" },
            { key: "MEDIUM", label: "Moderate" },
            { key: "HIGH", label: "Major" },
            { key: "VERY_HIGH", label: "Severe" },
          ],
        },
      ]);
    }

    loadChecklist();
  }, []);

  /* =========================
     ANSWER HANDLING
     ========================= */
  function handleAnswerChange(questionId: number, choiceKey: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceKey }));
  }

  /* =========================
     CALCULATION (AUTO OR MANUAL)
     ========================= */
  useEffect(() => {
    if (manualLikelihood && manualImpact) {
      setLikelihood(manualLikelihood);
      setImpact(manualImpact);
      return;
    }

    let lSum = 0,
      lWeight = 0;
    let iSum = 0,
      iWeight = 0;

    questions.forEach((q) => {
      const choice = answers[q.id];
      if (!choice) return;

      const score = CHOICE_SCORE_MAP[choice] ?? 0;
      const w = q.weight ?? 1;

      if (q.dimension === "likelihood") {
        lSum += score * w;
        lWeight += w;
      }
      if (q.dimension === "impact") {
        iSum += score * w;
        iWeight += w;
      }
    });

    if (lWeight > 0) setLikelihood(Math.round(lSum / lWeight));
    if (iWeight > 0) setImpact(Math.round(iSum / iWeight));
  }, [answers, manualLikelihood, manualImpact, questions]);

  useEffect(() => {
    if (!likelihood || !impact) return;

    const s = likelihood * impact;
    setScore(s);

    if (s <= 5) {
      setRiskLevel("LOW");
      setTreatment("ACCEPT");
    } else if (s <= 12) {
      setRiskLevel("MEDIUM");
      setTreatment("MITIGATE");
    } else if (s <= 20) {
      setRiskLevel("HIGH");
      setTreatment("MITIGATE / TRANSFER");
    } else {
      setRiskLevel("CRITICAL");
      setTreatment("AVOID / IMMEDIATE ACTION");
    }
  }, [likelihood, impact]);

  /* =========================
     SAVE
     ========================= */
  async function handleSave() {
    const payload = {
      risk_id: risk?.id ?? null,
      likelihood_level: likelihood,
      impact_level: impact,
      score,
      risk_rating: riskLevel,
      explain_json: {
        answers,
        manualOverride: manualLikelihood && manualImpact,
      },
      action_text: actionText,
    };

    const res = await fetch(`${API_BASE}/risk-assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) onClose();
  }

  /* =========================
     UI
     ========================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 rounded-xl w-[900px] max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-white mb-6">
          Risk Assessment
        </h2>

        {/* MANUAL OVERRIDE */}
        <div className="mb-4 p-3 bg-slate-800 rounded">
          <div className="text-sm text-slate-300 mb-2">
            Manual Override (Compliance Officer)
          </div>
          <div className="flex gap-4">
            <input
              type="number"
              min={1}
              max={5}
              placeholder="Likelihood"
              className="px-2 py-1 bg-slate-700 rounded"
              onChange={(e) => setManualLikelihood(Number(e.target.value))}
            />
            <input
              type="number"
              min={1}
              max={5}
              placeholder="Impact"
              className="px-2 py-1 bg-slate-700 rounded"
              onChange={(e) => setManualImpact(Number(e.target.value))}
            />
          </div>
        </div>

        {/* CHECKLIST */}
        <div className="space-y-4 mb-6">
          {questions.map((q) => (
            <CheckListQuestion
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={handleAnswerChange}
            />
          ))}
        </div>

        <AssessmentFooter
          likelihood={likelihood}
          impact={impact}
          score={score}
          riskLevel={riskLevel}
          treatment={treatment}
          actionText={actionText}
          onActionChange={setActionText}
          onSave={handleSave}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
