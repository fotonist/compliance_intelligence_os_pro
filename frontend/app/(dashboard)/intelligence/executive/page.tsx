
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  Target,
  TriangleAlert,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type UeeSummary = {
  tenant_id?: number;
  computed_at?: string;
  unified_exposure_score?: number;
  compliance_health_index?: number;

  indices?: {
    risk_index?: number;
    coverage_index?: number;
    maturity_index?: number;
    evidence_index?: number;
    task_pressure_index?: number;
  };

  weights?: {
    risk?: number;
    coverage?: number;
    maturity?: number;
    evidence?: number;
    task_pressure?: number;
  };

  source_stats?: {
    risk?: {
      row_count?: number;
      avg_risk_score?: number;
      normalized_risk_exposure?: number;
    };
    evidence?: {
      total_files?: number;
      approved_files?: number;
      evidence_quality?: number;
      evidence_exposure?: number;
    };
    maturity?: {
      row_count?: number;
      source?: string;
    };
    coverage?: {
      total_controls?: number;
      covered_controls?: number;
      partial_controls?: number;
      uncovered_controls?: number;
      coverage_health?: number;
    };
    task_pressure?: {
      row_count?: number;
      open_count?: number;
      overdue_count?: number;
      open_ratio?: number;
      overdue_ratio?: number;
    };
    control_health?: number;
    raw_health?: number;
  };

  warnings?: string[];

  framework_context?: {
    active_framework_count?: number;
    control_based_count?: number;
    maturity_based_count?: number;
    has_control_based?: boolean;
    has_maturity_based?: boolean;
    adoptions?: Array<{
      adoption_id?: number;
      standard_id?: number;
      standard_version_id?: number;
      adoption_status?: string;
      applicability?: string;
      standard_code?: string;
      standard_type?: string;
    }>;
  };

  maturity_context?: {
    framework_count?: number;
    total_processes?: number;
    measured_processes?: number;
    calculated_processes?: number;
    unassessed_processes?: number;
    achieved_processes?: number;
    target_achievement_percentage?: number | null;
    assessment_coverage_percentage?: number;
    frameworks?: Array<{
      adoption_id?: number;
      standard_id?: number;
      standard_version_id?: number;
      standard_code?: string;
      assessment_id?: number | null;
      assessment_status?: string | null;
      total_processes?: number;
      measured_processes?: number;
      calculated_processes?: number;
      unassessed_processes?: number;
      achieved_processes?: number;
      partial_processes?: number;
      not_achieved_processes?: number;
      target_achievement_percentage?: number | null;
      assessment_coverage_percentage?: number;
    }>;
  };
};

