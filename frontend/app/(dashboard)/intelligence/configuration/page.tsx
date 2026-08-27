"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save, Settings2 } from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Configuration = {
  id: number;
  tenant_id: number;
  model_name: string;
  version: number;
  status: string;
  risk_weight: number;
  coverage_weight: number;
  maturity_weight: number;
  evidence_weight: number;
  task_pressure_weight: number;
  active: boolean;
  change_reason?: string | null;
};

const fields = [
  ["risk_weight", "Risk Exposure"],
  ["coverage_weight", "Control Coverage"],
  ["maturity_weight", "Maturity"],
  ["evidence_weight", "Evidence"],
  ["task_pressure_weight", "Task Pressure"],
] as const;

export default function IntelligenceConfigurationPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch(
          "/company/intelligence/configuration"
        );

        if (!response.ok) {
          throw new Error(
            `Configuration load failed (${response.status}): ${await response.text()}`
          );
        }

        const data = (await response.json()) as Configuration;

        setConfig(data);
        setWeights({
          risk_weight: Number(data.risk_weight) * 100,
          coverage_weight: Number(data.coverage_weight) * 100,
          maturity_weight: Number(data.maturity_weight) * 100,
          evidence_weight: Number(data.evidence_weight) * 100,
          task_pressure_weight: Number(data.task_pressure_weight) * 100,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load configuration."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const total = Object.values(weights).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  const valid = Math.abs(total - 100) < 0.001;

  function updateWeight(key: string, value: string) {
    const n = Number(value);

    setWeights((current) => ({
      ...current,
      [key]: Number.isFinite(n) ? n : 0,
    }));

    setMessage(null);
  }

  async function saveDraft() {
    if (!valid) {
      setError(`Weights must total 100%. Current total: ${(total * 100).toFixed(1)}%.`);
      return;
    }

    if (!reason.trim()) {
      setError("Change reason is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await apiFetch(
        "/company/intelligence/configuration/draft",
        {
          method: "POST",
          body: JSON.stringify({
            risk_weight: Number(weights.risk_weight || 0) / 100,
            coverage_weight: Number(weights.coverage_weight || 0) / 100,
            maturity_weight: Number(weights.maturity_weight || 0) / 100,
            evidence_weight: Number(weights.evidence_weight || 0) / 100,
            task_pressure_weight:
              Number(weights.task_pressure_weight || 0) / 100,
            change_reason: reason.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Draft creation failed (${response.status}): ${await response.text()}`
        );
      }

      const data = (await response.json()) as Configuration;

      setMessage(`Draft version ${data.version} created successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create configuration draft."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-8">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading configuration...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-700">
            <Settings2 className="h-4 w-4" />
            Intelligence Governance
          </div>

          <h1 className="text-3xl font-semibold text-slate-900">
            Model Configuration
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Configure the Unified Exposure Engine weighting model.
          </p>
        </div>

        {error && (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Unified Exposure Engine (UEE)
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                UEE evaluates the organization&apos;s current exposure across
                risk, control coverage, maturity, evidence quality, and
                operational task pressure and combines these dimensions into
                a single tenant-scoped exposure score.
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  UEE Formula
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-6 text-slate-700">
                  UEE = (Risk Exposure × Effective Risk Weight)
                  <br />
                  + (Control Coverage × Effective Coverage Weight)
                  <br />
                  + (Maturity × Effective Maturity Weight)
                  <br />
                  + (Evidence × Effective Evidence Weight)
                  <br />
                  + (Task Pressure × Effective Task Pressure Weight)
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  All UEE exposure indices use a 0–100 scale:
                  <strong className="text-slate-700"> 0 = lowest exposure</strong>
                  {" "}
                  and
                  <strong className="text-slate-700"> 100 = highest exposure</strong>.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Model Rules
                </div>

                <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                  <li>
                    • The five configured weights must total exactly 100%.
                  </li>
                  <li>
                    • If no active maturity assessment exists, maturity does
                    not contribute zero exposure; its weight is removed and
                    the remaining weights are normalized.
                  </li>
                  <li>
                    • Compliance Health is constrained by Control Health and
                    cannot exceed the current control coverage health.
                  </li>
                  <li>
                    • The resulting Unified Exposure Score is clamped to the
                    0–100 range.
                  </li>
                </ul>
              </div>

              <p className="mt-5 text-sm text-slate-500">
                Configure the five UEE weights below. The current model
                configuration is versioned and changes are saved as drafts.
              </p>
            </div>

            <div className="space-y-6 p-6">
              {fields.map(([key, label]) => (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-800">
                      {label}
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(weights[key] || 0)}
                        onChange={(e) =>
                          updateWeight(key, e.target.value)
                        }
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-right"
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(weights[key] || 0)}
                    onChange={(e) =>
                      updateWeight(key, e.target.value)
                    }
                    className="w-full"
                  />
                </div>
              ))}

              <div
                className={`rounded-xl border p-4 ${
                  valid
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex justify-between">
                  <span className="font-medium">Total Weight</span>
                  <span className="font-bold">
                    {total.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Change Reason
                </label>

                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for this model change..."
                  className="w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <button
                type="button"
                onClick={saveDraft}
                disabled={!valid || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </button>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Active Configuration
            </h2>

            {config && (
              <>
                <div className="mt-4 text-2xl font-bold text-slate-900">
                  {config.model_name} v{config.version}
                </div>

                <div className="mt-1 text-sm text-emerald-600">
                  {config.status}
                </div>

                <div className="mt-6 space-y-3">
                  {fields.map(([key, label]) => (
                    <div
                      key={key}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold">
                        {(
                          Number(config[key]) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>

        </div>
      </div>
    </main>
  );
}
