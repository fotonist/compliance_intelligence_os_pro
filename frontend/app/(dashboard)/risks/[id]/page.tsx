"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";

import { fetchRiskById, RiskDetail } from "../../../../services/risk";
import RelatedEvidenceTab from "../RelatedEvidenceTab";
import RelatedRisksTab from "../RelatedRisksTab";
import RiskHistoryTab from "../history/RiskHistoryTab";
import RiskHistoryChart from "../history/RiskHistoryChart";
import RiskHeatmapTab from "../RiskHeatmapTab";
import UpdateRiskModal from "../UpdateRiskModal";
import DeleteConfirmModal from "../DeleteConfirmModal";

type PrevSnapshot = {
  score?: number | null;
  likelihood?: number | null;
  impact?: number | null;
  treatment?: string | null;
  status?: string | null;
  action?: string | null;
  changed_at?: string | null;
};

type ChartRow = {
  date: string;
  score: number;
};

type RelatedItem = {
  id?: number;
  title?: string;
  score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  relation_type?: string | null;
  relation_reason?: string | null;
};

type EnterpriseRisk = RiskDetail & {
  process_id?: number | null;
  source_type?: string | null;
  source_id?: number | null;
  control_coverage_status?: string | null;
  appetite_threshold?: number | null;
  appetite_status?: string | null;
  appetite_deviation?: number | null;
  owner?: string | null;
  prev_impact?: number | null;
  prev_likelihood?: number | null;
  previous_score?: number | null;
  prev_risk_level?: string | null;
};

