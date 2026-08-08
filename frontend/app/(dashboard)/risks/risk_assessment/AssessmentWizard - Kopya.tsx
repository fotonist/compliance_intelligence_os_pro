"use client";

import { useEffect, useState } from "react";

type Question = {
  id: number;
  code: string;
  category: "likelihood" | "impact";
  text: string;
  weight: number;
};

type AnswerValue = "yes" | "no" | "partial" | "na";

type Answer = {
  question_id: number;
  answer: AnswerValue;
};

type EvaluationResult = {
  likelihood: number;
  impact: number;
  risk_level: string;
};

type Session = {
  id: string;
  status: "draft" | "completed";
  calculated_likelihood?: number;
  calculated_impact?: number;
  calculated_risk_level?: string;
};

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

export default function AssessmentWizard() {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // -------------------------
  // INIT: create session + load questions
  // -------------------------
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        // 1️⃣ Create session
        const sessionRes = await fetch(`${API_BASE}/risk-assessments/sessions`, {
          method: "POST",
          credentials: "include",
        });
        if (!sessionRes.ok) throw new Error("Failed to create assessment session");
        const sessionData: Session = await sessionRes.json();
        setSession(sessionData);

        // 2️⃣ Load questions
        const qRes = await fetch(`${API_BASE}/risk-assessments/questions`, {
          credentials: "include",
        });
        if (!qRes.ok) throw new Error("Failed to load assessment questions");
        const qData: Question[] = await qRes.json();
        setQuestions(qData);
      } catch (e: any) {
        setError(e.message ?? "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // -------------------------
  // ANSWER HANDLING
  // -------------------------
  const setAnswer = (questionId: number, value: AnswerValue) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const allAnswered = questions.length > 0 &&
    questions.every((q) => answers[q.id]);

  // -------------------------
  // SAVE ANSWERS
  // -------------------------
  const saveAnswers = async () => {
    if (!session) return;

    const payload: Answer[] = Object.entries(answers).map(
      ([question_id, answer]) => ({
        question_id: Number(question_id),
        answer,
      })
    );

    const res = await fetch(
      `${API_BASE}/risk-assessments/sessions/${session.id}/answers`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      throw new Error("Failed to save answers");
    }

    const updatedSession: Session = await res.json();
    setSession(updatedSession);
  };

  // -------------------------
  // EVALUATE
  // -------------------------
  const evaluate = async () => {
    if (!session) return;

    await saveAnswers();

    const res = await fetch(
      `${API_BASE}/risk-assessments/sessions/${session.id}/evaluate`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!res.ok) {
      throw new Error("Evaluation failed");
    }

    const data: EvaluationResult = await res.json();
    setEvaluation(data);
  };

  // -------------------------
  // COMPLETE
  // -------------------------
  const complete = async () => {
    if (!session) return;

    const res = await fetch(
      `${API_BASE}/risk-assessments/sessions/${session.id}/complete`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!res.ok) {
      throw new Error("Failed to complete assessment");
    }

    const completedSession: Session = await res.json();
    setSession(completedSession);

    // ⛔️ Şimdilik sadece logluyoruz
    // Sonraki adımda Risk Create'e bağlanacak
    console.log("Assessment completed:", {
      session: completedSession,
      evaluation,
    });
  };

  // -------------------------
  // RENDER
  // -------------------------
  if (loading) return <div>Loading risk assessment…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!session) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2>Risk Assessment Checklist</h2>

      {questions.map((q) => (
        <div
          key={q.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 12,
            borderRadius: 6,
          }}
        >
          <div style={{ fontWeight: 600 }}>{q.text}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            {(["yes", "partial", "no", "na"] as AnswerValue[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(q.id, opt)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border:
                    answers[q.id] === opt
                      ? "2px solid #2563eb"
                      : "1px solid #ccc",
                  background:
                    answers[q.id] === opt ? "#eff6ff" : "#fff",
                }}
              >
                {opt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* ACTIONS */}
      <div style={{ marginTop: 24 }}>
        <button
          disabled={!allAnswered}
          onClick={evaluate}
          style={{
            padding: "10px 16px",
            marginRight: 12,
            backgroundColor: allAnswered ? "#2563eb" : "#9ca3af",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: allAnswered ? "pointer" : "not-allowed",
          }}
        >
          Evaluate
        </button>

        <button
          disabled={!evaluation}
          onClick={complete}
          style={{
            padding: "10px 16px",
            backgroundColor: evaluation ? "#16a34a" : "#9ca3af",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: evaluation ? "pointer" : "not-allowed",
          }}
        >
          Complete
        </button>
      </div>

      {/* SUMMARY */}
      {evaluation && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #16a34a",
            borderRadius: 6,
            background: "#f0fdf4",
          }}
        >
          <h3>Assessment Result</h3>
          <p>Likelihood: <strong>{evaluation.likelihood}</strong></p>
          <p>Impact: <strong>{evaluation.impact}</strong></p>
          <p>Risk Level: <strong>{evaluation.risk_level}</strong></p>
        </div>
      )}
    </div>
  );
}
