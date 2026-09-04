"use client";

import WorkspaceOverview from "./WorkspaceOverview";
import WorkspaceEvidence from "./WorkspaceEvidence";
import WorkspaceRisks from "./WorkspaceRisks";
import WorkspaceTasks from "./WorkspaceTasks";
import WorkspaceAnalytics from "./WorkspaceAnalytics";
import WorkspaceTimeline from "./WorkspaceTimeline";
import WorkspaceAISummary from "./WorkspaceAISummary";

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import clsx from "clsx";

import {
  XMarkIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ClockIcon,
  SparklesIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

interface MatrixRowContext {
  standard_id?: number;
  standard_code?: string;
  process_area_code?: string;
  process_area_title?: string;
  practice_id?: number;
  practice_code?: string;
  practice_title?: string;
  practice_description?: string;
  target_level?: number;
  achieved_level?: number;
  evidence_count?: number;
}

export interface WorkspaceProps {
  open: boolean;
  controlId?: number | string | null;
  row?: MatrixRowContext | null;
  mode?: "control" | "maturity";
  onClose: () => void;
}

type TabKey =
  | "overview"
  | "evidence"
  | "risks"
  | "tasks"
  | "analytics"
  | "timeline"
  | "ai";

interface WorkspaceResponse {
  standard: any;
  clause: any;
  requirement: any;
  control: any;
  coverage: any;
  evidences: any[];
  risks: any[];
  risk_summary: any;
  tasks: any[];
  task_summary: any;
  analytics: any;
  timeline: any[];
  ai_summary: string[];
  ai_executive_summary?: string;
}

const controlTabs: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "overview", label: "Overview", icon: ShieldCheckIcon },
  { key: "evidence", label: "Evidence", icon: CircleStackIcon },
  { key: "risks", label: "Risks", icon: ExclamationTriangleIcon },
  { key: "tasks", label: "Tasks", icon: ClipboardDocumentListIcon },
  { key: "analytics", label: "Analytics", icon: ChartBarIcon },
  { key: "timeline", label: "Timeline", icon: ClockIcon },
  { key: "ai", label: "AI Summary", icon: SparklesIcon },
];

const maturityTabs: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "overview", label: "Overview", icon: ShieldCheckIcon },
  { key: "evidence", label: "Evidence", icon: CircleStackIcon },
  { key: "tasks", label: "Tasks", icon: ClipboardDocumentListIcon },
  { key: "ai", label: "AI Summary", icon: SparklesIcon },
];

