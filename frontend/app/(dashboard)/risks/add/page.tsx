"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AddRiskPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState(1);
  const [likelihood, setLikelihood] = useState(1);
  const [controlId, setControlId] = useState<number | null>(null);
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // -----------------------------
  // LOAD CONTROLS FROM BACKEND
  // -----------------------------
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    fetch("http://127.0.0.1:8000/controls/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setControls(data))
      .catch((err) => console.error("Control list failed:", err));
  }, []);

  const handleSave = async () => {
    if (!controlId) {
      alert("Please select a control.");
      return;
    }

    setLoading(true);

    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Not authenticated");
      return;
    }

    const res = await fetch("http://127.0.0.1:8000/risks/", {
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
        control_id: controlId, // 🔥 EKLENDİ
      }),
    });

    setLoading(false);

    if (res.ok) {
      alert("Risk created!");
      router.push("/matrix");
    } else {
      const msg = await res.text();
      alert("Failed to create risk: " + msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Add New Risk</h1>

      <div className="space-y-6 max-w-xl">

        {/* TITLE */}
        <div>
          <label className="block mb-1 text-slate-400">Title</label>
          <input
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* DESCRIPTION */}
        <div>
          <label className="block mb-1 text-slate-400">Description</label>
          <textarea
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* CONTROL SELECT */}
        <div>
          <label className="block mb-1 text-slate-400">Control</label>
          <select
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
            value={controlId ?? ""}
            onChange={(e) => setControlId(Number(e.target.value))}
          >
            <option value="">-- Select Control --</option>
            {controls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code || c.title || "Control " + c.id}
              </option>
            ))}
          </select>
        </div>

        {/* IMPACT + LIKELIHOOD */}
        <div className="flex gap-6">
          <div>
            <label className="block mb-1 text-slate-400">Impact</label>
            <input
              type="number"
              className="px-3 py-2 rounded bg-slate-800 border border-slate-700 w-20"
              value={impact}
              min={1}
              max={5}
              onChange={(e) => setImpact(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-400">Likelihood</label>
            <input
              type="number"
              className="px-3 py-2 rounded bg-slate-800 border border-slate-700 w-20"
              value={likelihood}
              min={1}
              max={5}
              onChange={(e) => setLikelihood(Number(e.target.value))}
            />
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={() => router.push("/matrix")}
            className="px-4 py-2 bg-slate-700 rounded"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500"
          >
            {loading ? "Saving..." : "Create Risk"}
          </button>
        </div>
      </div>
    </div>
  );
}
