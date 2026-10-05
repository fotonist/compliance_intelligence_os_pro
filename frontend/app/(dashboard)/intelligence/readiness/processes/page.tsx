"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Target,
  Wrench,
} from "lucide-react";

import { apiFetch } from "@/app/lib/api";

type Adoption = {
  adoption_id?: number;
  standard_id?: number;
  standard_version_id?: number;
  adoption_status?: string;
  applicability?: string;
  standard_code?: string;
  standard_type?: string;
};

type MaturityFramework = {
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
};

type UeeSummary = {
  framework_context?: {
    active_framework_count?: number;
    control_based_count?: number;
    maturity_based_count?: number;
    adoptions?: Adoption[];
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
    frameworks?: MaturityFramework[];
  };
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

type RiskSummary = {
  total?: number;
  open?: number;
  by_framework_type?: {
    control?: number;
    maturity?: number;
    unlinked?: number;
  };
};

type EvidenceSummary = {
  total?: number;
  by_assessment_type?: Record<string, number>;
};

type RemediationResponse = {
  summary?: {
    total?: number;
    active?: number;
    overdue?: number;
    due_soon?: number;
    high_priority?: number;
    awaiting_review?: number;
    completed?: number;
  };
};

type ControlFrameworkState = {
  adoption: Adoption;
  kpi: MatrixKpi | null;
};

function number(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function percent(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${Number(value).toFixed(1)}%`;
}

function frameworkLabel(adoption: Adoption): string {
  return adoption.standard_code || `Standard ${adoption.standard_id ?? "-"}`;
}

export default function ExecutiveReadinessProcessesPage() {
  const [uee, setUee] = useState<UeeSummary | null>(null);
  const [controls, setControls] = useState<ControlFrameworkState[]>([]);
  const [risks, setRisks] = useState<RiskSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSummary | null>(null);
  const [remediation, setRemediation] =
    useState<RemediationResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const ueeResponse = await apiFetch("/uee/summary");

      if (!ueeResponse.ok) {
        throw new Error(
          `UEE summary failed (${ueeResponse.status}): ${await ueeResponse.text()}`
        );
      }

      const nextUee = (await ueeResponse.json()) as UeeSummary;
      setUee(nextUee);

      const adoptions =
        nextUee.framework_context?.adoptions ?? [];

      const controlAdoptions = adoptions.filter(
        (item) =>
          String(item.standard_type || "").toUpperCase() ===
          "CONTROL_BASED"
      );

      const controlStates: ControlFrameworkState[] = [];

      for (const adoption of controlAdoptions) {
        if (adoption.standard_id == null) continue;

        const response = await apiFetch(
          `/matrix/kpi?standard_id=${adoption.standard_id}`
        );

        controlStates.push({
          adoption,
          kpi: response.ok
            ? ((await response.json()) as MatrixKpi)
            : null,
        });
      }

      setControls(controlStates);

      const [riskResponse, evidenceResponse, remediationResponse] =
        await Promise.all([
          apiFetch("/risks/summary"),
          apiFetch("/evidences/summary"),
          apiFetch("/company/remediation"),
        ]);

      setRisks(
        riskResponse.ok
          ? ((await riskResponse.json()) as RiskSummary)
          : null
      );

      setEvidence(
        evidenceResponse.ok
          ? ((await evidenceResponse.json()) as EvidenceSummary)
          : null
      );

      setRemediation(
        remediationResponse.ok
          ? ((await remediationResponse.json()) as RemediationResponse)
          : null
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load canonical readiness data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const frameworkContext = uee?.framework_context;
  const maturityFrameworks =
    uee?.maturity_context?.frameworks ?? [];

  const activeFrameworks =
    frameworkContext?.active_framework_count ?? 0;

  const controlFrameworks =
    frameworkContext?.control_based_count ?? 0;

  const maturityFrameworkCount =
    frameworkContext?.maturity_based_count ?? 0;

  const openRisks = number(risks?.open);
  const totalEvidence = number(evidence?.total);
  const activeRemediation = number(remediation?.summary?.active);

  const controlTotals = useMemo(() => {
    return controls.reduce(
      (acc, item) => {
        const c = item.kpi?.controls;

        acc.total += number(c?.total);
        acc.covered += number(c?.covered);
        acc.partial += number(c?.partial);
        acc.notCovered += number(c?.not_covered);

        return acc;
      },
      {
        total: 0,
        covered: 0,
        partial: 0,
        notCovered: 0,
      }
    );
  }, [controls]);

  if (loading) {
    return (
      <main className="min-h-full bg-slate-50 p-8">
        <div className="mx-auto max-w-[1600px] rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading canonical readiness posture...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <Gauge className="h-6 w-6 text-slate-700" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-950">
                Executive Readiness
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Executive posture across active framework adoptions,
                risk, evidence, and remediation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </section>

        {error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Active Frameworks"
            value={activeFrameworks}
            detail={`${controlFrameworks} Control-Based ? ${maturityFrameworkCount} Maturity-Based`}
            icon={<ShieldCheck className="h-5 w-5" />}
          />

          <Metric
            label="Open Risks"
            value={openRisks}
            detail={`${number(
              risks?.by_framework_type?.control
            )} Control ? ${number(
              risks?.by_framework_type?.maturity
            )} Maturity`}
            icon={<AlertTriangle className="h-5 w-5" />}
          />

          <Metric
            label="Evidence"
            value={totalEvidence}
            detail={`${number(
              evidence?.by_assessment_type?.control
            )} Control ? ${number(
              evidence?.by_assessment_type?.maturity
            )} Maturity`}
            icon={<FileCheck2 className="h-5 w-5" />}
          />

          <Metric
            label="Active Remediation"
            value={activeRemediation}
            detail={`${number(
              remediation?.summary?.overdue
            )} Overdue ? ${number(
              remediation?.summary?.awaiting_review
            )} Awaiting Review`}
            icon={<Wrench className="h-5 w-5" />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-950">
              Framework Posture
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Framework-native posture. Control compliance and
              maturity achievement are intentionally not aggregated.
            </p>
          </div>

          <div className="grid gap-5 p-6 xl:grid-cols-2">

            {controls.map(({ adoption, kpi }) => {
              const compliance = kpi?.compliance_percentage;
              const total = number(kpi?.controls?.total);
              const covered = number(kpi?.controls?.covered);
              const partial = number(kpi?.controls?.partial);
              const notCovered = number(
                kpi?.controls?.not_covered
              );

              return (
                <article
                  key={`control-${
                    adoption.adoption_id ??
                    adoption.standard_id
                  }`}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-6"
                >
                  <FrameworkHeader
                    code={frameworkLabel(adoption)}
                    type="CONTROL_BASED"
                  />

                  <div className="mt-7">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Compliance
                        </div>

                        <div className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                          {percent(compliance)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-semibold text-slate-900">
                          {total}
                        </div>
                        <div className="text-xs text-slate-500">
                          Controls
                        </div>
                      </div>
                    </div>

                    <ProgressBar
                      value={compliance}
                      className="mt-5"
                    />
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-3">
                    <BreakdownMetric
                      label="Covered"
                      value={covered}
                    />
                    <BreakdownMetric
                      label="Partial"
                      value={partial}
                    />
                    <BreakdownMetric
                      label="Not Covered"
                      value={notCovered}
                    />
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500">
                    Compliance is derived from the canonical
                    control-based matrix posture for this adoption.
                  </div>
                </article>
              );
            })}

            {maturityFrameworks.map((framework) => {
              const achievement =
                framework.target_achievement_percentage;

              const coverage =
                framework.assessment_coverage_percentage;

              const total = number(
                framework.total_processes
              );

              const measured = number(
                framework.measured_processes
              );

              const calculated = number(
                framework.calculated_processes
              );

              const unassessed = number(
                framework.unassessed_processes
              );

              return (
                <article
                  key={`maturity-${
                    framework.adoption_id ??
                    framework.standard_id
                  }`}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-6"
                >
                  <FrameworkHeader
                    code={
                      framework.standard_code ||
                      `Standard ${
                        framework.standard_id ?? "-"
                      }`
                    }
                    type="MATURITY_BASED"
                  />

                  <div className="mt-7 space-y-7">
                    <ReadinessMeasure
                      label="Target Achievement"
                      value={achievement}
                      detail="Achievement among processes with a final calculable capability result."
                    />

                    <ReadinessMeasure
                      label="Adoption Coverage"
                      value={coverage}
                      detail={`${measured} of ${total} adoption processes measured`}
                      emphasizeCoverage
                    />
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-3">
                    <BreakdownMetric
                      label="Measured"
                      value={measured}
                    />

                    <BreakdownMetric
                      label="Calculated"
                      value={calculated}
                    />

                    <BreakdownMetric
                      label="Unassessed"
                      value={unassessed}
                    />
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                    Unassessed processes remain unassessed.
                    They are not converted to CL0 or
                    Not Achieved.
                  </div>
                </article>
              );
            })}

            {controls.length === 0 &&
            maturityFrameworks.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No active framework posture is available.
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-950">
              Enterprise Operational Signals
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Canonical operational signals supporting executive attention and follow-up.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <SignalCard
              title="Risk Exposure"
              value={openRisks}
              primaryLabel="Open risks"
              rows={[
                [
                  "Control-based",
                  number(
                    risks?.by_framework_type?.control
                  ),
                ],
                [
                  "Maturity-based",
                  number(
                    risks?.by_framework_type?.maturity
                  ),
                ],
                [
                  "Unlinked",
                  number(
                    risks?.by_framework_type?.unlinked
                  ),
                ],
              ]}
            />

            <SignalCard
              title="Evidence Posture"
              value={totalEvidence}
              primaryLabel="Evidence records"
              rows={[
                [
                  "Control evidence",
                  number(
                    evidence?.by_assessment_type?.control
                  ),
                ],
                [
                  "Maturity evidence",
                  number(
                    evidence?.by_assessment_type?.maturity
                  ),
                ],
              ]}
            />

            <SignalCard
              title="Remediation"
              value={activeRemediation}
              primaryLabel="Active items"
              rows={[
                [
                  "Overdue",
                  number(
                    remediation?.summary?.overdue
                  ),
                ],
                [
                  "High priority",
                  number(
                    remediation?.summary?.high_priority
                  ),
                ],
                [
                  "Awaiting review",
                  number(
                    remediation?.summary
                      ?.awaiting_review
                  ),
                ],
                [
                  "Completed",
                  number(
                    remediation?.summary?.completed
                  ),
                ],
              ]}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-950">
              Executive Attention
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Direct attention signals derived from canonical framework,
              risk, and remediation state. No composite readiness score
              is applied.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {controls.map(({ adoption, kpi }) => {
              const partial = number(kpi?.controls?.partial);
              const notCovered = number(
                kpi?.controls?.not_covered
              );

              if (partial <= 0 && notCovered <= 0) {
                return null;
              }

              return (
                <AttentionRow
                  key={`attention-control-${
                    adoption.adoption_id ??
                    adoption.standard_id
                  }`}
                  category="Control-Based"
                  title={`${frameworkLabel(
                    adoption
                  )} control coverage requires attention`}
                  detail={`${notCovered} not covered ? ${partial} partial`}
                  href={`/matrix?standard_id=${
                    adoption.standard_id ?? ""
                  }`}
                />
              );
            })}

            {maturityFrameworks.map((framework) => {
              const total = number(
                framework.total_processes
              );

              const measured = number(
                framework.measured_processes
              );

              const unassessed = number(
                framework.unassessed_processes
              );

              if (unassessed <= 0) {
                return null;
              }

              return (
                <AttentionRow
                  key={`attention-maturity-${
                    framework.adoption_id ??
                    framework.standard_id
                  }`}
                  category="Maturity-Based"
                  title={`${
                    framework.standard_code ||
                    `Standard ${
                      framework.standard_id ?? "-"
                    }`
                  } assessment coverage requires attention`}
                  detail={`${measured} of ${total} adoption processes measured ? ${unassessed} unassessed`}
                />
              );
            })}

            {number(remediation?.summary?.overdue) > 0 ? (
              <AttentionRow
                category="Remediation"
                title="Overdue remediation requires attention"
                detail={`${number(
                  remediation?.summary?.overdue
                )} overdue ? ${number(
                  remediation?.summary?.high_priority
                )} high priority`}
                href="/company/remediation"
              />
            ) : null}

            {openRisks > 0 ? (
              <AttentionRow
                category="Risk"
                title="Open risk exposure requires attention"
                detail={`${openRisks} open risks`}
                href="/risks"
              />
            ) : null}

            {controls.every(
              ({ kpi }) =>
                number(kpi?.controls?.partial) === 0 &&
                number(kpi?.controls?.not_covered) === 0
            ) &&
            maturityFrameworks.every(
              (framework) =>
                number(
                  framework.unassessed_processes
                ) === 0
            ) &&
            number(remediation?.summary?.overdue) === 0 &&
            openRisks === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">
                No canonical attention signals are currently present.
              </div>
            ) : null}
          </div>
        </section>

      </div>
    </main>
  );
}

function AttentionRow({
  category,
  title,
  detail,
  href,
}: {
  category: string;
  title: string;
  detail: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <AlertTriangle className="h-4 w-4 text-slate-600" />
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {category}
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-950">
            {title}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {detail}
          </div>
        </div>
      </div>

      {href ? (
        <a
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open
        </a>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>

        <span className="text-slate-500">
          {icon}
        </span>
      </div>

      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {detail}
      </div>
    </article>
  );
}

function FrameworkHeader({
  code,
  type,
}: {
  code: string;
  type: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-slate-950">
          {code}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          Active framework adoption
        </p>
      </div>

      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600">
        {type}
      </span>
    </div>
  );
}

function ProgressBar({
  value,
  className = "",
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const normalized =
    value == null
      ? 0
      : Math.max(0, Math.min(100, Number(value)));

  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-slate-200 ${className}`}
    >
      <div
        className="h-full rounded-full bg-slate-700 transition-all"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}

function ReadinessMeasure({
  label,
  value,
  detail,
  emphasizeCoverage = false,
}: {
  label: string;
  value: number | null | undefined;
  detail: string;
  emphasizeCoverage?: boolean;
}) {
  return (
    <div
      className={
        emphasizeCoverage
          ? "rounded-xl border border-slate-300 bg-white p-4"
          : ""
      }
    >
      <div className="flex items-end justify-between gap-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>

        <div
          className={
            emphasizeCoverage
              ? "text-3xl font-semibold tracking-tight text-slate-950"
              : "text-2xl font-semibold tracking-tight text-slate-900"
          }
        >
          {percent(value)}
        </div>
      </div>

      <ProgressBar
        value={value}
        className="mt-3"
      />

      <div
        className={
          emphasizeCoverage
            ? "mt-3 text-sm font-medium text-slate-700"
            : "mt-2 text-xs text-slate-500"
        }
      >
        {detail}
      </div>
    </div>
  );
}

function BreakdownMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold text-slate-950">
        {value}
      </div>
    </div>
  );
}

function SignalCard({
  title,
  value,
  primaryLabel,
  rows,
}: {
  title: string;
  value: number;
  primaryLabel: string;
  rows: Array<[string, number]>;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">
        {title}
      </h3>

      <div className="mt-5">
        <div className="text-3xl font-semibold tracking-tight text-slate-950">
          {value}
        </div>

        <div className="mt-1 text-xs text-slate-500">
          {primaryLabel}
        </div>
      </div>

      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {rows.map(([label, rowValue]) => (
          <div
            key={label}
            className="flex items-center justify-between py-3 text-sm"
          >
            <span className="text-slate-500">
              {label}
            </span>

            <span className="font-semibold text-slate-900">
              {rowValue}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
