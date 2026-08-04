'use client';

import { useEffect, useState } from 'react';

interface Question {
  id: string;
  code: string;
  text: string;
  category: 'likelihood' | 'impact';
  weight: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export default function RiskAssessmentWizardModal({
  open,
  onClose,
  onCompleted,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;

  // -----------------------------
  // INIT: session + questions
  // -----------------------------
  useEffect(() => {
    if (!open) return;

    const init = async () => {
      setLoading(true);
      setError(null);
      setQuestions([]);
      setAnswers({});

      try {
        if (!token) {
          throw new Error('No access token found');
        }

        // 1️⃣ Create session
        const sRes = await fetch(
          'http://127.0.0.1:8000/risk-assessments/sessions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!sRes.ok) {
          const text = await sRes.text();
          throw new Error(
            `Session create failed (${sRes.status}): ${text}`
          );
        }

        const sess = await sRes.json();
        setSessionId(sess.id);

        // 2️⃣ Load questions
        const qRes = await fetch(
          'http://127.0.0.1:8000/risk-assessments/questions',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!qRes.ok) {
          const text = await qRes.text();
          throw new Error(
            `Questions fetch failed (${qRes.status}): ${text}`
          );
        }

        const data = await qRes.json();

        if (!Array.isArray(data)) {
          throw new Error(
            `Expected questions array, got: ${JSON.stringify(data)}`
          );
        }

        setQuestions(data);
      } catch (e: any) {
        console.error('Risk assessment init failed', e);
        setError(e.message || 'Initialization failed');
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [open, token]);

  // -----------------------------
  // ANSWER HANDLER
  // -----------------------------
  function handleAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.id] !== undefined);

  // -----------------------------
  // COMPLETE
  // -----------------------------
  async function handleComplete() {
    if (!sessionId || !allAnswered || !token) return;

    setLoading(true);
    setError(null);

    try {
      // Save answers
      const aRes = await fetch(
        `http://127.0.0.1:8000/risk-assessments/sessions/${sessionId}/answers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            questions.map((q) => ({
              question_id: q.id,
              answer: answers[q.id],
            }))
          ),
        }
      );

      if (!aRes.ok) {
        throw new Error('Saving answers failed');
      }

      // Evaluate
      const eRes = await fetch(
        `http://127.0.0.1:8000/risk-assessments/sessions/${sessionId}/evaluate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!eRes.ok) {
        throw new Error('Evaluation failed');
      }

      // Complete
      const cRes = await fetch(
        `http://127.0.0.1:8000/risk-assessments/sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!cRes.ok) {
        throw new Error('Completion failed');
      }

      onCompleted();
      onClose();
    } catch (e: any) {
      console.error('Risk assessment completion failed', e);
      setError(e.message || 'Completion failed');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-slate-900 w-[800px] max-h-[80vh] overflow-y-auto rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">
          Risk Assessment Checklist
        </h2>

        {loading && <p>Loading...</p>}

        {error && (
          <p className="text-red-500 mb-4">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          questions.map((q) => (
            <div key={q.id} className="mb-4">
              <p className="mb-2">
                <strong>{q.code}</strong> — {q.text}
              </p>
              <div className="flex gap-3">
                {['yes', 'partial', 'no', 'na'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(q.id, opt)}
                    className={`px-3 py-1 rounded ${
                      answers[q.id] === opt
                        ? 'bg-blue-600'
                        : 'bg-gray-700'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            disabled={!allAnswered || loading || !!error}
            onClick={handleComplete}
            className={`px-4 py-2 rounded ${
              allAnswered && !error
                ? 'bg-green-600'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
