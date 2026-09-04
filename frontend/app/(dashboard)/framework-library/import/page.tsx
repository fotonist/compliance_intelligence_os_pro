"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileJson,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type PreviewResult = {
  valid?: boolean;
  normalized?: {
    standard?: {
      code?: string;
      title?: string | null;
      description?: string | null;
      type?: string;
    };
    versions?: Array<{
      version_code?: string;
    }>;
    clauses?: unknown[];
    requirements?: unknown[];
    controls?: unknown[];
    process_areas?: unknown[];
    practices?: unknown[];
    mappings?: unknown[];
  };
  validation?: {
    shape?: {
      valid?: boolean;
      errors?: string[];
      warnings?: string[];
    };
    references?: {
      valid?: boolean;
      errors?: string[];
      warnings?: string[];
    };
    duplicates?: {
      duplicate?: boolean;
      errors?: string[];
      warnings?: string[];
    };
  };
  summary?: {
    versions?: number;
    clauses?: number;
    requirements?: number;
    controls?: number;
    process_areas?: number;
    practices?: number;
    mappings?: number;
  };
};

const samplePackage = {
  standard: {
    code: "EXAMPLE-FRAMEWORK",
    title: "Example Compliance Framework",
    description: "Example canonical framework package.",
    type: "CONTROL_BASED",
  },
  versions: [
    {
      version_code: "1.0",
    },
  ],
  clauses: [
    {
      code: "1",
      title: "Governance",
      description: "Governance requirements.",
    },
  ],
  requirements: [
    {
      code: "1.1",
      title: "Governance Requirement",
      description: "Example requirement.",
      clause_code: "1",
    },
  ],
  controls: [
    {
      code: "CTRL-1",
      title: "Governance Control",
      description: "Example control.",
      requirement_code: "1.1",
    },
  ],
  mappings: [],
};

function statusClass(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export default function FrameworkImportPage() {
  const [json, setJson] = useState(
    JSON.stringify(samplePackage, null, 2)
  );
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function validateAndPreview() {
    setError("");
    setSuccess("");
    setPreview(null);

    let payload: unknown;

    try {
      payload = JSON.parse(json);
    } catch {
      setError("The framework package is not valid JSON.");
      return;
    }

    try {
      setLoading(true);

      const response = await apiFetch("/framework/import/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : `Framework preview failed (${response.status}).`
        );
      }

      setPreview(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Framework preview failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function publishFramework() {
    if (!preview?.valid) return;

    setError("");
    setSuccess("");

    let payload: unknown;

    try {
      payload = JSON.parse(json);
    } catch {
      setError("The framework package is not valid JSON.");
      return;
    }

    try {
      setPublishing(true);

      const response = await apiFetch("/framework/import/publish", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : `Framework publish failed (${response.status}).`
        );
      }

      if (!data?.published) {
        throw new Error(
          data?.error || "Framework was not published."
        );
      }

      setSuccess(
        `${data.standard?.code || "Framework"} ${data.version?.version_code || ""} was published successfully.`
      );

      setPreview(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Framework publish failed."
      );
    } finally {
      setPublishing(false);
    }
  }

  const summary = preview?.summary;

  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1500px]">

        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/framework-library"
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={14} />
              Framework Library
            </Link>

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <Upload size={15} />
              Framework Governance
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Import Framework
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Validate and publish a canonical framework package
              into the Framework Library.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">
                Import failed
              </div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">
                Framework published
              </div>
              <div className="mt-1">{success}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <FileJson size={17} className="text-slate-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  Framework Package
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Paste a canonical JSON framework package.
              </p>
            </div>

            <div className="p-5">
              <textarea
                value={json}
                onChange={(event) => setJson(event.target.value)}
                spellCheck={false}
                className="min-h-[560px] w-full resize-y rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={validateAndPreview}
                  disabled={loading || publishing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  {loading ? "Validating..." : "Validate & Preview"}
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-800">
                Validation & Preview
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Review the package before publishing it.
              </p>
            </div>

            <div className="p-5">
              {!preview ? (
                <div className="flex min-h-[560px] items-center justify-center text-center">
                  <div className="max-w-xs">
                    <FileJson
                      size={34}
                      className="mx-auto text-slate-300"
                    />
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      No preview yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Validate the framework package to see its
                      structure and import summary.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">

                  <div
                    className={`rounded-lg border p-4 text-sm font-semibold ${statusClass(
                      Boolean(preview.valid)
                    )}`}
                  >
                    {preview.valid
                      ? "Framework package is valid"
                      : "Framework package contains validation errors"}
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Framework
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="font-semibold text-slate-950">
                        {preview.normalized?.standard?.title ||
                          preview.normalized?.standard?.code ||
                          "—"}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                          {preview.normalized?.standard?.code || "—"}
                        </span>

                        <span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">
                          {preview.normalized?.standard?.type ===
                          "MATURITY_BASED"
                            ? "Maturity-Based"
                            : "Control-Based"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Import Summary
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Versions", summary?.versions ?? 0],
                        ["Clauses", summary?.clauses ?? 0],
                        ["Requirements", summary?.requirements ?? 0],
                        ["Controls", summary?.controls ?? 0],
                        ["Process Areas", summary?.process_areas ?? 0],
                        ["Practices", summary?.practices ?? 0],
                        ["Mappings", summary?.mappings ?? 0],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="text-lg font-bold text-slate-950">
                            {value}
                          </div>
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Validation
                    </div>

                    <div className="space-y-2">
                      {[
                        [
                          "Shape",
                          preview.validation?.shape?.valid !== false,
                        ],
                        [
                          "References",
                          preview.validation?.references?.valid !== false,
                        ],
                        [
                          "Duplicate Check",
                          preview.validation?.duplicates?.duplicate !== true,
                        ],
                      ].map(([label, ok]) => (
                        <div
                          key={String(label)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${statusClass(
                            Boolean(ok)
                          )}`}
                        >
                          <span>{label}</span>
                          {ok ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <XCircle size={15} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={publishFramework}
                    disabled={!preview.valid || publishing}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {publishing && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    {publishing
                      ? "Publishing..."
                      : "Publish Framework"}
                  </button>

                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
