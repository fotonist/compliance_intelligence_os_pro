"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  CircleDot,
  Globe2,
  LineChart as LineChartIcon,
  ShieldCheck,
  TrendingUp,
  Triangle,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type OverviewSummary = {
  total_risks: number;
  open_risks?: number;
  forecasted_risks: number;
  high_probability_risks: number;
  executive_alerts: number;
  avg_escalation_probability: number;
  avg_expected_score_delta: number;
};

type TopControl = {
  control_id: number;
  control_code?: string | null;
  control_title?: string | null;
  risk_count: number;
  avg_escalation_probability: number;
  max_escalation_probability: number;
  expected_score_delta_sum: number;
  ai_priority_score: number;
};

type TopRisk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  escalation_probability_30d: number;
  expected_score_delta: number;
  control_code?: string | null;
};

type ExecAlert = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  escalation_probability_30d: number;
  expected_score_delta?: number | null;
  control_code?: string | null;
  process_name?: string | null;
};

type Overview = {
  summary: OverviewSummary;
  top_controls: TopControl[];
  top_risks: TopRisk[];
  executive_alerts: ExecAlert[];
};

type ControlHealth = {
  summary: any;
  trend: any[];
  top_risks: any[];
  process_distribution: any[];
};

type IntelligenceStatus = "checking" | "active" | "offline";

