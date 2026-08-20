"use client";

import React from "react";

type Props = {
  saving?: boolean;
  canComplete: boolean;
  onSaveAll?: () => void;
  onComplete: () => void;
  onClose?: () => void;
  statusText?: string;
  errorText?: string | null;
};

export default function AssessmentFooter({
  saving,
  canComplete,
  onSaveAll,
  onComplete,
  onClose,
  statusText,
  errorText,
}: Props) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            {statusText || "Complete all Likelihood and Impact questions"}
          </div>
          {errorText && (
            <div className="mt-1 text-xs text-red-600">{errorText}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          {onSaveAll && (
            <button
              type="button"
              onClick={onSaveAll}
              disabled={!!saving}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
          )}
          <button
            type="button"
            onClick={onComplete}
            disabled={!canComplete || !!saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Risk"}
          </button>
        </div>
      </div>
    </div>
  );
}
