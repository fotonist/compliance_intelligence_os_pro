
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
    risk?: number;
    coverage?: number;
    maturity?: number;
    evidence?: number;
    task_pressure?: number;
  };

  exposure_indices?: {
    risk?: number;
    coverage?: number;
    maturity?: number;
    evidence?: number;
    task_pressure?: number;
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

type LoadState = {
  uee: UeeSummary | null;
  configuration: IntelligenceConfiguration | null;
  configurationError: string | null;
  risks: RiskExposure[];
  riskError: string | null;
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

function maturityLabel(exposure: number): {
  value: string;
  detail: string;
  tone: string;
} {
  if (exposure <= 0) {
    return {
      value: "Not Assessed",
      detail: "No active maturity assessment",
      tone: "text-slate-500",
    };
  }

  const health = healthFromExposure(exposure);

  return {
    value: `${health.toFixed(1)}%`,
    detail: `Exposure ${exposure.toFixed(1)}`,
    tone: scoreTone(health),
  };
}

export default function ExecutiveIntelligencePage() {
  const [state, setState] = useState<LoadState>({
    uee: null,
    configuration: null,
    configurationError: null,
    risks: [],
    riskError: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const ueeResponse = await apiFetch("/kpi/summary");

      if (!ueeResponse.ok) {
        throw new Error(
          `UEE summary failed (${ueeResponse.status}): ${await ueeResponse.text()}`
        );
      }

      const uee = (await ueeResponse.json()) as UeeSummary;

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
    num(
      uee?.exposure_indices?.risk ??
        uee?.source_stats?.risk?.normalized_risk_exposure
    )
  );

  const coverageExposure = clamp(
    num(
      uee?.exposure_indices?.coverage ??
        100 -
          num(
            uee?.source_stats?.coverage?.coverage_health
          )
    )
  );

  const evidenceExposure = clamp(
    num(
      uee?.exposure_indices?.evidence ??
        uee?.source_stats?.evidence?.evidence_exposure
    )
  );

  const maturityExposure = clamp(
    num(uee?.exposure_indices?.maturity)
  );

  const taskExposure = clamp(
    num(uee?.exposure_indices?.task_pressure)
  );

  const riskHealth = healthFromExposure(riskExposure);
  const coverageHealth = healthFromExposure(coverageExposure);
  const evidenceHealth = healthFromExposure(evidenceExposure);
  const taskHealth = healthFromExposure(taskExposure);

  const maturity = maturityLabel(maturityExposure);

  const stats = uee?.source_stats;

  const totalControls = num(
    stats?.coverage?.total_controls
  );

  const coveredControls = num(
    stats?.coverage?.covered_controls
  );

  const partialControls = num(
    stats?.coverage?.partial_controls
  );

  const uncoveredControls = num(
    stats?.coverage?.uncovered_controls
  );

  const totalEvidence = num(
    stats?.evidence?.total_files
  );

  const approvedEvidence = num(
    stats?.evidence?.approved_files
  );

  const openTasks = num(
    stats?.task_pressure?.open_count
  );

  const overdueTasks = num(
    stats?.task_pressure?.overdue_count
  );

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

    if (uncoveredControls > 0) {
      signals.push({
        severity: "High",
        title: "Control coverage deficiency",
        description:
          `${uncoveredControls} of ${totalControls} controls are currently uncovered.`,
      });
    }

    if (overdueTasks > 0) {
      signals.push({
        severity: "High",
        title: "Execution pressure",
        description:
          `${overdueTasks} open task(s) are overdue.`,
      });
    }

    if (
      approvedEvidence < totalEvidence &&
      totalEvidence > 0
    ) {
      signals.push({
        severity: "Medium",
        title: "Evidence approval backlog",
        description:
          `${totalEvidence - approvedEvidence} evidence file(s) are not approved.`,
      });
    }

    if (signals.length === 0) {
      signals.push({
        severity: "Medium",
        title: "No material escalation signal",
        description:
          "No additional executive signal was identified from the current UEE source data.",
      });
    }

    return signals;
  }, [
    criticalRisks,
    uncoveredControls,
    totalControls,
    overdueTasks,
    approvedEvidence,
    totalEvidence,
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

                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    complianceHealth >= 75
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : complianceHealth >= 50
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {complianceHealth >= 75
                    ? "Healthy"
                    : complianceHealth >= 50
                      ? "Watch"
                      : "Critical"}
                </span>
              </div>

              <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
                Canonical enterprise view of compliance health,
                exposure, control coverage, evidence strength and
                execution pressure.
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
            label="Compliance Health"
            value={`${complianceHealth.toFixed(2)}%`}
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
            tone={scoreTone(complianceHealth)}
            progress={complianceHealth}
          />

          <MetricCard
            label="Unified Exposure"
            value={exposure.toFixed(2)}
            icon={
              <AlertTriangle className="h-5 w-5" />
            }
            tone={exposureTone(exposure)}
          />

          <MetricCard
            label="Risk Health"
            value={`${riskHealth.toFixed(1)}%`}
            icon={
              <ShieldAlert className="h-5 w-5" />
            }
            tone={scoreTone(riskHealth)}
            progress={riskHealth}
          />

          <MetricCard
            label="Coverage Health"
            value={`${coverageHealth.toFixed(2)}%`}
            icon={<Target className="h-5 w-5" />}
            tone={scoreTone(coverageHealth)}
            progress={coverageHealth}
          />

          <MetricCard
            label="Evidence Health"
            value={`${evidenceHealth.toFixed(1)}%`}
            icon={
              <FileCheck2 className="h-5 w-5" />
            }
            tone={scoreTone(evidenceHealth)}
            progress={evidenceHealth}
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
              />

              <Component
                label="Coverage"
                health={coverageHealth}
                exposure={coverageExposure}
              />

              <Component
                label="Evidence"
                health={evidenceHealth}
                exposure={evidenceExposure}
              />

              <Component
                label="Task Pressure"
                health={taskHealth}
                exposure={taskExposure}
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">
                  Maturity
                </div>

                <div
                  className={`mt-3 text-lg font-bold ${maturity.tone}`}
                >
                  {maturity.value}
                </div>

                <div className="mt-1 text-[11px] text-slate-400">
                  {maturity.detail}
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

            {uee.warnings?.length ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="font-semibold">
                  Model warnings
                </div>

                <div className="mt-1">
                  {uee.warnings.join(" · ")}
                </div>
              </div>
            ) : null}
          </Panel>

        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-3">

          <PosturePanel
            title="Control Posture"
            icon={
              <Target className="h-5 w-5 text-cyan-700" />
            }
          >
            <Row
              label="Total Controls"
              value={totalControls}
            />

            <Row
              label="Covered"
              value={coveredControls}
              tone="success"
            />

            <Row
              label="Partial"
              value={partialControls}
              tone={
                partialControls > 0
                  ? "warning"
                  : "default"
              }
            />

            <Row
              label="Uncovered"
              value={uncoveredControls}
              tone={
                uncoveredControls > 0
                  ? "danger"
                  : "success"
              }
            />

            <div className="mt-4">
              <Progress
                label="Coverage health"
                value={coverageHealth}
              />
            </div>
          </PosturePanel>

          <PosturePanel
            title="Risk Posture"
            icon={
              <ShieldAlert className="h-5 w-5 text-orange-600" />
            }
          >
            <Row
              label="Risk records"
              value={riskCount}
            />

            <Row
              label="Critical in exposure set"
              value={criticalRisks}
              tone={
                criticalRisks > 0
                  ? "danger"
                  : "success"
              }
            />

            <Row
              label="High in exposure set"
              value={highRisks}
              tone={
                highRisks > 0
                  ? "warning"
                  : "default"
              }
            />

            <Row
              label="Average risk score"
              value={num(
                stats?.risk?.avg_risk_score
              ).toFixed(1)}
            />

            <Row
              label="Risk exposure"
              value={riskExposure.toFixed(1)}
            />
          </PosturePanel>

          <PosturePanel
            title="Evidence & Execution"
            icon={
              <FileCheck2 className="h-5 w-5 text-emerald-600" />
            }
          >
            <Row
              label="Evidence files"
              value={totalEvidence}
            />

            <Row
              label="Approved"
              value={approvedEvidence}
              tone="success"
            />

            <Row
              label="Open tasks"
              value={openTasks}
            />

            <Row
              label="Overdue tasks"
              value={overdueTasks}
              tone={
                overdueTasks > 0
                  ? "danger"
                  : "success"
              }
            />

            <Row
              label="Evidence quality"
              value={`${num(
                stats?.evidence?.evidence_quality
              ).toFixed(1)}%`}
            />
          </PosturePanel>

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

          <Panel
            title="Operational Pressure"
            subtitle="Current evidence and task pressure contributing to UEE."
          >
            <div className="grid gap-3 sm:grid-cols-2">

              <MiniMetric
                label="Open Tasks"
                value={openTasks}
                icon={
                  <Clock3 className="h-4 w-4" />
                }
              />

              <MiniMetric
                label="Overdue"
                value={overdueTasks}
                icon={
                  <TriangleAlert className="h-4 w-4" />
                }
                danger={overdueTasks > 0}
              />

              <MiniMetric
                label="Evidence Files"
                value={totalEvidence}
                icon={
                  <FileCheck2 className="h-4 w-4" />
                }
              />

              <MiniMetric
                label="Approved"
                value={approvedEvidence}
                icon={
                  <CheckCircle2 className="h-4 w-4" />
                }
              />
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <Progress
                label="Task health"
                value={taskHealth}
              />

              <div className="mt-4">
                <Progress
                  label="Evidence health"
                  value={evidenceHealth}
                />
              </div>
            </div>
          </Panel>

        </section>

        <footer className="mt-7 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Executive Intelligence · Compliance Intelligence OS
          </span>

          <span>
            Canonical UEE · tenant {uee.tenant_id ?? "—"}
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
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
  progress?: number;
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
      ) : (
        <div className="mt-4 text-[11px] text-slate-400">
          Canonical UEE value
        </div>
      )}
    </div>
  );
}

function Component({
  label,
  health,
  exposure,
}: {
  label: string;
  health: number;
  exposure: number;
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

