"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "control" | "maturity";

type StandardOption = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
};

type ColumnMap = {
  key: string;
  label: string;
  visible: boolean;
  sourceType: "entity_field" | "derived" | "fixed";
  entity: string;
  field: string;
  fixedValue?: string;
};

type AppModalState = {
  title: string;
  lines: string[];
};

const API_BASE = "http://localhost:8000";

export default function MatrixBuilderPage() {
  const [token, setToken] = useState<string>("");

  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [standardId, setStandardId] = useState<number | "">("");
  const [loading, setLoading] = useState<boolean>(false);

  const [mode, setMode] = useState<Mode>("control");
  const [rows, setRows] = useState<any[]>([]);

  const [columns, setColumns] = useState<ColumnMap[]>([]);
  const [onlyPreview, setOnlyPreview] = useState<boolean>(true);
  const [dedupStrategy, setDedupStrategy] =
    useState<"skip" | "overwrite">("skip");

  // App-içi modal (browser alert yerine)
  const [modal, setModal] = useState<AppModalState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  const selectedStandard = useMemo(() => {
    if (!standardId) return null;
    return standards.find((s) => s.id === standardId) || null;
  }, [standardId, standards]);

  /* =======================
     FETCH STANDARDS
     ======================= */
  useEffect(() => {
    if (!token) return;

    async function fetchStandards() {
      try {
        const res = await fetch(`${API_BASE}/standards/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        const list: StandardOption[] = Array.isArray(data)
          ? data.map((s: any) => ({
              id: s.id,
              code: s.code,
              title: s.title ?? null,
              type: s.type ?? s.standard_type ?? s.assessment_type ?? null,
            }))
          : [];

        list.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
        setStandards(list);
      } catch (e) {
        console.error("STANDARDS fetch failed:", e);
        setStandards([]);
      }
    }

    fetchStandards();
  }, [token]);

  /* =======================
     FETCH MATRIX PREVIEW
     ======================= */
  async function loadPreview() {
    if (!token || !standardId) return;

    setLoading(true);
    try {
      const url = `${API_BASE}/matrix?standard_id=${standardId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error("Preview failed:", res.status);
        setRows([]);
        setColumns([]);
        return;
      }

      const data = await res.json();
      const resolvedRows = Array.isArray(data) ? data : data?.rows ?? [];

      setRows(resolvedRows);

      if (data?.mode === "maturity" || data?.mode === "control") {
        setMode(data.mode);
      }

      const first = resolvedRows?.[0] || {};
      const keys = Object.keys(first);

      setColumns((prev) => {
        const existing = new Map(prev.map((c) => [c.key, c]));
        const next: ColumnMap[] = [];

        for (const k of keys) {
          if (existing.has(k)) {
            next.push(existing.get(k)!);
          } else {
            next.push({
              key: k,
              label: k,
              visible: true,
              sourceType: "entity_field",
              entity: inferEntityFromKey(k, mode),
              field: k,
            });
          }
        }

        for (const old of prev) {
          if (!keys.includes(old.key)) {
            next.push({ ...old, visible: false });
          }
        }

        return next;
      });
    } catch (e) {
      console.error("MATRIX preview fetch failed:", e);
      setRows([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns]
  );

  const previewRows = useMemo(() => rows.slice(0, 50), [rows]);

  function moveColumn(idx: number, dir: -1 | 1) {
    setColumns((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function updateColumn(key: string, patch: Partial<ColumnMap>) {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  }

  /* =======================
     GENERATE & SAVE
     ======================= */
  async function onGenerate() {
    if (!token || !standardId) return;

    if (onlyPreview) {
      setModal({
        title: "Dry-run",
        lines: ["Dry-run açık.", "DB’ye yazılmadı."],
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        standard_id: standardId,
        mode,
        dedup_strategy: dedupStrategy,
        columns: visibleColumns.map((c) => ({
          key: c.key,
          field: c.field,
        })),
        rows,
      };

      const res = await fetch(`${API_BASE}/matrix/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      setModal({
        title: "Matrix generated",
        lines: [
          `Matrix Instance ID: ${result.matrix_instance_id ?? "-"}`,
          `Status: ${result.matrix_instance_status ?? "-"}`,
          `Created: ${result.created ?? 0}`,
          `Skipped: ${result.skipped ?? 0}`,
          `Overwritten: ${result.overwritten ?? 0}`,
        ],
      });
    } catch (e) {
      console.error("GENERATE failed:", e);
      setModal({
        title: "Generate failed",
        lines: ["Generate failed"],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Matrix Row Builder</h1>
            <p className="text-xs text-slate-400">
              Standard: <b>{selectedStandard?.code || "-"}</b> | Mode:{" "}
              <b>{mode}</b> | Preview Rows: <b>{rows.length}</b>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/matrix"
              className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              ← Matrix
            </a>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Standard
              </label>
              <select
                value={standardId}
                onChange={(e) =>
                  setStandardId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200"
              >
                <option value="">Select…</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                    {s.title ? ` — ${s.title}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Run mode
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
                  {mode}
                </span>
                <button
                  onClick={loadPreview}
                  disabled={!standardId || loading || !token}
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Preview / Refresh"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Generate options
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyPreview}
                    onChange={(e) => setOnlyPreview(e.target.checked)}
                  />
                  Dry-run (preview only)
                </label>

                <select
                  value={dedupStrategy}
                  onChange={(e) => setDedupStrategy(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200"
                >
                  <option value="skip">Dedup: skip</option>
                  <option value="overwrite">Dedup: overwrite</option>
                </select>

                <button
                  onClick={onGenerate}
                  disabled={!standardId || loading || !token}
                  className="bg-emerald-700/80 border border-emerald-600 rounded-md px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {onlyPreview ? "Dry-run" : "Generate & Save"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Column mapping */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Column mapping</h2>
              <span className="text-xs text-slate-400">
                Visible: <b>{visibleColumns.length}</b> / {columns.length}
              </span>
            </div>

            {columns.length === 0 ? (
              <div className="text-slate-400 text-sm">
                Preview al → kolonlar otomatik çıkar.
              </div>
            ) : (
              <div className="space-y-2">
                {columns.map((c, idx) => (
                  <div
                    key={c.key}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">column_key</div>
                        <div className="text-sm text-slate-200 truncate">
                          {c.key}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveColumn(idx, -1)}
                          className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded hover:bg-slate-700"
                          title="Up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveColumn(idx, 1)}
                          className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded hover:bg-slate-700"
                          title="Down"
                        >
                          ↓
                        </button>
                        <label className="text-xs text-slate-300 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={c.visible}
                            onChange={(e) =>
                              updateColumn(c.key, {
                                visible: e.target.checked,
                              })
                            }
                          />
                          Visible
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Preview</h2>
              <span className="text-xs text-slate-400">First 50 rows</span>
            </div>

            {previewRows.length === 0 ? (
              <div className="text-slate-400 text-sm">
                Preview al → satırlar burada görünecek.
              </div>
            ) : (
              <div className="overflow-auto border border-slate-800 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900">
                    <tr>
                      {visibleColumns.map((c) => (
                        <th
                          key={c.key}
                          className="text-left text-xs text-slate-400 px-3 py-2 border-b border-slate-800 whitespace-nowrap"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        {visibleColumns.map((c) => (
                          <td
                            key={c.key}
                            className="px-3 py-2 text-slate-200 whitespace-nowrap"
                          >
                            {renderCell(r, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
              Not: “Generate & Save” artık DB’ye yazar.
            </div>
          </div>
        </div>
      </div>

      {/* App-içi Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{modal.title}</h3>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-slate-200 space-y-1">
              {modal.lines.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-200"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function renderCell(row: any, col: ColumnMap) {
  if (!row) return "";
  if (col.sourceType === "fixed") return col.fixedValue || "";
  const v = row[col.key];
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function inferEntityFromKey(key: string, mode: Mode) {
  const k = (key || "").toLowerCase();

  if (k.includes("standard")) return "Standard";
  if (mode === "maturity") {
    if (k.includes("process_area")) return "StandardProcessArea";
    if (k.includes("practice")) return "StandardPractice";
    if (k.includes("capability") || k.includes("level"))
      return "CapabilityLevel";
    if (k.includes("evidence")) return "Evidence";
    return "Maturity";
  }

  if (k.includes("clause")) return "Clause";
  if (k.includes("requirement")) return "Requirement";
  if (k.includes("control")) return "Control";
  if (k.includes("risk")) return "Risk";
  if (k.includes("evidence")) return "Evidence";
  return "Control";
}
