"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type DecisionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "closed"
  | string;

type DecisionPriority = "low" | "medium" | "high" | "critical" | string;

interface DecisionRegister {
  id: number;
  tenant_id?: number;
  decision_code: string;
  title: string;
  decision_type: string;
  status: DecisionStatus;
  priority: DecisionPriority;
  decision_date?: string | null;
  review_date?: string | null;
  decision_maker_id?: number | null;
  owner_id?: number | null;
  approver_id?: number | null;

  context?: string | null;
  rationale?: string | null;
  decision_statement?: string | null;
  expected_outcome?: string | null;
  impact_assessment?: string | null;

  policy_id?: number | null;
  procedure_id?: number | null;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

interface DecisionHistory {
  id: number;
  decision_register_id: number;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  comment?: string | null;
  performed_by?: number | null;
  created_at: string;
}

interface UserLookup {
  id: number;
  name: string;
  email?: string | null;
  role?: string | null;
}

interface GovernanceLookup {
  id: number;
  code?: string | null;
  name: string;
  title?: string | null;
}

interface DecisionForm {
  decision_code: string;
  title: string;
  decision_type: string;
  status: string;
  priority: string;
  decision_date: string;
  review_date: string;
  decision_maker_id: string;
  owner_id: string;
  approver_id: string;
  context: string;
  rationale: string;
  decision_statement: string;
  expected_outcome: string;
  impact_assessment: string;
  policy_id: string;
  procedure_id: string;
}

const EMPTY_FORM: DecisionForm = {
  decision_code: "",
  title: "",
  decision_type: "governance",
  status: "draft",
  priority: "medium",
  decision_date: "",
  review_date: "",
  decision_maker_id: "",
  owner_id: "",
  approver_id: "",
  context: "",
  rationale: "",
  decision_statement: "",
  expected_outcome: "",
  impact_assessment: "",
  policy_id: "",
  procedure_id: "",
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/[_-]/g, " ");
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "submitted":
      return "bg-amber-100 text-amber-800";
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "closed":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function priorityClass(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-amber-100 text-amber-800";
    case "low":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function unwrapCollection(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown[] }).items)
  ) {
    return (data as { items: unknown[] }).items;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { results?: unknown[] }).results)
  ) {
    return (data as { results: unknown[] }).results;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { data?: unknown[] }).data)
  ) {
    return (data as { data: unknown[] }).data;
  }

  return [];
}

function normalizeUser(item: unknown): UserLookup | null {
  if (!item || typeof item !== "object") return null;

  const row = item as Record<string, unknown>;
  const id = Number(row.id ?? row.user_id);

  if (!Number.isFinite(id)) return null;

  const firstName = String(
    row.first_name ?? row.firstname ?? "",
  ).trim();

  const lastName = String(
    row.last_name ?? row.lastname ?? "",
  ).trim();

  const fullName = String(
    row.name ??
      row.full_name ??
      row.display_name ??
      [firstName, lastName].filter(Boolean).join(" ") ??
      "",
  ).trim();

  const email = String(row.email ?? "").trim();

  return {
    id,
    name: fullName || email || `User ${id}`,
    email: email || null,
    role: row.role ? String(row.role) : null,
  };
}

function normalizeGovernanceLookup(item: unknown): GovernanceLookup | null {
  if (!item || typeof item !== "object") return null;

  const row = item as Record<string, unknown>;
  const id = Number(row.id);

  if (!Number.isFinite(id)) return null;

  const code = String(
    row.code ?? row.policy_code ?? row.procedure_code ?? "",
  ).trim();

  const name = String(
    row.name ??
      row.title ??
      row.policy_name ??
      row.procedure_name ??
      row.description ??
      "",
  ).trim();

  return {
    id,
    code: code || null,
    name: name || `Record ${id}`,
    title: row.title ? String(row.title) : null,
  };
}

