"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import {
  BarChart3,
  ChevronRight,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";

type Summary = {
  total_controls: number;
  avg_coverage: number | null;
  avg_risk_score: number | null;
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

type ControlDetail = {
  control_id: number;
  control_code?: string | null;
  control_title?: string | null;
  summary?: {
    linked_risk_count?: number;
    high_risk_count?: number;
    critical_risk_count?: number;
    avg_escalation_probability?: number;
    max_escalation_probability?: number;
    expected_score_delta_sum?: number;
    risk_pressure_index?: number;
  };
  top_risks?: Array<{
    risk_id: number;
    title?: string | null;
    score?: number | null;
    level?: string | null;
    status?: string | null;
    escalation_probability?: number;
    expected_delta?: number;
  }>;
};

type CoverageStatus = "healthy" | "partial" | "weak" | "unassessed";

function getCoverageStatus(value: number | null): CoverageStatus {
  if (value == null) return "unassessed";
  if (value >= 80) return "healthy";
  if (value >= 50) return "partial";
  return "weak";
}

function statusLabel(status: CoverageStatus) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "partial":
      return "Partial";
    case "weak":
      return "Weak";
    default:
      return "Unassessed";
  }
}

function statusClass(status: CoverageStatus) {
  switch (status) {
    case "healthy":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "partial":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "weak":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    default:
      return "border-slate-600 bg-slate-700/30 text-slate-400";
  }
}

function coverageValue(value: number | null) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

function riskClass(value: number | null) {
  if (value == null) return "text-slate-500";
  if (value >= 70) return "text-red-300";
  if (value >= 40) return "text-amber-300";
  return "text-emerald-300";
}

