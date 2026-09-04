"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers3,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Version = {
  id: number;
  version_code: string;
  status?: string | null;
};

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  versions?: Version[];
};

type Control = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
};

type Requirement = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  controls?: Control[];
};

type Clause = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  requirements?: Requirement[];
};

type Practice = {
  id: number;
  code: string;
  title?: string | null;
  text?: string | null;
  level?: number | null;
};

type ProcessArea = {
  id: number;
  code: string;
  name?: string | null;
  description?: string | null;
  practices?: Practice[];
};

type Adoption = {
  id: number;
  tenant_id: number;
  standard_id: number;
  standard_version_id: number;
  status: string;
  applicability: string;
  effective_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  activated_by?: number | null;
  activated_at?: string | null;
  process_ids: number[];
};

type Process = {
  id: number;
  code: string;
  name: string;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
};
type Structure = {
  standard_id: number;
  standard_code: string;
  version: string;
  status?: string | null;
  type: "CONTROL_BASED" | "MATURITY_BASED";
  clauses?: Clause[];
  requirements?: Requirement[];
  controls?: Control[];
  process_areas?: ProcessArea[];
  practices?: Practice[];
};

function typeLabel(type?: string | null) {
  return type === "MATURITY_BASED"
    ? "Maturity-Based"
    : "Control-Based";
}

