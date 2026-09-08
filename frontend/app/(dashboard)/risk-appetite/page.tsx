"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Gauge,
  RefreshCw,
  Save,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type Profile = {
  id?: number;
  name?: string | null;
  description?: string | null;
  is_default?: boolean;
  default_threshold?: number | null;
};

type Process = {
  id?: number;
  code?: string | null;
  name?: string | null;
  owner?: string | null;
  status?: string | null;
};

type Risk = {
  id?: number;
  title?: string | null;
  score?: number | null;
  risk_level?: string | null;
  status?: string | null;
};

type ProcessPosture = {
  process: Process;
  riskCount: number;
  maxScore: number;
};

const MAX_SCORE = 25;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRiskLevel(score: number) {
  if (score >= 20) return "CRITICAL";
  if (score >= 15) return "HIGH";
  if (score >= 8) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NO DATA";
}

function getAppetiteState(score: number, threshold: number) {
  if (score <= 0) return "NO DATA";
  if (score > threshold) return "ABOVE APPETITE";
  if (score >= threshold * 0.8) return "NEAR APPETITE";
  return "WITHIN APPETITE";
}

function appetiteClass(state: string) {
  if (state === "ABOVE APPETITE") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (state === "NEAR APPETITE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (state === "WITHIN APPETITE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

function riskClass(level: string) {
  if (level === "CRITICAL") return "bg-red-50 text-red-700";
  if (level === "HIGH") return "bg-orange-50 text-orange-700";
  if (level === "MEDIUM") return "bg-amber-50 text-amber-700";
  if (level === "LOW") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-500";
}

async function responseText(res: Response) {
  const text = await res.text();
  return text || `Request failed with status ${res.status}.`;
}

function KpiCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white px-5 py-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
        <span className="text-slate-500">{icon}</span>
      </div>

      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-[11px] text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  icon,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">
            {icon}
            {eyebrow}
          </div>

          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {title}
          </h2>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        {actions}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400";

export default function RiskAppetitePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [posture, setPosture] = useState<ProcessPosture[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState(16);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function loadProcessPosture(processList: Process[]) {
    setRiskLoading(true);

    try {
      const validProcesses = processList.filter(
        (process) => Number(process.id) > 0,
      );

      const rows = await Promise.all(
        validProcesses.map(async (process) => {
          try {
            const res = await apiFetch(
              `/company/processes/${Number(process.id)}/risks`,
              {
                method: "GET",
              },
            );

            if (!res.ok) {
              return {
                process,
                riskCount: 0,
                maxScore: 0,
              };
            }

            const data = await res.json();

            const risks: Risk[] = Array.isArray(data)
              ? data
              : Array.isArray(data?.risks)
                ? data.risks
                : Array.isArray(data?.linked_risks)
                  ? data.linked_risks
                  : [];

            const scores = risks
              .map((risk) => numberValue(risk.score))
              .filter((score) => score > 0);

            return {
              process,
              riskCount: risks.length,
              maxScore: scores.length ? Math.max(...scores) : 0,
            };
          } catch {
            return {
              process,
              riskCount: 0,
              maxScore: 0,
            };
          }
        }),
      );

      setPosture(rows);
    } finally {
      setRiskLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const [profileRes, processRes] = await Promise.all([
        apiFetch("/risk-appetite/profile", {
          method: "GET",
        }),
        apiFetch("/company/processes", {
          method: "GET",
        }),
      ]);

      if (!profileRes.ok) {
        throw new Error(await responseText(profileRes));
      }

      if (!processRes.ok) {
        throw new Error(await responseText(processRes));
      }

      const profileData = (await profileRes.json()) as Profile;
      const processData = await processRes.json();

      const processList: Process[] = Array.isArray(processData)
        ? processData
        : Array.isArray(processData?.items)
          ? processData.items
          : Array.isArray(processData?.processes)
            ? processData.processes
            : [];

      const activeThreshold = numberValue(
        profileData?.default_threshold,
        16,
      );

      setProfile(profileData);
      setName(profileData?.name ?? "");
      setDescription(profileData?.description ?? "");
      setThreshold(activeThreshold);
      setProcesses(processList);

      await loadProcessPosture(processList);
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Failed to load risk appetite configuration.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings() {
    const normalizedThreshold = Math.round(Number(threshold));

    if (!name.trim()) {
      setMessage({
        type: "error",
        text: "Profile name is required.",
      });
      return;
    }

    if (
      !Number.isFinite(normalizedThreshold) ||
      normalizedThreshold < 1 ||
      normalizedThreshold > MAX_SCORE
    ) {
      setMessage({
        type: "error",
        text: `Threshold must be between 1 and ${MAX_SCORE}.`,
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await apiFetch("/risk-appetite/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          default_threshold: normalizedThreshold,
        }),
      });

      if (!res.ok) {
        throw new Error(await responseText(res));
      }

      const updated = (await res.json()) as Profile;

      setProfile(updated);
      setName(updated?.name ?? name.trim());
      setDescription(updated?.description ?? description.trim());
      setThreshold(
        numberValue(updated?.default_threshold, normalizedThreshold),
      );

      setMessage({
        type: "success",
        text: "Risk appetite policy saved successfully.",
      });

      await loadProcessPosture(processes);
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Failed to save risk appetite policy.",
      });
    } finally {
      setSaving(false);
    }
  }

  const metrics = useMemo(() => {
    const scored = posture.filter((item) => item.maxScore > 0);

    const above = scored.filter(
      (item) => item.maxScore > threshold,
    );

    const near = scored.filter(
      (item) =>
        item.maxScore <= threshold &&
        item.maxScore >= threshold * 0.8,
    );

    const highest = scored.length
      ? Math.max(...scored.map((item) => item.maxScore))
      : 0;

    return {
      processCount: processes.length,
      aboveCount: above.length,
      nearCount: near.length,
      highest,
      scoredCount: scored.length,
    };
  }, [posture, processes.length, threshold]);

  const filteredPosture = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return posture;
    }

    return posture.filter((item) => {
      const process = item.process;

      return [
        process.code,
        process.name,
        process.owner,
        process.status,
        getRiskLevel(item.maxScore),
        getAppetiteState(item.maxScore, threshold),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [posture, search, threshold]);

  const thresholdPercent = Math.min(
    100,
    Math.max(0, (threshold / MAX_SCORE) * 100),
  );

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 xl:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                <Gauge size={14} />
                Risk Governance / Policy
              </div>

              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                Risk Appetite
              </h1>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Define the organization risk tolerance policy and
                evaluate current process exposure against the active
                threshold.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden border-r border-slate-200 pr-4 text-right sm:block">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Profile
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-800">
                  {profile?.name || "Not loaded"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div
            className={
              message.type === "success"
                ? "flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                : "flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            }
          >
            {message.type === "success" ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            {message.text}
          </div>
        )}

        <section className="grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<ShieldCheck size={17} />}
            label="Organization Threshold"
            value={String(threshold)}
            detail={`Maximum score ${MAX_SCORE}`}
          />

          <KpiCard
            icon={<Building2 size={17} />}
            label="Processes In Scope"
            value={String(metrics.processCount)}
            detail="Current process register"
          />

          <KpiCard
            icon={<AlertTriangle size={17} />}
            label="Above Appetite"
            value={String(metrics.aboveCount)}
            detail="Current process breaches"
          />

          <KpiCard
            icon={<TrendingUp size={17} />}
            label="Highest Exposure"
            value={metrics.highest ? String(metrics.highest) : "N/A"}
            detail={
              metrics.highest
                ? getRiskLevel(metrics.highest)
                : "No scored risks"
            }
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <Section
            eyebrow="POLICY DEFINITION"
            title="Organization Risk Appetite"
            description="Manage the persisted organization-level risk appetite profile."
            icon={<ShieldCheck size={17} />}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Profile Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                  disabled={loading}
                />
              </Field>

              <Field label="Default Threshold">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={MAX_SCORE}
                    value={threshold}
                    onChange={(event) =>
                      setThreshold(Number(event.target.value))
                    }
                    className={`${inputClass} pr-16`}
                    disabled={loading}
                  />

                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-slate-400">
                    / {MAX_SCORE}
                  </span>
                </div>
              </Field>

              <div className="md:col-span-2">
                <Field label="Policy Description">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    className={`${inputClass} resize-none`}
                    disabled={loading}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    Active decision boundary
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Process risk scores above this value are outside
                    the configured appetite.
                  </div>
                </div>

                <div className="text-2xl font-semibold text-slate-950">
                  {threshold}
                </div>
              </div>

              <div className="mt-5">
                <div className="relative h-2 bg-slate-200">
                  <div
                    className="absolute inset-y-0 left-0 bg-slate-900"
                    style={{ width: `${thresholdPercent}%` }}
                  />

                  <div
                    className="absolute -top-1 h-4 w-px bg-slate-950"
                    style={{ left: `${thresholdPercent}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                  <span>Critical</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[10px] text-slate-400">
                {profile?.id
                  ? `Profile ID ${profile.id}`
                  : "Profile unavailable"}
              </div>

              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving || loading}
                className="inline-flex h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {saving ? "Saving" : "Save Policy"}
              </button>
            </div>
          </Section>

          <Section
            eyebrow="GOVERNANCE INTERPRETATION"
            title="Appetite Bands"
            description="Operational interpretation of the active threshold."
            icon={<Target size={17} />}
          >
            <div className="space-y-3">
              <div className="border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-800">
                    Within Appetite
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700">
                    0 - {Math.max(0, Math.floor(threshold * 0.8))}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Exposure remains comfortably below the policy
                  boundary.
                </p>
              </div>

              <div className="border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-800">
                    Near Appetite
                  </span>
                  <span className="text-[10px] font-semibold text-amber-700">
                    {Math.max(1, Math.floor(threshold * 0.8) + 1)} -{" "}
                    {threshold}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Exposure is approaching the organization's
                  tolerance boundary.
                </p>
              </div>

              <div className="border border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-red-800">
                    Above Appetite
                  </span>
                  <span className="text-[10px] font-semibold text-red-700">
                    &gt; {threshold}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Exposure exceeds the active organization policy.
                </p>
              </div>
            </div>

            <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Current governance signal
              </div>

              <div className="mt-2 text-sm font-semibold text-slate-800">
                {metrics.aboveCount > 0
                  ? `${metrics.aboveCount} process${metrics.aboveCount === 1 ? "" : "es"} above appetite`
                  : metrics.nearCount > 0
                    ? `${metrics.nearCount} process${metrics.nearCount === 1 ? "" : "es"} near appetite`
                    : "No current appetite breach detected"}
              </div>
            </div>
          </Section>
        </section>

        <Section
          eyebrow="PROCESS RISK POSTURE"
          title="Process Appetite Register"
          description="Current process exposure evaluated against the organization risk appetite. The register is derived from live process and risk APIs."
          icon={<Building2 size={17} />}
          actions={
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search process..."
              className="h-9 w-full border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400 sm:w-56"
            />
          }
        >
          <div className="overflow-x-auto border border-slate-200">
            <table className="min-w-[1050px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Process
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Owner
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Exposure
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Risk Level
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Appetite State
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Threshold
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Risk Records
                  </th>
                </tr>
              </thead>

              <tbody>
                {riskLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      Loading process risk posture...
                    </td>
                  </tr>
                )}

                {!riskLoading &&
                  filteredPosture.map((item) => {
                    const score = item.maxScore;
                    const level = getRiskLevel(score);
                    const state = getAppetiteState(score, threshold);

                    return (
                      <tr
                        key={item.process.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-800">
                            {item.process.code || "Process"}
                          </div>
                          <div className="mt-0.5 max-w-[280px] truncate text-xs text-slate-500">
                            {item.process.name || "Unnamed process"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600">
                          {item.process.owner || "Not assigned"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-800">
                            {score > 0 ? score : "N/A"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-[10px] font-semibold ${riskClass(level)}`}
                          >
                            {level}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex border px-2 py-1 text-[10px] font-semibold ${appetiteClass(state)}`}
                          >
                            {state}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                          {threshold}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500">
                          {item.riskCount}
                        </td>
                      </tr>
                    );
                  })}

                {!riskLoading && filteredPosture.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center"
                    >
                      <div className="text-sm font-semibold text-slate-700">
                        No process risk records available
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        No synthetic process or risk data is displayed.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2 border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {metrics.scoredCount} process
              {metrics.scoredCount === 1 ? "" : "es"} have scored risk
              records.
            </span>

            <span className="font-semibold text-slate-700">
              {metrics.aboveCount} above / {metrics.nearCount} near
            </span>
          </div>
        </Section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="border border-slate-200 bg-white p-5">
            <ShieldCheck size={18} className="text-slate-500" />
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Policy Source
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              Organization Risk Appetite Profile
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              The active threshold is persisted through the existing
              Risk Appetite API.
            </p>
          </div>

          <div className="border border-slate-200 bg-white p-5">
            <Target size={18} className="text-slate-500" />
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Decision Boundary
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {threshold} / {MAX_SCORE}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Scores above the active boundary are classified as
              above appetite.
            </p>
          </div>

          <div className="border border-slate-200 bg-white p-5">
            <AlertTriangle size={18} className="text-slate-500" />
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Escalation Signal
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {metrics.aboveCount
                ? `${metrics.aboveCount} above appetite`
                : "No breach detected"}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Signal is derived from current process risk records.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
