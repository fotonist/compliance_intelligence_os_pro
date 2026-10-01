"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  FileText,
  Layers3,
  Link2,
  RefreshCw,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import WorkProductEvidenceWorkspace from "./WorkProductEvidenceWorkspace";
import PA11AssessmentEvidence from "./PA11AssessmentEvidence";

import PerformanceObjectiveWorkspace from "./PerformanceObjectiveWorkspace";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type AssessmentProcess = {
  id: number;
  assessment_id: number;
  pam_process_id: number;
  tenant_process_id?: number | null;
  in_scope: boolean;
  target_capability_level?: number | null;
  status: string;
};

type ProcessIdentity = {
  id: number;
  code: string;
  name: string;
  purpose?: string | null;
  description?: string | null;
};

type ProcessOutcome = {
  id: number;
  code: string;
  text: string;
  localized_text?: string | null;
  content_language?: string | null;
  content_origin?: string | null;
  source_language?: string | null;
  sort_order: number;
};

type BasePractice = {
  id: number;
  code: string;
  text: string;
  guidance?: string | null;
  localized_title?: string | null;
  localized_description?: string | null;
  content_language?: string | null;
  content_origin?: string | null;
  source_language?: string | null;
  sort_order: number;
};

type BasePracticeEvaluation = {
  base_practice_id: number;
  code: string;
  text?: string | null;
  guidance?: string | null;
  sort_order: number;
  evaluation_id?: number | null;
  rating?: string | null;
  observation?: string | null;
  justification?: string | null;
  status: string;
  evaluator_user_id?: number | null;
  evaluated_at?: string | null;
};

type WorkProduct = {
  link_id: number;
  id: number;
  code: string;
  name: string;
  description?: string | null;
  localized_title?: string | null;
  localized_description?: string | null;
  content_language?: string | null;
  content_origin?: string | null;
  source_language?: string | null;
  characteristics?: unknown;
  direction: string;
  sort_order: number;
};

type AchievementIndicator = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  indicator_type?: string | null;
  sort_order: number;
};

type ProcessAttributeEvaluation = {
  id: number;
  rating?: string | null;
  justification?: string | null;
  status: string;
  evaluated_by?: number | null;
  evaluated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProcessAttribute = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  sort_order: number;
  standard_attribute_id?: number | null;
  achievement_indicators?: AchievementIndicator[];
  evaluation?: ProcessAttributeEvaluation | null;
};

type CapabilityLevel = {
  id: number;
  level: number;
  code: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_target?: boolean;
  process_attributes: ProcessAttribute[];
};

type CapabilityProjection = {
  assessment_id: number;
  assessment_process_id: number;
  process?: {
    id?: number;
    code?: string;
    name?: string;
  };
  target_capability_level?: number | null;
  capability_model_id?: number | null;
  capability_levels: CapabilityLevel[];
};

type ProcessWorkspace = {
  assessment_process: AssessmentProcess;
  process: ProcessIdentity;
  outcomes: ProcessOutcome[];
  base_practices: BasePractice[];
  work_products: WorkProduct[];
  capability_levels: CapabilityLevel[];
};

type TabKey =
  | "assessment"
  | "practices"
  | "outcomes"
  | "products"
  | "capability";

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token") ||
    ""
  );
}

function normalizeStatus(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <BadgeCheck className="h-3.5 w-3.5" />
        {detail}
      </div>
    </div>
  );
}

