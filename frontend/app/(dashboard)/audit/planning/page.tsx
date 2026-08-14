"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import { TABLE } from "@/app/components/ui/tableTokens";
import SeverityBadge from "@/app/components/ui/SeverityBadge";

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

function priorityBadge(score: number) {
  if (score >= 75) return <SeverityBadge label="Critical" variant="danger" />;
  if (score >= 55) return <SeverityBadge label="High" variant="warning" />;
  if (score >= 35) return <SeverityBadge label="Medium" variant="info" />;
  return <SeverityBadge label="Low" variant="success" />;
}

export default function AuditPlanningPage() {
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [processId, setProcessId] = useState<number | null>(null);
  const [plan, setPlan] = useState<AuditPlanResponse | null>(null);
  const [loadingProcesses, setLoadingProcesses] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    loadProcesses();
  }, []);

  async function loadProcesses() {
    setLoadingProcesses(true);
    setError(null);
    try {
      const res = await apiFetch("/company/processes", { method: "GET" });
      if (!res.ok) throw new Error(await safeText(res));

      const json = await res.json();
      const rows: ProcessRow[] = Array.isArray(json) ? json : json?.items || [];
      setProcesses(rows);

      if (rows.length > 0) {
        setProcessId((current) => current ?? rows[0].id);
      }
    } catch (e: any) {
      setProcesses([]);
      setError(e?.message || "Failed to load processes.");
    } finally {
      setLoadingProcesses(false);
    }
  }

  useEffect(() => {
    if (processId == null) return;
    loadPlan(processId);
  }, [processId]);

  async function loadPlan(id: number) {
    setLoadingPlan(true);
    setError(null);
    try {
      const res = await apiFetch(`/company/coverage/processes/${id}/audit-plan`, { method: "GET" });
      if (!res.ok) throw new Error(await safeText(res));
      setPlan((await res.json()) as AuditPlanResponse);
    } catch (e: any) {
      setPlan(null);
      setError(e?.message || "Failed to generate audit plan.");
    } finally {
      setLoadingPlan(false);
    }
  }

  const filteredActions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!plan?.actions) return [];
    if (!s) return plan.actions;

    return plan.actions.filter((item) =>
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
        .includes(s)
    );
  }, [plan, q]);

  const selectedProcess = processes.find((p) => p.id === processId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-100">Internal Audit Planning</div>
          <div className="text-sm text-slate-400 mt-1">
            Risk-based audit planning driven by risk, control coverage and forecast intelligence
          </div>
        </div>

        <button
          type="button"
          onClick={() => processId != null && loadPlan(processId)}
          disabled={loadingPlan || processId == null}
          className="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 disabled:opacity-50"
        >
          {loadingPlan ? "Analyzing..." : "Refresh Plan"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-5 items-end">
          <div>
            <div className="text-xs text-slate-400 mb-2">Audit Scope Process</div>
            <select
              value={processId ?? ""}
              onChange={(e) => setProcessId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingProcesses}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-600"
            >
              <option value="">Select process...</option>
              {processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.code} — {process.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
            <div className="text-xs text-slate-500">Selected scope</div>
            <div className="text-sm font-semibold text-slate-100 mt-1">
              {selectedProcess ? `${selectedProcess.code} — ${selectedProcess.name}` : "No process selected"}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-200 whitespace-pre-wrap">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Audit Actions" value={String(plan?.total_actions ?? 0)} />
        <Kpi label="Critical Actions" value={String(plan?.critical_actions ?? 0)} />
        <Kpi label="High Priority" value={String((plan?.actions || []).filter((x) => x.ai_priority_score >= 55).length)} />
        <Kpi label="Forecasted Actions" value={String((plan?.actions || []).filter((x) => x.escalation_probability > 0).length)} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Risk-Based Audit Queue</div>
            <div className="text-xs text-slate-500 mt-1">
              Prioritized controls recommended for audit attention
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
            {loadingPlan ? (
              <tr className={TABLE.row}>
                <td className={TABLE.cell} colSpan={9}>Generating risk-based audit plan...</td>
              </tr>
            ) : filteredActions.length === 0 ? (
              <tr className={TABLE.row}>
                <td className={TABLE.cell} colSpan={9}>No audit actions found for this process.</td>
              </tr>
            ) : (
              filteredActions.map((item) => (
                <tr key={`${item.control_id}-${item.priority_score}`} className={TABLE.row}>
                  <td className={TABLE.cell}>
                    <div className="flex items-center gap-2">
                      {priorityBadge(item.ai_priority_score)}
                      <span className="font-semibold text-slate-100">{item.ai_priority_score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className={TABLE.cell}>
                    <div className="font-semibold text-slate-100">{item.control_code || `Control #${item.control_id}`}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.standard_code || "-"}</div>
                  </td>
                  <td className={TABLE.cell}>
                    <div>{item.requirement_code || "-"}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.clause_code || "-"}</div>
                  </td>
                  <td className={TABLE.cell}>
                    <div className="font-semibold">{item.max_risk_score ?? "-"}</div>
                    <div className="text-xs text-slate-500">{item.highest_risk_level || "-"} · {item.risk_count} risk(s)</div>
                  </td>
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
        Audit priority is calculated from current risk severity, control coverage weakness, thirty-day escalation probability and expected risk-score change.
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-100 mt-2">{value}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

async function safeText(res: Response) {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return "";
  }
}
