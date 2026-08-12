"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type Summary = {
  total_controls: number;
  avg_coverage: number;
  avg_risk_score: number;
  weak_controls: number;
  risk_universe: number;
  open_risks: number;
};

type Control = {
  tenant_id: number;
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  linked_risk_count: number;
  worst_risk_score: number | null;
  avg_risk_score: number | null;
  coverage_score: number | null;
};

export default function ControlIntelligencePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/analytics/control-health")
      .then((res) => res.json())
      .then((data) => {
        setSummary(data.summary);
        setControls(data.controls || []);
      })
      .catch((err) => {
        console.error("Control Intelligence fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 space-y-8 bg-slate-950 min-h-screen text-white">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold">Control Intelligence</h1>
        <p className="text-slate-400 text-sm mt-1">
          Advanced Control Health Panel
        </p>
      </div>

      {/* RISK DEFINITIONS */}
      {summary && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-slate-500 text-[11px] uppercase tracking-wide">
                Risk Universe
              </div>
              <div className="mt-1 text-xl font-semibold">
                {summary.risk_universe}
              </div>
              <div className="text-slate-500 text-xs mt-1">
                All risks in this tenant
              </div>
            </div>

            <div className="h-10 w-px bg-slate-800 hidden md:block" />

            <div>
              <div className="text-slate-500 text-[11px] uppercase tracking-wide">
                Open Risks
              </div>
              <div className="mt-1 text-xl font-semibold">
                {summary.open_risks}
              </div>
              <div className="text-slate-500 text-xs mt-1">
                Risks currently in OPEN status
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500">
            Risk Universe and Open Risks are tenant-level populations. Linked
            Risks in the control table are control-level relationships and may
            overlap across multiple controls.
          </div>
        </div>
      )}

      {/* KPI SECTION */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <KpiCard
            title="Total Controls"
            value={summary.total_controls}
          />
          <KpiCard
            title="Avg Coverage"
            value={
              summary.avg_coverage
                ? summary.avg_coverage.toFixed(1)
                : "0"
            }
          />
          <KpiCard
            title="Avg Risk Score"
            value={
              summary.avg_risk_score
                ? summary.avg_risk_score.toFixed(1)
                : "0"
            }
          />
          <KpiCard
            title="Weak Controls"
            value={summary.weak_controls}
            highlight
          />
        </div>
      )}

      {/* TABLE */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-semibold text-slate-300">
            Controls Overview
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Linked Risks = risks associated with the specific control; this is
            not the tenant-wide Risk Universe count.
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-400 text-sm">
            Loading control intelligence…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Linked Risks</Th>
                <Th>Worst Risk</Th>
                <Th>Avg Risk</Th>
                <Th>Coverage</Th>
              </tr>
            </thead>
            <tbody>
              {controls.map((c) => (
                <tr
                  key={c.control_id}
                  onClick={() =>
                    router.push(`/intelligence/control/${c.control_id}`)
                  }
                  className="border-b border-slate-800 hover:bg-slate-800 cursor-pointer transition"
                >
                  <Td>{c.control_code || "-"}</Td>
                  <Td>{c.control_title || "-"}</Td>
                  <Td>{c.linked_risk_count}</Td>
                  <Td>
                    <ScoreBadge value={c.worst_risk_score} />
                  </Td>
                  <Td>
                    {c.avg_risk_score
                      ? c.avg_risk_score.toFixed(1)
                      : "-"}
                  </Td>
                  <Td>
                    <CoverageBadge value={c.coverage_score} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function KpiCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-red-500 bg-red-950"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-slate-400 text-xs uppercase tracking-wide">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-slate-200">{children}</td>;
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) return <span>-</span>;

  let color = "bg-green-600";
  if (value >= 70) color = "bg-red-600";
  else if (value >= 40) color = "bg-yellow-600";

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}

function CoverageBadge({ value }: { value: number | null }) {
  if (value === null) return <span>-</span>;

  let color = "bg-red-600";
  if (value >= 80) color = "bg-green-600";
  else if (value >= 50) color = "bg-yellow-600";

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
      {value}%
    </span>
  );
}
