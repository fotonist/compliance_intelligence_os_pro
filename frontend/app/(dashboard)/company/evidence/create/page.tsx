"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function EvidenceCreatePage() {

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [creating, setCreating] = useState(false);

  async function createEvidence() {

    setCreating(true);

    try {

      // 1️⃣ evidence create
      const res = await apiFetch("/evidences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description
        })
      });

      if (!res.ok) {
        console.error("CREATE FAILED");
        return;
      }

      const evidence = await res.json();

      // 2️⃣ upload file
      if (file) {

        const form = new FormData();
        form.append("file", file);

        await apiFetch(`/evidences/${evidence.id}/files`, {
          method: "POST",
          body: form
        });

      }

      alert("Evidence created");

      setTitle("");
      setDescription("");
      setFile(null);

    } catch (err) {

      console.error(err);

    } finally {

      setCreating(false);

    }

  }

  return (

    <div className="max-w-xl space-y-6">

      <h1 className="text-xl font-semibold">
        Create Evidence
      </h1>

      <div className="space-y-3">

        <input
          className="w-full bg-slate-900 border border-slate-800 p-2 rounded"
          placeholder="Title"
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
        />

        <textarea
          className="w-full bg-slate-900 border border-slate-800 p-2 rounded"
          placeholder="Description"
          value={description}
          onChange={(e)=>setDescription(e.target.value)}
        />

        <input
          type="file"
          onChange={(e)=>setFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={createEvidence}
          disabled={creating}
          className="px-4 py-2 bg-blue-600 rounded"
        >
          Create Evidence
        </button>

      </div>

    </div>

  );

}