function statusClass(status?: string | null) {
  if (status === "published" || status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "deprecated" || status === "archived") {
    return "border-slate-200 bg-slate-100 text-slate-500";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function FrameworkDetailPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();

  const standardId = Number(params.standardId);

  const [standard, setStandard] = useState<Standard | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [structure, setStructure] = useState<Structure | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [error, setError] = useState("");

  const [expandedClauses, setExpandedClauses] = useState<number[]>([]);
  const [expandedRequirements, setExpandedRequirements] = useState<number[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<number[]>([]);

  const [activeTab, setActiveTab] = useState<"structure" | "adoption">("structure");
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loadingAdoption, setLoadingAdoption] = useState(false);
  const [savingAdoption, setSavingAdoption] = useState(false);
  const [adoptionMessage, setAdoptionMessage] = useState("");
  const [adoptionError, setAdoptionError] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [applicability, setApplicability] = useState("APPLICABLE");

  async function loadFramework() {
    try {
      setLoading(true);
      setError("");

      const [standardResponse, versionsResponse] = await Promise.all([
        apiFetch(`/framework/standards/${standardId}`),
        apiFetch(`/framework/standards/${standardId}/versions`),
      ]);

      if (!standardResponse.ok) {
        throw new Error(
          `Unable to load framework (${standardResponse.status}).`
        );
      }

      if (!versionsResponse.ok) {
        throw new Error(
          `Unable to load framework versions (${versionsResponse.status}).`
        );
      }

      const standardData = await standardResponse.json();
      const versionsData = await versionsResponse.json();

      const resolvedVersions = Array.isArray(versionsData)
        ? versionsData
        : Array.isArray(versionsData?.versions)
          ? versionsData.versions
          : [];

      setStandard(standardData);
      setVersions(resolvedVersions);

      const preferred =
        resolvedVersions.find(
          (version: Version) =>
            version.status === "active" ||
            version.status === "published"
        )?.version_code ||
        resolvedVersions[0]?.version_code ||
        "";

      setSelectedVersion(preferred);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load framework."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStructure(versionCode: string) {
    if (!versionCode) {
      setStructure(null);
      return;
    }

    try {
      setLoadingStructure(true);
      setError("");

      const response = await apiFetch(
        `/framework/standards/${standardId}/versions/${encodeURIComponent(
          versionCode
        )}/structure`
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load framework structure (${response.status}).`
        );
      }

      const data = await response.json();
      setStructure(data);
      setExpandedClauses([]);
      setExpandedRequirements([]);
      setExpandedAreas([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load framework structure."
      );
      setStructure(null);
    } finally {
      setLoadingStructure(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(standardId)) {
      setError("Invalid framework identifier.");
      setLoading(false);
      return;
    }

    loadFramework();
  }, [standardId]);

  useEffect(() => {
    if (selectedVersion) {
      loadStructure(selectedVersion);
    }
  }, [selectedVersion]);

  const selectedVersionObject = useMemo(
    () =>
      versions.find(
        (version) => version.version_code === selectedVersion
      ),
    [versions, selectedVersion]
  );

  useEffect(() => {
    if (selectedVersionObject) {
      loadAdoption();
    }
  }, [selectedVersionObject?.id]);

  const controlCount = structure?.controls?.length ?? 0;
  const requirementCount = structure?.requirements?.length ?? 0;
  const clauseCount = structure?.clauses?.length ?? 0;
  const processAreaCount = structure?.process_areas?.length ?? 0;
  const practiceCount = structure?.practices?.length ?? 0;


  function toggleClause(id: number) {
    setExpandedClauses((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleRequirement(id: number) {
    setExpandedRequirements((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleArea(id: number) {
    setExpandedAreas((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }
  async function loadAdoption() {
    if (!standardId || !selectedVersionObject) {
      setAdoption(null);
      return;
    }

    try {
      setLoadingAdoption(true);
      setAdoptionError("");
      setAdoptionMessage("");

      const [adoptionResponse, processResponse] = await Promise.all([
        apiFetch(`/framework/standards/${standardId}/adoption`),
        apiFetch("/company/processes"),
      ]);

      if (!adoptionResponse.ok) {
        throw new Error(
          `Unable to load framework adoption (${adoptionResponse.status}).`
        );
      }

      if (!processResponse.ok) {
        throw new Error(
          `Unable to load organizational processes (${processResponse.status}).`
        );
      }

      const adoptionData = await adoptionResponse.json();
      const processData = await processResponse.json();

      const resolvedAdoptions = Array.isArray(adoptionData)
        ? adoptionData
        : [];

      const resolvedProcesses = Array.isArray(processData)
        ? processData
        : Array.isArray(processData?.items)
          ? processData.items
          : [];

      const matched = resolvedAdoptions.find(
        (item: Adoption) =>
          item.standard_version_id === selectedVersionObject.id
      ) || null;

      setAdoption(matched);
      setProcesses(resolvedProcesses);

      if (matched) {
        setApplicability(matched.applicability || "APPLICABLE");
        setEffectiveDate(
          matched.effective_date
            ? matched.effective_date.slice(0, 10)
            : ""
        );
      } else {
        setApplicability("APPLICABLE");
        setEffectiveDate("");
      }
    } catch (err) {
      setAdoptionError(
        err instanceof Error
          ? err.message
          : "Unable to load framework adoption."
      );
      setAdoption(null);
    } finally {
      setLoadingAdoption(false);
    }
  }

  async function createAdoption() {
    if (!selectedVersionObject) return;

    try {
      setSavingAdoption(true);
      setAdoptionError("");
      setAdoptionMessage("");

      const response = await apiFetch("/framework/adoptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          standard_id: standardId,
          standard_version_id: selectedVersionObject.id,
          applicability,
          effective_date: effectiveDate
            ? `${effectiveDate}T00:00:00`
            : null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ||
            `Unable to create adoption (${response.status}).`
        );
      }

      const data = await response.json();
      setAdoption(data);
      setAdoptionMessage("Framework adoption created.");
    } catch (err) {
      setAdoptionError(
        err instanceof Error
          ? err.message
          : "Unable to create framework adoption."
      );
    } finally {
      setSavingAdoption(false);
    }
  }

  async function saveAdoptionSettings() {
    if (!adoption) return;

    try {
      setSavingAdoption(true);
      setAdoptionError("");
      setAdoptionMessage("");

      const response = await apiFetch(
        `/framework/adoptions/${adoption.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            applicability,
            effective_date: effectiveDate
              ? `${effectiveDate}T00:00:00`
              : null,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ||
            `Unable to update adoption (${response.status}).`
        );
      }

      setAdoption(await response.json());
      setAdoptionMessage("Adoption settings saved.");
    } catch (err) {
      setAdoptionError(
        err instanceof Error
          ? err.message
          : "Unable to update adoption."
      );
    } finally {
      setSavingAdoption(false);
    }
  }

  async function addProcessToScope(processId: number) {
    if (!adoption) return;

    try {
      setSavingAdoption(true);
      setAdoptionError("");
      setAdoptionMessage("");

      const response = await apiFetch(
        `/framework/adoptions/${adoption.id}/scope`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            process_id: processId,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ||
            `Unable to add process to scope (${response.status}).`
        );
      }

      setAdoption(await response.json());
    } catch (err) {
      setAdoptionError(
        err instanceof Error
          ? err.message
          : "Unable to update adoption scope."
      );
    } finally {
      setSavingAdoption(false);
    }
  }

  async function removeProcessFromScope(processId: number) {
    if (!adoption) return;

    try {
      setSavingAdoption(true);
      setAdoptionError("");
      setAdoptionMessage("");

      const response = await apiFetch(
        `/framework/adoptions/${adoption.id}/scope/${processId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ||
            `Unable to remove process from scope (${response.status}).`
        );
      }

      setAdoption(await response.json());
    } catch (err) {
      setAdoptionError(
        err instanceof Error
          ? err.message
          : "Unable to update adoption scope."
      );
    } finally {
      setSavingAdoption(false);
    }
  }

  async function activateAdoption() {
    if (!adoption) return;

    try {
      setSavingAdoption(true);
      setAdoptionError("");
      setAdoptionMessage("");

      const response = await apiFetch(
        `/framework/adoptions/${adoption.id}/transition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "ACTIVE",
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ||
            `Unable to activate adoption (${response.status}).`
        );
      }

      setAdoption(await response.json());
      setAdoptionMessage("Framework adoption is now active.");
    } catch (err) {
      setAdoptionError(
        err instanceof Error
          ? err.message
          : "Unable to activate framework adoption."
      );
    } finally {
      setSavingAdoption(false);
    }
  }


  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1500px]">

        <div className="mb-5">
          <button
            type="button"
            onClick={() => router.push("/framework-library")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Framework Library
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">
              Framework could not be loaded
            </div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-6 w-72 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-4 w-96 animate-pulse rounded bg-slate-100" />
          </div>
        ) : standard ? (
          <>
            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BookOpen size={19} className="text-blue-600" />

                    <span className="font-mono text-sm font-semibold text-blue-700">
                      {standard.code}
                    </span>

                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {typeLabel(standard.type)}
                    </span>

                    {selectedVersionObject && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                          selectedVersionObject.status
                        )}`}
                      >
                        {selectedVersionObject.status || "draft"}
                      </span>
                    )}
                  </div>

                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {standard.title || standard.code}
                  </h1>

                  {standard.description && (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      {standard.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedVersion}
                    onChange={(event) =>
                      setSelectedVersion(event.target.value)
                    }
                    className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {versions.map((version) => (
                      <option
                        key={version.id}
                        value={version.version_code}
                      >
                        {version.version_code}
                        {version.status
                          ? ` · ${version.status}`
                          : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => loadStructure(selectedVersion)}
                    disabled={loadingStructure || !selectedVersion}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw
                      size={15}
                      className={loadingStructure ? "animate-spin" : ""}
                    />
                    Refresh
                  </button>
                </div>

              </div>
            </section>

            <div className="mb-6 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab("structure")}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === "structure"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                Structure
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("adoption")}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === "adoption"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                Adoption
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">

              {structure?.type === "MATURITY_BASED" ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Process Areas
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {loadingStructure ? "—" : processAreaCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Practices
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {loadingStructure ? "—" : practiceCount}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Clauses
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {loadingStructure ? "—" : clauseCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Requirements
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {loadingStructure ? "—" : requirementCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Controls
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {loadingStructure ? "—" : controlCount}
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Version
                  </div>
                  <Layers3 size={17} className="text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {selectedVersion || "—"}
                </div>
              </div>

            </div>

            {activeTab === "adoption" ? (
              <section className="space-y-5">
                {adoptionError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {adoptionError}
                  </div>
                )}

                {adoptionMessage && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    {adoptionMessage}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Canonical Version
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-950">
                      {selectedVersion || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Status: {selectedVersionObject?.status || "draft"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Adoption Status
                    </div>
                    <div className="mt-2">
                      {adoption ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(adoption.status.toLowerCase())}`}>
                          {adoption.status}
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-slate-400">
                          Not configured
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Applicability
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-950">
                      {adoption?.applicability || applicability}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Process Scope
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-950">
                      {adoption?.process_ids.length ?? 0}
                    </div>
                  </div>
                </div>

                {loadingAdoption ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
                    <div className="mt-4 h-10 w-full animate-pulse rounded bg-slate-100" />
                  </div>
                ) : !adoption ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Tenant Adoption
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                          This framework version has not yet been adopted by the tenant.
                          Create an adoption record before defining applicability and organizational scope.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={createAdoption}
                        disabled={savingAdoption || !selectedVersionObject}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={16} />
                        {savingAdoption ? "Creating..." : "Create Adoption"}
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Applicability
                          </div>

                          <select
                            value={applicability}
                            onChange={(event) =>
                              setApplicability(event.target.value)
                            }
                            className="mt-2 h-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="APPLICABLE">Applicable</option>
                            <option value="PARTIALLY_APPLICABLE">
                              Partially Applicable
                            </option>
                            <option value="NOT_APPLICABLE">
                              Not Applicable
                            </option>
                          </select>
                        </div>

                        <div className="flex-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Effective Date
                          </div>

                          <input
                            type="date"
                            value={effectiveDate}
                            onChange={(event) =>
                              setEffectiveDate(event.target.value)
                            }
                            className="mt-2 h-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={saveAdoptionSettings}
                          disabled={savingAdoption}
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {savingAdoption ? "Saving..." : "Save Settings"}
                        </button>
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-sm font-bold text-slate-800">
                              Organizational Scope
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                              Select the tenant processes to which this framework adoption applies.
                            </p>
                          </div>

                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {adoption.process_ids.length} selected
                          </span>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {processes.map((process) => {
                          const selected = adoption.process_ids.includes(process.id);

                          return (
                            <div
                              key={process.id}
                              className="flex items-center gap-4 px-5 py-4"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs font-bold text-blue-700">
                                    {process.code}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-900">
                                    {process.name}
                                  </span>
                                </div>

                                {process.status && (
                                  <div className="mt-1 text-xs text-slate-500">
                                    Status: {process.status}
                                  </div>
                                )}
                              </div>

                              {selected ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeProcessFromScope(process.id)
                                  }
                                  disabled={savingAdoption}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <X size={14} />
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    addProcessToScope(process.id)
                                  }
                                  disabled={savingAdoption}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <Plus size={14} />
                                  Include
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {processes.length === 0 && (
                          <div className="px-6 py-12 text-center text-sm text-slate-500">
                            No organizational processes are available.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-emerald-600" />
                            <h2 className="text-sm font-bold text-slate-800">
                              Adoption Activation
                            </h2>
                          </div>

                          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                            Activation requires a published or active canonical version
                            and at least one organizational process in scope.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={activateAdoption}
                          disabled={
                            savingAdoption ||
                            adoption.status === "ACTIVE" ||
                            !["published", "active"].includes(
                              (selectedVersionObject?.status || "").toLowerCase()
                            ) ||
                            adoption.process_ids.length === 0
                          }
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {adoption.status === "ACTIVE"
                            ? "Adoption Active"
                            : savingAdoption
                              ? "Activating..."
                              : "Activate Adoption"}
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </section>
            ) : (
              <div>
                {loadingStructure ? (
              <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="h-5 w-56 animate-pulse rounded bg-slate-100" />
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-14 animate-pulse rounded-lg bg-slate-100"
                    />
                  ))}
                </div>
              </section>
            ) : structure?.type === "MATURITY_BASED" ? (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} className="text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-800">
                      Process Area Structure
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Canonical maturity framework structure for the selected version.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {(structure.process_areas ?? []).map((area) => {
                    const expanded = expandedAreas.includes(area.id);

                    return (
                      <div key={area.id}>
                        <button
                          type="button"
                          onClick={() => toggleArea(area.id)}
                          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
                        >
                          {expanded ? (
                            <ChevronDown size={17} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={17} className="text-slate-400" />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-bold text-blue-700">
                                {area.code}
                              </span>
                              <span className="text-sm font-semibold text-slate-900">
                                {area.name || "Unnamed Process Area"}
                              </span>
                            </div>

                            {area.description && (
                              <div className="mt-1 text-xs text-slate-500">
                                {area.description}
                              </div>
                            )}
                          </div>

                          <span className="text-xs font-medium text-slate-400">
                            {area.practices?.length ?? 0} practices
                          </span>
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                            <div className="ml-7 space-y-2">
                              {(area.practices ?? []).map((practice) => (
                                <div
                                  key={practice.id}
                                  className="rounded-lg border border-slate-200 bg-white p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-blue-700">
                                      {practice.code}
                                    </span>

                                    {practice.level != null && (
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                        Level {practice.level}
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 text-sm font-semibold text-slate-900">
                                    {practice.title || "Untitled Practice"}
                                  </div>

                                  {practice.text && (
                                    <div className="mt-2 text-xs leading-5 text-slate-500">
                                      {practice.text}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </section>
            ) : (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} className="text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-800">
                      Framework Structure
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Canonical clause, requirement and control hierarchy for the selected version.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {(structure?.clauses ?? []).map((clause) => {
                    const clauseExpanded = expandedClauses.includes(clause.id);

                    return (
                      <div key={clause.id}>
                        <button
                          type="button"
                          onClick={() => toggleClause(clause.id)}
                          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
                        >
                          {clauseExpanded ? (
                            <ChevronDown size={17} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={17} className="text-slate-400" />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-bold text-blue-700">
                                {clause.code}
                              </span>

                              <span className="text-sm font-semibold text-slate-900">
                                {clause.title || "Unnamed Clause"}
                              </span>
                            </div>

                            {clause.description && (
                              <div className="mt-1 text-xs text-slate-500">
                                {clause.description}
                              </div>
                            )}
                          </div>

                          <span className="text-xs font-medium text-slate-400">
                            {clause.requirements?.length ?? 0} requirements
                          </span>
                        </button>

                        {clauseExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                            <div className="ml-7 space-y-2">

                              {(clause.requirements ?? []).map((requirement) => {
                                const requirementExpanded =
                                  expandedRequirements.includes(requirement.id);

                                return (
                                  <div
                                    key={requirement.id}
                                    className="rounded-lg border border-slate-200 bg-white"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleRequirement(requirement.id)
                                      }
                                      className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"
                                    >
                                      {requirementExpanded ? (
                                        <ChevronDown
                                          size={15}
                                          className="text-slate-400"
                                        />
                                      ) : (
                                        <ChevronRight
                                          size={15}
                                          className="text-slate-400"
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-xs font-bold text-slate-700">
                                            {requirement.code}
                                          </span>

                                          <span className="text-sm font-semibold text-slate-900">
                                            {requirement.title ||
                                              "Untitled Requirement"}
                                          </span>
                                        </div>

                                        {requirement.description && (
                                          <div className="mt-1 text-xs text-slate-500">
                                            {requirement.description}
                                          </div>
                                        )}
                                      </div>

                                      <span className="text-xs text-slate-400">
                                        {requirement.controls?.length ?? 0} controls
                                      </span>
                                    </button>

                                    {requirementExpanded && (
                                      <div className="border-t border-slate-100 bg-slate-50/50 p-3">
                                        <div className="space-y-2">
                                          {(requirement.controls ?? []).map(
                                            (control) => (
                                              <div
                                                key={control.id}
                                                className="rounded-lg border border-slate-200 bg-white p-3"
                                              >
                                                <div className="flex items-center gap-3">
                                                  <span className="font-mono text-xs font-bold text-blue-700">
                                                    {control.code}
                                                  </span>

                                                  <span className="text-sm font-medium text-slate-900">
                                                    {control.title ||
                                                      "Untitled Control"}
                                                  </span>
                                                </div>

                                                {control.description && (
                                                  <div className="mt-1 text-xs leading-5 text-slate-500">
                                                    {control.description}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          )}

                                          {(requirement.controls ?? []).length ===
                                            0 && (
                                            <div className="px-3 py-4 text-xs text-slate-400">
                                              No controls are directly related
                                              to this requirement.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {(clause.requirements ?? []).length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                                  No requirements in this clause.
                                </div>
                              )}

                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(structure?.clauses ?? []).length === 0 && (
                    <div className="px-6 py-16 text-center text-sm text-slate-500">
                      No clauses are defined for this framework version.
                    </div>
                  )}
                </div>

              </section>
                )}
              </div>
            )}

            <div className="mt-5 text-xs text-slate-400">
              Framework structure is read from the canonical Framework Engine.
              Tenant compliance operations are managed separately.
            </div>
          </>
        ) : null}

      </div>
    </main>
  );
}
