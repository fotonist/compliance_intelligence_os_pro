"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type RatingOption = {
  id: number;
  framework_model_id: number;
  code: string;
  name: string;
  description?: string | null;
  numeric_value?: number | null;
  lower_bound?: number | null;
  upper_bound?: number | null;
  sort_order: number;
};

type ProcessAttributeEvaluation = {
  id: number;
  rating?: string | null;
  justification?: string | null;
  status: string;
  evaluated_by?: number | null;
  evaluated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  assessmentId: number;
  assessmentProcessId: number;
  processAttributeId: number;
  evaluation?: ProcessAttributeEvaluation | null;
  onSaved?: () => Promise<void>;
  readOnly?: boolean;
  saveEndpoint?: string;
  variant?: "workspace" | "audit";
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
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function evaluationDisplayStatus(
  evaluation: ProcessAttributeEvaluation | null | undefined,
  variant: "workspace" | "audit"
) {
  if (variant === "audit") {
    return evaluation ? "Recorded" : "Not Recorded";
  }

  return evaluation
    ? normalizeStatus(evaluation.status)
    : "Not Evaluated";
}

function formatBoundary(value?: number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number.isInteger(value)
    ? String(value)
    : String(value);
}

function ratingRange(option?: RatingOption | null) {
  if (!option) {
    return "-";
  }

  const lower = formatBoundary(option.lower_bound);
  const upper = formatBoundary(option.upper_bound);

  if (lower === null && upper === null) {
    return "-";
  }

  if (lower !== null && upper !== null) {
    return `${lower} - ${upper}`;
  }

  if (lower !== null) {
    return `>= ${lower}`;
  }

  return `<= ${upper}`;
}

export default function ProcessAttributeEvaluationEditor({
  assessmentId,
  assessmentProcessId,
  processAttributeId,
  evaluation,
  onSaved,
  readOnly = false,
  saveEndpoint,
  variant = "workspace",
}: Props) {
  const [options, setOptions] =
    useState<RatingOption[]>([]);

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [optionsError, setOptionsError] =
    useState("");

  const [rating, setRating] =
    useState(evaluation?.rating || "");

  const [justification, setJustification] =
    useState(evaluation?.justification || "");

  const [saving, setSaving] =
    useState(false);

  const [saveError, setSaveError] =
    useState("");

  const [saved, setSaved] =
    useState(false);

  useEffect(() => {
    setRating(evaluation?.rating || "");
    setJustification(
      evaluation?.justification || ""
    );
    setSaved(false);
    setSaveError("");
  }, [
    evaluation?.id,
    evaluation?.rating,
    evaluation?.justification,
    evaluation?.status,
  ]);

  const loadRatingOptions =
    useCallback(async () => {
      const token = getToken();

      if (!token) {
        setOptions([]);
        setOptionsError(
          "Authentication token is not available."
        );
        setLoadingOptions(false);
        return;
      }

      setLoadingOptions(true);
      setOptionsError("");

      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/rating-options`,
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
              `Rating options request failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as RatingOption[];

        setOptions(
          Array.isArray(data)
            ? [...data].sort(
                (a, b) =>
                  (a.sort_order ?? 0) -
                  (b.sort_order ?? 0)
              )
            : []
        );
      } catch (err) {
        setOptions([]);
        setOptionsError(
          err instanceof Error
            ? err.message
            : "Rating options could not be loaded."
        );
      } finally {
        setLoadingOptions(false);
      }
    }, [assessmentId]);

  useEffect(() => {
    void loadRatingOptions();
  }, [loadRatingOptions]);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) => option.code === rating
      ) || null,
    [options, rating]
  );

  const saveEvaluation =
    useCallback(async () => {
      const token = getToken();

      if (!token) {
        setSaveError(
          "Authentication token is not available."
        );
        return;
      }

      if (!rating) {
        setSaveError(
          "Select a canonical rating before saving."
        );
        return;
      }

      setSaving(true);
      setSaveError("");
      setSaved(false);

      try {
        const response = await fetch(
          saveEndpoint ||
            `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/process-attributes/${processAttributeId}/evaluation`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              rating,
              justification:
                justification.trim() || null,
              status: evaluation?.status || "draft",
            }),
          }
        );

        if (!response.ok) {
          const body = await response.text();

          throw new Error(
            body ||
              `Attribute evaluation update failed: ${response.status}`
          );
        }

        await response.json();

        if (onSaved) {
          await onSaved();
        }

        setSaved(true);
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : "Attribute evaluation could not be saved."
        );
      } finally {
        setSaving(false);
      }
    }, [
      assessmentId,
      assessmentProcessId,
      processAttributeId,
      rating,
      justification,
      evaluation?.status,
      onSaved,
      saveEndpoint,
    ]);

  return (
    <div
      className={
        variant === "audit"
          ? "w-full rounded-xl border border-slate-200 bg-slate-50 p-5"
          : "w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 xl:w-96"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {variant === "audit"
            ? "Official Audit Rating"
            : "Attribute Evaluation"}
        </div>

        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
          {evaluationDisplayStatus(
            evaluation,
            variant
          )}
        </span>
      </div>

      {optionsError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {optionsError}
        </div>
      ) : null}

      <label
        className={
          variant === "audit"
            ? "mt-5 block max-w-md"
            : "mt-4 block"
        }
      >
        <span className="text-xs font-medium text-slate-500">
          Rating
        </span>

        <select
          value={rating}
          onChange={(event) => {
            setRating(event.target.value);
            setSaveError("");
            setSaved(false);
          }}
          disabled={
            readOnly ||
            loadingOptions ||
            saving ||
            options.length === 0
          }
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {loadingOptions
              ? "Loading ratings..."
              : "Select rating"}
          </option>

          {options.map((option) => (
            <option
              key={option.id}
              value={option.code}
            >
              {option.code} - {option.name}
            </option>
          ))}
        </select>
      </label>

      <div
        className={
          variant === "audit"
            ? "mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-2xl"
            : "mt-4 grid grid-cols-2 gap-3"
        }
      >
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Configured Range
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-800">
            {ratingRange(selectedOption)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Status
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-800">
            {evaluationDisplayStatus(
              evaluation,
              variant
            )}
          </div>
        </div>
      </div>

      {selectedOption?.description ? (
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs leading-5 text-indigo-800">
          {selectedOption.description}
        </div>
      ) : null}

      <label
        className={
          variant === "audit"
            ? "mt-5 block"
            : "mt-4 block"
        }
      >
        <span className="text-xs font-medium text-slate-500">
          Justification
        </span>

        <textarea
          value={justification}
          onChange={(event) => {
            setJustification(event.target.value);
            setSaveError("");
            setSaved(false);
          }}
          rows={variant === "audit" ? 4 : 5}
          disabled={readOnly || saving}
          placeholder={
            readOnly
              ? "No evaluation justification recorded."
              : "Record the rationale for this process attribute rating..."
          }
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      {evaluation?.evaluated_at ? (
        <div className="mt-3 text-xs text-slate-500">
          Evaluated{" "}
          {new Date(
            evaluation.evaluated_at
          ).toLocaleString()}
        </div>
      ) : null}

      {saveError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {saveError}
        </div>
      ) : null}

      {saved ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          Attribute evaluation saved.
        </div>
      ) : null}

      {!loadingOptions &&
      !optionsError &&
      options.length === 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          No canonical rating options are configured for the resolved capability model.
        </div>
      ) : null}

      {!readOnly ? (
        <div className="mt-4 flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => {
              void saveEvaluation();
            }}
            disabled={
              saving ||
              loadingOptions ||
              options.length === 0 ||
              !rating
            }
            className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Evaluation"}
          </button>
        </div>
      ) : (
        <div className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
          Evaluation is maintained through Maturity Internal Audit execution.
        </div>
      )}
    </div>
  );
}
