"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type AnyRecord = Record<string, any>;

type Action = {
  id?: number;
  title?: string | null;
  description?: string | null;
  requirement_id?: number | null;
  requirement_code?: string | null;
  requirement_title?: string | null;
  risk_id?: number | null;
  risk_code?: string | null;
  risk_title?: string | null;
  owner_id?: number | null;
  owner?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by_user_id?: number | null;
  assigned_to_user_id?: number | null;
  reviewer_user_id?: number | null;
  closed_by_user_id?: number | null;
  assigned_at?: string | null;
  started_at?: string | null;
  submitted_for_review_at?: string | null;
  reviewed_at?: string | null;
  verified_at?: string | null;
  closed_at?: string | null;
  review_comment?: string | null;
  verification_comment?: string | null;
  closure_comment?: string | null;
};

type Requirement = {
  id?: number;
  code?: string | null;
  title?: string | null;
  name?: string | null;
};

type User = {
  id?: number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

type LifecycleRow = {
  id?: number;
  action_id?: number;
  from_status?: string | null;
  to_status?: string | null;
  performed_by_user_id?: number | null;
  comment?: string | null;
  created_at?: string | null;
};

const LIFECYCLE_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED_FOR_REVIEW",
  "REVISION_REQUIRED",
  "VERIFIED",
  "CLOSED",
];

