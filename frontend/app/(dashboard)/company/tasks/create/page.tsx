"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  Flag,
  Layers3,
  Loader2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

type Control = {
  id: number;
  code?: string | null;
  title?: string | null;
  name?: string | null;
};

type Role = {
  id: number;
  name: string;
};

type ProcessContext = {
  id: number;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
};

const PRIORITIES = [
  {
    label: "Low",
    value: 25,
    description: "Routine action with limited compliance impact.",
  },
  {
    label: "Medium",
    value: 50,
    description: "Important action requiring planned follow-up.",
  },
  {
    label: "High",
    value: 75,
    description: "Significant compliance exposure requiring timely action.",
  },
  {
    label: "Critical",
    value: 100,
    description: "Immediate management attention and remediation required.",
  },
];

function safeText(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

function displayProcess(context: ProcessContext | null, processId: number) {
  if (!context) return `Process #${processId}`;
  const code = context.code?.trim();
  const name = context.name?.trim();
  if (code && name) return `${code} — ${name}`;
  return name || code || `Process #${processId}`;
}

function controlLabel(control: Control) {
  const code = control.code?.trim();
  const title = (control.title || control.name)?.trim();
  if (code && title) return `${code} — ${title}`;
  return title || code || `Control #${control.id}`;
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-[17px] font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-medium text-slate-800">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs leading-5 text-slate-500">{children}</p>;
}

function ReadOnlyContext({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
      {secondary && <div className="mt-0.5 text-xs text-slate-500">{secondary}</div>}
    </div>
  );
}

function CreateCompanyTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [processId, setProcessId] = useState(1);
  const [processContext, setProcessContext] = useState<ProcessContext | null>(null);
  const [controlId, setControlId] = useState<number>(0);
  const [priorityScore, setPriorityScore] = useState<number>(50);
  const [ownerRole, setOwnerRole] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [controls, setControls] = useState<Control[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPriority = useMemo(
    () => PRIORITIES.find((item) => item.value === priorityScore) || PRIORITIES[1],
    [priorityScore]
  );

  useEffect(() => {
    const pid = searchParams.get("process_id");
    if (pid && Number.isFinite(Number(pid)) && Number(pid) > 0) {
      setProcessId(Number(pid));
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadContext() {
      setLoading(true);
      setError(null);

      try {
        const [processRes, controlsRes, rolesRes] = await Promise.all([
          apiFetch(`/company/processes/${processId}`, { method: "GET" }),
          apiFetch("/controls", { method: "GET" }),
          apiFetch("/users/lookup/roles", { method: "GET" }),
        ]);

        if (processRes.ok) {
          const processJson = await processRes.json();
          setProcessContext({
            id: processJson?.id ?? processId,
            code: processJson?.code ?? null,
            name: processJson?.name ?? null,
            type: processJson?.type ?? null,
            owner: processJson?.owner ?? null,
            status: processJson?.status ?? null,
          });
        } else {
          setProcessContext({ id: processId });
        }

        if (controlsRes.ok) {
          const controlsJson = await controlsRes.json();
          const normalizedControls = Array.isArray(controlsJson)
            ? controlsJson
            : Array.isArray(controlsJson?.controls)
            ? controlsJson.controls
            : [];
          setControls(normalizedControls);

          if (normalizedControls.length > 0) {
            setControlId((current) => current || normalizedControls[0].id);
          }
        }

        if (rolesRes.ok) {
          const rolesJson = await rolesRes.json();
          setRoles(Array.isArray(rolesJson) ? rolesJson : rolesJson?.roles || []);
        }
      } catch (err) {
        console.error("Failed to load task context", err);
        setError("Task context could not be loaded. Please refresh the page and try again.");
      } finally {
        setLoading(false);
      }
    }

    loadContext();
  }, [processId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!controlId) {
      setError("Please select a compliance control.");
      return;
    }

    if (!ownerRole) {
      setError("Please assign an owner role.");
      return;
    }

    if (!dueDate) {
      setError("Please define a due date.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        process_id: Number(processId),
        control_id: Number(controlId),
        priority_score: Number(priorityScore),
        owner_role: ownerRole,
        due_date: new Date(dueDate).toISOString(),
      };

      const res = await apiFetch("/company/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await safeText(res);
        let message = `Task creation failed (${res.status}).`;

        try {
          const json = JSON.parse(body);
          message = json?.detail || message;
        } catch {
          if (body.trim()) message = body;
        }

        throw new Error(message);
      }

      router.push(`/company/processes/${processId}`);
    } catch (err: any) {
      console.error("Create task failed", err);
      setError(err?.message || "Task could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to process
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ClipboardCheck className="h-4 w-4" />
              Compliance Operations
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 lg:text-[28px]">
              Create Compliance Task
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Create a controlled remediation or compliance action and assign clear ownership, priority and deadline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              form="create-compliance-task"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <Flag className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Action required</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        )}

        <form id="create-compliance-task" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <SectionHeader
                icon={<Layers3 className="h-4 w-4" />}
                eyebrow="Compliance context"
                title="Task context"
                description="The task is created within the selected organizational process and linked to a specific compliance control."
              />
            </div>

            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <ReadOnlyContext
                label="Organizational process"
                value={displayProcess(processContext, processId)}
                secondary={
                  processContext?.owner
                    ? `Process owner: ${processContext.owner}`
                    : `Process ID: ${processId}`
                }
              />

              <div>
                <FieldLabel required>Compliance control</FieldLabel>
                <div className="relative">
                  <select
                    value={controlId || ""}
                    onChange={(e) => setControlId(Number(e.target.value))}
                    disabled={loading || controls.length === 0}
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {loading ? "Loading controls..." : controls.length ? "Select a control" : "No controls available"}
                    </option>
                    {controls.map((control) => (
                      <option key={control.id} value={control.id}>
                        {controlLabel(control)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <FieldHint>The selected control provides the compliance reference for this action.</FieldHint>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <SectionHeader
                icon={<FileCheck2 className="h-4 w-4" />}
                eyebrow="Task definition"
                title="What needs to be done?"
                description="Define the action in clear operational language so the owner and reviewer can understand the expected outcome."
              />
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <FieldLabel required>Task title</FieldLabel>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Review privileged account access quarterly"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>

              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the remediation action, expected evidence or completion criteria..."
                  rows={5}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
                <FieldHint>Keep the description specific enough to support auditability and completion verification.</FieldHint>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <SectionHeader
                icon={<ShieldCheck className="h-4 w-4" />}
                eyebrow="Execution control"
                title="Ownership & priority"
                description="Assign accountability and communicate the urgency of the compliance action."
              />
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_1fr]">
              <div>
                <FieldLabel required>Owner role</FieldLabel>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={ownerRole}
                    onChange={(e) => setOwnerRole(e.target.value)}
                    disabled={loading || roles.length === 0}
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {loading ? "Loading roles..." : roles.length ? "Select responsible role" : "No roles available"}
                    </option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <FieldHint>Accountability is assigned by role so the task remains organizationally traceable.</FieldHint>
              </div>

              <div>
                <FieldLabel required>Priority</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITIES.map((priority) => {
                    const selected = priority.value === priorityScore;
                    return (
                      <button
                        key={priority.value}
                        type="button"
                        onClick={() => setPriorityScore(priority.value)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{priority.label}</span>
                          {selected && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <div className={`mt-1 text-[11px] leading-4 ${selected ? "text-slate-300" : "text-slate-500"}`}>
                          Score {priority.value}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <FieldHint>{selectedPriority.description}</FieldHint>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <SectionHeader
                icon={<CalendarDays className="h-4 w-4" />}
                eyebrow="Planning"
                title="Target completion"
                description="Set the date by which the responsible role is expected to complete the action."
              />
            </div>

            <div className="px-6 py-6">
              <div className="max-w-md">
                <FieldLabel required>Due date</FieldLabel>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    required
                  />
                </div>
                <FieldHint>The due date is stored with the task and can be used for overdue and remediation monitoring.</FieldHint>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <div className="text-sm font-semibold text-slate-900">Ready to create this task?</div>
              <div className="mt-0.5 text-xs text-slate-500">
                The task will be created under {displayProcess(processContext, processId)}.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-compliance-task"
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Creating..." : "Create Compliance Task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateCompanyTaskPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-500">
          Loading task workspace...
        </div>
      }
    >
      <CreateCompanyTaskContent />
    </Suspense>
  );
}
