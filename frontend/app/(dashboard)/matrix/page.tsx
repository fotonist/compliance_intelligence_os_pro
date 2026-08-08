"use client";
import ComplianceWorkspaceDrawer from "../../components/compliance-workspace/ComplianceWorkspaceDrawer";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ComplianceMatrixTable from "../../components/ComplianceMatrixTable";

type Mode = "control" | "maturity";

type StandardOption = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
};

type MatrixKpi = {
  compliance_percentage?: number;
 evidence?: {
  total?: number;
  approved?: number;
  pending?: number;
  rejected?: number;
  linked?: number;
};
  risk?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

const API_BASE = "http://localhost:8000";

export default function MatrixPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>("control");
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  const [standardId, setStandardId] = useState<number | "all">("all");
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [kpi, setKpi] = useState<MatrixKpi | null>(null);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  const selectedStandard = useMemo(() => {
    if (standardId === "all") return null;
    return standards.find((s) => s.id === standardId) || null;
  }, [standardId, standards]);

  /* ================= FETCH STANDARDS ================= */
  useEffect(() => {
    if (!token) return;

    async function fetchStandards() {
      try {
        const res = await fetch(`${API_BASE}/standards`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        const list: StandardOption[] = Array.isArray(data)
          ? data.map((s: any) => ({
              id: s.id,
              code: s.code,
              title: s.title ?? null,
              type: s.type ?? s.standard_type ?? s.assessment_type ?? null,
            }))
          : [];

        const controlStandards = list.filter(
          (s) => s.type === "CONTROL_BASED"
        );

        controlStandards.sort((a, b) =>
          (a.code || "").localeCompare(b.code || "")
        );

        setStandards(controlStandards);
      } catch (err) {
        console.error("STANDARDS fetch failed:", err);
        setStandards([]);
      }
    }

    fetchStandards();
  }, [token]);

  /* ================= FETCH MATRIX ================= */
  useEffect(() => {
    if (!token) return;

    async function fetchMatrix() {
      try {
        setLoading(true);

        const url =
          standardId === "all"
            ? `${API_BASE}/matrix`
            : `${API_BASE}/matrix?standard_id=${standardId}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const resolvedRows = Array.isArray(data)
          ? data
          : data?.rows ?? [];

        setRows(resolvedRows);
        setMode((data?.mode as Mode) || "control");
      } catch (err) {
        console.error("MATRIX fetch failed:", err);
        setRows([]);
        setMode("control");
      } finally {
        setLoading(false);
      }
    }

    fetchMatrix();
  }, [standardId, token]);

  /* ================= FETCH KPI ================= */
  useEffect(() => {
    if (!token) return;

    async function fetchKpi() {
      try {
        const url =
          standardId === "all"
            ? `${API_BASE}/matrix/kpi`
            : `${API_BASE}/matrix/kpi?standard_id=${standardId}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setKpi(data);
      } catch (err) {
        console.error("KPI fetch failed:", err);
        setKpi(null);
      }
    }

    fetchKpi();
  }, [standardId, token]);

  const instancesHref =
    standardId === "all"
      ? "/matrix/instances"
      : `/matrix/instances?standard_id=${standardId}`;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      
      {/* HEADER */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          {/* LEFT */}
          <div>
            <h1 className="text-xl font-semibold tracking-wide text-white">
              Compliance Matrix
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Mode: <span className="text-slate-200 font-medium">{mode}</span>
              {"  "}•{"  "}
              Rows: <span className="text-slate-200 font-medium">{rows.length}</span>
            </p>
          </div>

          {/* RIGHT */}
          <div className="flex flex-wrap items-center gap-3">

            <Link
              href={instancesHref}
              className="px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
            >
              View Matrices
            </Link>

                       <Link
              href="/matrix/builder"
              className="px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
            >
              Row Builder
            </Link>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto sm:min-w-[260px]">
              <label className="text-xs text-slate-400 whitespace-nowrap">
                Standard
              </label>

              <select
                value={standardId}
                onChange={(e) =>
                  setStandardId(
                    e.target.value === "all"
                      ? "all"
                      : Number(e.target.value)
                  )
                }
                className="w-full sm:w-[260px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="all">All</option>

                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                    {s.title ? ` — ${s.title}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      {kpi && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

  <KpiCard
    title="Compliance"
    value={`${kpi.compliance_percentage ?? 0}%`}
    highlight="text-emerald-400"
  />

  <KpiCard
    title="Total Evidence"
    value={kpi.evidence?.total ?? 0}
    tooltip={
      <div className="space-y-1">
        <div>Total: {kpi.evidence?.total ?? 0}</div>
<div>Approved: {kpi.evidence?.approved ?? 0}</div>
<div>Waiting Approval: {kpi.evidence?.pending ?? 0}</div>
<div>Uploaded: {kpi.evidence?.uploaded ?? 0}</div>
<div>Rejected: {kpi.evidence?.rejected ?? 0}</div>
<div>Linked Controls: {kpi.evidence?.linked ?? 0}</div>
      </div>
    }
  />

  <KpiCard
    title="Approved Evidence"
    value={kpi.evidence?.approved ?? 0}
    highlight="text-blue-400"
  />

  <KpiCard
    title="Critical Risks"
    value={kpi.risk?.critical ?? 0}
    highlight="text-red-400"
  />

</div>
      )}

      {/* MATRIX */}
      {loading ? (
        <div className="text-slate-400">Loading matrix...</div>
      ) : (
       <ComplianceMatrixTable
  rows={rows}
  mode={mode}
  onView={(row: any) => {
    console.log("SELECTED ROW:", row);
    setSelectedRow(row);
  }}
/>
      )}

      {/* WORKSPACE DRAWER */}
     <ComplianceWorkspaceDrawer
  open={selectedRow !== null}
  controlId={selectedRow?.control_id ?? null}
  onClose={() => setSelectedRow(null)}
/>
    </div>
  );
}

function KpiCard({
  title,
  value,
  highlight,
  tooltip,
}: {
  title: string;
  value: any;
  highlight?: string;
  tooltip?: React.ReactNode;
}) {
    return (
    <div className="relative group bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-md">

      <div className="text-xs text-slate-400 uppercase tracking-wide">
        {title}
      </div>

      <div className={`text-2xl font-semibold mt-2 ${highlight ?? ""}`}>
        {value}
      </div>

      {tooltip && (
  <div
    className="
      absolute
      top-full
      left-0
      mt-2
      z-50
      w-52
      rounded-lg
      border
      border-slate-700
      bg-slate-900
      p-3
      text-xs
      text-slate-300
      shadow-xl
      opacity-0
      invisible
      group-hover:opacity-100
      group-hover:visible
      transition
    "
  >
    {tooltip}
  </div>
)}

    </div>
  );
}"use client";
import ComplianceWorkspaceDrawer from "../../components/compliance-workspace/ComplianceWorkspaceDrawer";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ComplianceMatrixTable from "../../components/ComplianceMatrixTable";

type Mode = "control" | "maturity";

type StandardOption = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
};

type MatrixKpi = {
  compliance_percentage?: number;
 evidence?: {
  total?: number;
  approved?: number;
  pending?: number;
  rejected?: number;
  linked?: number;
};
  risk?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

const API_BASE = "http://localhost:8000";

export default function MatrixPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>("control");
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  const [standardId, setStandardId] = useState<number | "all">("all");
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [kpi, setKpi] = useState<MatrixKpi | null>(null);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  const selectedStandard = useMemo(() => {
    if (standardId === "all") return null;
    return standards.find((s) => s.id === standardId) || null;
  }, [standardId, standards]);

  /* ================= FETCH STANDARDS ================= */
  useEffect(() => {
    if (!token) return;

    async function fetchStandards() {
      try {
        const res = await fetch(`${API_BASE}/standards`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        const list: StandardOption[] = Array.isArray(data)
          ? data.map((s: any) => ({
              id: s.id,
              code: s.code,
              title: s.title ?? null,
              type: s.type ?? s.standard_type ?? s.assessment_type ?? null,
            }))
          : [];

        const controlStandards = list.filter(
          (s) => s.type === "CONTROL_BASED"
        );

        controlStandards.sort((a, b) =>
          (a.code || "").localeCompare(b.code || "")
        );

        setStandards(controlStandards);
      } catch (err) {
        console.error("STANDARDS fetch failed:", err);
        setStandards([]);
      }
    }

    fetchStandards();
  }, [token]);

  /* ================= FETCH MATRIX ================= */
  useEffect(() => {
    if (!token) return;

    async function fetchMatrix() {
      try {
        setLoading(true);

        const url =
          standardId === "all"
            ? `${API_BASE}/matrix`
            : `${API_BASE}/matrix?standard_id=${standardId}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const resolvedRows = Array.isArray(data)
          ? data
          : data?.rows ?? [];

        setRows(resolvedRows);
        setMode((data?.mode as Mode) || "control");
      } catch (err) {
        console.error("MATRIX fetch failed:", err);
        setRows([]);
        setMode("control");
      } finally {
        setLoading(false);
      }
    }

    fetchMatrix();
  }, [standardId, token]);

  /* ================= FETCH KPI ================= */
  useEffect(() => {
    if (!token) return;

    async function fetchKpi() {
      try {
        const url =
          standardId === "all"
            ? `${API_BASE}/matrix/kpi`
            : `${API_BASE}/matrix/kpi?standard_id=${standardId}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setKpi(data);
      } catch (err) {
        console.error("KPI fetch failed:", err);
        setKpi(null);
      }
    }

    fetchKpi();
  }, [standardId, token]);

  const instancesHref =
    standardId === "all"
      ? "/matrix/instances"
      : `/matrix/instances?standard_id=${standardId}`;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      
      {/* HEADER */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          {/* LEFT */}
          <div>
            <h1 className="text-xl font-semibold tracking-wide text-white">
              Compliance Matrix
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Mode: <span className="text-slate-200 font-medium">{mode}</span>
              {"  "}•{"  "}
              Rows: <span className="text-slate-200 font-medium">{rows.length}</span>
            </p>
          </div>

          {/* RIGHT */}
          <div className="flex flex-wrap items-center gap-3">

            <Link
              href={instancesHref}
              className="px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
            >
              View Matrices
            </Link>

                       <Link
              href="/matrix/builder"
              className="px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
            >
              Row Builder
            </Link>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto sm:min-w-[260px]">
              <label className="text-xs text-slate-400 whitespace-nowrap">
                Standard
              </label>

              <select
                value={standardId}
                onChange={(e) =>
                  setStandardId(
                    e.target.value === "all"
                      ? "all"
                      : Number(e.target.value)
                  )
                }
                className="w-full sm:w-[260px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="all">All</option>

                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                    {s.title ? ` — ${s.title}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      {kpi && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

  <KpiCard
    title="Compliance"
    value={`${kpi.compliance_percentage ?? 0}%`}
    highlight="text-emerald-400"
  />

  <KpiCard
    title="Total Evidence"
    value={kpi.evidence?.total ?? 0}
    tooltip={
      <div className="space-y-1">
        <div>Total: {kpi.evidence?.total ?? 0}</div>
<div>Approved: {kpi.evidence?.approved ?? 0}</div>
<div>Waiting Approval: {kpi.evidence?.pending ?? 0}</div>
<div>Uploaded: {kpi.evidence?.uploaded ?? 0}</div>
<div>Rejected: {kpi.evidence?.rejected ?? 0}</div>
<div>Linked Controls: {kpi.evidence?.linked ?? 0}</div>
      </div>
    }
  />

  <KpiCard
    title="Approved Evidence"
    value={kpi.evidence?.approved ?? 0}
    highlight="text-blue-400"
  />

  <KpiCard
    title="Critical Risks"
    value={kpi.risk?.critical ?? 0}
    highlight="text-red-400"
  />

</div>
      )}

      {/* MATRIX */}
      {loading ? (
        <div className="text-slate-400">Loading matrix...</div>
      ) : (
       <ComplianceMatrixTable
  rows={rows}
  mode={mode}
  onView={(row: any) => {
    console.log("SELECTED ROW:", row);
    setSelectedRow(row);
  }}
/>
      )}

      {/* WORKSPACE DRAWER */}
     <ComplianceWorkspaceDrawer
  open={selectedRow !== null}
  controlId={selectedRow?.control_id ?? null}
  onClose={() => setSelectedRow(null)}
/>
    </div>
  );
}

function KpiCard({
  title,
  value,
  highlight,
  tooltip,
}: {
  title: string;
  value: any;
  highlight?: string;
  tooltip?: React.ReactNode;
}) {
    return (
    <div className="relative group bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-md">

      <div className="text-xs text-slate-400 uppercase tracking-wide">
        {title}
      </div>

      <div className={`text-2xl font-semibold mt-2 ${highlight ?? ""}`}>
        {value}
      </div>

      {tooltip && (
  <div
    className="
      absolute
      top-full
      left-0
      mt-2
      z-50
      w-52
      rounded-lg
      border
      border-slate-700
      bg-slate-900
      p-3
      text-xs
      text-slate-300
      shadow-xl
      opacity-0
      invisible
      group-hover:opacity-100
      group-hover:visible
      transition
    "
  >
    {tooltip}
  </div>
)}

    </div>
  );
}
