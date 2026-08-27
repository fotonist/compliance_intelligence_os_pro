"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Filter,
  Gauge,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

type Objective = {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  tenant_id: number;
  objective_type: string;
  priority: string;
  status: string;
  owner_user_id?: number | null;
  target_date?: string | null;
  measurement_method?: string | null;
  target_value?: number | null;
  current_value?: number | null;
  unit?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type User = {
  id: number;
  email?: string | null;
  full_name?: string | null;
};

type FormState = {
  code: string;
  title: string;
  description: string;
  objective_type: string;
  priority: string;
  status: string;
  owner_user_id: string;
  target_date: string;
  measurement_method: string;
  target_value: string;
  current_value: string;
  unit: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  title: "",
  description: "",
  objective_type: "strategic",
  priority: "medium",
  status: "draft",
  owner_user_id: "",
  target_date: "",
  measurement_method: "",
  target_value: "",
  current_value: "",
  unit: "",
};

const OBJECTIVE_TYPES = [
  ["strategic", "Strategic"],
  ["operational", "Operational"],
  ["compliance", "Compliance"],
  ["quality", "Quality"],
  ["risk", "Risk"],
  ["security", "Security"],
];

const PRIORITIES = [
  ["critical", "Critical"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
];

const STATUSES = [
  ["draft", "Draft"],
  ["active", "Active"],
  ["on_hold", "On Hold"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

function humanize(value?: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function dateInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "completed":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "on_hold":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function priorityClass(priority: string) {
  switch (priority) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700";

    case "high":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function calculateProgress(objective: Objective) {
  const target = Number(objective.target_value);
  const current = Number(objective.current_value);

  if (!Number.isFinite(target) || target === 0) return null;
  if (!Number.isFinite(current)) return 0;

  return Math.max(0, Math.min(100, (current / target) * 100));
}

function isOverdue(objective: Objective) {
  if (!objective.target_date) return false;
  if (objective.status === "completed") return false;
  if (objective.status === "cancelled") return false;

  return new Date(objective.target_date).getTime() < Date.now();
}

function ownerName(users: User[], id?: number | null) {
  if (!id) return "Unassigned";

  const user = users.find((item) => item.id === id);

  return (
    user?.full_name ||
    user?.email ||
    `User #${id}`
  );
}

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {helper}
          </div>
        </div>

        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionKey, setActionKey] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [objectiveRes, usersRes] = await Promise.all([
        apiFetch("/company/objectives"),
        apiFetch("/users"),
      ]);

      if (!objectiveRes.ok) {
        throw new Error(
          (await objectiveRes.text()) ||
            "Failed to load objectives."
        );
      }

      const objectiveData = await objectiveRes.json();

      setObjectives(
        Array.isArray(objectiveData)
          ? objectiveData
          : []
      );

      if (usersRes.ok) {
        const userData = await usersRes.json();

        setUsers(
          Array.isArray(userData)
            ? userData
            : Array.isArray(userData?.users)
            ? userData.users
            : []
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load objectives."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const total = objectives.length;

    const active = objectives.filter(
      (item) => item.status === "active"
    ).length;

    const completed = objectives.filter(
      (item) => item.status === "completed"
    ).length;

    const overdue = objectives.filter(
      isOverdue
    ).length;

    return {
      total,
      active,
      completed,
      overdue,
    };
  }, [objectives]);

  const filteredObjectives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return objectives.filter((objective) => {
      const matchesSearch =
        !query ||
        objective.code.toLowerCase().includes(query) ||
        objective.title.toLowerCase().includes(query) ||
        (objective.description || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        objective.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        objective.priority === priorityFilter;

      const matchesType =
        typeFilter === "all" ||
        objective.objective_type === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesType
      );
    });
  }, [
    objectives,
    search,
    statusFilter,
    priorityFilter,
    typeFilter,
  ]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEdit(objective: Objective) {
    setEditingId(objective.id);

    setForm({
      code: objective.code || "",
      title: objective.title || "",
      description: objective.description || "",
      objective_type:
        objective.objective_type || "strategic",
      priority:
        objective.priority || "medium",
      status:
        objective.status || "draft",
      owner_user_id:
        objective.owner_user_id != null
          ? String(objective.owner_user_id)
          : "",
      target_date: dateInput(
        objective.target_date
      ),
      measurement_method:
        objective.measurement_method || "",
      target_value:
        objective.target_value != null
          ? String(objective.target_value)
          : "",
      current_value:
        objective.current_value != null
          ? String(objective.current_value)
          : "",
      unit: objective.unit || "",
    });

    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function updateForm(
    key: keyof FormState,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveObjective() {
    setError("");
    setNotice("");

    if (!form.code.trim()) {
      setError("Objective code is required.");
      return;
    }

    if (!form.title.trim()) {
      setError("Objective title is required.");
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, any> = {
        code: form.code.trim(),
        title: form.title.trim(),
        description:
          form.description.trim() || null,
        objective_type: form.objective_type,
        priority: form.priority,
        status: form.status,
        owner_user_id: form.owner_user_id
          ? Number(form.owner_user_id)
          : null,
        target_date: form.target_date
          ? new Date(
              `${form.target_date}T23:59:59`
            ).toISOString()
          : null,
        measurement_method:
          form.measurement_method.trim() || null,
        target_value:
          form.target_value !== ""
            ? Number(form.target_value)
            : null,
        current_value:
          form.current_value !== ""
            ? Number(form.current_value)
            : null,
        unit:
          form.unit.trim() || null,
      };

      const endpoint = editingId
        ? `/company/objectives/${editingId}`
        : "/company/objectives";

      const res = await apiFetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to save objective."
        );
      }

      const saved = await res.json();

      if (editingId) {
        setObjectives((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? saved
              : item
          )
        );
      } else {
        setObjectives((prev) => [
          ...prev,
          saved,
        ]);
      }

      setModalOpen(false);
      setNotice(
        editingId
          ? "Objective updated successfully."
          : "Objective created successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to save objective."
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishObjective(
    objective: Objective
  ) {
    setActionKey(
      `publish-${objective.id}`
    );
    setError("");
    setNotice("");

    try {
      const res = await apiFetch(
        `/company/objectives/${objective.id}/publish`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to activate objective."
        );
      }

      const result = await res.json();

      setObjectives((prev) =>
        prev.map((item) =>
          item.id === objective.id
            ? {
                ...item,
                status:
                  result.status || "active",
              }
            : item
        )
      );

      setNotice(
        "Objective activated successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to activate objective."
      );
    } finally {
      setActionKey("");
    }
  }

  async function deleteObjective(
    objective: Objective
  ) {
    const confirmed = window.confirm(
      `Delete objective ${objective.code}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setActionKey(
      `delete-${objective.id}`
    );
    setError("");
    setNotice("");

    try {
      const res = await apiFetch(
        `/company/objectives/${objective.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to delete objective."
        );
      }

      setObjectives((prev) =>
        prev.filter(
          (item) =>
            item.id !== objective.id
        )
      );

      setNotice(
        "Objective deleted successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to delete objective."
      );
    } finally {
      setActionKey("");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            <Target size={14} />
            Company Foundation
            <ChevronRight size={13} />
            Objectives
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Strategic Objectives
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Define, govern and monitor the objectives that
            direct the organization's strategic and compliance
            program.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus size={17} />
          New Objective
        </button>
      </div>

      {/* NOTICES */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0"
          />
          <div>{error}</div>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0"
          />
          <div>{notice}</div>

          <button
            type="button"
            onClick={() => setNotice("")}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* METRICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Objectives"
          value={metrics.total}
          helper="Tenant objective register"
          icon={<Target size={18} />}
        />

        <MetricCard
          label="Active"
          value={metrics.active}
          helper="Currently governed"
          icon={<Activity size={18} />}
        />

        <MetricCard
          label="Completed"
          value={metrics.completed}
          helper="Objectives achieved"
          icon={<CheckCircle2 size={18} />}
        />

        <MetricCard
          label="Overdue"
          value={metrics.overdue}
          helper="Requires management attention"
          icon={<AlertTriangle size={18} />}
        />
      </div>

      {/* GOVERNANCE CONTEXT */}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp
              size={17}
              className="text-slate-600"
            />

            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Objective Governance
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Strategic objectives provide the top-level
                direction for company and compliance planning.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Strategic Direction
            </div>

            <div className="mt-2 text-sm font-medium text-slate-900">
              Objectives define organizational priorities
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Use measurable objectives to translate business
              strategy into governed outcomes.
            </p>
          </div>

          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Compliance Alignment
            </div>

            <div className="mt-2 text-sm font-medium text-slate-900">
              Compliance should support business objectives
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Compliance objectives should ultimately trace
              back to the organization's strategic direction.
            </p>
          </div>

          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Measurement
            </div>

            <div className="mt-2 text-sm font-medium text-slate-900">
              Evidence-based progress
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Define a measurement method and target/current
              values where objectives are quantifiable.
            </p>
          </div>
        </div>
      </section>

      {/* REGISTER */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Objective Register
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredObjectives.length} of{" "}
                {objectives.length} objectives
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search objectives..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 md:w-64"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Statuses
                </option>

                {STATUSES.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Priorities
                </option>

                {PRIORITIES.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Types
                </option>

                {OBJECTIVE_TYPES.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        {filteredObjectives.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Target size={21} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No objectives found
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Create the first strategic objective or
              adjust your filters.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Create Objective
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">
                    Objective
                  </th>

                  <th className="px-4 py-3">
                    Type
                  </th>

                  <th className="px-4 py-3">
                    Owner
                  </th>

                  <th className="px-4 py-3">
                    Priority
                  </th>

                  <th className="px-4 py-3">
                    Progress
                  </th>

                  <th className="px-4 py-3">
                    Target Date
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredObjectives.map(
                  (objective) => {
                    const progress =
                      calculateProgress(
                        objective
                      );

                    const overdue =
                      isOverdue(objective);

                    return (
                      <tr
                        key={objective.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
                              <Target
                                size={16}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {objective.code}
                              </div>

                              <div className="mt-1 max-w-[340px] truncate text-sm font-semibold text-slate-900">
                                {objective.title}
                              </div>

                              {objective.description && (
                                <div className="mt-1 max-w-[420px] truncate text-xs text-slate-500">
                                  {
                                    objective.description
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-xs font-medium text-slate-700">
                            {humanize(
                              objective.objective_type
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="max-w-[170px] truncate text-sm text-slate-700">
                            {ownerName(
                              users,
                              objective.owner_user_id
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass(
                              objective.priority
                            )}`}
                          >
                            {humanize(
                              objective.priority
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {progress === null ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <CircleDashed
                                size={14}
                              />
                              Not measured
                            </div>
                          ) : (
                            <div className="w-[150px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700">
                                  {Math.round(
                                    progress
                                  )}
                                  %
                                </span>

                                <span className="text-slate-400">
                                  {objective.current_value ??
                                    0}
                                  {objective.unit
                                    ? ` ${objective.unit}`
                                    : ""}
                                </span>
                              </div>

                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-slate-700"
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div
                            className={`flex items-center gap-2 text-xs font-medium ${
                              overdue
                                ? "text-red-600"
                                : "text-slate-600"
                            }`}
                          >
                            <CalendarDays
                              size={14}
                            />

                            {formatDate(
                              objective.target_date
                            )}
                          </div>

                          {overdue && (
                            <div className="mt-1 text-[11px] font-semibold text-red-600">
                              Overdue
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                              objective.status
                            )}`}
                          >
                            {humanize(
                              objective.status
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {objective.status ===
                              "draft" && (
                              <button
                                type="button"
                                title="Activate objective"
                                disabled={
                                  actionKey ===
                                  `publish-${objective.id}`
                                }
                                onClick={() =>
                                  publishObjective(
                                    objective
                                  )
                                }
                                className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <ArrowUpRight
                                  size={15}
                                />
                              </button>
                            )}

                            <button
                              type="button"
                              title="Edit objective"
                              onClick={() =>
                                openEdit(
                                  objective
                                )
                              }
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Pencil
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              title="Delete objective"
                              disabled={
                                actionKey ===
                                `delete-${objective.id}`
                              }
                              onClick={() =>
                                deleteObjective(
                                  objective
                                )
                              }
                              className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company Objective
                </div>

                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {editingId
                    ? "Edit Objective"
                    : "Create Objective"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Define a measurable objective within the
                  tenant's governance framework.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {/* IDENTITY */}

                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Target
                      size={17}
                      className="text-slate-600"
                    />

                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        Objective Identity
                      </h3>

                      <p className="text-xs text-slate-500">
                        Define the governed objective.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Objective Code
                      </label>

                      <input
                        value={form.code}
                        onChange={(e) =>
                          updateForm(
                            "code",
                            e.target.value
                          )
                        }
                        placeholder="OBJ-001"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Objective Type
                      </label>

                      <select
                        value={
                          form.objective_type
                        }
                        onChange={(e) =>
                          updateForm(
                            "objective_type",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        {OBJECTIVE_TYPES.map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Objective Title
                      </label>

                      <input
                        value={form.title}
                        onChange={(e) =>
                          updateForm(
                            "title",
                            e.target.value
                          )
                        }
                        placeholder="Maintain continuous regulatory compliance"
                        className={inputClass()}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Description
                      </label>

                      <textarea
                        value={
                          form.description
                        }
                        onChange={(e) =>
                          updateForm(
                            "description",
                            e.target.value
                          )
                        }
                        rows={4}
                        placeholder="Describe the intended business or compliance outcome..."
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </section>

                {/* GOVERNANCE */}

                <section className="border-t border-slate-200 pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Gauge
                      size={17}
                      className="text-slate-600"
                    />

                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        Governance & Ownership
                      </h3>

                      <p className="text-xs text-slate-500">
                        Establish accountability and lifecycle.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Priority
                      </label>

                      <select
                        value={form.priority}
                        onChange={(e) =>
                          updateForm(
                            "priority",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        {PRIORITIES.map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Status
                      </label>

                      <select
                        value={form.status}
                        onChange={(e) =>
                          updateForm(
                            "status",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        {STATUSES.map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Owner
                      </label>

                      <select
                        value={
                          form.owner_user_id
                        }
                        onChange={(e) =>
                          updateForm(
                            "owner_user_id",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {users.map((user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.full_name ||
                              user.email ||
                              `User #${user.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* MEASUREMENT */}

                <section className="border-t border-slate-200 pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp
                      size={17}
                      className="text-slate-600"
                    />

                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        Measurement & Target
                      </h3>

                      <p className="text-xs text-slate-500">
                        Define how objective achievement is
                        measured.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Measurement Method
                      </label>

                      <input
                        value={
                          form.measurement_method
                        }
                        onChange={(e) =>
                          updateForm(
                            "measurement_method",
                            e.target.value
                          )
                        }
                        placeholder="Monthly compliance score"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Unit
                      </label>

                      <input
                        value={form.unit}
                        onChange={(e) =>
                          updateForm(
                            "unit",
                            e.target.value
                          )
                        }
                        placeholder="%"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Target Value
                      </label>

                      <input
                        type="number"
                        step="any"
                        value={
                          form.target_value
                        }
                        onChange={(e) =>
                          updateForm(
                            "target_value",
                            e.target.value
                          )
                        }
                        placeholder="95"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Current Value
                      </label>

                      <input
                        type="number"
                        step="any"
                        value={
                          form.current_value
                        }
                        onChange={(e) =>
                          updateForm(
                            "current_value",
                            e.target.value
                          )
                        }
                        placeholder="78"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Target Date
                      </label>

                      <input
                        type="date"
                        value={form.target_date}
                        onChange={(e) =>
                          updateForm(
                            "target_date",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </section>

                {/* ALIGNMENT NOTICE */}

                <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Clock3
                      size={17}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div>
                      <div className="text-sm font-semibold text-blue-900">
                        Strategic alignment
                      </div>

                      <p className="mt-1 text-xs leading-5 text-blue-800">
                        Objectives are tenant-scoped and should
                        support the organization's strategic
                        direction. Explicit linkage to individual
                        strategic objectives will be introduced
                        when the backend relationship is modeled.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveObjective}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Save Changes"
                  : "Create Objective"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

