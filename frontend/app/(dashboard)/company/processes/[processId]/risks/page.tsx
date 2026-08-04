// frontend/app/(dashboard)/company/processes/[processId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../../../../lib/api";
import { TABLE } from "../../../../../components/ui/tableTokens";
import SeverityBadge from "../../../../../components/ui/SeverityBadge";
import IconButton from "../../../../../components/ui/IconButton";

type ProcessType = "core" | "support" | "management";
type ProcessStatus = "draft" | "active" | "archived";

type KPI = {
  id?: number;
  name: string;
  formula: string;
  target: string;
  current_value: string;
};

type RelatedStandard = {
  standard_code: string;
  ref: string; // clause/control/requirement
};

type LinkedRisk = {
  id: number;
  code?: string;
  title: string;
  severity?: string;
};

type ProcessDetail = {
  id: number;
  code: string;
  name: string;
  type: ProcessType;
  owner: string;
  status: ProcessStatus;
  description: string;

  inputs: string[];
  outputs: string[];

  related_standards: RelatedStandard[];
  linked_risks: LinkedRisk[];

  kpis: KPI[];
  updated_at?: string | null;
};

const TYPE_LABEL: Record<ProcessType, string> = {
  core: "Core",
  support: "Support",
  management: "Management",
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <div>
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="text-sm text-slate-400">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-400 mb-1">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
      : variant === "secondary"
      ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
      : "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-800";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}

function statusBadge(status: ProcessStatus) {
  if (status === "active") return <SeverityBadge label="Active" variant="success" />;
  if (status === "archived") return <SeverityBadge label="Archived" variant="info" />;
  return <SeverityBadge label="Draft" variant="warning" />;
}

