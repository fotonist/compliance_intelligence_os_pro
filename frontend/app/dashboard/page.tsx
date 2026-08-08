// C:\Projects\compliance_app\frontend\app\dashboard\page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import AIInsightBox from "../components/AIInsightBox";
import PremiumFeatureCard from "../components/PremiumFeatureCard";
import { apiFetch } from "../lib/api";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* =====================================================
   TYPES
===================================================== */

type Status = "ok" | "warning" | "critical";

type RejectedTrendItem = {
  date: string;
  rejected_count: number;
};

type MttrTrendItem = {
  date: string;
  avg_hours: number;
};

type MttrDetailRow = {
  evidence_id: number;
  first_rejected_at: string | null;
  first_approved_at: string | null;
  recovery_hours: number;
};

type PendingAging = {
  avg_days: number;
  oldest_days: number;
};

type UeeSummary = {
  tenant_id: number;
  computed_at: string;

  indices: {
    risk: number;
    coverage: number;
    maturity: number;
    evidence: number;
    task_pressure: number;
  };

  unified_exposure_score: number;
  compliance_health_index: number;

  weights?: Record<string, number>;
  components?: Record<string, number>;
  source_stats?: Record<string, any>;
  warnings?: string[];
};

type KpiStatusMeta = {
  exposure_status?: Status;
  health_status?: Status;
};

type AIInsight = {
  summary: string;
  root_causes: string[];
  warnings: string[];
  actions: string[];
};

type Toast = {
  id: number;
  status: Status;
  message: string;
};

/* ===========================================
   KPI INFO (ICON + COLLAPSIBLE)  ✅ NEW
=========================================== */

