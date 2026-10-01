"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

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
};

type PamProcessIdentity = {
  id: number;
  code: string;
  name: string;
  purpose?: string | null;
  description?: string | null;
};

type PamProcessGroup = {
  id: number;
  code: string;
  name: string;
};

type PamProcessCategory = {
  id: number;
  code: string;
  name: string;
};

type TenantProcess = {
  id: number;
  code: string;
  name: string;
};

type PamAssessmentProcess = {
  id: number;
  assessment_id: number;
  tenant_process_id?: number | null;
  pam_process_id: number;
  in_scope: boolean;
  target_capability_level?: number | null;
  status: string;
  created_at: string;
  pam_process: PamProcessIdentity;
  process_group: PamProcessGroup;
  process_category: PamProcessCategory;
  tenant_process?: TenantProcess | null;
};

type PamProcessMapping = {
  mapping_id: number;
  mapping_type: string;
  confidence?: number | null;
  rationale?: string | null;
  tenant_process: TenantProcess;
};

type PamAvailableProcess = {
  pam_process: PamProcessIdentity;
  process_group: PamProcessGroup;
  process_category: PamProcessCategory;
  is_added: boolean;
  tenant_mappings: PamProcessMapping[];
};

type PamCapabilityLevel = {
  id: number;
  framework_model_id: number;
  level: number;
  code: string;
  name: string;
  description?: string | null;
  sort_order: number;
};

type PamContext = {
  tenant_id: number;
  framework_adoption_id: number;
  standard_id: number;
  standard_version_id: number;
  pam_framework_model_id: number;
  capability_framework_model_id: number;
  standard_code: string;
  standard_type: string;
  version_code: string;
  pam_framework_model_code: string;
  capability_framework_model_code: string;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token") ||
    ""
  );
}

function normalizeStatus(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <BadgeCheck className="h-3.5 w-3.5" />
        {detail}
      </div>
    </div>
  );
}

