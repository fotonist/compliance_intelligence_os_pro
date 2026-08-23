"use client";

import { useEffect, useMemo, useState } from "react";
import { updateRisk, type RiskItem } from "../../../services/risk";

type Props = {
  risk: RiskItem;
  onClose: () => void;
  onUpdated: () => void;
};

export default function UpdateRiskModal({
  risk,
  onClose,
  onUpdated,
}: Props) {
  const [likelihood, setLikelihood] = useState(String(risk.likelihood ?? ""));
  const [impact, setImpact] = useState(String(risk.impact ?? ""));
  const [status, setStatus] = useState(String(risk.status ?? "OPEN"));
  const [treatment, setTreatment] = useState(String(risk.treatment ?? ""));
  const [action, setAction] = useState(String(risk.action ?? ""));
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLikelihood(String(risk.likelihood ?? ""));
    setImpact(String(risk.impact ?? ""));
    setStatus(String(risk.status ?? "OPEN"));
    setTreatment(String(risk.treatment ?? ""));
    setAction(String(risk.action ?? ""));
    setChangeReason("");
    setError(null);
  }, [risk]);

  const calculatedScore = useMemo(() => {
    const l = Number(likelihood);
    const i = Number(impact);

    if (!Number.isFinite(l) || !Number.isFinite(i)) return null;
    if (l < 1 || l > 5 || i < 1 || i > 5) return null;

    return l * i;
  }, [likelihood, impact]);

  const calculatedLevel = useMemo(() => {
    if (calculatedScore === null) return "-";
    if (calculatedScore >= 20) return "CRITICAL";
    if (calculatedScore >= 15) return "HIGH";
    if (calculatedScore >= 10) return "MEDIUM";
    if (calculatedScore >= 5) return "LOW";
    return "VERY LOW";
  }, [calculatedScore]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const l = Number(likelihood);
    const i = Number(impact);

    if (!Number.isInteger(l) || l < 1 || l > 5) {
      setError("Likelihood must be between 1 and 5.");
      return;
    }

    if (!Number.isInteger(i) || i < 1 || i > 5) {
      setError("Impact must be between 1 and 5.");
      return;
    }

    const scoreChanged =
      l !== Number(risk.likelihood) ||
      i !== Number(risk.impact);

    if (scoreChanged && !changeReason.trim()) {
      setError("Please provide a reason for changing the risk score.");
      return;
    }

    setSaving(true);

    try {
      await updateRisk(risk.id, {
        likelihood: l,
        impact: i,
        status: status || null,
        treatment: treatment.trim() || null,
        action: action.trim() || null,
        change_reason: changeReason.trim() || null,
      });

      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Risk could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-update-title"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Risk Management
              </div>
              <h2
                id="risk-update-title"
                className="mt-1 text-xl font-semibold text-slate-900"
              >
                Update Risk
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update the current risk assessment and management status.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto space-y-6 px-6 py-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Risk
              </div>

              <div className="mt-2 text-base font-semibold text-slate-900">
                {risk.title}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>Risk #{risk.id}</span>
                <span>•</span>
                <span>Current score: {risk.score ?? "-"}</span>
                <span>•</span>
                <span>Current level: {risk.risk_level ?? "-"}</span>
              </div>
            </div>

            <section>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Risk Assessment
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Define the current likelihood and impact assessment.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Likelihood
                  </span>
                  <select
                    value={likelihood}
                    onChange={(e) => setLikelihood(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Impact
                  </span>
                  <select
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Calculated Score
                  </span>
                  <div className="flex h-[42px] items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                    <span className="text-lg font-semibold text-slate-900">
                      {calculatedScore ?? "-"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {calculatedLevel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Change Reason / Update Justification
                  </span>

                  <textarea
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    disabled={saving}
                    placeholder="Explain why the risk score assessment has changed."
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  <span className="mt-1 block text-xs text-slate-500">
                    Required when likelihood or impact changes.
                  </span>
                </label>
              </div>
            </section>

            <section className="border-t border-slate-200 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Management Context
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Record treatment, action and current lifecycle status.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                    <option value="MITIGATED">MITIGATED</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Treatment
                  </span>
                  <input
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    disabled={saving}
                    placeholder="Risk treatment"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </span>
                <textarea
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={saving}
                  rows={4}
                  placeholder="Describe the planned or completed risk action."
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </section>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update Risk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}