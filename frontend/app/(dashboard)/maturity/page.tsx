"use client";

import {
  Activity,
  ArrowRight,
  Boxes,
  ClipboardCheck,
  Layers3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type MaturityContext = {
  tenant_id: number;
  framework_adoption_id: number;
  standard_id: number;
  standard_version_id: number;
  standard_code: string;
  standard_type: string;
  version_code: string;
  pam_framework_model_id: number;
  pam_framework_model_code: string;
  capability_framework_model_id: number;
  capability_framework_model_code: string;
};

type PamAssessment = {
  id: number;
  tenant_id: number;
  framework_adoption_id: number;
  framework_model_id: number;
  name: string;
  scope?: string | null;
  status: string;
  assessor_user_id?: number | null;
  sponsor_user_id?: number | null;
  audit_plan_id?: number | null;
  created_at: string;
  updated_at: string;
  context?: MaturityContext | null;
};

type FrameworkPortfolioItem = {
  adoptionId: number;
  standardId: number;
  standardVersionId: number;
  standardCode: string;
  standardTitle: string;
  versionCode: string;
  adoptionStatus: string;
  pamModelId: number;
  pamModelCode: string;
  capabilityModelId: number;
  capabilityModelCode: string;
};

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as any).items)
  ) {
    return (value as any).items;
  }

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as any).data)
  ) {
    return (value as any).data;
  }

  return [];
}

function statusLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusClass(value?: string | null) {
  const normalized = String(value || "").toUpperCase();

  if (
    normalized === "ACTIVE" ||
    normalized === "APPROVED" ||
    normalized === "COMPLETED"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized === "DRAFT" ||
    normalized === "PLANNED" ||
    normalized === "OPEN"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    normalized === "SUSPENDED" ||
    normalized === "ARCHIVED" ||
    normalized === "CANCELLED"
  ) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function MaturityOverviewPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [frameworks, setFrameworks] = useState<FrameworkPortfolioItem[]>([]);
  const [assessments, setAssessments] = useState<PamAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedToken =
      window.localStorage.getItem("access_token") ||
      window.localStorage.getItem("token") ||
      "";

    if (!storedToken) {
      router.replace("/login");
      return;
    }

    setToken(storedToken);
  }, [router]);

  const loadOverview = useCallback(
    async (silent = false) => {
      if (!token) {
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const adoptionResponse = await fetch(
          `${API_BASE}/framework/adoptions`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!adoptionResponse.ok) {
          throw new Error(
            `Framework adoption request failed with ${adoptionResponse.status}.`
          );
        }

        const adoptionPayload = await adoptionResponse.json();
        const rawAdoptions = asArray(adoptionPayload);

        const adoptionIds = rawAdoptions
          .map((item: any) =>
            Number(
              item?.id ??
                item?.adoption_id ??
                item?.framework_adoption_id
            )
          )
          .filter(
            (value: number) =>
              Number.isInteger(value) && value > 0
          );

        const resolvedFrameworks = await Promise.all(
          adoptionIds.map(async (adoptionId: number) => {
            const response = await fetch(
              `${API_BASE}/framework/adoptions/${adoptionId}/resolved`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!response.ok) {
              return null;
            }

            const payload = await response.json();

            const adoption =
              payload?.adoption ??
              payload?.framework_adoption ??
              {};

            const standard = payload?.standard ?? {};
            const version =
              payload?.standard_version ??
              payload?.version ??
              {};

            const standardType = String(
              standard?.type ??
                standard?.standard_type ??
                payload?.standard_type ??
                ""
            ).toUpperCase();

            if (standardType !== "MATURITY_BASED") {
              return null;
            }

            const context =
              payload?.maturity_context ??
              payload?.context ??
              {};

            const pamModel =
              payload?.pam_framework_model ??
              payload?.pam_model ??
              {};

            const capabilityModel =
              payload?.capability_framework_model ??
              payload?.capability_model ??
              {};

            return {
              adoptionId,
              standardId: Number(
                standard?.id ??
                  adoption?.standard_id ??
                  context?.standard_id ??
                  0
              ),
              standardVersionId: Number(
                version?.id ??
                  adoption?.standard_version_id ??
                  context?.standard_version_id ??
                  0
              ),
              standardCode: String(
                standard?.code ??
                  context?.standard_code ??
                  "Maturity Framework"
              ),
              standardTitle: String(
                standard?.title ??
                  standard?.name ??
                  standard?.code ??
                  context?.standard_code ??
                  "Maturity Framework"
              ),
              versionCode: String(
                version?.version_code ??
                  version?.code ??
                  context?.version_code ??
                  ""
              ),
              adoptionStatus: String(
                adoption?.status ??
                  payload?.status ??
                  ""
              ),
              pamModelId: Number(
                pamModel?.id ??
                  context?.pam_framework_model_id ??
                  0
              ),
              pamModelCode: String(
                pamModel?.code ??
                  context?.pam_framework_model_code ??
                  ""
              ),
              capabilityModelId: Number(
                capabilityModel?.id ??
                  context?.capability_framework_model_id ??
                  0
              ),
              capabilityModelCode: String(
                capabilityModel?.code ??
                  context?.capability_framework_model_code ??
                  ""
              ),
            } satisfies FrameworkPortfolioItem;
          })
        );

        const maturityFrameworks = resolvedFrameworks.filter(
          (
            item
          ): item is FrameworkPortfolioItem =>
            item !== null
        );

        const assessmentResponse = await fetch(
          `${API_BASE}/pam/assessments`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!assessmentResponse.ok) {
          throw new Error(
            `Assessment request failed with ${assessmentResponse.status}.`
          );
        }

        const assessmentPayload =
          await assessmentResponse.json();

        const rawAssessments =
          asArray(assessmentPayload) as PamAssessment[];

        const maturityAdoptionIds = new Set(
          maturityFrameworks.map(
            (item) => item.adoptionId
          )
        );

        const scopedAssessments =
          rawAssessments.filter((assessment) =>
            maturityAdoptionIds.has(
              Number(assessment.framework_adoption_id)
            )
          );

        setFrameworks(maturityFrameworks);
        setAssessments(scopedAssessments);
      } catch (cause) {
        setFrameworks([]);
        setAssessments([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Maturity overview could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const frameworkMap = useMemo(
    () =>
      new Map(
        frameworks.map((item) => [
          item.adoptionId,
          item,
        ])
      ),
    [frameworks]
  );

  const activeFrameworkCount = useMemo(
    () =>
      frameworks.filter(
        (item) =>
          item.adoptionStatus.toUpperCase() ===
          "ACTIVE"
      ).length,
    [frameworks]
  );

  const draftAssessmentCount = useMemo(
    () =>
      assessments.filter(
        (item) =>
          item.status.toUpperCase() === "DRAFT"
      ).length,
    [assessments]
  );

  const assessmentCountByAdoption = useMemo(() => {
    const result = new Map<number, number>();

    assessments.forEach((assessment) => {
      const adoptionId = Number(
        assessment.framework_adoption_id
      );

      result.set(
        adoptionId,
        (result.get(adoptionId) || 0) + 1
      );
    });

    return result;
  }, [assessments]);

  const metrics = [
    {
      label: "Maturity Frameworks",
      value: frameworks.length,
      description: "Tenant-scoped maturity adoptions",
      icon: Layers3,
    },
    {
      label: "Assessments",
      value: assessments.length,
      description: "Canonical PAM assessments",
      icon: ClipboardCheck,
    },
    {
      label: "Active Frameworks",
      value: activeFrameworkCount,
      description: "Active maturity adoptions",
      icon: ShieldCheck,
    },
    {
      label: "Draft Assessments",
      value: draftAssessmentCount,
      description: "Assessments in draft state",
      icon: Activity,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-full bg-[#f6f8fc] px-6 py-8 lg:px-10">
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading maturity portfolio...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f6f8fc] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1600px] space-y-7">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Maturity Management
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Maturity Overview
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Tenant-scoped maturity frameworks and canonical PAM assessment portfolio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void loadOverview(true)
              }
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/maturity/workspace")
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Boxes className="h-4 w-4" />
              Open Workspace
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                key={metric.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {metric.label}
                    </div>

                    <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                      {metric.value}
                    </div>

                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      {metric.description}
                    </div>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Framework Portfolio
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Resolved maturity framework adoptions available to the current tenant.
              </p>
            </div>

            <div className="text-xs font-medium text-slate-500">
              {frameworks.length} framework
              {frameworks.length === 1 ? "" : "s"}
            </div>
          </div>

          {frameworks.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              No canonical maturity framework adoption is available for this tenant.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {[
                      "Framework",
                      "Version",
                      "Adoption",
                      "PAM Model",
                      "Capability Model",
                      "Assessments",
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {frameworks.map((framework) => (
                    <tr
                      key={framework.adoptionId}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {framework.standardCode}
                        </div>

                        <div className="mt-1 max-w-md text-xs text-slate-500">
                          {framework.standardTitle}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {framework.versionCode || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                            framework.adoptionStatus
                          )}`}
                        >
                          {statusLabel(
                            framework.adoptionStatus
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {framework.pamModelCode || "-"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {framework.capabilityModelCode ||
                          "-"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {assessmentCountByAdoption.get(
                          framework.adoptionId
                        ) || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Assessment Portfolio
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Canonical PAM assessments linked to the tenant maturity framework portfolio.
              </p>
            </div>

            <div className="text-xs font-medium text-slate-500">
              {assessments.length} assessment
              {assessments.length === 1 ? "" : "s"}
            </div>
          </div>

          {assessments.length === 0 ? (
            <div className="px-6 py-10">
              <div className="text-sm font-medium text-slate-700">
                No canonical PAM assessments found.
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push("/maturity/workspace")
                }
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open Maturity Workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {[
                      "Assessment",
                      "Framework",
                      "Version",
                      "Scope",
                      "Status",
                      "Updated",
                      "",
                    ].map((label, index) => (
                      <th
                        key={`${label}-${index}`}
                        className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {assessments.map((assessment) => {
                    const framework =
                      frameworkMap.get(
                        Number(
                          assessment.framework_adoption_id
                        )
                      );

                    return (
                      <tr
                        key={assessment.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-900">
                            {assessment.name}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Assessment #{assessment.id}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-700">
                          {framework?.standardCode ??
                            assessment.context
                              ?.standard_code ??
                            "-"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-700">
                          {framework?.versionCode ??
                            assessment.context
                              ?.version_code ??
                            "-"}
                        </td>

                        <td className="px-6 py-4">
                          <div className="max-w-xs truncate text-sm text-slate-600">
                            {assessment.scope || "-"}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                              assessment.status
                            )}`}
                          >
                            {statusLabel(
                              assessment.status
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(
                            assessment.updated_at
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/maturity/workspace/${assessment.id}`
                              )
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Open
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
