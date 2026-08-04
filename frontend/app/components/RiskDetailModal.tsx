"use client";

type Risk = {
  id: number;
  title: string;
  likelihood: number;
  impact: number;
  score: number;
  risk_level: string;
  treatment: string;
  status: string;
};

type Props = {
  risk: Risk;
  onClose: () => void;
  onReAssess: () => void;
};

export default function RiskDetailModal({ risk, onClose, onReAssess }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-xl rounded-lg bg-slate-900 text-slate-100 border border-slate-700">

        {/* HEADER */}
        <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-start">
          <div>
            <h2 className="text-base font-semibold">{risk.title}</h2>
            <div className="mt-1 text-xs text-slate-400">
              Risk ID: <span className="font-mono">{risk.id}</span>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm bg-slate-800 border border-slate-700 rounded p-4">
            <div>Likelihood: <strong>{risk.likelihood}</strong></div>
            <div>Impact: <strong>{risk.impact}</strong></div>
            <div>Score: <strong>{risk.score}</strong></div>
            <div>Level: <strong>{risk.risk_level}</strong></div>
            <div>Treatment: <strong>{risk.treatment}</strong></div>
            <div>Status: <strong>{risk.status}</strong></div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm border border-slate-700 rounded hover:bg-slate-800"
          >
            Close
          </button>

          <button
            onClick={onReAssess}
            className="px-4 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500"
          >
            Re-Assess
          </button>
        </div>
      </div>
    </div>
  );
}