export default function MaturityAssessmentWorkspacePage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();

  const assessmentId = useMemo(() => {
    const value = Number(params?.sessionId);

    return Number.isInteger(value) && value > 0
      ? value
      : null;
  }, [params?.sessionId]);

  const [assessment, setAssessment] =
    useState<PamAssessment | null>(null);

  const [context, setContext] =
    useState<PamContext | null>(null);

  const [processes, setProcesses] =
    useState<PamAssessmentProcess[]>([]);

  const [availableProcesses, setAvailableProcesses] =
    useState<PamAvailableProcess[]>([]);

  const [capabilityLevels, setCapabilityLevels] =
    useState<PamCapabilityLevel[]>([]);

  const [selectedCapabilityLevel, setSelectedCapabilityLevel] =
    useState<number | null>(null);

  const [addProcessOpen, setAddProcessOpen] =
    useState(false);

  const [processSearch, setProcessSearch] =
    useState("");

  const [selectedPamProcessId, setSelectedPamProcessId] =
    useState<number | null>(null);

  const [addingProcess, setAddingProcess] =
    useState(false);

  const [addProcessError, setAddProcessError] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!assessmentId) {
      setError("Invalid assessment identifier.");
      setLoading(false);
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [
        assessmentResponse,
        contextResponse,
        processesResponse,
        availableProcessesResponse,
        capabilityLevelsResponse,
      ] = await Promise.all([
        fetch(
          `${API_BASE}/pam/assessments/${assessmentId}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),
        fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/context`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),
        fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/processes`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),
        fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/available-processes`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),
        fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/capability-levels`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),
      ]);

      if (!assessmentResponse.ok) {
        const body = await assessmentResponse.text();

        throw new Error(
          body ||
            `Assessment request failed: ${assessmentResponse.status}`
        );
      }

      if (!contextResponse.ok) {
        const body = await contextResponse.text();

        throw new Error(
          body ||
            `Context request failed: ${contextResponse.status}`
        );
      }

      if (!processesResponse.ok) {
        const body = await processesResponse.text();

        throw new Error(
          body ||
            `Processes request failed: ${processesResponse.status}`
        );
      }

      if (!availableProcessesResponse.ok) {
        const body = await availableProcessesResponse.text();

        throw new Error(
          body ||
            `Available processes request failed: ${availableProcessesResponse.status}`
        );
      }

      if (!capabilityLevelsResponse.ok) {
        const body = await capabilityLevelsResponse.text();

        throw new Error(
          body ||
            `Capability levels request failed: ${capabilityLevelsResponse.status}`
        );
      }

      const assessmentData =
        (await assessmentResponse.json()) as PamAssessment;

      const contextData =
        (await contextResponse.json()) as PamContext;

      const processData =
        (await processesResponse.json()) as PamAssessmentProcess[];

      const availableProcessData =
        (await availableProcessesResponse.json()) as PamAvailableProcess[];

      const capabilityLevelData =
        (await capabilityLevelsResponse.json()) as PamCapabilityLevel[];

      setAssessment(assessmentData);
      setContext(contextData);
      setProcesses(processData);
      setAvailableProcesses(availableProcessData);
      setCapabilityLevels(capabilityLevelData);
    } catch (err) {
      setAssessment(null);
      setContext(null);
      setProcesses([]);
      setAvailableProcesses([]);
      setCapabilityLevels([]);

      setError(
        err instanceof Error
          ? err.message
          : "Assessment workspace could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const selectableProcesses = useMemo(() => {
    const query = processSearch
      .trim()
      .toLowerCase();

    return availableProcesses.filter((item) => {
      if (item.is_added) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.process_category.code,
        item.process_category.name,
        item.process_group.code,
        item.process_group.name,
        item.pam_process.code,
        item.pam_process.name,
        item.pam_process.purpose || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [availableProcesses, processSearch]);

  const selectedAvailableProcess = useMemo(
    () =>
      availableProcesses.find(
        (item) =>
          item.pam_process.id ===
          selectedPamProcessId
      ) || null,
    [
      availableProcesses,
      selectedPamProcessId,
    ]
  );

  const addSelectedProcess = useCallback(async () => {
    if (!assessmentId || !selectedPamProcessId) {
      return;
    }

    const token = getToken();

    if (!token) {
      setAddProcessError(
        "Authentication token is not available."
      );
      return;
    }

    setAddingProcess(true);
    setAddProcessError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pam_process_id: selectedPamProcessId,
            tenant_process_id: null,
            target_capability_level: selectedCapabilityLevel,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Add process request failed: ${response.status}`
        );
      }

      setAddProcessOpen(false);
      setSelectedPamProcessId(null);
      setSelectedCapabilityLevel(null);
      setProcessSearch("");

      await loadWorkspace();
    } catch (err) {
      setAddProcessError(
        err instanceof Error
          ? err.message
          : "Process could not be added."
      );
    } finally {
      setAddingProcess(false);
    }
  }, [
    assessmentId,
    selectedPamProcessId,
    selectedCapabilityLevel,
    loadWorkspace,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading assessment workspace...
        </div>
      </div>
    );
  }

  if (error || !assessment || !context) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() =>
              router.push("/maturity/workspace")
            }
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Maturity Workspace
          </button>

          <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">
              Assessment workspace could not be loaded
            </div>

            <div className="mt-2 text-sm text-red-700">
              {error || "Assessment context is unavailable."}
            </div>

            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="mt-5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <button
          type="button"
          onClick={() =>
            router.push("/maturity/workspace")
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Maturity Workspace
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  MATURITY BASED
                </span>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  PAM Assessment
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {normalizeStatus(assessment.status)}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                {assessment.name}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {assessment.scope ||
                  "No assessment scope has been defined."}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Framework
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-950">
                {context.standard_code}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Version {context.version_code}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ClipboardCheck}
            label="Assessment Status"
            value={normalizeStatus(assessment.status)}
            detail="Canonical PAM lifecycle"
          />

          <MetricCard
            icon={Layers3}
            label="Assessment Model"
            value="PAM"
            detail={context.pam_framework_model_code}
          />

          <MetricCard
            icon={Target}
            label="Capability Model"
            value="CMF"
            detail={context.capability_framework_model_code}
          />

          <MetricCard
            icon={FileCheck2}
            label="Evidence"
            value="-"
            detail="Evidence integration pending"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Assessment Processes
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Processes selected for capability assessment.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddProcessError("");
                      setSelectedPamProcessId(null);
                      setSelectedCapabilityLevel(null);
                      setProcessSearch("");
                      setAddProcessOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Process
                  </button>

                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                    <Boxes className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {processes.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center p-8">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>

                  <div className="mt-4 text-base font-semibold text-slate-950">
                    0 Processes
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    No processes have been added to this assessment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {processes.map((process) => (
                  <button
                    key={process.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/maturity/workspace/${assessment.id}/process/${process.id}`
                      )
                    }
                    className="block w-full px-6 py-5 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {process.pam_process.code}
                          </span>

                          <span className="text-xs font-medium text-slate-400">
                            {process.process_category.code}
                            {" / "}
                            {process.process_group.code}
                          </span>
                        </div>

                        <div className="mt-2 text-base font-semibold text-slate-950">
                          {process.pam_process.name}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {process.tenant_process
                            ? `${process.tenant_process.code} - ${process.tenant_process.name}`
                            : "No tenant process mapping"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {normalizeStatus(process.status)}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          Target{" "}
                          {process.target_capability_level ?? "-"}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          {process.in_scope
                            ? "In Scope"
                            : "Out of Scope"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Canonical Context
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Resolved tenant framework context.
                </p>
              </div>

              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-6 space-y-4">
              <ContextRow
                label="Standard"
                value={context.standard_code}
              />

              <ContextRow
                label="Version"
                value={context.version_code}
              />

              <ContextRow
                label="Framework Type"
                value={context.standard_type}
              />

              <ContextRow
                label="PAM Model"
                value={context.pam_framework_model_code}
              />

              <ContextRow
                label="Capability Model"
                value={context.capability_framework_model_code}
              />
            </div>
          </section>
        </div>
      </div>

      {addProcessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  PAM Process Catalog
                </div>

                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  Add Assessment Process
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select a process from the resolved assessment model.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAddProcessOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-950"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 p-5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={processSearch}
                  onChange={(event) =>
                    setProcessSearch(event.target.value)
                  }
                  placeholder="Search category, group, process code or name..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {selectableProcesses.length} available
                </span>

                <span>?</span>

                <span>
                  {processes.length} already added
                </span>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-y-auto border-r border-slate-200">
                {selectableProcesses.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No matching PAM processes are available.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {selectableProcesses.map((item) => {
                      const selected =
                        selectedPamProcessId ===
                        item.pam_process.id;

                      return (
                        <button
                          key={item.pam_process.id}
                          type="button"
                          onClick={() =>
                            setSelectedPamProcessId(
                              item.pam_process.id
                            )
                          }
                          className={`w-full px-5 py-4 text-left transition ${
                            selected
                              ? "bg-indigo-50"
                              : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                  {item.pam_process.code}
                                </span>

                                <span className="text-xs text-slate-400">
                                  {item.process_category.code}
                                  {" / "}
                                  {item.process_group.code}
                                </span>
                              </div>

                              <div className="mt-2 text-sm font-semibold text-slate-950">
                                {item.pam_process.name}
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                                item.tenant_mappings.length > 0
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              }`}
                            >
                              {item.tenant_mappings.length > 0
                                ? "Mapped"
                                : "Unmapped"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto bg-slate-50 p-6">
                {selectedAvailableProcess ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Selected Process
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                        {
                          selectedAvailableProcess
                            .pam_process.code
                        }
                      </span>

                      <span className="text-xs text-slate-500">
                        {
                          selectedAvailableProcess
                            .process_category.name
                        }
                        {" / "}
                        {
                          selectedAvailableProcess
                            .process_group.name
                        }
                      </span>
                    </div>

                    <h3 className="mt-4 text-xl font-semibold text-slate-950">
                      {
                        selectedAvailableProcess
                          .pam_process.name
                      }
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {
                        selectedAvailableProcess
                          .pam_process.purpose ||
                        selectedAvailableProcess
                          .pam_process.description ||
                        "No process purpose is available."
                      }
                    </p>

                    <div className="mt-6">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Target Capability
                      </label>

                      <select
                        value={
                          selectedCapabilityLevel === null
                            ? ""
                            : String(selectedCapabilityLevel)
                        }
                        onChange={(event) => {
                          const value = event.target.value;

                          setSelectedCapabilityLevel(
                            value === ""
                              ? null
                              : Number(value)
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500"
                      >
                        <option value="">
                          No target selected
                        </option>

                        {capabilityLevels.map((level) => (
                          <option
                            key={level.id}
                            value={level.level}
                          >
                            {level.code} - Level {level.level} - {level.name}
                          </option>
                        ))}
                      </select>

                      {selectedCapabilityLevel !== null ? (
                        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                          {(() => {
                            const selected =
                              capabilityLevels.find(
                                (item) =>
                                  item.level ===
                                  selectedCapabilityLevel
                              );

                            if (!selected) {
                              return null;
                            }

                            return (
                              <>
                                <div className="text-sm font-semibold text-indigo-950">
                                  {selected.name}
                                </div>

                                {selected.description ? (
                                  <p className="mt-1 text-xs leading-5 text-indigo-700">
                                    {selected.description}
                                  </p>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Tenant Process Mapping
                      </div>

                      {selectedAvailableProcess
                        .tenant_mappings.length === 0 ? (
                        <div className="mt-2">
                          <div className="text-sm font-semibold text-amber-700">
                            Unmapped
                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            No tenant process mapping exists for this PAM process in the current framework adoption.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {selectedAvailableProcess
                            .tenant_mappings.map(
                              (mapping) => (
                                <div
                                  key={mapping.mapping_id}
                                  className="rounded-xl bg-slate-50 p-3"
                                >
                                  <div className="text-sm font-semibold text-slate-800">
                                    {
                                      mapping
                                        .tenant_process
                                        .code
                                    }
                                    {" - "}
                                    {
                                      mapping
                                        .tenant_process
                                        .name
                                    }
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    {mapping.mapping_type}
                                  </div>
                                </div>
                              )
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center">
                    <div className="max-w-xs text-center">
                      <Boxes className="mx-auto h-8 w-8 text-slate-300" />

                      <div className="mt-3 text-sm font-semibold text-slate-700">
                        Select a PAM process
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Process details and tenant mapping status will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {addProcessError ? (
              <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
                {addProcessError}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4">
              <div className="text-xs text-slate-500">
                Target capability is resolved from the canonical CMF model.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAddProcessOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    !selectedPamProcessId ||
                    addingProcess
                  }
                  onClick={() =>
                    void addSelectedProcess()
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {addingProcess ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  Add Process
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value || "-"}
      </div>
    </div>
  );
}
