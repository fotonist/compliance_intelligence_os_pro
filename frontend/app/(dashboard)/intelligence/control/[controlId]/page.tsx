"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ControlDetail = {
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  linked_risk_count: number;
  worst_risk_score: number | null;
  avg_risk_score: number | null;
  coverage_score: number | null;
};

type LinkedRisk = {
  id: number;
  title: string;
  score: number;
  likelihood: number;
  impact: number;
  risk_level: string | null;
  escalation_probability: number | null;
  exposure_score: number | null;
};

export default function ControlDetailPage() {
  const params = useParams();
  const controlId = params.controlId as string;

  const [data, setData] = useState<ControlDetail | null>(null);
  const [risks, setRisks] = useState<LinkedRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(
        `http://localhost:8000/analytics/control-health/${controlId}`,
        { credentials: "include" }
      ).then((r) => r.json()),
      fetch(
        `http://localhost:8000/analytics/control-health/${controlId}/risks`,
        { credentials: "include" }
      ).then((r) => r.json()),
    ])
      .then(([detail, linkedRisks]) => {
        setData(detail);
        setRisks(linkedRisks);
      })
      .catch((err) =>
        console.error("Control detail fetch error:", err)
      )
      .finally(() => setLoading(false));
  }, [controlId]);

  if (loading)
    return <div className="p-6 text-slate-400">Loading…</div>;

  if (!data)
    return <div className="p-6 text-red-400">Not found</div>;

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white space-y-10">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold">
          {data.control_code} – {data.control_title}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Control Intelligence Detail
        </p>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-4 gap-6">
        <MetricCard title="Linked Risks" value={data.linked_risk_count} />
        <MetricCard
          title="Worst Risk"
          value={data.worst_risk_score || 0}
          danger
        />
        <MetricCard
          title="Avg Risk"
          value={
            data.avg_risk_score
              ? data.avg_risk_score.toFixed(1)
              : 0
          }
        />
        <MetricCard
          title="Coverage"
          value={`${data.coverage_score || 0}%`}
        />
      </div>

      {/* LINKED RISKS TABLE */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 text-sm font-semibold text-slate-300">
          Linked Risks
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <Th>Title</Th>
              <Th>Score</Th>
              <Th>Likelihood</Th>
              <Th>Impact</Th>
              <Th>Escalation %</Th>
              <Th>Exposure</Th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-800 hover:bg-slate-800"
              >
                <Td>{r.title}</Td>
                <Td>
                  <ScoreBadge value={r.score} />
                </Td>
                <Td>{r.likelihood}</Td>
                <Td>{r.impact}</Td>
                <Td>
                  {r.escalation_probability
                    ? `${r.escalation_probability.toFixed(1)}%`
                    : "-"}
                </Td>
                <Td>
                  {r.exposure_score
                    ? r.exposure_score.toFixed(1)
                    : "-"}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* COMPONENTS */

function MetricCard({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger
          ? "border-red-600 bg-red-950"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-slate-400 text-xs uppercase">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold">
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 text-slate-200">
      {children}
    </td>
  );
}

function ScoreBadge({ value }: { value: number }) {
  let color = "bg-green-600";
  if (value >= 70) color = "bg-red-600";
  else if (value >= 40) color = "bg-yellow-600";

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${color}`}
    >
      {value}
    </span>
  );
}