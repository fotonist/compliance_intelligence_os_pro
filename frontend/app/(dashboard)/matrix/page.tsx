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
    uploaded?: number;
    rejected?: number;
    linked?: number;
}
  risk?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

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
