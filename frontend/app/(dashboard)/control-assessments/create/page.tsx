"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

interface ControlStandard {
  id: number;
  code: string;
}

export default function ControlAssessmentCreatePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [standards, setStandards] = useState<ControlStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [standardId, setStandardId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;

    async function loadStandards() {
      try {
        const res = await fetch(
          `${API_BASE}/standards/?type=CONTROL_BASED`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error();
        setStandards(await res.json());
      } catch {
        setStandards([]);
      } finally {
        setLoading(false);
      }
    }

    loadStandards();
  }, [token]);

  async function createAssessment() {
    if (!standardId || !name.trim()) return;

    setCreating(true);
    await new Promise((r) => setTimeout(r, 300));
    setCreating(false);
    router.push("/control-assessments?created=1");
  }

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading control standards…</div>;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold text-slate-100">
        New Control Assessment
      </h1>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <select
          className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
          value={standardId}
          onChange={(e) =>
            setStandardId(e.target.value ? Number(e.target.value) : "")
          }
        >
          <option value="">Select standard</option>
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>

        <input
          className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
          placeholder="Assessment name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
          placeholder="Scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={creating}
            onClick={createAssessment}
            className="
              inline-flex items-center gap-2
              px-4 py-2 rounded-lg
              bg-indigo-600 hover:bg-indigo-500
              text-white text-sm font-medium
              focus:outline-none focus:ring-2 focus:ring-indigo-400/40
              disabled:opacity-50 disabled:cursor-not-allowed
              transition
            "
          >
            {creating ? "Creating…" : "Create Assessment"}
          </button>
        </div>
      </section>
    </div>
  );
}
