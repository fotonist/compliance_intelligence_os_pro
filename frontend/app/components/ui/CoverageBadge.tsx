"use client";

import React from "react";

type CoverageStatus =
  | "COVERED"
  | "PREDICTED_GAP"
  | "UNDER_REMEDIATION"
  | "NOT_COVERED"
  | string;

interface Props {
  status?: CoverageStatus | null;
  size?: "sm" | "md";
}

const config: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    description: string;
  }
> = {
  COVERED: {
    label: "Covered",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    description: "Approved evidence exists for this control.",
  },
  PREDICTED_GAP: {
    label: "Predicted Gap",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    description: "An open gap has been identified for this control.",
  },
  UNDER_REMEDIATION: {
    label: "Under Remediation",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    description:
      "A remediation task is currently open or in progress for this control.",
  },
  NOT_COVERED: {
    label: "Not Covered",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    description:
      "No evidence, gap, or remediation task exists for this control.",
  },
};

export default function CoverageBadge({ status, size = "md" }: Props) {
  const key = status && config[status] ? status : "NOT_COVERED";
  const item = config[key];

  const padding =
    size === "sm"
      ? "px-2 py-0.5 text-xs"
      : "px-3 py-1 text-sm";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full border font-medium ${padding} ${item.bg} ${item.text} ${item.border}`}
        title={item.description}
      >
        {item.label}
      </span>
    </div>
  );
}