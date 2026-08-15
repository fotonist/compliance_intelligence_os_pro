"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";
import { TABLE } from "@/app/components/ui/tableTokens";
import SeverityBadge from "@/app/components/ui/SeverityBadge";

type ProcessRow = { id: number; code: string; name: string; type?: string | null; owner?: string | null; status?: string | null };

type AuditAction = {
  priority_score: number;
  standard_code?: string | null;
  clause_code?: string | null;
  requirement_code?: string | null;
  control_code?: string | null;
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

function priorityBadge(score: number) {
  if (score >= 75) return <SeverityBadge label="Critical" variant="danger" />;
  if (score >= 55) return <SeverityBadge label="High" variant="warning" />;
  if (score >= 35) return <SeverityBadge label="Medium" variant="info" />;
  return <SeverityBadge label="Low" variant="success" />;
}

export default function AuditPlanningPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [riskPlan, setRiskPlan] = useState<AuditPlanResponse | null>(null);
  const [loadingProcesses, setLoadingProcesses] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [generatingRiskPlan, setGeneratingRiskPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
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
    () => processes.find((process) => process.id === selectedPlan?.process_id) ?? null,
    [processes, selectedPlan],
  );

  useEffect(() => {
    loadProcesses();
    loadAuditPlans();
  }, []);

  async function loadProcesses() {
    setLoadingProcesses(true);
    try {
      const res = await apiFetch("/company/processes", { method: "GET" });
      if (!res.ok) throw new Error(await safeText(res));
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
      const res = await apiFetch("/audit/plans", { method: "GET" });
      if (!res.ok) throw new Error(await safeText(res));
      const json = await res.json();
      const rows: AuditPlan[] = Array.isArray(json) ? json : json?.items || [];
      setAuditPlans(rows);
      setSelectedPlanId((current) => {
        if (preferredId && rows.some((item) => item.id === preferredId)) return preferredId;
        if (current && rows.some((item) => item.id === current)) return current;
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

  function openCreatePlan() {
    setCreateError(null);
    setCreatedPlan(null);
    setForm({
      ...emptyForm,
      process_id: selectedPlan?.process_id ? String(selectedPlan.process_id) : "",
    });
    setShowCreate(true);
  }

  function closeCreatePlan() {
    if (!creating) setShowCreate(false);
  }

  function updateForm<K extends keyof NewAuditPlan>(key: K, value: NewAuditPlan[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
      if (form.planned_start && form.planned_end && form.planned_end < form.planned_start) {
        throw new Error("Planned end date cannot be before planned start date.");
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
      if (form.process_id) payload.process_id = Number(form.process_id);
      if (form.standard_id) payload.standard_id = Number(form.standard_id);
      if (form.standard_version_id) payload.standard_version_id = Number(form.standard_version_id);
      if (form.lead_auditor_id) payload.lead_auditor_id = Number(form.lead_auditor_id);

      const res = await apiFetch("/audit/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await safeText(res));

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
      setError("This audit plan has no process scope. Add a process scope before generating a risk-based plan.");
      return;
    }

    setGeneratingRiskPlan(true);
    setError(null);
    try {
      const res = await apiFetch(`/company/coverage/processes/${selectedPlan.process_id}/audit-plan`, { method: "GET" });
      if (!res.ok) throw new Error(await safeText(res));
      setRiskPlan((await res.json()) as AuditPlanResponse);
    } catch (e: any) {
      setRiskPlan(null);
      setError(e?.message || "Failed to generate risk-based audit plan.");
    } finally {
      setGeneratingRiskPlan(false);
    }
  }

  const filteredActions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!riskPlan?.actions) return [];
    if (!s) return riskPlan.actions;
    return riskPlan.actions.filter((item) =>
      [
        item.control_code,
        item.standard_code,
        item.clause_code,
        item.requirement_code,
        item.highest_risk_level,
        item.suggested_owner_role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [riskPlan, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-100">Internal Audit Planning</div>
          <div className="text-sm text-slate-400 mt-1">
            Create audit engagements, select a plan, then generate an AI-driven risk-based audit scope.
          </div>
        </div>
        <button
          type="button"
          onClick={openCreatePlan}
          className="px-4 py-2 rounded-lg text-sm bg-slate-100 hover:bg-white text-slate-950 font-semibold border border-slate-200"
        >
          + New Audit Plan
        </button>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={closeCreatePlan}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-800">
              <div>
                <div className="text-xl font-semibold text-slate-100">Create Audit Plan</div>
                <div className="text-sm text-slate-400 mt-1">
                  Create a persistent audit engagement. Risk-based planning is generated separately for the selected audit plan.
                </div>
              </div>
              <button type="button" onClick={closeCreatePlan} disabled={creating} className="text-slate-400 hover:text-slate-100 text-xl">
                ×
              </button>
            </div>

            {createdPlan ? (
              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-5">
                  <div className="text-sm font-semibold text-emerald-300">Audit plan created</div>
                  <div className="text-2xl font-semibold text-slate-100 mt-2">
                    {createdPlan.reference} — {createdPlan.name}
                  </div>
                  <div className="text-sm text-slate-400 mt-2">Status: {createdPlan.status}</div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setCreatedPlan(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/audit/execution?plan_id=${createdPlan.id}`)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold hover:bg-white"
                  >
                    Open Audit Execution
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createAuditPlan} className="p-6 space-y-6">
                {createError && (
                  <div className="rounded-lg border border-red-700/40 bg-red-950/30 p-3 text-sm text-red-200 whitespace-pre-wrap">
                    {createError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Audit Reference *">
                    <input value={form.reference} onChange={(e) => updateForm("reference", e.target.value)} placeholder="IA-2026-001" className={inputClass} required />
                  </Field>
                  <Field label="Audit Name *">
                    <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Annual Internal Compliance Audit" className={inputClass} required />
                  </Field>
                  <Field label="Audit Type">
                    <select value={form.audit_type} onChange={(e) => updateForm("audit_type", e.target.value)} className={inputClass}>
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                      <option value="pre-audit">Pre-Audit</option>
                      <option value="follow-up">Follow-up</option>
                    </select>
                  </Field>
                  <Field label="Process Scope">
                    <select value={form.process_id} onChange={(e) => updateForm("process_id", e.target.value)} className={inputClass}>
                      <option value="">No process selected</option>
                      {processes.map((process) => (
                        <option key={process.id} value={process.id}>{process.code} — {process.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Planned Start">
                    <input type="date" value={form.planned_start} onChange={(e) => updateForm("planned_start", e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Planned End">
                    <input type="date" value={form.planned_end} onChange={(e) => updateForm("planned_end", e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Standard ID">
                    <input inputMode="numeric" value={form.standard_id} onChange={(e) => updateForm("standard_id", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Optional" className={inputClass} />
                  </Field>
                  <Field label="Standard Version ID">
                    <input inputMode="numeric" value={form.standard_version_id} onChange={(e) => updateForm("standard_version_id", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Optional" className={inputClass} />
                  </Field>
                  <Field label="Lead Auditor User ID">
                    <input inputMode="numeric" value={form.lead_auditor_id} onChange={(e) => updateForm("lead_auditor_id", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Optional" className={inputClass} />
                  </Field>
                </div>
                <Field label="Audit Objective">
                  <textarea value={form.objective} onChange={(e) => updateForm("objective", e.target.value)} placeholder="Define what the audit is intended to establish..." rows={3} className={textareaClass} />
                </Field>
                <Field label="Audit Scope">
                  <textarea value={form.scope} onChange={(e) => updateForm("scope", e.target.value)} placeholder="Define organizational, process, system or control boundaries..." rows={4} className={textareaClass} />
                </Field>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeCreatePlan} disabled={creating} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</button>
                  <button type="submit" disabled={creating} className="px-5 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold hover:bg-white disabled:opacity-50">
                    {creating ? "Creating..." : "Create Audit Plan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-100">Audit Plans</div>
            <div className="text-xs text-slate-500 mt-1">Persistent audit engagements for the current tenant.</div>
          </div>
          <button
            type="button"
            onClick={() => loadAuditPlans(selectedPlanId ?? undefined)}
            disabled={loadingPlans}
            className="px-3 py-2 rounded-lg text-xs border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingPlans ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingPlans ? (
          <div className="p-5 text-sm text-slate-500">Loading audit plans...</div>
        ) : auditPlans.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-base font-semibold text-slate-200">No audit plans created yet</div>
            <div className="text-sm text-slate-500 mt-2">Create your first audit engagement to start risk-based planning.</div>
            <button type="button" onClick={openCreatePlan} className="mt-4 px-4 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold hover:bg-white">
              + Create Audit Plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className={TABLE.headerRow}>
                <tr>
                  <th className={TABLE.headerCell}>Reference</th>
                  <th className={TABLE.headerCell}>Audit</th>
                  <th className={TABLE.headerCell}>Type</th>
                  <th className={TABLE.headerCell}>Process</th>
                  <th className={TABLE.headerCell}>Period</th>
                  <th className={TABLE.headerCell}>Status</th>
                  <th className={TABLE.headerCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {auditPlans.map((item) => {
                  const process = processes.find((p) => p.id === item.process_id);
                  const selected = item.id === selectedPlanId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedPlanId(item.id);
                        setRiskPlan(null);
                        setQ("");
                      }}
                      className={`${TABLE.row} cursor-pointer ${selected ? "bg-slate-800/70" : "hover:bg-slate-800/50"}`}
                    >
                      <td className={TABLE.cell}><span className="font-semibold text-slate-100">{item.reference}</span></td>
                      <td className={TABLE.cell}><div className="font-semibold text-slate-100">{item.name}</div></td>
                      <td className={TABLE.cell}>{item.audit_type}</td>
                      <td className={TABLE.cell}>{process ? `${process.code} — ${process.name}` : "Not scoped"}</td>
                      <td className={TABLE.cell}>{item.planned_start || "-"} → {item.planned_end || "-"}</td>
                      <td className={TABLE.cell}><span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">{item.status}</span></td>
                      <td className={TABLE.cell}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/audit/execution?plan_id=${item.id}`);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-700"
                        >
                          Open
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

      {selectedPlan && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div>
              <div className="text-xs text-slate-500">Selected Audit Plan</div>
              <div className="text-xl font-semibold text-slate-100 mt-1">{selectedPlan.reference} — {selectedPlan.name}</div>
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-400">
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">{selectedPlan.audit_type}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">{selectedPlan.status}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">
                  {selectedProcess ? `${selectedProcess.code} — ${selectedProcess.name}` : "No process scope"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateRiskBasedPlan}
                disabled={generatingRiskPlan || loadingProcesses || !selectedPlan.process_id}
                className="px-4 py-2 rounded-lg text-sm bg-slate-100 text-slate-950 font-semibold hover:bg-white disabled:opacity-50"
              >
                {generatingRiskPlan ? "Generating..." : "Generate Risk-Based Plan"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/audit/execution?plan_id=${selectedPlan.id}`)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Open Audit Execution
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <div className="text-xs text-slate-500">Audit Objective</div>
              <div className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{selectedPlan.objective || "No objective defined."}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <div className="text-xs text-slate-500">Audit Scope</div>
              <div className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{selectedPlan.scope || "No scope defined."}</div>
            </div>
          </div>
        </section>
      )}

      {error && <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-200 whitespace-pre-wrap">{error}</div>}

      {selectedPlan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Kpi label="Audit Actions" value={String(riskPlan?.total_actions ?? 0)} />
            <Kpi label="Critical Actions" value={String(riskPlan?.critical_actions ?? 0)} />
            <Kpi label="High Priority" value={String((riskPlan?.actions || []).filter((x) => x.ai_priority_score >= 55).length)} />
            <Kpi label="Forecasted Actions" value={String((riskPlan?.actions || []).filter((x) => x.escalation_probability > 0).length)} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">Risk-Based Audit Queue</div>
                <div className="text-xs text-slate-500 mt-1">
                  Generated specifically for {selectedPlan.reference} using the selected process scope.
                </div>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search control, standard, risk..."
                className="w-full max-w-sm rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
              />
            </div>
          </div>

          {!riskPlan && !generatingRiskPlan && (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
              <div className="text-base font-semibold text-slate-200">Risk-based plan has not been generated</div>
              <div className="text-sm text-slate-500 mt-2">
                Generate the AI risk-based plan to prioritize controls for this audit engagement.
              </div>
              <button
                type="button"
                onClick={generateRiskBasedPlan}
                disabled={!selectedPlan.process_id}
                className="mt-4 px-4 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold hover:bg-white disabled:opacity-50"
              >
                Generate Risk-Based Plan
              </button>
            </div>
          )}

          <div className={TABLE.container}>
            <table className="w-full min-w-[1200px]">
              <thead className={TABLE.headerRow}>
                <tr>
                  <th className={TABLE.headerCell}>Priority</th>
                  <th className={TABLE.headerCell}>Control</th>
                  <th className={TABLE.headerCell}>Requirement</th>
                  <th className={TABLE.headerCell}>Risk</th>
                  <th className={TABLE.headerCell}>Escalation</th>
                  <th className={TABLE.headerCell}>Delta</th>
                  <th className={TABLE.headerCell}>Forecast</th>
                  <th className={TABLE.headerCell}>Due</th>
                  <th className={TABLE.headerCell}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {generatingRiskPlan ? (
                  <tr className={TABLE.row}><td className={TABLE.cell} colSpan={9}>Generating risk-based audit plan...</td></tr>
                ) : !riskPlan ? (
                  <tr className={TABLE.row}><td className={TABLE.cell} colSpan={9}>Generate a risk-based plan to populate this queue.</td></tr>
                ) : filteredActions.length === 0 ? (
                  <tr className={TABLE.row}><td className={TABLE.cell} colSpan={9}>No audit actions found for this audit plan.</td></tr>
                ) : (
                  filteredActions.map((item) => (
                    <tr
                      key={`${selectedPlan.id}-${item.control_id}-${item.priority_score}`}
                      onClick={() => router.push(`/audit/execution?process_id=${selectedPlan.process_id}&control_id=${item.control_id}&plan_id=${selectedPlan.id}`)}
                      className={`${TABLE.row} cursor-pointer hover:bg-slate-800/70 transition-colors`}
                      title="Open in Audit Execution"
                    >
                      <td className={TABLE.cell}>
                        <div className="flex items-center gap-2">{priorityBadge(item.ai_priority_score)}<span className="font-semibold text-slate-100">{item.ai_priority_score.toFixed(1)}</span></div>
                      </td>
                      <td className={TABLE.cell}>
                        <div className="font-semibold text-slate-100">{item.control_code || `Control #${item.control_id}`}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.standard_code || "-"}</div>
                      </td>
                      <td className={TABLE.cell}><div>{item.requirement_code || "-"}</div><div className="text-xs text-slate-500 mt-1">{item.clause_code || "-"}</div></td>
                      <td className={TABLE.cell}><div className="font-semibold">{item.max_risk_score ?? "-"}</div><div className="text-xs text-slate-500">{item.highest_risk_level || "-"} · {item.risk_count} risk(s)</div></td>
                      <td className={TABLE.cell}>{Math.round(item.escalation_probability * 100)}%</td>
                      <td className={TABLE.cell}>{item.expected_score_delta >= 0 ? "+" : ""}{item.expected_score_delta.toFixed(2)}</td>
                      <td className={TABLE.cell}>{item.forecast_version || "-"}</td>
                      <td className={TABLE.cell}>{formatDate(item.suggested_due_date)}</td>
                      <td className={TABLE.cell}>{item.suggested_owner_role}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-500">
            Risk-based priority uses current risk severity, control coverage weakness, thirty-day escalation probability and expected risk-score change. The result is an AI recommendation for audit scope prioritization; it does not create a second audit engagement.
          </div>
        </>
      )}
    </div>
  );
}

const inputClass = "w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-600";
const textareaClass = `${inputClass} resize-none`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-xs text-slate-400 mb-2">{label}</div>{children}</div>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-semibold text-slate-100 mt-2">{value}</div></div>;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try { return new Date(value).toLocaleDateString(); } catch { return value; }
}

async function safeText(res: Response) {
  try { return (await res.text()).slice(0, 500); } catch { return ""; }
}
