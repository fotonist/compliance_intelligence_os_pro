"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

function calcLevel(score: number) {
  if (score >= 15) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

function clamp15(v: number) {
  if (v < 1) return 1;
  if (v > 5) return 5;
  return v;
}

export default function CreateRiskPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState(1);
  const [likelihood, setLikelihood] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => impact * likelihood, [impact, likelihood]);
  const riskLevel = useMemo(() => calcLevel(score), [score]);

  async function handleCreate() {
    try {
      setSaving(true);
      setError(null);

      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("https://compliance-intelligence-os-pro-2.onrender.com/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          impact,
          likelihood,
          risk_level: riskLevel,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }

      const created = await res.json();
      router.push(`/risks/${created.id}`);
    } catch (e: any) {
      setError(e.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex justify-center items-start pt-10">
      <div className="w-full max-w-xl border border-slate-700 rounded-lg bg-slate-900 p-5 space-y-4">
        <h1 className="text-lg font-semibold">Create New Risk</h1>

        {error && (
          <div className="text-red-400 bg-red-950/40 border border-red-700 rounded p-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm mb-1">Title</label>
          <input
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Likelihood (1–5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={likelihood}
              onChange={(e) =>
                setLikelihood(clamp15(Number(e.target.value)))
              }
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Impact (1–5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={impact}
              onChange={(e) =>
                setImpact(clamp15(Number(e.target.value)))
              }
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            />
          </div>
        </div>

        <div className="flex justify-between items-center border border-slate-700 rounded bg-slate-800 p-3 text-sm">
          <div>Score: <strong>{score}</strong></div>
          <div>Level: <strong>{riskLevel}</strong></div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => router.push("/risks")}
            className="px-4 py-2 bg-slate-700 rounded"
          >
            Cancel
          </button>

          <button
            disabled={saving || !title}
            onClick={handleCreate}
            className="px-4 py-2 bg-emerald-600 rounded disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Risk"}
          </button>
        </div>
      </div>
    </div>
  );
}
