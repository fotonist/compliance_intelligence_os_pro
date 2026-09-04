
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
  version?: string | null;
};

type FrameworkAdoption = {
  id: number;
  tenant_id?: number;
  standard_id: number;
  standard_version_id: number;
  status: string;
  applicability?: string | null;
  effective_date?: string | null;
  process_ids?: number[];
};

type MatrixKpi = {
  mode?: "control" | "maturity";
  matrix_instance_id?: number;
  standard_id?: number;
  standard_version_id?: number;

  compliance_percentage?: number;

  maturity?: {
    total?: number;
    achieved?: number;
    partial?: number;
    not_achieved?: number;
  };

  controls?: {
    total?: number;
    covered?: number;
    partial?: number;
    not_covered?: number;
  };

  evidence?: {
    total?: number;
    approved?: number;
    pending?: number;
    uploaded?: number;
    rejected?: number;
    draft?: number;
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

const API_BASE = "http://127.0.0.1:8000";

function getEvidenceAssurance(kpi: MatrixKpi | null) {
  const total = kpi?.evidence?.total ?? 0;

  if (!total) return 0;

  return Math.round(
    ((kpi?.evidence?.approved ?? 0) / total) * 100
  );
}

function getRiskExposure(kpi: MatrixKpi | null) {
  return (
    (kpi?.risk?.critical ?? 0) +
    (kpi?.risk?.high ?? 0)
  );
}

function getMaturityStatus(kpi: MatrixKpi | null) {
  const total = kpi?.maturity?.total ?? 0;

  if (!total) {
    return {
      total: 0,
      achieved: 0,
      partial: 0,
      notAchieved: 0,
    };
  }

  return {
    total,
    achieved: kpi?.maturity?.achieved ?? 0,
    partial: kpi?.maturity?.partial ?? 0,
    notAchieved: kpi?.maturity?.not_achieved ?? 0,
  };
}
function getControlCoverage(kpi: MatrixKpi | null) {
  const total = kpi?.controls?.total ?? 0;

  if (!total) return 0;

  const covered =
    (kpi?.controls?.covered ?? 0) +
    (kpi?.controls?.partial ?? 0);

  return Number(
    ((covered / total) * 100).toFixed(1)
  );
}
export default function MatrixPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>("control");

  const [selectedRow, setSelectedRow] =
    useState<any | null>(null);

  const [assessmentType, setAssessmentType] =
    useState<Mode>("control");

  const [standardId, setStandardId] =
    useState<number | null>(null);

  const [standards, setStandards] =
    useState<StandardOption[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [kpi, setKpi] =
    useState<MatrixKpi | null>(null);

  const [adoption, setAdoption] =
    useState<FrameworkAdoption | null>(null);

  const [adoptionVersionCode, setAdoptionVersionCode] =
    useState<string | null>(null);

  const [adoptionVersionStatus, setAdoptionVersionStatus] =
    useState<string | null>(null);

  const [adoptionLoading, setAdoptionLoading] =
    useState(false);


  const [token, setToken] =
    useState("");


  useEffect(() => {
    if (typeof window === "undefined")
      return;

    setToken(
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      ""
    );
  }, []);


  const filteredStandards = useMemo(() => {
    const expectedType =
      assessmentType === "control"
        ? "CONTROL_BASED"
        : "MATURITY_BASED";

    return standards.filter(
      (standard) =>
        String(standard.type ?? "").toUpperCase() === expectedType
    );
  }, [standards, assessmentType]);


  const selectedStandard = useMemo(() => {
    if (standardId === null)
      return null;

    return standards.find(
      (s) => s.id === standardId
    ) ?? null;

  }, [standardId, standards]);
useEffect(() => {

    if (!token)
      return;

    async function loadStandards(){

      try{

        const res =
          await fetch(
            `${API_BASE}/standards/`,
            {
              headers:{
                Authorization:`Bearer ${token}`
              }
            }
          );

        const data =
          await res.json();

        setStandards(
          Array.isArray(data)
            ? data.filter(
                (s: any) =>
                  s.type === "CONTROL_BASED" ||
                  s.type === "MATURITY_BASED"
              )
            : []
        );

      }catch(err){

        console.error(
          "standards load failed",
          err
        );

        setStandards([]);

      }

    }

    loadStandards();

  },[token]);
useEffect(() => {
    setStandardId(null);
    setRows([]);
    setKpi(null);
    setAdoption(null);
    setAdoptionVersionCode(null);
  }, [assessmentType]);


  useEffect(() => {
    if (!token || standardId === null) {
      setAdoption(null);
      setAdoptionVersionCode(null);
      return;
    }

    async function loadAdoption() {
      try {
        setAdoptionLoading(true);

        const adoptionRes = await fetch(
          `${API_BASE}/framework/standards/${standardId}/adoption`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!adoptionRes.ok) {
          throw new Error(
            `Adoption request failed: ${adoptionRes.status}`
          );
        }

        const adoptionData = await adoptionRes.json();

        const adoptions: FrameworkAdoption[] =
          Array.isArray(adoptionData)
            ? adoptionData
            : [];

        const activeAdoption =
          adoptions.find(
            (item) =>
              String(item.status ?? "").toUpperCase() === "ACTIVE"
          ) ?? null;

        setAdoption(activeAdoption);

        if (!activeAdoption) {
          setAdoptionVersionCode(null);
          return;
        }

        const versionsRes = await fetch(
          `${API_BASE}/framework/standards/${standardId}/versions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!versionsRes.ok) {
          throw new Error(
            `Version request failed: ${versionsRes.status}`
          );
        }

        const versionsData = await versionsRes.json();

        const versions = Array.isArray(versionsData)
          ? versionsData
          : Array.isArray(versionsData?.versions)
            ? versionsData.versions
            : [];

        const adoptedVersion = versions.find(
          (version: any) =>
            Number(version.id) ===
            Number(activeAdoption.standard_version_id)
        );

        setAdoptionVersionCode(
          adoptedVersion?.version_code ??
          adoptedVersion?.version ??
          null
        );

        setAdoptionVersionStatus(
          adoptedVersion?.status
            ? String(adoptedVersion.status).toUpperCase()
            : null
        );
      } catch (err) {
        console.error(
          "framework adoption load failed",
          err
        );

        setAdoption(null);
        setAdoptionVersionCode(null);
      } finally {
        setAdoptionLoading(false);
      }
    }

    loadAdoption();
  }, [token, standardId]);


  useEffect(() => {
    if (!token || standardId === null)
      return;

    async function loadMatrix(){

      try{

        setLoading(true);

        const url =
          `${API_BASE}/matrix/?standard_id=${standardId}`;


        const res =
          await fetch(
            url,
            {
              headers:{
                Authorization:`Bearer ${token}`
              }
            }
          );


        const data =
          await res.json();


        const resolvedRows = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

        setRows(resolvedRows);

        setMode(
          data?.mode === "maturity"
            ? "maturity"
            : "control"
        );


      }catch(err){

        console.error(
          "matrix load failed",
          err
        );

        setRows([]);

      }
      finally{
        setLoading(false);
      }

    }


    loadMatrix();

  },[
    token,
    standardId
  ]);
useEffect(() => {

    if (!token || standardId === null) {
      setKpi(null);
      return;
    }

    async function loadKpi(){

      try{
        const url =
          `${API_BASE}/matrix/kpi?standard_id=${standardId}`;


        const res =
          await fetch(
            url,
            {
              headers:{
                Authorization:`Bearer ${token}`
              }
            }
          );


        setKpi(
          await res.json()
        );


      }catch(err){

        console.error(
          "kpi load failed",
          err
        );

        setKpi(null);

      }

    }


    loadKpi();

  },[
    token,
    standardId
  ]);


  const instancesHref =
    standardId === null
      ? "/matrix/instances"
      : `/matrix/instances?standard_id=${standardId}`;
  return (
    <div className="min-h-full bg-slate-50 p-8 text-slate-900">

      <div className="mx-auto max-w-[1500px] space-y-6">


        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">

            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">
                Compliance Intelligence Platform
              </div>

              <h1 className="mt-2 text-2xl font-semibold">
                Compliance Matrix
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                <span className="font-medium text-slate-800">
                  {selectedStandard?.title || selectedStandard?.code || "Standard"}
                </span>

                <span className="text-slate-300">?</span>

                <span>
                  {adoptionVersionCode
                    ? `Version ${adoptionVersionCode}`
                    : "Version not resolved"}
                </span>

                {adoptionVersionStatus && (
                  <>
                    <span className="text-slate-300">?</span>
                    <span className="font-medium text-slate-700">
                      {adoptionVersionStatus}
                    </span>
                  </>
                )}

                {adoption && (
                  <>
                    <span className="text-slate-300">?</span>
                    <span className="font-semibold text-emerald-700">
                      {String(adoption.status).toUpperCase()}
                    </span>
                  </>
                )}

                {!adoption && !adoptionLoading && (
                  <>
                    <span className="text-slate-300">?</span>
                    <span className="font-medium text-amber-700">
                      No Active Adoption
                    </span>
                  </>
                )}
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Tenant operational compliance view for the adopted framework version.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">

                <span className="rounded-full border px-3 py-1 text-xs">
                  Mode: {mode === "control" ? "Control Based" : "Maturity Based"}
                </span>

                {selectedStandard && (
                  <span className="rounded-full border px-3 py-1 text-xs">
                    {selectedStandard.code}
                  </span>
                )}

                {adoptionVersionCode && (
                  <span className="rounded-full border px-3 py-1 text-xs">
                    Version: {adoptionVersionCode}
                  </span>
                )}

                {adoption && (
                  <span className="rounded-full border px-3 py-1 text-xs">
                    Adoption: #{adoption.id}
                  </span>
                )}

                {adoption && (
                  <span className="rounded-full border px-3 py-1 text-xs">
                    {String(adoption.status).toUpperCase()}
                  </span>
                )}

                <span className="rounded-full border px-3 py-1 text-xs">
                  Rows: {rows.length}
                </span>

              </div>

            </div>


            <div className="flex flex-col items-stretch gap-3 sm:items-end">

              <div className="flex flex-col gap-2 sm:flex-row">

                <div className="min-w-[190px]">
                  <label
                    htmlFor="matrix-assessment-type"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Assessment Type
                  </label>

                  <select
                    id="matrix-assessment-type"
                    value={assessmentType}
                    onChange={(e) =>
                      setAssessmentType(e.target.value as Mode)
                    }
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="control">
                      Control Based
                    </option>

                    <option value="maturity">
                      Maturity Based
                    </option>
                  </select>
                </div>


                <div className="min-w-[220px]">
                  <label
                    htmlFor="matrix-standard"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Standard
                  </label>

                  <select
                    id="matrix-standard"
                    value={standardId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;

                      setStandardId(
                        value ? Number(value) : null
                      );
                    }}
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="">
                      Select standard
                    </option>

                    {filteredStandards.map((standard) => (
                      <option
                        key={standard.id}
                        value={standard.id}
                      >
                        {standard.code}
                        {standard.title
                          ? ` — ${standard.title}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

              </div>


              <div className="flex flex-wrap justify-end gap-2">

                <Link
                  href={instancesHref}
                  className="inline-flex h-9 items-center border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Matrix Instances
                </Link>


                <Link
                  href="/matrix/builder"
                  className="inline-flex h-9 items-center bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
                >
                  Matrix Builder
                </Link>

              </div>

            </div>


          </div>

        </div>


        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

  <KpiCard
    title={mode === "maturity" ? "Maturity Health" : "Compliance Health"}
    value={`${kpi?.compliance_percentage ?? 0}%`}
  />

  <KpiCard
    title={mode === "maturity" ? "Achieved Practices" : "Evidence Assurance"}
    value={
      mode === "maturity"
        ? getMaturityStatus(kpi).achieved
        : `${getEvidenceAssurance(kpi)}%`
    }
  />

  <KpiCard
    title={mode === "maturity" ? "Partial Practices" : "Risk Exposure"}
    value={
      mode === "maturity"
        ? getMaturityStatus(kpi).partial
        : getRiskExposure(kpi)
    }
  />

  <KpiCard
    title={mode === "maturity" ? "Not Achieved" : "Control Coverage"}
    value={
      mode === "maturity"
        ? getMaturityStatus(kpi).notAchieved
        : `${getControlCoverage(kpi)}%`
    }
  />

</div>

<div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">


          {loading ? (

            <div className="p-10 text-center text-sm text-slate-500">
              Loading compliance intelligence...
            </div>

          ) : rows.length === 0 ? (

            <div className="p-10 text-center">

              <div className="text-lg font-semibold">
                No Compliance Matrix Available
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Generate the matrix from the standard structure before assessment.
              </p>


              <Link
                href="/matrix/builder"
                className="inline-block mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Build Matrix
              </Link>

            </div>

          ) : (

            <ComplianceMatrixTable
              rows={rows}
              mode={mode}
              onView={(row:any)=>{
                setSelectedRow(row);
              }}
            />

          )}


        </div>



        <ComplianceWorkspaceDrawer
          open={selectedRow !== null}
          controlId={selectedRow?.control_id ?? null}
          row={selectedRow}
          mode={mode}
          onClose={() => setSelectedRow(null)}
        />


      </div>

    </div>
  );
}



function KpiCard({
  title,
  value,
}:{
  title:string;
  value:any;
}){

  return (

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="text-xs uppercase tracking-wider text-slate-400">
        {title}
      </div>


      <div className="mt-3 text-3xl font-semibold text-slate-900">
        {value}
      </div>


    </div>

  );

}
