"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
  version?: string | null;
};

type StandardVersion = {
  id: number;
  standard_id: number;
  version_code: string;
  status: string;
};

type MatrixSummary = {
  controls: number;
  ready: boolean;
};

type Adoption = {
  id: number;
  tenant_id: number;
  standard_id: number;
  standard_version_id: number;
  status: string;
  applicability: string;
  effective_date?: string | null;
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
  updated_at?: string | null;
};

function assessmentLabel(type?: string | null) {
  return type === "MATURITY_BASED" ? "Maturity-Based" : "Control-Based";
}

function canonicalStatusLabel(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "published":
      return "Published";
    case "active":
      return "Active";
    case "deprecated":
      return "Deprecated";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

function canonicalStatusClass(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "published" || normalized === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (normalized === "deprecated" || normalized === "archived") {
    return "bg-slate-100 text-slate-500 border-slate-200";
  }

  return "bg-amber-50 text-amber-700 border-amber-200";
}

function adoptionStatusClass(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CONFIGURING":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "SUSPENDED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "RETIRED":
      return "bg-slate-100 text-slate-500 border-slate-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

export default function StandardSetupPage() {
  const { standardId } = useParams<{ standardId: string }>();
  const router = useRouter();

  const [standard, setStandard] = useState<Standard | null>(null);
  const [version, setVersion] = useState<StandardVersion | null>(null);
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [matrix, setMatrix] = useState<MatrixSummary>({
    controls: 0,
    ready: false,
  });

  const [loading, setLoading] = useState(true);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSetup() {
    if (!standardId) return;

    setLoading(true);
    setError(null);

    try {
      const standardsRes = await apiFetch("/standards/");
      const standardsData = await standardsRes.json();

      const standards: Standard[] = Array.isArray(standardsData)
        ? standardsData
        : [];

      const found = standards.find(
        (item) => String(item.id) === String(standardId)
      );

      if (!found) {
        throw new Error("Standard not found");
      }

      setStandard(found);

      const versionsRes = await apiFetch(
        `/framework/standards/${standardId}/versions`
      );

      const versionsData = await versionsRes.json();
      const versions: StandardVersion[] = Array.isArray(versionsData)
        ? versionsData
        : [];

      /*
       * Standard.version is not the canonical version identifier.
       * Prefer the published/active canonical version.
       */
      const preferredVersion =
        versions.find(
          (item) =>
            ["published", "active"].includes(
              String(item.status || "").toLowerCase()
            )
        ) ||
        versions.find(
          (item) => String(item.status || "").toLowerCase() === "draft"
        ) ||
        versions[0] ||
        null;

      setVersion(preferredVersion);

      try {
        const matrixRes = await apiFetch(
          `/matrix?standard_id=${standardId}`
        );

        if (matrixRes.ok) {
          const matrixData = await matrixRes.json();
          const rows = Array.isArray(matrixData?.rows)
            ? matrixData.rows
            : [];

          setMatrix({
            controls: rows.filter(
              (row: any) => row?.control_id != null
            ).length,
            ready: rows.length > 0,
          });
        }
      } catch {
        setMatrix({
          controls: 0,
          ready: false,
        });
      }

      try {
        const processesRes = await apiFetch("/company/processes");
        const processesData = await processesRes.json();

        const processItems: Process[] = Array.isArray(processesData)
          ? processesData
          : Array.isArray(processesData?.items)
            ? processesData.items
            : [];

        setProcesses(processItems);
      } catch {
        setProcesses([]);
      }

      try {
        const adoptionRes = await apiFetch(
          `/framework/standards/${standardId}/adoption`
        );

        const adoptionData = await adoptionRes.json();
        const adoptions: Adoption[] = Array.isArray(adoptionData)
          ? adoptionData
          : [];

        const matchingAdoption = preferredVersion
          ? adoptions.find(
              (item) =>
                Number(item.standard_version_id) ===
                Number(preferredVersion.id)
            )
          : null;

        setAdoption(matchingAdoption || null);
      } catch {
        setAdoption(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load standard setup");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSetup();
  }, [standardId]);

  const selectedProcessIds = adoption?.process_ids || [];

  const readiness = useMemo(() => {
    const definition = Boolean(
      standard?.code &&
      standard?.title &&
      standard?.type
    );

    const matrixReady = matrix.ready;

    const scopeReady = selectedProcessIds.length > 0;

    const canonicalReady =
      !!version &&
      ["published", "active"].includes(
        String(version.status || "").toLowerCase()
      );

    const adoptionActive = adoption?.status === "ACTIVE";

    const activationReady =
      !!adoption &&
      matrixReady &&
      scopeReady &&
      canonicalReady &&
      !adoptionActive;

    return {
      definition,
      matrix: matrixReady,
      scope: scopeReady,
      activation: activationReady,
      canonicalReady,
      adoptionActive,
    };
  }, [standard, version, matrix, adoption, selectedProcessIds.length]);

  async function ensureAdoption(): Promise<Adoption | null> {
    if (!standard || !version) {
      throw new Error("A canonical framework version is required.");
    }

    if (adoption) {
      return adoption;
    }

    setAdoptionLoading(true);

    try {
      const res = await apiFetch("/framework/adoptions", {
        method: "POST",
        body: JSON.stringify({
          standard_id: standard.id,
          standard_version_id: version.id,
          applicability: "APPLICABLE",
        }),
      });

      const created: Adoption = await res.json();
      setAdoption(created);

      return created;
    } finally {
      setAdoptionLoading(false);
    }
  }

  async function addProcess(processId: number) {
    try {
      const currentAdoption = await ensureAdoption();

      if (!currentAdoption) {
        throw new Error("Framework adoption could not be created.");
      }

      setScopeLoading(true);

      const res = await apiFetch(
        `/framework/adoptions/${currentAdoption.id}/scope`,
        {
          method: "POST",
          body: JSON.stringify({
            process_id: processId,
          }),
        }
      );

      const updated: Adoption = await res.json();
      setAdoption(updated);
    } catch (e: any) {
      alert(e?.message || "Failed to add process to scope.");
    } finally {
      setScopeLoading(false);
    }
  }

  async function removeProcess(processId: number) {
    if (!adoption) return;

    setScopeLoading(true);

    try {
      const res = await apiFetch(
        `/framework/adoptions/${adoption.id}/scope/${processId}`,
        {
          method: "DELETE",
        }
      );

      const updated: Adoption = await res.json();
      setAdoption(updated);
    } catch (e: any) {
      alert(e?.message || "Failed to remove process from scope.");
    } finally {
      setScopeLoading(false);
    }
  }

  async function activate() {
    if (!adoption) {
      alert("Configure the framework adoption before activation.");
      return;
    }

    if (!readiness.matrix) {
      alert("Build the compliance matrix before activation.");
      return;
    }

    if (!readiness.scope) {
      alert("Select at least one organizational process.");
      return;
    }

    if (!readiness.canonicalReady) {
      alert("The selected canonical framework version is not publishable.");
      return;
    }

    setAdoptionLoading(true);

    try {
      const res = await apiFetch(
        `/framework/adoptions/${adoption.id}/transition`,
        {
          method: "POST",
          body: JSON.stringify({
            status: "ACTIVE",
          }),
        }
      );

      const updated: Adoption = await res.json();
      setAdoption(updated);
    } catch (e: any) {
      alert(e?.message || "Activation failed.");
    } finally {
      setAdoptionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-500">
        Loading standard setup…
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="min-h-full bg-slate-50 p-8">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error || "Standard not found"}
        </div>
      </div>
    );
  }

  const isActive = adoption?.status === "ACTIVE";

  return (
    <div className="min-h-full bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-[1200px]">

        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <button
              onClick={() => router.push("/standards")}
              className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              ← Standards
            </button>

            <h1 className="text-2xl font-semibold tracking-tight">
              Standard Setup
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Configure the framework for organizational use before activation.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${adoptionStatusClass(
                adoption?.status
              )}`}
            >
              {adoption?.status || "NOT ADOPTED"}
            </span>

            <span className="text-xs text-slate-400">
              Tenant Adoption
            </span>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Framework
              </div>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {standard.title || standard.code}
              </h2>

              <div className="mt-1 text-sm text-slate-500">
                {standard.code}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-slate-400">
                  Canonical Version
                </div>

                <div className="mt-1 font-medium text-slate-700">
                  {version?.version_code || "Not resolved"}
                </div>
              </div>

              <div
                className={`rounded-lg border px-4 py-3 text-sm ${canonicalStatusClass(
                  version?.status
                )}`}
              >
                <div className="text-xs opacity-70">
                  Canonical Status
                </div>

                <div className="mt-1 font-medium">
                  {canonicalStatusLabel(version?.status)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Setup Progress
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Complete the required configuration before activating the framework.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              [
                "Standard Definition",
                readiness.definition,
                "Canonical framework definition is available.",
              ],
              [
                "Compliance Matrix",
                readiness.matrix,
                `${matrix.controls} controls available.`,
              ],
              [
                "Organizational Scope",
                readiness.scope,
                `${selectedProcessIds.length} process${
                  selectedProcessIds.length === 1 ? "" : "es"
                } selected.`,
              ],
              [
                "Activation",
                isActive,
                isActive
                  ? "Tenant adoption is active."
                  : "Activation requires a valid matrix and organizational scope.",
              ],
            ].map(([title, done, detail]) => (
              <div
                key={String(title)}
                className={`rounded-xl border p-4 ${
                  done
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {done ? "✓" : "○"}
                  </span>

                  <span className="text-sm font-semibold text-slate-800">
                    {title}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  01
                </div>

                <h2 className="mt-1 text-base font-semibold">
                  Standard Definition
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Canonical framework definition used by the organization.
                </p>
              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Configured
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Code</dt>
                <dd className="mt-1 font-medium">{standard.code}</dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">
                  Canonical Version
                </dt>
                <dd className="mt-1 font-medium">
                  {version?.version_code || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">
                  Assessment Model
                </dt>
                <dd className="mt-1 font-medium">
                  {assessmentLabel(standard.type)}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">
                  Canonical Status
                </dt>
                <dd className="mt-1 font-medium">
                  {canonicalStatusLabel(version?.status)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  02
                </div>

                <h2 className="mt-1 text-base font-semibold">
                  Compliance Matrix
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Operational baseline for assessment and evidence management.
                </p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  matrix.ready
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {matrix.ready ? "Ready" : "Not built"}
              </span>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold">
                  {matrix.controls}
                </div>

                <div className="text-xs text-slate-400">
                  Controls in matrix
                </div>
              </div>

              <button
                onClick={() =>
                  router.push(
                    `/matrix/builder?standard_id=${standard.id}`
                  )
                }
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
              >
                {matrix.ready ? "View Matrix" : "Build Matrix"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              03
            </div>

            <h2 className="mt-1 text-base font-semibold">
              Organizational Scope
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Define the organizational processes covered by this framework adoption.
            </p>

            {!adoption && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-medium text-blue-900">
                  Adoption will be created when scope is configured.
                </div>

                <div className="mt-1 text-xs leading-5 text-blue-800">
                  Select one or more organizational processes below to establish
                  the tenant adoption scope.
                </div>
              </div>
            )}

            {adoption && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {selectedProcessIds.length} process
                      {selectedProcessIds.length === 1 ? "" : "es"} selected
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Applicability: {adoption.applicability}
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${adoptionStatusClass(
                      adoption.status
                    )}`}
                  >
                    {adoption.status}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {processes.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No organizational processes are available for scope selection.
                </div>
              ) : (
                processes.map((process) => {
                  const selected = selectedProcessIds.includes(process.id);

                  return (
                    <div
                      key={process.id}
                      className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
                        selected
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400">
                            {process.code}
                          </span>

                          {process.status && (
                            <span className="text-xs text-slate-400">
                              · {process.status}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 truncate text-sm font-medium text-slate-800">
                          {process.name}
                        </div>

                        {process.owner && (
                          <div className="mt-1 text-xs text-slate-500">
                            Owner: {process.owner}
                          </div>
                        )}
                      </div>

                      <button
                        disabled={scopeLoading || isActive}
                        onClick={() =>
                          selected
                            ? removeProcess(process.id)
                            : addProcess(process.id)
                        }
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${
                          selected
                            ? "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {selected ? "Remove" : "Add to Scope"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              04
            </div>

            <h2 className="mt-1 text-base font-semibold">
              Activation Readiness
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Activate the tenant adoption after the canonical version, matrix,
              and organizational scope are ready.
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {isActive ? (
                <div>
                  <div className="text-sm font-medium text-emerald-700">
                    ✓ This framework adoption is active.
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Activated {formatDate(adoption?.activated_at)}.
                  </div>
                </div>
              ) : !version ? (
                <div className="text-sm text-red-600">
                  No canonical framework version could be resolved.
                </div>
              ) : !readiness.canonicalReady ? (
                <div className="text-sm text-amber-700">
                  The selected canonical version is not published or active.
                </div>
              ) : !matrix.ready ? (
                <div className="text-sm text-slate-600">
                  Build the compliance matrix before activation.
                </div>
              ) : !readiness.scope ? (
                <div className="text-sm text-slate-600">
                  Select at least one organizational process before activation.
                </div>
              ) : !adoption ? (
                <div className="text-sm text-slate-600">
                  Configure the organizational scope to create the tenant adoption.
                </div>
              ) : (
                <div className="text-sm text-slate-600">
                  The framework is configured and ready for tenant activation.
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={activate}
                disabled={
                  !readiness.activation ||
                  adoptionLoading ||
                  scopeLoading
                }
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {adoptionLoading
                  ? "Activating…"
                  : isActive
                    ? "Active"
                    : "Activate Framework"}
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
