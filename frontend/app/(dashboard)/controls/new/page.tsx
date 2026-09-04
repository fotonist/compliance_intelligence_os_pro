"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  type?: string;
  version?: string | null;
  status?: string | null;
};

type Structure = {
  clauses?: Array<{
    id: number;
    code: string;
    title?: string | null;
    requirements?: Array<{
      id: number;
      code: string;
      title?: string | null;
    }>;
  }>;
};

export default function NewControlPage() {
  const router = useRouter();

  const [standards, setStandards] = useState<Standard[]>([]);
  const [structure, setStructure] = useState<Structure | null>(null);

  const [standardId, setStandardId] = useState("");
  const [requirementId, setRequirementId] = useState("");

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStandards() {
      try {
        const response = await apiFetch("/standards/");

        if (!response.ok) {
          throw new Error(
            `Unable to load standards (${response.status}).`
          );
        }

        const data = await response.json();

        setStandards(
          Array.isArray(data)
            ? data.filter(
                (item: Standard) =>
                  item.type === "CONTROL_BASED" ||
                  !item.type
              )
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load standards."
        );
      } finally {
        setLoadingStandards(false);
      }
    }

    loadStandards();
  }, []);

  useEffect(() => {
    if (!standardId) {
      setStructure(null);
      setRequirementId("");
      return;
    }

    async function loadStructure() {
      try {
        setLoadingStructure(true);
        setError("");

        const response = await apiFetch(
          `/standards/${standardId}/structure`
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load standard structure (${response.status}).`
          );
        }

        const data = await response.json();

        setStructure(data);
        setRequirementId("");
      } catch (err) {
        setStructure(null);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load standard structure."
        );
      } finally {
        setLoadingStructure(false);
      }
    }

    loadStructure();
  }, [standardId]);

  const requirements =
    structure?.clauses?.flatMap((clause) =>
      (clause.requirements || []).map((requirement) => ({
        ...requirement,
        clauseCode: clause.code,
        clauseTitle: clause.title,
      }))
    ) || [];

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!standardId) {
      setError("Select a standard.");
      return;
    }

    if (!requirementId) {
      setError("Select a requirement.");
      return;
    }

    if (!code.trim()) {
      setError("Control code is required.");
      return;
    }

    if (!title.trim()) {
      setError("e.g. Monthly Privileged Access Review is required.");
      return;
    }

    const selectedStandard = standards.find(
      (standard) => String(standard.id) === standardId
    );

    if (!selectedStandard) {
      setError("Selected standard is no longer available.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const draftResponse = await apiFetch(
        `/standards/${standardId}/draft`,
        {
          method: "POST",
        }
      );

      if (!draftResponse.ok) {
        throw new Error(
          `Unable to resolve draft version (${draftResponse.status}).`
        );
      }

      const draft = await draftResponse.json();

      const response = await apiFetch("/controls/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          standard_version_id: draft.draft_version_id,
          requirement_id: Number(requirementId),
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        let detail = `Unable to create control (${response.status}).`;

        try {
          const payload = await response.json();

          if (payload?.detail) {
            detail =
              typeof payload.detail === "string"
                ? payload.detail
                : JSON.stringify(payload.detail);
          }
        } catch {
          // Keep generic message.
        }

        throw new Error(detail);
      }

      const created = await response.json();

      router.push(`/controls/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create control."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={16} />
          Back to Controls
        </button>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Control Management
            </div>

            <h1 className="mt-1 text-xl font-bold text-slate-950">
              Create Custom Control
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create a control inside a tenant-accessible draft
              standard version.
            </p>
          </div>

          {error && (
            <div className="mx-6 mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-6 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Standard
                </span>

                <select
                  value={standardId}
                  onChange={(event) =>
                    setStandardId(event.target.value)
                  }
                  disabled={loadingStandards || saving}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    {loadingStandards
                      ? "Loading standards..."
                      : "Select standard"}
                  </option>

                  {standards.map((standard) => (
                    <option
                      key={standard.id}
                      value={standard.id}
                    >
                      {standard.code} — {standard.title || "Untitled"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Requirement
                </span>

                <select
                  value={requirementId}
                  onChange={(event) =>
                    setRequirementId(event.target.value)
                  }
                  disabled={
                    !standardId ||
                    loadingStructure ||
                    saving
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    {loadingStructure
                      ? "Loading requirements..."
                      : !standardId
                        ? "Select standard first"
                        : "Select requirement"}
                  </option>

                  {requirements.map((requirement) => (
                    <option
                      key={requirement.id}
                      value={requirement.id}
                    >
                      {requirement.code} —{" "}
                      {requirement.title || "Untitled"}{" "}
                      [{requirement.clauseCode}]
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Custom Control Code
                </span>

                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value)
                  }
                  disabled={saving}
                  placeholder="CUST-A5.15-01"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Custom Control Title
                </span>

                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  disabled={saving}
                  placeholder="e.g. Monthly Privileged Access Review"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                disabled={saving}
                rows={6}
                placeholder="Describe the organization-specific control, its purpose, and intended outcome..."
                className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || loadingStandards}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Create Custom Control
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
