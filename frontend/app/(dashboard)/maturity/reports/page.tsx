"use client";

import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Gauge,
  RefreshCw,
  Search,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type PamAssessment = {
  id: number;
  name: string;
  scope?: string | null;
  status: string;
  framework_adoption_id: number;
  context?: {
    standard_code?: string;
    version_code?: string;
    capability_framework_model_code?: string;
  } | null;
};

type PamProcess = {
  id: number;
  assessment_id: number;
  pam_process_id: number;
  in_scope: boolean;
  target_capability_level?: number | null;
  status: string;
  pam_process: {
    id: number;
    code: string;
    name: string;
  };
  process_group: {
    id: number;
    code: string;
    name: string;
  };
  process_category: {
    id: number;
    code: string;
    name: string;
  };
};

type ProcessAttribute = {
  id: number;
  code: string;
  name: string;
  evaluation?: {
    rating?: string | null;
    status?: string | null;
  } | null;
};

type CapabilityLevel = {
  id: number;
  level: number;
  code: string;
  name: string;
  is_target: boolean;
  process_attributes: ProcessAttribute[];
};

type CapabilityProjection = {
  assessment_id: number;
  assessment_process_id: number;
  pam_process_id: number;
  process_code: string;
  process_name: string;
  target_capability_level?: number | null;
  capability_levels: CapabilityLevel[];
};

type ReportRow = {
  process: PamProcess;
  capability: CapabilityProjection | null;
};

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
  const normalized = String(value || "")
    .trim()
    .replaceAll("_", " ");

  if (!normalized) {
    return "Unknown";
  }

  return normalized.replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );
}

function isPositiveRating(value?: string | null) {
  const rating = String(value || "")
    .trim()
    .toUpperCase();

  return (
    rating === "F" ||
    rating === "L" ||
    rating === "FULLY" ||
    rating === "LARGELY" ||
    rating === "FULLY ACHIEVED" ||
    rating === "LARGELY ACHIEVED"
  );
}

function deriveCurrentCapability(
  capability: CapabilityProjection | null
) {
  if (!capability) {
    return null;
  }

  let achieved: number | null = null;

  const levels = [...(capability.capability_levels || [])].sort(
    (a, b) => a.level - b.level
  );

  for (const level of levels) {
    const attributes = level.process_attributes || [];

    if (!attributes.length) {
      continue;
    }

    const levelAchieved = attributes.every((attribute) =>
      isPositiveRating(attribute.evaluation?.rating)
    );

    if (!levelAchieved) {
      break;
    }

    achieved = level.level;
  }

  return achieved;
}

function getCoverage(capability: CapabilityProjection | null) {
  if (!capability) {
    return {
      evaluated: 0,
      total: 0,
      percent: 0,
    };
  }

  const attributes = capability.capability_levels.flatMap(
    (level) => level.process_attributes || []
  );

  const evaluated = attributes.filter((attribute) =>
    Boolean(attribute.evaluation?.rating)
  ).length;

  const total = attributes.length;

  return {
    evaluated,
    total,
    percent: total
      ? Math.round((evaluated / total) * 100)
      : 0,
  };
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
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

      <div className="mt-4 text-xs text-slate-500">
        {detail}
      </div>
    </div>
  );
}

