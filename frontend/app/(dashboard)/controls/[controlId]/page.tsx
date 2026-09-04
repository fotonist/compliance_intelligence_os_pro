"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCheck,
  FileText,
  Pencil,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type ControlRequirement = {
  id: number;
  code?: string | null;
  title?: string | null;
};

type ControlClause = {
  id: number;
  code?: string | null;
  title?: string | null;
};

type ControlStandard = {
  id: number;
  code?: string | null;
  title?: string | null;
};

type ControlStandardVersion = {
  id: number;
  version_code: string;
  status: string;
};

type Evidence = {
  id: number;
  title?: string | null;
  status?: string | null;
};

type Control = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  requirement_id?: number | null;
  standard_version_id: number;
  requirement?: ControlRequirement | null;
  clause?: ControlClause | null;
  standard?: ControlStandard | null;
  standard_version?: ControlStandardVersion | null;
  evidences?: Evidence[];
};

export default function ControlDetailPage() {
  const params = useParams();
  const router = useRouter();

  const controlId = Array.isArray(params.controlId)
    ? params.controlId[0]
    : params.controlId;

  const [control, setControl] = useState<Control | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadControl(isRefresh = false) {
    if (!controlId) return;

    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await apiFetch(
        `/controls/${controlId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Control not found or not accessible for this tenant.");
        }

        if (response.status === 401) {
          throw new Error("Authentication required.");
        }

        throw new Error(
          `Unable to load control (${response.status}).`
        );
      }

      const data = await response.json();
      setControl(data);
    } catch (err) {
      setControl(null);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load control."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadControl();
  }, [controlId]);

  if (loading) {
    return (
      <main className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-7 w-72 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !control) {
    return (
      <main className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1400px]">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Back to Controls
          </button>

          <div className="mt-5 rounded-xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle size={20} className="mt-0.5" />
              <div>
                <div className="font-semibold">
                  Control could not be loaded
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {error || "Control not found."}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadControl(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Back to Controls
          </button>

          <button
            type="button"
            onClick={() => loadControl(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
                  <ShieldCheck size={15} />
                  Control Detail
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-sm font-bold text-slate-800">
                    {control.code}
                  </span>

                  {control.standard_version && (
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      {control.standard_version.version_code}
                    </span>
                  )}

                  {control.standard_version?.status && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">
                      {control.standard_version.status}
                    </span>
                  )}
                </div>

                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                  {control.title || "Untitled control"}
                </h1>

                {control.description && (
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                    {control.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/controls/${control.id}/evidences`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileText size={15} />
                  Evidence
                </Link>

                <button
                  type="button"
                  disabled
                  title="Edit endpoint can be enabled when the edit workspace is implemented."
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
                >
                  <Pencil size={15} />
                  Edit
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Standard
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {control.standard?.code || "—"}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {control.standard?.title || "Standard information unavailable"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Clause
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {control.clause?.code || "—"}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {control.clause?.title || "Clause information unavailable"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Requirement
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {control.requirement?.code ||
                  (control.requirement_id
                    ? `#${control.requirement_id}`
                    : "Not mapped")}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {control.requirement?.title ||
                  "Requirement information unavailable"}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-950">
                  Evidence
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Evidence currently associated with this control.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {control.evidences?.length || 0} records
              </span>
            </div>

            {control.evidences && control.evidences.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {control.evidences.map((evidence) => (
                  <div
                    key={evidence.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <FileText size={17} />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {evidence.title || `Evidence #${evidence.id}`}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Evidence #{evidence.id}
                        </div>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {evidence.status || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <ClipboardCheck
                  size={30}
                  className="mx-auto text-slate-300"
                />

                <div className="mt-3 text-sm font-semibold text-slate-700">
                  No evidence associated
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Evidence can be managed from the control evidence workspace.
                </div>

                <Link
                  href={`/controls/${control.id}/evidences`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Open Evidence Workspace
                </Link>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <span>
                Control ID:{" "}
                <strong className="font-mono text-slate-700">
                  {control.id}
                </strong>
              </span>

              <span>
                Standard Version ID:{" "}
                <strong className="font-mono text-slate-700">
                  {control.standard_version_id}
                </strong>
              </span>

              {control.requirement_id && (
                <span>
                  Requirement ID:{" "}
                  <strong className="font-mono text-slate-700">
                    {control.requirement_id}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
