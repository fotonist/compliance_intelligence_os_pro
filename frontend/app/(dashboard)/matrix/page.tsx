
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

type MatrixKpi = {
  compliance_percentage?: number;

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

  const [standardId, setStandardId] =
    useState<number | "all">("all");

  const [standards, setStandards] =
    useState<StandardOption[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [kpi, setKpi] =
    useState<MatrixKpi | null>(null);

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


  const selectedStandard = useMemo(() => {
    if (standardId === "all")
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
              (s:any)=>
                s.type==="CONTROL_BASED"
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

    if (!token)
      return;


    async function loadMatrix(){

      try{

        setLoading(true);

        const url =
          standardId==="all"
          ? `${API_BASE}/matrix/`
          : `${API_BASE}/matrix/?standard_id=${standardId}`;


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


        setRows(
          Array.isArray(data)
          ? data
          : data.rows ?? []
        );


        setMode(
          data.mode ?? "control"
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

    if (!token)
      return;


    async function loadKpi(){

      try{

        const url =
          standardId==="all"
          ? `${API_BASE}/matrix/kpi`
          : `${API_BASE}/matrix/kpi?standard_id=${standardId}`;


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
    standardId==="all"
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

              <p className="mt-2 text-sm text-slate-500">
                Enterprise control coverage, evidence assurance and risk intelligence workspace.
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

                <span className="rounded-full border px-3 py-1 text-xs">
                  Rows: {rows.length}
                </span>

              </div>

            </div>


            <div className="flex flex-wrap gap-3">

              <Link
                href={instancesHref}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Matrix Instances
              </Link>


              <Link
                href="/matrix/builder"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
              >
                Matrix Builder
              </Link>


            </div>


          </div>

        </div>


        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">


          <KpiCard
            title="Compliance Health"
            value={`${kpi?.compliance_percentage ?? 0}%`}
          />


          <KpiCard
            title="Evidence Assurance"
            value={`${getEvidenceAssurance(kpi)}%`}
          />


          <KpiCard
            title="Risk Exposure"
            value={getRiskExposure(kpi)}
          />


          <KpiCard
            title="Control Coverage"
            value={`${getControlCoverage(kpi)}%`}
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




