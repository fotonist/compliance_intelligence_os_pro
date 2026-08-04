"use client";

import { useRef, useState } from "react";

const API_BASE = "http://localhost:8000";

type Props = {
  practiceEvaluationId: number;
  onClose: () => void;
  onCreated: () => void;
};

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

export default function AddEvidenceMaturityModal({
  practiceEvaluationId,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const token = getToken();
    if (!token || !title.trim()) return;

    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/maturity/evidences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          practice_evaluation_id: practiceEvaluationId,
        }),
      });

      if (!r.ok) throw new Error();
      const ev = await r.json();

      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append("file", f));
        await fetch(
          `${API_BASE}/maturity/evidences/${ev.id}/files`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          }
        );
      }

      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 p-6 rounded w-[480px]">
        <h2 className="mb-4 font-semibold">Add Evidence</h2>

        <input
          className="w-full mb-2 bg-slate-800 p-2 rounded"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full mb-3 bg-slate-800 p-2 rounded"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) =>
            e.target.files &&
            setFiles(Array.from(e.target.files))
          }
        />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="bg-indigo-600 px-3 py-1 rounded"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
