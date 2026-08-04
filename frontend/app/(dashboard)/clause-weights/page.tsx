"use client";

import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

type Clause = {
  id: number;
  code: string;
  title: string;
};

export default function ClauseWeightsPage() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [weights, setWeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const standardCode = "ISO27001:2022";

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token")
      : null;

  async function load() {
    try {
      setLoading(true);

      const cRes = await fetch(`${API_BASE}/clauses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!cRes.ok) {
        throw new Error(`Clauses API failed: ${cRes.status}`);
      }

      const clausesData = await cRes.json();

      const oRes = await fetch(
        `${API_BASE}/company/clause-weights/overrides`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const overrides = oRes.ok ? await oRes.json() : [];

      const weightMap: Record<number, number> = {};

      if (Array.isArray(overrides)) {
        overrides.forEach((o: any) => {
          weightMap[o.clause_id] = o.weight_pct;
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
      const res = await fetch(
        `${API_BASE}/company/clause-weights/overrides`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            standard_code: standardCode,
            clause_code: clause.code,
            weight_pct: weight,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Save failed.");
      }

      alert("Clause weight saved successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to save clause weight.");
    }
  }

  function updateWeight(clauseId: number, value: number) {
    setWeights((prev) => ({
      ...prev,
      [clauseId]: value,
    }));
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-200">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-100">
            Clause Weights
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Configure the importance weight of each clause.
          </p>
        </div>

        <div className="text-slate-400">
          Loading clause weights...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-slate-200">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">
          Clause Weights
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Configure the importance weight of each clause for your
          organization.
        </p>
      </div>

      {clauses.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">
          No clauses found.
        </div>
      ) : (
        <div className="space-y-3">
          {clauses.map((c, index) => (
            <div
              key={c.id}
              className={`
                flex items-center justify-between
                rounded-xl border px-4 py-4
                transition-all duration-200
                ${
                  index % 2 === 0
                    ? "bg-slate-900/60 border-slate-800"
                    : "bg-slate-900/40 border-slate-800"
                }
                hover:bg-slate-900
                hover:border-slate-700
              `}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  Clause {c.code}
                </div>

                <div className="mt-1 text-sm text-slate-400">
                  {c.title}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 px-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights[c.id] ?? 0}
                    onChange={(e) =>
                      updateWeight(
                        c.id,
                        Number(e.target.value)
                      )
                    }
                    className="
                      w-16
                      bg-transparent
                      py-2
                      text-right
                      text-sm
                      text-slate-100
                      outline-none
                    "
                  />

                  <span className="ml-1 text-xs text-slate-500">
                    %
                  </span>
                </div>

                <button
                  onClick={() => save(c)}
                  className="
                    rounded-lg
                    bg-blue-600
                    px-4 py-2
                    text-xs
                    font-medium
                    text-white
                    transition-all duration-200
                    hover:bg-blue-500
                    hover:shadow-lg
                    hover:shadow-blue-500/20
                  "
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}