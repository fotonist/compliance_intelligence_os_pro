"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type GapItem = {
  gap_id: number;
  severity_score: number | null;
  status: string | null;
  task_id?: number | null;
  task_status?: string | null;
};

type RiskNode = {
  risk_id: number;
  risk_title: string | null;
  risk_level: string | null;
  exposure_score: number | null;
  escalation_probability: number | null;
  gap_count: number;
  worst_severity: number;
  gaps: GapItem[];
};

type ControlNode = {
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  gap_count: number;
  worst_severity: number;
  ai_priority_score: number | null;
  risks: RiskNode[];
};

type GapResponse = {
  summary?: {
    gaps_total: number;
    uncovered: number;
    partial: number;
    worst_severity_score: number | null;
  };
  controls: ControlNode[];
};

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

function severityColor(score: number) {
  if (score >= 25) return "text-red-400";
  if (score >= 10) return "text-yellow-400";
  return "text-green-400";
}

function controlHealthIndex(worstSeverity: number) {
  const normalized = Math.min(worstSeverity, 100);
  return Math.max(0, 100 - normalized);
}

export default function GapIntelligencePage() {
  const router = useRouter();

  const [data, setData] = useState<GapResponse | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openControl, setOpenControl] = useState<number | null>(null);
  const [openRisk, setOpenRisk] = useState<number | null>(null);

  const [taskModalGapId, setTaskModalGapId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  async function submitTask() {
    if (!taskModalGapId) return;

    try {
      const res = await apiFetch(
        `/company/intelligence/gaps/${taskModalGapId}/create-task`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            owner_role: taskOwner,
            due_date: taskDueDate,
          }),
        }
      );

      const json = await res.json();

      if (json?.task_id) {
        router.push(`/company/tasks/${json.task_id}`);
      }

      const reload = await apiFetch("/company/intelligence/gaps");
      const reloadJson = await reload.json();
      setData(reloadJson);
      setTaskModalGapId(null);

    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/company/intelligence/gaps");
        const json = await res.json();
        setData(json);

        const trendRes = await apiFetch("/company/intelligence/gaps/trend");
        const trendJson = await trendRes.json();
        setTrend(trendJson || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading gaps...</div>;
  }

  if (!data) {
    return <div className="p-6 text-red-400">Failed to load.</div>;
  }

  const summary = data.summary || {
    gaps_total: 0,
    uncovered: 0,
    partial: 0,
    worst_severity_score: 0,
  };

  return (
    <div className="p-6 space-y-6">

      <div className="grid grid-cols-5 gap-4">
        <Card label="Total Gaps" value={summary.gaps_total} />
        <Card label="Uncovered" value={summary.uncovered} />
        <Card label="Partial" value={summary.partial} />
        <Card
          label="Worst Severity"
          value={safeNumber(summary.worst_severity_score).toFixed(2)}
        />
        <Card
          label="Global Health Index"
          value={controlHealthIndex(
            safeNumber(summary.worst_severity_score)
          )}
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-sm text-slate-400 mb-4">Day GAP Trend</div>

       <ResponsiveContainer width="100%" height={250}>
  <LineChart data={trend}>

    <XAxis
      dataKey="day"
      tickFormatter={(d) =>
        typeof d === "string" ? d.slice(5, 10) : ""
      }
    />

    <YAxis />

    <Tooltip />

    <Line
      type="monotone"
      dataKey="gap_count"
      stroke="#06b6d4"
      strokeWidth={2}
    />

    <Line
      type="monotone"
      dataKey="health_index"
      stroke="#22c55e"
      strokeWidth={2}
    />

  </LineChart>
</ResponsiveContainer>
      </div>

      <div className="space-y-4">
        {data.controls?.map((control) => {

          const aiScore = safeNumber(control.ai_priority_score);
          const worst = safeNumber(control.worst_severity);
          const health = controlHealthIndex(worst);

          return (
            <div
              key={control.control_id}
              className="border border-slate-800 rounded-xl bg-slate-900"
            >

              <div
                className="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-800"
                onClick={() =>
                  setOpenControl(
                    openControl === control.control_id
                      ? null
                      : control.control_id
                  )
                }
              >
                <div>
                  <div className="font-semibold text-white">
                    {control.control_code ?? "—"} — {control.control_title ?? ""}
                  </div>

                  <div className="text-xs text-slate-400">
                    Gaps: {control.gap_count} | Worst:
                    <span className={severityColor(worst)}> {worst.toFixed(2)}</span> | Health: {health}
                  </div>
                </div>

                <div className="text-sm text-cyan-400">
                  AI Priority: {aiScore.toFixed(2)}
                </div>
              </div>

              {openControl === control.control_id && (
                <div className="border-t border-slate-800">

                  {control.risks?.map((risk) => {

                    const exposure = safeNumber(risk.exposure_score);
                    const escalation = safeNumber(risk.escalation_probability);
                    const worstRisk = safeNumber(risk.worst_severity);

                    return (
                      <div key={risk.risk_id} className="border-b border-slate-800">

                        <div
                          className="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-800"
                          onClick={() =>
                            setOpenRisk(
                              openRisk === risk.risk_id
                                ? null
                                : risk.risk_id
                            )
                          }
                        >
                          <div>
                            <div className="text-white font-medium">
                              {risk.risk_title ?? "Unnamed Risk"}
                            </div>

                            <div className="text-xs text-slate-400">
                              Level: {risk.risk_level ?? "—"} | Gaps {risk.gap_count} | Worst
                              <span className={severityColor(worstRisk)}> {worstRisk.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-300 text-right">
                            Exposure: {exposure.toFixed(2)} <br />
                            Esc: {(escalation * 100).toFixed(1)}%
                          </div>
                        </div>

                        {openRisk === risk.risk_id && (
                          <div className="bg-slate-950 p-4 space-y-2">

                            {risk.gaps?.map((gap) => {

                              const sev = safeNumber(gap.severity_score);

                              return (
                                <div
                                  key={gap.gap_id}
                                  className="flex justify-between items-center text-sm border border-slate-800 p-3 rounded-lg"
                                >

                                  <div>Gap #{gap.gap_id}</div>

                                  <div className={severityColor(sev)}>
                                    Severity: {sev.toFixed(2)}
                                  </div>

                                  <div>Status: {gap.status ?? "—"}</div>

                                  {gap.task_id ? (
                                    <button
                                      onClick={() =>
                                        router.push(`/company/tasks/${gap.task_id}`)
                                      }
                                      className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 rounded"
                                    >
                                      View Task #{gap.task_id}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTaskModalGapId(gap.gap_id);
                                      }}
                                      className="text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded"
                                    >
                                      Create Task
                                    </button>
                                  )}

                                </div>
                              );
                            })}

                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              )}

            </div>
          );
        })}
      </div>

      {taskModalGapId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">

          <div className="bg-slate-900 border border-slate-700 p-6 rounded w-[420px] space-y-4">

            <div className="text-white font-semibold">
              Create Remediation Task
            </div>

            <input
              placeholder="Task Title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full bg-slate-800 p-2 rounded"
            />

            <textarea
              placeholder="Description"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full bg-slate-800 p-2 rounded"
            />

            <input
              placeholder="Assign To"
              value={taskOwner}
              onChange={(e) => setTaskOwner(e.target.value)}
              className="w-full bg-slate-800 p-2 rounded"
            />

            <input
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="w-full bg-slate-800 p-2 rounded"
            />

            <div className="flex justify-end gap-2">

              <button
                onClick={() => setTaskModalGapId(null)}
                className="px-3 py-1 bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={submitTask}
                className="px-3 py-1 bg-cyan-600 rounded"
              >
                Create Task
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
    </div>
  );
}