function toPayload(form: DecisionForm) {
  const payload: Record<string, unknown> = {
    decision_code: form.decision_code.trim(),
    title: form.title.trim(),
    decision_type: form.decision_type.trim() || "governance",
    status: form.status || "draft",
    priority: form.priority || "medium",
    decision_statement: form.decision_statement.trim(),
  };

  const optionalStringFields = [
    "context",
    "rationale",
    "expected_outcome",
    "impact_assessment",
  ] as const;

  for (const field of optionalStringFields) {
    const value = form[field].trim();

    if (value) {
      payload[field] = value;
    }
  }

  const optionalDateFields = ["decision_date", "review_date"] as const;

  for (const field of optionalDateFields) {
    if (form[field]) {
      payload[field] = new Date(form[field]).toISOString();
    }
  }

  const optionalNumberFields = [
    "decision_maker_id",
    "owner_id",
    "approver_id",
    "policy_id",
    "procedure_id",
  ] as const;

  for (const field of optionalNumberFields) {
    const value = form[field].trim();

    if (value) {
      const parsed = Number(value);

      if (!Number.isNaN(parsed)) {
        payload[field] = parsed;
      }
    }
  }

  return payload;
}

function toEditPayload(form: DecisionForm) {
  const payload: Record<string, unknown> = {
    decision_code: form.decision_code.trim(),
    title: form.title.trim(),
    decision_type: form.decision_type.trim() || "governance",
    priority: form.priority || "medium",
    decision_statement: form.decision_statement.trim(),
  };

  const optionalStringFields = [
    "context",
    "rationale",
    "expected_outcome",
    "impact_assessment",
  ] as const;

  for (const field of optionalStringFields) {
    const value = form[field].trim();

    if (value) {
      payload[field] = value;
    }
  }

  const optionalDateFields = ["decision_date", "review_date"] as const;

  for (const field of optionalDateFields) {
    if (form[field]) {
      payload[field] = new Date(form[field]).toISOString();
    }
  }

  const optionalNumberFields = [
    "decision_maker_id",
    "owner_id",
    "policy_id",
    "procedure_id",
  ] as const;

  for (const field of optionalNumberFields) {
    const value = form[field].trim();

    if (value) {
      const parsed = Number(value);

      if (!Number.isNaN(parsed)) {
        payload[field] = parsed;
      }
    }
  }

  return payload;
}
function decisionToForm(decision: DecisionRegister): DecisionForm {
  return {
    decision_code: decision.decision_code ?? "",
    title: decision.title ?? "",
    decision_type: decision.decision_type ?? "governance",
    status: decision.status ?? "draft",
    priority: decision.priority ?? "medium",

    decision_date: decision.decision_date
      ? new Date(decision.decision_date).toISOString().slice(0, 16)
      : "",

    review_date: decision.review_date
      ? new Date(decision.review_date).toISOString().slice(0, 16)
      : "",

    decision_maker_id: decision.decision_maker_id?.toString() ?? "",
    owner_id: decision.owner_id?.toString() ?? "",
    approver_id: decision.approver_id?.toString() ?? "",

    context: decision.context ?? "",
    rationale: decision.rationale ?? "",
    decision_statement: decision.decision_statement ?? "",
    expected_outcome: decision.expected_outcome ?? "",
    impact_assessment: decision.impact_assessment ?? "",

    policy_id: decision.policy_id?.toString() ?? "",
    procedure_id: decision.procedure_id?.toString() ?? "",
  };
}

function displayUser(
  id: number | null | undefined,
  users: UserLookup[],
) {
  if (!id) return "—";

  const user = users.find((item) => item.id === id);

  if (!user) return `User ${id}`;

  return user.email ? `${user.name} (${user.email})` : user.name;
}

function displayGovernanceRecord(
  id: number | null | undefined,
  records: GovernanceLookup[],
) {
  if (!id) return "—";

  const record = records.find((item) => item.id === id);

  if (!record) return `Record ${id}`;

  return record.code
    ? `${record.code} — ${record.name}`
    : record.name;
}

