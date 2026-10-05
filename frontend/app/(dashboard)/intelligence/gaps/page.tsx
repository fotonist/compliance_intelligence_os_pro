"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type GapRemediationState = {
  task_id: number | null;
  status: string | null;
  action: "START_REMEDIATION" | "VIEW_REMEDIATION" | string;
};

type ControlGapItem = {
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  coverage_status: "PARTIAL" | "NOT_COVERED" | string;
  remediation: GapRemediationState;
};

type ControlGap = {
  total_controls: number;
  covered: number;
  partial: number;
  not_covered: number;
  gap_count: number;
  compliance_percentage: number;
  items: ControlGapItem[];
};

type AssessmentCoverageItem = {
  pam_process_id: number;
  process_code: string | null;
  process_name: string | null;
  measurement_status: string | null;
  capability_status: string | null;
  target_capability_level: number | null;
  achieved_capability_level: number | null;
};

type AssessmentCoverage = {
  total_processes: number;
  measured_processes: number;
  unassessed_processes: number;
  assessment_coverage_percentage: number;
  items: AssessmentCoverageItem[];
};

type CapabilityGapItem = {
  pam_process_id?: number;
  process_code?: string | null;
  process_name?: string | null;
  capability_status?: string | null;
  target_capability_level?: number | null;
  achieved_capability_level?: number | null;
};

type CapabilityGap = {
  calculated_processes: number;
  target_met_processes: number;
  capability_gap_count: number;
  target_achievement_percentage: number;
  gap_items: CapabilityGapItem[];
};

type MaturityGap = {
  assessment_coverage: AssessmentCoverage;
  capability: CapabilityGap;
};

type FrameworkGap = {
  adoption_id: number;
  standard_id: number;
  standard_code: string;
  standard_title: string;
  standard_version_id: number;
  framework_type: "CONTROL_BASED" | "MATURITY_BASED" | string;
  control_gap?: ControlGap;
  maturity_gap?: MaturityGap;
};

type GapIntelligenceResponse = {
  framework_count: number;
  frameworks: FrameworkGap[];
};

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percentage(value: unknown): string {
  return `${numberValue(value).toFixed(1)}%`;
}

function statusLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function coverageBadge(status: string) {
  if (status === "PARTIAL") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Partial
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
      Not Covered
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-2 text-sm text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function FrameworkHeader({
  framework,
  description,
}: {
  framework: FrameworkGap;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold tracking-wide text-white">
            {framework.standard_code}
          </span>

          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {framework.framework_type.replace(/_/g, " ")}
          </span>
        </div>

        <h2 className="mt-3 text-xl font-semibold text-slate-950">
          {framework.standard_title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="text-left lg:text-right">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Framework Version
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-700">
          {framework.standard_version_id}
        </div>
      </div>
    </div>
  );
}

function ControlFramework({
  framework,
  onRefresh,
}: {
  framework: FrameworkGap;
  onRefresh: () => Promise<void>;
}) {
  const gap = framework.control_gap;

  const [selectedGap, setSelectedGap] =
    useState<ControlGapItem | null>(null);

  const [priorityScore, setPriorityScore] = useState("");
  const [ownerRole, setOwnerRole] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!gap) return null;

  function closeRemediationDialog() {
    if (submitting) return;

    setSelectedGap(null);
    setPriorityScore("");
    setOwnerRole("");
    setDueDate("");
    setActionError("");
  }

  function openRemediationDialog(item: ControlGapItem) {
    setSelectedGap(item);
    setPriorityScore("");
    setOwnerRole("");
    setDueDate("");
    setActionError("");
  }

  async function startRemediation() {
    if (!selectedGap) return;

    const parsedPriority = Number(priorityScore);

    if (
      !Number.isInteger(parsedPriority) ||
      parsedPriority < 0 ||
      parsedPriority > 100
    ) {
      setActionError(
        "Priority score must be an integer between 0 and 100."
      );
      return;
    }

    const normalizedOwnerRole = ownerRole.trim();

    if (!normalizedOwnerRole) {
      setActionError("Owner role is required.");
      return;
    }

    if (!dueDate) {
      setActionError("Due date is required.");
      return;
    }

    setSubmitting(true);
    setActionError("");

    try {
      const response = await apiFetch(
        "/company/intelligence/gaps/remediation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            standard_id: framework.standard_id,
            standard_version_id: framework.standard_version_id,
            adoption_id: framework.adoption_id,
            control_id: selectedGap.control_id,
            priority_score: parsedPriority,
            owner_role: normalizedOwnerRole,
            due_date: new Date(
              `${dueDate}T23:59:59`
            ).toISOString(),
          }),
        }
      );

      if (!response.ok) {
        let detail = "";

        try {
          const payload = await response.json();

          detail =
            typeof payload?.detail === "string"
              ? payload.detail
              : "";
        } catch {
          detail = "";
        }

        throw new Error(
          detail ||
            `Remediation request failed (${response.status})`
        );
      }

      setSelectedGap(null);
      setPriorityScore("");
      setOwnerRole("");
      setDueDate("");

      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Remediation could not be started."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <FrameworkHeader
        framework={framework}
        description="Control coverage posture derived from the active framework matrix and evidence state."
      />

      <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 p-6 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Compliance"
          value={percentage(gap.compliance_percentage)}
          detail="Canonical control compliance"
        />

        <MetricCard
          label="Total Controls"
          value={gap.total_controls}
          detail="Controls in active scope"
        />

        <MetricCard
          label="Covered"
          value={gap.covered}
          detail="Approved evidence coverage"
        />

        <MetricCard
          label="Partial"
          value={gap.partial}
          detail="Partial evidence coverage"
        />

        <MetricCard
          label="Not Covered"
          value={gap.not_covered}
          detail="No qualifying evidence coverage"
        />
      </div>

      <div className="p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Control Coverage Gaps
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Partial and not-covered controls in the active framework scope.
            </p>
          </div>

          <div className="text-sm font-semibold text-slate-700">
            {gap.gap_count} gap controls
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Control
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Control Title
                  </th>
                  <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Coverage State
                  </th>
                  <th className="w-52 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {gap.items.map((item) => (
                  <tr
                    key={item.control_id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">
                      {item.control_code || `#${item.control_id}`}
                    </td>

                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.control_title || "Untitled control"}
                    </td>

                    <td className="px-4 py-3">
                      {coverageBadge(item.coverage_status)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {item.remediation?.action ===
                      "VIEW_REMEDIATION" ? (
                        <a
                          href={`/company/tasks/${item.remediation.task_id}`}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          View Remediation
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            openRemediationDialog(item)
                          }
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                          Start Remediation
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {gap.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No control coverage gaps were returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Control Gap
              </div>

              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                Start Remediation
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {selectedGap.control_code ||
                  `#${selectedGap.control_id}`}
                {" - "}
                {selectedGap.control_title ||
                  "Untitled control"}
              </p>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Priority Score
                </label>

                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={priorityScore}
                  onChange={(event) =>
                    setPriorityScore(event.target.value)
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  placeholder="0 - 100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Owner Role
                </label>

                <input
                  type="text"
                  value={ownerRole}
                  onChange={(event) =>
                    setOwnerRole(event.target.value)
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  placeholder="Enter accountable owner role"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Due Date
                </label>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </div>

              {actionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {actionError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                disabled={submitting}
                onClick={closeRemediationDialog}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void startRemediation()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Starting..."
                  : "Start Remediation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MaturityFramework({
  framework,
}: {
  framework: FrameworkGap;
}) {
  const maturity = framework.maturity_gap;

  if (!maturity) return null;

  const coverage = maturity.assessment_coverage;
  const capability = maturity.capability;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <FrameworkHeader
        framework={framework}
        description="Assessment coverage and calculated capability gaps are kept as separate maturity dimensions."
      />

      <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 p-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Assessment Coverage"
          value={percentage(coverage.assessment_coverage_percentage)}
          detail={`${coverage.measured_processes} of ${coverage.total_processes} processes measured`}
        />

        <MetricCard
          label="Unassessed"
          value={coverage.unassessed_processes}
          detail="Assessment coverage gaps"
        />

        <MetricCard
          label="Target Achievement"
          value={percentage(capability.target_achievement_percentage)}
          detail={`${capability.target_met_processes} of ${capability.calculated_processes} calculated processes meet target`}
        />

        <MetricCard
          label="Capability Gaps"
          value={capability.capability_gap_count}
          detail="Calculated processes below target"
        />
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div>
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-950">
              Assessment Coverage Gaps
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Unmeasured adoption-scope processes. These are not treated as capability failures.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="w-32 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Process
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Process Name
                    </th>
                    <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Measurement
                    </th>
                    <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Capability
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {coverage.items.map((item) => (
                    <tr
                      key={item.pam_process_id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">
                        {item.process_code || `#${item.pam_process_id}`}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-700">
                        {item.process_name || "Unnamed process"}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          {statusLabel(item.measurement_status)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {statusLabel(item.capability_status)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {coverage.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No assessment coverage gaps were returned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-950">
              Capability Gaps
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Only calculated processes below their target capability are included.
            </p>
          </div>

          {capability.gap_items.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-sm font-semibold text-emerald-800">
                No calculated capability gaps
              </div>

              <p className="mt-2 text-sm leading-6 text-emerald-700">
                All currently calculated processes meet their configured target capability.
                Unassessed processes remain assessment coverage gaps and are not classified as capability failures.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {capability.gap_items.map((item, index) => (
                <div
                  key={item.pam_process_id ?? index}
                  className="rounded-xl border border-rose-200 bg-rose-50 p-4"
                >
                  <div className="text-sm font-semibold text-rose-900">
                    {item.process_code || "Process"}{" "}
                    {item.process_name ? `- ${item.process_name}` : ""}
                  </div>

                  <div className="mt-2 text-xs font-medium text-rose-700">
                    Achieved:{" "}
                    {item.achieved_capability_level ?? "N/A"}
                    {" / "}
                    Target:{" "}
                    {item.target_capability_level ?? "N/A"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function GapIntelligencePage() {
  const [data, setData] = useState<GapIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/company/intelligence/gaps");

      if (!response.ok) {
        throw new Error(
          `Gap Intelligence request failed (${response.status})`
        );
      }

      const payload =
        (await response.json()) as GapIntelligenceResponse;

      setData(payload);
    } catch (err) {
      setData(null);
      setError(
        err instanceof Error
          ? err.message
          : "Gap Intelligence could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const overview = useMemo(() => {
    const frameworks = data?.frameworks || [];

    let controlGaps = 0;
    let assessmentCoverageGaps = 0;
    let capabilityGaps = 0;

    for (const framework of frameworks) {
      if (
        framework.framework_type === "CONTROL_BASED" &&
        framework.control_gap
      ) {
        controlGaps += numberValue(
          framework.control_gap.gap_count
        );
      }

      if (
        framework.framework_type === "MATURITY_BASED" &&
        framework.maturity_gap
      ) {
        assessmentCoverageGaps += numberValue(
          framework.maturity_gap.assessment_coverage
            .unassessed_processes
        );

        capabilityGaps += numberValue(
          framework.maturity_gap.capability
            .capability_gap_count
        );
      }
    }

    return {
      frameworks: numberValue(data?.framework_count),
      controlGaps,
      assessmentCoverageGaps,
      capabilityGaps,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-72 rounded bg-slate-200" />
            <div className="h-4 w-[460px] rounded bg-slate-200" />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-32 rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>

            <div className="h-96 rounded-2xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Intelligence
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Gap Intelligence
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Framework-aware visibility into control coverage, maturity assessment coverage,
              and calculated capability gaps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active Frameworks"
            value={overview.frameworks}
            detail="Applicable active framework adoptions"
          />

          <MetricCard
            label="Control Gaps"
            value={overview.controlGaps}
            detail="Partial and not-covered controls"
          />

          <MetricCard
            label="Assessment Coverage Gaps"
            value={overview.assessmentCoverageGaps}
            detail="Unassessed maturity processes"
          />

          <MetricCard
            label="Capability Gaps"
            value={overview.capabilityGaps}
            detail="Calculated processes below target"
          />
        </section>

        {!data || data.frameworks.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-base font-semibold text-slate-900">
              No active framework gap data
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Gap Intelligence did not return any applicable active frameworks.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.frameworks.map((framework) =>
              framework.framework_type === "CONTROL_BASED" ? (
                <ControlFramework
                  key={`${framework.standard_id}-${framework.standard_version_id}`}
                  framework={framework}
                  onRefresh={loadData}
                />
              ) : framework.framework_type === "MATURITY_BASED" ? (
                <MaturityFramework
                  key={`${framework.standard_id}-${framework.standard_version_id}`}
                  framework={framework}
                />
              ) : (
                <section
                  key={`${framework.standard_id}-${framework.standard_version_id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {framework.standard_title}
                  </div>

                  <div className="mt-2 text-sm text-slate-500">
                    Unsupported framework type: {framework.framework_type}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
