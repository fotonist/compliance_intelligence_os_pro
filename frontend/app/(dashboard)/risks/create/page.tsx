"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ChecklistQuestion from "@/app/components/assessment/ChecklistQuestion";
import AssessmentFooter from "@/app/components/assessment/AssessmentFooter";
import { apiFetch } from "@/app/lib/api";

type Dimension = "likelihood" | "impact";
type SourceType = "STANDARD" | "REQUIREMENT" | "CONTROL";

type ChecklistQuestionDTO = {
  id: number;
  title: string;
  description?: string | null;
  dimension: Dimension;
  choices: { key: string; label: string }[];
};

type SourceOption = {
  id: number;
  code: string;
  title: string;
  standardCode?: string;
};

type StandardStructure = {
  standard_code: string;
  clauses?: {
    code: string;
    title: string;
    requirements?: {
      id: number;
      code: string;
      title: string;
      controls?: { id: number; code: string; title: string }[];
    }[];
  }[];
};

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
  if (score >= 20) return "CRITICAL";
  if (score >= 15) return "HIGH";
  if (score >= 10) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "VERY_LOW";
}

export default function CreateRiskPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [sourceType, setSourceType] = useState<SourceType | "">("");
  const [sourceId, setSourceId] = useState<number | "">("");
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [allSourceOptions, setAllSourceOptions] = useState<{
    standards: SourceOption[];
    requirements: SourceOption[];
    controls: SourceOption[];
  }>({ standards: [], requirements: [], controls: [] });

  const [processId, setProcessId] = useState<number | "">("");
  const [processes, setProcesses] = useState<any[]>([]);

  const [questions, setQuestions] = useState<ChecklistQuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [bootLoading, setBootLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setBootLoading(true);
        setError(null);

        const [questionRes, processRes, standardRes] = await Promise.all([
          apiFetch("/risk-assessment/questions"),
          apiFetch("/company/processes"),
          apiFetch("/standards/"),
        ]);

        const [questionData, processData, standardData] = await Promise.all([
          questionRes.json(),
          processRes.json(),
          standardRes.json(),
        ]);

        if (!mounted) return;

        setQuestions(Array.isArray(questionData) ? questionData : []);
        setProcesses(
          Array.isArray(processData) ? processData : processData?.items || []
        );

        const standards = Array.isArray(standardData) ? standardData : [];

        const structures = await Promise.all(
          standards.map(async (standard: any) => {
            try {
              const response = await apiFetch(
                `/standards/${standard.id}/structure`
              );
              return await response.json();
            } catch {
              return null;
            }
          })
        );

        if (!mounted) return;

        const requirements: SourceOption[] = [];
        const controls: SourceOption[] = [];

        structures.forEach((structure: StandardStructure | null) => {
          if (!structure?.clauses) return;

          structure.clauses.forEach((clause) => {
            clause.requirements?.forEach((requirement) => {
              requirements.push({
                id: requirement.id,
                code: requirement.code,
                title: requirement.title,
                standardCode: structure.standard_code,
              });

              requirement.controls?.forEach((control) => {
                controls.push({
                  id: control.id,
                  code: control.code,
                  title: control.title,
                  standardCode: structure.standard_code,
                });
              });
            });
          });
        });

        const nextSourceOptions = {
          standards: standards.map((standard: any) => ({
            id: standard.id,
            code: standard.code,
            title: standard.title,
          })),
          requirements,
          controls,
        };

        setAllSourceOptions(nextSourceOptions);
        setSourceOptions(nextSourceOptions.standards);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Unable to load risk assessment data.");
      } finally {
        if (mounted) setBootLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  function dimensionScore(dim: Dimension): number | null {
    const group = questions.filter((q) => q.dimension === dim);
    if (group.length === 0) return null;

    const scores = group
      .map((q) => answers[q.id])
      .filter(Boolean)
      .map((key) => CHOICE_SCORE_MAP[key!])
      .filter((value) => typeof value === "number");

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
    if (typeof likelihood !== "number" || typeof impact !== "number") {
      return null;
    }

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

  function handleSourceTypeChange(value: SourceType | "") {
    setSourceType(value);
    setSourceId("");

    if (value === "STANDARD") {
      setSourceOptions(allSourceOptions.standards);
    } else if (value === "REQUIREMENT") {
      setSourceOptions(allSourceOptions.requirements);
    } else if (value === "CONTROL") {
      setSourceOptions(allSourceOptions.controls);
    } else {
      setSourceOptions([]);
    }
  }

  async function handleCreate() {
    if (!canComplete || saving) return;

    try {
      setSaving(true);
      setError(null);

      await apiFetch("/risks/", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          likelihood,
          impact,
          process_id: Number(processId),
          source_type: sourceType,
          source_id: Number(sourceId),
          action: "assessment",
        }),
      });

      router.push("/risks");
    } catch (e: any) {
      setError(e?.message || "Unable to create risk.");
    } finally {
      setSaving(false);
    }
  }

  if (bootLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Loading risk assessment…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Risk Management
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Create New Risk
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define the risk context, assess likelihood and impact, and create the initial risk version.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Risk Context
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Link the risk to the applicable standard, requirement or control and organizational process.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Source Type
              </label>
              <select
                value={sourceType}
                onChange={(event) =>
                  handleSourceTypeChange(event.target.value as SourceType | "")
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select source type…</option>
                <option value="STANDARD">Standard</option>
                <option value="REQUIREMENT">Requirement</option>
                <option value="CONTROL">Control</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Source
              </label>
              <select
                value={sourceId}
                disabled={!sourceType || sourceOptions.length === 0}
                onChange={(event) =>
                  setSourceId(
                    event.target.value ? Number(event.target.value) : ""
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {!sourceType
                    ? "Select source type first…"
                    : sourceOptions.length
                      ? "Select source…"
                      : "No sources available"}
                </option>
                {sourceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} — {option.title}
                    {option.standardCode ? ` (${option.standardCode})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Process
              </label>
              <select
                value={processId}
                onChange={(event) =>
                  setProcessId(
                    event.target.value ? Number(event.target.value) : ""
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select process…</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.code ? `${process.code} — ` : ""}
                    {process.name || process.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Risk Definition
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Describe the risk in business and operational terms.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Risk Title
              </label>
              <input
                placeholder="e.g. Unauthorized access to privileged accounts"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description
              </label>
              <textarea
                rows={4}
                placeholder="Describe the event, cause and potential consequence."
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Risk Assessment
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Assess likelihood and impact. The system calculates the score from the selected values.
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 sm:flex">
              <span>Score</span>
              <strong className="text-slate-900">{score ?? "—"}</strong>
              <span className="mx-1 text-slate-300">|</span>
              <span>Level</span>
              <strong className="text-slate-900">{level}</strong>
            </div>
          </div>

          <div className="space-y-6">
            {(["likelihood", "impact"] as Dimension[]).map((dimension) => {
              const group = questions.filter(
                (question) => question.dimension === dimension
              );

              if (group.length === 0) return null;

              return (
                <div key={dimension} className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {dimension}
                  </div>
                  {group.map((question) => (
                    <ChecklistQuestion
                      key={question.id}
                      question={question}
                      value={answers[question.id]}
                      onChange={(questionId, choiceKey) =>
                        setAnswers((previous) => ({
                          ...previous,
                          [questionId]: choiceKey,
                        }))
                      }
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {!canComplete && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Complete the source, process, title, Likelihood and Impact assessment before creating the risk.
            </div>
          )}

          <AssessmentFooter
            canComplete={canComplete}
            saving={saving}
            onComplete={handleCreate}
            onClose={() => router.push("/risks")}
          />
        </section>
      </div>
    </div>
  );
}