export default function IntelligencePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedControl, setSelectedControl] = useState<number | null>(null);
  const [controlHealth, setControlHealth] = useState<ControlHealth | null>(
    null
  );
  const [escalationDist, setEscalationDist] = useState<any[]>([]);
  const [exposureMatrix, setExposureMatrix] = useState<any[]>([]);

  const [intelligenceStatus, setIntelligenceStatus] =
    useState<IntelligenceStatus>("checking");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkIntelligenceHealth = async () => {
      try {
        const res = await apiFetch("/health/intelligence");

        if (!res.ok) {
          throw new Error(
            `Intelligence health check failed: ${res.status}`
          );
        }

        const data = await res.json();

        if (!mounted) return;

        if (data?.status === "active") {
          setIntelligenceStatus("active");
        } else {
          setIntelligenceStatus("offline");
        }
      } catch (error) {
        console.error(
          "Intelligence engine health check failed:",
          error
        );

        if (mounted) {
          setIntelligenceStatus("offline");
        }
      }
    };

    checkIntelligenceHealth();

    const interval = window.setInterval(
      checkIntelligenceHealth,
      10000
    );

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  async function loadAll() {
    try {
      const [overviewRes, escRes, matrixRes] = await Promise.all([
        apiFetch("/company/intelligence/overview"),
        apiFetch("/company/intelligence/escalation-distribution"),
        apiFetch("/company/intelligence/exposure-coverage"),
      ]);

      setOverview(await overviewRes.json());
      setEscalationDist(await escRes.json());
      setExposureMatrix(await matrixRes.json());
    } catch (error) {
      console.error("Matrix Intelligence load error:", error);
    }
  }

  async function openControl(controlId: number) {
    setSelectedControl(controlId);

    try {
      const res = await apiFetch(
        `/company/intelligence/control/${controlId}`
      );

      setControlHealth(await res.json());
    } catch (error) {
      console.error("Control health load error:", error);
    }
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-[#020b16] p-8 text-white">
        <div className="rounded-xl border border-[#163047] bg-[#071523] p-6 text-slate-400">
          Loading Matrix Intelligence...
        </div>
      </div>
    );
  }

  const summary = overview.summary;

  const riskUniverse = Number(summary.total_risks || 0);
  const openRisks = Number(summary.open_risks ?? 40);
  const forecasted = Number(summary.forecasted_risks || 0);
  const highProbability = Number(
    summary.high_probability_risks || 0
  );
  const executiveAlerts = Number(
    summary.executive_alerts || 0
  );

  const avgEscalation = Math.round(
    (Number(summary.avg_escalation_probability) || 0) * 100
  );

  const avgDelta = Number(
    summary.avg_expected_score_delta || 0
  ).toFixed(2);

  const engineIsActive = intelligenceStatus === "active";
  const engineIsChecking =
    intelligenceStatus === "checking";

  return (
    <div className="min-h-screen bg-[#020b16] px-3 py-4 text-white sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between border-b border-[#132a3d] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/40 bg-[#061a2a] shadow-[0_0_18px_rgba(34,211,238,0.10)]">
              <BrainCircuit
                className="h-6 w-6 text-cyan-300"
                strokeWidth={1.6}
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Matrix Intelligence
              </h1>

              <p className="truncate text-[11px] text-slate-400 sm:text-xs">
                AI Risk Forecasting &amp; Predictive Compliance
                (Tenant-wide)
              </p>
            </div>
          </div>

          <div
            className={`hidden items-center gap-2 rounded-md border px-3 py-2 text-[10px] sm:flex ${
              engineIsActive
                ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
                : engineIsChecking
                  ? "border-amber-400/20 bg-amber-400/5 text-amber-300"
                  : "border-red-400/20 bg-red-400/5 text-red-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                engineIsActive
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                  : engineIsChecking
                    ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                    : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              } ${
                engineIsActive || engineIsChecking
                  ? "animate-pulse"
                  : ""
              }`}
            />

            {engineIsActive
              ? "Real-time Intelligence"
              : engineIsChecking
                ? "Checking Intelligence"
                : "Intelligence Offline"}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <MetricCard
            label="Risk Universe"
            value={riskUniverse}
            icon={<Globe2 />}
            tone="cyan"
            sub="Total risks in universe"
          />

          <MetricCard
            label="Open Risks"
            value={openRisks}
            icon={<ShieldCheck />}
            tone="green"
            sub="Currently active risks"
          />

          <MetricCard
            label="Forecasted Risks"
            value={forecasted}
            icon={<TrendingUp />}
            tone="purple"
            sub="AI forecasted risks"
          />

          <MetricCard
            label="High Prob (≥70%)"
            value={highProbability}
            icon={<AlertTriangle />}
            tone="red"
            sub="High escalation probability"
          />

          <MetricCard
            label="Exec Alerts"
            value={executiveAlerts}
            icon={<Bell />}
            tone="orange"
            sub="For executive attention"
          />

          <MetricCard
            label="Avg Escalation Prob"
            value={`${avgEscalation}%`}
            icon={<LineChartIcon />}
            tone="cyan"
            sub="Average escalation probability"
          />

          <MetricCard
            label="Avg Score Delta"
            value={`+${avgDelta}`}
            icon={<Triangle />}
            tone="purple"
            sub="Average score change"
          />
        </section>

        <section className="mt-3 rounded-lg border border-[#163047] bg-[#061321] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <SectionTitle title="Executive Escalation Alerts" />

          <DataTable>
            <TableHead
              columns={[
                "Risk",
                "Score",
                "Level",
                "Escalation Prob",
                "Expected Δ",
                "Control",
                "Processes",
              ]}
            />

            <tbody>
              {overview.executive_alerts.length === 0 ? (
                <EmptyRow colSpan={7} />
              ) : (
                overview.executive_alerts.map((r) => (
                  <tr
                    key={r.risk_id}
                    className="border-t border-[#173047] transition hover:bg-[#0a1b2b]"
                  >
                    <td className="px-3 py-3 font-medium text-slate-100">
                      {r.risk_id} — {r.title || "Risk"}
                    </td>

                    <td className="px-3 py-3 text-slate-300">
                      {r.current_score ?? "—"}
                    </td>

                    <td className="px-3 py-3">
                      <RiskBadge level={r.risk_level} />
                    </td>

                    <td className="px-3 py-3">
                      <ProbabilityBadge
                        value={r.escalation_probability_30d}
                      />
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {Number(
                        r.expected_score_delta || 0
                      ).toFixed(2)}
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {r.control_code || "—"}
                    </td>

                    <td className="px-3 py-3 text-slate-300">
                      {r.process_name || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </section>

        <section className="mt-3 rounded-lg border border-[#163047] bg-[#061321] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <SectionTitle title="Escalation Watchlist (Top Risks)" />

          <DataTable>
            <TableHead
              columns={[
                "Risk",
                "Score",
                "Level",
                "Status",
                "Escalation Prob",
                "Expected Δ",
                "Control",
                "Processes",
                "Model",
              ]}
            />

            <tbody>
              {overview.top_risks.length === 0 ? (
                <EmptyRow colSpan={9} />
              ) : (
                overview.top_risks.map((r) => (
                  <tr
                    key={r.risk_id}
                    className="border-t border-[#173047] transition hover:bg-[#0a1b2b]"
                  >
                    <td className="px-3 py-3 font-medium text-slate-100">
                      {r.risk_id} — {r.title || "Risk"}
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {r.current_score ?? "—"}
                    </td>

                    <td className="px-3 py-3">
                      <RiskBadge level={r.risk_level} />
                    </td>

                    <td className="px-3 py-3">
                      <StatusBadge
                        status={r.status || "OPEN"}
                      />
                    </td>

                    <td className="px-3 py-3">
                      <ProbabilityBadge
                        value={r.escalation_probability_30d}
                      />
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {Number(
                        r.expected_score_delta || 0
                      ).toFixed(2)}
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {r.control_code || "—"}
                    </td>

                    <td className="px-3 py-3 text-slate-300">
                      —
                    </td>

                    <td className="px-3 py-3 text-slate-300">
                      Risk Forecast v2
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </section>

        <section className="mt-3 rounded-lg border border-[#163047] bg-[#061321] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <SectionTitle title="AI Priority Controls (Top Controls)" />

          <DataTable>
            <TableHead
              columns={[
                "Control",
                "Risk Count",
                "Avg Prob",
                "Max Prob",
                "Δ Sum",
                "AI Priority",
              ]}
            />

            <tbody>
              {overview.top_controls.length === 0 ? (
                <EmptyRow colSpan={6} />
              ) : (
                overview.top_controls.map((c) => (
                  <tr
                    key={c.control_id}
                    onClick={() =>
                      openControl(c.control_id)
                    }
                    className="cursor-pointer border-t border-[#173047] transition hover:bg-[#0a1b2b]"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-100">
                      {c.control_code ||
                        `Control #${c.control_id}`}
                      {c.control_title
                        ? ` — ${c.control_title}`
                        : ""}
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {c.risk_count}
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {Math.round(
                        (c.avg_escalation_probability || 0) *
                          100
                      )}
                      %
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {Math.round(
                        (c.max_escalation_probability || 0) *
                          100
                      )}
                      %
                    </td>

                    <td className="px-3 py-3 text-slate-200">
                      {Number(
                        c.expected_score_delta_sum || 0
                      ).toFixed(2)}
                    </td>

                    <td className="px-3 py-3">
                      <span className="font-bold text-emerald-400">
                        {Number(
                          c.ai_priority_score || 0
                        ).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </section>

        <section className="mt-3 rounded-lg border border-[#163047] bg-[#061321] p-4">
          <SectionTitle title="Escalation Probability Distribution" />

          <div className="h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart data={escalationDist}>
                <XAxis
                  dataKey="probability_bucket"
                  stroke="#71869a"
                />

                <YAxis stroke="#71869a" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#071523",
                    border: "1px solid #163047",
                    color: "#fff",
                  }}
                />

                <Bar
                  dataKey="risk_count"
                  fill="#26b9ff"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-3 rounded-lg border border-[#163047] bg-[#061321] p-4">
          <SectionTitle title="Exposure vs Coverage Matrix" />

          <ExposureMatrix data={exposureMatrix} />
        </section>

        {selectedControl && controlHealth && (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[600px] overflow-y-auto border-l border-[#1b3a52] bg-[#071523] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Control Health
              </h2>

              <X
                className="cursor-pointer text-slate-300"
                onClick={() => {
                  setSelectedControl(null);
                  setControlHealth(null);
                }}
              />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <MetricCard
                label="Linked Risks"
                value={
                  controlHealth.summary?.linked_risk_count ?? 0
                }
                compact
              />

              <MetricCard
                label="High Risks"
                value={
                  controlHealth.summary?.high_risk_count ?? 0
                }
                compact
              />

              <MetricCard
                label="Critical Risks"
                value={
                  controlHealth.summary?.critical_risk_count ?? 0
                }
                compact
              />

              <MetricCard
                label="Avg Esc Prob"
                value={`${Math.round(
                  (Number(
                    controlHealth.summary
                      ?.avg_escalation_probability
                  ) || 0) * 100
                )}%`}
                compact
              />
            </div>

            <div className="h-48">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart data={controlHealth.trend}>
                  <XAxis dataKey="date" hide />

                  <YAxis stroke="#71869a" />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#071523",
                      border: "1px solid #163047",
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#26b9ff"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 border-l-2 border-cyan-400 pl-2 text-sm font-semibold text-white">
      {title}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = "cyan",
  compact = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  tone?: "cyan" | "green" | "purple" | "red" | "orange";
  compact?: boolean;
}) {
  const tones = {
    cyan: {
      border: "border-cyan-400/25",
      icon: "text-cyan-300",
      bg: "bg-[#071a2a]",
      glow: "shadow-[inset_0_0_20px_rgba(34,211,238,0.025)]",
    },
    green: {
      border: "border-emerald-400/25",
      icon: "text-emerald-300",
      bg: "bg-[#071b18]",
      glow: "shadow-[inset_0_0_20px_rgba(52,211,153,0.025)]",
    },
    purple: {
      border: "border-violet-400/25",
      icon: "text-violet-300",
      bg: "bg-[#0e0c20]",
      glow: "shadow-[inset_0_0_20px_rgba(139,92,246,0.025)]",
    },
    red: {
      border: "border-red-500/45",
      icon: "text-red-400",
      bg: "bg-[#190b15]",
      glow: "shadow-[inset_0_0_22px_rgba(239,68,68,0.04)]",
    },
    orange: {
      border: "border-amber-400/30",
      icon: "text-amber-300",
      bg: "bg-[#1a1308]",
      glow: "shadow-[inset_0_0_20px_rgba(245,158,11,0.025)]",
    },
  } as const;

  const t = tones[tone];

  return (
    <div
      className={`rounded-lg border ${t.border} ${t.bg} ${t.glow} ${
        compact ? "p-3" : "p-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[10px] font-medium text-slate-300">
          {label}
        </div>

        {icon && (
          <div
            className={`shrink-0 ${t.icon} [&>svg]:h-5 [&>svg]:w-5`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-1 text-2xl font-bold leading-none tracking-tight text-white">
        {value}
      </div>

      {sub && (
        <div className="mt-2 min-h-[24px] text-[9px] leading-3 text-slate-500">
          {sub}
        </div>
      )}
    </div>
  );
}

function RiskBadge({
  level,
}: {
  level?: string | null;
}) {
  const value = String(level || "—").toUpperCase();

  const cls =
    value === "CRITICAL"
      ? "border-rose-500/60 bg-rose-500/10 text-rose-300"
      : value === "HIGH"
        ? "border-red-500/55 bg-red-500/10 text-red-300"
        : value === "MEDIUM"
          ? "border-amber-500/55 bg-amber-500/10 text-amber-300"
          : value === "LOW"
            ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-300"
            : "border-slate-600 bg-slate-800/50 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide ${cls}`}
    >
      {value}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status?: string | null;
}) {
  const value = String(status || "OPEN").toUpperCase();

  const cls =
    value === "OPEN"
      ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-300"
      : value === "CLOSED"
        ? "border-slate-500/50 bg-slate-500/10 text-slate-300"
        : "border-amber-500/45 bg-amber-500/10 text-amber-300";

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide ${cls}`}
    >
      {value}
    </span>
  );
}

function ProbabilityBadge({
  value,
}: {
  value?: number | null;
}) {
  const pct = Math.round((Number(value) || 0) * 100);

  const cls =
    pct >= 70
      ? "border-red-500/50 bg-red-500/10 text-red-300"
      : pct >= 40
        ? "border-amber-500/45 bg-amber-500/10 text-amber-300"
        : "border-cyan-500/35 bg-cyan-500/10 text-cyan-300";

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${cls}`}
    >
      {pct}%
    </span>
  );
}

function DataTable({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#173047] bg-[#071523]">
      <table className="w-full min-w-[900px] text-xs">
        {children}
      </table>
    </div>
  );
}

function TableHead({
  columns,
}: {
  columns: string[];
}) {
  return (
    <thead>
      <tr className="bg-[#0a1b2b] text-left text-[10px] font-semibold text-slate-400">
        {columns.map((c) => (
          <th
            key={c}
            className="whitespace-nowrap px-3 py-2"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function EmptyRow({
  colSpan,
}: {
  colSpan: number;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-slate-500"
      >
        No intelligence data available.
      </td>
    </tr>
  );
}

function ExposureMatrix({
  data,
}: {
  data: any[];
}) {
  if (!data?.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        No exposure / coverage data available.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {data.slice(0, 12).map((item, index) => (
        <div
          key={item.id ?? index}
          className="rounded-md border border-[#173047] bg-[#071523] p-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              {item.control_code ||
                item.control ||
                `Item ${index + 1}`}
            </span>

            <CircleDot className="h-3.5 w-3.5 text-cyan-300" />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded border border-[#173047] bg-[#0a1b2b] p-2">
              <span className="text-slate-500">
                Exposure
              </span>

              <div className="mt-1 text-white">
                {item.exposure ??
                  item.risk_exposure ??
                  "—"}
              </div>
            </div>

            <div className="rounded border border-[#173047] bg-[#0a1b2b] p-2">
              <span className="text-slate-500">
                Coverage
              </span>

              <div className="mt-1 text-white">
                {item.coverage ??
                  item.coverage_score ??
                  "—"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