type IntelligenceConfiguration = {
  id?: number;
  tenant_id?: number;
  model_name?: string;
  version?: number;
  status?: string;
  risk_weight?: number;
  coverage_weight?: number;
  maturity_weight?: number;
  evidence_weight?: number;
  task_pressure_weight?: number;
  effective_from?: string | null;
  change_reason?: string | null;
  created_by?: number | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

type RiskExposure = {
  tenant_id?: number;
  risk_id?: number;
  risk_version_id?: number;
  risk_score?: number;
  linked_evidence_count?: number;
  approved_evidence_count?: number;
  is_covered?: boolean;
  exposure_score?: number;
  evidence_quality?: number;
  density_factor?: number;
  pressure_factor?: number;
  velocity_factor?: number;
  escalation_probability_30d?: number;
  expected_score_delta?: number;
  unified_score?: number;
  control_id?: number | null;
  risk_level?: string | null;
  title?: string | null;
};

type MatrixKpi = {
  mode?: string;
  standard_id?: number;
  standard_version_id?: number;
  compliance_percentage?: number | null;
  controls?: {
    total?: number;
    covered?: number;
    partial?: number;
    not_covered?: number;
  };
};

type EvidenceSummary = {
  total?: number;
  by_assessment_type?: Record<string, number>;
  by_status?: Record<string, number>;
  by_framework?: Array<{
    standard_id?: number | null;
    standard_code?: string | null;
    assessment_type?: string;
    total?: number;
  }>;
};

type RiskSummary = {
  total?: number;
  open?: number;
  by_framework_type?: {
    control?: number;
    maturity?: number;
    unlinked?: number;
  };
  by_status?: Record<string, number>;
  by_level?: Record<string, number>;
  by_framework?: Array<{
    standard_id?: number;
    standard_code?: string;
    standard_type?: string;
    total?: number;
  }>;
};

type RemediationSummary = {
  total?: number;
  active?: number;
  overdue?: number;
  due_soon?: number;
  high_priority?: number;
  awaiting_review?: number;
  completed?: number;
};

type RemediationResponse = {
  summary?: RemediationSummary;
  items?: unknown[];
};

type LoadState = {
  uee: UeeSummary | null;
  configuration: IntelligenceConfiguration | null;
  configurationError: string | null;
  risks: RiskExposure[];
  riskError: string | null;
  controlKpis: MatrixKpi[];
  evidenceSummary: EvidenceSummary | null;
  riskSummary: RiskSummary | null;
  remediation: RemediationResponse | null;
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function healthFromExposure(value: number): number {
  return clamp(100 - clamp(value));
}

function scoreTone(value: number): string {
  if (value >= 85) return "text-emerald-700";
  if (value >= 70) return "text-cyan-700";
  if (value >= 50) return "text-amber-700";
  return "text-red-700";
}

function scoreBar(value: number): string {
  if (value >= 85) return "bg-emerald-500";
  if (value >= 70) return "bg-cyan-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function exposureTone(value: number): string {
  if (value <= 25) return "text-emerald-700";
  if (value <= 50) return "text-amber-700";
  return "text-red-700";
}

function severityClass(level?: string | null): string {
  const value = String(level || "").toLowerCase();

  if (value === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value === "high") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (value === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDate(value?: string): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ExecutiveIntelligencePage() {
  const [state, setState] = useState<LoadState>({
    uee: null,
    configuration: null,
    configurationError: null,
    risks: [],
    riskError: null,
    controlKpis: [],
    evidenceSummary: null,
    riskSummary: null,
    remediation: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customControlsCount, setCustomControlsCount] = useState(0);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const ueeResponse = await apiFetch("/uee/summary");

      if (!ueeResponse.ok) {
        throw new Error(
          `UEE summary failed (${ueeResponse.status}): ${await ueeResponse.text()}`
        );
      }

      const uee = (await ueeResponse.json()) as UeeSummary;

      const controlAdoptions =
        uee.framework_context?.adoptions?.filter(
          (adoption) =>
            String(adoption.standard_type || "").toUpperCase() ===
            "CONTROL_BASED"
        ) ?? [];

      const controlKpis: MatrixKpi[] = [];

      for (const adoption of controlAdoptions) {
        if (!adoption.standard_id) {
          continue;
        }

        const response = await apiFetch(
          `/matrix/kpi?standard_id=${adoption.standard_id}`
        );

        if (response.ok) {
          controlKpis.push(
            (await response.json()) as MatrixKpi
          );
        }
      }

      let evidenceSummary: EvidenceSummary | null = null;

      try {
        const response = await apiFetch("/evidences/summary");

        if (response.ok) {
          evidenceSummary =
            (await response.json()) as EvidenceSummary;
        }
      } catch {
        evidenceSummary = null;
      }

      let riskSummary: RiskSummary | null = null;

      try {
        const response = await apiFetch("/risks/summary");

        if (response.ok) {
          riskSummary =
            (await response.json()) as RiskSummary;
        }
      } catch {
        riskSummary = null;
      }

      let remediation: RemediationResponse | null = null;

      try {
        const response = await apiFetch("/company/remediation");

        if (response.ok) {
          remediation =
            (await response.json()) as RemediationResponse;
        } else {
          const remediationErrorBody = await response.text();

          console.error(
            "Remediation summary unavailable:",
            response.status,
            remediationErrorBody
          );
        }
      } catch (remediationError) {
        console.error(
          "Remediation summary request failed:",
          remediationError
        );

        remediation = null;
      }

      // Custom controls are tenant-defined controls and must remain
      // separate from the standard/canonical control coverage scope.
      try {
        const controlsResponse = await apiFetch("/controls");

        if (controlsResponse.ok) {
          const controlsPayload = await controlsResponse.json();
          const controlItems = Array.isArray(controlsPayload)
            ? controlsPayload
            : Array.isArray(controlsPayload?.items)
              ? controlsPayload.items
              : [];

          setCustomControlsCount(
            controlItems.filter(
              (control: any) =>
                String(control?.origin || "").toLowerCase() === "custom"
            ).length
          );
        }
      } catch (controlsError) {
        console.warn("Custom control count unavailable:", controlsError);
      }

      let configuration: IntelligenceConfiguration | null = null;
      let configurationError: string | null = null;

      try {
        const configurationResponse = await apiFetch(
          "/company/intelligence/configuration"
        );

        if (!configurationResponse.ok) {
          configurationError =
            `Intelligence configuration unavailable (${configurationResponse.status})`;
        } else {
          configuration =
            (await configurationResponse.json()) as IntelligenceConfiguration;
        }
      } catch (configurationErr: unknown) {
        configurationError =
          configurationErr instanceof Error
            ? configurationErr.message
            : "Intelligence configuration unavailable";
      }

      let risks: RiskExposure[] = [];
      let riskError: string | null = null;

      try {
        const riskResponse = await apiFetch(
          "/company/intelligence/risk-exposure?limit=10"
        );

        if (!riskResponse.ok) {
          riskError =
            `Risk exposure unavailable (${riskResponse.status})`;
        } else {
          const result = await riskResponse.json();
          risks = Array.isArray(result) ? result : [];
        }
      } catch (riskErr: unknown) {
        riskError =
          riskErr instanceof Error
            ? riskErr.message
            : "Risk exposure unavailable";
      }

      setState({
        uee,
        configuration,
        configurationError,
        risks,
        riskError,
        controlKpis,
        evidenceSummary,
        riskSummary,
        remediation,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Executive Intelligence."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uee = state.uee;

  const exposure = clamp(
    num(uee?.unified_exposure_score)
  );

  const complianceHealth = clamp(
    num(uee?.compliance_health_index)
  );

  const riskExposure = clamp(
    num(uee?.indices?.risk_index)
  );

  const coverageExposure = clamp(
    num(uee?.indices?.coverage_index)
  );

  const evidenceExposure = clamp(
    num(uee?.indices?.evidence_index)
  );

  const taskExposure = clamp(
    num(uee?.indices?.task_pressure_index)
  );

  const riskHealth = healthFromExposure(riskExposure);
  const coverageHealth = healthFromExposure(coverageExposure);
  const evidenceHealth = healthFromExposure(evidenceExposure);
  const taskHealth = healthFromExposure(taskExposure);

  const frameworkContext = uee?.framework_context;
  const maturityContext = uee?.maturity_context;

  const activeFrameworks = num(
    frameworkContext?.active_framework_count
  );

  const controlFrameworks = num(
    frameworkContext?.control_based_count
  );

  const maturityFrameworks = num(
    frameworkContext?.maturity_based_count
  );

  const maturityTotalProcesses = num(
    maturityContext?.total_processes
  );

  const maturityCalculatedProcesses = num(
    maturityContext?.calculated_processes
  );

  const maturityUnassessedProcesses = num(
    maturityContext?.unassessed_processes
  );

  const maturityTargetAchievement =
    maturityContext?.target_achievement_percentage == null
      ? null
      : clamp(num(maturityContext.target_achievement_percentage));

  const maturityAssessmentCoverage = clamp(
    num(maturityContext?.assessment_coverage_percentage)
  );


  const primaryControlKpi =
    state.controlKpis.length > 0
      ? state.controlKpis[0]
      : null;

  const controlCompliance =
    primaryControlKpi?.compliance_percentage == null
      ? null
      : clamp(num(primaryControlKpi.compliance_percentage));

  const canonicalTotalControls = num(
    primaryControlKpi?.controls?.total
  );

  const canonicalCoveredControls = num(
    primaryControlKpi?.controls?.covered
  );

  const canonicalPartialControls = num(
    primaryControlKpi?.controls?.partial
  );

  const canonicalNotCoveredControls = num(
    primaryControlKpi?.controls?.not_covered
  );

  const enterpriseEvidenceTotal = num(
    state.evidenceSummary?.total
  );

  const enterpriseEvidenceUploaded = num(
    state.evidenceSummary?.by_status?.uploaded
  );

  const enterpriseEvidenceDraft = num(
    state.evidenceSummary?.by_status?.draft
  );

  const enterpriseRiskTotal = num(
    state.riskSummary?.total
  );

  const enterpriseOpenRisks = num(
    state.riskSummary?.open
  );

  const enterpriseControlRisks = num(
    state.riskSummary?.by_framework_type?.control
  );

  const enterpriseMaturityRisks = num(
    state.riskSummary?.by_framework_type?.maturity
  );

  const remediationTotal = num(
    state.remediation?.summary?.total
  );

  const remediationActive = num(
    state.remediation?.summary?.active
  );

  const remediationOverdue = num(
    state.remediation?.summary?.overdue
  );

  const remediationAwaitingReview = num(
    state.remediation?.summary?.awaiting_review
  );

  const stats = uee?.source_stats;

  const riskCount = num(
    stats?.risk?.row_count
  );

  const criticalRisks = state.risks.filter(
    (r) =>
      String(r.risk_level || "").toLowerCase() ===
      "critical"
  ).length;

  const highRisks = state.risks.filter(
    (r) =>
      String(r.risk_level || "").toLowerCase() ===
      "high"
  ).length;

  const maturityExposureAvailable =
    !(uee?.warnings || []).includes(
      "maturity:exposure_not_available"
    );

  const executiveModelWarnings = (uee?.warnings || []).filter(
    (warning) =>
      warning !== "maturity:exposure_not_available"
  );

  const executiveSignals = useMemo(() => {
    const signals: Array<{
      severity: "Critical" | "High" | "Medium";
      title: string;
      description: string;
    }> = [];

    if (criticalRisks > 0) {
      signals.push({
        severity: "Critical",
        title: "Critical risk exposure",
        description:
          `${criticalRisks} critical risk(s) are present in the current exposure set.`,
      });
    }

    if (canonicalNotCoveredControls > 0) {
      signals.push({
        severity: "High",
        title: "Control coverage deficiency",
        description:
          `${canonicalNotCoveredControls} of ${canonicalTotalControls} canonical control(s) are currently not covered.`,
      });
    }

    if (remediationOverdue > 0) {
      signals.push({
        severity: "High",
        title: "Overdue remediation",
        description:
          `${remediationOverdue} active remediation item(s) are overdue.`,
      });
    }

    if (remediationAwaitingReview > 0) {
      signals.push({
        severity: "Medium",
        title: "Remediation awaiting review",
        description:
          `${remediationAwaitingReview} remediation item(s) are awaiting review.`,
      });
    }

    if (enterpriseEvidenceDraft > 0) {
      signals.push({
        severity: "Medium",
        title: "Draft evidence backlog",
        description:
          `${enterpriseEvidenceDraft} evidence item(s) remain in draft status.`,
      });
    }

    if (signals.length === 0) {
      signals.push({
        severity: "Medium",
        title: "No material escalation signal",
        description:
          "No additional executive signal was identified from the current canonical enterprise data.",
      });
    }

    return signals;
  }, [
    criticalRisks,
    canonicalNotCoveredControls,
    canonicalTotalControls,
    remediationOverdue,
    remediationAwaitingReview,
    enterpriseEvidenceDraft,
  ]);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-8">
        <div className="mx-auto max-w-[1600px] space-y-5">
          <Skeleton className="h-24" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !uee) {
    return (
      <div className="min-h-full bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-7 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <TriangleAlert className="h-5 w-5" />
            </div>

            <div>
              <h1 className="font-semibold text-slate-900">
                Executive Intelligence unavailable
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                The canonical UEE summary could not be loaded.
              </p>

              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error || "No UEE response received."}
              </div>

              <button
                type="button"
                onClick={() => void load(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">

        <header className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50">
              <BrainCircuit className="h-6 w-6 text-cyan-700" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Executive Intelligence
                </h1>


              </div>

              <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
                Framework-aware executive view of enterprise exposure,
                control-based compliance, maturity posture, evidence
                strength and execution pressure.
              </p>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                <span>
                  Calculated:{" "}
                  <span className="font-medium text-slate-600">
                    {formatDate(uee.computed_at)}
                  </span>
                </span>

                <span>
                  Tenant:{" "}
                  <span className="font-semibold text-slate-600">
                    {uee.tenant_id ?? "—"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            {refreshing
              ? "Refreshing..."
              : "Refresh Intelligence"}
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

          <MetricCard
            label="Enterprise Exposure"
            value={exposure.toFixed(2)}
            description="Tenant-wide weighted exposure across active UEE components"
            icon={<AlertTriangle className="h-5 w-5" />}
            tone={exposureTone(exposure)}
          />

          <MetricCard
            label="Active Frameworks"
            value={String(activeFrameworks)}
            icon={<BrainCircuit className="h-5 w-5" />}
            tone="text-slate-800"
          />

          <MetricCard
            label="Control-Based"
            value={String(controlFrameworks)}
            icon={<Target className="h-5 w-5" />}
            tone="text-cyan-700"
          />

          <MetricCard
            label="Maturity-Based"
            value={String(maturityFrameworks)}
            icon={<Activity className="h-5 w-5" />}
            tone="text-violet-700"
          />

          <MetricCard
            label="Remediation Pressure"
            value={`${taskExposure.toFixed(1)}`}
            icon={<Clock3 className="h-5 w-5" />}
            tone={exposureTone(taskExposure)}
          />

        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">

          <Panel
            title="UEE Exposure Profile"
            subtitle="All component values originate from the canonical Unified Exposure Engine."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

              <Component
                label="Risk"
                health={riskHealth}
                exposure={riskExposure}

                primaryMetricLabel="Open risks"
                primaryMetricValue={enterpriseOpenRisks}
                secondaryMetricLabel="Critical / High"
                secondaryMetricValue={`${criticalRisks} / ${highRisks}`}
              />

              <Component
                label="Coverage"
                health={coverageHealth}
                exposure={coverageExposure}

                primaryMetricLabel="Covered controls"
                primaryMetricValue={`${canonicalCoveredControls} / ${canonicalTotalControls}`}
                secondaryMetricLabel="Not covered"
                secondaryMetricValue={canonicalNotCoveredControls}
              />

              <Component
                label="Evidence"
                health={evidenceHealth}
                exposure={evidenceExposure}

                primaryMetricLabel="Uploaded"
                primaryMetricValue={`${enterpriseEvidenceUploaded} / ${enterpriseEvidenceTotal}`}
                secondaryMetricLabel="Draft"
                secondaryMetricValue={enterpriseEvidenceDraft}
              />

              <Component
                label="Task Pressure"
                health={taskHealth}
                exposure={taskExposure}

                primaryMetricLabel="Active"
                primaryMetricValue={`${remediationActive} / ${remediationTotal}`}
                secondaryMetricLabel="Overdue"
                secondaryMetricValue={remediationOverdue}
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">
                  Maturity Assessment
                </div>

                <div className="mt-3 text-lg font-bold text-slate-900">
                  {maturityTargetAchievement == null
                    ? "N/A"
                    : `${maturityTargetAchievement.toFixed(1)}%`}
                </div>

                <div className="mt-1 text-[11px] text-slate-400">
                  Target achievement
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Assessment coverage
                    </span>
                    <span className="font-semibold text-slate-700">
                      {maturityAssessmentCoverage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-500">
                      UEE exposure contribution
                    </span>

                    <span
                      className={
                        maturityExposureAvailable
                          ? "font-semibold text-slate-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {maturityExposureAvailable
                        ? "Available"
                        : "Not available"}
                    </span>
                  </div>

                  {!maturityExposureAvailable ? (
                    <div className="mt-1 text-[10px] leading-4 text-slate-400">
                      No approved maturity-to-exposure transformation is defined.
                    </div>
                  ) : null}
                </div>
              </div>

            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="grid gap-3 text-xs text-slate-500 md:grid-cols-5">
                <Weight
                  label="Risk"
                  value={num(uee.weights?.risk)}
                />

                <Weight
                  label="Coverage"
                  value={num(uee.weights?.coverage)}
                />

                <Weight
                  label="Maturity"
                  value={num(uee.weights?.maturity)}
                />

                <Weight
                  label="Evidence"
                  value={num(uee.weights?.evidence)}
                />

                <Weight
                  label="Task Pressure"
                  value={num(uee.weights?.task_pressure)}
                />
              </div>
            </div>
          </Panel>

          <Panel
            title="Executive Decision Signals"
            subtitle="Signals derived from current UEE source data."
          >
            <div className="space-y-3">
              {executiveSignals.map((signal, index) => (
                <Signal
                  key={`${signal.title}-${index}`}
                  severity={signal.severity}
                  title={signal.title}
                  description={signal.description}
                />
              ))}
            </div>

            {executiveModelWarnings.length ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="font-semibold">
                  Model warnings
                </div>

                <div className="mt-1">
                  {executiveModelWarnings.join(" / ")}
                </div>
              </div>
            ) : null}
          </Panel>

        </section>

        <section className="mt-6">
          <Panel
            title="Framework Posture"
            subtitle="Framework-specific posture is preserved according to each active framework's canonical assessment model."
          >
            <div className="grid gap-5 xl:grid-cols-2">

              {frameworkContext?.adoptions
                ?.filter(
                  (adoption) =>
                    String(adoption.standard_type || "").toUpperCase() ===
                    "CONTROL_BASED"
                )
                .map((adoption) => {
                  const kpi = state.controlKpis.find(
                    (item) =>
                      item.standard_id === adoption.standard_id
                  );

                  const compliance =
                    kpi?.compliance_percentage == null
                      ? null
                      : clamp(num(kpi.compliance_percentage));

                  const total = num(kpi?.controls?.total);
                  const covered = num(kpi?.controls?.covered);
                  const partial = num(kpi?.controls?.partial);
                  const notCovered = num(
                    kpi?.controls?.not_covered
                  );

                  return (
                    <div
                      key={`control-${adoption.adoption_id}`}
                      className="rounded-2xl border border-cyan-200 bg-cyan-50/30 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                            Control-Based
                          </div>

                          <h3 className="mt-1 text-lg font-bold text-slate-900">
                            {adoption.standard_code || "Control Framework"}
                          </h3>

                          <div className="mt-1 text-xs text-slate-400">
                            Version ID {adoption.standard_version_id ?? "N/A"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-cyan-200 bg-white px-4 py-3 text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Compliance
                          </div>

                          <div
                            className={`mt-1 text-2xl font-bold ${
                              compliance == null
                                ? "text-slate-400"
                                : scoreTone(compliance)
                            }`}
                          >
                            {compliance == null
                              ? "N/A"
                              : `${compliance.toFixed(1)}%`}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <FrameworkMetric
                          label="Controls"
                          value={total}
                        />

                        <FrameworkMetric
                          label="Covered"
                          value={covered}
                          tone="success"
                        />

                        <FrameworkMetric
                          label="Partial"
                          value={partial}
                          tone={partial > 0 ? "warning" : "default"}
                        />

                        <FrameworkMetric
                          label="Not Covered"
                          value={notCovered}
                          tone={notCovered > 0 ? "danger" : "success"}
                        />
                      </div>

                      {compliance != null ? (
                        <div className="mt-5">
                          <Progress
                            label="Control compliance"
                            value={compliance}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}

              {maturityContext?.frameworks?.map((framework) => {
                const achievement =
                  framework.target_achievement_percentage == null
                    ? null
                    : clamp(
                        num(
                          framework.target_achievement_percentage
                        )
                      );

                const assessmentCoverage = clamp(
                  num(
                    framework.assessment_coverage_percentage
                  )
                );

                return (
                  <div
                    key={`maturity-${framework.adoption_id}`}
                    className="rounded-2xl border border-violet-200 bg-violet-50/30 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                          Maturity-Based
                        </div>

                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {framework.standard_code || "Maturity Framework"}
                        </h3>

                        <div className="mt-1 text-xs text-slate-400">
                          Assessment #{framework.assessment_id ?? "N/A"}
                          {" ? "}
                          {framework.assessment_status || "Unknown"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Target Achievement
                        </div>

                        <div
                          className={`mt-1 text-2xl font-bold ${
                            achievement == null
                              ? "text-slate-400"
                              : scoreTone(achievement)
                          }`}
                        >
                          {achievement == null
                            ? "N/A"
                            : `${achievement.toFixed(1)}%`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <FrameworkMetric
                        label="Processes"
                        value={num(framework.total_processes)}
                      />

                      <FrameworkMetric
                        label="Measured"
                        value={num(framework.measured_processes)}
                      />

                      <FrameworkMetric
                        label="Calculated"
                        value={num(framework.calculated_processes)}
                        tone="success"
                      />

                      <FrameworkMetric
                        label="Unassessed"
                        value={num(framework.unassessed_processes)}
                        tone={
                          num(framework.unassessed_processes) > 0
                            ? "warning"
                            : "success"
                        }
                      />
                    </div>

                    <div className="mt-5">
                      <Progress
                        label="Assessment coverage"
                        value={assessmentCoverage}
                      />
                    </div>

                    <div className="mt-3 text-[11px] leading-5 text-slate-500">
                      Target Achievement is calculated only from
                      processes with a calculated capability result.
                      Assessment Coverage represents measured
                      in-scope processes.
                    </div>
                  </div>
                );
              })}

            </div>
          </Panel>
        </section>

        <section className="mt-6">
          <Panel
            title="Enterprise Operations"
            subtitle="Tenant-wide risk, evidence and remediation position. These measures are not combined with framework-specific posture scores."
          >
            <div className="grid gap-5 lg:grid-cols-3">

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                    <ShieldAlert className="h-5 w-5 text-orange-600" />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Risk
                    </div>
                    <div className="text-xs text-slate-400">
                      Enterprise risk inventory
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-1">
                  <Row
                    label="Total risks"
                    value={enterpriseRiskTotal}
                  />
                  <Row
                    label="Open"
                    value={enterpriseOpenRisks}
                    tone={
                      enterpriseOpenRisks > 0
                        ? "warning"
                        : "success"
                    }
                  />
                  <Row
                    label="Control-based"
                    value={enterpriseControlRisks}
                  />
                  <Row
                    label="Maturity-based"
                    value={enterpriseMaturityRisks}
                  />
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      UEE risk exposure
                    </span>
                    <span className={`font-bold ${exposureTone(riskExposure)}`}>
                      {riskExposure.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                    <FileCheck2 className="h-5 w-5 text-emerald-600" />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Evidence
                    </div>
                    <div className="text-xs text-slate-400">
                      Enterprise evidence inventory
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-1">
                  <Row
                    label="Total evidence"
                    value={enterpriseEvidenceTotal}
                  />
                  <Row
                    label="Control-based"
                    value={num(
                      state.evidenceSummary?.by_assessment_type?.control
                    )}
                  />
                  <Row
                    label="Maturity-based"
                    value={num(
                      state.evidenceSummary?.by_assessment_type?.maturity
                    )}
                  />
                  <Row
                    label="Uploaded"
                    value={enterpriseEvidenceUploaded}
                  />
                  <Row
                    label="Draft"
                    value={enterpriseEvidenceDraft}
                  />
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      UEE evidence exposure
                    </span>
                    <span className={`font-bold ${exposureTone(evidenceExposure)}`}>
                      {evidenceExposure.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                    <Clock3 className="h-5 w-5 text-amber-600" />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Remediation
                    </div>
                    <div className="text-xs text-slate-400">
                      Canonical remediation workload
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-1">
                  <Row
                    label="Total"
                    value={remediationTotal}
                  />
                  <Row
                    label="Active"
                    value={remediationActive}
                    tone={
                      remediationActive > 0
                        ? "warning"
                        : "success"
                    }
                  />
                  <Row
                    label="Overdue"
                    value={remediationOverdue}
                    tone={
                      remediationOverdue > 0
                        ? "danger"
                        : "success"
                    }
                  />
                  <Row
                    label="Awaiting review"
                    value={remediationAwaitingReview}
                  />
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      UEE task pressure
                    </span>
                    <span className={`font-bold ${exposureTone(taskExposure)}`}>
                      {taskExposure.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </Panel>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">

          <Panel
            title="Top Risk Exposure"
            subtitle="Direct output from the Exposure Engine."
          >
            {state.risks.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[1fr_100px_100px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Risk</span>
                  <span>Level</span>
                  <span className="text-right">
                    Unified
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {state.risks.map((risk) => (
                    <div
                      key={risk.risk_id}
                      className="grid grid-cols-[1fr_100px_100px] items-center gap-3 px-4 py-4"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {risk.title ||
                            `Risk #${risk.risk_id}`}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Inherent{" "}
                          {num(
                            risk.risk_score
                          ).toFixed(1)}
                          {" · "}
                          Residual{" "}
                          {num(
                            risk.exposure_score
                          ).toFixed(1)}
                          {" · "}
                          Evidence{" "}
                          {num(
                            risk.approved_evidence_count
                          )}
                          /
                          {num(
                            risk.linked_evidence_count
                          )}
                        </div>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${severityClass(
                          risk.risk_level
                        )}`}
                      >
                        {risk.risk_level ||
                          "Unknown"}
                      </span>

                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {num(
                            risk.unified_score
                          ).toFixed(2)}
                        </div>

                        <div className="text-[10px] text-slate-400">
                          exposure
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Empty
                icon={
                  <ShieldAlert className="h-5 w-5" />
                }
                text="No risk exposure records returned."
              />
            )}

            {state.riskError ? (
              <div className="mt-3 text-xs text-amber-700">
                Risk detail endpoint: {state.riskError}
              </div>
            ) : null}
          </Panel>



        </section>

        <footer className="mt-7 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Executive Intelligence · Compliance Intelligence OS
          </span>

          <span>
            Canonical UEE
          </span>
        </footer>

      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
  progress,
  description,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
  progress?: number;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <span className={tone}>{icon}</span>
        {label}
      </div>

      <div className={`mt-4 text-3xl font-bold ${tone}`}>
        {value}
      </div>

      {progress !== undefined ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${scoreBar(progress)}`}
            style={{
              width: `${clamp(progress)}%`,
            }}
          />
        </div>
      ) : description ? (
        <div className="mt-4 text-[11px] leading-4 text-slate-400">
          {description}
        </div>
      ) : null}
    </div>
  );
}

function Component({
  label,
  health,
  exposure,
  primaryMetricLabel,
  primaryMetricValue,
  secondaryMetricLabel,
  secondaryMetricValue,
}: {
  label: string;
  health: number;
  exposure: number;
  primaryMetricLabel: string;
  primaryMetricValue: string | number;
  secondaryMetricLabel: string;
  secondaryMetricValue: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">
        {label}
      </div>

      <div
        className={`mt-2 text-xl font-bold ${scoreTone(
          health
        )}`}
      >
        {health.toFixed(1)}%
      </div>

      <div className="mt-1 text-[11px] text-slate-400">
        Exposure {exposure.toFixed(1)}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-slate-500">
            {primaryMetricLabel}
          </span>
          <span className="font-semibold text-slate-700">
            {primaryMetricValue}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-slate-500">
            {secondaryMetricLabel}
          </span>
          <span className="font-semibold text-slate-700">
            {secondaryMetricValue}
          </span>
        </div>
      </div>
    </div>
  );
}

function Weight({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span>{label}</span>
      <span className="font-bold text-slate-700">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-900">
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function PosturePanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
          {icon}
        </div>

        <h2 className="text-base font-bold text-slate-900">
          {title}
        </h2>
      </div>

      {children}
    </section>
  );
}

function FrameworkMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className={`mt-1 text-xl font-bold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";

  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className={`text-sm font-bold ${color}`}>
        {value}
      </span>
    </div>
  );
}

function Progress({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          {label}
        </span>

        <span className="text-xs font-bold text-slate-700">
          {value.toFixed(1)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${scoreBar(
            value
          )}`}
          style={{
            width: `${clamp(value)}%`,
          }}
        />
      </div>
    </div>
  );
}

function Signal({
  severity,
  title,
  description,
}: {
  severity: "Critical" | "High" | "Medium";
  title: string;
  description: string;
}) {
  const classes =
    severity === "Critical"
      ? "border-red-200 bg-red-50 text-red-800"
      : severity === "High"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`rounded-xl border p-4 ${classes}`}>
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider">
            {severity}
          </div>

          <div className="mt-1 text-sm font-bold">
            {title}
          </div>

          <p className="mt-1 text-xs leading-5">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon}
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-bold ${
          danger
            ? "text-red-700"
            : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Empty({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
      <div className="text-center">
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
          {icon}
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

function Skeleton({
  className,
}: {
  className: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-slate-200 ${className}`}
    />
  );
}