function LevelBadge({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string | number;
  muted?: boolean;
}) {
  return (
    <div className="border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>
      <div
        className={clsx(
          "mt-1.5 text-lg font-semibold",
          muted ? "text-slate-400" : "text-slate-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-300" />
      <h3 className="mt-4 text-sm font-semibold text-slate-800">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function MaturityWorkspace({
  row,
  activeTab,
}: {
  row: MatrixRowContext;
  activeTab: TabKey;
}) {
  const achieved = row.achieved_level ?? 0;
  const target = row.target_level ?? 0;
  const evidenceCount = row.evidence_count ?? 0;

  if (activeTab === "overview") {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Maturity Practice
                </p>

                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  {row.practice_code ?? "Practice"}
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  {row.practice_title ?? "Untitled practice"}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {row.standard_code ?? "Standard"}{" "}
                  {row.process_area_code
                    ? `· ${row.process_area_code}`
                    : ""}
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <AcademicCapIcon className="h-3.5 w-3.5" />
                Maturity
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-200 md:grid-cols-4">
            <LevelBadge label="Current Level" value={`CL${achieved}`} />
            <LevelBadge label="Target Level" value={`CL${target}`} />
            <LevelBadge
              label="Gap"
              value={`CL${Math.max(target - achieved, 0)}`}
            />
            <LevelBadge
              label="Evidence"
              value={evidenceCount}
              muted={evidenceCount === 0}
            />
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Practice Definition
            </p>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm leading-6 text-slate-600">
              {row.practice_description ||
                "No practice description has been defined for this maturity practice."}
            </p>
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Assessment Position
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                Achieved
              </span>
              <span className="font-semibold text-slate-900">
                CL{achieved}
              </span>
            </div>

            <div className="mt-3 h-2 bg-slate-100">
              <div
                className="h-2 bg-slate-800 transition-all"
                style={{
                  width: `${
                    target > 0
                      ? Math.min((achieved / target) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Current capability</span>
              <span>Target CL{target}</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "evidence") {
    return (
      <EmptyState
        icon={CircleStackIcon}
        title="No maturity evidence linked"
        description="Evidence for this practice has not been linked to the matrix row yet."
      />
    );
  }

  if (activeTab === "tasks") {
    return (
      <EmptyState
        icon={ClipboardDocumentListIcon}
        title="No maturity tasks linked"
        description="Remediation and implementation tasks associated with this practice will appear here when available."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="border border-slate-200 bg-slate-50 p-2.5">
              <SparklesIcon className="h-5 w-5 text-slate-600" />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Intelligence
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                AI Summary
              </h3>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm leading-6 text-slate-600">
              AI analysis has not been generated for this maturity
              practice yet.
            </p>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              The practice context is available to the workspace.
              Once intelligence generation is available, AI findings
              can be surfaced here without changing the assessment
              record.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ComplianceWorkspaceDrawer({
  open,
  controlId,
  row,
  mode = "control",
  onClose,
}: WorkspaceProps) {
  const isMaturity =
    mode === "maturity" || !!row?.practice_id;

  const [activeTab, setActiveTab] =
    useState<TabKey>("overview");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [workspace, setWorkspace] =
    useState<WorkspaceResponse | null>(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiError, setAiError] =
    useState<string | null>(null);

  const [aiConfirmOpen, setAiConfirmOpen] =
    useState(false);

  const [aiStage, setAiStage] =
    useState<
      "idle" |
      "connecting" |
      "analyzing" |
      "generating"
    >("idle");
  const [aiResult, setAiResult] =
    useState<{
      summary: string[];
      root_causes: string[];
      warnings: string[];
      actions: string[];
      provider?: string;
      model?: string | null;
      status?: string;
      usage?: {
        input_tokens?: number | null;
        output_tokens?: number | null;
        total_tokens?: number | null;
      } | null;
      error?: string | null;
    } | null>(null);

  const endpoint = useMemo(() => {
    if (isMaturity) return null;
    if (!controlId) return null;

    const API =
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";

    return `${API}/company/compliance-object/${controlId}`;
  }, [controlId, isMaturity]);

  const fetchWorkspace = useCallback(async () => {
    if (isMaturity || !endpoint) return;

    try {
      setLoading(true);
      setError(null);

      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers: HeadersInit = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        let detail = "";

        try {
          const errorJson = await response.json();
          detail =
            errorJson?.detail ||
            errorJson?.message ||
            "";
        } catch {
          detail = "";
        }

        throw new Error(
          detail ||
            `Workspace request failed (HTTP ${response.status}).`
        );
      }

      const json =
        (await response.json()) as WorkspaceResponse;

      setWorkspace(json);
    } catch (err: any) {
      console.error(
        "Compliance Workspace fetch failed:",
        err
      );

      setWorkspace(null);

      setError(
        err?.message ||
          "Unexpected workspace error."
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, isMaturity]);

  const estimatedAITokens = useMemo(() => {
    const context = JSON.stringify({
      control_id: controlId ?? null,
      practice_id: row?.practice_id ?? null,
      standard_id: row?.standard_id ?? null,
      standard_code: row?.standard_code ?? null,
      coverage: workspace?.coverage ?? {},
      risk: workspace?.risk_summary ?? {},
      tasks: workspace?.task_summary ?? {},
      evidence_count: workspace?.evidences?.length ?? 0,
      analytics: workspace?.analytics ?? {},
    });

    /*
     * Conservative client-side estimate.
     * Actual usage is taken from the OpenAI response.
     */
    return Math.max(
      500,
      Math.ceil(context.length / 4) + 350
    );
  }, [
    controlId,
    row,
    workspace,
  ]);
  const generateAIInsight = useCallback(async () => {
    if (!workspace && !row) {
      setAiError("No compliance context is available for AI analysis.");
      setActiveTab("ai");
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);
      setAiResult(null);
      setAiStage("connecting");

      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const API =
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:8000";

      const coverage = workspace?.coverage ?? {};
      const risk = workspace?.risk_summary ?? {};
      const tasks = workspace?.task_summary ?? {};
      const analytics = workspace?.analytics ?? {};

      const kpis = {
        object: {
          control_id: controlId ?? null,
          practice_id: row?.practice_id ?? null,
          standard_id:
            row?.standard_id ??
            workspace?.standard?.id ??
            null,
          standard_code:
            row?.standard_code ??
            workspace?.standard?.code ??
            null,
          control_code:
            workspace?.control?.code ??
            null,
          control_title:
            workspace?.control?.title ??
            row?.practice_title ??
            null,
        },

        compliance: {
          coverage_percentage:
            coverage.coverage_percentage ??
            coverage.percentage ??
            0,
          coverage_status:
            coverage.status ??
            null,
        },

        risk: {
          total: risk.total ?? 0,
          critical: risk.critical ?? 0,
          high: risk.high ?? 0,
          medium: risk.medium ?? 0,
          low: risk.low ?? 0,
          total_score: risk.total_score ?? 0,
        },

        tasks: {
          total: tasks.total ?? 0,
          open: tasks.open ?? 0,
          completed: tasks.completed ?? 0,
          overdue: tasks.overdue ?? 0,
        },

        evidence: {
          total: workspace?.evidences?.length ?? 0,
          approved: coverage.approved ?? 0,
          linked: coverage.linked ?? 0,
        },

        health: {
          health_score: analytics.health_score ?? 0,
          risk_score: analytics.risk_score ?? 0,
        },

        maturity: row
          ? {
              current_level: row.achieved_level ?? 0,
              target_level: row.target_level ?? 0,
              gap: Math.max(
                (row.target_level ?? 0) -
                (row.achieved_level ?? 0),
                0
              ),
            }
          : null,
      };

      setAiStage("analyzing");

      const response = await fetch(`${API}/ai/dashboard/insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body: JSON.stringify({
          period_days: 30,
          kpis,
        }),
      });

      let result: any = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        const detail =
          result?.detail ??
          result?.error?.message ??
          result?.error ??
          `AI request failed with HTTP ${response.status}.`;

        throw new Error(
          typeof detail === "string"
            ? detail
            : JSON.stringify(detail)
        );
      }

      if (!result) {
        throw new Error(
          "External AI returned an empty response."
        );
      }

      if (
        result.status === "not_configured" ||
        result.status === "error"
      ) {
        throw new Error(
          result.error ||
          "External AI analysis could not be completed."
        );
      }

      setAiStage("generating");

      setAiResult({
        summary:
          Array.isArray(result.summary)
            ? result.summary
            : result.summary
              ? [String(result.summary)]
              : [],

        root_causes:
          Array.isArray(result.root_causes)
            ? result.root_causes
            : [],

        warnings:
          Array.isArray(result.warnings)
            ? result.warnings
            : [],

        actions:
          Array.isArray(result.actions)
            ? result.actions
            : [],

        provider:
          result.provider ?? null,

        model:
          result.model ?? null,

        status:
          result.status ?? null,

        usage:
          result.usage ?? null,

        error:
          result.error ?? null,
      });

      setActiveTab("ai");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "External AI analysis failed.";

      setAiResult(null);
      setAiError(message);
      setAiStage("idle");
      setActiveTab("ai");
    } finally {
      setAiLoading(false);
    }
  }, [
    workspace,
    row,
    controlId,
    setActiveTab,
  ]);

  useEffect(() => {
    if (!open) return;

    setActiveTab("overview");

    if (isMaturity) {
      setWorkspace(null);
      setError(null);
      setLoading(false);
      return;
    }

    fetchWorkspace();
  }, [open, isMaturity, fetchWorkspace]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);

    return () =>
      window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const original =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const tabs =
    isMaturity ? maturityTabs : controlTabs;

  return (
    <Fragment>
      <div
        className="fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        className={clsx(
          "fixed right-0 top-0 z-[100] h-screen w-full",
          "sm:w-[92%] lg:w-[82%] xl:w-[72%] 2xl:w-[68%]",
          "border-l border-slate-200 bg-slate-50",
          "shadow-2xl",
          "flex flex-col"
        )}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-6 px-7 py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Compliance Intelligence
              </p>

              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                {isMaturity
                  ? row?.practice_code ?? "Maturity Practice"
                  : "Compliance Workspace"}
              </h2>

              <p className="mt-1 truncate text-sm text-slate-500">
                {isMaturity
                  ? row?.practice_title ??
                    "Practice intelligence workspace"
                  : "Unified control intelligence workspace"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">

              <button
                type="button"
                onClick={generateAIInsight}
                disabled={aiLoading}
                className={clsx(
                  "inline-flex h-9 items-center gap-2 border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition",
                  aiLoading
                    ? "cursor-wait border-slate-200 bg-slate-50 text-slate-400"
                    : "border-slate-300 bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                <SparklesIcon
                  className={clsx(
                    "h-3.5 w-3.5",
                    aiLoading && "animate-pulse"
                  )}
                />

                {aiLoading
                  ? "Analyzing..."
                  : "Get AI Insight"}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close workspace"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>

            </div>
          </div>

          <div className="overflow-x-auto border-t border-slate-100">
            <div className="flex min-w-max px-5">
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() =>
                      setActiveTab(tab.key)
                    }
                    className={clsx(
                      "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition",
                      activeTab === tab.key
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isMaturity && row ? (
            <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
              <MaturityWorkspace
                row={row}
                activeTab={activeTab}
              />
            </div>
          ) : (
            <>
              {loading && (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
                    <p className="mt-4 text-xs text-slate-500">
                      Loading compliance intelligence...
                    </p>
                  </div>
                </div>
              )}

              {!loading && error && (
                <div className="mx-auto max-w-[1000px] p-8">
                  <div className="border border-red-200 bg-red-50 p-6">
                    <h3 className="text-sm font-semibold text-red-800">
                      Workspace unavailable
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-red-700">
                      {error}
                    </p>

                    <button
                      type="button"
                      onClick={fetchWorkspace}
                      className="mt-5 border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-800 hover:bg-red-50"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!loading &&
                !error &&
                workspace && (
                  <div className="mx-auto max-w-[1800px] p-6 lg:p-8">
                    {activeTab === "overview" && (
                      <WorkspaceOverview
                        workspace={workspace}
                      />
                    )}

                    {activeTab === "evidence" && (
                      <WorkspaceEvidence
                        workspace={workspace}
                      />
                    )}

                    {activeTab === "risks" && (
                      <WorkspaceRisks
                        workspace={workspace}
                      />
                    )}

                    {activeTab === "tasks" && (
                      <WorkspaceTasks
                        workspace={workspace}
                      />
                    )}

                    {activeTab === "analytics" && (
                      <WorkspaceAnalytics
                        workspace={workspace}
                      />
                    )}

                    {activeTab === "timeline" && (
                      <WorkspaceTimeline
                        workspace={workspace}
                      />
                    )}

                    {activeTab === "ai" && (
                      <WorkspaceAISummary
                        workspace={workspace}
                        aiResult={aiResult}
                        aiLoading={aiLoading}
                        aiError={aiError}
                        aiStage={aiStage}
                      />
                    )}
                  </div>
                )}
            </>
          )}
        </div>

      {aiConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 px-5 backdrop-blur-[2px]">

          <div
            className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-insight-dialog-title"
          >

            <div className="border-b border-slate-200 px-6 py-5">

              <div className="flex items-start justify-between gap-5">

                <div className="flex items-start gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
                    <SparklesIcon className="h-4 w-4 text-slate-600" />
                  </div>

                  <div>

                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      External AI Analysis
                    </div>

                    <h3
                      id="ai-insight-dialog-title"
                      className="mt-1 text-base font-semibold tracking-tight text-slate-950"
                    >
                      Generate AI Insight
                    </h3>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() => setAiConfirmOpen(false)}
                  className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Close AI insight dialog"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>

              </div>

            </div>

            <div className="space-y-5 px-6 py-6">

              <p className="text-sm leading-6 text-slate-600">
                This analysis uses the configured external AI provider
                to interpret the compliance intelligence already
                calculated by the platform.
              </p>

              <div className="grid grid-cols-2 border border-slate-200 bg-slate-50">

                <div className="border-r border-slate-200 px-4 py-4">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Provider
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    OpenAI
                  </div>
                </div>

                <div className="px-4 py-4">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Model
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    gpt-4.1-mini
                  </div>
                </div>

              </div>

              <div className="border border-amber-200 bg-amber-50 px-4 py-4">

                <div className="flex gap-3">

                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                  <div>

                    <div className="text-xs font-semibold text-amber-900">
                      External AI usage
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-amber-800">
                      This request may consume AI credits.
                      Estimated usage is approximately{" "}
                      <span className="font-semibold">
                        {estimatedAITokens.toLocaleString()} tokens
                      </span>
                      .
                    </p>

                    <p className="mt-2 text-[10px] leading-5 text-amber-700">
                      Actual usage will be reported after the
                      OpenAI request completes.
                    </p>

                  </div>

                </div>

              </div>

              <div className="border border-slate-200 bg-white px-4 py-4">

                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  No external AI required
                </div>

                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Platform Intelligence remains available through
                  the Rule Engine and UEE without consuming
                  external AI credits.
                </p>

              </div>

            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={() => {
                  setAiConfirmOpen(false);
                  setActiveTab("ai");
                }}
                className="border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Use Platform Intelligence
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiConfirmOpen(false);
                  setAiStage("connecting");
                  generateAIInsight();
                }}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                Check External AI
              </button>

            </div>

          </div>

        </div>
      )}
      </aside>
    </Fragment>
  );
}
