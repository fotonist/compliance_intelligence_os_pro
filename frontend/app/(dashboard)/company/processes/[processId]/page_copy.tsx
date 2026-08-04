// frontend/app/(dashboard)/company/processes/[processId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

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
  ref: string;
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

type SeverityKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type RiskSummary = {
  linked_count: number;
  open_count: number;
  highest_severity: SeverityKey | null;
  severity_breakdown: Record<SeverityKey, number>;
};

type AuditItem = {
  risk_id: number;
  risk_code?: string | null;
  risk_title: string;
  action: "LINKED" | "UNLINKED" | string;
  user: { id: number; full_name: string };
  created_at?: string | null;
};

type AuditResponse = {
  items: AuditItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

const TYPE_LABEL: Record<ProcessType, string> = {
  core: "Core",
  support: "Support",
  management: "Management",
};

function Badge({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: "neutral" | "success" | "warning" | "info" | "danger";
}) {
  const cls =
    variant === "success"
      ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
      : variant === "warning"
      ? "border-amber-700/40 bg-amber-950/30 text-amber-200"
      : variant === "info"
      ? "border-sky-700/40 bg-sky-950/30 text-sky-200"
      : variant === "danger"
      ? "border-red-700/40 bg-red-950/30 text-red-200"
      : "border-slate-700/40 bg-slate-900 text-slate-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${cls}`}>
      {label}
    </span>
  );
}

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-100">{title}</div>
          {subtitle ? <div className="text-sm text-slate-400">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
      : variant === "secondary"
      ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
      : variant === "danger"
      ? "bg-red-700 hover:bg-red-600 text-white"
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
  if (status === "active") return <Badge label="Active" variant="success" />;
  if (status === "archived") return <Badge label="Archived" variant="info" />;
  return <Badge label="Draft" variant="warning" />;
}

