"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchRelatedEvidences,
  type RelatedEvidenceItem,
} from "../../../services/risk";

type Props = {
  riskId: number;
};

function statusClasses(status?: string | null) {
  const value = String(status ?? "").toLowerCase();

  if (["approved", "valid", "accepted"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["rejected", "invalid"].includes(value)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (["pending", "waiting_approval", "uploaded"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatStatus(status?: string | null) {
  if (!status) return "-";

  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function RelatedEvidenceTab({ riskId }: Props) {
  const router = useRouter();

  const [rows, setRows] = useState<RelatedEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchRelatedEvidences(riskId);

        if (!active) return;

        setRows(data);
      } catch (err) {
        if (!active) return;

        console.error("Failed to load related evidences:", err);
        setRows([]);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load related evidences."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [riskId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Related Evidence
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Evidence linked to this risk.
            </p>
          </div>

          <div className="text-xs text-slate-400">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">
          Related Evidence
        </div>

        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Related Evidence
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Evidence linked to this risk.
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <div className="text-sm font-medium text-slate-700">
            No related evidence
          </div>

          <p className="mt-1 text-xs text-slate-500">
            No evidence is currently linked to this risk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Related Evidence
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Evidence linked to this risk and its current status.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {rows.map((evidence) => (
          <button
            key={evidence.id}
            type="button"
            onClick={() => router.push(`/evidences/${evidence.id}`)}
            className="block w-full text-left transition hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-5 px-5 py-4">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">
                  {evidence.title}
                </div>

                {evidence.relation_reason && (
                  <div className="mt-1.5 text-xs leading-5 text-slate-500">
                    {evidence.relation_reason}
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                    evidence.status
                  )}`}
                >
                  {formatStatus(evidence.status)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}