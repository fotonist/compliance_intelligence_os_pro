"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

export default function ControlCreatePage() {
  const router = useRouter();

  const [requirementId, setRequirementId] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);

    const token =
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    await fetch(`${API_BASE}/controls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requirement_id: Number(requirementId),
        code,
        title,
        description,
      }),
    });

    setLoading(false);
    router.back();
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-semibold mb-4">Create Control</h1>

      <input
        className="w-full mb-2 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Requirement ID"
        value={requirementId}
        onChange={(e) => setRequirementId(e.target.value)}
      />

      <input
        className="w-full mb-2 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Control Code (e.g. A.5.1.1)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <input
        className="w-full mb-2 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Control Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className="w-full mb-4 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button
        disabled={loading}
        onClick={submit}
        className="px-4 py-2 bg-emerald-700 rounded text-white"
      >
        Create
      </button>
    </div>
  );
}
