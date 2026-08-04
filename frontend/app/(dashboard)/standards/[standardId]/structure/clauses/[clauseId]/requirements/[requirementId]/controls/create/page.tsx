"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

export default function ControlCreatePage() {
  const { standardId, clauseId, requirementId } = useParams<{
    standardId: string;
    clauseId: string;
    requirementId: string;
  }>();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code.trim()) {
      setError("Control code is required");
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/controls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: code.trim(),
        title: title.trim(),
        requirement_id: Number(requirementId),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Control create failed");
      return;
    }

    router.push(
      `/standards/${standardId}/structure/clauses/${clauseId}/requirements/${requirementId}/controls`
    );
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Create Control</h1>

      <input
        className="w-full border p-2"
        placeholder="Control Code (A.5.1.1)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <input
        className="w-full border p-2"
        placeholder="Control Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create"}
        </button>

        <button
          onClick={() =>
            router.push(
              `/standards/${standardId}/structure/clauses/${clauseId}/requirements/${requirementId}/controls`
            )
          }
          className="border px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}