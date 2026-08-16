"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type Action = {
  id: number;
  requirement_id: number;
  title: string;
  description?: string | null;
  risk_id?: number | null;
  owner_id?: number | null;
  due_date?: string | null;
  status: string;
  priority: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type Requirement = {
  id: number;
  code?: string | null;
  title?: string | null;
};

type User = {
  id: number;
  full_name?: string | null;
  email?: string | null;
};

const inputClass = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500";
const textareaClass = `${inputClass} min-h-28 resize-y`;

export default function CorrectiveActionsPage() {
  const [view, setView] = useState("ACTIVE");
  const [actions, setActions] = useState<Action[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [riskId, setRiskId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  async function loadActions() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/actions/");
      if (!res.ok) throw new Error(await safeText(res));
      setActions((await res.json()) as Action[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load corrective actions.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCreateData() {
    try {
      const [requirementsRes, usersRes] = await Promise.all([
        apiFetch("/requirements/?page=1&page_size=100"),
        apiFetch("/users/?page=1&page_size=100"),
      ]);

      if (requirementsRes.ok) setRequirements((await requirementsRes.json()) as Requirement[]);
      if (usersRes.ok) setUsers((await usersRes.json()) as User[]);
    } catch {
      // The form remains usable; the user can still close it and retry.
    }
  }

  useEffect(() => {
    loadActions();
  }, []);

  useEffect(() => {
    if (showCreate && requirements.length === 0 && users.length === 0) loadCreateData();
  }, [showCreate, requirements.length, users.length]);

  const visibleActions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (view === "COMPLETED") return actions.filter((x) => x.status === "COMPLETED");
    if (view === "OVERDUE") return actions.filter((x) => x.status !== "COMPLETED" && x.due_date && x.due_date < today);
    return actions.filter((x) => x.status !== "COMPLETED");
  }, [actions, view]);

  const kpis = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.toISOString().slice(0, 10);
    return {
      active: actions.filter((x) => x.status !== "COMPLETED").length,
      dueThisMonth: actions.filter((x) => {
        if (!x.due_date || x.status === "COMPLETED") return false;
        const d = new Date(`${x.due_date}T00:00:00`);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length,
      overdue: actions.filter((x) => x.status !== "COMPLETED" && x.due_date && x.due_date < today).length,
      completed: actions.filter((x) => x.status === "COMPLETED").length,
    };
  }, [actions]);

  function openCreate() {
    setError("");
    setMessage("");
    setTitle("");
    setDescription("");
    setRequirementId("");
    setRiskId("");
    setOwnerId("");
    setDueDate("");
    setPriority("MEDIUM");
    setShowCreate(true);
  }

  async function createAction() {
    if (!title.trim()) {
      setError("Action title is required.");
      return;
    }
    if (!requirementId) {
      setError("Requirement is required because every corrective action must remain traceable to a compliance requirement.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/actions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_id: Number(requirementId),
          title: title.trim(),
          description: description.trim() || null,
          risk_id: riskId ? Number(riskId) : null,
          owner_id: ownerId ? Number(ownerId) : null,
          due_date: dueDate || null,
          status: "OPEN",
          priority,
        }),
      });

      if (!res.ok) throw new Error(await safeText(res));

      const created = (await res.json()) as Action;
      setActions((current) => [created, ...current]);
      setShowCreate(false);
      setMessage("Corrective action created successfully.");
    } catch (e: any) {
      setError(e?.message || "Failed to create corrective action.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-100">Corrective Actions</div>
          <div className="text-sm text-slate-400 mt-1">Track remediation commitments raised from internal audit findings.</div>
        </div>
        <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white">
          Create Action
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-200 whitespace-pre-wrap">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric label="Active Actions" value={String(kpis.active)} />
        <Metric label="Due This Month" value={String(kpis.dueThisMonth)} />
        <Metric label="Overdue" value={String(kpis.overdue)} />
        <Metric label="Completed" value={String(kpis.completed)} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-100">Action Portfolio</div>
            <div className="text-xs text-slate-500 mt-1">Corrective actions remain linked to their originating compliance requirement and can be associated with risk and accountable owner.</div>
          </div>
          <div className="flex gap-2">
            {["ACTIVE", "OVERDUE", "COMPLETED"].map((x) => (
              <button key={x} type="button" onClick={() => setView(x)} className={`px-3 py-1.5 rounded-md text-xs border ${view === x ? "bg-slate-700 border-slate-600 text-white" : "border-slate-800 text-slate-400"}`}>
                {x}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading corrective actions...</div>
        ) : visibleActions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-slate-200 font-medium">No corrective actions in {view.toLowerCase()} view</div>
            <div className="text-sm text-slate-500 mt-2">Create an action and assign an accountable owner and due date.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead className="bg-slate-800/80">
                <tr>{["ID", "Action", "Requirement", "Priority", "Owner", "Due Date", "Status"].map((x) => <th key={x} className="px-4 py-3 text-left text-xs font-semibold text-slate-300">{x}</th>)}</tr>
              </thead>
              <tbody>
                {visibleActions.map((action) => (
                  <tr key={action.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-4 py-4 text-sm text-slate-500">#{action.id}</td>
                    <td className="px-4 py-4"><div className="font-medium text-slate-100">{action.title}</div><div className="text-xs text-slate-500 mt-1 max-w-md truncate">{action.description || "—"}</div></td>
                    <td className="px-4 py-4 text-sm text-slate-400">#{action.requirement_id}</td>
                    <td className="px-4 py-4"><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{action.priority}</span></td>
                    <td className="px-4 py-4 text-sm text-slate-400">{action.owner_id ? `User #${action.owner_id}` : "—"}</td>
                    <td className="px-4 py-4 text-sm text-slate-400">{action.due_date || "—"}</td>
                    <td className="px-4 py-4 text-sm text-slate-300">{action.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 md:p-8" onClick={() => setShowCreate(false)}>
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div><div className="text-lg font-semibold text-slate-100">Create Corrective Action</div><div className="text-sm text-slate-400 mt-1">Create a persistent remediation commitment with compliance traceability.</div></div>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6">
              <Field label="Action Title *"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Implement quarterly privileged access review" /></Field>
              <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></Field>
              <Field label="Requirement *"><select value={requirementId} onChange={(e) => setRequirementId(e.target.value)} className={inputClass}><option value="">Select requirement</option>{requirements.map((r) => <option key={r.id} value={r.id}>{r.code ? `${r.code} — ` : ""}{r.title || `Requirement #${r.id}`}</option>)}</select></Field>
              <Field label="Risk ID"><input type="number" value={riskId} onChange={(e) => setRiskId(e.target.value)} className={inputClass} placeholder="Optional" /></Field>
              <Field label="Accountable Owner"><select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputClass}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email || `User #${u.id}`}</option>)}</select></Field>
              <Field label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></Field>
              <Field label="Description" wide><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} placeholder="Describe the corrective action, expected outcome and implementation scope..." /></Field>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300">Cancel</button>
              <button type="button" onClick={createAction} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating..." : "Create Action"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-semibold mt-2 text-slate-100">{value}</div></div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "md:col-span-2" : ""}><label className="block text-xs font-medium text-slate-400 mb-2">{label}</label>{children}</div>;
}

async function safeText(res: Response) {
  try {
    const data = await res.json();
    if (typeof data === "string") return data;
    if (data?.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    return JSON.stringify(data);
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