export default function DecisionRegisterPage() {
  const [decisions, setDecisions] = useState<DecisionRegister[]>([]);
  const [selectedDecision, setSelectedDecision] =
    useState<DecisionRegister | null>(null);
  const [history, setHistory] = useState<DecisionHistory[]>([]);

  const [users, setUsers] = useState<UserLookup[]>([]);
  const [policies, setPolicies] = useState<GovernanceLookup[]>([]);
  const [procedures, setProcedures] = useState<GovernanceLookup[]>([]);

  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const [form, setForm] = useState<DecisionForm>(EMPTY_FORM);
  const [rejectComment, setRejectComment] = useState("");

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/decision-registers");
      const data = await response.json();

      const items = unwrapCollection(data) as DecisionRegister[];

      setDecisions(items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    setReferenceLoading(true);
    setReferenceError("");

    try {
      const [usersResponse, policiesResponse, proceduresResponse] =
        await Promise.all([
          apiFetch("/users/"),
          apiFetch("/governance/policies"),
          apiFetch("/governance/procedures"),
        ]);

      const [usersData, policiesData, proceduresData] =
        await Promise.all([
          usersResponse.json(),
          policiesResponse.json(),
          proceduresResponse.json(),
        ]);

      const normalizedUsers = unwrapCollection(usersData)
        .map(normalizeUser)
        .filter((item): item is UserLookup => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      const normalizedPolicies = unwrapCollection(policiesData)
        .map(normalizeGovernanceLookup)
        .filter((item): item is GovernanceLookup => item !== null)
        .sort((a, b) => {
          const left = a.code || a.name;
          const right = b.code || b.name;

          return left.localeCompare(right);
        });

      const normalizedProcedures = unwrapCollection(proceduresData)
        .map(normalizeGovernanceLookup)
        .filter((item): item is GovernanceLookup => item !== null)
        .sort((a, b) => {
          const left = a.code || a.name;
          const right = b.code || b.name;

          return left.localeCompare(right);
        });

      setUsers(normalizedUsers);
      setPolicies(normalizedPolicies);
      setProcedures(normalizedProcedures);
    } catch (err) {
      setReferenceError(errorMessage(err));
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  const loadDecisionDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setActionError("");

    try {
      const response = await apiFetch(`/decision-registers/${id}`);
      const data = await response.json();

      setSelectedDecision(data);
      setForm(decisionToForm(data));
      setShowDetail(true);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (id: number) => {
    setHistoryLoading(true);

    try {
      const response = await apiFetch(`/decision-registers/${id}/history`);
      const data = await response.json();

      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDecisions();
    void loadReferenceData();
  }, [loadDecisions, loadReferenceData]);

  useEffect(() => {
    if (selectedDecision) {
      void loadHistory(selectedDecision.id);
    }
  }, [selectedDecision, loadHistory]);

  const filteredDecisions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return decisions.filter((decision) => {
      const matchesSearch =
        !query ||
        decision.decision_code.toLowerCase().includes(query) ||
        decision.title.toLowerCase().includes(query) ||
        decision.decision_type.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        decision.status.toLowerCase() === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        decision.priority.toLowerCase() === priorityFilter;

      const matchesType =
        typeFilter === "all" ||
        decision.decision_type.toLowerCase() === typeFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    });
  }, [decisions, search, statusFilter, priorityFilter, typeFilter]);

  const metrics = useMemo(
    () => ({
      total: decisions.length,
      draft: decisions.filter((item) => item.status === "draft").length,
      submitted: decisions.filter((item) => item.status === "submitted").length,
      approved: decisions.filter((item) => item.status === "approved").length,
      closed: decisions.filter((item) => item.status === "closed").length,
    }),
    [decisions],
  );

  const decisionTypes = useMemo(() => {
    return Array.from(
      new Set(
        decisions
          .map((item) => item.decision_type)
          .filter(Boolean)
          .map((value) => value.toLowerCase()),
      ),
    ).sort();
  }, [decisions]);

  function updateForm<K extends keyof DecisionForm>(
    field: K,
    value: DecisionForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setActionError("");
  }

  async function createDecision(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setActionError("");
    setSuccess("");

    try {
      const response = await apiFetch("/decision-registers", {
        method: "POST",
        body: JSON.stringify(toPayload(form)),
      });

      const created = await response.json();

      setShowCreate(false);
      resetForm();
      setSuccess(`Decision ${created.decision_code} created successfully.`);
      await loadDecisions();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateDecision(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedDecision) return;

    setSaving(true);
    setActionError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/decision-registers/${selectedDecision.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(toEditPayload(form)),
        },
      );

      const updated = await response.json();

      setSelectedDecision(updated);
      setShowEdit(false);
      setShowDetail(true);
      setSuccess(`Decision ${updated.decision_code} updated successfully.`);
      await loadDecisions();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function lifecycleAction(
    action: "submit" | "approve" | "close",
  ) {
    if (!selectedDecision) return;

    setActionLoading(true);
    setActionError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/decision-registers/${selectedDecision.id}/${action}`,
        {
          method: "POST",
        },
      );

      const updated = await response.json();

      setSelectedDecision(updated);
      setSuccess(
        `Decision ${updated.decision_code} ${action} action completed.`,
      );

      await Promise.all([
        loadDecisions(),
        loadHistory(selectedDecision.id),
      ]);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectDecision() {
    if (!selectedDecision) return;

    setActionLoading(true);
    setActionError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/decision-registers/${selectedDecision.id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({
            comment: rejectComment.trim() || null,
          }),
        },
      );

      const updated = await response.json();

      setSelectedDecision(updated);
      setShowReject(false);
      setRejectComment("");

      setSuccess(`Decision ${updated.decision_code} was rejected.`);

      await Promise.all([
        loadDecisions(),
        loadHistory(selectedDecision.id),
      ]);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteDecision() {
    if (!selectedDecision) return;

    const confirmed = window.confirm(
      `Delete decision ${selectedDecision.decision_code}?`,
    );

    if (!confirmed) return;

    setActionLoading(true);
    setActionError("");
    setSuccess("");

    try {
      await apiFetch(`/decision-registers/${selectedDecision.id}`, {
        method: "DELETE",
      });

      setShowDetail(false);
      setSelectedDecision(null);
      setHistory([]);
      setSuccess("Decision register entry deleted.");
      await loadDecisions();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit() {
    if (!selectedDecision) return;

    setForm(decisionToForm(selectedDecision));
    setActionError("");
    setShowDetail(false);
    setShowEdit(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>Governance</span>
              <span>/</span>
              <span className="text-slate-700">Decision Register</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Decision Register
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Central register for governance decisions, approvals,
              accountability and decision history.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            + New Decision
          </button>
        </header>

        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {referenceError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Reference data could not be loaded completely. User, Policy or
            Procedure selections may be unavailable.
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard label="Draft" value={metrics.draft} />
          <MetricCard label="Submitted" value={metrics.submitted} />
          <MetricCard label="Approved" value={metrics.approved} />
          <MetricCard label="Closed" value={metrics.closed} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search
                </label>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Code, title or type..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <Filter
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ["all", "All statuses"],
                  ["draft", "Draft"],
                  ["submitted", "Submitted"],
                  ["approved", "Approved"],
                  ["rejected", "Rejected"],
                  ["closed", "Closed"],
                ]}
              />

              <Filter
                label="Priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  ["all", "All priorities"],
                  ["critical", "Critical"],
                  ["high", "High"],
                  ["medium", "Medium"],
                  ["low", "Low"],
                ]}
              />

              <Filter
                label="Decision type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  ["all", "All types"],
                  ...decisionTypes.map((type) => [type, type]),
                ]}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <TableHeader>Decision</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Priority</TableHeader>
                  <TableHeader>Decision Date</TableHeader>
                  <TableHeader>Review Date</TableHeader>
                  <TableHeader>Updated</TableHeader>
                  <TableHeader align="right">Action</TableHeader>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      Loading decision register...
                    </td>
                  </tr>
                ) : filteredDecisions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      No decision records found.
                    </td>
                  </tr>
                ) : (
                  filteredDecisions.map((decision) => (
                    <tr
                      key={decision.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void loadDecisionDetail(decision.id)}
                          className="text-left"
                        >
                          <div className="font-mono text-xs font-semibold text-slate-500">
                            {decision.decision_code}
                          </div>

                          <div className="mt-1 max-w-[320px] truncate text-sm font-semibold text-slate-900">
                            {decision.title}
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-4 text-sm capitalize text-slate-600">
                        {decision.decision_type}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(decision.status)}`}
                        >
                          {normalizeStatus(decision.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${priorityClass(decision.priority)}`}
                        >
                          {decision.priority}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(decision.decision_date)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(decision.review_date)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatDate(decision.updated_at)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={detailLoading}
                          onClick={() => void loadDecisionDetail(decision.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <span>
              Showing {filteredDecisions.length} of {decisions.length} records
            </span>

            <button
              type="button"
              onClick={() => void loadDecisions()}
              className="rounded-md px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>
        </section>
      </div>

      {showCreate && (
        <Modal
          title="Create Decision"
          onClose={() => {
            setShowCreate(false);
            resetForm();
          }}
        >
          <DecisionFormView
            form={form}
            onChange={updateForm}
            onSubmit={createDecision}
            onCancel={() => {
              setShowCreate(false);
              resetForm();
            }}
            saving={saving}
            error={actionError}
            referenceLoading={referenceLoading}
            users={users}
            policies={policies}
            procedures={procedures}
            submitLabel="Create Decision"
          />
        </Modal>
      )}

      {showEdit && selectedDecision && (
        <Modal
          title={`Edit ${selectedDecision.decision_code}`}
          onClose={() => {
            setShowEdit(false);
            setShowDetail(true);
          }}
        >
          <DecisionFormView
            form={form}
            onChange={updateForm}
            onSubmit={updateDecision}
            onCancel={() => {
              setShowEdit(false);
              setShowDetail(true);
            }}
            saving={saving}
            error={actionError}
            referenceLoading={referenceLoading}
            users={users}
            policies={policies}
            procedures={procedures}
            submitLabel="Save Changes"
          />
        </Modal>
      )}

      {showReject && selectedDecision && (
        <Modal
          title={`Reject ${selectedDecision.decision_code}`}
          onClose={() => {
            setShowReject(false);
            setRejectComment("");
          }}
        >
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              Provide a reason for rejecting this decision.
            </p>

            <textarea
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              rows={5}
              placeholder="Rejection reason..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />

            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReject(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void rejectDecision()}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Rejecting..." : "Reject Decision"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDetail && selectedDecision && (
        <Modal
          title={`${selectedDecision.decision_code} — Decision Record`}
          wide
          onClose={() => {
            setShowDetail(false);
            setActionError("");
          }}
        >
          <div className="space-y-6">
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {actionError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <DetailMetric
                label="Status"
                value={normalizeStatus(selectedDecision.status)}
              />

              <DetailMetric
                label="Priority"
                value={selectedDecision.priority}
              />

              <DetailMetric
                label="Decision Date"
                value={formatDate(selectedDecision.decision_date)}
              />

              <DetailMetric
                label="Review Date"
                value={formatDate(selectedDecision.review_date)}
              />
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4">
                <div className="font-mono text-xs font-semibold text-slate-500">
                  {selectedDecision.decision_code}
                </div>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedDecision.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <DetailField
                  label="Decision Type"
                  value={selectedDecision.decision_type}
                />

                <DetailField
                  label="Decision Maker"
                  value={displayUser(
                    selectedDecision.decision_maker_id,
                    users,
                  )}
                />

                <DetailField
                  label="Owner"
                  value={displayUser(selectedDecision.owner_id, users)}
                />

                <DetailField
                  label="Approver"
                  value={displayUser(
                    selectedDecision.approver_id,
                    users,
                  )}
                />

                <DetailField
                  label="Policy"
                  value={displayGovernanceRecord(
                    selectedDecision.policy_id,
                    policies,
                  )}
                />

                <DetailField
                  label="Procedure"
                  value={displayGovernanceRecord(
                    selectedDecision.procedure_id,
                    procedures,
                  )}
                />
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              {selectedDecision.status === "draft" && (
                <ActionButton
                  label="Submit"
                  loading={actionLoading}
                  onClick={() => void lifecycleAction("submit")}
                />
              )}

              {selectedDecision.status === "submitted" && (
                <>
                  <ActionButton
                    label="Approve"
                    loading={actionLoading}
                    onClick={() => void lifecycleAction("approve")}
                  />

                  <ActionButton
                    label="Reject"
                    variant="danger"
                    loading={actionLoading}
                    onClick={() => setShowReject(true)}
                  />
                </>
              )}

              {selectedDecision.status === "approved" && (
                <ActionButton
                  label="Close"
                  loading={actionLoading}
                  onClick={() => void lifecycleAction("close")}
                />
              )}

              <ActionButton
                label="Edit"
                variant="secondary"
                loading={actionLoading}
                onClick={openEdit}
              />

              <ActionButton
                label="Delete"
                variant="danger"
                loading={actionLoading}
                onClick={() => void deleteDecision()}
              />
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Decision History
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Immutable lifecycle and field-level audit trail.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadHistory(selectedDecision.id)}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                {historyLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    No history records found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[140px_120px_1fr_180px]"
                      >
                        <div className="text-xs text-slate-500">
                          {formatDateTime(item.created_at)}
                        </div>

                        <div>
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                            {normalizeStatus(item.action)}
                          </span>
                        </div>

                        <div className="text-sm text-slate-700">
                          {item.field_name ? (
                            <div>
                              <span className="font-semibold">
                                {item.field_name}
                              </span>

                              {item.old_value || item.new_value ? (
                                <span className="ml-2 text-slate-500">
                                  {item.old_value || "∅"} →{" "}
                                  {item.new_value || "∅"}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <div>{item.comment || "Lifecycle event"}</div>
                          )}

                          {item.comment && item.field_name && (
                            <div className="mt-1 text-xs text-slate-500">
                              {item.comment}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-slate-500">
                          Performed by: {item.performed_by ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
              Created: {formatDateTime(selectedDecision.created_at)} · Updated:{" "}
              {formatDateTime(selectedDecision.updated_at)}
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
  zIndex = "z-50",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  zIndex?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${
          wide ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold capitalize text-slate-900">
        {value}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const classes =
    variant === "danger"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : variant === "secondary"
        ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
    >
      {loading ? "Processing..." : label}
    </button>
  );
}

function DecisionFormView({
  form,
  onChange,
  onSubmit,
  onCancel,
  saving,
  error,
  referenceLoading,
  users,
  policies,
  procedures,
  submitLabel,
}: {
  form: DecisionForm;
  onChange: <K extends keyof DecisionForm>(
    field: K,
    value: DecisionForm[K],
  ) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  referenceLoading: boolean;
  users: UserLookup[];
  policies: GovernanceLookup[];
  procedures: GovernanceLookup[];
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Decision Code"
          required
          value={form.decision_code}
          onChange={(value) => onChange("decision_code", value)}
          placeholder="DR-2026-001"
        />

        <FormField
          label="Title"
          required
          value={form.title}
          onChange={(value) => onChange("title", value)}
          placeholder="Decision title"
        />

        <SelectField
          label="Decision Type"
          value={form.decision_type}
          onChange={(value) => onChange("decision_type", value)}
          options={[
            ["governance", "Governance"],
            ["strategic", "Strategic"],
            ["operational", "Operational"],
            ["compliance", "Compliance"],
            ["risk", "Risk"],
            ["other", "Other"],
          ]}
        />

        <SelectField
          label="Priority"
          value={form.priority}
          onChange={(value) => onChange("priority", value)}
          options={[
            ["low", "Low"],
            ["medium", "Medium"],
            ["high", "High"],
            ["critical", "Critical"],
          ]}
        />

        <FormField
          label="Decision Date"
          type="datetime-local"
          value={form.decision_date}
          onChange={(value) => onChange("decision_date", value)}
        />

        <FormField
          label="Review Date"
          type="datetime-local"
          value={form.review_date}
          onChange={(value) => onChange("review_date", value)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Accountability & Governance Links
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Select people and governance records. The system stores their IDs
            in the background.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UserSelectField
            label="Decision Maker"
            value={form.decision_maker_id}
            onChange={(value) => onChange("decision_maker_id", value)}
            users={users}
            loading={referenceLoading}
          />

          <UserSelectField
            label="Owner"
            value={form.owner_id}
            onChange={(value) => onChange("owner_id", value)}
            users={users}
            loading={referenceLoading}
          />

          <UserSelectField
            label="Approver"
            value={form.approver_id}
            onChange={(value) => onChange("approver_id", value)}
            users={users}
            loading={referenceLoading}
          />

          <GovernanceSelectField
            label="Policy"
            value={form.policy_id}
            onChange={(value) => onChange("policy_id", value)}
            records={policies}
            loading={referenceLoading}
            emptyLabel="No policy"
          />

          <GovernanceSelectField
            label="Procedure"
            value={form.procedure_id}
            onChange={(value) => onChange("procedure_id", value)}
            records={procedures}
            loading={referenceLoading}
            emptyLabel="No procedure"
          />
        </div>
      </div>

      <TextareaField
        label="Context"
        value={form.context}
        onChange={(value) => onChange("context", value)}
        placeholder="Decision context..."
      />

      <TextareaField
        label="Rationale"
        value={form.rationale}
        onChange={(value) => onChange("rationale", value)}
        placeholder="Why was this decision made?"
      />

      <TextareaField
        label="Decision Statement"
        required
        value={form.decision_statement}
        onChange={(value) => onChange("decision_statement", value)}
        placeholder="State the decision clearly..."
      />

      <TextareaField
        label="Expected Outcome"
        value={form.expected_outcome}
        onChange={(value) => onChange("expected_outcome", value)}
        placeholder="Expected outcome..."
      />

      <TextareaField
        label="Impact Assessment"
        value={form.impact_assessment}
        onChange={(value) => onChange("impact_assessment", value)}
        placeholder="Impact assessment..."
      />

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving || referenceLoading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function UserSelectField({
  label,
  value,
  onChange,
  users,
  loading,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  users: UserLookup[];
  loading: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value="">
          {loading ? "Loading users..." : `Select ${label.toLowerCase()}...`}
        </option>

        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
            {user.email ? ` — ${user.email}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function GovernanceSelectField({
  label,
  value,
  onChange,
  records,
  loading,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  records: GovernanceLookup[];
  loading: boolean;
  emptyLabel: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value="">
          {loading ? `Loading ${label.toLowerCase()}s...` : emptyLabel}
        </option>

        {records.map((record) => (
          <option key={record.id} value={record.id}>
            {record.code
              ? `${record.code} — ${record.name}`
              : record.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      >
        {options.map(([valueOption, labelOption]) => (
          <option key={valueOption} value={valueOption}>
            {labelOption}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <textarea
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}







