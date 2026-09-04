"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type ControlContext = {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  requirement_id?: number | null;
  standard_version_id?: number | null;
  requirement?: {
    id: number;
    code?: string | null;
    title?: string | null;
  } | null;
  clause?: {
    id: number;
    code?: string | null;
    title?: string | null;
  } | null;
  standard?: {
    id: number;
    code?: string | null;
    title?: string | null;
  } | null;
  standard_version?: {
    id: number;
    version_code: string;
    status: string;
  } | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export default function CreateEvidencePage() {
  const router = useRouter();
  const params = useParams();
  const controlId = String(params.controlId);

  const [control, setControl] = useState<ControlContext | null>(null);
  const [controlLoading, setControlLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadControl() {
      setControlLoading(true);
      setError(null);

      try {
        const res = await apiFetch(`/controls/${controlId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.detail || "Unable to load control context."
          );
        }

        if (!cancelled) {
          setControl(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message ||
              "Unable to load the selected control."
          );
        }
      } finally {
        if (!cancelled) {
          setControlLoading(false);
        }
      }
    }

    loadControl();

    return () => {
      cancelled = true;
    };
  }, [controlId]);

  function handleFile(selectedFile: File | null) {
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);

    handleFile(e.dataTransfer.files?.[0] || null);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();

    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Evidence title is required.");
      return;
    }

    if (!control) {
      setError("Control context is not available.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const evidenceRes = await apiFetch(
        "/company/evidences",
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            source_url: sourceUrl.trim() || null,
            assessment_type: "control",
            control_id: Number(controlId),
          }),
        }
      );

      const evidence = await evidenceRes.json().catch(() => null);

      if (!evidenceRes.ok) {
        throw new Error(
          evidence?.detail ||
            evidence?.message ||
            "Failed to create evidence."
        );
      }

      const evidenceId =
        evidence?.id ?? evidence?.evidence_id;

      if (!evidenceId) {
        throw new Error(
          "Evidence was created but no evidence ID was returned."
        );
      }

      if (file) {
        const formData = new FormData();
        formData.append("files", file);

        const fileRes = await apiFetch(
          `/company/evidences/${evidenceId}/files`,
          {
            method: "POST",
            body: formData,
          }
        );

        const fileData = await fileRes.json().catch(() => null);

        if (!fileRes.ok) {
          throw new Error(
            fileData?.detail ||
              fileData?.message ||
              "Evidence was created, but the file upload failed."
          );
        }
      }

      router.push(`/controls/${controlId}/evidences`);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to create the evidence."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* =====================================================
            PAGE HEADER
            ===================================================== */}
        <header className="mb-8 flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Evidence Management
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Add Evidence
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Register supporting evidence against the selected
              control and optionally attach the source document.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/controls/${controlId}/evidences`
              )
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeftIcon />
            Back to Evidence
          </button>
        </header>

        {/* =====================================================
            CONTROL CONTEXT
            ===================================================== */}
        <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            title="Control Context"
            subtitle="Authoritative compliance context inherited from the selected control."
            badge="CONTROL-LINKED"
          />

          <div className="p-6">
            {controlLoading ? (
              <ControlSkeleton />
            ) : control ? (
              <>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                        {control.code}
                      </span>

                      {control.standard_version && (
                        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                          Version{" "}
                          {control.standard_version.version_code}
                        </span>
                      )}

                      {control.standard_version?.status && (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          {control.standard_version.status}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 text-xl font-semibold text-slate-900">
                      {control.title}
                    </h2>

                    {control.description && (
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                        {control.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-lg border border-slate-200 md:grid-cols-3">
                  <ContextItem
                    label="Standard"
                    value={
                      control.standard
                        ? `${control.standard.code || "—"} — ${
                            control.standard.title || "—"
                          }`
                        : "Not available"
                    }
                  />

                  <ContextItem
                    label="Clause"
                    value={
                      control.clause
                        ? `${control.clause.code || "—"} — ${
                            control.clause.title || "—"
                          }`
                        : "Not available"
                    }
                  />

                  <ContextItem
                    label="Requirement"
                    value={
                      control.requirement
                        ? `${control.requirement.code || "—"} — ${
                            control.requirement.title || "—"
                          }`
                        : "Not available"
                    }
                  />
                </div>
              </>
            ) : (
              <InlineError>
                Control context could not be loaded.
              </InlineError>
            )}
          </div>
        </section>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">

            {/* =================================================
                EVIDENCE REGISTRATION
                ================================================= */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                title="Evidence Registration"
                subtitle="Define the evidence record and identify its supporting source."
              />

              <div className="space-y-7 p-6">

                <Field
                  label="Evidence Title"
                  required
                  hint="Use a clear, audit-ready name."
                >
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setError(null);
                    }}
                    disabled={loading}
                    placeholder="e.g. Access Control Policy v2.1"
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Description"
                  hint="Explain what this evidence demonstrates for the control."
                >
                  <textarea
                    rows={6}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setError(null);
                    }}
                    disabled={loading}
                    placeholder="Describe the evidence, scope, applicability, or relevant compliance context..."
                    className={`${inputClass} resize-none leading-6`}
                  />
                </Field>

                <Field
                  label="Source URL"
                  hint="Optional external or internal reference."
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <LinkIcon />
                    </span>

                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => {
                        setSourceUrl(e.target.value);
                        setError(null);
                      }}
                      disabled={loading}
                      placeholder="https://..."
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>

                <Field
                  label="Supporting Document"
                  hint="Optional. Uploaded files follow the controlled evidence review lifecycle."
                >
                  <div
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`rounded-xl border border-dashed p-6 transition ${
                      dragActive
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-300 bg-slate-50/70 hover:border-slate-400"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      id="evidence-file"
                      type="file"
                      className="hidden"
                      disabled={loading}
                      onChange={(e) =>
                        handleFile(
                          e.target.files?.[0] || null
                        )
                      }
                    />

                    {!file ? (
                      <div className="flex flex-col items-center justify-center py-7 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm">
                          <UploadIcon />
                        </div>

                        <div className="mt-4 text-sm font-semibold text-slate-700">
                          Drop supporting document here
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          or select a file from your computer
                        </div>

                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <DocumentIcon />
                          Select File
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600">
                            <DocumentIcon />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {file.name}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setFile(null);

                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                          className="shrink-0 rounded-md px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </Field>
              </div>
            </section>

            {/* =================================================
                WORKFLOW
                ================================================= */}
            <aside className="space-y-6">

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                  title="Evidence Lifecycle"
                  subtitle="Controlled evidence governance."
                />

                <div className="p-5">
                  <LifecycleStep
                    number="01"
                    title="Register"
                    description="Create the evidence record against the selected control."
                    active
                  />

                  <LifecycleConnector />

                  <LifecycleStep
                    number="02"
                    title="Attach"
                    description="Add supporting documentation when available."
                  />

                  <LifecycleConnector />

                  <LifecycleStep
                    number="03"
                    title="Submit"
                    description="Submit the evidence file for controlled review."
                  />

                  <LifecycleConnector />

                  <LifecycleStep
                    number="04"
                    title="Review"
                    description="An authorized reviewer evaluates the submitted file."
                  />

                  <LifecycleConnector />

                  <LifecycleStep
                    number="05"
                    title="Approve"
                    description="Approval is subject to segregation of duties."
                  />
                </div>
              </section>

              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0 text-emerald-600">
                    <InfoIcon />
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-emerald-900">
                      Controlled evidence
                    </div>

                    <p className="mt-1.5 text-xs leading-5 text-emerald-800/70">
                      The standard, clause and requirement context
                      is inherited from the selected control and is
                      not manually changed during creation.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <ShieldIcon />
                  Governance Controls
                </div>

                <div className="mt-4 space-y-3">
                  <GovernanceRow
                    label="Tenant scope"
                    value="Enforced"
                  />

                  <GovernanceRow
                    label="Control context"
                    value="Inherited"
                  />

                  <GovernanceRow
                    label="Initial status"
                    value="Draft"
                  />

                  <GovernanceRow
                    label="Approval model"
                    value="Four-eyes"
                  />
                </div>
              </section>
            </aside>
          </div>

          {/* =================================================
              ERROR
              ================================================= */}
          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4"
            >
              <div className="mt-0.5 shrink-0 text-red-600">
                <AlertIcon />
              </div>

              <div>
                <div className="text-sm font-semibold text-red-800">
                  Unable to complete request
                </div>

                <div className="mt-1 text-xs leading-5 text-red-700">
                  {error}
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              ACTION BAR
              ================================================= */}
          <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Required fields are marked with
              <span className="ml-1 text-red-500">*</span>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  router.push(
                    `/controls/${controlId}/evidences`
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  controlLoading ||
                  !control ||
                  !title.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <SpinnerIcon />
                    Creating Evidence...
                  </>
                ) : (
                  <>
                    <CheckIcon />
                    Create Evidence
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION
   ========================================================= */

function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {subtitle}
        </p>
      </div>

      {badge && (
        <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          {badge}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   FIELD
   ========================================================= */

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label className="text-sm font-semibold text-slate-700">
          {label}
          {required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </label>

        {hint && (
          <span className="hidden text-[11px] text-slate-500 sm:block">
            {hint}
          </span>
        )}
      </div>

      {children}

      {hint && (
        <p className="mt-2 text-xs leading-5 text-slate-500 sm:hidden">
          {hint}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   CONTEXT
   ========================================================= */

function ContextItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-b border-slate-200 bg-slate-50 px-4 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>

      <div
        className="mt-1.5 truncate text-xs font-semibold text-slate-700"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   LIFECYCLE
   ========================================================= */

function LifecycleStep({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${
          active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        {number}
      </div>

      <div className="min-w-0">
        <div
          className={`text-sm font-semibold ${
            active ? "text-slate-900" : "text-slate-600"
          }`}
        >
          {title}
        </div>

        <div className="mt-1 text-[11px] leading-5 text-slate-500">
          {description}
        </div>
      </div>
    </div>
  );
}

function LifecycleConnector() {
  return (
    <div className="ml-4 h-5 border-l border-slate-200" />
  );
}

/* =========================================================
   GOVERNANCE
   ========================================================= */

function GovernanceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-xs font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   STATES
   ========================================================= */

function ControlSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded bg-slate-200" />
        <div className="h-6 w-24 rounded bg-slate-200" />
      </div>

      <div className="h-6 w-2/5 rounded bg-slate-200" />

      <div className="h-4 w-3/5 rounded bg-slate-200" />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-slate-200 md:grid-cols-3">
        <div className="h-16 bg-slate-50" />
        <div className="h-16 bg-slate-50" />
        <div className="h-16 bg-slate-50" />
      </div>
    </div>
  );
}

function InlineError({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

/* =========================================================
   ICONS
   ========================================================= */

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12H5m6 6-6-6 6-6"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14a1 1 0 0 0 1-1v-3"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2v6h6M8 13h8M8 17h5"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 11a5 5 0 0 0-7.07-.07l-2-2A5 5 0 0 0 7 20l1.15-1.15"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="9" />
      <path
        strokeLinecap="round"
        d="M12 10v6M12 7h.01"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4M12 17h.01"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.8 2.9 18a2 2 0 0 0 1.75 3h14.7a2 2 0 0 0 1.75-3l-7.4-13.2a2 2 0 0 0-3.4 0Z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
