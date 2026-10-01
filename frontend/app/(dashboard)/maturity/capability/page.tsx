"use client";

import {
  Activity,
  ArrowRight,
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

type CapabilityRow = {
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

  const evaluated = attributes.filter(
    (attribute) =>
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

export default function MaturityCapabilityPage() {
  const router = useRouter();

  const [assessments, setAssessments] =
    useState<PamAssessment[]>([]);
  const [assessmentId, setAssessmentId] =
    useState<number | null>(null);
  const [rows, setRows] = useState<CapabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [capabilityLoading, setCapabilityLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (item) => item.id === assessmentId
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
        const body = await response.text();
        throw new Error(
          body ||
            `Assessment request failed: ${response.status}`
        );
      }

      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : [];

      setAssessments(items);

      if (items.length) {
        setAssessmentId((current) => {
          if (
            current &&
            items.some(
              (item: PamAssessment) =>
                item.id === current
            )
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

  const loadCapability = useCallback(async () => {
    if (!assessmentId) {
      setRows([]);
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      return;
    }

    setCapabilityLoading(true);
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
        const body = await processResponse.text();
        throw new Error(
          body ||
            `Process request failed: ${processResponse.status}`
        );
      }

      const processPayload =
        (await processResponse.json()) as PamProcess[];

      const processes = Array.isArray(processPayload)
        ? processPayload
        : [];

      const capabilityRows = await Promise.all(
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

      setRows(capabilityRows);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Capability data could not be loaded."
      );
    } finally {
      setCapabilityLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  useEffect(() => {
    if (assessmentId) {
      void loadCapability();
    }
  }, [assessmentId, loadCapability]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter(({ process }) => {
      const text = [
        process.pam_process.code,
        process.pam_process.name,
        process.process_group.code,
        process.process_group.name,
        process.process_category.code,
        process.process_category.name,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [rows, search]);

  const metrics = useMemo(() => {
    let targetMet = 0;
    let gap = 0;
    let evaluated = 0;
    let total = 0;

    for (const row of rows) {
      const current = deriveCurrentCapability(
        row.capability
      );

      const target =
        row.process.target_capability_level ?? null;

      if (
        target !== null &&
        current !== null &&
        current >= target
      ) {
        targetMet += 1;
      }

      if (
        target !== null &&
        (current === null || current < target)
      ) {
        gap += 1;
      }

      const coverage = getCoverage(row.capability);

      evaluated += coverage.evaluated;
      total += coverage.total;
    }

    return {
      targetMet,
      gap,
      coverage: total
        ? Math.round((evaluated / total) * 100)
        : 0,
    };
  }, [rows]);

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
                Capability Management
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Monitor process capability, target attainment,
                assessment coverage and capability gaps within
                the selected maturity assessment.
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
                onClick={() => void loadCapability()}
                disabled={
                  !assessmentId || capabilityLoading
                }
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    capabilityLoading
                      ? "animate-spin"
                      : ""
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
            icon={Activity}
            label="Processes"
            value={String(rows.length)}
            detail="Processes in the selected assessment"
          />

          <MetricCard
            icon={CheckCircle2}
            label="Target Attainment"
            value={String(metrics.targetMet)}
            detail="Processes currently meeting target"
          />

          <MetricCard
            icon={CircleAlert}
            label="Capability Gap"
            value={String(metrics.gap)}
            detail="Processes below their target level"
          />

          <MetricCard
            icon={Gauge}
            label="Assessment Coverage"
            value={`${metrics.coverage}%`}
            detail="Process attributes with a recorded rating"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Process Capability Register
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Consolidated capability position for the
                selected assessment.
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

          {loading || capabilityLoading ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              Loading capability data...
            </div>
          ) : !filteredRows.length ? (
            <div className="px-6 py-16 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-300" />
              <div className="mt-3 text-sm font-medium text-slate-700">
                No capability processes available
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Add processes to the selected maturity
                assessment to begin capability evaluation.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
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
                      Coverage
                    </th>
                    <th className="px-5 py-3">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map(
                    ({ process, capability }) => {
                      const current =
                        deriveCurrentCapability(
                          capability
                        );

                      const target =
                        process.target_capability_level ??
                        null;

                      const gap =
                        target === null
                          ? null
                          : Math.max(
                              target - (current ?? 0),
                              0
                            );

                      const coverage =
                        getCoverage(capability);

                      return (
                        <tr
                          key={process.id}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {process.pam_process.code}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {process.pam_process.name}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-sm text-slate-700">
                              {
                                process.process_category
                                  .name
                              }
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {process.process_group.name}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex min-w-9 justify-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700">
                              {current ?? "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex min-w-9 justify-center rounded-lg bg-indigo-50 px-2.5 py-1.5 text-sm font-semibold text-indigo-700">
                              {target ?? "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {gap === null ? (
                              <span className="text-slate-400">
                                -
                              </span>
                            ) : gap === 0 ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Met
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                -{gap}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-indigo-500"
                                  style={{
                                    width: `${coverage.percent}%`,
                                  }}
                                />
                              </div>

                              <span className="text-xs font-medium text-slate-600">
                                {coverage.percent}%
                              </span>
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {coverage.evaluated}/
                              {coverage.total} rated
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                              {normalizeStatus(
                                process.status
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/maturity/workspace/${assessmentId}/process/${process.id}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                            >
                              Open
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
