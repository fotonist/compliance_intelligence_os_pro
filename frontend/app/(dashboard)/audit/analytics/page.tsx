"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileBarChart,
  Layers3,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { apiFetch } from "../../../lib/api";

type AnyRecord = Record<string, any>;

type AuditPlan = {
  id?: number;
  reference?: string | null;
  name?: string | null;
  status?: string | null;
  process_id?: number | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  objective?: string | null;
  scope?: string | null;
};

type ExecutionRecord = {
  id?: number;
  audit_plan_id?: number | null;
  process_id?: number | null;
  control_id?: number | null;
  status?: string | null;
  result?: string | null;
  notes?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type Finding = {
  id?: number;
  audit_plan_id?: number | null;
  execution_id?: number | null;
  process_id?: number | null;
  control_id?: number | null;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  due_date?: string | null;
  assigned_owner_id?: number | null;
  owner_id?: number | null;
  owner?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  manager_review_status?: string | null;
  implementation_status?: string | null;
  verification_status?: string | null;
};

type RiskAction = {
  control_id?: number | null;
  control_code?: string | null;
  control_title?: string | null;
  control_description?: string | null;
  requirement_code?: string | null;
  requirement_title?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  risk_count?: number | null;
  max_risk_score?: number | null;
  highest_risk_level?: string | null;
  risks?: Array<{
    id?: number;
    title?: string | null;
    description?: string | null;
    score?: number | null;
    risk_level?: string | null;
  }>;
};

type AuditLog = {
  id?: number;
  actor_id?: number | null;
  actor_role?: string | null;
  user_email?: string | null;
  action?: string | null;
  entity?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type ProcessRow = {
  id?: number;
  name?: string | null;
  code?: string | null;
};

type AnalyticsRow = {
  controlId: number;
  controlCode: string;
  controlTitle: string;
  requirementCode: string;
  requirementTitle: string;
  riskCount: number;
  riskScore: number;
  riskLevel: string;
  executionStatus: string;
  result: string;
  findingCount: number;
  openFindingCount: number;
};

function arrayValue(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function safeNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: any): string {
  return String(value ?? "").trim().toUpperCase();
}

function isOpenFinding(finding: Finding): boolean {
  const status = normalize(finding.status);
  return !["CLOSED"].includes(status);
}

function isCompletedExecution(execution: ExecutionRecord): boolean {
  return normalize(execution.status) === "COMPLETED";
}

function isOverdueFinding(finding: Finding): boolean {
  if (!finding.due_date || !isOpenFinding(finding)) return false;
  const due = new Date(finding.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function KpiCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-h-[122px] border-r border-slate-200 bg-white px-5 py-5 last:border-r-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {icon}
          {label}
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      {detail ? (
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">
        {eyebrow}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-950">
        {title}
      </div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  total,
  suffix,
}: {
  label: string;
  value: number;
  total: number;
  suffix?: string;
}) {
  const percentage =
    total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-950">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden bg-slate-100">
        <div
          className="h-full bg-slate-900 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = normalize(value);

  let className =
    "border border-slate-200 bg-slate-50 text-slate-600";

  if (["COMPLETED", "CLOSED"].includes(normalized)) {
    className = "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    ["CRITICAL", "HIGH", "EXCEPTION", "VERIFICATION_FAILED"].includes(
      normalized,
    )
  ) {
    className = "border border-red-200 bg-red-50 text-red-700";
  }

  if (
    ["IN_PROGRESS", "ASSIGNED", "OWNER_RESPONSE", "READY_FOR_VERIFICATION"].includes(
      normalized,
    )
  ) {
    className = "border border-amber-200 bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      {value || "N/A"}
    </span>
  );
}

export default function AuditAnalyticsPage() {
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<AuditPlan | null>(null);

  const [execution, setExecution] = useState<ExecutionRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [riskActions, setRiskActions] = useState<RiskAction[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState("");

  async function loadPlans() {
    const response = await apiFetch("/audit/plans");
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const rows = arrayValue(await response.json()) as AuditPlan[];
    setPlans(rows);

    if (rows.length > 0) {
      const firstId = Number(rows[0].id);
      if (Number.isFinite(firstId) && firstId > 0) {
        setSelectedPlanId((current) => current ?? firstId);
      }
    }
  }

  async function loadBaseData() {
    const [planResponse, logResponse, processResponse] =
      await Promise.allSettled([
        apiFetch("/audit/plans"),
        apiFetch("/audit/logs"),
        apiFetch("/company/processes"),
      ]);

    if (planResponse.status === "fulfilled" && planResponse.value.ok) {
      const rows = arrayValue(
        await planResponse.value.json(),
      ) as AuditPlan[];

      setPlans(rows);

      if (rows.length > 0) {
        const firstId = Number(rows[0].id);
        if (Number.isFinite(firstId) && firstId > 0) {
          setSelectedPlanId((current) => current ?? firstId);
        }
      }
    }

    if (logResponse.status === "fulfilled" && logResponse.value.ok) {
      setLogs(arrayValue(await logResponse.value.json()) as AuditLog[]);
    }

    if (
      processResponse.status === "fulfilled" &&
      processResponse.value.ok
    ) {
      setProcesses(
        arrayValue(await processResponse.value.json()) as ProcessRow[],
      );
    }
  }

  async function loadPlanAnalytics(planId: number) {
    setLoadingPlan(true);
    setError("");

    try {
      const planResponse = await apiFetch(`/audit/plans/${planId}`);
      if (!planResponse.ok) {
        throw new Error(await planResponse.text());
      }

      const plan = (await planResponse.json()) as AuditPlan;
      setSelectedPlan(plan);

      const requests: Promise<Response>[] = [
        apiFetch(`/audit/execution?plan_id=${planId}`),
        apiFetch(`/audit/findings?plan_id=${planId}`),
      ];

      if (plan.process_id) {
        requests.push(
          apiFetch(
            `/company/coverage/processes/${plan.process_id}/audit-plan`,
          ),
        );
      }

      const responses = await Promise.all(requests);

      const executionResponse = responses[0];
      const findingsResponse = responses[1];
      const riskResponse = responses[2];

      if (executionResponse.ok) {
        setExecution(
          arrayValue(await executionResponse.json()) as ExecutionRecord[],
        );
      } else {
        setExecution([]);
      }

      if (findingsResponse.ok) {
        setFindings(arrayValue(await findingsResponse.json()) as Finding[]);
      } else {
        setFindings([]);
      }

      if (riskResponse?.ok) {
        const riskPlan = await riskResponse.json();
        setRiskActions(arrayValue(riskPlan?.actions) as RiskAction[]);
      } else {
        setRiskActions([]);
      }
    } catch (e: any) {
      setSelectedPlan(null);
      setExecution([]);
      setFindings([]);
      setRiskActions([]);
      setError(e?.message || "Failed to load audit analytics.");
    } finally {
      setLoadingPlan(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      await loadBaseData();
    } catch (e: any) {
      setError(e?.message || "Failed to load audit analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;
    void loadPlanAnalytics(selectedPlanId);
  }, [selectedPlanId]);

  const processName = useMemo(() => {
    if (!selectedPlan?.process_id) return "No process scope";
    const process = processes.find(
      (item) => Number(item.id) === Number(selectedPlan.process_id),
    );
    return process?.name || process?.code || `Process #${selectedPlan.process_id}`;
  }, [selectedPlan, processes]);

  const controlCount = useMemo(() => {
    const ids = new Set<number>();

    riskActions.forEach((item) => {
      if (item.control_id != null) ids.add(Number(item.control_id));
    });

    execution.forEach((item) => {
      if (item.control_id != null) ids.add(Number(item.control_id));
    });

    return ids.size;
  }, [riskActions, execution]);

  const completedExecutions = useMemo(
    () => execution.filter(isCompletedExecution),
    [execution],
  );

  const executionCompletion = useMemo(
    () =>
      controlCount > 0
        ? Math.round((completedExecutions.length / controlCount) * 100)
        : 0,
    [completedExecutions.length, controlCount],
  );

  const openFindings = useMemo(
    () => findings.filter(isOpenFinding),
    [findings],
  );

  const criticalFindings = useMemo(
    () =>
      findings.filter((item) => normalize(item.severity) === "CRITICAL"),
    [findings],
  );

  const highFindings = useMemo(
    () => findings.filter((item) => normalize(item.severity) === "HIGH"),
    [findings],
  );

  const overdueFindings = useMemo(
    () => findings.filter(isOverdueFinding),
    [findings],
  );

  const controlOutcome = useMemo(() => {
    const completed = execution.filter(isCompletedExecution);
    const pass = completed.filter((item) =>
      ["PASS", "PASSED", "CONFORMING", "EFFECTIVE", "COMPLIANT"].includes(
        normalize(item.result),
      ),
    ).length;

    const fail = completed.filter((item) =>
      ["FAIL", "FAILED", "NONCONFORMITY", "NON_COMPLIANT", "EXCEPTION"].includes(
        normalize(item.result),
      ),
    ).length;

    const other = Math.max(0, completed.length - pass - fail);

    return {
      completed: completed.length,
      pass,
      fail,
      other,
    };
  }, [execution]);

  const findingLifecycle = useMemo(() => {
    const map = new Map<string, number>();

    findings.forEach((finding) => {
      const key = finding.status || "UNKNOWN";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [findings]);

  const severityDistribution = useMemo(() => {
    const levels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    return levels.map((level) => ({
      level,
      count: findings.filter(
        (item) => normalize(item.severity) === level,
      ).length,
    }));
  }, [findings]);

  const riskSummary = useMemo(() => {
    const counts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0,
    };

    let totalScore = 0;
    let scored = 0;

    riskActions.forEach((action) => {
      const level = normalize(action.highest_risk_level);

      if (level === "CRITICAL") counts.CRITICAL += 1;
      else if (level === "HIGH") counts.HIGH += 1;
      else if (level === "MEDIUM") counts.MEDIUM += 1;
      else if (level === "LOW") counts.LOW += 1;
      else counts.UNKNOWN += 1;

      const score = safeNumber(action.max_risk_score);
      if (score > 0) {
        totalScore += score;
        scored += 1;
      }
    });

    return {
      ...counts,
      totalScore,
      scored,
      averageScore: scored > 0 ? Math.round(totalScore / scored) : 0,
    };
  }, [riskActions]);

  const analyticsRows = useMemo<AnalyticsRow[]>(() => {
    const controls = new Set<number>();

    riskActions.forEach((item) => {
      if (item.control_id != null) controls.add(Number(item.control_id));
    });

    execution.forEach((item) => {
      if (item.control_id != null) controls.add(Number(item.control_id));
    });

    findings.forEach((item) => {
      if (item.control_id != null) controls.add(Number(item.control_id));
    });

    return Array.from(controls)
      .map((controlId) => {
        const action = riskActions.find(
          (item) => Number(item.control_id) === controlId,
        );

        const exec = execution.find(
          (item) => Number(item.control_id) === controlId,
        );

        const controlFindings = findings.filter(
          (item) => Number(item.control_id) === controlId,
        );

        return {
          controlId,
          controlCode: action?.control_code || `CTRL-${controlId}`,
          controlTitle: action?.control_title || "Control",
          requirementCode: action?.requirement_code || "",
          requirementTitle: action?.requirement_title || "",
          riskCount: safeNumber(action?.risk_count),
          riskScore: safeNumber(action?.max_risk_score),
          riskLevel: action?.highest_risk_level || "N/A",
          executionStatus: exec?.status || "READY",
          result: exec?.result || "NOT ASSESSED",
          findingCount: controlFindings.length,
          openFindingCount: controlFindings.filter(isOpenFinding).length,
        };
      })
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        if (b.openFindingCount !== a.openFindingCount) {
          return b.openFindingCount - a.openFindingCount;
        }
        return a.controlCode.localeCompare(b.controlCode);
      });
  }, [riskActions, execution, findings]);

  const recentLogs = useMemo(() => {
    return [...logs]
      .filter((log) => {
        if (!selectedPlanId) return true;
        const entity = normalize(log.entity_type || log.entity);
        return entity.includes("AUDIT") || entity.includes("FINDING");
      })
      .slice(0, 8);
  }, [logs, selectedPlanId]);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1680px] space-y-6 px-6 py-6 xl:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                <BarChart3 size={15} />
                Internal Audit / Analytics
              </div>

              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                Audit Analytics
              </h1>

              <p className="mt-1 max-w-4xl text-sm text-slate-500">
                Executive intelligence across audit execution, control
                outcomes, finding exposure, risk concentration, and
                remediation readiness.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/audit/report"
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <FileBarChart size={15} />
                Audit Report
              </Link>

              <button
                type="button"
                onClick={refresh}
                disabled={loading || loadingPlan}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading || loadingPlan ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <section className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Audit Engagement
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-950">
                {selectedPlan?.reference || "Select an audit engagement"}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {selectedPlan?.name || "No audit plan selected"}
                {selectedPlan ? ` / ${processName}` : ""}
              </div>
            </div>

            <select
              value={selectedPlanId ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSelectedPlanId(value > 0 ? value : null);
              }}
              className="h-10 min-w-[320px] border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="">Select audit engagement</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.reference || `Audit #${plan.id}`} -{" "}
                  {plan.name || "Unnamed audit"}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Layers3 size={15} />}
            label="Controls In Scope"
            value={String(controlCount)}
            detail="Distinct controls across current audit intelligence"
          />

          <KpiCard
            icon={<CheckCircle2 size={15} />}
            label="Executed Controls"
            value={String(completedExecutions.length)}
            detail={`${executionCompletion}% execution completion`}
          />

          <KpiCard
            icon={<AlertTriangle size={15} />}
            label="Open Findings"
            value={String(openFindings.length)}
            detail={`${criticalFindings.length} critical / ${highFindings.length} high`}
          />

          <KpiCard
            icon={<Clock3 size={15} />}
            label="Overdue Findings"
            value={String(overdueFindings.length)}
            detail="Open findings past due date"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="border border-slate-200 bg-white xl:col-span-2">
            <SectionHeader
              eyebrow="Execution Performance"
              title="Audit Execution"
              description="Current engagement progress based on persisted audit execution records."
            />

            <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-3">
              <div className="border border-slate-200 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Completion
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-950">
                  {executionCompletion}%
                </div>
                <div className="mt-3 h-2 bg-slate-100">
                  <div
                    className="h-full bg-slate-900"
                    style={{ width: `${executionCompletion}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {completedExecutions.length} of {controlCount} controls
                </div>
              </div>

              <div className="border border-slate-200 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Execution Records
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-950">
                  {execution.length}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Includes READY, IN_PROGRESS, COMPLETED and EXCEPTION states.
                </div>
              </div>

              <div className="border border-slate-200 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Exceptions
                </div>
                <div className="mt-3 text-3xl font-semibold text-red-700">
                  {
                    execution.filter(
                      (item) => normalize(item.status) === "EXCEPTION",
                    ).length
                  }
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Execution records requiring audit attention.
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-5">
              <div className="space-y-4">
                <MetricBar
                  label="Completed"
                  value={completedExecutions.length}
                  total={Math.max(execution.length, 1)}
                />
                <MetricBar
                  label="In Progress"
                  value={
                    execution.filter(
                      (item) => normalize(item.status) === "IN_PROGRESS",
                    ).length
                  }
                  total={Math.max(execution.length, 1)}
                />
                <MetricBar
                  label="Exceptions"
                  value={
                    execution.filter(
                      (item) => normalize(item.status) === "EXCEPTION",
                    ).length
                  }
                  total={Math.max(execution.length, 1)}
                />
                <MetricBar
                  label="Not Started"
                  value={
                    execution.filter(
                      (item) =>
                        !normalize(item.status) ||
                        normalize(item.status) === "READY",
                    ).length
                  }
                  total={Math.max(execution.length, 1)}
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Control Outcome"
              title="Assessment Results"
              description="Distribution of persisted execution assessment results."
            />

            <div className="space-y-5 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-semibold text-slate-950">
                    {controlOutcome.completed}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Completed assessments
                  </div>
                </div>
                <Activity size={22} className="text-slate-300" />
              </div>

              <MetricBar
                label="Conforming / Pass"
                value={controlOutcome.pass}
                total={Math.max(controlOutcome.completed, 1)}
              />

              <MetricBar
                label="Nonconforming / Fail"
                value={controlOutcome.fail}
                total={Math.max(controlOutcome.completed, 1)}
              />

              <MetricBar
                label="Other / Unclassified"
                value={controlOutcome.other}
                total={Math.max(controlOutcome.completed, 1)}
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Finding Intelligence"
              title="Severity Distribution"
              description="Current finding exposure by severity."
            />

            <div className="space-y-5 p-5">
              {severityDistribution.map((item) => (
                <MetricBar
                  key={item.level}
                  label={item.level}
                  value={item.count}
                  total={Math.max(findings.length, 1)}
                />
              ))}

              <div className="grid grid-cols-2 gap-px border border-slate-200 bg-slate-200 pt-0 md:grid-cols-4">
                {severityDistribution.map((item) => (
                  <div
                    key={item.level}
                    className="bg-white px-4 py-3 text-center"
                  >
                    <div className="text-xl font-semibold text-slate-950">
                      {item.count}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {item.level}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Lifecycle"
              title="Finding Workflow Distribution"
              description="Current position of findings in the controlled lifecycle."
            />

            <div className="space-y-4 p-5">
              {findingLifecycle.length === 0 ? (
                <div className="border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No finding lifecycle data is available for this engagement.
                </div>
              ) : (
                findingLifecycle.map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <StatusPill value={status} />
                    </div>
                    <div className="text-sm font-semibold text-slate-950">
                      {count}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <SectionHeader
            eyebrow="Risk Intelligence"
            title="Risk Exposure"
            description="Risk concentration derived from the current process audit scope."
          />

          <div className="grid grid-cols-2 gap-px bg-slate-200 md:grid-cols-5">
            <div className="bg-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Critical
              </div>
              <div className="mt-3 text-2xl font-semibold text-red-700">
                {riskSummary.CRITICAL}
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                High
              </div>
              <div className="mt-3 text-2xl font-semibold text-orange-700">
                {riskSummary.HIGH}
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Medium
              </div>
              <div className="mt-3 text-2xl font-semibold text-amber-700">
                {riskSummary.MEDIUM}
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Low
              </div>
              <div className="mt-3 text-2xl font-semibold text-emerald-700">
                {riskSummary.LOW}
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Avg Risk Score
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">
                {riskSummary.averageScore || "N/A"}
              </div>
            </div>
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <SectionHeader
            eyebrow="Control Intelligence"
            title="Control Assessment Matrix"
            description="Cross-domain view connecting audit scope, risk, execution and findings."
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Control
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Requirement
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Execution
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Result
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Findings
                  </th>
                </tr>
              </thead>

              <tbody>
                {analyticsRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      No persisted control intelligence is available for this
                      engagement.
                    </td>
                  </tr>
                ) : (
                  analyticsRows.map((row) => (
                    <tr
                      key={row.controlId}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="text-xs font-semibold text-slate-950">
                          {row.controlCode}
                        </div>
                        <div className="mt-1 max-w-[260px] text-xs text-slate-500">
                          {row.controlTitle}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-xs font-semibold text-slate-700">
                          {row.requirementCode || "N/A"}
                        </div>
                        <div className="mt-1 max-w-[240px] text-xs text-slate-500">
                          {row.requirementTitle || "No requirement title"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <ShieldAlert size={14} className="text-slate-400" />
                          <span className="text-xs font-semibold text-slate-700">
                            {row.riskScore || "N/A"}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                          {row.riskLevel}
                          {row.riskCount
                            ? ` / ${row.riskCount} risk${row.riskCount === 1 ? "" : "s"}`
                            : ""}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <StatusPill value={row.executionStatus} />
                      </td>

                      <td className="px-4 py-4">
                        <StatusPill value={row.result} />
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-950">
                          {row.findingCount}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                          {row.openFindingCount} open
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="border border-slate-200 bg-white xl:col-span-2">
            <SectionHeader
              eyebrow="Management Attention"
              title="Audit Attention Areas"
              description="Signals requiring management or audit-owner attention."
            />

            <div className="grid grid-cols-1 gap-px bg-slate-200 md:grid-cols-2">
              <div className="bg-white p-5">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={18} className="text-red-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Critical Findings
                    </div>
                    <div className="text-xs text-slate-500">
                      Highest-severity open exposure
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-3xl font-semibold text-red-700">
                  {criticalFindings.length}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="flex items-center gap-3">
                  <TrendingUp size={18} className="text-orange-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      High Findings
                    </div>
                    <div className="text-xs text-slate-500">
                      Significant control weakness exposure
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-3xl font-semibold text-orange-700">
                  {highFindings.length}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="flex items-center gap-3">
                  <Clock3 size={18} className="text-amber-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Overdue
                    </div>
                    <div className="text-xs text-slate-500">
                      Open findings beyond due date
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-3xl font-semibold text-amber-700">
                  {overdueFindings.length}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="flex items-center gap-3">
                  <Target size={18} className="text-slate-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Finding Rate
                    </div>
                    <div className="text-xs text-slate-500">
                      Findings against executed controls
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-3xl font-semibold text-slate-950">
                  {completedExecutions.length > 0
                    ? `${Math.round(
                        (findings.length / completedExecutions.length) * 100,
                      )}%`
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Audit Trail"
              title="Recent Activity"
              description="Recent persisted audit activity available to the tenant."
            />

            <div className="divide-y divide-slate-100">
              {recentLogs.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  No audit activity available.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Activity
                        size={14}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800">
                          {log.action || "Audit activity"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {log.entity_type ||
                            log.entity ||
                            "Audit entity"}
                          {log.entity_id ? ` #${log.entity_id}` : ""}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {log.user_email ||
                            log.actor_role ||
                            "System actor"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-2 border border-slate-200 bg-white p-4">
          <div className="mr-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Audit Workspace
          </div>

          <Link
            href="/audit/planning"
            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ClipboardCheck size={13} />
            Planning
          </Link>

          <Link
            href="/audit/checklists"
            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Layers3 size={13} />
            Checklists
          </Link>

          <Link
            href="/audit/execution"
            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Activity size={13} />
            Execution
          </Link>

          <Link
            href="/audit/findings"
            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <AlertTriangle size={13} />
            Findings
          </Link>

          <Link
            href="/audit/corrective-actions"
            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <CheckCircle2 size={13} />
            Follow-up Actions
          </Link>

          <Link
            href="/audit/report"
            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileBarChart size={13} />
            Report
          </Link>
        </section>
      </div>
    </div>
  );
}
