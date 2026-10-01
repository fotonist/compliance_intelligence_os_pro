"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type Clause = {
  id: number;
  code: string;
  title: string;
};

type Override = {
  clause_id: number;
  weight: number;
};

type OverrideResponse = {
  items?: Override[];
  overrides?: Override[];
};

export default function ClauseWeightsPage() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [weights, setWeights] = useState<Record<number, number>>({});
  const [initialWeights, setInitialWeights] = useState<Record<number, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const cRes = await apiFetch("/standards/2/clauses");

      if (!cRes.ok) {
        throw new Error(`Clauses API failed: ${cRes.status}`);
      }

      const clauseData = await cRes.json();

      const loadedClauses: Clause[] = Array.isArray(clauseData)
        ? clauseData
        : clauseData.items || [];

      const oRes = await apiFetch(
        "/company/clause-weights/overrides"
      );

      if (!oRes.ok) {
        throw new Error(`Clause weights API failed: ${oRes.status}`);
      }

      const overrideData: OverrideResponse | Override[] =
        await oRes.json();

      const overrideItems: Override[] = Array.isArray(overrideData)
        ? overrideData
        : overrideData.items || overrideData.overrides || [];

      const nextWeights: Record<number, number> = {};

      for (const clause of loadedClauses) {
        nextWeights[clause.id] = 0;
      }

      for (const item of overrideItems) {
        nextWeights[item.clause_id] = Number(item.weight) || 0;
      }

      setClauses(loadedClauses);
      setWeights(nextWeights);
      setInitialWeights(nextWeights);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Clause weights could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalWeight = useMemo(
    () =>
      clauses.reduce(
        (total, clause) => total + (Number(weights[clause.id]) || 0),
        0
      ),
    [clauses, weights]
  );

  const remaining = 100 - totalWeight;

  const changedCount = useMemo(
    () =>
      clauses.filter(
        (clause) =>
          Number(weights[clause.id] || 0) !==
          Number(initialWeights[clause.id] || 0)
      ).length,
    [clauses, weights, initialWeights]
  );

  const hasChanges = changedCount > 0;
  const isBalanced = Math.abs(totalWeight - 100) < 0.001;

  function updateWeight(clauseId: number, value: string) {
    const parsed = Number(value);

    const safeValue = Number.isFinite(parsed)
      ? Math.min(100, Math.max(0, parsed))
      : 0;

    setSuccess(null);

    setWeights((current) => ({
      ...current,
      [clauseId]: safeValue,
    }));
  }

  function distributeEqually() {
    if (!clauses.length) {
      return;
    }

    const base = Math.floor((10000 / clauses.length)) / 100;
    const next: Record<number, number> = {};

    clauses.forEach((clause, index) => {
      if (index === clauses.length - 1) {
        const assigned = Object.values(next).reduce(
          (sum, value) => sum + value,
          0
        );

        next[clause.id] = Number((100 - assigned).toFixed(2));
      } else {
        next[clause.id] = base;
      }
    });

    setWeights(next);
    setSuccess(null);
  }

  function resetChanges() {
    setWeights({ ...initialWeights });
    setSuccess(null);
    setError(null);
  }

  async function saveChanges() {
    if (!isBalanced) {
      setError(
        "Total clause weight must equal 100% before changes can be saved."
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      for (const clause of clauses) {
        const current = Number(weights[clause.id] || 0);
        const initial = Number(initialWeights[clause.id] || 0);

        if (current === initial) {
          continue;
        }

        const res = await apiFetch(
          "/company/clause-weights/overrides",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clause_id: clause.id,
              weight: current,
            }),
          }
        );

        if (!res.ok) {
          let detail = "";

          try {
            detail = await res.text();
          } catch {
            detail = "";
          }

          throw new Error(
            `Saving ${clause.code} failed (${res.status})${
              detail ? `: ${detail}` : ""
            }`
          );
        }
      }

      setInitialWeights({ ...weights });
      setSuccess("Clause weight configuration saved successfully.");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Clause weight configuration could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-8 py-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="animate-pulse">
            <div className="h-8 w-72 rounded-lg bg-slate-200" />
            <div className="mt-3 h-4 w-[460px] rounded bg-slate-200" />

            <div className="mt-8 grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-28 rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>

            <div className="mt-6 h-96 rounded-2xl border border-slate-200 bg-white" />
          </div>
        </div>
      </main>
    );
  }

  const progressWidth = Math.min(100, Math.max(0, totalWeight));

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Governance
              <span className="text-slate-300">/</span>
              Configuration
            </div>

            <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">
              Clause Weight Configuration
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Define the relative contribution of each ISO 27001 clause to
              organizational scoring and governance analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resetChanges}
              disabled={!hasChanges || saving}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset Changes
            </button>

            <button
              type="button"
              onClick={saveChanges}
              disabled={!hasChanges || saving || !isBalanced}
              className="h-10 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold">
              !
            </div>
            <div>
              <div className="font-semibold">Configuration error</div>
              <div className="mt-0.5 text-red-600">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold">
              ?
            </div>
            {success}
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Clauses"
            value={String(clauses.length)}
            helper="ISO 27001 scope"
          />

          <MetricCard
            label="Total Weight"
            value={`${formatWeight(totalWeight)}%`}
            helper="Target: 100%"
          />

          <MetricCard
            label="Remaining"
            value={`${formatWeight(remaining)}%`}
            helper={
              remaining === 0
                ? "Fully allocated"
                : remaining > 0
                  ? "Available allocation"
                  : "Over allocated"
            }
            alert={remaining < 0}
          />

          <MetricCard
            label="Configuration Status"
            value={isBalanced ? "Balanced" : "Attention"}
            helper={
              hasChanges
                ? `${changedCount} unsaved change${
                    changedCount === 1 ? "" : "s"
                  }`
                : "No pending changes"
            }
            status={isBalanced}
          />
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Weight Distribution
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                The complete clause allocation must equal 100%.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isBalanced
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {isBalanced ? "Allocation complete" : "Allocation incomplete"}
              </span>

              <span className="min-w-24 text-right text-sm font-semibold tabular-nums text-slate-900">
                {formatWeight(totalWeight)} / 100%
              </span>
            </div>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isBalanced
                  ? "bg-emerald-500"
                  : totalWeight > 100
                    ? "bg-red-500"
                    : "bg-blue-600"
              }`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Clause Allocation
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Configure the weighting used by scoring and governance
                calculations.
              </p>
            </div>

            <button
              type="button"
              onClick={distributeEqually}
              disabled={!clauses.length || saving}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              Distribute Equally
            </button>
          </div>

          <div className="hidden grid-cols-[120px_minmax(260px,1fr)_170px_minmax(220px,0.8fr)_110px] gap-5 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
            <div>Clause</div>
            <div>Description</div>
            <div>Weight</div>
            <div>Distribution</div>
            <div className="text-right">Status</div>
          </div>

          <div className="divide-y divide-slate-100">
            {clauses.map((clause) => {
              const value = Number(weights[clause.id] || 0);
              const initialValue = Number(
                initialWeights[clause.id] || 0
              );

              const changed = value !== initialValue;
              const barWidth = Math.min(100, Math.max(0, value));

              return (
                <div
                  key={clause.id}
                  className={`grid gap-4 px-5 py-4 transition lg:grid-cols-[120px_minmax(260px,1fr)_170px_minmax(220px,0.8fr)_110px] lg:items-center lg:gap-5 ${
                    changed ? "bg-blue-50/30" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div>
                    <div className="inline-flex min-w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                      {clause.code}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {clause.title}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      ISO 27001 clause
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">
                      Weight
                    </label>

                    <div className="flex h-10 w-full max-w-[150px] items-center overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={value}
                        onChange={(event) =>
                          updateWeight(clause.id, event.target.value)
                        }
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none"
                      />

                      <div className="border-l border-slate-200 px-2.5 text-xs font-semibold text-slate-400">
                        %
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] lg:hidden">
                      <span className="font-semibold uppercase tracking-wide text-slate-400">
                        Distribution
                      </span>
                      <span className="font-semibold tabular-nums text-slate-600">
                        {formatWeight(value)}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-start lg:justify-end">
                    {changed ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        Unsaved
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        Saved
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!clauses.length && (
            <div className="px-6 py-16 text-center">
              <div className="text-sm font-semibold text-slate-700">
                No clauses available
              </div>
              <div className="mt-1 text-xs text-slate-500">
                No clauses were returned for the selected standard.
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-slate-500">
              {hasChanges ? (
                <>
                  <span className="font-semibold text-slate-700">
                    {changedCount}
                  </span>{" "}
                  configuration change{changedCount === 1 ? "" : "s"} pending
                </>
              ) : (
                "All changes are saved."
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetChanges}
                disabled={!hasChanges || saving}
                className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={saveChanges}
                disabled={!hasChanges || saving || !isBalanced}
                className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </section>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          <span className="mt-0.5 font-bold text-slate-400">i</span>
          Clause weights affect organizational scoring calculations. Review
          changes before saving and maintain a total allocation of exactly
          100%.
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  helper,
  alert = false,
  status,
}: {
  label: string;
  value: string;
  helper: string;
  alert?: boolean;
  status?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-500">{label}</div>

        {typeof status === "boolean" && (
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        )}
      </div>

      <div
        className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${
          alert ? "text-red-600" : "text-slate-950"
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-400">{helper}</div>
    </div>
  );
}

function formatWeight(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}
