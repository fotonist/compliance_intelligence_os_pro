"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type Control = { id: number; code: string; title: string };

export default function CreateEvidencePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentType, setAssessmentType] = useState<"control" | "maturity">("control");
  const [controls, setControls] = useState<Control[]>([]);
  const [controlId, setControlId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/controls/", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        setControls(Array.isArray(data) ? data : data?.items || []);
      } catch { setControls([]); }
    })();
  }, []);

  async function create() {
    if (!title.trim() || (assessmentType === "control" && !controlId)) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/evidences/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assessment_type: assessmentType,
          ...(assessmentType === "control" ? { control_id: Number(controlId) } : {}),
          status: "draft",
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to create evidence");
      const data = await res.json();
      router.push(`/evidences/${data.id}`);
    } catch (e: any) { setError(e?.message || "Failed to create evidence"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div><div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Evidence Intelligence</div><h1 className="mt-1 text-2xl font-semibold">Create Evidence</h1><p className="mt-1 text-sm text-slate-500">Create the evidence record first. Files are uploaded and versioned separately.</p></div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Evidence Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Access Review Record" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Assessment Type</label><select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value as "control" | "maturity")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="control">Control</option><option value="maturity">Maturity</option></select></div>
          {assessmentType === "control" && <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Control</label><select value={controlId} onChange={(e) => setControlId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Select control...</option>{controls.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></div>}
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Description</label><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this evidence demonstrates." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5"><button onClick={() => router.back()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving || !title.trim() || (assessmentType === "control" && !controlId)} onClick={create} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Creating..." : "Create Evidence"}</button></div>
        </section>
      </div>
    </div>
  );
}