function KpiInfo({
  title = "Explanation",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-2"
        aria-expanded={open}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 bg-slate-900/40 text-slate-200">
          i
        </span>
        <span>{title}</span>
        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-300 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

/* ===========================================
   API
=========================================== */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

/* ===========================================
   TOOLTIP (DB + FORMULA)
=========================================== */

function DbTooltip({
  active,
  payload,
  title,
  total,
  formula,
}: {
  active?: boolean;
  payload?: any[];
  title: string;
  total?: number;
  formula: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0];
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;

  return (
    <div className="rounded-md border border-slate-600 bg-slate-900/95 p-3 text-sm shadow-lg">
      <div className="font-semibold text-slate-100 mb-1">{title}</div>
      <div className="text-slate-300 space-y-1">
        <div>
          <b>{name}:</b> {value}
        </div>
        {total !== undefined && (
          <div>
            <b>Total:</b> {total}
          </div>
        )}
        {pct !== null && (
          <div>
            <b>Rate:</b> {pct}%
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-slate-400">
        {formula}
      </div>
    </div>
  );
}

/* ===========================================
   HELPERS
=========================================== */

function fmtHours(hours: number) {
  if (!Number.isFinite(hours)) return "-";
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function bannerStyle(status: Status) {
  switch (status) {
    case "critical":
      return "border-red-500 bg-red-950/40 text-red-200";
    case "warning":
      return "border-yellow-500 bg-yellow-950/40 text-yellow-200";
    default:
      return "border-green-500 bg-green-950/40 text-green-200";
  }
}

function bannerText(meta: KpiStatusMeta) {
  if (meta.exposure_status === "critical") {
    return "Unified exposure is CRITICAL. Immediate action is required.";
  }
  if (meta.health_status === "critical") {
    return "Compliance health is CRITICAL. Immediate action is required.";
  }
  if (meta.exposure_status === "warning") {
    return "Unified exposure is in WARNING zone. Monitoring and remediation are recommended.";
  }
  if (meta.health_status === "warning") {
    return "Compliance health is in WARNING zone. Monitoring and remediation are recommended.";
  }
  return "All key compliance indicators are within acceptable thresholds.";
}

function toastStyle(status: Status) {
  switch (status) {
    case "critical":
      return "border-red-500 bg-red-950/90 text-red-100";
    case "warning":
      return "border-yellow-500 bg-yellow-950/90 text-yellow-100";
    default:
      return "border-green-500 bg-green-950/90 text-green-100";
  }
}

function safeNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ===========================================
   PAGE
=========================================== */

export default function DashboardPage() {
  const [summary, setSummary] = useState<UeeSummary | null>(null);
  const [statusMeta, setStatusMeta] = useState<KpiStatusMeta>({});

  const [rejectedTrend, setRejectedTrend] = useState<RejectedTrendItem[]>([]);
  const [mttrTrend, setMttrTrend] = useState<MttrTrendItem[]>([]);
  const [mttrDetails, setMttrDetails] = useState<MttrDetailRow[]>([]);
  const [pendingAging, setPendingAging] = useState<PendingAging | null>(null);
  const [premiumModules, setPremiumModules] = useState<Record<string, boolean>>({});
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  /* ===== TOAST STATE ===== */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const lastStatusRef = useRef<KpiStatusMeta>({});

  function pushToast(status: Status, message: string) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, status, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }

  /* ================= FETCH ================= */

  useEffect(() => {
   const token =
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token");

const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

fetch(`${API_URL}/kpi/summary`, { headers })
  .then((r) => r.json())
  .then((data) => setSummary(data));

fetch(`${API_URL}/kpi/summary/status`, { headers })
  .then((r) => r.json())
  .then((r) => setStatusMeta(r?.meta || {}));

apiFetch("/company/license/modules")
  .then((r) => r.json())
  .then((data) => {
    setPremiumModules(data || {});
  })
  .catch((err) => {
    console.error("License modules fetch failed:", err);
    setPremiumModules({});
  });
    fetch(`${API_URL}/kpi/operations/rejected-trend?range=30`, { headers })
      .then((r) => r.json())
      .then((rows) => setRejectedTrend(Array.isArray(rows) ? rows : []));

    fetch(`${API_URL}/kpi/operations/mttr-trend?range=30`, { headers })
      .then((r) => r.json())
      .then((rows) => setMttrTrend(Array.isArray(rows) ? rows : []));

    fetch(`${API_URL}/kpi/operations/mttr-details?limit=25`, { headers })
      .then((r) => r.json())
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        // Backend keys may be: rejected_at / approved_at
        const mapped: MttrDetailRow[] = arr.map((x: any) => ({
          evidence_id: safeNum(x.evidence_id),
          first_rejected_at: (x.first_rejected_at ?? x.rejected_at ?? null) as
            | string
            | null,
          first_approved_at: (x.first_approved_at ?? x.approved_at ?? null) as
            | string
            | null,
          recovery_hours: safeNum(x.recovery_hours),
        }));
        setMttrDetails(mapped);
      });

    fetch(`${API_URL}/kpi/operations/pending-aging`, { headers })
      .then((r) => r.json())
      .then((x) => {
        if (!x || typeof x !== "object") return setPendingAging(null);
        setPendingAging({
          avg_days: safeNum((x as any).avg_days),
          oldest_days: safeNum((x as any).oldest_days),
        });
      });
  }, []);

  /* ===== TOAST TRIGGERS ===== */
  useEffect(() => {
    const prev = lastStatusRef.current;

    if (
      statusMeta.exposure_status === "critical" &&
      prev.exposure_status !== "critical"
    ) {
      pushToast("critical", "Unified exposure is CRITICAL. Immediate action required.");
    }
    if (
      statusMeta.health_status === "critical" &&
      prev.health_status !== "critical"
    ) {
      pushToast("critical", "Compliance health is CRITICAL. Immediate action required.");
    }
    if (
      statusMeta.exposure_status === "warning" &&
      prev.exposure_status !== "warning"
    ) {
      pushToast("warning", "Unified exposure is in WARNING zone.");
    }
    if (
      statusMeta.health_status === "warning" &&
      prev.health_status !== "warning"
    ) {
      pushToast("warning", "Compliance health is in WARNING zone.");
    }

    lastStatusRef.current = statusMeta;
  }, [statusMeta]);

  useEffect(() => {
    if (!summary) return;

    setAiLoading(true);
    fetch(`${API_URL}/ai/dashboard/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_days: 30,
        uee: summary,
        operations: {
          rejected_trend: rejectedTrend,
          mttr_trend: mttrTrend,
          pending_aging: pendingAging,
        },
        meta: statusMeta,
      }),
    })
      .then((r) => r.json())
      .then(setAiInsight)
      .finally(() => setAiLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, statusMeta]);

  if (!summary) return <div className="p-6 text-slate-400">Loading…</div>;

  const overallStatus: Status =
    statusMeta.exposure_status === "critical" ||
    statusMeta.health_status === "critical"
      ? "critical"
      : statusMeta.exposure_status === "warning" ||
        statusMeta.health_status === "warning"
      ? "warning"
      : "ok";

  /* ================= DATA ================= */

  const STATUS_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#a855f7"];

  const pressureBreakdownData = [
    { name: "Risk", value: safeNum(summary.indices?.risk) },
    { name: "Coverage", value: safeNum(summary.indices?.coverage) },
    { name: "Maturity", value: safeNum(summary.indices?.maturity) },
    { name: "Evidence", value: safeNum(summary.indices?.evidence) },
    { name: "Task Pressure", value: safeNum(summary.indices?.task_pressure) },
  ];

  const pendingAgingData = pendingAging
    ? [
        { name: "Avg Days", value: pendingAging.avg_days },
        { name: "Oldest Days", value: pendingAging.oldest_days },
      ]
    : [];

  const avgMttrHours =
    mttrTrend.length > 0
      ? mttrTrend.reduce((acc, x) => acc + safeNum(x.avg_hours), 0) /
        mttrTrend.length
      : 0;

  return (
    <div className="p-6 space-y-10">
      {/* ===== TOASTS ===== */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded border p-3 text-sm shadow-lg ${toastStyle(
              t.status
            )}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* STATUS BANNER */}
      <div className={`rounded border p-3 text-sm ${bannerStyle(overallStatus)}`}>
        {bannerText(statusMeta)}
      </div>
	  {/* DEMO WORKSPACE */}
<div
  className="
    rounded
    border
    border-indigo-500/30
    bg-indigo-500/10
    p-4
  "
>
  <div className="flex items-center justify-between">

    <div>
      <div className="text-sm font-semibold text-indigo-300">
        Demo Workspace
      </div>

      <div className="text-xs text-slate-400 mt-1">
        Core compliance monitoring capabilities are active.
        Advanced intelligence modules require activation.
      </div>
    </div>


    <div
      className="
        text-xs
        px-3
        py-1
        rounded-full
        bg-indigo-500/20
        text-indigo-300
      "
    >
      TRIAL
    </div>

  </div>
</div>

      {/* AI INSIGHT */}
      <div className="border border-indigo-500 bg-indigo-950/40 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-indigo-300 mb-2">
          AI Dashboard Insights
        </div>
        <AIInsightBox insight={aiInsight} loading={aiLoading} />
      </div>
	  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

  <PremiumFeatureCard
  feature="aiRiskForecast"
  title="AI Risk Forecasting"
  description="Predictive compliance intelligence and executive risk forecasting."
  features={[
    "30-day risk escalation prediction",
    "AI priority scoring",
    "Executive alerts",
  ]}
  active={premiumModules["AI_RISK_FORECAST"]}
/>


 <PremiumFeatureCard
  feature="evidenceIntelligence"
  title="Evidence Intelligence"
  description="Advanced evidence analysis and audit readiness automation."
  features={[
    "Evidence quality scoring",
    "Weak evidence detection",
    "Audit readiness analysis",
  ]}
  active={premiumModules["EVIDENCE_INTELLIGENCE"]}
/>


  <PremiumFeatureCard
  feature="operationalIntelligence"
  title="Operational Intelligence"
  description="Advanced operational analytics for continuous improvement."
  features={[
    "MTTR analytics",
    "SLA risk prediction",
    "Recovery optimization",
  ]}
  active={premiumModules["OPERATIONAL_INTELLIGENCE"]}
/>

</div>

      {/* KPI CARDS (UEE) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Unified Exposure Score</div>
          </div>

          <KpiInfo title="How is Unified Exposure calculated?">
            <div>Source: UEE summary endpoint.</div>
            <div>
              Formula: weighted average of indices (risk, coverage, maturity,
              evidence, task pressure).
            </div>
            <div>Interpretation (lower is better): 0–25 ok, 26–50 warning, 51+ critical.</div>
          </KpiInfo>

          <div className="text-2xl font-semibold text-red-200">
            {safeNum(summary.unified_exposure_score).toFixed(1)}
          </div>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <div className="text-sm text-slate-400">Compliance Health Index</div>

          <KpiInfo title="What is Compliance Health Index?">
            <div>Source: UEE summary endpoint.</div>
            <div>Formula: 100 - unified_exposure_score.</div>
            <div>Interpretation (higher is better): 75+ ok, 50–74 warning, &lt;50 critical.</div>
          </KpiInfo>

          <div className="text-2xl font-semibold text-green-200">
            {safeNum(summary.compliance_health_index).toFixed(1)}
          </div>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <div className="text-sm text-slate-400">Risk Pressure</div>

          <KpiInfo title="What is Risk Pressure?">
            <div>Normalized 0..100 pressure score coming from UEE risk index.</div>
            <div>Higher means risk posture is contributing more to exposure.</div>
          </KpiInfo>

          <div className="text-2xl font-semibold">
            {safeNum(summary.indices?.risk).toFixed(1)}
          </div>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <div className="text-sm text-slate-400">Average MTTR (Trend Avg)</div>

          <KpiInfo title="How is Average MTTR computed here?">
            <div>Client-side average of mttrTrend points.</div>
            <div>Backend: /kpi/operations/mttr-trend (avg(approved_at - rejected_at) hours).</div>
          </KpiInfo>

          <div className="text-2xl font-semibold">{fmtHours(avgMttrHours)}</div>
        </div>
      </div>

      {/* 1) UEE Pressure Breakdown */}
      <section className="bg-slate-800 rounded p-6">
       <h3 className="font-semibold mb-1">
  Compliance Exposure Drivers
</h3>

<div className="text-xs text-slate-400 mb-4">
  Key factors influencing current compliance exposure.
</div>

        <p className="text-xs text-slate-400 mb-2">
          Strategic posture components (0..100). Higher = more pressure.
        </p>
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pressureBreakdownData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
              >
                {pressureBreakdownData.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <DbTooltip
                    title="UEE Pressure Breakdown"
                    formula="UEE indices (0..100): higher means higher pressure"
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

     
     {/* PREMIUM - Evidence Analytics */}

<section className="bg-slate-800 rounded p-6">

  <div className="mb-4 text-sm text-slate-400">
    Advanced Analytics
  </div>

 <PremiumFeatureCard
  feature="evidenceIntelligence"
  title="Evidence Lifecycle Analytics"
  description="Advanced evidence monitoring and audit readiness intelligence."
  features={[
    "Evidence rejection trend analysis",
    "Evidence recovery performance",
    "Audit readiness scoring",
  ]}
  active={premiumModules["EVIDENCE_INTELLIGENCE"]}
/>

</section>

      {/* 3) Pending Aging (SLA) */}
     <section className="bg-slate-800 rounded p-6">

  <PremiumFeatureCard
  feature="operationalIntelligence"
  title="SLA Monitoring Intelligence"
  description="Continuous monitoring of compliance workload and SLA risks."
  features={[
    "Pending item aging analysis",
    "SLA breach prediction",
    "Ownership escalation",
  ]}
  active={premiumModules["OPERATIONAL_INTELLIGENCE"]}
/>

</section>

      {/* 4) MTTR Trend */}
    <section className="bg-slate-800 rounded p-6">

  <PremiumFeatureCard
    feature="operationalIntelligence"
    title="Operational Recovery Intelligence"
    description="Advanced operational performance analytics."
    features={[
      "MTTR analytics",
      "Recovery optimization",
      "Process improvement insights",
    ]}
	active={premiumModules["OPERATIONAL_INTELLIGENCE"]}
  />

</section>

      {/* 5) MTTR TABLE */}
     <section className="bg-slate-800 rounded p-6">

  <PremiumFeatureCard
     feature="executiveAnalytics"
     title="Executive Analytics Center"
     description="Board-level compliance intelligence and predictive analytics."
     features={[
      "Executive dashboards",
      "Risk forecasting",
      "Strategic recommendations",
    ]}
	active={premiumModules["EXECUTIVE_ANALYTICS"]}
  />

</section>
    </div>
  );
}