type TabKey = "overview" | "history" | "evidences" | "related_risks";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatDate(value?: string | null) {
  if (!value) return "â€”";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "â€”";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatShortDate(value?: string | null) {
  if (!value) return "â€”";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "â€”";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function normalizeStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeLevel(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function levelTone(level?: string | null) {
  const value = normalizeLevel(level);
  if (value.includes("critical") || value.includes("very high")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700";
  }
  if (value.includes("high")) {
    return "border-orange-500/30 bg-orange-500/10 text-orange-700";
  }
  if (value.includes("medium")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  if (value.includes("low")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  return "border-slate-300 bg-white text-slate-600";
}

function statusTone(status?: string | null) {
  const value = normalizeStatus(status);
  if (["closed", "resolved"].includes(value)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  if (["mitigated", "accepted"].includes(value)) {
    return "border-sky-500/30 bg-emerald-500/10 text-sky-700";
  }
  if (value === "open") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  return "border-slate-300 bg-white text-slate-600";
}

function riskBand(score?: number | null) {
  if (typeof score !== "number") return "UNASSESSED";
  if (score >= 20) return "CRITICAL";
  if (score >= 15) return "HIGH";
  if (score >= 10) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "VERY LOW";
}

function ProgressBar({
  value,
  label,
  tone = "bg-emerald-500",
}: {
  value: number;
  label?: string;
  tone?: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-700">{Math.round(safe)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "text-slate-900",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {icon ? <div className="text-slate-500">{icon}</div> : null}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-500">
              {icon}
            </div>
          ) : null}
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="text-right text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}

function InsightCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-3 text-sm font-medium transition ${
        active
          ? "text-slate-900"
          : "text-slate-500 hover:text-slate-600"
      }`}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-500" />
      ) : null}
    </button>
  );
}

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();

  const riskIdRaw = (params as { id?: string })?.id;
  const riskId = riskIdRaw ? Number(riskIdRaw) : null;

  const [risk, setRisk] = useState<EnterpriseRisk | null>(null);
  const [prev, setPrev] = useState<PrevSnapshot | null>(null);
  const [historyChartRows, setHistoryChartRows] = useState<ChartRow[]>([]);
  const [relatedRisks, setRelatedRisks] = useState<RelatedItem[]>([]);
  const [relatedEvidences, setRelatedEvidences] = useState<RelatedItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [showUpdate, setShowUpdate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token") || localStorage.getItem("token");
  }, []);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const scoreDelta = useMemo(() => {
    if (typeof risk?.score !== "number" || typeof prev?.score !== "number") return null;
    return risk.score - prev.score;
  }, [risk?.score, prev?.score]);

  const velocity = useMemo(() => {
    if (historyChartRows.length < 2) return null;
    const a = historyChartRows[historyChartRows.length - 2];
    const b = historyChartRows[historyChartRows.length - 1];
    return b.score - a.score;
  }, [historyChartRows]);

  const volatility = useMemo(() => {
    if (historyChartRows.length < 3) return null;
    let sum = 0;
    let count = 0;
    for (let i = 1; i < historyChartRows.length; i += 1) {
      const delta = Math.abs(historyChartRows[i].score - historyChartRows[i - 1].score);
      sum += delta;
      count += 1;
    }
    return count ? sum / count : null;
  }, [historyChartRows]);

  const appetiteThreshold =
    typeof risk?.appetite_threshold === "number"
      ? risk.appetite_threshold
      : null;

  const appetiteDeviation =
    typeof risk?.appetite_deviation === "number"
      ? risk.appetite_deviation
      : appetiteThreshold !== null && typeof risk?.score === "number"
      ? risk.score - appetiteThreshold
      : null;

  const appetiteExceeded =
    normalizeStatus(risk?.appetite_status).includes("exceed") ||
    (appetiteDeviation !== null && appetiteDeviation > 0);

  const controlCoverage = useMemo(() => {
    const raw = String(risk?.control_coverage_status ?? "").toLowerCase();
    if (raw.includes("achieved") || raw.includes("effective")) return 100;
    if (raw.includes("partial")) return 50;
    if (raw.includes("not")) return 0;
    return risk?.control_id ? 50 : 0;
  }, [risk?.control_coverage_status, risk?.control_id]);

  const evidenceStrength = useMemo(() => {
    if (!relatedEvidences.length) return 0;
    const approved = relatedEvidences.filter((item) =>
      ["approved", "valid", "accepted"].includes(normalizeStatus(item.status))
    ).length;
    return Math.round((approved / relatedEvidences.length) * 100);
  }, [relatedEvidences]);

  const executiveSummary = useMemo(() => {
    if (!risk) return "";
    const level = riskBand(risk.score);
    const trend =
      velocity === null
        ? "There is no recorded historical movement yet."
        : velocity > 0
        ? `The latest recorded movement increased the score by ${velocity}.`
        : velocity < 0
        ? `The latest recorded movement reduced the score by ${Math.abs(velocity)}.`
        : "The latest recorded movement left the score unchanged.";

    const appetite =
      appetiteExceeded
        ? "The current score is above the defined risk appetite."
        : "No current appetite breach is identified from the available risk data.";

    return `Risk #${risk.id} is currently assessed as ${level} with a score of ${risk.score ?? "â€”"}. ${trend} ${appetite}`;
  }, [risk, velocity, appetiteExceeded]);

  const nextAction = useMemo(() => {
    if (!risk) return "";
    if (appetiteExceeded) {
      return "Prioritise treatment and confirm ownership, target date and control response because the risk is above appetite.";
    }
    if (!risk.control_id) {
      return "Establish a control association so the risk can be evaluated against control effectiveness and evidence.";
    }
    if (!relatedEvidences.length) {
      return "Attach and validate evidence for the associated control before treating the risk as effectively mitigated.";
    }
    return "Review the latest control and evidence posture and confirm that the treatment remains appropriate.";
  }, [risk, appetiteExceeded, relatedEvidences.length]);

  async function loadAll(id: number) {
    setLoading(true);
    setError(null);

    try {
      const loaded = (await fetchRiskById(id)) as EnterpriseRisk;
      setRisk(loaded);

      await Promise.all([
        loadRiskHistory(id),
        loadRelatedRisks(id),
        loadRelatedEvidences(id),
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to load risk detail");
    } finally {
      setLoading(false);
    }
  }

  async function loadRiskHistory(id: number) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${API_BASE}/risks/${id}/history`, {
        headers: authHeaders,
        signal: controller.signal,
      });

      if (!res.ok) {
        setPrev(null);
        setHistoryChartRows([]);
        return;
      }

      const data = await res.json();

      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.rich)
        ? data.rich
        : Array.isArray(data?.items)
        ? data.items
        : [];

      const rows: ChartRow[] = list
        .map((item) => ({
          date: item?.changed_at ? String(item.changed_at) : "",
          score:
            typeof item?.score_new === "number"
              ? item.score_new
              : typeof item?.score_old === "number"
              ? item.score_old
              : null,
        }))
        .filter(
          (item): item is ChartRow =>
            Boolean(item.date) && typeof item.score === "number"
        );

      setHistoryChartRows(rows);

      if (list.length) {
        const previous = list[list.length - 1];
        setPrev({
          likelihood: previous?.likelihood_new ?? previous?.likelihood_old ?? null,
          impact: previous?.impact_new ?? previous?.impact_old ?? null,
          score: previous?.score_new ?? previous?.score_old ?? null,
          treatment: previous?.treatment_new ?? previous?.treatment_old ?? null,
          status: previous?.status_new ?? previous?.status_old ?? null,
          action: previous?.action_new ?? previous?.action_old ?? null,
          changed_at: previous?.changed_at ? String(previous.changed_at) : null,
        });
      } else {
        setPrev(null);
      }
    } catch {
      setPrev(null);
      setHistoryChartRows([]);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadRelatedRisks(id: number) {
    try {
      const res = await fetch(`${API_BASE}/risks/${id}/related`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        setRelatedRisks([]);
        return;
      }
      const data = await res.json();
      setRelatedRisks(Array.isArray(data) ? data : []);
    } catch {
      setRelatedRisks([]);
    }
  }

  async function loadRelatedEvidences(id: number) {
    try {
      const res = await fetch(`${API_BASE}/risks/${id}/related-evidences`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        setRelatedEvidences([]);
        return;
      }
      const data = await res.json();
      setRelatedEvidences(Array.isArray(data) ? data : []);
    } catch {
      setRelatedEvidences([]);
    }
  }

  useEffect(() => {
    if (!riskId || Number.isNaN(riskId)) {
      setError("Invalid risk id");
      setLoading(false);
      return;
    }

    void loadAll(riskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskId]);

  async function handleDelete() {
    if (!risk) return;

    setDeleting(true);

    try {
      const res = await fetch(`${API_BASE}/risks/${risk.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Delete failed");
      }

      router.push("/risks");
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-2/5 rounded bg-white" />
          <div className="h-28 rounded-2xl bg-white" />
          <div className="h-48 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (error || !risk) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <AlertTriangle size={16} />
            Risk Detail Unavailable
          </div>
          <p className="mt-2 text-sm text-slate-500">{error || "Risk not found"}</p>
        </div>
      </div>
    );
  }

  const appetiteLabel = appetiteExceeded
    ? "Above Appetite"
    : risk.appetite_status
    ? String(risk.appetite_status)
    : "Not Assessed";

  return (
    <div className="min-h-full space-y-5 bg-[#f8fafc] p-5 text-slate-900">
      {/* EXECUTIVE HEADER */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Risk #{risk.id}
                </span>
                <Pill className={statusTone(risk.status)}>
                  {risk.status || "Unspecified"}
                </Pill>
                <Pill className={levelTone(risk.risk_level)}>
                  {risk.risk_level || "Unassessed"}
                </Pill>
                {appetiteExceeded ? (
                  <Pill className="border-rose-500/30 bg-rose-500/10 text-rose-700">
                    <AlertTriangle size={11} className="mr-1" />
                    Appetite Breach
                  </Pill>
                ) : null}
              </div>

              <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-slate-900 xl:text-3xl">
                {risk.title}
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                {risk.description || "No risk description has been recorded."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>Last updated: {formatDate(risk.updated_at)}</span>
                <span>Created: {formatShortDate(risk.created_at)}</span>
                {risk.owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound size={13} />
                    Owner: {risk.owner}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setShowUpdate(true)}
                className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-emerald-500"
              >
                Update Risk
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* EXECUTIVE KPI STRIP */}
        <div className="grid grid-cols-2 divide-x divide-slate-200 md:grid-cols-4">
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Risk Score</div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-3xl font-semibold text-slate-900">{risk.score ?? "â€”"}</span>
              <span className="pb-1 text-xs text-slate-500">/ 25</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{riskBand(risk.score)}</div>
          </div>

          <div className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Trend</div>
            <div className="mt-2 flex items-center gap-2">
              {velocity === null ? (
                <CircleDot size={18} className="text-slate-500" />
              ) : velocity > 0 ? (
                <TrendingUp size={18} className="text-rose-400" />
              ) : velocity < 0 ? (
                <TrendingDown size={18} className="text-emerald-400" />
              ) : (
                <CircleDot size={18} className="text-slate-500" />
              )}
              <span className="text-xl font-semibold text-slate-900">
                {velocity === null ? "No baseline" : velocity > 0 ? `+${velocity}` : velocity}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Change vs latest recorded snapshot</div>
          </div>

          <div className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Risk Appetite</div>
            <div className={`mt-2 text-xl font-semibold ${appetiteExceeded ? "text-rose-700" : "text-slate-900"}`}>
              {appetiteLabel}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {appetiteThreshold !== null ? `Threshold ${appetiteThreshold}` : "Threshold not configured"}
            </div>
          </div>

          <div className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Control Coverage</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">
              {risk.control_id ? `${controlCoverage}%` : "Unlinked"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {risk.control_id ? risk.control_coverage_status || "Control association present" : "No control association"}
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap border-b border-slate-200 px-2">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Executive Overview
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            History
          </TabButton>
          <TabButton active={tab === "evidences"} onClick={() => setTab("evidences")}>
            Evidence
          </TabButton>
          <TabButton active={tab === "related_risks"} onClick={() => setTab("related_risks")}>
            Relationships
          </TabButton>
        </div>

        <div className="p-5">
          {tab === "overview" && (
            <div className="space-y-5">
              {/* ASSESSMENT */}
              <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                <Section
                  title="Risk Assessment"
                  subtitle="Current exposure and management context"
                  icon={<ShieldAlert size={17} />}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Likelihood"
                      value={risk.likelihood}
                      hint="Current assessment"
                      icon={<Target size={16} />}
                    />
                    <MetricCard
                      label="Impact"
                      value={risk.impact}
                      hint="Current assessment"
                      icon={<AlertTriangle size={16} />}
                    />
                    <MetricCard
                      label="Residual Score"
                      value={risk.score}
                      hint={`Band: ${riskBand(risk.score)}`}
                      icon={<BarChart3 size={16} />}
                    />
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Inherent vs Current
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-slate-500">Previous score</div>
                          <div className="mt-1 text-lg font-semibold text-slate-700">
                            {risk.previous_score ?? prev?.score ?? "â€”"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Current score</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {risk.score ?? "â€”"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <ProgressBar
                          value={((risk.score ?? 0) / 25) * 100}
                          label="Current exposure"
                          tone={appetiteExceeded ? "bg-rose-500" : "bg-emerald-500"}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Risk Appetite
                      </div>
                      <InfoRow
                        label="Status"
                        value={
                          <span className={appetiteExceeded ? "text-rose-700" : "text-slate-700"}>
                            {appetiteLabel}
                          </span>
                        }
                      />
                      <InfoRow
                        label="Threshold"
                        value={appetiteThreshold ?? "Not configured"}
                      />
                      <InfoRow
                        label="Deviation"
                        value={
                          appetiteDeviation === null
                            ? "â€”"
                            : appetiteDeviation > 0
                            ? `+${appetiteDeviation}`
                            : appetiteDeviation
                        }
                      />
                    </div>
                  </div>
                </Section>

                <Section
                  title="Risk Signals"
                  subtitle="Decision-support indicators"
                  icon={<BarChart3 size={17} />}
                >
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Velocity</span>
                        {velocity !== null ? (
                          velocity > 0 ? (
                            <ArrowUpRight size={15} className="text-rose-400" />
                          ) : (
                            <ArrowDownRight size={15} className="text-emerald-400" />
                          )
                        ) : null}
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">
                        {velocity === null ? "â€”" : velocity > 0 ? `+${velocity}` : velocity}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">Volatility</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">
                        {volatility === null ? "â€”" : volatility.toFixed(1)}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">Average absolute score delta</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">Latest snapshot</div>
                      <div className="mt-1 text-sm font-medium text-slate-700">
                        {prev?.changed_at ? formatDate(prev.changed_at) : "No recorded change"}
                      </div>
                    </div>
                  </div>
                </Section>
              </div>

              {/* TREND + HEATMAP */}
              <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
                <Section
                  title="Risk Trend"
                  subtitle="Recorded risk score movement â€” no synthetic history is generated"
                  icon={<TrendingUp size={17} />}
                >
                  {historyChartRows.length ? (
                    <RiskHistoryChart rows={historyChartRows} />
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/30">
                      <div className="max-w-sm text-center">
                        <Clock3 className="mx-auto text-slate-600" size={28} />
                        <div className="mt-3 text-sm font-medium text-slate-600">
                          No historical movement recorded
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Trend, velocity and volatility will become available after the risk has a recorded assessment change.
                        </p>
                      </div>
                    </div>
                  )}
                </Section>

                <Section
                  title="Risk Position"
                  subtitle="Likelihood Ã— impact"
                  icon={<Target size={17} />}
                >
                  <div className="flex justify-center">
                    <RiskHeatmapTab likelihood={risk.likelihood} impact={risk.impact} />
                  </div>
                </Section>
              </div>

              {/* CONTROL / EVIDENCE / TREATMENT */}
              <div className="grid gap-5 xl:grid-cols-3">
                <Section
                  title="Control Posture"
                  subtitle="Compliance control context"
                  icon={<ShieldCheck size={17} />}
                >
                  <InfoRow label="Control" value={risk.control_id ? `#${risk.control_id}` : "Unlinked"} />
                  <InfoRow label="Coverage" value={risk.control_coverage_status || (risk.control_id ? "Not assessed" : "No control")} />
                  <div className="pt-3">
                    <ProgressBar
                      value={controlCoverage}
                      label="Coverage estimate"
                      tone={controlCoverage >= 80 ? "bg-emerald-500" : controlCoverage >= 50 ? "bg-amber-500" : "bg-rose-500"}
                    />
                  </div>
                </Section>

                <Section
                  title="Evidence Posture"
                  subtitle="Evidence connected to this risk"
                  icon={<FileCheck2 size={17} />}
                >
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-semibold text-slate-900">{relatedEvidences.length}</div>
                      <div className="text-xs text-slate-500">Linked evidence items</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold text-slate-700">{evidenceStrength}%</div>
                      <div className="text-xs text-slate-500">Strength signal</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar
                      value={evidenceStrength}
                      label="Evidence strength"
                      tone={evidenceStrength >= 80 ? "bg-emerald-500" : evidenceStrength >= 50 ? "bg-amber-500" : "bg-rose-500"}
                    />
                  </div>
                </Section>

                <Section
                  title="Treatment"
                  subtitle="Current risk response"
                  icon={<CheckCircle2 size={17} />}
                >
                  <InfoRow label="Strategy" value={risk.treatment || "Not defined"} />
                  <InfoRow label="Status" value={risk.status || "â€”"} />
                  <InfoRow label="Action" value={risk.action || "Not defined"} />
                </Section>
              </div>

              {/* INTELLIGENCE */}
              <Section
                title="Risk Intelligence"
                subtitle="Management interpretation derived from the available risk record"
                icon={<ShieldAlert size={17} />}
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <InsightCard
                    title="Executive Assessment"
                    icon={<BarChart3 size={15} />}
                    body={executiveSummary}
                  />
                  <InsightCard
                    title="Primary Concern"
                    icon={<AlertTriangle size={15} />}
                    body={
                      appetiteExceeded
                        ? "The primary concern is appetite deviation. The risk requires management attention until treatment or control effectiveness reduces the exposure."
                        : risk.control_id
                        ? "The primary concern should be validated through control effectiveness and evidence strength rather than score alone."
                        : "The risk currently lacks a control association, limiting the organisation's ability to demonstrate mitigation effectiveness."
                    }
                  />
                  <InsightCard
                    title="Next Best Action"
                    icon={<ChevronRight size={15} />}
                    body={nextAction}
                  />
                </div>
              </Section>

              {/* TRACEABILITY */}
              <Section
                title="Compliance Traceability"
                subtitle="Where this risk sits in the compliance model"
                icon={<Link2 size={17} />}
              >
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Standard", risk.standard_id ? `#${risk.standard_id}` : "â€”"],
                    ["Requirement", risk.requirement_id ? `#${risk.requirement_id}` : "â€”"],
                    ["Control", risk.control_id ? `#${risk.control_id}` : "Unlinked"],
                    ["Process", risk.process_id ? `#${risk.process_id}` : "â€”"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">
                        {label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-700">{value}</div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-5">
              <Section
                title="Risk History"
                subtitle="Immutable recorded changes to the risk assessment"
                icon={<Clock3 size={17} />}
              >
                <RiskHistoryChart rows={historyChartRows} />
                <div className="mt-5">
                  <RiskHistoryTab riskId={risk.id} />
                </div>
              </Section>
            </div>
          )}

          {tab === "evidences" && (
            <Section
              title="Risk Evidence"
              subtitle="Evidence connected to the risk and its control context"
              icon={<FileCheck2 size={17} />}
            >
              <RelatedEvidenceTab riskId={risk.id} />
            </Section>
          )}

          {tab === "related_risks" && (
            <div className="space-y-5">
              <Section
                title="Risk Relationships"
                subtitle={`${relatedRisks.length} related risk${relatedRisks.length === 1 ? "" : "s"} identified`}
                icon={<Link2 size={17} />}
              >
                <RelatedRisksTab riskId={risk.id} />
              </Section>

              {relatedRisks.length > 0 ? (
                <Section
                  title="Relationship Intelligence"
                  subtitle="Current related-risk context"
                  icon={<ShieldAlert size={17} />}
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {relatedRisks.slice(0, 6).map((item, index) => (
                      <button
                        key={item.id ?? index}
                        type="button"
                        onClick={() => item.id && router.push(`/risks/${item.id}`)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-700">
                              {item.title || `Risk #${item.id}`}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.relation_type || "Related"} Â· {item.relation_reason || "Relationship"}
                            </div>
                          </div>
                          <ChevronRight size={15} className="shrink-0 text-slate-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showUpdate ? (
        <UpdateRiskModal
          risk={risk as any}
          onClose={() => setShowUpdate(false)}
          onUpdated={async () => {
            setShowUpdate(false);
            if (risk.id) await loadAll(risk.id);
          }}
        />
      ) : null}

      {showDelete ? (
        <DeleteConfirmModal
          title="Delete Risk"
          message="Are you sure you want to delete this risk?"
          onClose={() => setShowDelete(false)}
          onConfirm={async () => {
            await handleDelete();
            if (!deleting) setShowDelete(false);
          }}
        />
      ) : null}

      {deleting ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 shadow-xl">
          <Clock3 size={15} className="animate-pulse" />
          Deleting risk...
        </div>
      ) : null}
    </div>
  );
}