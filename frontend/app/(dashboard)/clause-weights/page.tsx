"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Clause = {
  id: number;
  code: string;
  title: string;
};

export default function ClauseWeightsPage() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [weights, setWeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const standardCode = "ISO27001";

  async function load() {
    try {
      setLoading(true);

      const cRes = await apiFetch("/standards/2/clauses", {
        method: "GET",
      });

      if (!cRes.ok) {
        throw new Error(`Clauses API failed: ${cRes.status}`);
      }

      const clausesData = await cRes.json();

      const oRes = await apiFetch("/company/clause-weights/overrides", {
        method: "GET",
      });

      const overrides = oRes.ok ? await oRes.json() : [];

      const weightMap: Record<number, number> = {};

      if (Array.isArray(overrides)) {
        overrides.forEach((o: any) => {
          if (o?.clause_id != null) {
            weightMap[Number(o.clause_id)] = Number(o.weight_pct ?? 0);
          }
        });
      }

      setClauses(Array.isArray(clausesData) ? clausesData : []);
      setWeights(weightMap);
    } catch (err) {
      console.error("ClauseWeights load error:", err);
      setClauses([]);
      setWeights({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(clause: Clause) {
    const weight = weights[clause.id] ?? 0;

    try {
      const res = await apiFetch("/company/clause-weights/overrides", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          standard_code: standardCode,
          clause_code: clause.code,
          weight_pct: weight,
        }),
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      alert("Clause weight saved successfully.");
    } catch (err) {
      console.error("ClauseWeights save error:", err);
      alert("Failed to save clause weight.");
    }
  }

  function updateWeight(clauseId: number, value: string) {
    const parsed = Number(value);

    setWeights((current) => ({
      ...current,
      [clauseId]: Number.isFinite(parsed) ? parsed : 0,
    }));
  }

  if (loading) {
    return (
      <main className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading clause weights...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="border-b border-slate-200 pb-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
            Governance
          </div>

          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Clause Weights
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Configure clause-level weighting for {standardCode}.
              </p>
            </div>

            <div className="border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Standard
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-800">
                {standardCode}
              </div>
            </div>
          </div>
        </header>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="text-sm font-bold text-slate-800">
              Clause Configuration
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Current clause records and tenant-specific weight overrides.
            </div>
          </div>

          {clauses.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No clauses found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {clauses.map((clause) => (
                <div
                  key={clause.id}
                  className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {clause.code}
                      </span>

                      <span className="text-sm font-semibold text-slate-900">
                        {clause.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label
                        htmlFor={`weight-${clause.id}`}
                        className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                      >
                        Weight %
                      </label>

                      <input
                        id={`weight-${clause.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={weights[clause.id] ?? 0}
                        onChange={(e) =>
                          updateWeight(clause.id, e.target.value)
                        }
                        className="h-9 w-28 border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => save(clause)}
                      className="mt-5 h-9 bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
