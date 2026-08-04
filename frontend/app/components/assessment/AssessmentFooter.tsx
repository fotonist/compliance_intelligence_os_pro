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
    <div className="sticky bottom-0 z-10 mt-6 border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3 rounded-b-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">
            {statusText || "Complete all Likelihood and Impact questions"}
          </div>

          {errorText && (
            <div className="text-xs text-red-400 mt-1">{errorText}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 text-sm"
            >
              Close
            </button>
          )}

          {onSaveAll && (
            <button
              type="button"
              onClick={onSaveAll}
              disabled={!!saving}
              className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}

          <button
            type="button"
            onClick={onComplete}
            disabled={!canComplete || !!saving}
            className="px-4 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title={
              canComplete
                ? "Complete assessment"
                : "Answer all questions to complete"
            }
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
