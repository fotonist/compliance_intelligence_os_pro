"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import { X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ================= TYPES ================= */
// (Types kısmı aynen korunmuştur)

type Summary = {
  total_risks: number;
  forecasted_risks: number;
  high_probability_risks: number;
  executive_alerts: number;
  avg_escalation_probability: number;
  avg_expected_score_delta: number;
};

type TopRisk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  escalation_probability_30d: number;
  expected_score_delta: number;
  model_version?: string | null;
  control_id?: number | null;
  control_code?: string | null;
  process_names?: string[];
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

type ExecAlert = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  escalation_probability_30d: number;
  expected_score_delta: number;
  control_code?: string | null;
  process_names: string[];
};

type OverviewResponse = {
  summary: Summary;
  top_risks: TopRisk[];
  top_controls: TopControl[];
  executive_alerts: ExecAlert[];
};

type ControlHealth = {
  summary: {
    linked_risk_count: number;
    high_risk_count: number;
    critical_risk_count: number;
    avg_escalation_probability: number;
    max_escalation_probability: number;
    expected_score_delta_sum: number;
  };
  trend: { date: string; avg_score: number }[];
  top_risks: {
    risk_id: number;
    title: string;
    score: number;
    level: string;
    escalation_probability: number;
    expected_delta: number;
  }[];
  process_distribution: { process: string; risk_count: number }[];
};

/* ================= UTILS ================= */

function fmtPct(x: number) {
  return `${Math.round((x || 0) * 100)}%`;
}
function fmtNum(x: number) {
  return (x || 0).toFixed(2);
}

/* ================= PAGE ================= */

export default function MatrixIntelligencePage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

   async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/company/intelligence/overview");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openControl(id: number) {
    setSelectedControl(id);
    setDrawerLoading(true);
    try {
      const res = await apiFetch(`/company/intelligence/control/${id}`);
      if (!res.ok) throw new Error(await res.text());
      setControlHealth(await res.json());
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedControl(null);
    setControlHealth(null);
  }

  useEffect(() => {
    load();
  }, []);

const [selectedControl, setSelectedControl] = useState<number | null>(null);
const [controlHealth, setControlHealth] = useState<any>(null);
const [drawerLoading, setDrawerLoading] = useState(false);

const [instances, setInstances] = useState<any[]>([]);
const [instanceId, setInstanceId] = useState<number | null>(null);
const [matrixSummary, setMatrixSummary] = useState<any>(null);


useEffect(() => {
  load();
}, []);


useEffect(() => {
  // matrix instances yükle
}, []);


useEffect(() => {
  // matrix summary yükle
}, []);


const summary = data?.summary;

const topRisks = useMemo(
  () => data?.top_risks || [],
  [data]
);

const topControls = useMemo(
  () => data?.top_controls || [],
  [data]
);

const execAlerts = useMemo(
  () => data?.executive_alerts || [],
  [data]
);

  return (
    <div
      style={{
        padding: 28,
        maxWidth: 1200,
        background: "#0f172a",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>
        Matrix Intelligence
      </h1>
      <div style={{ opacity: 0.8, marginBottom: 18 }}>
        AI Risk Forecasting & Predictive Compliance (Tenant-wide)
      </div>

      {/* KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          gap: 12,
        }}
      >
        <Card label="Total Risks" value={String(summary?.total_risks ?? "-")} />
        <Card label="Forecasted" value={String(summary?.forecasted_risks ?? "-")} />
        <Card label="High Prob (≥70%)" value={String(summary?.high_probability_risks ?? "-")} />
        <Card label="Exec Alerts" value={String(summary?.executive_alerts ?? "-")} />
        <Card label="Avg Escalation Prob" value={fmtPct(summary?.avg_escalation_probability || 0)} />
        <Card label="Avg Score Delta" value={fmtNum(summary?.avg_expected_score_delta || 0)} />
      </div>

      {/* EXEC ALERTS */}
      <Section title="Executive Escalation Alerts">
        <SimpleTable
          columns={["Risk", "Score", "Level", "Escalation Prob", "Expected Δ", "Control", "Processes"]}
          rows={execAlerts.map(r => [
            `${r.risk_id} — ${r.title || ""}`,
            r.current_score ?? "",
            r.risk_level ?? "",
            fmtPct(r.escalation_probability_30d),
            fmtNum(r.expected_score_delta),
            r.control_code ?? "",
            (r.process_names ?? []).join(", "),
          ])}
        />
      </Section>

      {/* WATCHLIST */}
      <Section title="Escalation Watchlist (Top Risks)">
        <SimpleTable
          columns={["Risk", "Score", "Level", "Status", "Escalation Prob", "Expected Δ", "Control", "Processes", "Model"]}
          rows={topRisks.map(r => [
            `${r.risk_id} — ${r.title || ""}`,
            r.current_score ?? "",
            r.risk_level ?? "",
            r.status ?? "",
            fmtPct(r.escalation_probability_30d),
            fmtNum(r.expected_score_delta),
            r.control_code ?? "",
            (r.process_names ?? []).join(", "),
            r.model_version ?? "",
          ])}
        />
      </Section>

      {/* TOP CONTROLS */}
      <Section title="AI Priority Controls (Top Controls)">
        <SimpleTable
          columns={["Control", "Risk Count", "Avg Prob", "Max Prob", "Δ Sum", "AI Priority"]}
          rows={topControls.map(c => [
            <span key={c.control_id} style={{ cursor: "pointer", fontWeight: 700 }} onClick={() => openControl(c.control_id)}>
              {c.control_code} — {c.control_title}
            </span>,
            c.risk_count,
            fmtPct(c.avg_escalation_probability),
            fmtPct(c.max_escalation_probability),
            fmtNum(c.expected_score_delta_sum),
            fmtNum(c.ai_priority_score),
          ])}
        />
      </Section>

      {/* DRAWER */}
      {selectedControl && (
        <>
          <div onClick={closeDrawer} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, width: 600, height: "100vh", background: "#1f2937", padding: 24, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>Control Health</h2>
              <X onClick={closeDrawer} style={{ cursor: "pointer" }} />
            </div>

            {drawerLoading && <div>Loading...</div>}

            {controlHealth && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  <MiniCard label="Linked Risks" value={controlHealth.summary.linked_risk_count} />
                  <MiniCard label="High Risks" value={controlHealth.summary.high_risk_count} />
                  <MiniCard label="Critical Risks" value={controlHealth.summary.critical_risk_count} />
                  <MiniCard label="Avg Esc Prob" value={fmtPct(controlHealth.summary.avg_escalation_probability)} />
                </div>

                <div style={{ marginTop: 20 }}>
                  <h3>90 Day Trend</h3>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={controlHealth.trend}>
                        <CartesianGrid stroke="#374151" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="#9ca3af" />
                        <ReTooltip />
                        <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ================= UI ================= */

function Section({ title, children }: any) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <div style={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Card({ label, value }: any) {
  return (
    <div style={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function MiniCard({ label, value }: any) {
  return (
    <div style={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}
function SimpleTable({ columns, rows }: any) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          color: "#fff",
        }}
      >
        <thead>
          <tr>
            {columns.map((c: string) => (
              <th
                key={c}
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  opacity: 0.7,
                  padding: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r: any[], idx: number) => (
            <tr key={idx}>
              {r.map((cell, i) => (
                <td
                  key={i}
                  style={{
                    padding: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 13,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}