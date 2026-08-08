"use client";

import { useEffect, useState } from "react";

type EditRiskModalProps = {
  open: boolean;
  risk: any | null;
  onClose: () => void;
  onSaved: (data?: any) => void;
};

function calculateAuto(score: number) {
  if (score >= 15) {
    return { status: "Critical", treatment: "Avoid / Transfer" };
  }
  if (score >= 10) {
    return { status: "High", treatment: "Mitigate" };
  }
  if (score >= 5) {
    return { status: "Medium", treatment: "Monitor" };
  }
  return { status: "Low", treatment: "Accept" };
}

export default function EditRiskModal({
  open,
  risk,
  onClose,
  onSaved,
}: EditRiskModalProps) {
  if (!open) return null;

  const isEdit = !!risk?.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<number>(1);
  const [likelihood, setLikelihood] = useState<number>(1);

  const [status, setStatus] = useState("");
  const [treatment, setTreatment] = useState("");
  const [action, setAction] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!risk) {
      setTitle("");
      setDescription("");
      setImpact(1);
      setLikelihood(1);
      setStatus("");
      setTreatment("");
      setAction("");
      return;
    }

    setTitle(risk.title ?? "");
    setDescription(risk.description ?? "");
    setImpact(risk.impact ?? 1);
    setLikelihood(risk.likelihood ?? 1);
    setStatus(risk.status ?? "");
    setTreatment(risk.treatment ?? "");
    setAction(risk.action ?? "");
  }, [risk]);

  const score = impact * likelihood;

  // 🔑 AUTO CALCULATION
  useEffect(() => {
    const auto = calculateAuto(score);
    setStatus(auto.status);
    setTreatment(auto.treatment);
  }, [score]);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title,
        description,
        impact,
        likelihood,
        status,
        treatment,
        action: action?.trim() || risk?.action || null,
        control_id: risk?.control_id,
      };

      const url = isEdit
        ? `https://compliance-intelligence-os-pro-2.onrender.com/risks/${risk.id}`
        : "https://compliance-intelligence-os-pro-2.onrender.com/risks/";

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error(txt);
        setError("Error saving risk.");
        setSaving(false);
        return;
      }

      const json = await res.json();
      onSaved(json);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-slate-900 p-6 rounded-lg max-w-2xl w-full border border-slate-700">

        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-white">
            {isEdit ? `Update Risk: ${risk?.title}` : "Create New Risk"}
          </h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-xl">
            ✕
          </button>
        </div>

        {error && (
          <div className="text-red-400 bg-red-950/40 border border-red-700 rounded p-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm text-slate-300 mb-1">Title</label>
            <input
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Description</label>
            <textarea
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Impact</label>
              <input
                type="number"
                value={impact}
                min={1}
                max={5}
                onChange={(e) => setImpact(+e.target.value)}
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Likelihood</label>
              <input
                type="number"
                value={likelihood}
                min={1}
                max={5}
                onChange={(e) => setLikelihood(+e.target.value)}
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Score</label>
              <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                {score}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Status (Auto)</label>
              <input
                value={status}
                readOnly
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-gray-300"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Treatment (Auto)</label>
              <input
                value={treatment}
                readOnly
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-gray-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Action</label>
            <textarea
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white h-20"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Describe the action to be taken"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 rounded">
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Risk"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