export default function ProcessAssessmentPage() {
  const params = useParams<{
    sessionId: string;
    assessmentProcessId: string;
  }>();

  const router = useRouter();

  const assessmentId = useMemo(() => {
    const value = Number(params?.sessionId);

    return Number.isInteger(value) && value > 0
      ? value
      : null;
  }, [params?.sessionId]);

  const assessmentProcessId = useMemo(() => {
    const value = Number(
      params?.assessmentProcessId
    );

    return Number.isInteger(value) && value > 0
      ? value
      : null;
  }, [params?.assessmentProcessId]);

  const [workspace, setWorkspace] =
    useState<ProcessWorkspace | null>(null);

  const [basePracticeEvaluations, setBasePracticeEvaluations] =
    useState<BasePracticeEvaluation[]>([]);

  const [capability, setCapability] =
    useState<CapabilityProjection | null>(null);

  const [capabilityLoading, setCapabilityLoading] =
    useState(false);

  const [capabilityError, setCapabilityError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<TabKey>("assessment");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!assessmentId || !assessmentProcessId) {
      setError(
        "Invalid process assessment identifier."
      );
      setLoading(false);
      return;
    }

    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/workspace`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Process workspace request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as ProcessWorkspace;

      setWorkspace(data);
    } catch (err) {
      setWorkspace(null);

      setError(
        err instanceof Error
          ? err.message
          : "Process assessment could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [
    assessmentId,
    assessmentProcessId,
  ]);

  const loadBasePracticeEvaluations = useCallback(async () => {
    if (!assessmentId || !assessmentProcessId) {
      return;
    }

    const token = getToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/base-practice-evaluations`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Base practice evaluation request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as BasePracticeEvaluation[];

      setBasePracticeEvaluations(data);
    } catch (err) {
      setBasePracticeEvaluations([]);

      setError(
        err instanceof Error
          ? err.message
          : "Base practice evaluations could not be loaded."
      );
    }
  }, [assessmentId, assessmentProcessId]);

  const loadCapability = useCallback(async () => {
    if (!assessmentId || !assessmentProcessId) {
      return;
    }

    const token = getToken();

    if (!token) {
      setCapability(null);
      setCapabilityError(
        "Authentication token is not available."
      );
      return;
    }

    setCapabilityLoading(true);
    setCapabilityError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/capability`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Capability request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as CapabilityProjection;

      setCapability(data);
    } catch (err) {
      setCapability(null);
      setCapabilityError(
        err instanceof Error
          ? err.message
          : "Capability assessment could not be loaded."
      );
    } finally {
      setCapabilityLoading(false);
    }
  }, [assessmentId, assessmentProcessId]);

  useEffect(() => {
    void loadWorkspace();
    void loadBasePracticeEvaluations();
    void loadCapability();
  }, [
    loadWorkspace,
    loadBasePracticeEvaluations,
    loadCapability,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading process assessment...
        </div>
      </div>
    );
  }

  if (
    error ||
    !workspace ||
    !assessmentId
  ) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/maturity/workspace/${assessmentId || ""}`
              )
            }
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assessment
          </button>

          <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">
              Process assessment could not be loaded
            </div>

            <div className="mt-2 text-sm text-red-700">
              {error ||
                "Process workspace is unavailable."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const process = workspace.process;
  const runtime = workspace.assessment_process;

  const targetLevel =
    runtime.target_capability_level;

  const targetCapability =
    targetLevel === null ||
    targetLevel === undefined
      ? null
      : workspace.capability_levels.find(
          (item) => item.level === targetLevel
        ) || null;

  const attributeCount =
    workspace.capability_levels.reduce(
      (total, level) =>
        total + level.process_attributes.length,
      0
    );

  const tabs: Array<{
    key: TabKey;
    label: string;
    count?: number;
  }> = [
    {
      key: "assessment",
      label: "Assessment",
    },
    {
      key: "practices",
      label: "Base Practices",
      count: workspace.base_practices.length,
    },
    {
      key: "outcomes",
      label: "Outcomes",
      count: workspace.outcomes.length,
    },
    {
      key: "products",
      label: "Work Products",
      count: workspace.work_products.length,
    },
    {
      key: "capability",
      label: "Capability",
      count: attributeCount,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/maturity/workspace/${assessmentId}`
            )
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessment
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  PROCESS ASSESSMENT
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {normalizeStatus(runtime.status)}
                </span>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {runtime.in_scope
                    ? "In Scope"
                    : "Out of Scope"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">
                  {process.code}
                </span>

                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {process.name}
                </h1>
              </div>

              {process.purpose ? (
                <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-600">
                  {process.purpose}
                </p>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  No process purpose is available.
                </p>
              )}
            </div>

            <div className="min-w-[210px] rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Target Capability
              </div>

              <div className="mt-2 text-xl font-semibold text-slate-950">
                {targetLevel === null ||
                targetLevel === undefined
                  ? "-"
                  : `Level ${targetLevel}`}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {targetCapability?.name ||
                  "No target selected"}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ClipboardCheck}
            label="Assessment Status"
            value={normalizeStatus(runtime.status)}
            detail="PAM process runtime"
          />

          <StatCard
            icon={Target}
            label="Target Capability"
            value={
              targetLevel === null ||
              targetLevel === undefined
                ? "-"
                : `Level ${targetLevel}`
            }
            detail={
              targetCapability?.name ||
              "No target selected"
            }
          />

          <StatCard
            icon={Layers3}
            label="Base Practices"
            value={String(
              workspace.base_practices.length
            )}
            detail="Canonical PAM practices"
          />

          <StatCard
            icon={FileText}
            label="Work Products"
            value={String(
              workspace.work_products.length
            )}
            detail="Canonical PAM work products"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto border-b border-slate-200 px-6">
            <div className="flex min-w-max gap-7">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab.key)
                  }
                  className={`border-b-2 py-4 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}

                  {tab.count !== undefined ? (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 lg:p-7">
            {activeTab === "assessment" ? (
              <AssessmentOverview
                workspace={workspace}
              />
            ) : null}

            {activeTab === "practices" ? (
              <BasePractices
                items={basePracticeEvaluations}
                definitions={workspace.base_practices}
                assessmentId={assessmentId}
                assessmentProcessId={assessmentProcessId}
                onReload={loadBasePracticeEvaluations}
              />
            ) : null}

            {activeTab === "outcomes" ? (
              <Outcomes
                items={workspace.outcomes}
              />
            ) : null}

            {activeTab === "products" ? (
              <WorkProductEvidenceWorkspace
                items={workspace.work_products}
                assessmentId={assessmentId}
                assessmentProcessId={assessmentProcessId}
              />
            ) : null}

            {activeTab === "capability" ? (
              <Capability
                capability={capability}
                loading={capabilityLoading}
                error={capabilityError}
                assessmentId={assessmentId}
                assessmentProcessId={assessmentProcessId}
                workspace={workspace}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function AssessmentOverview({
  workspace,
}: {
  workspace: ProcessWorkspace;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-slate-400" />

          <h2 className="text-base font-semibold text-slate-950">
            Process Definition
          </h2>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Process
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-900">
            {workspace.process.code} -{" "}
            {workspace.process.name}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Description
          </div>

          <div className="mt-1 text-sm leading-6 text-slate-600">
            {workspace.process.description || "-"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-950">
          Assessment Structure
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryValue
            label="Outcomes"
            value={workspace.outcomes.length}
          />

          <SummaryValue
            label="Base Practices"
            value={workspace.base_practices.length}
          />

          <SummaryValue
            label="Work Products"
            value={workspace.work_products.length}
          />

          <SummaryValue
            label="Capability Levels"
            value={workspace.capability_levels.length}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryValue({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-2xl font-semibold text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium text-slate-500">
        {label}
      </div>
    </div>
  );
}

function BasePractices({
  items,
  definitions,
  assessmentId,
  assessmentProcessId,
  onReload,
}: {
  items: BasePracticeEvaluation[];
  definitions: BasePractice[];
  assessmentId: number;
  assessmentProcessId: number;
  onReload: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<
    Record<
      number,
      {
        observation: string;
        justification: string;
      }
    >
  >({});

  const [savingId, setSavingId] =
    useState<number | null>(null);

  const [saveError, setSaveError] = useState("");
  const [savedId, setSavedId] =
    useState<number | null>(null);

  useEffect(() => {
    const next: Record<
      number,
      {
        observation: string;
        justification: string;
      }
    > = {};

    for (const item of items) {
      next[item.base_practice_id] = {
        observation: item.observation || "",
        justification: item.justification || "",
      };
    }

    setDrafts(next);
  }, [items]);

  const updateDraft = (
    basePracticeId: number,
    field: "observation" | "justification",
    value: string
  ) => {
    setDrafts((current) => ({
      ...current,
      [basePracticeId]: {
        observation:
          current[basePracticeId]?.observation || "",
        justification:
          current[basePracticeId]?.justification || "",
        [field]: value,
      },
    }));
  };

  const saveEvaluation = async (
    item: BasePracticeEvaluation
  ) => {
    const token = getToken();

    if (!token) {
      setSaveError("Authentication token is unavailable.");
      return;
    }

    const draft = drafts[item.base_practice_id] || {
      observation: "",
      justification: "",
    };

    setSavingId(item.base_practice_id);
    setSaveError("");
    setSavedId(null);

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/base-practices/${item.base_practice_id}/evaluation`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rating: item.rating ?? null,
            observation: draft.observation || null,
            justification: draft.justification || null,
            status: item.status || "not_assessed",
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Base practice evaluation update failed: ${response.status}`
        );
      }

      await response.json();
      await onReload();

      setSavedId(item.base_practice_id);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Base practice evaluation could not be saved."
      );
    } finally {
      setSavingId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        No base practices are available for this process.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      

      {saveError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {saveError}
        </div>
      ) : null}

      {items.map((item) => {
        const definition =
          definitions.find(
            (candidate) =>
              candidate.id === item.base_practice_id
          ) || null;

        const localizedTitle =
          definition?.localized_title || null;

        const localizedDescription =
          definition?.localized_description || null;

        const draft = drafts[item.base_practice_id] || {
          observation: "",
          justification: "",
        };

        const saving =
          savingId === item.base_practice_id;

        const saved =
          savedId === item.base_practice_id;

        return (
          <section
            key={item.base_practice_id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  {item.code}
                </span>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {normalizeStatus(item.status)}
                </span>
              </div>

              <div className="flex items-center gap-5 text-xs">
                <div>
                  <span className="text-slate-400">
                    Rating
                  </span>{" "}
                  <span className="font-semibold text-slate-700">
                    {item.rating || "Not rated"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400">
                    Evaluation
                  </span>{" "}
                  <span className="font-semibold text-slate-700">
                    {item.evaluation_id
                      ? `#${item.evaluation_id}`
                      : "Not created"}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-100 px-5 py-5">
              {localizedTitle ? (
                <>
                  <div className="text-base font-semibold text-slate-950">
                    {localizedTitle}
                  </div>

                  {localizedDescription ? (
                    <div className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
                      {localizedDescription}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    

                    
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">
                  English localization is not available for this practice.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Observation
                </span>

                <textarea
                  value={draft.observation}
                  onChange={(event) =>
                    updateDraft(
                      item.base_practice_id,
                      "observation",
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Record assessment observations..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Justification
                </span>

                <textarea
                  value={draft.justification}
                  onChange={(event) =>
                    updateDraft(
                      item.base_practice_id,
                      "justification",
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Record the assessment rationale..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
              <div className="text-xs text-slate-500">
                {saved
                  ? "Evaluation saved."
                  : "Runtime assessment record"}
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEvaluation(item)}
                className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Evaluation"}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Outcomes({
  items,
}: {
  items: ProcessOutcome[];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-slate-200 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {item.code}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm leading-6 text-slate-700">
                {item.localized_text ||
                  "English localization is not available."}
              </div>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkProducts({
  items,
}: {
  items: WorkProduct[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-[110px_1fr_120px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <div>Code</div>
        <div>Work Product</div>
        <div>Direction</div>
      </div>

      {items.map((item) => (
        <div
          key={item.link_id}
          className="grid grid-cols-[110px_1fr_120px] border-b border-slate-100 px-5 py-4 last:border-0"
        >
          <div className="text-sm font-semibold text-slate-700">
            {item.code}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-900">
              {item.name}
            </div>

            {item.description ? (
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {item.description}
              </div>
            ) : null}
          </div>

          <div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {normalizeStatus(item.direction)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Capability({
  capability,
  loading,
  error,
  assessmentId,
  assessmentProcessId,
  workspace,
}: {
  capability: CapabilityProjection | null;
  loading: boolean;
  error: string;
  assessmentId: number;
  assessmentProcessId: number;
  workspace: ProcessWorkspace;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading capability assessment...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="text-sm font-semibold text-red-800">
          Capability assessment could not be loaded
        </div>

        <div className="mt-2 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!capability) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Capability assessment is not available.
      </div>
    );
  }

  const levels = capability.capability_levels || [];

  const attributeCount = levels.reduce(
    (total, level) =>
      total + level.process_attributes.length,
    0
  );

  const indicatorCount = levels.reduce(
    (levelTotal, level) =>
      levelTotal +
      level.process_attributes.reduce(
        (attributeTotal, attribute) =>
          attributeTotal +
          (attribute.achievement_indicators?.length || 0),
        0
      ),
    0
  );

  const evaluatedCount = levels.reduce(
    (levelTotal, level) =>
      levelTotal +
      level.process_attributes.filter(
        (attribute) => Boolean(attribute.evaluation)
      ).length,
    0
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Process Attributes
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {attributeCount}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Achievement Criteria
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {indicatorCount}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Evaluated Attributes
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {evaluatedCount} / {attributeCount}
          </div>
        </div>
      </div>

      {levels.map((level) => (
        <div
          key={level.id}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                    {level.code}
                  </span>

                  {level.is_target ? (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      Target
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-base font-semibold text-slate-950">
                  Level {level.level} - {level.name}
                </div>

                {level.description ? (
                  <p className="mt-1 max-w-5xl text-sm leading-6 text-slate-500">
                    {level.description}
                  </p>
                ) : null}
              </div>

              <div className="text-xs font-medium text-slate-500">
                {level.process_attributes.length} process attributes
              </div>
            </div>
          </div>

          {level.process_attributes.length ? (
            <div className="divide-y divide-slate-200">
              {level.process_attributes.map((attribute) => {
                const evaluation = attribute.evaluation;
                const indicators =
                  attribute.achievement_indicators || [];

                return (
                  <div
                    key={attribute.id}
                    className="p-5"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                            {attribute.code}
                          </span>

                          <span className="text-base font-semibold text-slate-950">
                            {attribute.name}
                          </span>

                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            {indicators.length} criteria
                          </span>
                        </div>

                        {attribute.description ? (
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {attribute.description}
                          </p>
                        ) : null}

                        <div className="mt-5">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Achievement Criteria
                          </div>

                          {indicators.length ? (
                            <div className="mt-3 space-y-2">
                              {indicators.map((indicator) => (
                                <div
                                  key={indicator.id}
                                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="mt-0.5 shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                      {indicator.code}
                                    </span>

                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-slate-900">
                                        {indicator.name}
                                      </div>

                                      {indicator.description ? (
                                        <div className="mt-1 text-xs leading-5 text-slate-500">
                                          {indicator.description}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-slate-400">
                              No achievement criteria are defined.
                            </div>
                          )}
                        </div>

                        {attribute.code.replaceAll(" ", "") === "PA1.1" ? (
                          <PA11AssessmentEvidence
                            assessmentId={assessmentId}
                            assessmentProcessId={assessmentProcessId}
                            outcomes={workspace.outcomes}
                            basePractices={workspace.base_practices}
                            workProducts={workspace.work_products}
                          />
                        ) : null}

                        {attribute.code.replaceAll(" ", "") === "PA2.1" ? (
                          <PerformanceObjectiveWorkspace
                            assessmentId={assessmentId}
                            assessmentProcessId={assessmentProcessId}
                            processAttributeId={attribute.id}
                            attributeCode={attribute.code}
                            indicators={indicators}
                          />
                        ) : null}
                      </div>

                      <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 xl:w-80">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Attribute Evaluation
                          </div>

                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            {evaluation
                              ? normalizeStatus(
                                  evaluation.status
                                )
                              : "Not Evaluated"}
                          </span>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-medium text-slate-500">
                            Rating
                          </div>

                          <div className="mt-1 text-sm font-semibold text-slate-950">
                            {evaluation?.rating || "-"}
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-medium text-slate-500">
                            Justification
                          </div>

                          <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {evaluation?.justification ||
                              "No evaluation has been recorded."}
                          </div>
                        </div>

                        {evaluation?.evaluated_at ? (
                          <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                            Evaluated{" "}
                            {new Date(
                              evaluation.evaluated_at
                            ).toLocaleString()}
                          </div>
                        ) : null}

                        {!evaluation ? (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            Rating input is intentionally disabled until a canonical rating scale is configured for this standard version.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-400">
              No process attributes are defined for this level.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