function arrayValue<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as AnyRecord;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function normalize(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function label(value?: string | null, fallback = "-") {
  if (!value) return fallback;
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dateText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function dateTimeText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isClosed(action: Action) {
  return normalize(action.status) === "CLOSED";
}

function isOverdue(action: Action) {
  if (!action.due_date || isClosed(action)) return false;
  const due = new Date(action.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function priorityRank(value?: string | null) {
  const priority = normalize(value);
  if (priority === "CRITICAL") return 4;
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  if (priority === "LOW") return 1;
  return 0;
}

function priorityClass(value?: string | null) {
  const priority = normalize(value);
  if (priority === "CRITICAL") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "HIGH") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "LOW") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function statusClass(value?: string | null) {
  const status = normalize(value);
  if (status === "CLOSED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "VERIFIED") return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "SUBMITTED_FOR_REVIEW") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "REVISION_REQUIRED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "ASSIGNED") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getUserName(user?: User | null) {
  if (!user) return "-";
  return user.full_name || user.name || user.email || (user.id != null ? `User ${user.id}` : "-");
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function KpiCard({ label: title, value, detail, icon }: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function statusIndex(status?: string | null) {
  return LIFECYCLE_STATUSES.indexOf(normalize(status));
}

export default function FollowUpActionsPage() {
  const router = useRouter();

  const [actions, setActions] = useState<Action[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [view, setView] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [riskId, setRiskId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedToId, setAssignedToId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [transitionComment, setTransitionComment] = useState("");

  async function readError(response: Response) {
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") return body.detail;
      return JSON.stringify(body);
    } catch {
      return response.statusText || "Request failed";
    }
  }

  async function getJson<T>(url: string): Promise<T> {
    const response = await apiFetch(url, { method: "GET" });
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()) as T;
  }

  async function loadData() {
    const [actionResult, requirementResult, userResult] = await Promise.allSettled([
      getJson<unknown>("/actions/"),
      getJson<unknown>("/requirements/?page=1&page_size=100"),
      getJson<unknown>("/users/?page=1&page_size=100"),
    ]);

    if (actionResult.status !== "fulfilled") throw actionResult.reason;
    setActions(arrayValue<Action>(actionResult.value));
    if (requirementResult.status === "fulfilled") setRequirements(arrayValue<Requirement>(requirementResult.value));
    if (userResult.status === "fulfilled") setUsers(arrayValue<User>(userResult.value));
  }

  async function loadLifecycle(actionId: number) {
    const data = await getJson<unknown>(`/actions/${actionId}/lifecycle`);
    setLifecycle(arrayValue<LifecycleRow>(data));
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      await loadData();
      if (selectedAction?.id != null) {
        const refreshed = await getJson<Action>(`/actions/${selectedAction.id}`);
        setSelectedAction(refreshed);
        await loadLifecycle(Number(selectedAction.id));
      }
    } catch (e: any) {
      setError(e?.message || "Follow-up actions could not be loaded.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const activeActions = useMemo(() => actions.filter((item) => !isClosed(item)), [actions]);
  const overdueActions = useMemo(() => actions.filter(isOverdue), [actions]);
  const criticalActions = useMemo(() => actions.filter((item) => priorityRank(item.priority) >= 4 && !isClosed(item)), [actions]);
  const verificationQueue = useMemo(() => actions.filter((item) => normalize(item.status) === "SUBMITTED_FOR_REVIEW"), [actions]);

  const filteredActions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...actions]
      .filter((item) => {
        if (view === "ACTIVE" && isClosed(item)) return false;
        if (view === "COMPLETED" && !isClosed(item)) return false;
        if (statusFilter !== "ALL" && normalize(item.status) !== statusFilter) return false;
        if (priorityFilter !== "ALL" && normalize(item.priority) !== priorityFilter) return false;
        if (!query) return true;
        const searchable = [
          item.id, item.title, item.description, item.requirement_id,
          item.requirement_code, item.requirement_title, item.risk_id,
          item.risk_code, item.risk_title, item.owner_id,
          item.assigned_to_user_id, item.reviewer_user_id, item.priority, item.status,
        ].filter(Boolean).join(" ").toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => {
        const overdueDelta = Number(isOverdue(b)) - Number(isOverdue(a));
        if (overdueDelta !== 0) return overdueDelta;
        const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDelta !== 0) return priorityDelta;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [actions, search, statusFilter, priorityFilter, view]);

  const statusOptions = useMemo(() => {
    const values = new Set(LIFECYCLE_STATUSES);
    actions.forEach((item) => { if (item.status) values.add(normalize(item.status)); });
    return Array.from(values);
  }, [actions]);

  const requirementById = useMemo(() => {
    const map = new Map<number, Requirement>();
    requirements.forEach((item) => { if (item.id != null) map.set(Number(item.id), item); });
    return map;
  }, [requirements]);

  const userById = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((item) => { if (item.id != null) map.set(Number(item.id), item); });
    return map;
  }, [users]);

  function requirementText(action: Action) {
    const requirement = action.requirement_id != null ? requirementById.get(Number(action.requirement_id)) : null;
    return action.requirement_code || action.requirement_title || requirement?.code || requirement?.title || requirement?.name || (action.requirement_id != null ? `Requirement ${action.requirement_id}` : "-");
  }

  function userText(id?: number | null) {
    if (id == null) return "-";
    return getUserName(userById.get(Number(id)));
  }

  function selectAction(action: Action) {
    setSelectedAction(action);
    setError("");
    setMessage("");
    setTransitionComment("");
    if (action.id != null) void loadLifecycle(Number(action.id)).catch((e: any) => setError(e?.message || "Lifecycle could not be loaded."));
  }

  function resetCreateForm() {
    setTitle("");
    setDescription("");
    setRequirementId("");
    setRiskId("");
    setOwnerId("");
    setDueDate("");
    setPriority("MEDIUM");
  }

  async function createAction(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setError("Action title is required."); return; }
    if (!requirementId) { setError("Requirement is required."); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload: AnyRecord = {
        requirement_id: Number(requirementId),
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
      };
      if (riskId) payload.risk_id = Number(riskId);
      if (ownerId) payload.owner_id = Number(ownerId);
      const response = await apiFetch("/actions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      const created = (await response.json()) as Action;
      setActions((current) => [created, ...current]);
      selectAction(created);
      setShowCreate(false);
      resetCreateForm();
      setMessage("Follow-up action created.");
    } catch (e: any) {
      setError(e?.message || "Follow-up action could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function transition(actionName: string) {
    if (!selectedAction?.id) return;
    setTransitioning(true);
    setError("");
    setMessage("");
    try {
      const payload: AnyRecord = {};
      if (transitionComment.trim()) payload.comment = transitionComment.trim();
      const response = await apiFetch(`/actions/${selectedAction.id}/${actionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      const updated = (await response.json()) as Action;
      setActions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedAction(updated);
      await loadLifecycle(Number(updated.id));
      setTransitionComment("");
      setMessage(`Action transitioned to ${label(updated.status)}.`);
    } catch (e: any) {
      setError(e?.message || "Action transition failed.");
    } finally {
      setTransitioning(false);
    }
  }

  async function assignAction() {
    if (!selectedAction?.id) return;
    if (!assignedToId) { setError("Assigned user is required."); return; }
    setTransitioning(true);
    setError("");
    setMessage("");
    try {
      const payload: AnyRecord = { assigned_to_user_id: Number(assignedToId) };
      if (reviewerId) payload.reviewer_user_id = Number(reviewerId);
      if (transitionComment.trim()) payload.comment = transitionComment.trim();
      const response = await apiFetch(`/actions/${selectedAction.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      const updated = (await response.json()) as Action;
      setActions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedAction(updated);
      await loadLifecycle(Number(updated.id));
      setShowAssign(false);
      setAssignedToId("");
      setReviewerId("");
      setTransitionComment("");
      setMessage("Action assignment updated.");
    } catch (e: any) {
      setError(e?.message || "Action assignment failed.");
    } finally {
      setTransitioning(false);
    }
  }

  function openAssign() {
    setAssignedToId(selectedAction?.assigned_to_user_id ? String(selectedAction.assigned_to_user_id) : "");
    setReviewerId(selectedAction?.reviewer_user_id ? String(selectedAction.reviewer_user_id) : "");
    setTransitionComment("");
    setError("");
    setShowAssign(true);
  }

  function transitionAvailable(name: string) {
    const status = normalize(selectedAction?.status);
    if (name === "assign") return status === "OPEN";
    if (name === "start") return status === "ASSIGNED" || status === "REVISION_REQUIRED";
    if (name === "submit-for-review") return status === "IN_PROGRESS";
    if (name === "request-revision") return status === "SUBMITTED_FOR_REVIEW";
    if (name === "verify") return status === "SUBMITTED_FOR_REVIEW";
    if (name === "close") return status === "VERIFIED";
    if (name === "reopen") return status === "CLOSED";
    return false;
  }

  if (loading) {
    return <div className="min-h-[70vh] bg-slate-50 p-6"><div className="mx-auto max-w-[1600px] border border-slate-200 bg-white p-8"><div className="flex items-center gap-3 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" />Loading follow-up action register...</div></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 xl:px-8">
        <header className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600"><Target size={14} />Audit / Follow-up Actions</div>
              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">Follow-up Actions</h1>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">Controlled remediation workflow for ownership, execution, review, verification, and closure.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => router.push("/audit/findings")} className="inline-flex h-10 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Findings</button>
              <button type="button" onClick={() => router.push("/audit/report")} className="inline-flex h-10 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Audit Report</button>
              <button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button>
              <button type="button" onClick={() => { resetCreateForm(); setShowCreate(true); setError(""); }} className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={15} />New Action</button>
            </div>
          </div>
        </header>

        {error ? <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">{message}</div> : null}

        <section className="grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active Actions" value={String(activeActions.length)} detail="Actions requiring follow-up" icon={<Target size={17} />} />
          <KpiCard label="Overdue" value={String(overdueActions.length)} detail="Past target date and not closed" icon={<AlertTriangle size={17} />} />
          <KpiCard label="Critical" value={String(criticalActions.length)} detail="Active critical-priority actions" icon={<ShieldCheck size={17} />} />
          <KpiCard label="Verification Queue" value={String(verificationQueue.length)} detail="Submitted actions awaiting review" icon={<CheckCircle2 size={17} />} />
        </section>

        <section className="border border-slate-200 bg-white">
          <SectionHeader title="Action Register" subtitle={`${filteredActions.length} actions shown from ${actions.length} persisted records`} />
          <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, requirement, owner..." className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500" /></div>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 border border-slate-300 bg-white px-3 text-sm outline-none"><option value="ALL">All Priorities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 border border-slate-300 bg-white px-3 text-sm outline-none"><option value="ALL">All Lifecycle Statuses</option>{statusOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
            <div className="flex items-center border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={() => setView("ACTIVE")} className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${view === "ACTIVE" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Active</button><button type="button" onClick={() => setView("COMPLETED")} className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${view === "COMPLETED" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Closed</button><button type="button" onClick={() => setView("ALL")} className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${view === "ALL" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>All</button></div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Priority</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Owner</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reviewer</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500"></th>
              </tr></thead>
              <tbody>
                {filteredActions.length ? filteredActions.map((action) => (
                  <tr key={action.id} onClick={() => selectAction(action)} className={`cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50 ${selectedAction?.id === action.id ? "bg-blue-50/40" : ""}`}>
                    <td className="px-4 py-4"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-500"><FileText size={14} /></div><div><div className="font-mono text-[10px] font-semibold text-slate-400">ACTION-{action.id}</div><div className="mt-1 max-w-[360px] text-xs font-semibold text-slate-900">{action.title || "Untitled action"}</div><div className="mt-1 text-[11px] text-slate-500">{requirementText(action)}</div></div></div></td>
                    <td className="px-4 py-4"><span className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase ${priorityClass(action.priority)}`}>{label(action.priority)}</span></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-700"><UserRound size={13} className="text-slate-400" />{userText(action.assigned_to_user_id ?? action.owner_id)}</div></td>
                    <td className="px-4 py-4"><div className="text-xs font-medium text-slate-700">{userText(action.reviewer_user_id)}</div></td>
                    <td className="px-4 py-4"><div className={`flex items-center gap-2 text-xs font-semibold ${isOverdue(action) ? "text-red-700" : "text-slate-700"}`}><CalendarClock size={13} />{dateText(action.due_date)}</div>{isOverdue(action) ? <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-red-600">Overdue</div> : null}</td>
                    <td className="px-4 py-4"><span className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase ${statusClass(action.status)}`}>{label(action.status)}</span></td>
                    <td className="px-4 py-4 text-right"><ChevronRight size={15} className="ml-auto text-slate-400" /></td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-5 py-16 text-center"><Filter size={18} className="mx-auto text-slate-400" /><div className="mt-4 text-sm font-semibold text-slate-800">No actions match the current view</div><div className="mt-1 text-xs text-slate-500">Adjust the search or filters to review persisted actions.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selectedAction ? (
          <>
            <button type="button" aria-label="Close action detail" onClick={() => setSelectedAction(null)} className="fixed inset-0 z-30 bg-slate-950/20" />
            <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[620px] border-l border-slate-200 bg-white shadow-2xl">
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                  <div><div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">ACTION-{selectedAction.id}</div><h2 className="mt-2 text-lg font-semibold text-slate-950">{selectedAction.title || "Untitled action"}</h2><div className="mt-2 flex flex-wrap gap-2"><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${priorityClass(selectedAction.priority)}`}>{label(selectedAction.priority)}</span><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${statusClass(selectedAction.status)}`}>{label(selectedAction.status)}</span></div></div>
                  <button type="button" onClick={() => setSelectedAction(null)} className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-900"><X size={15} /></button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="border-b border-slate-100 p-6"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Description</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedAction.description || "-"}</p></div>

                  <div className="grid grid-cols-2 gap-px bg-slate-100"><div className="bg-white p-5"><div className="text-[10px] uppercase tracking-wider text-slate-400">Owner</div><div className="mt-2 text-sm font-semibold text-slate-800">{userText(selectedAction.assigned_to_user_id ?? selectedAction.owner_id)}</div></div><div className="bg-white p-5"><div className="text-[10px] uppercase tracking-wider text-slate-400">Reviewer</div><div className="mt-2 text-sm font-semibold text-slate-800">{userText(selectedAction.reviewer_user_id)}</div></div></div>

                  <div className="border-b border-slate-100 p-6"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Compliance Context</div><div className="mt-4 space-y-4"><div><div className="text-[10px] uppercase tracking-wider text-slate-400">Requirement</div><div className="mt-1 text-sm font-semibold text-slate-800">{requirementText(selectedAction)}</div></div><div><div className="text-[10px] uppercase tracking-wider text-slate-400">Risk</div><div className="mt-1 text-sm font-semibold text-slate-800">{selectedAction.risk_title || selectedAction.risk_code || (selectedAction.risk_id != null ? `Risk ${selectedAction.risk_id}` : "-")}</div></div><div className="grid grid-cols-2 gap-4"><div><div className="text-[10px] uppercase tracking-wider text-slate-400">Target Date</div><div className="mt-1 text-sm font-semibold text-slate-800">{dateText(selectedAction.due_date)}</div></div><div><div className="text-[10px] uppercase tracking-wider text-slate-400">Priority</div><div className="mt-1 text-sm font-semibold text-slate-800">{label(selectedAction.priority)}</div></div></div></div></div>

                  <div className="border-b border-slate-100 p-6"><div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lifecycle</div><div className="mt-1 text-xs text-slate-500">Controlled transition history from the persisted lifecycle service.</div></div><Clock3 size={16} className="text-slate-400" /></div>
                    <div className="mt-5 space-y-4">
                      {lifecycle.length ? lifecycle.map((row) => <div key={row.id} className="relative border-l-2 border-slate-200 pl-4"><div className="flex items-center justify-between gap-3"><div className="text-xs font-semibold text-slate-800">{label(row.from_status)} <span className="mx-1 text-slate-400">-&gt;</span> {label(row.to_status)}</div><div className="text-[10px] text-slate-400">{dateTimeText(row.created_at)}</div></div><div className="mt-1 text-[10px] text-slate-500">Actor: {userText(row.performed_by_user_id)}</div>{row.comment ? <div className="mt-2 text-xs leading-5 text-slate-600">{row.comment}</div> : null}</div>) : <div className="border border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">No lifecycle history has been recorded yet.</div>}
                    </div>
                  </div>

                  <div className="p-6"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lifecycle Control</div><div className="mt-4 flex flex-wrap gap-2">
                    {transitionAvailable("assign") ? <button type="button" onClick={openAssign} disabled={transitioning} className="inline-flex h-9 items-center gap-2 bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><UserRound size={13} />Assign</button> : null}
                    {transitionAvailable("start") ? <button type="button" onClick={() => void transition("start")} disabled={transitioning} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"><Clock3 size={13} />Start</button> : null}
                    {transitionAvailable("submit-for-review") ? <button type="button" onClick={() => void transition("submit-for-review")} disabled={transitioning} className="inline-flex h-9 items-center gap-2 border border-violet-300 bg-violet-50 px-3 text-xs font-semibold text-violet-700 disabled:opacity-50"><ShieldCheck size={13} />Submit for Review</button> : null}
                    {transitionAvailable("request-revision") ? <button type="button" onClick={() => void transition("request-revision")} disabled={transitioning} className="inline-flex h-9 items-center gap-2 border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:opacity-50">Request Revision</button> : null}
                    {transitionAvailable("verify") ? <button type="button" onClick={() => void transition("verify")} disabled={transitioning} className="inline-flex h-9 items-center gap-2 border border-teal-300 bg-teal-50 px-3 text-xs font-semibold text-teal-700 disabled:opacity-50"><CheckCircle2 size={13} />Verify</button> : null}
                    {transitionAvailable("close") ? <button type="button" onClick={() => void transition("close")} disabled={transitioning} className="inline-flex h-9 items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 disabled:opacity-50"><CheckCircle2 size={13} />Close</button> : null}
                    {transitionAvailable("reopen") ? <button type="button" onClick={() => void transition("reopen")} disabled={transitioning} className="inline-flex h-9 items-center gap-2 border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-700 disabled:opacity-50">Reopen</button> : null}
                  </div>
                  <textarea value={transitionComment} onChange={(event) => setTransitionComment(event.target.value)} rows={3} placeholder="Transition comment (optional)" className="mt-4 w-full resize-none border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-500" />
                  </div>

                  <div className="border-t border-slate-100 p-6"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lifecycle Timestamps</div><div className="mt-4 grid grid-cols-2 gap-4">{[["Assigned", selectedAction.assigned_at], ["Started", selectedAction.started_at], ["Submitted", selectedAction.submitted_for_review_at], ["Reviewed", selectedAction.reviewed_at], ["Verified", selectedAction.verified_at], ["Closed", selectedAction.closed_at]].map(([name, value]) => <div key={String(name)}><div className="text-[10px] uppercase tracking-wider text-slate-400">{String(name)}</div><div className="mt-1 text-xs text-slate-700">{dateTimeText(value as string | null)}</div></div>)}</div></div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-6 py-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400"><ShieldCheck size={13} />Controlled lifecycle workflow</div></div>
              </div>
            </aside>
          </>
        ) : null}

        {showAssign ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-6"><div className="w-full max-w-[560px] border border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">Lifecycle Assignment</div><h2 className="mt-2 text-lg font-semibold text-slate-950">Assign Action</h2><p className="mt-1 text-xs text-slate-500">Set the action owner and an independent reviewer.</p></div><button type="button" onClick={() => setShowAssign(false)} className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400"><X size={15} /></button></div><div className="space-y-5 p-6"><div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assigned Owner</label><select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="mt-2 h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none"><option value="">Select owner</option>{users.map((item) => <option key={item.id} value={item.id}>{getUserName(item)}</option>)}</select></div><div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reviewer</label><select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="mt-2 h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none"><option value="">Select reviewer</option>{users.map((item) => <option key={item.id} value={item.id}>{getUserName(item)}</option>)}</select></div><textarea value={transitionComment} onChange={(event) => setTransitionComment(event.target.value)} rows={3} placeholder="Assignment comment (optional)" className="w-full resize-none border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-500" /></div><div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={() => setShowAssign(false)} className="h-10 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={() => void assignAction()} disabled={transitioning} className="h-10 bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-50">{transitioning ? "Saving..." : "Assign Action"}</button></div></div></div> : null}

        {showCreate ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-6"><div className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto border border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">Follow-up Management</div><h2 className="mt-2 text-lg font-semibold text-slate-950">New Follow-up Action</h2><p className="mt-1 text-xs text-slate-500">Create a persisted action in the controlled lifecycle.</p></div><button type="button" onClick={() => setShowCreate(false)} disabled={saving} className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400"><X size={15} /></button></div>
          <form onSubmit={createAction}><div className="space-y-5 p-6">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action Title</label><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Action title" className="mt-2 h-10 w-full border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Describe the action and expected outcome." className="mt-2 w-full resize-none border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-500" /></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Requirement *</label><select value={requirementId} onChange={(event) => setRequirementId(event.target.value)} className="mt-2 h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none"><option value="">Select requirement</option>{requirements.map((item) => <option key={item.id} value={item.id}>{item.code || item.title || item.name || `Requirement ${item.id}`}</option>)}</select></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk ID</label><input value={riskId} onChange={(event) => setRiskId(event.target.value)} inputMode="numeric" placeholder="Optional risk ID" className="mt-2 h-10 w-full border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Legacy Owner</label><select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-2 h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none"><option value="">Select owner</option>{users.map((item) => <option key={item.id} value={item.id}>{getUserName(item)}</option>)}</select><div className="mt-1 text-[10px] text-slate-400">Used for existing action ownership and tenant scoping.</div></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target Date</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-2 h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none" /></div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Priority</label><div className="mt-2 grid grid-cols-4 gap-2">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((item) => <button type="button" key={item} onClick={() => setPriority(item)} className={`border px-3 py-2 text-[10px] font-semibold uppercase ${priority === item ? priorityClass(item) : "border-slate-200 bg-white text-slate-500"}`}>{item}</button>)}</div></div>
          </div><div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={() => setShowCreate(false)} disabled={saving} className="h-10 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}Create Action</button></div></form></div></div> : null}

        <footer className="border-t border-slate-200 py-5 text-[10px] uppercase tracking-wider text-slate-400">Follow-up Actions / controlled lifecycle domain</footer>
      </div>
    </div>
  );
}