function parseProcessId(p: unknown): number | null {
  const raw = Array.isArray(p) ? p[0] : p;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function severityVariant(sev?: string | null): "neutral" | "success" | "warning" | "info" | "danger" {
  const s = (sev || "").toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "danger";
  if (s.includes("medium")) return "warning";
  if (s.includes("low")) return "success";
  return "info";
}

function severityWeight(sev?: string | null): number {
  const s = (sev || "").toUpperCase();
  if (s.startsWith("CRITICAL")) return 4;
  if (s.startsWith("HIGH")) return 3;
  if (s.startsWith("MEDIUM")) return 2;
  if (s.startsWith("LOW")) return 1;
  return 0;
}

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function heatVariant(score01: number): "success" | "warning" | "info" | "danger" {
  if (score01 >= 0.75) return "danger";
  if (score01 >= 0.5) return "warning";
  if (score01 >= 0.25) return "info";
  return "success";
}

function HeatBar({ summary }: { summary: RiskSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm text-slate-300">Risk Exposure</div>
        <div className="mt-2 h-2 rounded bg-slate-800/70" />
        <div className="mt-2 text-xs text-slate-500">Loading summary...</div>
      </div>
    );
  }

  const open = Number(summary.open_count || 0);
  const b = summary.severity_breakdown || { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const scoreRaw =
    open > 0 ? (b.LOW * 1 + b.MEDIUM * 2 + b.HIGH * 3 + b.CRITICAL * 4) / (open * 4) : 0;
  const score = clamp01(scoreRaw);
  const pct = Math.round(score * 100);
  const variant = heatVariant(score);

  const barCls =
    variant === "danger"
      ? "bg-red-600"
      : variant === "warning"
      ? "bg-amber-500"
      : variant === "info"
      ? "bg-sky-500"
      : "bg-emerald-500";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-200 font-medium">Risk Exposure</div>
          <div className="text-xs text-slate-500">
            {summary.linked_count} linked · {summary.open_count} open
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary.highest_severity ? (
            <Badge label={summary.highest_severity} variant={severityVariant(summary.highest_severity)} />
          ) : (
            <Badge label="NONE" variant="neutral" />
          )}
        </div>
      </div>

      <div className="h-2 rounded bg-slate-800/70 overflow-hidden">
        <div className={`h-2 ${barCls}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>🟢 {b.LOW}</span>
          <span>🟡 {b.MEDIUM}</span>
          <span>🟠 {b.HIGH}</span>
          <span>🔴 {b.CRITICAL}</span>
        </div>
        <div>{pct}%</div>
      </div>
    </div>
  );
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

  // summary
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // audit
  const [activeRiskTab, setActiveRiskTab] = useState<"risks" | "audit">("risks");
  const [auditLoading, setAuditLoading] = useState(false);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState<20 | 50 | 100>(20);

  // production UI states
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRiskId, setLinkRiskId] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [riskUiError, setRiskUiError] = useState<string | null>(null);

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
    refreshLinkedRisks(processId);
    refreshRiskSummary(processId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  useEffect(() => {
    if (!processId) return;
    if (activeRiskTab !== "audit") return;
    refreshAudit(processId, auditPage, auditPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId, activeRiskTab, auditPage, auditPageSize]);

  async function refreshRiskSummary(pid: number) {
    setSummaryLoading(true);
    try {
      const res = await apiFetch(`/company/processes/${pid}/risk-summary`, { method: "GET" });
      if (!res.ok) {
        setRiskSummary(null);
        return;
      }
      const json = await res.json();
      const normalized: RiskSummary = {
        linked_count: Number(json?.linked_count || 0),
        open_count: Number(json?.open_count || 0),
        highest_severity: (json?.highest_severity ?? null) as any,
        severity_breakdown: {
          LOW: Number(json?.severity_breakdown?.LOW || 0),
          MEDIUM: Number(json?.severity_breakdown?.MEDIUM || 0),
          HIGH: Number(json?.severity_breakdown?.HIGH || 0),
          CRITICAL: Number(json?.severity_breakdown?.CRITICAL || 0),
        },
      };
      setRiskSummary(normalized);
    } catch (err) {
      console.error("Failed to load risk summary", err);
      setRiskSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function refreshAudit(pid: number, page: number, pageSize: number) {
    setAuditLoading(true);
    try {
      const res = await apiFetch(
        `/company/processes/${pid}/risk-audit-log?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(
          pageSize
        )}`,
        { method: "GET" }
      );
      if (!res.ok) {
        setAudit(null);
        return;
      }
      const json = await res.json();
      const normalized: AuditResponse = {
        items: Array.isArray(json?.items) ? json.items : [],
        total: Number(json?.total || 0),
        page: Number(json?.page || page),
        page_size: Number(json?.page_size || pageSize),
        total_pages: Number(json?.total_pages || 1),
      };
      setAudit(normalized);
    } catch (err) {
      console.error("Failed to load audit log", err);
      setAudit(null);
    } finally {
      setAuditLoading(false);
    }
  }

  async function refreshLinkedRisks(pid: number) {
    setRiskUiError(null);
    try {
      setRiskLoading(true);
      const res = await apiFetch(`/company/processes/${pid}/risks`, { method: "GET" });
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

  async function load(pid: number) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(`/company/processes/${pid}`, { method: "GET" });
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
      await refreshLinkedRisks(processId);
      await refreshRiskSummary(processId);
      if (activeRiskTab === "audit") {
        await refreshAudit(processId, auditPage, auditPageSize);
      }
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function doLinkRisk() {
    if (!processId) return;

    const rid = Number((linkRiskId || "").trim());
    if (!Number.isFinite(rid) || rid <= 0) {
      setRiskUiError("Enter a valid Risk ID (numeric).");
      return;
    }

    setRiskUiError(null);
    setLinking(true);
    try {
      const res = await apiFetch(`/company/processes/${processId}/risks/${rid}`, { method: "POST" });
      if (!res.ok) {
        const t = await safeText(res);
        // 409 duplicate => UX-friendly message
        if (res.status === 409) {
          setRiskUiError("This risk is already linked to the process.");
        } else if (res.status === 404) {
          setRiskUiError("Process or Risk not found (tenant guard).");
        } else {
          setRiskUiError(t || `Link failed (${res.status})`);
        }
        return;
      }

      setLinkOpen(false);
      setLinkRiskId("");
      await refreshLinkedRisks(processId);
      await refreshRiskSummary(processId);
      if (activeRiskTab === "audit") {
        await refreshAudit(processId, 1, auditPageSize);
        setAuditPage(1);
      }
      await load(processId);
      setNotice("Risk linked.");
    } catch (err: any) {
      setRiskUiError(err?.message || "Link failed.");
    } finally {
      setLinking(false);
    }
  }

  async function doUnlinkRisk(riskId: number) {
    if (!processId) return;
    setRiskUiError(null);
    setUnlinkingId(riskId);
    try {
      const res = await apiFetch(`/company/processes/${processId}/risks/${riskId}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await safeText(res);
        setRiskUiError(t || `Unlink failed (${res.status})`);
        return;
      }
      await refreshLinkedRisks(processId);
      await refreshRiskSummary(processId);
      if (activeRiskTab === "audit") {
        await refreshAudit(processId, 1, auditPageSize);
        setAuditPage(1);
      }
      await load(processId);
      setNotice("Risk unlinked.");
    } catch (err: any) {
      setRiskUiError(err?.message || "Unlink failed.");
    } finally {
      setUnlinkingId(null);
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

  const auditToRender = audit?.items || [];
  const auditTotalPages = audit?.total_pages || 1;
  const auditTotal = audit?.total || 0;

  const auditShowingStart = auditTotal === 0 ? 0 : (auditPage - 1) * auditPageSize + 1;
  const auditShowingEnd = Math.min(auditPage * auditPageSize, auditTotal);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">{headerTitle}</div>
          <div className="text-sm text-slate-400">Process detail — inputs/outputs, standards, risks, KPIs</div>
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
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">Process not found.</div>
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
                  {editMode ? <Button variant="secondary" onClick={() => addTag("inputs")}>+ Add</Button> : null}
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
                        {editMode ? (
                          <Button variant="ghost" onClick={() => removeTag("inputs", x)}>Remove</Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Outputs</div>
                  {editMode ? <Button variant="secondary" onClick={() => addTag("outputs")}>+ Add</Button> : null}
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
                        {editMode ? (
                          <Button variant="ghost" onClick={() => removeTag("outputs", x)}>Remove</Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Related Standards" subtitle="Placeholder links (later: matrix auto-link)">
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="grid grid-cols-2 bg-slate-950/50 text-xs text-slate-400 px-4 py-3">
                <div>Standard</div>
                <div>Reference</div>
              </div>
              {(data.related_standards || []).length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-200">No links yet.</div>
              ) : (
                <div>
                  {data.related_standards.map((x, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-2 px-4 py-3 border-t border-slate-800 hover:bg-slate-950/40 cursor-pointer"
                      onClick={() => router.push(`/standards?code=${encodeURIComponent(x.standard_code)}`)}
                      title="Open related standard"
                    >
                      <div className="text-sm text-slate-100">{x.standard_code}</div>
                      <div className="text-sm text-slate-200">{x.ref}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500">
              (UI hazır. Backend gelince standart/clauses/controls linkleri buraya bağlanır.)
            </div>
          </Section>

          <Section
            title="Risks & Audit"
            subtitle="Process-level risk register + audit trail"
            actions={
              <>
                <Button variant="secondary" onClick={() => setLinkOpen(true)} disabled={!processId || activeRiskTab !== "risks"}>
                  + Link Risk
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!processId) return;
                    if (activeRiskTab === "risks") {
                      refreshLinkedRisks(processId);
                      refreshRiskSummary(processId);
                    } else {
                      refreshAudit(processId, auditPage, auditPageSize);
                    }
                  }}
                  disabled={!processId || (activeRiskTab === "risks" ? riskLoading : auditLoading)}
                >
                  Refresh
                </Button>
              </>
            }
          >
            {riskUiError ? (
              <div className="rounded-lg border border-red-700/40 bg-red-950/40 p-3 text-sm text-red-200">
                {riskUiError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <HeatBar summary={riskSummary} />
                {summaryLoading ? <div className="text-xs text-slate-500 mt-2">Refreshing summary...</div> : null}
              </div>

              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      activeRiskTab === "risks"
                        ? "border-slate-600 bg-slate-800 text-slate-100"
                        : "border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/40"
                    }`}
                    onClick={() => setActiveRiskTab("risks")}
                  >
                    Risks
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      activeRiskTab === "audit"
                        ? "border-slate-600 bg-slate-800 text-slate-100"
                        : "border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/40"
                    }`}
                    onClick={() => {
                      setActiveRiskTab("audit");
                      setAuditPage(1);
                    }}
                  >
                    Audit Log
                  </button>
                </div>

                {activeRiskTab === "risks" ? (
                  <div className="rounded-lg border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-950/50 text-xs text-slate-400 px-4 py-3">
                      <div className="col-span-3">Risk</div>
                      <div className="col-span-6">Title</div>
                      <div className="col-span-2">Severity</div>
                      <div className="col-span-1 text-right"> </div>
                    </div>

                    {riskLoading ? (
                      <div className="px-4 py-4 text-sm text-slate-400">Loading...</div>
                    ) : risksToRender.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-200">No linked risks.</div>
                    ) : (
                      <div>
                        {risksToRender.map((r) => (
                          <div
                            key={r.id}
                            className="grid grid-cols-12 px-4 py-3 border-t border-slate-800 hover:bg-slate-950/40"
                          >
                            <div
                              className="col-span-3 cursor-pointer"
                              onClick={() => router.push(`/risks/${r.id}`)}
                              title="Open risk"
                            >
                              <span className="text-slate-100 font-medium">{r.code || `#${r.id}`}</span>
                            </div>
                            <div className="col-span-6 text-sm text-slate-200">{r.title}</div>
                            <div className="col-span-2">
                              {r.severity ? (
                                <Badge label={r.severity} variant={severityVariant(r.severity)} />
                              ) : (
                                <span className="text-sm text-slate-500">-</span>
                              )}
                            </div>
                            <div className="col-span-1 text-right">
                              <Button
                                variant="ghost"
                                disabled={unlinkingId === r.id}
                                onClick={() => doUnlinkRisk(r.id)}
                              >
                                {unlinkingId === r.id ? "..." : "Unlink"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-950/50 text-xs text-slate-400 px-4 py-3">
                      <div className="col-span-3">Risk</div>
                      <div className="col-span-4">Action</div>
                      <div className="col-span-3">User</div>
                      <div className="col-span-2 text-right">Time</div>
                    </div>

                    {auditLoading ? (
                      <div className="px-4 py-4 text-sm text-slate-400">Loading...</div>
                    ) : auditToRender.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-200">No audit entries.</div>
                    ) : (
                      <div>
                        {auditToRender.map((a, idx) => (
                          <div
                            key={`${a.risk_id}-${a.created_at || idx}`}
                            className="grid grid-cols-12 px-4 py-3 border-t border-slate-800 hover:bg-slate-950/40"
                          >
                            <div className="col-span-3">
                              <div className="text-sm text-slate-100 font-medium">
                                {a.risk_code || `#${a.risk_id}`}
                              </div>
                              <div className="text-xs text-slate-500 truncate">{a.risk_title || ""}</div>
                            </div>
                            <div className="col-span-4">
                              <Badge
                                label={a.action}
                                variant={String(a.action).toUpperCase().includes("UNLINK") ? "danger" : "success"}
                              />
                            </div>
                            <div className="col-span-3 text-sm text-slate-200">{a.user?.full_name || "-"}</div>
                            <div className="col-span-2 text-right text-xs text-slate-400">
                              {a.created_at ? formatDate(a.created_at) : "-"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/30">
                      <div className="text-xs text-slate-400">
                        {auditTotal === 0 ? "Showing 0" : `Showing ${auditShowingStart}–${auditShowingEnd} of ${auditTotal}`}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          disabled={auditPage <= 1 || auditLoading}
                          onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <div className="text-xs text-slate-400">
                          Page {auditPage} / {auditTotalPages}
                        </div>
                        <Button
                          variant="ghost"
                          disabled={auditPage >= auditTotalPages || auditLoading}
                          onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                        >
                          Next
                        </Button>

                        <div className="w-px h-6 bg-slate-800 mx-1" />

                        <div className="text-xs text-slate-400">Rows</div>
                        <Select
                          value={String(auditPageSize)}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const next = (v === 50 ? 50 : v === 100 ? 100 : 20) as 20 | 50 | 100;
                            setAuditPageSize(next);
                            setAuditPage(1);
                          }}
                          className="max-w-[110px]"
                        >
                          <option value="20">20</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {linkOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60" onClick={() => !linking && setLinkOpen(false)} />
                <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-100">Link Risk to Process</div>
                      <div className="text-sm text-slate-400">
                        Enter a Risk ID and link it to this process.
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setLinkOpen(false)} disabled={linking}>
                      Close
                    </Button>
                  </div>

                  <div>
                    <Label>Risk ID</Label>
                    <Input
                      value={linkRiskId}
                      onChange={(e) => setLinkRiskId(e.target.value)}
                      placeholder="e.g. 5"
                      inputMode="numeric"
                    />
                    <div className="text-xs text-slate-500 mt-2">
                      (Next: multi-select risk picker. Şimdilik ID ile link.)
                    </div>
                  </div>

                  {riskUiError ? (
                    <div className="rounded-lg border border-red-700/40 bg-red-950/40 p-3 text-sm text-red-200">
                      {riskUiError}
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setLinkOpen(false)} disabled={linking}>
                      Cancel
                    </Button>
                    <Button onClick={doLinkRisk} disabled={linking}>
                      {linking ? "Linking..." : "Link"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
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

            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-950/50 text-xs text-slate-400 px-4 py-3">
                <div className="col-span-3">Name</div>
                <div className="col-span-4">Formula</div>
                <div className="col-span-2">Target</div>
                <div className="col-span-2">Current</div>
                <div className="col-span-1 text-right"></div>
              </div>

              {(data.kpis || []).length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-200">No KPIs.</div>
              ) : (
                <div>
                  {data.kpis.map((k, idx) => (
                    <div key={idx} className="grid grid-cols-12 px-4 py-3 border-t border-slate-800">
                      <div className="col-span-3">
                        {editMode ? (
                          <Input value={k.name} onChange={(e) => updateKpi(idx, { name: e.target.value })} />
                        ) : (
                          <span className="text-sm text-slate-100">{k.name || "-"}</span>
                        )}
                      </div>
                      <div className="col-span-4">
                        {editMode ? (
                          <Input value={k.formula} onChange={(e) => updateKpi(idx, { formula: e.target.value })} />
                        ) : (
                          <span className="text-sm text-slate-200">{k.formula || "-"}</span>
                        )}
                      </div>
                      <div className="col-span-2">
                        {editMode ? (
                          <Input value={k.target} onChange={(e) => updateKpi(idx, { target: e.target.value })} />
                        ) : (
                          <span className="text-sm text-slate-200">{k.target || "-"}</span>
                        )}
                      </div>
                      <div className="col-span-2">
                        {editMode ? (
                          <Input
                            value={k.current_value}
                            onChange={(e) => updateKpi(idx, { current_value: e.target.value })}
                          />
                        ) : (
                          <span className="text-sm text-slate-200">{k.current_value || "-"}</span>
                        )}
                      </div>
                      <div className="col-span-1 text-right">
                        {editMode ? (
                          <button onClick={() => removeKpi(idx)} className="text-sm text-red-300 hover:text-red-200">
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
