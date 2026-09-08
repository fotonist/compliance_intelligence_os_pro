
"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { apiFetch } from "@/app/lib/api";

type Finding = {
  id: number;
  audit_plan_id?: number | null;
  execution_id?: number | null;
  process_id?: number | null;
  control_id?: number | null;
  assigned_owner_id?: number | null;
  process_manager_id?: number | null;

  title?: string | null;
  description?: string | null;
  requirement?: string | null;
  objective_evidence?: string | null;

  severity?: string | null;
  status?: string | null;
  owner?: string | null;
  due_date?: string | null;

  root_cause?: string | null;
  correction?: string | null;
  corrective_action_plan?: string | null;
  recommendation?: string | null;

  owner_response?: string | null;

  manager_review_status?: string | null;
  manager_review_comment?: string | null;

  implementation_status?: string | null;
  implementation_evidence?: string | null;

  verification_status?: string | null;
  verification_comment?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type WorkflowEvent = {
  id?: number;
  actor_id?: number | null;
  actor_role?: string | null;
  action?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

type AuditPlan = {
  id: number;
  reference?: string | null;
  name?: string | null;
  process_id?: number | null;
  status?: string | null;
};

type ProcessRow = {
  id: number;
  code?: string | null;
  name?: string | null;
};

type ControlRow = {
  id: number;
  code?: string | null;
  title?: string | null;
};

type UserRow = {
  id: number;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

const STATUS_ORDER = [
  "OPEN",
  "ASSIGNED",
  "OWNER_RESPONSE",
  "SUBMITTED_FOR_REVIEW",
  "PLAN_APPROVED",
  "READY_FOR_VERIFICATION",
  "REVISION_REQUIRED",
  "VERIFICATION_FAILED",
  "CLOSED",
];

function arrayValue(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function responseError(response: Response) {
  try {
    const body = await response.json();
    return body?.detail || body?.message || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function statusLabel(value?: string | null) {
  if (!value) return "-";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateLabel(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isClosed(finding: Finding) {
  return (
    String(finding.status || "").toUpperCase() ===
    "CLOSED"
  );
}

function isOverdue(finding: Finding) {
  if (isClosed(finding) || !finding.due_date) {
    return false;
  }

  const due = new Date(finding.due_date);

  if (Number.isNaN(due.getTime())) {
    return false;
  }

  return due.getTime() < Date.now();
}

function isDueSoon(finding: Finding) {
  if (isClosed(finding) || !finding.due_date) {
    return false;
  }

  const due = new Date(finding.due_date);

  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const now = Date.now();
  const limit = now + 7 * 24 * 60 * 60 * 1000;

  return (
    due.getTime() >= now &&
    due.getTime() <= limit
  );
}

function severityRank(value?: string | null) {
  const rank: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return rank[
    String(value || "").toUpperCase()
  ] || 0;
}

function severityClass(value?: string | null) {
  const severity =
    String(value || "").toUpperCase();

  if (severity === "CRITICAL") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  if (severity === "HIGH") {
    return "border-orange-300 bg-orange-50 text-orange-700";
  }

  if (severity === "MEDIUM") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }

  if (severity === "LOW") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

function statusClass(value?: string | null) {
  const status =
    String(value || "").toUpperCase();

  if (status === "CLOSED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "READY_FOR_VERIFICATION" ||
    status === "PLAN_APPROVED"
  ) {
    return "border-blue-300 bg-blue-50 text-blue-700";
  }

  if (
    status === "SUBMITTED_FOR_REVIEW" ||
    status === "OWNER_RESPONSE"
  ) {
    return "border-violet-300 bg-violet-50 text-violet-700";
  }

  if (
    status === "REVISION_REQUIRED" ||
    status === "VERIFICATION_FAILED"
  ) {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  if (status === "ASSIGNED") {
    return "border-cyan-300 bg-cyan-50 text-cyan-700";
  }

  return "border-slate-300 bg-slate-50 text-slate-600";
}

function Metric({
  label,
  value,
  helper,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border p-5 ${
        className ||
        "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>

        <span className="text-slate-400">
          {icon}
        </span>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {helper}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          rows={4}
          className="w-full resize-y border border-slate-300 bg-white px-3 py-2.5 text-xs leading-5 text-slate-800 outline-none focus:border-slate-600"
        />
      ) : (
        <input
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          className="h-10 w-full border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none focus:border-slate-600"
        />
      )}
    </label>
  );
}

function Button({
  label,
  onClick,
  icon,
  tone = "light",
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  tone?: "light" | "dark";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold transition ${
        tone === "dark"
          ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {icon}
      {label}
    </button>
  );
}

function AuditFindingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedFindingId = Number(
    searchParams.get("finding_id") || 0,
  );

  const requestedPlanId = Number(
    searchParams.get("plan_id") || 0,
  );

  const [findings, setFindings] = useState<Finding[]>([]);
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [processes, setProcesses] =
    useState<ProcessRow[]>([]);
  const [controls, setControls] =
    useState<ControlRow[]>([]);
  const [users, setUsers] =
    useState<UserRow[]>([]);

  const [selectedFinding, setSelectedFinding] =
    useState<Finding | null>(null);

  const [workflow, setWorkflow] =
    useState<WorkflowEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [severityFilter, setSeverityFilter] =
    useState("ALL");

  const [dueFilter, setDueFilter] =
    useState("ALL");

  const [ownerFilter, setOwnerFilter] =
    useState("ALL");

  const [planFilter, setPlanFilter] =
    useState(
      requestedPlanId
        ? String(requestedPlanId)
        : "ALL",
    );

  const [showCreate, setShowCreate] =
    useState(false);

  const [newFinding, setNewFinding] =
    useState({
      audit_plan_id: requestedPlanId
        ? String(requestedPlanId)
        : "",
      control_id: "",
      title: "",
      description: "",
      severity: "MEDIUM",
    });

  async function loadReferenceData() {
    const responses =
      await Promise.allSettled([
        apiFetch("/audit/plans"),
        apiFetch("/company/processes"),
        apiFetch("/controls/"),
        apiFetch("/users/?page=1&page_size=100"),
      ]);

    const plansResponse = responses[0];
    const processResponse = responses[1];
    const controlsResponse = responses[2];
    const usersResponse = responses[3];

    if (
      plansResponse.status ===
        "fulfilled" &&
      plansResponse.value.ok
    ) {
      setPlans(
        arrayValue(
          await plansResponse.value.json(),
        ) as AuditPlan[],
      );
    }

    if (
      processResponse.status ===
        "fulfilled" &&
      processResponse.value.ok
    ) {
      setProcesses(
        arrayValue(
          await processResponse.value.json(),
        ) as ProcessRow[],
      );
    }

    if (
      controlsResponse.status ===
        "fulfilled" &&
      controlsResponse.value.ok
    ) {
      setControls(
        arrayValue(
          await controlsResponse.value.json(),
        ) as ControlRow[],
      );
    }

    if (
      usersResponse.status ===
        "fulfilled" &&
      usersResponse.value.ok
    ) {
      setUsers(
        arrayValue(
          await usersResponse.value.json(),
        ) as UserRow[],
      );
    }
  }

  async function loadFindings() {
    setLoading(true);
    setError("");

    try {
      const params =
        new URLSearchParams();

      if (planFilter !== "ALL") {
        params.set(
          "plan_id",
          planFilter,
        );
      }

      if (statusFilter !== "ALL") {
        params.set(
          "status",
          statusFilter,
        );
      }

      const queryString =
        params.toString();

      const response = await apiFetch(
        queryString
          ? `/audit/findings?${queryString}`
          : "/audit/findings",
      );

      if (!response.ok) {
        throw new Error(
          await responseError(response),
        );
      }

      const rows =
        arrayValue(
          await response.json(),
        ) as Finding[];

      setFindings(rows);
    } catch (loadError: any) {
      setFindings([]);
      setError(
        loadError?.message ||
          "Failed to load findings.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openFinding(
    finding: Finding,
  ) {
    setSelectedFinding(finding);
    setDetailLoading(true);
    setWorkflow([]);

    router.replace(
      `/audit/findings?finding_id=${finding.id}`,
    );

    try {
      const detailResponse =
        await apiFetch(
          `/audit/findings/${finding.id}`,
        );

      if (detailResponse.ok) {
        const detail =
          (await detailResponse.json()) as Finding;

        setSelectedFinding(detail);

        setFindings((current) =>
          current.map((item) =>
            item.id === detail.id
              ? detail
              : item,
          ),
        );
      }

      const workflowResponse =
        await apiFetch(
          `/audit/findings/${finding.id}/workflow`,
        );

      if (workflowResponse.ok) {
        setWorkflow(
          arrayValue(
            await workflowResponse.json(),
          ) as WorkflowEvent[],
        );
      }
    } catch {
      setWorkflow([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeFinding() {
    setSelectedFinding(null);
    router.replace(
      "/audit/findings",
    );
  }

  async function createFinding() {
    if (
      !newFinding.audit_plan_id ||
      !newFinding.control_id ||
      !newFinding.title.trim() ||
      !newFinding.description.trim()
    ) {
      setError(
        "Audit plan, control, title and description are required.",
      );
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response =
        await apiFetch(
          "/audit/findings",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              audit_plan_id:
                Number(
                  newFinding.audit_plan_id,
                ),
              control_id:
                Number(
                  newFinding.control_id,
                ),
              title:
                newFinding.title.trim(),
              description:
                newFinding.description.trim(),
              severity:
                newFinding.severity,
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await responseError(response),
        );
      }

      const created =
        (await response.json()) as Finding;

      setFindings((current) => [
        created,
        ...current,
      ]);

      setShowCreate(false);

      setNewFinding({
        audit_plan_id:
          requestedPlanId
            ? String(
                requestedPlanId,
              )
            : "",
        control_id: "",
        title: "",
        description: "",
        severity: "MEDIUM",
      });

      await openFinding(created);
    } catch (createError: any) {
      setError(
        createError?.message ||
          "Failed to create finding.",
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadFindings();
  }, [
    planFilter,
    statusFilter,
  ]);

  useEffect(() => {
    if (!requestedFindingId) {
      return;
    }

    const finding =
      findings.find(
        (item) =>
          Number(item.id) ===
          requestedFindingId,
      );

    if (
      finding &&
      (!selectedFinding ||
        selectedFinding.id !==
          finding.id)
    ) {
      openFinding(finding);
    }
  }, [
    findings,
    requestedFindingId,
  ]);

  const planById = useMemo(
    () =>
      new Map(
        plans.map((item) => [
          Number(item.id),
          item,
        ]),
      ),
    [plans],
  );

  const processById = useMemo(
    () =>
      new Map(
        processes.map((item) => [
          Number(item.id),
          item,
        ]),
      ),
    [processes],
  );

  const controlById = useMemo(
    () =>
      new Map(
        controls.map((item) => [
          Number(item.id),
          item,
        ]),
      ),
    [controls],
  );

  const userById = useMemo(
    () =>
      new Map(
        users.map((item) => [
          Number(item.id),
          item,
        ]),
      ),
    [users],
  );

  const metrics = useMemo(() => {
    const open =
      findings.filter(
        (item) => !isClosed(item),
      );

    return {
      total: findings.length,
      open: open.length,
      critical: open.filter(
        (item) =>
          String(
            item.severity || "",
          ).toUpperCase() ===
          "CRITICAL",
      ).length,
      high: open.filter(
        (item) =>
          String(
            item.severity || "",
          ).toUpperCase() ===
          "HIGH",
      ).length,
      overdue: open.filter(
        isOverdue,
      ).length,
      dueSoon: open.filter(
        isDueSoon,
      ).length,
      review: open.filter(
        (item) =>
          [
            "SUBMITTED_FOR_REVIEW",
            "REVISION_REQUIRED",
          ].includes(
            String(
              item.status || "",
            ).toUpperCase(),
          ),
      ).length,
      verification: open.filter(
        (item) =>
          String(
            item.status || "",
          ).toUpperCase() ===
          "READY_FOR_VERIFICATION",
      ).length,
      closed: findings.filter(
        isClosed,
      ).length,
    };
  }, [findings]);

  const lifecycle = useMemo(
    () =>
      STATUS_ORDER.map(
        (status) => ({
          status,
          count:
            findings.filter(
              (finding) =>
                String(
                  finding.status ||
                    "",
                ).toUpperCase() ===
                status,
            ).length,
        }),
      ).filter(
        (item) => item.count > 0,
      ),
    [findings],
  );

  const visibleFindings = useMemo(() => {
    const needle =
      search.trim().toLowerCase();

    return findings
      .filter((finding) => {
        if (
          severityFilter !== "ALL" &&
          String(
            finding.severity || "",
          ).toUpperCase() !==
            severityFilter
        ) {
          return false;
        }

        if (
          ownerFilter !== "ALL" &&
          String(
            finding.assigned_owner_id ||
              "",
          ) !== ownerFilter
        ) {
          return false;
        }

        if (
          dueFilter === "OVERDUE" &&
          !isOverdue(finding)
        ) {
          return false;
        }

        if (
          dueFilter === "DUE_SOON" &&
          !isDueSoon(finding)
        ) {
          return false;
        }

        if (
          dueFilter === "NO_DUE_DATE" &&
          finding.due_date
        ) {
          return false;
        }

        if (!needle) {
          return true;
        }

        const plan =
          finding.audit_plan_id
            ? planById.get(
                Number(
                  finding.audit_plan_id,
                ),
              )
            : null;

        const control =
          finding.control_id
            ? controlById.get(
                Number(
                  finding.control_id,
                ),
              )
            : null;

        const owner =
          finding.assigned_owner_id
            ? userById.get(
                Number(
                  finding.assigned_owner_id,
                ),
              )
            : null;

        return [
          finding.id,
          finding.title,
          finding.description,
          finding.requirement,
          finding.owner,
          finding.status,
          finding.severity,
          plan?.reference,
          plan?.name,
          control?.code,
          control?.title,
          owner?.full_name,
          owner?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        const severity =
          severityRank(b.severity) -
          severityRank(a.severity);

        if (severity !== 0) {
          return severity;
        }

        const overdue =
          Number(isOverdue(b)) -
          Number(isOverdue(a));

        if (overdue !== 0) {
          return overdue;
        }

        return b.id - a.id;
      });
  }, [
    findings,
    search,
    severityFilter,
    ownerFilter,
    dueFilter,
    planById,
    controlById,
    userById,
  ]);

  const selectedPlan =
    selectedFinding?.audit_plan_id
      ? planById.get(
          Number(
            selectedFinding.audit_plan_id,
          ),
        )
      : null;

  const selectedProcess =
    selectedFinding?.process_id
      ? processById.get(
          Number(
            selectedFinding.process_id,
          ),
        )
      : selectedPlan?.process_id
        ? processById.get(
            Number(
              selectedPlan.process_id,
            ),
          )
        : null;

  const selectedControl =
    selectedFinding?.control_id
      ? controlById.get(
          Number(
            selectedFinding.control_id,
          ),
        )
      : null;

  const selectedOwner =
    selectedFinding?.assigned_owner_id
      ? userById.get(
          Number(
            selectedFinding.assigned_owner_id,
          ),
        )
      : null;

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="space-y-6 p-6 xl:p-8">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <ShieldAlert size={14} />
              Internal Audit
              <span className="text-slate-300">
                /
              </span>
              Finding Management
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Findings & Nonconformity Management
            </h1>

            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
              Enterprise register for audit findings, nonconformities, ownership, remediation status and verification readiness.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              label="Audit Execution"
              onClick={() =>
                router.push(
                  "/audit/execution",
                )
              }
              icon={
                <ArrowRight size={14} />
              }
            />

            <Button
              label="Refresh"
              onClick={() => {
                loadReferenceData();
                loadFindings();
              }}
              icon={
                <RefreshCw size={14} />
              }
            />

            <Button
              label="New Finding"
              onClick={() =>
                setShowCreate(true)
              }
              tone="dark"
              icon={
                <Target size={14} />
              }
            />
          </div>
        </header>

        {error ? (
          <div className="flex items-center gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            <AlertTriangle
              size={15}
            />
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-auto"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Total Findings"
            value={metrics.total}
            helper="Current register"
            icon={
              <FileSearch size={17} />
            }
          />

          <Metric
            label="Open"
            value={metrics.open}
            helper="Not yet closed"
            icon={
              <Clock3 size={17} />
            }
          />

          <Metric
            label="Critical"
            value={metrics.critical}
            helper="Open critical exposure"
            icon={
              <ShieldAlert size={17} />
            }
            className="border-rose-200 bg-rose-50"
          />

          <Metric
            label="High"
            value={metrics.high}
            helper="Open high exposure"
            icon={
              <AlertTriangle
                size={17}
              />
            }
            className="border-orange-200 bg-orange-50"
          />

          <Metric
            label="Overdue"
            value={metrics.overdue}
            helper={`${metrics.dueSoon} due within 7 days`}
            icon={
              <CalendarClock
                size={17}
              />
            }
            className={
              metrics.overdue
                ? "border-rose-200 bg-rose-50"
                : undefined
            }
          />

          <Metric
            label="Verification Queue"
            value={metrics.verification}
            helper={`${metrics.review} in management review`}
            icon={
              <CheckCircle2
                size={17}
              />
            }
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Lifecycle Control
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-950">
                Finding Workflow Health
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Controlled finding lifecycle distribution.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-4">
              {lifecycle.map(
                (item) => (
                  <button
                    type="button"
                    key={
                      item.status
                    }
                    onClick={() =>
                      setStatusFilter(
                        item.status,
                      )
                    }
                    className="bg-white p-4 text-left hover:bg-slate-50"
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {statusLabel(
                        item.status,
                      )}
                    </div>

                    <div className="mt-2 text-xl font-semibold text-slate-950">
                      {item.count}
                    </div>
                  </button>
                ),
              )}

              {!lifecycle.length ? (
                <div className="col-span-full bg-white p-8 text-center text-xs text-slate-400">
                  No lifecycle records.
                </div>
              ) : null}
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Management Attention
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-950">
                Remediation Exposure
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Items requiring management attention.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-slate-200">
              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Overdue
                </div>
                <div className="mt-2 text-xl font-semibold text-rose-700">
                  {metrics.overdue}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Due Soon
                </div>
                <div className="mt-2 text-xl font-semibold text-amber-700">
                  {metrics.dueSoon}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Management Review
                </div>
                <div className="mt-2 text-xl font-semibold text-violet-700">
                  {metrics.review}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Closed
                </div>
                <div className="mt-2 text-xl font-semibold text-emerald-700">
                  {metrics.closed}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Finding Register
                </div>

                <div className="mt-1 text-lg font-semibold text-slate-950">
                  Enterprise Finding Register
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Search and filter the live tenant finding population.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search findings..."
                    className="h-9 w-64 border border-slate-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-slate-600"
                  />
                </div>

                <select
                  value={planFilter}
                  onChange={(event) =>
                    setPlanFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 border border-slate-300 bg-white px-2 text-xs outline-none"
                >
                  <option value="ALL">
                    All audit plans
                  </option>

                  {plans.map(
                    (plan) => (
                      <option
                        key={plan.id}
                        value={plan.id}
                      >
                        {plan.reference ||
                          `Plan #${plan.id}`}
                      </option>
                    ),
                  )}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 border border-slate-300 bg-white px-2 text-xs outline-none"
                >
                  <option value="ALL">
                    All status
                  </option>

                  {STATUS_ORDER.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {statusLabel(
                          status,
                        )}
                      </option>
                    ),
                  )}
                </select>

                <select
                  value={severityFilter}
                  onChange={(event) =>
                    setSeverityFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 border border-slate-300 bg-white px-2 text-xs outline-none"
                >
                  <option value="ALL">
                    All severity
                  </option>
                  <option value="CRITICAL">
                    Critical
                  </option>
                  <option value="HIGH">
                    High
                  </option>
                  <option value="MEDIUM">
                    Medium
                  </option>
                  <option value="LOW">
                    Low
                  </option>
                </select>

                <select
                  value={dueFilter}
                  onChange={(event) =>
                    setDueFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 border border-slate-300 bg-white px-2 text-xs outline-none"
                >
                  <option value="ALL">
                    All due dates
                  </option>
                  <option value="OVERDUE">
                    Overdue
                  </option>
                  <option value="DUE_SOON">
                    Due within 7 days
                  </option>
                  <option value="NO_DUE_DATE">
                    No due date
                  </option>
                </select>

                <select
                  value={ownerFilter}
                  onChange={(event) =>
                    setOwnerFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 border border-slate-300 bg-white px-2 text-xs outline-none"
                >
                  <option value="ALL">
                    All owners
                  </option>

                  {users.map(
                    (user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.full_name ||
                          user.email ||
                          `User #${user.id}`}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-16 px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    ID
                  </th>

                  <th className="w-[270px] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Audit Trace
                  </th>

                  <th className="w-[390px] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Finding
                  </th>

                  <th className="w-28 px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Severity
                  </th>

                  <th className="w-[190px] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Owner
                  </th>

                  <th className="w-44 px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Lifecycle
                  </th>

                  <th className="w-32 px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Due
                  </th>

                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-xs text-slate-400"
                    >
                      Loading finding register...
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                !visibleFindings.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center"
                    >
                      <FileSearch
                        size={22}
                        className="mx-auto text-slate-300"
                      />

                      <div className="mt-3 text-sm font-semibold text-slate-700">
                        No findings match the current view
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Adjust the filters or create a new finding.
                      </div>
                    </td>
                  </tr>
                ) : null}

                {!loading
                  ? visibleFindings.map(
                      (finding) => {
                        const plan =
                          finding.audit_plan_id
                            ? planById.get(
                                Number(
                                  finding.audit_plan_id,
                                ),
                              )
                            : null;

                        const control =
                          finding.control_id
                            ? controlById.get(
                                Number(
                                  finding.control_id,
                                ),
                              )
                            : null;

                        const owner =
                          finding.assigned_owner_id
                            ? userById.get(
                                Number(
                                  finding.assigned_owner_id,
                                ),
                              )
                            : null;

                        const overdue =
                          isOverdue(
                            finding,
                          );

                        return (
                          <tr
                            key={
                              finding.id
                            }
                            onClick={() =>
                              openFinding(
                                finding,
                              )
                            }
                            className="cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                #
                                {
                                  finding.id
                                }
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <div className="text-xs font-semibold text-slate-800">
                                {plan?.reference ||
                                  (finding.audit_plan_id
                                    ? `Plan #${finding.audit_plan_id}`
                                    : "No plan")}
                              </div>

                              <div className="mt-1 text-[10px] leading-4 text-slate-500">
                                {plan?.name ||
                                  "Audit plan"}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1">
                                {control ? (
                                  <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-500">
                                    {
                                      control.code
                                    }
                                  </span>
                                ) : null}

                                {finding.execution_id ? (
                                  <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500">
                                    Execution #
                                    {
                                      finding.execution_id
                                    }
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold leading-5 text-slate-900">
                                {finding.title ||
                                  "Untitled finding"}
                              </div>

                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {finding.description ||
                                  "No description recorded."}
                              </div>

                              {finding.requirement ? (
                                <div className="mt-2 line-clamp-1 text-[10px] text-slate-400">
                                  Requirement:{" "}
                                  {
                                    finding.requirement
                                  }
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex border px-2 py-1 text-[9px] font-semibold uppercase ${severityClass(finding.severity)}`}
                              >
                                {String(
                                  finding.severity ||
                                    "MEDIUM",
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <div className="text-xs font-semibold text-slate-800">
                                {owner?.full_name ||
                                  finding.owner ||
                                  "Unassigned"}
                              </div>

                              <div className="mt-1 text-[10px] text-slate-400">
                                {owner?.email ||
                                  "No owner assigned"}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex max-w-[155px] border px-2 py-1 text-[9px] font-semibold uppercase leading-4 ${statusClass(finding.status)}`}
                              >
                                {statusLabel(
                                  finding.status,
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <div
                                className={`text-xs font-semibold ${
                                  overdue
                                    ? "text-rose-700"
                                    : "text-slate-800"
                                }`}
                              >
                                {dateLabel(
                                  finding.due_date,
                                )}
                              </div>

                              {overdue ? (
                                <div className="mt-1 text-[9px] font-semibold uppercase text-rose-600">
                                  Overdue
                                </div>
                              ) : isDueSoon(
                                  finding,
                                ) ? (
                                <div className="mt-1 text-[9px] font-semibold uppercase text-amber-600">
                                  Due soon
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-4">
                              <ChevronRight
                                size={15}
                                className="text-slate-300"
                              />
                            </td>
                          </tr>
                        );
                      },
                    )
                  : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {visibleFindings.length} visible
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <Filter size={12} />
              Live tenant data
            </div>
          </div>
        </section>
      </div>

      {selectedFinding ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
          <aside className="flex h-full w-full max-w-[760px] flex-col bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Finding #
                    {
                      selectedFinding.id
                    }
                  </div>

                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                    {selectedFinding.title ||
                      "Untitled finding"}
                  </h2>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`border px-2 py-1 text-[9px] font-semibold uppercase ${severityClass(selectedFinding.severity)}`}
                    >
                      {String(
                        selectedFinding.severity ||
                          "MEDIUM",
                      )}
                    </span>

                    <span
                      className={`border px-2 py-1 text-[9px] font-semibold uppercase ${statusClass(selectedFinding.status)}`}
                    >
                      {statusLabel(
                        selectedFinding.status,
                      )}
                    </span>

                    {isOverdue(
                      selectedFinding,
                    ) ? (
                      <span className="border border-rose-300 bg-rose-50 px-2 py-1 text-[9px] font-semibold uppercase text-rose-700">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    closeFinding
                  }
                  className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
                <div className="bg-slate-50 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Audit Plan
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-800">
                    {selectedPlan?.reference ||
                      "-"}
                  </div>
                </div>

                <div className="bg-slate-50 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Process
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-800">
                    {selectedProcess?.code ||
                      "-"}
                  </div>
                </div>

                <div className="bg-slate-50 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Control
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-800">
                    {selectedControl?.code ||
                      (selectedFinding.control_id
                        ? `#${selectedFinding.control_id}`
                        : "-")}
                  </div>
                </div>

                <div className="bg-slate-50 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Due Date
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-800">
                    {dateLabel(
                      selectedFinding.due_date,
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="px-6 py-12 text-center text-xs text-slate-400">
                  Loading finding traceability...
                </div>
              ) : (
                <div className="space-y-5 p-6">
                  <section className="border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Finding Definition
                      </div>

                      <div className="mt-1 text-base font-semibold text-slate-950">
                        Observation & Requirement
                      </div>
                    </div>

                    <div className="grid gap-px bg-slate-200 md:grid-cols-2">
                      <div className="bg-white p-5">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Description
                        </div>

                        <div className="mt-2 text-xs leading-5 text-slate-600">
                          {selectedFinding.description ||
                            "No description recorded."}
                        </div>
                      </div>

                      <div className="bg-white p-5">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Requirement
                        </div>

                        <div className="mt-2 text-xs leading-5 text-slate-600">
                          {selectedFinding.requirement ||
                            "No requirement recorded."}
                        </div>

                        <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Objective Evidence
                        </div>

                        <div className="mt-2 text-xs leading-5 text-slate-600">
                          {selectedFinding.objective_evidence ||
                            "No objective evidence recorded."}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Accountability
                      </div>

                      <div className="mt-1 text-base font-semibold text-slate-950">
                        Ownership & Due Date
                      </div>
                    </div>

                    <div className="grid gap-px bg-slate-200 md:grid-cols-3">
                      <div className="bg-white p-5">
                        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          <UserCheck
                            size={12}
                          />
                          Owner
                        </div>

                        <div className="mt-2 text-xs font-semibold text-slate-800">
                          {selectedOwner?.full_name ||
                            selectedFinding.owner ||
                            "Unassigned"}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-400">
                          {selectedOwner?.email ||
                            "-"}
                        </div>
                      </div>

                      <div className="bg-white p-5">
                        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          <Users
                            size={12}
                          />
                          Process Manager
                        </div>

                        <div className="mt-2 text-xs font-semibold text-slate-800">
                          {selectedFinding.process_manager_id
                            ? userById.get(
                                Number(
                                  selectedFinding.process_manager_id,
                                ),
                              )?.full_name ||
                              `User #${selectedFinding.process_manager_id}`
                            : "Unassigned"}
                        </div>
                      </div>

                      <div className="bg-white p-5">
                        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          <CalendarClock
                            size={12}
                          />
                          Due Date
                        </div>

                        <div
                          className={`mt-2 text-xs font-semibold ${
                            isOverdue(
                              selectedFinding,
                            )
                              ? "text-rose-700"
                              : "text-slate-800"
                          }`}
                        >
                          {dateLabel(
                            selectedFinding.due_date,
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Remediation
                          </div>

                          <div className="mt-1 text-base font-semibold text-slate-950">
                            Corrective Action State
                          </div>
                        </div>

                        <span
                          className={`border px-2 py-1 text-[9px] font-semibold uppercase ${statusClass(selectedFinding.status)}`}
                        >
                          {statusLabel(
                            selectedFinding.status,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Owner Response
                        </div>

                        <div className="mt-2 text-xs leading-5 text-slate-600">
                          {selectedFinding.owner_response ||
                            "No owner response recorded."}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Root Cause
                          </div>

                          <div className="mt-2 text-xs leading-5 text-slate-600">
                            {selectedFinding.root_cause ||
                              "Not recorded."}
                          </div>
                        </div>

                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Correction
                          </div>

                          <div className="mt-2 text-xs leading-5 text-slate-600">
                            {selectedFinding.correction ||
                              "Not recorded."}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Corrective Action Plan
                        </div>

                        <div className="mt-2 text-xs leading-5 text-slate-600">
                          {selectedFinding.corrective_action_plan ||
                            "No corrective action plan recorded."}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Manager Review
                          </div>

                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {statusLabel(
                              selectedFinding.manager_review_status ||
                                "NOT_STARTED",
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Implementation
                          </div>

                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {statusLabel(
                              selectedFinding.implementation_status ||
                                "NOT_STARTED",
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Verification
                          </div>

                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {statusLabel(
                              selectedFinding.verification_status ||
                                "NOT_STARTED",
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Workflow
                          </div>

                          <div className="mt-1 text-base font-semibold text-slate-950">
                            Audit Traceability
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <History
                            size={13}
                          />
                          {
                            workflow.length
                          } events
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      {workflow.length ? (
                        <div className="relative space-y-4">
                          <div className="absolute bottom-4 left-[9px] top-4 w-px bg-slate-200" />

                          {workflow.map(
                            (
                              event,
                              index,
                            ) => (
                              <div
                                key={
                                  event.id ||
                                  `${event.created_at}-${index}`
                                }
                                className="relative flex gap-4"
                              >
                                <div className="relative z-10 mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center border border-slate-300 bg-white">
                                  <ArrowRight
                                    size={9}
                                    className="text-slate-500"
                                  />
                                </div>

                                <div className="flex-1 border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-slate-800">
                                      {statusLabel(
                                        event.action,
                                      )}
                                    </div>

                                    <div className="text-[10px] text-slate-400">
                                      {dateTimeLabel(
                                        event.created_at,
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {event.from_status ? (
                                      <span className="border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                                        {statusLabel(
                                          event.from_status,
                                        )}
                                      </span>
                                    ) : null}

                                    {event.from_status &&
                                    event.to_status ? (
                                      <ArrowRight
                                        size={10}
                                        className="text-slate-300"
                                      />
                                    ) : null}

                                    {event.to_status ? (
                                      <span
                                        className={`border px-1.5 py-0.5 text-[9px] font-semibold ${statusClass(event.to_status)}`}
                                      >
                                        {statusLabel(
                                          event.to_status,
                                        )}
                                      </span>
                                    ) : null}
                                  </div>

                                  {event.comment ? (
                                    <div className="mt-2 text-xs leading-5 text-slate-500">
                                      {
                                        event.comment
                                      }
                                    </div>
                                  ) : null}

                                  {event.actor_role ? (
                                    <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                                      Actor:{" "}
                                      {
                                        event.actor_role
                                      }
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No workflow events available.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-3 md:grid-cols-3">
                    <div className="border border-slate-200 bg-white p-4">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Created
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-700">
                        {dateTimeLabel(
                          selectedFinding.created_at,
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 bg-white p-4">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Updated
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-700">
                        {dateTimeLabel(
                          selectedFinding.updated_at,
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 bg-white p-4">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Verification
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-700">
                        {statusLabel(
                          selectedFinding.verification_status ||
                            "NOT_STARTED",
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Controlled finding lifecycle
                </div>

                <button
                  type="button"
                  onClick={
                    closeFinding
                  }
                  className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                >
                  Close
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Finding Management
                </div>

                <div className="mt-1 text-xl font-semibold text-slate-950">
                  New Finding
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Create a finding against an existing audit plan and control.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Audit Plan
                  </div>

                  <select
                    value={
                      newFinding.audit_plan_id
                    }
                    onChange={(event) =>
                      setNewFinding(
                        (current) => ({
                          ...current,
                          audit_plan_id:
                            event.target.value,
                        }),
                      )
                    }
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-xs outline-none"
                  >
                    <option value="">
                      Select audit plan
                    </option>

                    {plans.map(
                      (plan) => (
                        <option
                          key={plan.id}
                          value={plan.id}
                        >
                          {plan.reference ||
                            `Plan #${plan.id}`}
                          {" - "}
                          {plan.name ||
                            ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Control
                  </div>

                  <select
                    value={
                      newFinding.control_id
                    }
                    onChange={(event) =>
                      setNewFinding(
                        (current) => ({
                          ...current,
                          control_id:
                            event.target.value,
                        }),
                      )
                    }
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-xs outline-none"
                  >
                    <option value="">
                      Select control
                    </option>

                    {controls.map(
                      (control) => (
                        <option
                          key={control.id}
                          value={control.id}
                        >
                          {control.code ||
                            `Control #${control.id}`}
                          {" - "}
                          {control.title ||
                            ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Finding Title"
                  value={
                    newFinding.title
                  }
                  onChange={(value) =>
                    setNewFinding(
                      (current) => ({
                        ...current,
                        title: value,
                      }),
                    )
                  }
                />

                <label>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Severity
                  </div>

                  <select
                    value={
                      newFinding.severity
                    }
                    onChange={(event) =>
                      setNewFinding(
                        (current) => ({
                          ...current,
                          severity:
                            event.target.value,
                        }),
                      )
                    }
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-xs outline-none"
                  >
                    <option value="LOW">
                      Low
                    </option>
                    <option value="MEDIUM">
                      Medium
                    </option>
                    <option value="HIGH">
                      High
                    </option>
                    <option value="CRITICAL">
                      Critical
                    </option>
                  </select>
                </label>
              </div>

              <Field
                label="Finding Description"
                value={
                  newFinding.description
                }
                onChange={(value) =>
                  setNewFinding(
                    (current) => ({
                      ...current,
                      description:
                        value,
                    }),
                  )
                }
                multiline
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <Button
                label="Cancel"
                onClick={() =>
                  setShowCreate(false)
                }
              />

              <Button
                label="Create Finding"
                onClick={
                  createFinding
                }
                tone="dark"
                disabled={
                  creating
                }
                icon={
                  <Target size={14} />
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AuditFindingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading findings...
        </div>
      }
    >
      <AuditFindingsContent />
    </Suspense>
  );
}




