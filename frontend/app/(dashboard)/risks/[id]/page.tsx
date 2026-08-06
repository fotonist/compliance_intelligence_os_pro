"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchRiskById, RiskDetail } from "../../../../services/risk";
import RelatedEvidenceTab from "../RelatedEvidenceTab";
import RelatedRisksTab from "../RelatedRisksTab";
import RiskHistoryTab from "../history/RiskHistoryTab";
import RiskHistoryChart from "../history/RiskHistoryChart";
import RiskHeatmapTab from "../RiskHeatmapTab";

import UpdateRiskModal from "../UpdateRiskModal";
import DeleteConfirmModal from "../DeleteConfirmModal";

/* ================= TYPES ================= */


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

type TabKey = "overview" | "history" | "evidences" | "related_risks";

const API_BASE = "http://localhost:8000";

/* ================= PAGE ================= */

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();

  const riskIdRaw = (params as { id?: string })?.id;
  const riskId = riskIdRaw ? Number(riskIdRaw) : null;

  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [prev, setPrev] = useState<PrevSnapshot | null>(null);
  const [historyChartRows, setHistoryChartRows] = useState<ChartRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("overview");

  const [showUpdate, setShowUpdate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ================= DERIVED (HYBRID OVERVIEW) ================= */

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token") || localStorage.getItem("token");
  }, []);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [token]);

  const { statusTone, levelTone } = useMemo(() => {
    const s = (risk?.status || "").toLowerCase();
    const lvl = (risk?.risk_level || "").toLowerCase();

    const statusTone =
      s === "closed" || s === "resolved"
        ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
        : s === "accepted"
        ? "bg-sky-500/10 text-sky-200 border-sky-500/30"
        : s === "mitigated"
        ? "bg-teal-500/10 text-teal-200 border-teal-500/30"
        : s === "open"
        ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
        : "bg-slate-800/60 text-slate-200 border-slate-700";

    const levelTone =
      lvl.includes("critical") || lvl.includes("very high")
        ? "bg-rose-500/10 text-rose-200 border-rose-500/30"
        : lvl.includes("high")
        ? "bg-orange-500/10 text-orange-200 border-orange-500/30"
        : lvl.includes("medium")
        ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
        : lvl.includes("low")
        ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
        : "bg-slate-800/60 text-slate-200 border-slate-700";

    return { statusTone, levelTone };
  }, [risk?.status, risk?.risk_level]);

  const scoreDelta = useMemo(() => {
    const cur = typeof risk?.score === "number" ? risk.score: null;
    const prevScore = typeof prev?.score === "number" ? prev.score: null;
    if (cur === null || prevScore === null) return null;
    return cur - prevScore;
  }, [risk?.score, prev?.score]);

  const velocityLabel = useMemo(() => {
    if (!historyChartRows || historyChartRows.length < 2) return "-";
    const last = historyChartRows[historyChartRows.length - 1];
    const before = historyChartRows[historyChartRows.length - 2];
    if (!last || !before) return "-";
    const d = last.score - before.score;
    if (d > 0) return `↑ +${d}`;
    if (d < 0) return `↓ ${d}`;
    return "→ 0";
  }, [historyChartRows]);

  const volatilityLabel = useMemo(() => {
    if (!historyChartRows || historyChartRows.length < 3) return "-";
    let sum = 0;
    let count = 0;
    for (let i = 1; i < historyChartRows.length; i++) {
      const a = historyChartRows[i - 1]?.score;
      const b = historyChartRows[i]?.score;
      if (typeof a === "number" && typeof b === "number") {
        sum += Math.abs(b - a);
        count += 1;
      }
    }
    if (count === 0) return "-";
    const avg = sum / count;
    if (avg >= 6) return "High";
    if (avg >= 3) return "Medium";
    return "Low";
  }, [historyChartRows]);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (!riskId || Number.isNaN(riskId)) {
      setError("Invalid risk id");
      setLoading(false);
      return;
    }
    loadAll(riskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskId]);

  async function loadAll(id: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await loadRisk(id);
      if (r?.id) await loadRiskHistory(r.id);
    } catch {
      setError("Failed to load risk detail");
    } finally {
      setLoading(false);
    }
  }

  async function loadRisk(id: number): Promise<RiskDetail | null> {
    const data = await fetchRiskById(id);
    setRisk(data);
    return data;
  }

  async function loadRiskHistory(id: number) {
    const res = await fetch(`${API_BASE}/risks/${id}/history`, {
      headers: authHeaders,
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

    if (list.length === 0) {
      setPrev(null);
      setHistoryChartRows([]);
      return;
    }

    const rows: ChartRow[] = [];
    for (const it of list) {
      const date = it.changed_at;
      const score =
        typeof it.score_new === "number"
          ? it.score_new
          : typeof it.score_old === "number"
          ? it.score_old
          : null;

      if (date && typeof score === "number") {
        rows.push({ date: String(date), score });
      }
    }
    setHistoryChartRows(rows);

    if (list.length >= 2) {
      const prevItem = list[list.length - 2];
      setPrev({
        likelihood: prevItem.likelihood_new ?? null,
        impact: prevItem.impact_new ?? null,
        score: prevItem.score_new ?? null,
        treatment: prevItem.treatment_new ?? null,
        status: prevItem.status_new ?? null,
        action: prevItem.action_new ?? null,
        changed_at: prevItem.changed_at ? String(prevItem.changed_at) : null,
      });
    } else {
      setPrev(null);
    }
  }

  /* ================= ACTIONS ================= */

  async function handleDelete() {
    if (!risk) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/risks/${risk.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/risks");
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  /* ================= RENDER ================= */

  if (loading) return <div className="p-4 text-slate-300">Loading…</div>;
  if (error || !risk)
    return <div className="p-4 text-red-400">{error || "Not found"}</div>;

  return (
    <div className="p-5 space-y-6">
      {/* HEADER (Hybrid: clean top) */}
      <div className="border border-slate-800 rounded-xl bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400">Risk</span>
              <span className="text-xs text-slate-300">#{risk.id}</span>
              <span className={["text-xs px-2 py-0.5 rounded border", statusTone].join(" ")}>
                {risk.status ?? "—"}
              </span>
              <span className={["text-xs px-2 py-0.5 rounded border", levelTone].join(" ")}>
                {risk.risk_level}
              </span>
              {typeof scoreDelta === "number" && (
                <span
                  className={[
                    "text-xs px-2 py-0.5 rounded border",
                    scoreDelta > 0
                      ? "bg-rose-500/10 text-rose-200 border-rose-500/30"
                      : scoreDelta < 0
                      ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                      : "bg-slate-800/60 text-slate-200 border-slate-700",
                  ].join(" ")}
                >
                  {scoreDelta > 0 ? `↑ +${scoreDelta}` : scoreDelta < 0 ? `↓ ${scoreDelta}` : "→ 0"}
                </span>
              )}
            </div>

            <h1 className="text-xl font-semibold text-white truncate">{risk.title}</h1>
            {risk.description ? (
              <p className="mt-2 text-sm text-slate-300 leading-relaxed line-clamp-3">
                {risk.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No description</p>
            )}
          </div>

          {/* UPDATE / DELETE */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpdate(true)}
              className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              Update
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-sm border border-slate-700"
            >
              Delete
            </button>
          </div>
        </div>

        {/* AI Status Strip (Hybrid: quick signal row) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <StripStat label="Likelihood" value={risk.likelihood} />
          <StripStat label="Impact" value={risk.impact} />
          <StripStat label="Score" value={risk.score} />
          <StripStat label="Velocity" value={velocityLabel} />
        </div>
      </div>

      {/* TABS (Hybrid: fewer tabs) */}
      <div className="border border-slate-800 rounded-xl bg-slate-950">
        <div className="flex flex-wrap gap-2 border-b border-slate-800 px-4 pt-3">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            History
          </TabButton>
          <TabButton active={tab === "evidences"} onClick={() => setTab("evidences")}>
            Evidences
          </TabButton>
          <TabButton active={tab === "related_risks"} onClick={() => setTab("related_risks")}>
            Related
          </TabButton>
        </div>

        <div className="p-4">
          {tab === "overview" && (
            <div className="space-y-6">
              {/* ANALYTICS GRID (Hybrid: data below clean header) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Panel title="Trend">
                  <RiskHistoryChart rows={historyChartRows} />
                </Panel>

                <Panel title="Risk Signals">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SignalCard
                      title="Velocity"
                      value={velocityLabel}
                      hint="Change vs last snapshot"
                    />
                    <SignalCard
                      title="Volatility"
                      value={volatilityLabel}
                      hint="Avg abs score delta"
                    />
                    <SignalCard
                      title="Control Gap"
                      value={risk.control_id ? "Linked" : "Unlinked"}
                      hint="Control association"
                    />
                  </div>

                  <div className="mt-4">
                    <RiskHeatmapTab likelihood={risk.likelihood} impact={risk.impact} />
                  </div>
                </Panel>
              </div>

              {/* AI INSIGHT PANEL */}
              <div className="border border-slate-800 rounded-xl bg-slate-900 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-white">Risk Intelligence</div>
                  <div className="text-xs text-slate-400">
                    Snapshot: {prev?.changed_at ? new Date(prev.changed_at).toLocaleString() : "—"}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <InsightBlock
                    title="Executive Summary"
                    body={buildExecutiveSummary(risk, prev, scoreDelta)}
                  />
                  <InsightBlock
                    title="AI Recommendation"
                    body={buildRecommendation(risk, scoreDelta)}
                  />
                  <InsightBlock
                    title="Next Best Actions"
                    body={buildNextActions(risk)}
                  />
                </div>

                {/* Current vs Previous (compact) */}
                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Box title="Current" right={risk.risk_level}>
                    <Stat label="Likelihood" value={risk.likelihood} />
                    <Stat label="Impact" value={risk.impact} />
                    <Stat label="Score" value={risk.score} />
                    <Stat label="Treatment" value={risk.treatment ?? "-"} />
                    <Stat label="Status" value={risk.status ?? "-"} />
                    <Stat label="Action" value={risk.action ?? "-"} />
                  </Box>

                  <Box
                    title="Previous"
                    right={prev?.changed_at ? new Date(prev.changed_at).toLocaleString() : "-"}
                  >
                    <Stat label="Likelihood" value={prev?.likelihood ?? "-"} />
                    <Stat label="Impact" value={prev?.impact ?? "-"} />
                    <Stat label="Score" value={prev?.score ?? "-"} />
                    <Stat label="Treatment" value={prev?.treatment ?? "-"} />
                    <Stat label="Status" value={prev?.status ?? "-"} />
                    <Stat label="Action" value={prev?.action ?? "-"} />
                  </Box>
                </div>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-6">
              <RiskHistoryChart rows={historyChartRows} />
              <RiskHistoryTab riskId={risk.id} />
            </div>
          )}

          {tab === "evidences" && <RelatedEvidenceTab riskId={risk.id} />}

          {tab === "related_risks" && <RelatedRisksTab riskId={risk.id} />}
        </div>
      </div>

      {showUpdate && (
        <UpdateRiskModal
          risk={risk as any}
          onClose={() => setShowUpdate(false)}
          onUpdated={async () => {
            setShowUpdate(false);
            await loadAll(risk.id);
          }}
        />
      )}

      {showDelete && (
        <DeleteConfirmModal
          title="Delete Risk"
          message="Are you sure you want to delete this risk?"
          onClose={() => setShowDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 text-sm">
            Deleting…
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= UX HELPERS ================= */

function StripStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900 px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-white">{String(value)}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900 p-4">
      <div className="text-sm font-semibold text-white mb-3">{title}</div>
      {children}
    </div>
  );
}

function SignalCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-950 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">{title}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function InsightBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-950 p-3">
      <div className="text-xs text-slate-400 mb-2">{title}</div>
      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
        {body}
      </div>
    </div>
  );
}

function Box({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        {right && <div className="text-xs text-slate-300">{right}</div>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-slate-800 rounded-md px-3 py-2 bg-slate-900">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-white">{value}</div>
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
      onClick={onClick}
      className={[
        "px-3 py-2 text-sm rounded-t",
        active ? "text-white border-b-2 border-blue-500" : "text-slate-300 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ================= AI TEXT (LIGHTWEIGHT PLACEHOLDERS) ================= */

function buildExecutiveSummary(risk: RiskDetail, prev: PrevSnapshot | null, scoreDelta: number | null) {
  const parts: string[] = [];
  parts.push(`Risk score is ${risk.score} (${risk.risk_level}).`);
  if (typeof scoreDelta === "number") {
    parts.push(
      scoreDelta > 0
        ? `Score increased by ${scoreDelta} since last snapshot.`
        : scoreDelta < 0
        ? `Score decreased by ${Math.abs(scoreDelta)} since last snapshot.`
        : `Score unchanged since last snapshot.`
    );
  } else if (!prev) {
    parts.push("No prior snapshot available for comparison.");
  }
  parts.push(`Likelihood ${risk.likelihood}, Impact ${risk.impact}.`);
  if (risk.treatment) parts.push(`Treatment: ${risk.treatment}.`);
  if (risk.status) parts.push(`Status: ${risk.status}.`);
  return parts.join(" ");
}

function buildRecommendation(risk: RiskDetail, scoreDelta: number | null) {
  const lvl = (risk.risk_level || "").toLowerCase();
  const up = typeof scoreDelta === "number" && scoreDelta > 0;

  if (lvl.includes("critical") || lvl.includes("very high") || (lvl.includes("high") && up)) {
    return [
      "Prioritize immediate mitigation.",
      "Validate control coverage and assign an owner with a deadline.",
      "Collect fresh evidence to support effectiveness of controls.",
    ].join("\n");
  }

  if (lvl.includes("high")) {
    return [
      "Mitigation recommended.",
      "Check linked control(s) and confirm implementation status.",
      "Plan a review cycle and attach relevant evidences.",
    ].join("\n");
  }

  if (lvl.includes("medium")) {
    return [
      "Monitor and optimize.",
      "Focus on preventive controls and process hardening.",
      "Schedule next review and keep evidence current.",
    ].join("\n");
  }

  return [
    "Maintain current posture.",
    "Keep monitoring indicators and ensure evidence hygiene.",
    "Review periodically or upon significant change.",
  ].join("\n");
}

function buildNextActions(risk: RiskDetail) {
  const items: string[] = [];
  items.push("• Assign/confirm risk owner");
  items.push("• Link relevant control(s) and requirement(s)");
  items.push("• Attach evidence (latest file versions)");
  items.push("• Set next review date");
  if (!risk.action) items.push("• Define action plan steps");
  return items.join("\n");
}
