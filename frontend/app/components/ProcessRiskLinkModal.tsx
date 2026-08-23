"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type Risk = {
  id: number;
  code?: string;
  title: string;
  severity?: string;
};

type Props = {
  processId: number;
  open: boolean;
  onClose: () => void;
  onLinked?: () => void;
};

function severityClass(severity?: string) {
  const value = (severity || "").toLowerCase();

  if (value.includes("critical")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value.includes("high")) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (value.includes("medium")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value.includes("low")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function ProcessRiskLinkModal({
  processId,
  open,
  onClose,
  onLinked,
}: Props) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadRisks() {
      try {
        setLoading(true);
        setError(null);
        setSelectedId(null);

        const res = await apiFetch("/risks", {
          method: "GET",
        });

        if (!res.ok) {
          const message = await res.text().catch(() => "");

          if (!cancelled) {
            setRisks([]);
            setError(
              message || `Unable to load risks (${res.status})`
            );
          }

          return;
        }

        const json = await res.json();

        const items: Risk[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
          ? json.items
          : [];

        if (!cancelled) {
          setRisks(items);

          if (items.length === 0) {
            setError("There are no available risks to link.");
          }
        }
      } catch (err) {
        console.error("Failed to load risks", err);

        if (!cancelled) {
          setRisks([]);
          setError("Unable to load risks. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRisks();

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function linkRisk() {
    if (!selectedId) return;

    try {
      setLinking(true);
      setError(null);

      const res = await apiFetch(
        `/company/processes/${processId}/risks/${selectedId}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const message = await res.text().catch(() => "");
        throw new Error(message || "Risk could not be linked.");
      }

      onLinked?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Risk could not be linked.");
    } finally {
      setLinking(false);
    }
  }

  if (!open) return null;

  const selectedRisk =
    risks.find((risk) => risk.id === selectedId) || null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !linking) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-risk-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="link-risk-title"
                className="text-lg font-semibold text-slate-900"
              >
                Link Risk to Process
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select an existing risk to associate with this process.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={linking}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-5 px-6 py-6">
          <div>
            <label
              htmlFor="process-risk-select"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Risk
            </label>

            {loading ? (
              <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                  Loading available risks...
                </div>
              </div>
            ) : risks.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5">
                <div className="text-sm font-medium text-slate-800">
                  No available risks
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Create a risk first, then return here to link it to this
                  process.
                </div>
              </div>
            ) : (
              <select
                id="process-risk-select"
                value={selectedId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedId(value ? Number(value) : null);
                  setError(null);
                }}
                disabled={linking}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Select a risk</option>

                {risks.map((risk) => (
                  <option key={risk.id} value={risk.id}>
                    {risk.code
                      ? `${risk.code} — ${risk.title}`
                      : risk.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected risk preview */}
          {selectedRisk ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Selected Risk
                  </div>

                  <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {selectedRisk.code
                      ? `${selectedRisk.code} — ${selectedRisk.title}`
                      : selectedRisk.title}
                  </div>
                </div>

                {selectedRisk.severity ? (
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${severityClass(
                      selectedRisk.severity
                    )}`}
                  >
                    {selectedRisk.severity}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {error && risks.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={linking}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={linkRisk}
            disabled={
              !selectedId ||
              linking ||
              loading ||
              risks.length === 0
            }
            className="rounded-lg border border-emerald-700 bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:border-emerald-800 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linking ? "Linking..." : "Link Risk"}
          </button>
        </div>
      </div>
    </div>
  );
}
