"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type MaturityContext = {
  tenant_id: number;
  framework_adoption_id: number;
  standard_id: number;
  standard_version_id: number;
  standard_code: string;
  standard_type: string;
  version_code: string;
  pam_framework_model_id: number;
  pam_framework_model_code: string;
  capability_framework_model_id: number;
  capability_framework_model_code: string;
};

type PamAssessment = {
  id: number;
  tenant_id: number;
  framework_adoption_id: number;
  framework_model_id: number;
  name: string;
  scope?: string | null;
  status: string;
  assessor_user_id?: number | null;
  sponsor_user_id?: number | null;
  audit_plan_id?: number | null;
  created_at: string;
  updated_at: string;
  context?: MaturityContext | null;
};

type MaturityFrameworkOption = {
  adoptionId: number;
  standardId: number;
  standardVersionId: number;
  standardCode: string;
  standardTitle: string;
  versionCode: string;
  status: string;
};

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  return [];
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .replaceAll("_", " ");

  if (!normalized) {
    return "Unknown";
  }

  return normalized.replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );
}

export default function MaturityWorkspacePage() {
  const router = useRouter();

  const [items, setItems] = useState<PamAssessment[]>([]);
  const [frameworks, setFrameworks] = useState<MaturityFrameworkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [frameworkLoading, setFrameworkLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [adoptionId, setAdoptionId] = useState("");

  useEffect(() => {
    const storedToken =
      window.localStorage.getItem("access_token") ||
      window.localStorage.getItem("token") ||
      "";

    setToken(storedToken);
  }, []);

  const loadFrameworks = useCallback(async () => {
    if (!token) {
      setFrameworkLoading(false);
      return;
    }

    setFrameworkLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/framework/adoptions`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Framework request failed: ${response.status}`
        );
      }

      const payload = await response.json();

      const rawItems = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const adoptionIds = rawItems
        .map((item: any) =>
          Number(
            item?.id ??
              item?.adoption_id ??
              item?.framework_adoption_id
          )
        )
        .filter(
          (value: number) =>
            Number.isInteger(value) && value > 0
        );

      const resolved = await Promise.all(
        adoptionIds.map(async (id: number) => {
          const resolvedResponse = await fetch(
            `${API_BASE}/framework/adoptions/${id}/resolved`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );

          if (!resolvedResponse.ok) {
            return null;
          }

          const value = await resolvedResponse.json();

          const adoption = value?.adoption;
          const standard = value?.standard;
          const version = value?.version;

          if (
            !adoption ||
            !standard ||
            !version ||
            standard.type !== "MATURITY_BASED"
          ) {
            return null;
          }

          return {
            adoptionId: Number(adoption.id),
            standardId: Number(standard.id),
            standardVersionId: Number(version.id),
            standardCode: String(
              standard.code || "Maturity Framework"
            ),
            standardTitle: String(
              standard.title ||
                standard.code ||
                "Maturity Framework"
            ),
            versionCode: String(
              version.version_code || ""
            ),
            status: String(
              adoption.status || ""
            ),
          } satisfies MaturityFrameworkOption;
        })
      );

      const options = resolved.filter(
        (
          value
        ): value is MaturityFrameworkOption =>
          value !== null
      );

      setFrameworks(options);

      setAdoptionId((current) => {
        if (
          current &&
          options.some(
            (option) =>
              String(option.adoptionId) === current
          )
        ) {
          return current;
        }

        if (options.length === 1) {
          return String(options[0].adoptionId);
        }

        return "";
      });
    } catch (err) {
      setFrameworks([]);

      setError(
        err instanceof Error
          ? err.message
          : "Maturity frameworks could not be loaded."
      );
    } finally {
      setFrameworkLoading(false);
    }
  }, [token]);

  const loadAssessments = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          body || `Assessment request failed: ${response.status}`
        );
      }

      const payload = await response.json();
      setItems(normalizeArray<PamAssessment>(payload));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Assessment data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void Promise.all([
        loadFrameworks(),
        loadAssessments(),
      ]);
    }
  }, [token, loadFrameworks, loadAssessments]);

  const activeCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status !== "completed" &&
          item.status !== "archived"
      ).length,
    [items]
  );

  async function createAssessment() {
    const cleanName = name.trim();
    const parsedAdoptionId = Number(adoptionId);

    if (!cleanName) {
      setError("Assessment name is required.");
      return;
    }

    if (
      !Number.isInteger(parsedAdoptionId) ||
      parsedAdoptionId <= 0
    ) {
      setError("A valid framework adoption is required.");
      return;
    }

    if (!token) {
      setError("Authentication token is missing.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            framework_adoption_id: parsedAdoptionId,
            name: cleanName,
            scope: scope.trim() || null,
          }),
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Assessment creation failed: ${response.status}`
        );
      }

      const created = body as PamAssessment;

      setName("");
      setScope("");
      setAdoptionId("");

      await loadAssessments();

      router.push(
        `/maturity/workspace/${created.id}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Assessment could not be created."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                  Maturity Based
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                  PAM Runtime
                </span>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Maturity Workspace
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Manage maturity assessments, process capability,
                practice achievement and assessment evidence from
                a version-scoped framework context.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadAssessments()}
              disabled={loading || !token}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 lg:px-8">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {!token ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Authentication token was not found in local storage.
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ClipboardCheck}
            label="Assessments"
            value={String(items.length)}
            detail="Tenant maturity assessments"
          />

          <MetricCard
            icon={Activity}
            label="Active Assessments"
            value={String(activeCount)}
            detail="Open assessment lifecycle"
          />

          <MetricCard
            icon={Layers3}
            label="Framework Contexts"
            value={
              frameworkLoading
                ? "-"
                : String(frameworks.length)
            }
            detail="Tenant maturity frameworks"
          />

          <MetricCard
            icon={Target}
            label="Assessment Engine"
            value="PAM"
            detail="Capability model aware"
          />
        </section>

        <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.75fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Assessment Portfolio
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Maturity assessments available to the current
                  tenant.
                </p>
              </div>

              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>

            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
                Loading assessments...
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <BarChart3 className="h-6 w-6 text-slate-500" />
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  No maturity assessment yet
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Create an assessment against an adopted maturity
                  framework to begin process capability evaluation.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item) => {
                  const context = item.context;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/maturity/workspace/${item.id}`
                        )
                      }
                      className="group grid w-full gap-4 px-6 py-5 text-left transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.5fr)_minmax(180px,0.65fr)_auto] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-950">
                            {item.name}
                          </span>

                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-sm text-slate-500">
                          {item.scope || "No scope description"}
                        </p>
                      </div>

                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Framework
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-700">
                          {context?.standard_code || "-"}
                          {context?.version_code
                            ? ` / ${context.version_code}`
                            : ""}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Created
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-700">
                          {formatDate(item.created_at)}
                        </div>
                      </div>

                      <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  New Assessment
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Start a new assessment from an existing maturity
                  framework adoption.
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Plus className="h-5 w-5 text-indigo-700" />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <Field
                label="Assessment Name"
                value={name}
                onChange={setName}
                placeholder="Example: Q4 Process Capability Assessment"
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Maturity Framework
                </label>

                {frameworkLoading ? (
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading maturity frameworks...
                  </div>
                ) : frameworks.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900">
                    No maturity framework adoption is available
                    for the current tenant.
                  </div>
                ) : (
                  <select
                    value={adoptionId}
                    onChange={(event) =>
                      setAdoptionId(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  >
                    {frameworks.length > 1 ? (
                      <option value="">
                        Select maturity framework
                      </option>
                    ) : null}

                    {frameworks.map((framework) => (
                      <option
                        key={framework.adoptionId}
                        value={framework.adoptionId}
                      >
                        {framework.standardTitle}
                        {framework.versionCode
                          ? ` - ${framework.versionCode}`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Scope
                </label>

                <textarea
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value)
                  }
                  rows={4}
                  placeholder="Describe assessment scope..."
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <button
                type="button"
                disabled={
                  creating ||
                  !token ||
                  frameworkLoading ||
                  frameworks.length === 0 ||
                  !adoptionId
                }
                onClick={() => void createAssessment()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}

                {creating
                  ? "Creating Assessment..."
                  : "Create Assessment"}
              </button>
            </div>

          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Canonical Maturity Assessment Flow
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assessment execution is separated from compliance
                matrix execution.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <FlowStep label="Framework" />
              <FlowArrow />
              <FlowStep label="Assessment" />
              <FlowArrow />
              <FlowStep label="Process" />
              <FlowArrow />
              <FlowStep label="Capability" />
              <FlowArrow />
              <FlowStep label="Evidence" />
              <FlowArrow />
              <FlowStep label="Profile" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {detail}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
      />
    </div>
  );
}

function FlowStep({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
      {label}
    </span>
  );
}

function FlowArrow() {
  return (
    <ArrowRight className="h-4 w-4 text-slate-300" />
  );
}