export default function MaturityReportsPage() {
  const router = useRouter();

  const [assessments, setAssessments] =
    useState<PamAssessment[]>([]);

  const [assessmentId, setAssessmentId] =
    useState<number | null>(null);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (assessment) => assessment.id === assessmentId
      ) || null,
    [assessments, assessmentId]
  );

  const loadAssessments = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Assessment request failed: ${response.status}`
        );
      }

      const payload = await response.json();
      const items: PamAssessment[] =
        Array.isArray(payload) ? payload : [];

      setAssessments(items);

      if (items.length) {
        setAssessmentId((current) => {
          if (
            current &&
            items.some((item) => item.id === current)
          ) {
            return current;
          }

          return items[0].id;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Assessments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!assessmentId) {
      setRows([]);
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      return;
    }

    setReportLoading(true);
    setError("");

    try {
      const processResponse = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!processResponse.ok) {
        throw new Error(
          `Process request failed: ${processResponse.status}`
        );
      }

      const processPayload = await processResponse.json();

      const processes: PamProcess[] =
        Array.isArray(processPayload)
          ? processPayload
          : [];

      const reportRows = await Promise.all(
        processes.map(async (process) => {
          const response = await fetch(
            `${API_BASE}/pam/assessments/${assessmentId}/processes/${process.id}/capability`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );

          if (!response.ok) {
            return {
              process,
              capability: null,
            };
          }

          return {
            process,
            capability:
              (await response.json()) as CapabilityProjection,
          };
        })
      );

      setRows(reportRows);
    } catch (err) {
      setRows([]);

      setError(
        err instanceof Error
          ? err.message
          : "Maturity report could not be loaded."
      );
    } finally {
      setReportLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  useEffect(() => {
    if (assessmentId) {
      void loadReport();
    }
  }, [assessmentId, loadReport]);

  const report = useMemo(() => {
    let targetDefined = 0;
    let targetMet = 0;
    let evaluatedAttributes = 0;
    let totalAttributes = 0;
    let currentTotal = 0;
    let currentCount = 0;
    let targetTotal = 0;

    const distribution = new Map<number, number>();

    const calculatedRows = rows.map((row) => {
      const current = deriveCurrentCapability(
        row.capability
      );

      const target =
        row.process.target_capability_level ?? null;

      const coverage = getCoverage(row.capability);

      evaluatedAttributes += coverage.evaluated;
      totalAttributes += coverage.total;

      if (current !== null) {
        currentTotal += current;
        currentCount += 1;

        distribution.set(
          current,
          (distribution.get(current) || 0) + 1
        );
      }

      if (target !== null) {
        targetDefined += 1;
        targetTotal += target;

        if (current !== null && current >= target) {
          targetMet += 1;
        }
      }

      return {
        ...row,
        current,
        target,
        gap:
          target === null
            ? null
            : Math.max(target - (current ?? 0), 0),
        coverage,
      };
    });

    const averageCurrent =
      currentCount > 0
        ? currentTotal / currentCount
        : null;

    const averageTarget =
      targetDefined > 0
        ? targetTotal / targetDefined
        : null;

    const assessmentCoverage =
      totalAttributes > 0
        ? Math.round(
            (evaluatedAttributes / totalAttributes) * 100
          )
        : 0;

    const targetAttainment =
      targetDefined > 0
        ? Math.round((targetMet / targetDefined) * 100)
        : 0;

    return {
      calculatedRows,
      targetDefined,
      targetMet,
      averageCurrent,
      averageTarget,
      assessmentCoverage,
      targetAttainment,
      evaluatedAttributes,
      totalAttributes,
      distribution,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return report.calculatedRows;
    }

    return report.calculatedRows.filter(({ process }) =>
      [
        process.pam_process.code,
        process.pam_process.name,
        process.process_category.name,
        process.process_group.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [report.calculatedRows, search]);

  const distributionRows = useMemo(() => {
    const levels = new Set<number>();

    rows.forEach(({ capability }) => {
      capability?.capability_levels.forEach((level) => {
        levels.add(level.level);
      });
    });

    return [...levels]
      .sort((a, b) => a - b)
      .map((level) => ({
        level,
        count: report.distribution.get(level) || 0,
      }));
  }, [rows, report.distribution]);

  const maxDistribution = Math.max(
    1,
    ...distributionRows.map((item) => item.count)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Maturity Workspace
              </div>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Maturity Reporting
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Consolidated assessment, capability, target
                attainment and process attribute coverage
                reporting for the selected maturity assessment.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assessment
                </label>

                <select
                  value={assessmentId ?? ""}
                  onChange={(event) =>
                    setAssessmentId(
                      Number(event.target.value) || null
                    )
                  }
                  className="min-w-[300px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
                >
                  {!assessments.length ? (
                    <option value="">
                      No assessments available
                    </option>
                  ) : null}

                  {assessments.map((assessment) => (
                    <option
                      key={assessment.id}
                      value={assessment.id}
                    >
                      {assessment.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void loadReport()}
                disabled={!assessmentId || reportLoading}
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    reportLoading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>
            </div>
          </div>

          {selectedAssessment ? (
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                {selectedAssessment.context?.standard_code ||
                  "Maturity Framework"}
              </span>

              {selectedAssessment.context?.version_code ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  Version{" "}
                  {selectedAssessment.context.version_code}
                </span>
              ) : null}

              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                {normalizeStatus(
                  selectedAssessment.status
                )}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-7 lg:px-8">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Gauge}
            label="Average Capability"
            value={
              report.averageCurrent === null
                ? "-"
                : report.averageCurrent.toFixed(1)
            }
            detail={
              report.averageTarget === null
                ? "No target capability defined"
                : `Average target ${report.averageTarget.toFixed(
                    1
                  )}`
            }
          />

          <MetricCard
            icon={Target}
            label="Target Attainment"
            value={`${report.targetAttainment}%`}
            detail={`${report.targetMet} of ${report.targetDefined} targeted processes meet target`}
          />

          <MetricCard
            icon={CheckCircle2}
            label="Assessment Coverage"
            value={`${report.assessmentCoverage}%`}
            detail={`${report.evaluatedAttributes} of ${report.totalAttributes} process attributes rated`}
          />

          <MetricCard
            icon={CircleAlert}
            label="Capability Gaps"
            value={String(
              report.calculatedRows.filter(
                (row) =>
                  row.gap !== null && row.gap > 0
              ).length
            )}
            detail="Processes currently below target capability"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />

              <h2 className="text-lg font-semibold text-slate-950">
                Capability Distribution
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Number of assessed processes at each achieved
              capability level.
            </p>

            <div className="mt-6 space-y-4">
              {distributionRows.length ? (
                distributionRows.map((item) => {
                  const width =
                    (item.count / maxDistribution) * 100;

                  return (
                    <div key={item.level}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          Level {item.level}
                        </span>

                        <span className="font-semibold text-slate-950">
                          {item.count}
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  No capability distribution available.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Capability Gap Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Processes with the largest difference between
              current and target capability.
            </p>

            <div className="mt-5 space-y-3">
              {report.calculatedRows
                .filter(
                  (row) =>
                    row.gap !== null && row.gap > 0
                )
                .sort(
                  (a, b) =>
                    (b.gap || 0) - (a.gap || 0)
                )
                .slice(0, 6)
                .map((row) => (
                  <button
                    key={row.process.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/maturity/workspace/${assessmentId}/process/${row.process.id}`
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {row.process.pam_process.code}
                      </div>

                      <div className="truncate text-xs text-slate-500">
                        {row.process.pam_process.name}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {row.current ?? "-"} /{" "}
                        {row.target ?? "-"}
                      </span>

                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Gap {row.gap}
                      </span>

                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))}

              {!report.calculatedRows.some(
                (row) =>
                  row.gap !== null && row.gap > 0
              ) ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No capability gaps identified.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Process Performance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current capability, target capability and
                assessment coverage by process.
              </p>
            </div>

            <div className="relative w-full lg:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search process..."
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {loading || reportLoading ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              Loading maturity report...
            </div>
          ) : !filteredRows.length ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No maturity process data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">
                      Process
                    </th>
                    <th className="px-5 py-3">
                      Category
                    </th>
                    <th className="px-5 py-3 text-center">
                      Current
                    </th>
                    <th className="px-5 py-3 text-center">
                      Target
                    </th>
                    <th className="px-5 py-3 text-center">
                      Gap
                    </th>
                    <th className="px-5 py-3">
                      PA Coverage
                    </th>
                    <th className="px-5 py-3 text-right">
                      Detail
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.process.id}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {row.process.pam_process.code}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {row.process.pam_process.name}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm text-slate-700">
                          {
                            row.process.process_category
                              .name
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {row.process.process_group.name}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center font-semibold text-slate-800">
                        {row.current ?? "-"}
                      </td>

                      <td className="px-5 py-4 text-center font-semibold text-indigo-700">
                        {row.target ?? "-"}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {row.gap === null ? (
                          <span className="text-slate-400">
                            -
                          </span>
                        ) : row.gap === 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Met
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            -{row.gap}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{
                                width: `${row.coverage.percent}%`,
                              }}
                            />
                          </div>

                          <span className="text-xs font-medium text-slate-600">
                            {row.coverage.percent}%
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/maturity/workspace/${assessmentId}/process/${row.process.id}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
