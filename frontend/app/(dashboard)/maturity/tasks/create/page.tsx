"use client";
export const dynamic = "force-dynamic";


import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type Practice = {
  id: number;
  name: string;
};

type Role = {
  id: number;
  name: string;
};

const PRIORITIES = [
  {
    label: "Low",
    value: 25,
    color: "text-sky-400",
  },
  {
    label: "Medium",
    value: 50,
    color: "text-amber-400",
  },
  {
    label: "High",
    value: 75,
    color: "text-orange-400",
  },
  {
    label: "Critical",
    value: 100,
    color: "text-rose-400",
  },
];

function CreateMaturityTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [processId, setProcessId] = useState(1);

  const [practiceId, setPracticeId] =
    useState<number>(0);

  const [priorityScore, setPriorityScore] =
    useState<number>(50);

  const [ownerRole, setOwnerRole] =
    useState("");

  const [dueDate, setDueDate] = useState("");

  const [practices, setPractices] = useState<
    Practice[]
  >([]);

  const [roles, setRoles] = useState<Role[]>([]);

  const [submitting, setSubmitting] =
    useState(false);

  // ---------------------------------------------------------
  // READ PROCESS ID FROM URL
  // ---------------------------------------------------------

  useEffect(() => {
    const pid =
      searchParams.get("process_id");

    if (pid) {
      setProcessId(Number(pid));
    }
  }, [searchParams]);

  // ---------------------------------------------------------
  // LOAD PRACTICES
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadPractices() {
      try {
        const res = await apiFetch(
          "/maturity/practices"
        );

        const data = await res.json();

        setPractices(data);

        const incomingPracticeId =
          searchParams.get("practice_id");

        if (incomingPracticeId) {
          setPracticeId(
            Number(incomingPracticeId)
          );
        } else if (data.length > 0) {
          setPracticeId(data[0].id);
        }
      } catch (err) {
        console.error(
          "Failed to load practices",
          err
        );
      }
    }

    loadPractices();
  }, [searchParams]);

  // ---------------------------------------------------------
  // LOAD ROLES
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await apiFetch(
          "/users/lookup/roles"
        );

        const data = await res.json();

        setRoles(data);
      } catch (err) {
        console.error(
          "Failed to load roles",
          err
        );
      }
    }

    loadRoles();
  }, []);

  // ---------------------------------------------------------
  // PRIORITY LABEL
  // ---------------------------------------------------------

  const selectedPriority = useMemo(() => {
    return PRIORITIES.find(
      (p) => p.value === priorityScore
    );
  }, [priorityScore]);

  // ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setSubmitting(true);

    const payload = {
      title,
      description,

      process_id: Number(processId),

      practice_id: Number(practiceId),

      priority_score:
        Number(priorityScore),

      owner_role: ownerRole,

      due_date:
        new Date(dueDate).toISOString(),
    };

    try {
      await apiFetch(
        "/company/tasks/maturity",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      router.push("/company/tasks");
    } catch (err: any) {
      console.error(err);

      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020817] text-white p-8">
      {/* HEADER */}

      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">
          Execution / Maturity Operations
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          Create Maturity Task
        </h1>

        <p className="text-slate-400 mt-2 text-sm max-w-3xl">
          Create remediation and maturity
          improvement actions linked to
          operational practices and process
          domains.
        </p>
      </div>

      {/* CONTENT */}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* MAIN FORM */}

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 backdrop-blur overflow-hidden">
          <div className="border-b border-slate-800 px-8 py-6">
            <h2 className="text-lg font-medium">
              Task Definition
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Define ownership, target
              practice and operational
              timeline.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-8 space-y-8"
          >
            {/* TITLE */}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Task Title
              </label>

              <input
                className="
                  w-full
                  rounded-2xl
                  border
                  border-slate-800
                  bg-slate-900/80
                  px-4
                  py-4
                  text-sm
                  outline-none
                  transition-all
                  focus:border-indigo-500
                  focus:ring-4
                  focus:ring-indigo-500/10
                "
                placeholder="Define the remediation or improvement activity"
                value={title}
                onChange={(e) =>
                  setTitle(
                    e.target.value
                  )
                }
                required
              />
            </div>

            {/* DESCRIPTION */}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Description
              </label>

              <textarea
                rows={5}
                className="
                  w-full
                  rounded-2xl
                  border
                  border-slate-800
                  bg-slate-900/80
                  px-4
                  py-4
                  text-sm
                  outline-none
                  resize-none
                  transition-all
                  focus:border-indigo-500
                  focus:ring-4
                  focus:ring-indigo-500/10
                "
                placeholder="Describe implementation expectations, risks, evidence targets and operational scope"
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
              />
            </div>

            {/* GRID */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PROCESS */}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Process Reference
                </label>

                <input
                  type="number"
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-800
                    bg-slate-900/60
                    px-4
                    py-4
                    text-sm
                    text-slate-400
                  "
                  value={processId}
                  readOnly
                />
              </div>

              {/* PRACTICE */}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Maturity Practice
                </label>

                <select
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-800
                    bg-slate-900/80
                    px-4
                    py-4
                    text-sm
                    outline-none
                    transition-all
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                  "
                  value={practiceId}
                  onChange={(e) =>
                    setPracticeId(
                      Number(
                        e.target.value
                      )
                    )
                  }
                >
                  {practices.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* PRIORITY */}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Priority Level
                </label>

                <select
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-800
                    bg-slate-900/80
                    px-4
                    py-4
                    text-sm
                    outline-none
                    transition-all
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                  "
                  value={priorityScore}
                  onChange={(e) =>
                    setPriorityScore(
                      Number(
                        e.target.value
                      )
                    )
                  }
                >
                  {PRIORITIES.map(
                    (p) => (
                      <option
                        key={p.value}
                        value={p.value}
                      >
                        {p.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* OWNER */}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Owner Role
                </label>

                <select
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-800
                    bg-slate-900/80
                    px-4
                    py-4
                    text-sm
                    outline-none
                    transition-all
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                  "
                  value={ownerRole}
                  onChange={(e) =>
                    setOwnerRole(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select role
                  </option>

                  {roles.map((r) => (
                    <option
                      key={r.id}
                      value={r.name}
                    >
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DATE */}

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-300">
                  Target Completion Date
                </label>

                <input
                  type="date"
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-800
                    bg-slate-900/80
                    px-4
                    py-4
                    text-sm
                    outline-none
                    transition-all
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                  "
                  value={dueDate}
                  onChange={(e) =>
                    setDueDate(
                      e.target.value
                    )
                  }
                  required
                />
              </div>
            </div>

            {/* ACTIONS */}

            <div className="flex items-center justify-end gap-4 pt-2">
              <button
                type="button"
                onClick={() =>
                  router.back()
                }
                className="
                  rounded-2xl
                  border
                  border-slate-700
                  px-5
                  py-3
                  text-sm
                  text-slate-300
                  transition-all
                  hover:bg-slate-800
                "
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="
                  rounded-2xl
                  bg-indigo-600
                  px-6
                  py-3
                  text-sm
                  font-medium
                  text-white
                  transition-all
                  hover:bg-indigo-500
                  hover:shadow-lg
                  hover:shadow-indigo-500/20
                  disabled:opacity-60
                "
              >
                {submitting
                  ? "Creating..."
                  : "Create Maturity Task"}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT PANEL */}

        <div className="space-y-6">
          {/* PRIORITY CARD */}

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
            <div className="text-sm text-slate-400 mb-2">
              Selected Priority
            </div>

            <div
              className={`
                text-3xl
                font-semibold
                ${selectedPriority?.color}
              `}
            >
              {selectedPriority?.label}
            </div>

            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{
                  width: `${priorityScore}%`,
                }}
              />
            </div>
          </div>

          {/* INFO CARD */}

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
            <div className="text-lg font-medium mb-4">
              Governance Guidance
            </div>

            <ul className="space-y-4 text-sm text-slate-400">
              <li>
                • Define measurable and
                auditable remediation actions.
              </li>

              <li>
                • Link tasks to maturity
                practices for traceability.
              </li>

              <li>
                • Assign accountable business
                ownership.
              </li>

              <li>
                • Define realistic operational
                deadlines.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function CreateMaturityTaskPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400">
          Loading...
        </div>
      }
    >
      <CreateMaturityTaskContent />
    </Suspense>
  );
}
