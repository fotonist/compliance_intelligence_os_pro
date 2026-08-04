"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

type EvidenceItem = {
  id: number;
  title: string;
  status: string;
  files_count?: number;
};

type PracticeRow = {
  id: number;
  process_area_id: number;
  process_area_name: string;
  practice_code: string;
  practice_title: string;
  evidences: EvidenceItem[];
};

export default function MaturityPracticeWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [rows, setRows] = useState<PracticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPractice, setSelectedPractice] =
    useState<PracticeRow | null>(null);

  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState(false);

  const token = getToken();

  const loadRows = useCallback(async () => {
    if (!token || !sessionId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/maturity/workspace/${sessionId}/practices`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to load practices");
      }

      const data: PracticeRow[] = await res.json();

      setRows(data);

      setSelectedPractice((prev) => {
        if (!prev) return prev;

        const updated = data.find((item) => item.id === prev.id);

        return updated || prev;
      });
    } finally {
      setLoading(false);
    }
  }, [token, sessionId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPractices = rows.length;

  const totalEvidences = useMemo(() => {
    return rows.reduce((acc, item) => acc + item.evidences.length, 0);
  }, [rows]);

  const completedPractices = useMemo(() => {
    return rows.filter((item) => item.evidences.length > 0).length;
  }, [rows]);

  function openEvidenceDrawer(row: PracticeRow) {
    setSelectedPractice(row);
    setDrawerOpen(true);
    setEvidenceTitle("");
    setEvidenceDescription("");
    setSelectedFiles([]);
    setDragActive(false);
  }

  function addFiles(files: FileList | File[]) {
    const incomingFiles = Array.from(files);

    setSelectedFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );

      const uniqueIncomingFiles = incomingFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });

      return [...prev, ...uniqueIncomingFiles];
    });
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateEvidence() {
    if (!selectedPractice || !token) return;

    if (!evidenceTitle.trim()) {
      alert("Evidence title required");
      return;
    }

    setSavingEvidence(true);

    try {
      const createRes = await fetch(`${API_BASE}/maturity/evidences`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          practice_evaluation_id: selectedPractice.id,
          title: evidenceTitle.trim(),
          description: evidenceDescription.trim() || null,
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(text || "Evidence creation failed");
      }

      const created = await createRes.json();

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(
          `${API_BASE}/maturity/evidences/${created.id}/files`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error(text || `File upload failed: ${file.name}`);
        }
      }

      setEvidenceTitle("");
      setEvidenceDescription("");
      setSelectedFiles([]);

      await loadRows();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Evidence operation failed");
    } finally {
      setSavingEvidence(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-[#020817] text-white p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">
            Governance & Intelligence Engine
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            Maturity Practice Workspace
          </h1>

          <p className="text-slate-400 mt-2 text-sm">
            Operational maturity tracking, evidence management and remediation
            orchestration.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900 text-sm text-slate-300">
            Session #{sessionId}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-slate-400 text-sm mb-2">Total Practices</div>
          <div className="text-4xl font-semibold">{totalPractices}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-slate-400 text-sm mb-2">Linked Evidences</div>
          <div className="text-4xl font-semibold">{totalEvidences}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-slate-400 text-sm mb-2">
            Practices With Evidence
          </div>
          <div className="text-4xl font-semibold">{completedPractices}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-6 py-4 text-left">Process Area</th>
                <th className="px-6 py-4 text-left">Code</th>
                <th className="px-6 py-4 text-left">Practice</th>
                <th className="px-6 py-4 text-center">Evidences</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-6 py-5">{r.process_area_name}</td>

                  <td className="px-6 py-5 font-mono text-cyan-300">
                    {r.practice_code}
                  </td>

                  <td className="px-6 py-5">{r.practice_title}</td>

                  <td className="px-6 py-5 text-center">
                    {r.evidences.length}
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEvidenceDrawer(r)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm"
                      >
                        Evidences
                      </button>

                      <button
                        onClick={() =>
                          router.push(
                            `/maturity/tasks/create?process_id=${r.process_area_id}&practice_id=${r.id}`
                          )
                        }
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white"
                      >
                        Create Task
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen && selectedPractice && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="relative h-full w-full max-w-[620px] border-l border-slate-800 bg-[#020817] overflow-y-auto">
            <div className="border-b border-slate-800 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">
                    Evidence Management
                  </div>

                  <h2 className="text-2xl font-semibold">
                    {selectedPractice.practice_code}
                  </h2>

                  <p className="text-sm text-slate-400 mt-2">
                    {selectedPractice.practice_title}
                  </p>
                </div>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
                <h3 className="text-lg font-medium mb-4">Add Evidence</h3>

                <div className="space-y-4">
                  <input
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm"
                    placeholder="Evidence title"
                    value={evidenceTitle}
                    onChange={(e) => setEvidenceTitle(e.target.value)}
                  />

                  <textarea
                    rows={4}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm"
                    placeholder="Description"
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                  />

                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);

                      if (e.dataTransfer.files?.length) {
                        addFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`
                      flex
                      min-h-[150px]
                      cursor-pointer
                      flex-col
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-dashed
                      px-6
                      py-8
                      text-center
                      transition-all
                      ${
                        dragActive
                          ? "border-indigo-400 bg-indigo-500/10"
                          : "border-slate-700 bg-slate-900/50 hover:border-indigo-500 hover:bg-slate-900"
                      }
                    `}
                  >
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          addFiles(e.target.files);
                        }

                        e.target.value = "";
                      }}
                    />

                    <div className="text-sm font-medium text-slate-200">
                      Dosyaları buraya sürükle-bırak
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      veya çoklu dosya seçmek için bu alana tıkla
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      PDF, DOCX, XLSX, PNG, JPG desteklenir
                    </div>
                  </label>

                  {selectedFiles.length > 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-200">
                          Selected Files
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFiles([])}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm text-slate-200">
                                {file.name}
                              </div>

                              <div className="text-xs text-slate-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeSelectedFile(index)}
                              className="ml-3 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateEvidence}
                    disabled={savingEvidence}
                    className="w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm text-white disabled:opacity-60"
                  >
                    {savingEvidence
                      ? `Saving ${selectedFiles.length} file(s)...`
                      : "Create Evidence"}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-medium">Linked Evidences</h3>

                  <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm">
                    {selectedPractice.evidences.length}
                  </div>
                </div>

                {selectedPractice.evidences.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    No evidence linked.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedPractice.evidences.map((evidence) => (
                      <div
                        key={evidence.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{evidence.title}</div>

                            <div className="text-sm text-slate-400 mt-2">
                              Files: {evidence.files_count || 0}
                            </div>
                          </div>

                          <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs text-indigo-300">
                            {evidence.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}