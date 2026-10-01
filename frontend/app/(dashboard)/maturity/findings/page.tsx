"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";

import MaturityAuditFindingWorkspace from "../workspace/[sessionId]/process/[assessmentProcessId]/MaturityAuditFindingWorkspace";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type AssessmentContext = {
  tenant_id: number;
  framework_adoption_id: number;
  standard_id: number;
  standard_version_id: number;
  standard_code: string;
  standard_type: string;
  version_code: string;
};

type Assessment = {
  id: number;
  name: string;
  status: string;
  context: AssessmentContext;
};

type AuditTarget = {
  id: number;
  tenant_id: number;
  audit_plan_id: number;
  pam_assessment_id: number;
  assessment_process_id: number;
  process_attribute_id: number;
  standard_indicator_id?: number | null;
  status: string;
  audit_plan_reference?: string | null;
  audit_plan_name?: string | null;
  process_attribute_code?: string | null;
  process_attribute_name?: string | null;
  indicator_code?: string | null;
  indicator_name?: string | null;
};

type Finding = {
  id: number;
  tenant_id: number;
  audit_plan_id: number;
  audit_maturity_target_id: number;
  created_by: number;
  assigned_owner_id?: number | null;
  process_manager_id?: number | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  due_date?: string | null;
  root_cause?: string | null;
  corrective_action_plan?: string | null;
  implementation_status?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
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

function displayStatus(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function severityClass(value?: string | null) {
  const severity = (value || "").toUpperCase();

  if (severity === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (severity === "HIGH") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (severity === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusClass(value?: string | null) {
  const status = (value || "").toUpperCase();

  if (status === "CLOSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "VERIFICATION_FAILED" ||
    status === "REVISION_REQUIRED"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    status === "READY_FOR_VERIFICATION" ||
    status === "SUBMITTED_FOR_REVIEW" ||
    status === "PLAN_APPROVED"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function MaturityFindingsContent() {
  const searchParams = useSearchParams();
  const workflowRef = useRef<HTMLDivElement | null>(null);

  const requestedAssessmentId =
    searchParams.get("assessment_id");

  const requestedAuditTargetId =
    searchParams.get("audit_target_id");

  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  const [assessmentId, setAssessmentId] =
    useState("");

  const [targets, setTargets] =
    useState<AuditTarget[]>([]);

  const [findings, setFindings] =
    useState<Finding[]>([]);

  const [selectedTargetId, setSelectedTargetId] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (item) =>
          item.id === Number(assessmentId)
      ) || null,
    [assessments, assessmentId]
  );

  const targetMap = useMemo(
    () =>
      new Map(
        targets.map((target) => [
          target.id,
          target,
        ])
      ),
    [targets]
  );

  const selectedTarget = useMemo(
    () =>
      targets.find(
        (target) =>
          target.id === Number(selectedTargetId)
      ) || null,
    [targets, selectedTargetId]
  );

  const visibleFindings = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return findings.filter((finding) => {
      if (
        statusFilter &&
        finding.status !== statusFilter
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const target = targetMap.get(
        finding.audit_maturity_target_id
      );

      const haystack = [
        finding.title,
        finding.description,
        finding.severity,
        finding.status,
        target?.audit_plan_reference,
        target?.audit_plan_name,
        target?.process_attribute_code,
        target?.indicator_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [
    findings,
    search,
    statusFilter,
    targetMap,
  ]);

  const openCount = findings.filter(
    (item) => item.status !== "CLOSED"
  ).length;

  const reviewCount = findings.filter(
    (item) =>
      item.status === "SUBMITTED_FOR_REVIEW" ||
      item.status === "REVISION_REQUIRED"
  ).length;

  const verificationCount = findings.filter(
    (item) =>
      item.status === "READY_FOR_VERIFICATION" ||
      item.status === "VERIFICATION_FAILED"
  ).length;

  const closedCount = findings.filter(
    (item) => item.status === "CLOSED"
  ).length;

  const loadAssessments = useCallback(
    async () => {
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

        const data =
          (await response.json()) as Assessment[];

        setAssessments(data);

        setAssessmentId((current) => {
          if (
            requestedAssessmentId &&
            data.some(
              (item) =>
                item.id === Number(requestedAssessmentId)
            )
          ) {
            return requestedAssessmentId;
          }

          if (
            current &&
            data.some(
              (item) =>
                item.id === Number(current)
            )
          ) {
            return current;
          }

          return data.length
            ? String(data[0].id)
            : "";
        });
      } catch (err) {
        setAssessments([]);

        setError(
          err instanceof Error
            ? err.message
            : "Assessments could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      requestedAssessmentId,
    ]
  );

  const loadAssessmentData = useCallback(
    async (selectedAssessmentId: number) => {
      const token = getToken();

      if (!token) {
        setError(
          "Authentication token is not available."
        );
        return;
      }

      setDetailLoading(true);
      setError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const errors: string[] = [];

      let nextTargets: AuditTarget[] = [];

      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments/${selectedAssessmentId}/audit-targets`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Audit target request failed: ${response.status}`
          );
        }

        nextTargets =
          (await response.json()) as AuditTarget[];

        setTargets(nextTargets);
      } catch (err) {
        setTargets([]);
        setSelectedTargetId("");

        errors.push(
          err instanceof Error
            ? `Targets: ${err.message}`
            : "Targets: request failed."
        );
      }

      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments/${selectedAssessmentId}/audit-findings`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Finding request failed: ${response.status}`
          );
        }

        const nextFindings =
          (await response.json()) as Finding[];

        setFindings(nextFindings);

        setSelectedTargetId((current) => {
          if (
            requestedAuditTargetId &&
            nextTargets.some(
              (target) =>
                target.id === Number(requestedAuditTargetId)
            )
          ) {
            return requestedAuditTargetId;
          }

          if (
            current &&
            nextTargets.some(
              (target) =>
                target.id === Number(current)
            )
          ) {
            return current;
          }

          const firstFindingTargetId =
            nextFindings.find((finding) =>
              nextTargets.some(
                (target) =>
                  target.id ===
                  finding.audit_maturity_target_id
              )
            )?.audit_maturity_target_id;

          if (firstFindingTargetId) {
            return String(firstFindingTargetId);
          }

          return nextTargets.length
            ? String(nextTargets[0].id)
            : "";
        });
      } catch (err) {
        setFindings([]);

        errors.push(
          err instanceof Error
            ? `Findings: ${err.message}`
            : "Findings: request failed."
        );
      }

      if (errors.length) {
        setError(errors.join(" | "));
      }

      setDetailLoading(false);
    },
    [
      requestedAuditTargetId,
    ]
  );

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  useEffect(() => {
    if (!assessmentId) {
      setTargets([]);
      setFindings([]);
      setSelectedTargetId("");
      return;
    }

    void loadAssessmentData(
      Number(assessmentId)
    );
  }, [
    assessmentId,
    loadAssessmentData,
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Maturity Workspace
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Findings
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage maturity audit findings, ownership,
            corrective action planning, implementation,
            verification, and closure.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadAssessments();

            if (assessmentId) {
              void loadAssessmentData(
                Number(assessmentId)
              );
            }
          }}
          disabled={loading || detailLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={
              loading || detailLoading
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assessment
          </label>

          <select
            value={assessmentId}
            onChange={(event) =>
              setAssessmentId(
                event.target.value
              )
            }
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {!assessments.length ? (
              <option value="">
                No maturity assessment available
              </option>
            ) : null}

            {assessments.map(
              (assessment) => (
                <option
                  key={assessment.id}
                  value={assessment.id}
                >
                  {assessment.name}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Framework
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
            {selectedAssessment
              ? `${selectedAssessment.context.standard_code} / ${selectedAssessment.context.version_code}`
              : "No assessment selected"}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Audit Target
          </label>

          <select
            value={selectedTargetId}
            onChange={(event) =>
              setSelectedTargetId(
                event.target.value
              )
            }
            disabled={
              detailLoading ||
              !targets.length
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
          >
            {!targets.length ? (
              <option value="">
                No audit target available
              </option>
            ) : null}

            {targets.map((target) => (
              <option
                key={target.id}
                value={target.id}
              >
                {target.audit_plan_reference ||
                  `Plan #${target.audit_plan_id}`}
                {" / "}
                {target.process_attribute_code ||
                  `PA #${target.process_attribute_id}`}
                {target.indicator_code
                  ? ` / ${target.indicator_code}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<ShieldAlert size={17} />}
          label="Open"
          value={openCount}
        />

        <Metric
          icon={<Clock3 size={17} />}
          label="In Review"
          value={reviewCount}
        />

        <Metric
          icon={<AlertTriangle size={17} />}
          label="Verification"
          value={verificationCount}
        />

        <Metric
          icon={<CheckCircle2 size={17} />}
          label="Closed"
          value={closedCount}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Finding Registry
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Findings across all audit targets in
              the selected maturity assessment.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search findings"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">
                All statuses
              </option>
              <option value="OPEN">
                Open
              </option>
              <option value="ASSIGNED">
                Assigned
              </option>
              <option value="OWNER_RESPONSE">
                Owner Response
              </option>
              <option value="SUBMITTED_FOR_REVIEW">
                Submitted for Review
              </option>
              <option value="REVISION_REQUIRED">
                Revision Required
              </option>
              <option value="PLAN_APPROVED">
                Plan Approved
              </option>
              <option value="READY_FOR_VERIFICATION">
                Ready for Verification
              </option>
              <option value="VERIFICATION_FAILED">
                Verification Failed
              </option>
              <option value="CLOSED">
                Closed
              </option>
            </select>
          </div>
        </div>

        <div className="p-5">
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading findings...
            </div>
          ) : !visibleFindings.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              No findings match the selected context.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3 font-semibold">
                      Finding
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Audit / Scope
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Severity
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Status
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Due Date
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleFindings.map(
                    (finding) => {
                      const target =
                        targetMap.get(
                          finding.audit_maturity_target_id
                        );

                      return (
                        <tr
                          key={finding.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-4">
                            <div className="font-semibold text-slate-950">
                              {finding.title}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              Finding #{finding.id}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <div className="font-medium text-slate-800">
                              {target?.audit_plan_reference ||
                                `Plan #${finding.audit_plan_id}`}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {target?.process_attribute_code ||
                                "Process attribute"}
                              {target?.indicator_code
                                ? ` / ${target.indicator_code}`
                                : ""}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass(
                                finding.severity
                              )}`}
                            >
                              {displayStatus(
                                finding.severity
                              )}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                                finding.status
                              )}`}
                            >
                              {displayStatus(
                                finding.status
                              )}
                            </span>
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {finding.due_date ||
                              "-"}
                          </td>

                          <td className="px-3 py-4">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTargetId(
                                  String(
                                    finding.audit_maturity_target_id
                                  )
                                );

                                window.setTimeout(() => {
                                  workflowRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                                }, 0);
                              }}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Open Workflow
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
        </div>
      </div>

      {selectedTarget ? (
        <div
          ref={workflowRef}
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Finding Workflow
            </div>

            <div className="mt-1 text-sm text-slate-600">
              {selectedTarget.audit_plan_reference ||
                `Audit Plan #${selectedTarget.audit_plan_id}`}
              {" / "}
              {selectedTarget.process_attribute_code ||
                `PA #${selectedTarget.process_attribute_id}`}
              {selectedTarget.indicator_code
                ? ` / ${selectedTarget.indicator_code}`
                : ""}
            </div>
          </div>

          <MaturityAuditFindingWorkspace
            assessmentId={
              selectedTarget.pam_assessment_id
            }
            auditTargetId={
              selectedTarget.id
            }
            auditPlanId={
              selectedTarget.audit_plan_id
            }
            attributeCode={
              selectedTarget.process_attribute_code ||
              `PA #${selectedTarget.process_attribute_id}`
            }
            indicatorCode={
              selectedTarget.indicator_code ||
              null
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export default function MaturityFindingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">
          Loading maturity findings...
        </div>
      }
    >
      <MaturityFindingsContent />
    </Suspense>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-slate-500">
        {icon}
      </div>

      <div className="mt-4 text-2xl font-semibold text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
