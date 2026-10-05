"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  FileText,
  Files,
  Gauge,
  Layers3,
  ShieldCheck,
  Target,
  Workflow,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type DashboardData = {
  policy_summary: {
    total: number;
    draft: number;
    under_review: number;
    approved: number;
    expired: number;
    archived: number;
  };
  procedure_summary: {
    total: number;
    draft: number;
    under_review: number;
    approved: number;
    archived: number;
  };
  document_summary: {
    total: number;
    current: number;
    archived: number;
    approved: number;
    rejected: number;
  };
  upcoming_reviews: {
    id: number;
    title: string;
    review_date: string | null;
  }[];
  health_score: {
    governance: number;
    document: number;
    policy: number;
    review: number;
    approval: number;
  };
  document_health: {
    score: number;
    current: number;
    approved: number;
    rejected: number;
    archived: number;
  };
  attention_items: {
    severity: string;
    title: string;
    message: string;
  }[];
  activity_summary: {
    id: number;
    action: string;
    status: string | null;
    document: string | null;
    version: string | null;
    performed_by: string;
    created_at: string;
  }[];
};

type Standard = {
  id: number;
  code: string;
  name?: string | null;
  type?: string | null;
};

type Adoption = {
  id?: number;
  standard_id: number;
  standard_version_id?: number | null;
  status?: string | null;
};

type MatrixKpi = {
  mode?: string;
  compliance_percentage?: number | null;
  target_achievement_percentage?: number | null;
  assessment_coverage_percentage?: number | null;
  controls?: {
    total?: number;
    covered?: number;
    partial?: number;
    not_covered?: number;
  };
  maturity?: {
    total?: number;
    measured?: number;
    calculated?: number;
    unassessed?: number;
    achieved?: number;
    partial?: number;
    not_achieved?: number;
  };
};

type FrameworkPosture = {
  standard: Standard;
  kpi: MatrixKpi | null;
};

type EvidenceSummary = {
  total?: number;
  by_assessment_type?: {
    control?: number;
    maturity?: number;
  };
};

type RiskSummary = {
  total?: number;
  open?: number;
  by_framework_type?: {
    control?: number;
    maturity?: number;
    unlinked?: number;
  };
  by_level?: Record<string, number>;
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
};

const emptyDashboard: DashboardData = {
  policy_summary: {
    total: 0,
    draft: 0,
    under_review: 0,
    approved: 0,
    expired: 0,
    archived: 0,
  },
  procedure_summary: {
    total: 0,
    draft: 0,
    under_review: 0,
    approved: 0,
    archived: 0,
  },
  document_summary: {
    total: 0,
    current: 0,
    archived: 0,
    approved: 0,
    rejected: 0,
  },
  upcoming_reviews: [],
  health_score: {
    governance: 0,
    document: 0,
    policy: 0,
    review: 0,
    approval: 0,
  },
  document_health: {
    score: 0,
    current: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
  },
  attention_items: [],
  activity_summary: [],
};

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown[] }).items)
  ) {
    return (value as { items: T[] }).items;
  }

  return [];
}

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : "N/A";
}