export default function MatrixIntelligencePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CoverageStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [selectedControl, setSelectedControl] = useState<number | null>(null);
  const [controlDetail, setControlDetail] = useState<ControlDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/analytics/control-health");

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setSummary(data.summary || null);
      setControls(Array.isArray(data.controls) ? data.controls : []);
    } catch (err: any) {
      console.error("Control Analytics load error:", err);
      setError(err?.message || "Unable to load control analytics.");
      setSummary(null);
      setControls([]);
    } finally {
      setLoading(false);
    }
  }

  async function openControl(controlId: number) {
    setSelectedControl(controlId);
    setDrawerLoading(true);
    setControlDetail(null);

    try {
      const res = await apiFetch(`/company/intelligence/control/${controlId}`);

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setControlDetail(await res.json());
    } catch (err) {
      console.error("Control detail load error:", err);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedControl(null);
    setControlDetail(null);
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const healthy = controls.filter((c) => getCoverageStatus(c.coverage_score) === "healthy").length;
    const partial = controls.filter((c) => getCoverageStatus(c.coverage_score) === "partial").length;
    const weak = controls.filter((c) => getCoverageStatus(c.coverage_score) === "weak").length;
    const unassessed = controls.filter((c) => getCoverageStatus(c.coverage_score) === "unassessed").length;
    const riskLinked = controls.filter((c) => c.linked_risk_count > 0).length;

    return { healthy, partial, weak, unassessed, riskLinked };
  }, [controls]);

  const filteredControls = useMemo(() => {
    const query = search.trim().toLowerCase();

    return controls.filter((control) => {
      const status = getCoverageStatus(control.coverage_score);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesRisk =
        riskFilter === "all" ||
        (riskFilter === "linked" && control.linked_risk_count > 0) ||
        (riskFilter === "unlinked" && control.linked_risk_count === 0);

      const haystack = [control.control_code, control.control_title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesRisk && (!query || haystack.includes(query));
    });
  }, [controls, search, statusFilter, riskFilter]);

  const attentionControls = useMemo(() => {
    return [...controls]
      .filter((control) => {
        const status = getCoverageStatus(control.coverage_score);
        return status === "weak" || status === "partial" || control.linked_risk_count > 0;
      })
      .sort((a, b) => {
        const coverageA = a.coverage_score ?? -1;
        const coverageB = b.coverage_score ?? -1;
        if (coverageA !== coverageB) return coverageA - coverageB;
        return (b.worst_risk_score ?? -1) - (a.worst_risk_score ?? -1);
      })
      .slice(0, 6);
  }, [controls]);

  return (
    <div className="min-h-full bg-[#020817] text-slate-100">
      <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-7">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10">
                <BarChart3 className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Control Analytics</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Control health, coverage, risk linkage and weakness distribution across the compliance matrix.
                </p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Total Controls" value={summary?.total_controls ?? controls.length} />
          <MetricCard
            label="Avg Coverage"
            value={summary?.avg_coverage == null ? "—" : `${Number(summary.avg_coverage).toFixed(1)}%`}
            tone="cyan"
          />
          <MetricCard label="Healthy" value={metrics.healthy} tone="green" sub="Coverage ≥ 80%" />
          <MetricCard label="Partial" value={metrics.partial} tone="amber" sub="Coverage 50–79%" />
          <MetricCard label="Weak" value={metrics.weak} tone="red" sub="Coverage < 50%" />
          <MetricCard label="Risk-Linked" value={metrics.riskLinked} tone="purple" sub="Controls with linked risks" />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Control Coverage Distribution</h2>
                <p className="mt-1 text-xs text-slate-500">Current control posture based on coverage score.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="mt-5 space-y-4">
              <DistributionRow label="Healthy" count={metrics.healthy} total={controls.length} status="healthy" />
              <DistributionRow label="Partial" count={metrics.partial} total={controls.length} status="partial" />
              <DistributionRow label="Weak" count={metrics.weak} total={controls.length} status="weak" />
              <DistributionRow label="Unassessed" count={metrics.unassessed} total={controls.length} status="unassessed" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Controls Requiring Attention</h2>
                <p className="mt-1 text-xs text-slate-500">Lowest coverage and risk-linked controls are surfaced first.</p>
              </div>
              <Target className="h-5 w-5 text-amber-300" />
            </div>

            <div className="mt-4 space-y-2">
              {attentionControls.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                  No control weaknesses detected.
                </div>
              ) : (
                attentionControls.map((control) => (
                  <button
                    key={control.control_id}
                    type="button"
                    onClick={() => openControl(control.control_id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3 text-left transition hover:border-cyan-400/30 hover:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{control.control_code || `Control #${control.control_id}`}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{control.control_title || "Untitled control"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={getCoverageStatus(control.coverage_score)} />
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Controls Overview</h2>
              <p className="mt-1 text-xs text-slate-500">Analyze every control by coverage status, risk linkage and risk severity.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search control code or title"
                className="h-9 min-w-[220px] rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CoverageStatus | "all")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400/40"
              >
                <option value="all">All statuses</option>
                <option value="healthy">Healthy</option>
                <option value="partial">Partial</option>
                <option value="weak">Weak</option>
                <option value="unassessed">Unassessed</option>
              </select>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as "all" | "linked" | "unlinked")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400/40"
              >
                <option value="all">All risk linkage</option>
                <option value="linked">Risk linked</option>
                <option value="unlinked">No linked risk</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <Th>Control</Th>
                  <Th>Status</Th>
                  <Th>Coverage</Th>
                  <Th>Linked Risks</Th>
                  <Th>Worst Risk</Th>
                  <Th>Avg Risk</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Loading control analytics…</td>
                  </tr>
                ) : filteredControls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No controls match the selected filters.</td>
                  </tr>
                ) : (
                  filteredControls.map((control) => {
                    const status = getCoverageStatus(control.coverage_score);

                    return (
                      <tr key={control.control_id} className="border-t border-slate-800 transition hover:bg-slate-950/70">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => openControl(control.control_id)} className="text-left">
                            <div className="font-semibold text-slate-100 hover:text-cyan-300">{control.control_code || `Control #${control.control_id}`}</div>
                            <div className="mt-0.5 max-w-[340px] truncate text-xs text-slate-500">{control.control_title || "Untitled control"}</div>
                          </button>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(0, Math.min(100, control.coverage_score ?? 0))}%` }} />
                            </div>
                            <span className="min-w-[52px] text-right font-medium text-slate-200">{coverageValue(control.coverage_score)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{control.linked_risk_count}</td>
                        <td className={`px-4 py-3 font-semibold ${riskClass(control.worst_risk_score)}`}>
                          {control.worst_risk_score == null ? "—" : Number(control.worst_risk_score).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {control.avg_risk_score == null ? "—" : Number(control.avg_risk_score).toFixed(1)}
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => openControl(control.control_id)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-400/30 hover:text-cyan-300">
                            Inspect
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedControl !== null && (
        <>
          <button aria-label="Close control details" onClick={closeDrawer} className="fixed inset-0 z-40 cursor-default bg-black/60" />

          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-[620px] overflow-y-auto border-l border-slate-700 bg-[#08111f] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Control Detail</div>
                <h2 className="mt-1 truncate text-xl font-bold text-white">{controlDetail?.control_code || `Control #${selectedControl}`}</h2>
                <p className="mt-1 truncate text-xs text-slate-500">{controlDetail?.control_title || "Control health and linked risk detail"}</p>
              </div>
              <button type="button" onClick={closeDrawer} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {drawerLoading && <div className="py-10 text-sm text-slate-400">Loading control detail…</div>}

            {!drawerLoading && controlDetail && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <DetailCard label="Linked Risks" value={controlDetail.summary?.linked_risk_count ?? 0} />
                  <DetailCard label="High Risks" value={controlDetail.summary?.high_risk_count ?? 0} />
                  <DetailCard label="Critical Risks" value={controlDetail.summary?.critical_risk_count ?? 0} />
                  <DetailCard label="Avg Escalation" value={`${Math.round((controlDetail.summary?.avg_escalation_probability ?? 0) * 100)}%`} />
                  <DetailCard label="Max Escalation" value={`${Math.round((controlDetail.summary?.max_escalation_probability ?? 0) * 100)}%`} />
                  <DetailCard label="Risk Pressure" value={Number(controlDetail.summary?.risk_pressure_index ?? 0).toFixed(2)} />
                </div>

                <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-200">Linked Risk Signals</h3>
                  <p className="mt-1 text-xs text-slate-500">Risk detail is available here as a drill-down; it is not the primary purpose of Control Analytics.</p>

                  <div className="mt-4 space-y-2">
                    {(controlDetail.top_risks || []).length === 0 ? (
                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">No linked risks found for this control.</div>
                    ) : (
                      controlDetail.top_risks!.map((risk) => (
                        <div key={risk.risk_id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-100">{risk.risk_id} — {risk.title || "Untitled risk"}</div>
                              <div className="mt-1 text-xs text-slate-500">{risk.status || "—"} · {risk.level || "—"}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-sm font-semibold ${riskClass(risk.score ?? null)}`}>{risk.score == null ? "—" : Number(risk.score).toFixed(1)}</div>
                              <div className="text-[10px] text-slate-600">risk score</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone = "slate", sub }: { label: string; value: string | number; tone?: "slate" | "cyan" | "green" | "amber" | "red" | "purple"; sub?: string }) {
  const toneClass = { slate: "text-white", cyan: "text-cyan-300", green: "text-emerald-300", amber: "text-amber-300", red: "text-red-300", purple: "text-violet-300" }[tone];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}

function DistributionRow({ label, count, total, status }: { label: string; count: number; total: number; status: CoverageStatus }) {
  const percent = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300"><StatusBadge status={status} /><span>{count} controls</span></div>
        <span className="text-slate-500">{percent.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function StatusBadge({ status }: { status: CoverageStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function DetailCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}
