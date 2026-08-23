"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
  version?: string | null;
  status?: string | null;
};

type MatrixSummary = {
  controls: number;
  ready: boolean;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || localStorage.getItem("token");
}

function assessmentLabel(type?: string | null) {
  return type === "MATURITY_BASED" ? "Maturity-Based" : "Control-Based";
}

function statusLabel(status?: string | null) {
  if (status === "published") return "Active";
  if (status === "archived") return "Archived";
  return "Draft";
}

function statusClass(status?: string | null) {
  if (status === "published") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "archived") return "bg-slate-100 text-slate-500 border-slate-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function StandardSetupPage() {
  const { standardId } = useParams<{ standardId: string }>();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [standard, setStandard] = useState<Standard | null>(null);
  const [matrix, setMatrix] = useState<MatrixSummary>({ controls: 0, ready: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    setToken(getToken());
  }, []);

  useEffect(() => {
    if (!token || !standardId) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const standardsRes = await fetch(`${API_BASE}/standards/`, { headers });
        if (!standardsRes.ok) throw new Error(`Failed to load standards (HTTP ${standardsRes.status})`);

        const standardsData = await standardsRes.json();
        const standards: Standard[] = Array.isArray(standardsData) ? standardsData : [];
        const found = standards.find((item) => String(item.id) === String(standardId));
        if (!found) throw new Error("Standard not found");
        setStandard(found);

        try {
          const matrixRes = await fetch(`${API_BASE}/matrix?standard_id=${standardId}`, { headers });
          if (matrixRes.ok) {
            const matrixData = await matrixRes.json();
            const rows = Array.isArray(matrixData?.rows) ? matrixData.rows : [];
            setMatrix({
              controls: rows.filter((row: any) => row?.control_id != null).length,
              ready: rows.length > 0,
            });
          }
        } catch {
          // Matrix is supplementary; the setup page remains usable without it.
        }
      } catch (e: any) {
        setError(e.message || "Failed to load standard setup");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, standardId]);

  const readiness = useMemo(() => {
    if (!standard) return { definition: false, matrix: false, scope: false, activation: false };
    const definition = Boolean(standard.code && standard.version && standard.type);
    const matrixReady = matrix.ready;
    const scope = false;
    const activation = matrixReady && standard.status !== "published" && standard.status !== "archived";
    return { definition, matrix: matrixReady, scope, activation };
  }, [standard, matrix]);

  async function activate() {
    if (!standard || !token || !readiness.matrix) return;
    setActivating(true);
    try {
      const res = await fetch(`${API_BASE}/standards/${standard.id}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setStandard((current) => current ? { ...current, status: "published" } : current);
    } catch (e: any) {
      alert(e.message || "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-500">Loading standard setup…</div>;
  }

  if (error || !standard) {
    return (
      <div className="min-h-full bg-slate-50 p-8">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error || "Standard not found"}
        </div>
      </div>
    );
  }

  const isActive = standard.status === "published";

  return (
    <div className="min-h-full bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <button onClick={() => router.push("/standards")} className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-800">
              ← Standards
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">Standard Setup</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure the standard for organizational use before activation.
            </p>
          </div>
          <span className={`mt-1 inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${statusClass(standard.status)}`}>
            {statusLabel(standard.status)}
          </span>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Standard</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{standard.title || standard.code}</h2>
              <div className="mt-1 text-sm text-slate-500">{standard.code} · {standard.version || "Version not defined"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs text-slate-400">Assessment Model</div>
              <div className="mt-1 font-medium text-slate-700">{assessmentLabel(standard.type)}</div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Setup Progress</h2>
          <p className="mt-1 text-sm text-slate-500">Complete the required configuration before activating the standard.</p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              ["Standard Definition", readiness.definition, "Code, version and assessment model are defined."],
              ["Compliance Matrix", readiness.matrix, `${matrix.controls} controls available.`],
              ["Organizational Scope", readiness.scope, "Scope management is not configured yet."],
              ["Activation", isActive, isActive ? "Standard is active." : "Activation is available after matrix setup."],
            ].map(([title, done, detail]) => (
              <div key={String(title)} className={`rounded-xl border p-4 ${done ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {done ? "✓" : "○"}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{title}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">01</div>
                <h2 className="mt-1 text-base font-semibold">Standard Definition</h2>
                <p className="mt-1 text-sm text-slate-500">The catalog definition used for this compliance standard.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Configured</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-xs text-slate-400">Code</dt><dd className="mt-1 font-medium">{standard.code}</dd></div>
              <div><dt className="text-xs text-slate-400">Version</dt><dd className="mt-1 font-medium">{standard.version || "—"}</dd></div>
              <div><dt className="text-xs text-slate-400">Assessment Model</dt><dd className="mt-1 font-medium">{assessmentLabel(standard.type)}</dd></div>
              <div><dt className="text-xs text-slate-400">Status</dt><dd className="mt-1 font-medium">{statusLabel(standard.status)}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">02</div>
                <h2 className="mt-1 text-base font-semibold">Compliance Matrix</h2>
                <p className="mt-1 text-sm text-slate-500">Control baseline for assessment and evidence management.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${matrix.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {matrix.ready ? "Ready" : "Not built"}
              </span>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold">{matrix.controls}</div>
                <div className="text-xs text-slate-400">Controls in matrix</div>
              </div>
              <button onClick={() => router.push(`/matrix/builder?standard_id=${standard.id}`)} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
                {matrix.ready ? "View Matrix" : "Build Matrix"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">03</div>
            <h2 className="mt-1 text-base font-semibold">Organizational Scope</h2>
            <p className="mt-1 text-sm text-slate-500">Define where this standard applies across the organization.</p>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-medium text-amber-900">Not defined</div>
              <div className="mt-1 text-xs leading-5 text-amber-800">No scope-management contract is currently exposed by the backend. No scope data is being fabricated here.</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">04</div>
            <h2 className="mt-1 text-base font-semibold">Activation Readiness</h2>
            <p className="mt-1 text-sm text-slate-500">Publish the configured standard when the required baseline is ready.</p>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {isActive ? (
                <div className="text-sm font-medium text-emerald-700">✓ This standard is active.</div>
              ) : !matrix.ready ? (
                <div className="text-sm text-slate-600">Build the compliance matrix before activation.</div>
              ) : (
                <div className="text-sm text-slate-600">The standard has a configured matrix and can be activated. Organizational scope remains a separate setup capability.</div>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={activate}
                disabled={isActive || !matrix.ready || activating}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {activating ? "Activating…" : isActive ? "Active" : "Activate Standard"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