function parseProcessId(p: unknown): number | null {
  const raw = Array.isArray(p) ? p[0] : p;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ProcessDetailPage() {
  const params = useParams<{ processId: string }>();
  const router = useRouter();

  const processId = useMemo(() => parseProcessId(params?.processId), [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState<ProcessDetail | null>(null);

  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);

  const headerTitle = useMemo(() => {
    if (!processId) return "Process (invalid id)";
    if (!data) return `Process #${processId}`;
    return `${data.code} — ${data.name}`;
  }, [data, processId]);

  useEffect(() => {
    if (!processId) {
      setLoading(false);
      setData(null);
      setError("Invalid process id in URL.");
      return;
    }
    load(processId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  useEffect(() => {
    if (!processId) return;

    async function loadLinkedRisks() {
      try {
        setRiskLoading(true);
        // Eğer backend yoksa 404 gelir; sessizce boş bırakıyoruz.
        const res = await apiFetch(`/processes/${processId}/risks`, { method: "GET" });

        if (!res.ok) {
          setLinkedRisks([]);
          return;
        }
        const json = await res.json();
        setLinkedRisks(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("Failed to load linked risks", err);
        setLinkedRisks([]);
      } finally {
        setRiskLoading(false);
      }
    }

    loadLinkedRisks();
  }, [processId]);

  async function load(pid: number) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(`/processes/${pid}`, { method: "GET" });

      if (!res.ok) {
        const t = await safeText(res);
        throw new Error(t || `Load failed (${res.status})`);
      }
      const json = await res.json();

      const normalized: ProcessDetail = {
        id: json?.id ?? pid,
        code: json?.code ?? "",
        name: json?.name ?? "",
        type: (json?.type ?? "core") as ProcessType,
        owner: json?.owner ?? "",
        status: (json?.status ?? "draft") as ProcessStatus,
        description: json?.description ?? "",
        inputs: Array.isArray(json?.inputs) ? json.inputs : [],
        outputs: Array.isArray(json?.outputs) ? json.outputs : [],
        related_standards: Array.isArray(json?.related_standards) ? json.related_standards : [],
        linked_risks: Array.isArray(json?.linked_risks) ? json.linked_risks : [],
        kpis: Array.isArray(json?.kpis) ? json.kpis : [],
        updated_at: json?.updated_at ?? null,
      };

      setData(normalized);
      setEditMode(false);
    } catch (e: any) {
      setError(e?.message || "Failed to load process.");
      setData(null);
      setEditMode(false);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!data || !processId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(`/company/processes/${processId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const t = await safeText(res);
        throw new Error(t || `Save failed (${res.status})`);
      }
      setNotice("Saved.");
      setEditMode(false);
      await load(processId);
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof ProcessDetail>(key: K, value: ProcessDetail[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function addTag(kind: "inputs" | "outputs") {
    const v = prompt(`Add ${kind === "inputs" ? "input" : "output"}:`);
    if (!v || !data) return;
    const val = v.trim();
    if (!val) return;
    set(kind, Array.from(new Set([...(data[kind] || []), val])) as any);
  }

  function removeTag(kind: "inputs" | "outputs", val: string) {
    if (!data) return;
    set(kind, (data[kind] || []).filter((x) => x !== val) as any);
  }

  function addKpi() {
    if (!data) return;
    set("kpis", [...(data.kpis || []), { name: "", formula: "", target: "", current_value: "" }]);
  }

  function removeKpi(index: number) {
    if (!data) return;
    set(
      "kpis",
      (data.kpis || []).filter((_, i) => i !== index)
    );
  }

  function updateKpi(index: number, patch: Partial<KPI>) {
    if (!data) return;
    const next = [...(data.kpis || [])];
    next[index] = { ...next[index], ...patch };
    set("kpis", next);
  }

  const risksToRender: LinkedRisk[] =
    (data?.linked_risks && data.linked_risks.length > 0 ? data.linked_risks : linkedRisks) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">{headerTitle}</div>
          <div className="text-sm text-slate-400">
            Process detail — inputs/outputs, standards, risks, KPIs
          </div>
          {data?.updated_at ? (
            <div className="text-xs text-slate-500 mt-1">Updated: {formatDate(data.updated_at)}</div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/company/processes")} disabled={loading || saving}>
            Back
          </Button>
          <Button variant="secondary" onClick={() => processId && load(processId)} disabled={loading || saving || !processId}>
            Refresh
          </Button>
          <Button variant="ghost" onClick={() => setEditMode((v) => !v)} disabled={loading || saving || !data}>
            {editMode ? "Cancel Edit" : "Edit"}
          </Button>
          <Button onClick={save} disabled={loading || saving || !data || !editMode}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-700/40 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">Loading...</div>
      ) : null}

      {!loading && !data ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">
          Process not found.
        </div>
      ) : null}

      {data ? (
        <>
          <Section title="Overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input value={data.code} onChange={(e) => set("code", e.target.value)} disabled={!editMode} />
              </div>

              <div>
                <Label>Name</Label>
                <Input value={data.name} onChange={(e) => set("name", e.target.value)} disabled={!editMode} />
              </div>

              <div>
                <Label>Type</Label>
                <Select value={data.type} onChange={(e) => set("type", e.target.value as ProcessType)} disabled={!editMode}>
                  <option value="core">Core</option>
                  <option value="support">Support</option>
                  <option value="management">Management</option>
                </Select>
              </div>

              <div>
                <Label>Owner</Label>
                <Input value={data.owner} onChange={(e) => set("owner", e.target.value)} disabled={!editMode} />
              </div>

              <div>
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  {statusBadge(data.status)}
                  {editMode ? (
                    <Select
                      value={data.status}
                      onChange={(e) => set("status", e.target.value as ProcessStatus)}
                      className="max-w-[180px]"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </Select>
                  ) : (
                    <div className="text-sm text-slate-400">{TYPE_LABEL[data.type]}</div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={5}
                  value={data.description}
                  onChange={(e) => set("description", e.target.value)}
                  disabled={!editMode}
                  placeholder="What does this process do? boundaries, purpose..."
                />
              </div>
            </div>
          </Section>

          <Section title="Inputs & Outputs" subtitle="High level I/O for downstream linking">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Inputs</div>
                  {editMode ? <IconButton onClick={() => addTag("inputs")} variant="add" /> : null}
                </div>

                <div className="mt-3 space-y-2">
                  {(data.inputs || []).length === 0 ? (
                    <div className="text-sm text-slate-500">No inputs.</div>
                  ) : (
                    data.inputs.map((x) => (
                      <div
                        key={x}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      >
                        <div className="text-sm text-slate-200">{x}</div>
                        {editMode ? <IconButton onClick={() => removeTag("inputs", x)} variant="remove" /> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Outputs</div>
                  {editMode ? <IconButton onClick={() => addTag("outputs")} variant="add" /> : null}
                </div>

                <div className="mt-3 space-y-2">
                  {(data.outputs || []).length === 0 ? (
                    <div className="text-sm text-slate-500">No outputs.</div>
                  ) : (
                    data.outputs.map((x) => (
                      <div
                        key={x}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      >
                        <div className="text-sm text-slate-200">{x}</div>
                        {editMode ? <IconButton onClick={() => removeTag("outputs", x)} variant="remove" /> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Related Standards" subtitle="Placeholder links (later: matrix auto-link)">
            <div className={TABLE.container}>
              <table className="w-full">
                <thead className={TABLE.headerRow}>
                  <tr>
                    <th className={TABLE.headerCell}>Standard</th>
                    <th className={TABLE.headerCell}>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.related_standards || []).length === 0 ? (
                    <tr className={TABLE.row}>
                      <td className={TABLE.cell} colSpan={2}>
                        No links yet.
                      </td>
                    </tr>
                  ) : (
                    data.related_standards.map((x, idx) => (
                      <tr
                        key={idx}
                        className={`${TABLE.row} cursor-pointer`}
                        onClick={() => {
                          // Route sizde farklıysa burayı değiştir
                          router.push(`/standards?code=${encodeURIComponent(x.standard_code)}`);
                        }}
                        title="Open related standard"
                      >
                        <td className={TABLE.cell}>{x.standard_code}</td>
                        <td className={TABLE.cell}>{x.ref}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-slate-500">
              (UI hazır. Backend gelince standart/clauses/controls linkleri buraya bağlanır.)
            </div>
          </Section>

          <Section title="Risks Linked" subtitle="Process-level risk register">
            <div className={TABLE.container}>
              <table className="w-full">
                <thead className={TABLE.headerRow}>
                  <tr>
                    <th className={TABLE.headerCell}>Risk</th>
                    <th className={TABLE.headerCell}>Title</th>
                    <th className={TABLE.headerCell}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {riskLoading ? (
                    <tr className={TABLE.row}>
                      <td className={TABLE.cell} colSpan={3}>
                        <div className="text-sm text-slate-400">Loading...</div>
                      </td>
                    </tr>
                  ) : risksToRender.length === 0 ? (
                    <tr className={TABLE.row}>
                      <td className={TABLE.cell} colSpan={3}>
                        No linked risks.
                      </td>
                    </tr>
                  ) : (
                    risksToRender.map((r) => (
                      <tr
                        key={r.id}
                        className={`${TABLE.row} cursor-pointer`}
                        onClick={() => router.push(`/risks/${r.id}`)}
                        title="Open risk"
                      >
                        <td className={TABLE.cell}>
                          <span className="text-slate-100 font-medium">{r.code || `#${r.id}`}</span>
                        </td>
                        <td className={TABLE.cell}>{r.title}</td>
                        <td className={TABLE.cell}>
                          {r.severity ? (
                            <SeverityBadge
                              label={r.severity}
                              variant={
                                r.severity.toLowerCase().includes("high")
                                  ? "danger"
                                  : r.severity.toLowerCase().includes("medium")
                                  ? "warning"
                                  : "info"
                              }
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="KPIs" subtitle="Define process KPIs (targets & current)">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">KPI List</div>
              {editMode ? (
                <Button variant="secondary" onClick={addKpi}>
                  + Add KPI
                </Button>
              ) : null}
            </div>

            <div className={TABLE.container}>
              <table className="w-full">
                <thead className={TABLE.headerRow}>
                  <tr>
                    <th className={TABLE.headerCell}>Name</th>
                    <th className={TABLE.headerCell}>Formula</th>
                    <th className={TABLE.headerCell}>Target</th>
                    <th className={TABLE.headerCell}>Current</th>
                    <th className={TABLE.headerCell}></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.kpis || []).length === 0 ? (
                    <tr className={TABLE.row}>
                      <td className={TABLE.cell} colSpan={5}>
                        No KPIs.
                      </td>
                    </tr>
                  ) : (
                    data.kpis.map((k, idx) => (
                      <tr key={idx} className={TABLE.row}>
                        <td className={TABLE.cell}>
                          {editMode ? (
                            <Input
                              value={k.name}
                              onChange={(e) => updateKpi(idx, { name: e.target.value })}
                              placeholder="e.g., On-time delivery rate"
                            />
                          ) : (
                            <span className="text-slate-100">{k.name || "-"}</span>
                          )}
                        </td>
                        <td className={TABLE.cell}>
                          {editMode ? (
                            <Input
                              value={k.formula}
                              onChange={(e) => updateKpi(idx, { formula: e.target.value })}
                              placeholder="formula / definition"
                            />
                          ) : (
                            k.formula || "-"
                          )}
                        </td>
                        <td className={TABLE.cell}>
                          {editMode ? (
                            <Input
                              value={k.target}
                              onChange={(e) => updateKpi(idx, { target: e.target.value })}
                              placeholder="target"
                            />
                          ) : (
                            k.target || "-"
                          )}
                        </td>
                        <td className={TABLE.cell}>
                          {editMode ? (
                            <Input
                              value={k.current_value}
                              onChange={(e) => updateKpi(idx, { current_value: e.target.value })}
                              placeholder="current"
                            />
                          ) : (
                            k.current_value || "-"
                          )}
                        </td>
                        <td className={TABLE.cell}>
                          {editMode ? (
                            <button
                              onClick={() => removeKpi(idx)}
                              className="text-sm text-red-300 hover:text-red-200"
                            >
                              Remove
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}

function formatDate(x: string) {
  try {
    const d = new Date(x);
    return d.toLocaleString();
  } catch {
    return x;
  }
}

async function safeText(res: Response) {
  try {
    const t = await res.text();
    return (t || "").slice(0, 400);
  } catch {
    return "";
  }
}
