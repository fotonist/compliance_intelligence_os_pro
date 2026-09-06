"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  X,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type ProcessRow = {
  id: number;
  code: string;
  name: string;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
};

type AuditAction = {
  priority_score: number;
  standard_code?: string | null;
  clause_code?: string | null;
  requirement_code?: string | null;
  control_code?: string | null;
  control_title?: string | null;
  control_description?: string | null;
  requirement_title?: string | null;
  requirement_description?: string | null;
  control_id: number;
  status: string;
  risk_count: number;
  max_risk_score?: number | null;
  highest_risk_level?: string | null;
  escalation_probability: number;
  expected_score_delta: number;
  ai_priority_score: number;
  forecast_version?: string | null;
  suggested_owner_role: string;
  suggested_due_date: string;
  suggested_evidence_types: string[];
};

type RiskLinkedControl = {
  control_id: number;
  control_code: string;
  control_title: string;
  risks: Array<{
    id: number;
    title: string;
    status?: string;
    inherent_score?: number | null;
    residual_score?: number | null;
  }>;
};

type AuditPlanResponse = {
  process_id: number;
  total_actions: number;
  critical_actions: number;
  actions: AuditAction[];
};

type AuditPlan = {
  id: number;
  reference: string;
  name: string;
  audit_type: string;
  status: string;
  process_id?: number | null;
  standard_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  objective?: string | null;
  scope?: string | null;
};

type NewAuditPlan = {
  reference: string;
  name: string;
  audit_type: string;
  objective: string;
  scope: string;
  standard_id: string;
  standard_version_id: string;
  process_id: string;
  lead_auditor_id: string;
  planned_start: string;
  planned_end: string;
};

const emptyForm: NewAuditPlan = {
  reference: "",
  name: "",
  audit_type: "internal",
  objective: "",
  scope: "",
  standard_id: "",
  standard_version_id: "",
  process_id: "",
  lead_auditor_id: "",
  planned_start: "",
  planned_end: "",
};

function safeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function priorityLabel(score: number) {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function priorityClasses(score: number) {
  if (score >= 75) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (score >= 55) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (score >= 35) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function statusClasses(status?: string | null) {
  const value = safeText(status).toUpperCase();

  if (value === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "IN_PROGRESS") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value === "EXCEPTION") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function scoreClass(score: number) {
  if (score >= 75) return "text-red-600";
  if (score >= 55) return "text-amber-600";
  if (score >= 35) return "text-blue-600";
  return "text-emerald-600";
}

function probabilityClass(value: number) {
  if (value >= 0.7) return "text-red-600";
  if (value >= 0.4) return "text-amber-600";
  if (value > 0) return "text-blue-600";
  return "text-slate-500";
}

function KpiCard({
  icon,
  label,
  value,
  meta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-start justify-between px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center border border-slate-200 bg-slate-50 text-slate-600">
          {icon}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Live
        </span>
      </div>
      <div className="px-5 pb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>
        <div className="mt-1 text-xs text-slate-500">{meta}</div>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">
          {eyebrow}
        </div>
        <div className="mt-1 text-base font-semibold text-slate-900">{title}</div>
        {description ? (
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClasses(
        status,
      )}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function PriorityBadge({ score }: { score: number }) {
  const label = priorityLabel(score);

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${priorityClasses(
        score,
      )}`}
    >
      {label}
    </span>
  );
}

export default function AuditPlanningPage() {
  const router = useRouter();

  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [riskPlan, setRiskPlan] = useState<AuditPlanResponse | null>(null);

  const [riskLinkedControls, setRiskLinkedControls] = useState<RiskLinkedControl[]>([]);
  const [riskLinkedControlsLoading, setRiskLinkedControlsLoading] = useState(false);
  const [riskLinkedControlsError, setRiskLinkedControlsError] = useState<string | null>(null);
  const [addingApplicableControlId, setAddingApplicableControlId] = useState<number | null>(null);

  const [loadingProcesses, setLoadingProcesses] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [generatingRiskPlan, setGeneratingRiskPlan] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [riskNotice, setRiskNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdPlan, setCreatedPlan] = useState<AuditPlan | null>(null);

  const [form, setForm] = useState<NewAuditPlan>(emptyForm);

  const selectedPlan = useMemo(
    () => auditPlans.find((item) => item.id === selectedPlanId) ?? null,
    [auditPlans, selectedPlanId],
  );

  const selectedProcess = useMemo(
    () =>
      processes.find((process) => process.id === selectedPlan?.process_id) ??
      null,
    [processes, selectedPlan],
  );

  const filteredActions = useMemo(() => {
    const actions = riskPlan?.actions ?? [];
    const search = q.trim().toLowerCase();

    return actions.filter((item) => {
      const score = Number(item.ai_priority_score || 0);
      const label = priorityLabel(score);

      const matchesPriority =
        priorityFilter === "ALL" || label === priorityFilter;

      const haystack = [
        item.control_code,
        item.standard_code,
        item.clause_code,
        item.requirement_code,
        item.highest_risk_level,
        item.status,
        item.suggested_owner_role,
        item.forecast_version,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      return matchesPriority && matchesSearch;
    });
  }, [riskPlan, q, priorityFilter]);

  const highPriorityCount = useMemo(
    () =>
      (riskPlan?.actions ?? []).filter(
        (item) => Number(item.ai_priority_score || 0) >= 55,
      ).length,
    [riskPlan],
  );

  const forecastCount = useMemo(
    () =>
      (riskPlan?.actions ?? []).filter(
        (item) => Number(item.escalation_probability || 0) > 0,
      ).length,
    [riskPlan],
  );

  useEffect(() => {
    loadProcesses();
    loadAuditPlans();
  }, []);

  async function loadProcesses() {
    setLoadingProcesses(true);

    try {
      const res = await apiFetch("/company/processes", {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(await readResponseText(res));
      }

      const json = await res.json();
      setProcesses(Array.isArray(json) ? json : json?.items || []);
    } catch (e: any) {
      setProcesses([]);
      setError(e?.message || "Failed to load processes.");
    } finally {
      setLoadingProcesses(false);
    }
  }

  async function loadAuditPlans(preferredId?: number) {
    setLoadingPlans(true);
    setError(null);

    try {
      const res = await apiFetch("/audit/plans", {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(await readResponseText(res));
      }

      const json = await res.json();
      const rows: AuditPlan[] = Array.isArray(json)
        ? json
        : json?.items || [];

      setAuditPlans(rows);

      setSelectedPlanId((current) => {
        if (preferredId && rows.some((item) => item.id === preferredId)) {
          return preferredId;
        }

        if (current && rows.some((item) => item.id === current)) {
          return current;
        }

        return rows[0]?.id ?? null;
      });
    } catch (e: any) {
      setAuditPlans([]);
      setSelectedPlanId(null);
      setError(e?.message || "Failed to load audit plans.");
    } finally {
      setLoadingPlans(false);
    }
  }

  async function loadRiskLinkedControls(processId: number) {
    setRiskLinkedControlsLoading(true);
    setRiskLinkedControlsError(null);

    try {
      const [riskRes, applicableRes] = await Promise.all([
        apiFetch(`/company/processes/${processId}/risks`, {
          method: "GET",
        }),
        apiFetch(`/company/processes/${processId}/applicable-controls`, {
          method: "GET",
        }),
      ]);

      if (!riskRes.ok) {
        throw new Error(await readResponseText(riskRes));
      }

      if (!applicableRes.ok) {
        throw new Error(await readResponseText(applicableRes));
      }

      const riskJson = await riskRes.json();
      const applicableJson = await applicableRes.json();

      const risks = Array.isArray(riskJson)
        ? riskJson
        : Array.isArray(riskJson?.linked_risks)
          ? riskJson.linked_risks
          : [];

      const applicableControls = Array.isArray(applicableJson)
        ? applicableJson
        : Array.isArray(applicableJson?.items)
          ? applicableJson.items
          : [];

      const applicableIds = new Set(
        applicableControls
          .map((item: any) => Number(item?.control_id))
          .filter((id: number) => Number.isFinite(id)),
      );

      const grouped = new Map<number, RiskLinkedControl>();

      risks.forEach((risk: any) => {
        const controlId = Number(risk?.control_id);

        if (!Number.isFinite(controlId) || applicableIds.has(controlId)) {
          return;
        }

        if (!grouped.has(controlId)) {
          grouped.set(controlId, {
            control_id: controlId,
            control_code:
              risk?.control_code || `CONTROL-${controlId}`,
            control_title:
              risk?.control_title || "Control",
            risks: [],
          });
        }

        const entry = grouped.get(controlId);

        if (entry) {
          entry.risks.push({
            id: Number(risk.id),
            title: risk?.title || "Risk",
            status: risk?.status,
            inherent_score: risk?.inherent_score ?? null,
            residual_score: risk?.residual_score ?? null,
          });
        }
      });

      setRiskLinkedControls(Array.from(grouped.values()));
    } catch (e: any) {
      setRiskLinkedControls([]);
      setRiskLinkedControlsError(
        e?.message || "Failed to load risk-linked controls.",
      );
    } finally {
      setRiskLinkedControlsLoading(false);
    }
  }

  async function addRiskLinkedControlToScope(controlId: number) {
    if (!selectedPlan?.process_id) {
      return;
    }

    setAddingApplicableControlId(controlId);
    setRiskLinkedControlsError(null);

    try {
      const res = await apiFetch(
        `/company/processes/${selectedPlan.process_id}/applicable-controls`,
        {
          method: "POST",
          body: JSON.stringify({
            control_id: controlId,
          }),
        },
      );

      if (!res.ok) {
        throw new Error(await readResponseText(res));
      }

      await loadRiskLinkedControls(selectedPlan.process_id);

      setRiskPlan(null);
      setRiskNotice(
        "Control added to the process audit scope. Generate the scope again to refresh audit priorities.",
      );
    } catch (e: any) {
      setRiskLinkedControlsError(
        e?.message || "Failed to add control to audit scope.",
      );
    } finally {
      setAddingApplicableControlId(null);
    }
  }

  function selectPlan(id: number) {
    setSelectedPlanId(id);
    setRiskPlan(null);
    setQ("");
    setPriorityFilter("ALL");
    setError(null);
  }

  function openCreatePlan() {
    setCreateError(null);
    setCreatedPlan(null);

    setForm({
      ...emptyForm,
      process_id: selectedPlan?.process_id
        ? String(selectedPlan.process_id)
        : "",
    });

    setShowCreate(true);
  }

  function closeCreatePlan() {
    if (!creating) {
      setShowCreate(false);
    }
  }

  function updateForm<K extends keyof NewAuditPlan>(
    key: K,
    value: NewAuditPlan[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function createAuditPlan(event: React.FormEvent) {
    event.preventDefault();

    setCreating(true);
    setCreateError(null);
    setCreatedPlan(null);

    try {
      if (!form.reference.trim() || !form.name.trim()) {
        throw new Error("Reference and audit name are required.");
      }

      if (
        form.planned_start &&
        form.planned_end &&
        form.planned_end < form.planned_start
      ) {
        throw new Error(
          "Planned end date cannot be before planned start date.",
        );
      }

      const payload: Record<string, unknown> = {
        reference: form.reference.trim(),
        name: form.name.trim(),
        audit_type: form.audit_type,
        objective: form.objective.trim() || null,
        scope: form.scope.trim() || null,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
      };

      if (form.process_id) {
        payload.process_id = Number(form.process_id);
      }

      if (form.standard_id) {
        payload.standard_id = Number(form.standard_id);
      }

      if (form.standard_version_id) {
        payload.standard_version_id = Number(form.standard_version_id);
      }

      if (form.lead_auditor_id) {
        payload.lead_auditor_id = Number(form.lead_auditor_id);
      }

      const res = await apiFetch("/audit/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readResponseText(res));
      }

      const created = (await res.json()) as AuditPlan;

      setCreatedPlan(created);
      await loadAuditPlans(created.id);
      setForm(emptyForm);
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create audit plan.");
    } finally {
      setCreating(false);
    }
  }

  async function generateRiskBasedPlan() {
    if (!selectedPlan?.process_id) {
      setError(
        "This audit plan has no process scope. Add a process scope before generating a risk-based plan.",
      );
      return;
    }

    setGeneratingRiskPlan(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/company/coverage/processes/${selectedPlan.process_id}/audit-plan`,
        {
          method: "GET",
        },
      );

      if (!res.ok) {
        throw new Error(await readResponseText(res));
      }

      const generated = (await res.json()) as AuditPlanResponse;
      setRiskPlan(generated);
      if (generated.total_actions === 0) {
        setRiskNotice("No eligible risk mappings are currently linked to this process. The risk-based audit scope contains no actions.");
      } else {
        setRiskNotice(`Risk-based scope generated with ${generated.total_actions} action${generated.total_actions === 1 ? "" : "s"}.`);
      }
    } catch (e: any) {
      setRiskPlan(null);
      setError(e?.message || "Failed to generate risk-based audit plan.");
    } finally {
      setGeneratingRiskPlan(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 xl:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                <ClipboardCheck size={15} />
                Internal Audit / Planning
              </div>

              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                Internal Audit Planning
              </h1>

              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Govern audit engagements, define scope, and prioritize audit
                coverage using current risk intelligence.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadAuditPlans(selectedPlanId ?? undefined)}
                disabled={loadingPlans}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loadingPlans ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreatePlan}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <FilePlus2 size={15} />
                New Audit Plan
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Layers3 size={17} />}
            label="Audit Engagements"
            value={String(auditPlans.length)}
            meta="Persistent plans in current tenant"
          />

          <KpiCard
            icon={<Target size={17} />}
            label="Risk-Based Actions"
            value={String(riskPlan?.total_actions ?? 0)}
            meta={
              selectedPlan
                ? `Scope for ${selectedPlan.reference}`
                : "Select an engagement"
            }
          />

          <KpiCard
            icon={<Zap size={17} />}
            label="Critical / High"
            value={`${riskPlan?.critical_actions ?? 0} / ${highPriorityCount}`}
            meta="Priority signals from current risk model"
          />

          <KpiCard
            icon={<Clock3 size={17} />}
            label="Forecast Signals"
            value={String(forecastCount)}
            meta="Actions with escalation probability"
          />
        </section>

        <section className="border border-slate-200 bg-white">
          <SectionHeader
            eyebrow="Engagement Register"
            title="Audit Plans"
            description="Persistent audit engagements for the current tenant."
            action={
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <ShieldCheck size={14} />
                Tenant Scoped
              </div>
            }
          />

          {loadingPlans ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Loading audit engagements...
            </div>
          ) : auditPlans.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
                <ClipboardCheck size={18} />
              </div>
              <div className="mt-4 text-sm font-semibold text-slate-900">
                No audit plans created yet
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Create an audit engagement to begin risk-based planning.
              </div>
              <button
                type="button"
                onClick={openCreatePlan}
                className="mt-5 inline-flex h-9 items-center gap-2 bg-slate-950 px-4 text-xs font-semibold text-white"
              >
                <FilePlus2 size={14} />
                Create Audit Plan
              </button>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="sticky top-0 z-20 bg-slate-50">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Reference
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Engagement
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Process
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Period
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {auditPlans.map((item) => {
                    const process = processes.find(
                      (p) => p.id === item.process_id,
                    );
                    const selected = item.id === selectedPlanId;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => selectPlan(item.id)}
                        className={`cursor-pointer transition ${
                          selected
                            ? "bg-blue-50/60"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {item.reference}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400">
                            ID {item.id}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-slate-900">
                            {item.name}
                          </div>
                          <div className="mt-1 text-xs capitalize text-slate-500">
                            {item.audit_type}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-800">
                            {process?.name || "Not scoped"}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-slate-400">
                            {process?.code || "-"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <CalendarDays size={13} />
                            {formatDate(item.planned_start)}
                            <span className="text-slate-300">to</span>
                            {formatDate(item.planned_end)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(
                                `/audit/execution?plan_id=${item.id}`,
                              );
                            }}
                            className="inline-flex h-8 items-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          >
                            Open
                            <ArrowRight size={13} />
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

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {riskNotice ? (
          <div
            className={`border px-5 py-4 ${
              riskPlan?.total_actions === 0
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div
              className={`flex items-start gap-3 text-sm font-medium ${
                riskPlan?.total_actions === 0
                  ? "text-amber-800"
                  : "text-emerald-800"
              }`}
            >
              <ShieldCheck size={17} className="mt-0.5 shrink-0" />
              <div>
                <div>{riskNotice}</div>
                {riskPlan?.total_actions === 0 ? (
                  <div className="mt-1 text-xs font-normal text-amber-700">
                    Review the process risk mappings before proceeding with risk-based audit execution.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {selectedPlan ? (
          <>
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-blue-600">
                        {selectedPlan.reference}
                      </span>
                      <StatusBadge status={selectedPlan.status} />
                      <span className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        {selectedPlan.audit_type}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                      {selectedPlan.name}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers3 size={13} />
                        {selectedProcess?.name || "No process scope"}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        {formatDate(selectedPlan.planned_start)}
                        <span className="text-slate-300">to</span>
                        {formatDate(selectedPlan.planned_end)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={generateRiskBasedPlan}
                      disabled={
                        generatingRiskPlan ||
                        loadingProcesses ||
                        !selectedPlan.process_id
                      }
                      className="inline-flex h-10 items-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Target size={15} />
                      {generatingRiskPlan
                        ? "Generating..."
                        : "Generate Risk-Based Scope"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/audit/execution?plan_id=${selectedPlan.id}`,
                        )
                      }
                      className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Open Execution
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                <div className="px-6 py-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Audit Objective
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-700">
                    {selectedPlan.objective || "No objective defined."}
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Audit Scope
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-700">
                    {selectedPlan.scope || "No scope defined."}
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white">
              <SectionHeader
                eyebrow="Scope Recommendations"
                title="Risk-Linked Controls"
                description="Controls linked to process risks that are not currently included in the audit scope."
                action={
                  selectedPlan.process_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        loadRiskLinkedControls(selectedPlan.process_id as number)
                      }
                      disabled={riskLinkedControlsLoading}
                      className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  ) : null
                }
              />

              {riskLinkedControlsError ? (
                <div className="mx-6 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  {riskLinkedControlsError}
                </div>
              ) : null}

              <div className="px-6 py-5">
                {riskLinkedControlsLoading ? (
                  <div className="border border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                    Loading risk-linked controls...
                  </div>
                ) : riskLinkedControls.length === 0 ? (
                  <div className="border border-slate-200 bg-slate-50 px-5 py-10 text-center">
                    <div className="text-sm font-semibold text-slate-800">
                      No risk-linked controls outside the audit scope
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      All process risk-linked controls are already in scope or no mapped controls exist.
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-auto border border-slate-200">
                    <table className="w-full min-w-[900px]">
                      <thead className="sticky top-0 z-20 bg-slate-50">
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Control
                          </th>
                          <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Linked Risks
                          </th>
                          <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Risk Signal
                          </th>
                          <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {riskLinkedControls.map((item) => {
                          const maxResidual = Math.max(
                            ...item.risks.map((risk) =>
                              Number(risk.residual_score ?? 0),
                            ),
                            0,
                          );

                          const maxInherent = Math.max(
                            ...item.risks.map((risk) =>
                              Number(risk.inherent_score ?? 0),
                            ),
                            0,
                          );

                          return (
                            <tr key={item.control_id} className="bg-white">
                              <td className="px-5 py-4">
                                <div className="font-mono text-xs font-semibold text-slate-900">
                                  {item.control_code}
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                  {item.control_title}
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="space-y-1.5">
                                  {item.risks.map((risk) => (
                                    <div key={risk.id}>
                                      <div className="text-xs font-medium text-slate-800">
                                        Risk #{risk.id}
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        {risk.title}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="text-xs font-semibold text-slate-800">
                                  Residual {maxResidual || "-"}
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-slate-400">
                                  Inherent {maxInherent || "-"}
                                </div>
                              </td>

                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    addRiskLinkedControlToScope(
                                      item.control_id,
                                    )
                                  }
                                  disabled={
                                    addingApplicableControlId ===
                                    item.control_id
                                  }
                                  className="inline-flex h-9 items-center border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {addingApplicableControlId ===
                                  item.control_id
                                    ? "Adding..."
                                    : "Add to Audit Scope"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Risk-linked controls are recommendations only. Adding a control explicitly places it in the process audit scope.
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white">
              <SectionHeader
                eyebrow="Risk Intelligence"
                title="Risk-Based Audit Scope"
                description={
                  riskPlan
                    ? `Generated from current risk intelligence for ${selectedPlan.reference}.`
                    : "Generate a risk-based scope for the selected engagement."
                }
                action={
                  riskPlan ? (
                    <div className="text-xs font-medium text-slate-500">
                      Showing{" "}
                      <span className="font-semibold text-slate-800">
                        {filteredActions.length}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-slate-800">
                        {riskPlan.actions.length}
                      </span>{" "}
                      actions
                    </div>
                  ) : null
                }
              />

              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    <div className="mr-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      <Filter size={13} />
                      Priority
                    </div>

                    {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPriorityFilter(value)}
                          className={`h-8 whitespace-nowrap border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                            priorityFilter === value
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                          }`}
                        >
                          {value}
                        </button>
                      ),
                    )}
                  </div>

                  <div className="relative w-full xl:max-w-md">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={q}
                      onChange={(event) => setQ(event.target.value)}
                      placeholder="Find a control, requirement or risk..."
                      className="h-9 w-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="mt-2 text-[10px] font-medium text-slate-400">
                  Search within the selected audit scope
                </div>
              </div>

              {!riskPlan && !generatingRiskPlan ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
                    <Target size={19} />
                  </div>

                  <div className="mt-4 text-sm font-semibold text-slate-900">
                    Risk-based scope has not been generated
                  </div>

                  <div className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">
                    Generate the current risk-based audit scope to prioritize
                    controls for this engagement.
                  </div>

                  <button
                    type="button"
                    onClick={generateRiskBasedPlan}
                    disabled={!selectedPlan.process_id}
                    className="mt-5 inline-flex h-9 items-center gap-2 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Target size={14} />
                    Generate Risk-Based Scope
                  </button>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[1120px] table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="w-[105px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Priority
                        </th>
                        <th className="w-[235px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Control
                        </th>
                        <th className="w-[210px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Requirement
                        </th>
                        <th className="w-[100px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Risk
                        </th>
                        <th className="w-[110px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Escalation
                        </th>
                        <th className="w-[85px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Delta
                        </th>
                        <th className="w-[100px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Forecast
                        </th>
                        <th className="w-[90px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Due
                        </th>
                        <th className="w-[125px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Owner
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {generatingRiskPlan ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-3 py-14 text-center text-sm text-slate-500"
                          >
                            Generating risk-based audit scope...
                          </td>
                        </tr>
                      ) : filteredActions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-3 py-14 text-center"
                          >
                            <div className="text-sm font-semibold text-slate-800">
                              No actions match the current view
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Clear the search or priority filter to review the
                              full generated scope.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredActions.map((item) => {
                          const score = Number(item.ai_priority_score || 0);

                          return (
                            <tr
                              key={`${selectedPlan.id}-${item.control_id}-${item.priority_score}`}
                              onClick={() =>
                                router.push(
                                  `/audit/execution?process_id=${selectedPlan.process_id}&control_id=${item.control_id}&plan_id=${selectedPlan.id}`,
                                )
                              }
                              className="cursor-pointer bg-white transition hover:bg-blue-50/40"
                            >
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-2">
                                  <PriorityBadge score={score} />
                                  <span
                                    className={`font-mono text-xs font-semibold ${scoreClass(
                                      score,
                                    )}`}
                                  >
                                    {score.toFixed(1)}
                                  </span>
                                </div>
                              </td>

                              <td className="px-3 py-4 align-top">
                                <div className="font-mono text-[11px] font-semibold text-slate-900">
                                  {item.control_code ||
                                    `CONTROL-${item.control_id}`}
                                </div>
                                <div className="mt-1 text-xs font-medium leading-4 text-slate-700">
                                  {item.control_title || "-"}
                                </div>
                                {item.control_description ? (
                                  <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">
                                    {item.control_description}
                                  </div>
                                ) : null}
                                <div className="mt-1 text-[10px] text-slate-400">
                                  {item.standard_code || "-"}
                                </div>
                              </td>

                              <td className="px-3 py-4 align-top">
                                <div className="text-xs font-medium leading-4 text-slate-700">
                                  {item.requirement_title || "-"}
                                </div>
                                {item.requirement_description ? (
                                  <div className="mt-1 line-clamp-3 text-[10px] leading-4 text-slate-400">
                                    {item.requirement_description}
                                  </div>
                                ) : null}
                              </td>

                              <td className="px-3 py-4">
                                <div className="text-xs font-semibold text-slate-800">
                                  {item.max_risk_score ?? "-"}
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-slate-400">
                                  {item.highest_risk_level || "-"}{" "}
                                  <span className="text-slate-300">/</span>{" "}
                                  {item.risk_count} risk
                                  {item.risk_count === 1 ? "" : "s"}
                                </div>
                              </td>

                              <td className="px-3 py-4">
                                <span
                                  className={`font-mono text-xs font-semibold ${probabilityClass(
                                    Number(item.escalation_probability || 0),
                                  )}`}
                                >
                                  {Math.round(
                                    Number(item.escalation_probability || 0) *
                                      100,
                                  )}
                                  %
                                </span>
                              </td>

                              <td className="px-3 py-4">
                                <span className="font-mono text-xs font-medium text-slate-700">
                                  {item.expected_score_delta >= 0 ? "+" : ""}
                                  {Number(
                                    item.expected_score_delta || 0,
                                  ).toFixed(2)}
                                </span>
                              </td>

                              <td className="px-3 py-4">
                                <span className="font-mono text-[10px] text-slate-500">
                                  {item.forecast_version || "-"}
                                </span>
                              </td>

                              <td className="px-3 py-4">
                                <span className="text-xs text-slate-700">
                                  {formatDate(item.suggested_due_date)}
                                </span>
                              </td>

                              <td className="px-3 py-4">
                                <span className="text-xs text-slate-600">
                                  {item.suggested_owner_role || "-"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {riskPlan ? (
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
                  <div className="flex flex-col gap-2 text-[10px] text-slate-500 md:flex-row md:items-center md:justify-between">
                    <span>
                      Priority combines current risk severity, coverage
                      weakness, escalation probability and expected score
                      change.
                    </span>
                    <span className="font-medium text-slate-600">
                      Risk-based scope is an audit planning recommendation.
                    </span>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {showCreate ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
            onMouseDown={closeCreatePlan}
          >
            <div
              className="w-full max-w-4xl overflow-hidden border border-slate-200 bg-white shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">
                    Audit Administration
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    Create Audit Plan
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Create a persistent audit engagement and define its
                    operational scope.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeCreatePlan}
                  disabled={creating}
                  className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
                >
                  <X size={15} />
                </button>
              </div>

              {createdPlan ? (
                <div className="p-6">
                  <div className="border border-emerald-200 bg-emerald-50 px-5 py-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={15} />
                      Audit plan created
                    </div>

                    <div className="mt-3 text-xl font-semibold text-slate-950">
                      {createdPlan.reference}
                    </div>

                    <div className="mt-1 text-sm text-slate-700">
                      {createdPlan.name}
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      Status: {createdPlan.status}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false);
                        setCreatedPlan(null);
                      }}
                      className="h-9 border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700"
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/audit/execution?plan_id=${createdPlan.id}`,
                        )
                      }
                      className="inline-flex h-9 items-center gap-2 bg-slate-950 px-4 text-xs font-semibold text-white"
                    >
                      Open Audit Execution
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={createAuditPlan}>
                  <div className="max-h-[72vh] overflow-y-auto px-6 py-6">
                    {createError ? (
                      <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                        {createError}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Field label="Audit Reference *">
                        <input
                          value={form.reference}
                          onChange={(e) =>
                            updateForm("reference", e.target.value)
                          }
                          placeholder="IA-2026-001"
                          className={inputClass}
                          required
                        />
                      </Field>

                      <Field label="Audit Name *">
                        <input
                          value={form.name}
                          onChange={(e) =>
                            updateForm("name", e.target.value)
                          }
                          placeholder="Annual Internal Compliance Audit"
                          className={inputClass}
                          required
                        />
                      </Field>

                      <Field label="Audit Type">
                        <div className="relative">
                          <select
                            value={form.audit_type}
                            onChange={(e) =>
                              updateForm("audit_type", e.target.value)
                            }
                            className={`${inputClass} appearance-none pr-9`}
                          >
                            <option value="internal">Internal</option>
                            <option value="external">External</option>
                            <option value="pre-audit">Pre-Audit</option>
                            <option value="follow-up">Follow-up</option>
                          </select>
                          <ChevronDown
                            size={14}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                        </div>
                      </Field>

                      <Field label="Process Scope">
                        <div className="relative">
                          <select
                            value={form.process_id}
                            onChange={(e) =>
                              updateForm("process_id", e.target.value)
                            }
                            className={`${inputClass} appearance-none pr-9`}
                          >
                            <option value="">No process selected</option>
                            {processes.map((process) => (
                              <option key={process.id} value={process.id}>
                                {process.code} - {process.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                        </div>
                      </Field>

                      <Field label="Planned Start">
                        <input
                          type="date"
                          value={form.planned_start}
                          onChange={(e) =>
                            updateForm("planned_start", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Planned End">
                        <input
                          type="date"
                          value={form.planned_end}
                          onChange={(e) =>
                            updateForm("planned_end", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Standard ID">
                        <input
                          inputMode="numeric"
                          value={form.standard_id}
                          onChange={(e) =>
                            updateForm(
                              "standard_id",
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Standard Version ID">
                        <input
                          inputMode="numeric"
                          value={form.standard_version_id}
                          onChange={(e) =>
                            updateForm(
                              "standard_version_id",
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Lead Auditor User ID">
                        <input
                          inputMode="numeric"
                          value={form.lead_auditor_id}
                          onChange={(e) =>
                            updateForm(
                              "lead_auditor_id",
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <div className="mt-5 space-y-5">
                      <Field label="Audit Objective">
                        <textarea
                          value={form.objective}
                          onChange={(e) =>
                            updateForm("objective", e.target.value)
                          }
                          placeholder="Define what the audit is intended to establish..."
                          rows={3}
                          className={textareaClass}
                        />
                      </Field>

                      <Field label="Audit Scope">
                        <textarea
                          value={form.scope}
                          onChange={(e) =>
                            updateForm("scope", e.target.value)
                          }
                          placeholder="Define organizational, process, system or control boundaries..."
                          rows={4}
                          className={textareaClass}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <button
                      type="button"
                      onClick={closeCreatePlan}
                      disabled={creating}
                      className="h-9 border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={creating}
                      className="h-9 bg-slate-950 px-5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create Audit Plan"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400";

const textareaClass =
  "w-full resize-none border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

async function readResponseText(res: Response) {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