async function readJson<T>(
  url: string,
  fallback: T
): Promise<T> {
  try {
    const response = await apiFetch(url);

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export default function GovernanceDashboardPage() {
  const [dashboard, setDashboard] =
    useState<DashboardData>(emptyDashboard);

  const [frameworks, setFrameworks] =
    useState<FrameworkPosture[]>([]);

  const [evidenceSummary, setEvidenceSummary] =
    useState<EvidenceSummary | null>(null);

  const [riskSummary, setRiskSummary] =
    useState<RiskSummary | null>(null);

  const [remediation, setRemediation] =
    useState<RemediationResponse | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [
          governanceData,
          standardsRaw,
          adoptionsRaw,
          evidenceData,
          riskData,
          remediationData,
        ] = await Promise.all([
          readJson<DashboardData>(
            "/governance/dashboard",
            emptyDashboard
          ),
          readJson<unknown>("/standards/", []),
          readJson<unknown>(
            "/framework/adoptions?status=ACTIVE",
            []
          ),
          readJson<EvidenceSummary>(
            "/evidences/summary",
            { total: 0 }
          ),
          readJson<RiskSummary>(
            "/risks/summary",
            { total: 0 }
          ),
          readJson<RemediationResponse>(
            "/company/remediation",
            { summary: {} }
          ),
        ]);

        const standards = asList<Standard>(standardsRaw);
        const adoptions = asList<Adoption>(adoptionsRaw);

        const activeStandardIds = new Set(
          adoptions.map((item) => Number(item.standard_id))
        );

        const activeStandards = standards.filter((standard) =>
          activeStandardIds.has(Number(standard.id))
        );

        const posture = await Promise.all(
          activeStandards.map(async (standard) => {
            const kpi = await readJson<MatrixKpi | null>(
              `/matrix/kpi?standard_id=${standard.id}`,
              null
            );

            return {
              standard,
              kpi,
            };
          })
        );

        if (!active) return;

        setDashboard(governanceData);
        setFrameworks(posture);
        setEvidenceSummary(evidenceData);
        setRiskSummary(riskData);
        setRemediation(remediationData);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const controlFrameworks = useMemo(
    () =>
      frameworks.filter(
        (item) =>
          String(item.standard.type || "").toUpperCase() ===
          "CONTROL_BASED"
      ),
    [frameworks]
  );

  const maturityFrameworks = useMemo(
    () =>
      frameworks.filter(
        (item) =>
          String(item.standard.type || "").toUpperCase() ===
          "MATURITY_BASED"
      ),
    [frameworks]
  );

  const governanceMetrics = [
    {
      title: "Governance Health",
      value: dashboard.health_score.governance,
      description: "Governance lifecycle health",
      icon: Gauge,
    },
    {
      title: "Document Health",
      value: dashboard.health_score.document,
      description: "Document lifecycle quality",
      icon: Files,
    },
    {
      title: "Policy Health",
      value: dashboard.health_score.policy,
      description: "Policy lifecycle health",
      icon: ShieldCheck,
    },
    {
      title: "Approval Health",
      value: dashboard.health_score.approval,
      description: "Governance approval status",
      icon: Activity,
    },
    {
      title: "Review Health",
      value: dashboard.health_score.review,
      description: "Scheduled review timeliness",
      icon: AlertCircle,
    },
  ];

  const operationalMetrics = [
    {
      title: "Total Policies",
      value: dashboard.policy_summary.total,
      icon: FileText,
    },
    {
      title: "Approved Policies",
      value: dashboard.policy_summary.approved,
      icon: ShieldCheck,
    },
    {
      title: "Pending Review",
      value: dashboard.policy_summary.under_review,
      icon: Clock,
    },
    {
      title: "Expired Policies",
      value: dashboard.policy_summary.expired,
      icon: AlertTriangle,
    },
    {
      title: "Total Procedures",
      value: dashboard.procedure_summary.total,
      icon: Workflow,
    },
    {
      title: "Current Documents",
      value: dashboard.document_summary.current,
      icon: Files,
    },
    {
      title: "Archived Documents",
      value: dashboard.document_summary.archived,
      icon: Archive,
    },
    {
      title: "Rejected Documents",
      value: dashboard.document_summary.rejected,
      icon: XCircle,
    },
  ];

  const remediationSummary = remediation?.summary || {};
  const riskTotal = n(riskSummary?.total);
  const evidenceTotal = n(evidenceSummary?.total);
  const remediationActive = n(remediationSummary.active);

  if (loading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Loading governance dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Governance
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Governance Executive Dashboard
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Framework governance, policy lifecycle, evidence, risk and
            remediation oversight.
          </p>
        </div>

        <section className="mt-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Governance Overview
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Tenant-wide governance scope and active framework inventory.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              {
                title: "Active Frameworks",
                value: frameworks.length,
                detail: `${controlFrameworks.length} Control / ${maturityFrameworks.length} Maturity`,
                icon: Layers3,
              },
              {
                title: "Control-Based",
                value: controlFrameworks.length,
                detail: "Active frameworks",
                icon: ShieldCheck,
              },
              {
                title: "Maturity-Based",
                value: maturityFrameworks.length,
                detail: "Active frameworks",
                icon: Target,
              },
              {
                title: "Risks",
                value: riskTotal,
                detail: `${n(
                  riskSummary?.by_framework_type?.control
                )} Control / ${n(
                  riskSummary?.by_framework_type?.maturity
                )} Maturity`,
                icon: AlertTriangle,
              },
              {
                title: "Evidence",
                value: evidenceTotal,
                detail: `${n(
                  evidenceSummary?.by_assessment_type?.control
                )} Control / ${n(
                  evidenceSummary?.by_assessment_type?.maturity
                )} Maturity`,
                icon: Files,
              },
              {
                title: "Remediation",
                value: remediationActive,
                detail: `${n(
                  remediationSummary.overdue
                )} Overdue / ${n(
                  remediationSummary.due_soon
                )} Due Soon`,
                icon: Activity,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {item.title}
                    </span>
                    <Icon size={18} className="text-slate-400" />
                  </div>

                  <div className="mt-4 text-3xl font-semibold text-slate-950">
                    {item.value}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {item.detail}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Framework Governance Posture
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Framework-specific posture without mixing control compliance
              and maturity assessment semantics.
            </p>
          </div>

          <div className="mt-4 grid gap-5 xl:grid-cols-2">
            {frameworks.map(({ standard, kpi }) => {
              const frameworkType =
                String(standard.type || "").toUpperCase();

              const isMaturity =
                frameworkType === "MATURITY_BASED";

              return (
                <div
                  key={standard.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">
                        {standard.code}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        {standard.name || "Framework"}
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold tracking-wide text-slate-600">
                      {frameworkType || "UNKNOWN"}
                    </span>
                  </div>

                  {isMaturity ? (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric
                        label="Target Achievement"
                        value={pct(
                          kpi?.target_achievement_percentage
                        )}
                      />
                      <Metric
                        label="Assessment Coverage"
                        value={pct(
                          kpi?.assessment_coverage_percentage
                        )}
                      />
                      <Metric
                        label="Processes"
                        value={n(kpi?.maturity?.total)}
                      />
                      <Metric
                        label="Calculated"
                        value={n(kpi?.maturity?.calculated)}
                        detail={`${n(
                          kpi?.maturity?.unassessed
                        )} unassessed`}
                      />
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric
                        label="Compliance"
                        value={pct(kpi?.compliance_percentage)}
                      />
                      <Metric
                        label="Controls"
                        value={n(kpi?.controls?.total)}
                      />
                      <Metric
                        label="Covered"
                        value={n(kpi?.controls?.covered)}
                      />
                      <Metric
                        label="Partial / Not Covered"
                        value={`${n(
                          kpi?.controls?.partial
                        )} / ${n(
                          kpi?.controls?.not_covered
                        )}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {frameworks.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 xl:col-span-2">
                No active framework adoption was found.
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Governance Operations
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Governance lifecycle health. These scores are operational
              governance indicators, not framework compliance or capability
              levels.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {governanceMetrics.map((item) => {
              const Icon = item.icon;

              const healthStatus =
                item.value >= 80
                  ? {
                      label: "Healthy",
                      className:
                        "bg-emerald-50 text-emerald-700",
                    }
                  : item.value >= 60
                  ? {
                      label: "Attention",
                      className:
                        "bg-amber-50 text-amber-700",
                    }
                  : {
                      label: "Critical",
                      className: "bg-red-50 text-red-700",
                    };

              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs uppercase text-slate-400">
                        {item.title}
                      </span>

                      <div className="mt-4 text-3xl font-semibold text-slate-950">
                        {item.value}%
                      </div>
                    </div>

                    <Icon size={18} className="text-slate-400" />
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {item.description}
                  </div>

                  <div className="mt-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${healthStatus.className}`}
                    >
                      {healthStatus.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Governance Lifecycle
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Policy, procedure and controlled-document inventory.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {operationalMetrics.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex justify-between">
                    <span className="text-xs uppercase text-slate-400">
                      {item.title}
                    </span>

                    <Icon size={18} className="text-slate-400" />
                  </div>

                  <div className="mt-4 text-3xl font-semibold text-slate-950">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Governance Attention
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Governance lifecycle items requiring management
                  attention.
                </p>
              </div>

              <AlertCircle size={18} className="text-slate-400" />
            </div>

            <div className="mt-5 space-y-3">
              {dashboard.attention_items.length === 0 && (
                <div className="rounded-lg border border-slate-100 p-4 text-sm text-slate-400">
                  No governance lifecycle items require attention.
                </div>
              )}

              {dashboard.attention_items.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {item.message}
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {item.severity}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Governance Intelligence
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Current evidence, risk and remediation signals.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Metric
                label="Evidence Inventory"
                value={evidenceTotal}
                detail={`${n(
                  evidenceSummary?.by_assessment_type?.control
                )} control / ${n(
                  evidenceSummary?.by_assessment_type?.maturity
                )} maturity`}
              />

              <Metric
                label="Risk Inventory"
                value={riskTotal}
                detail={`${n(
                  riskSummary?.by_framework_type?.control
                )} control / ${n(
                  riskSummary?.by_framework_type?.maturity
                )} maturity`}
              />

              <Metric
                label="Active Remediation"
                value={remediationActive}
                detail={`${n(
                  remediationSummary.overdue
                )} overdue`}
              />

              <Metric
                label="Awaiting Review"
                value={n(
                  remediationSummary.awaiting_review
                )}
                detail={`${n(
                  remediationSummary.high_priority
                )} high priority`}
              />
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Upcoming Policy Reviews
          </h2>

          <div className="mt-4 space-y-3">
            {dashboard.upcoming_reviews.length === 0 && (
              <div className="text-sm text-slate-400">
                No upcoming reviews
              </div>
            )}

            {dashboard.upcoming_reviews.map((item) => {
              const reviewDate = item.review_date
                ? new Date(item.review_date)
                : null;

              const daysRemaining = reviewDate
                ? Math.ceil(
                    (reviewDate.getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;

              const status =
                daysRemaining === null
                  ? "No Date"
                  : daysRemaining < 0
                  ? "Overdue"
                  : daysRemaining <= 30
                  ? "Due Soon"
                  : daysRemaining <= 90
                  ? "Upcoming"
                  : "Scheduled";

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 p-4"
                >
                  <div>
                    <div className="font-semibold text-slate-800">
                      {item.title}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {reviewDate
                        ? reviewDate.toLocaleDateString()
                        : "No review date"}
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Governance Activity
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Recent policy and document lifecycle events.
          </p>

          <div className="mt-4 space-y-3">
            {dashboard.activity_summary.length === 0 && (
              <div className="text-sm text-slate-400">
                No governance activities
              </div>
            )}

            {dashboard.activity_summary.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-100 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {item.action}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {item.document || "No document"}
                      {item.version
                        ? ` / Version ${item.version}`
                        : ""}
                    </div>
                  </div>

                  <span className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>
                    Performed by: {item.performed_by}
                  </span>
                  <span>
                    Status: {item.status || "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold text-slate-950">
        {value}
      </div>

      {detail && (
        <div className="mt-1 text-xs text-slate-500">
          {detail}
        </div>
      )}
    </div>
  );
}
