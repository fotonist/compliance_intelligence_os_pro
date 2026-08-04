"use client";

import { useState } from "react";
import MaturityLinkedEvidenceList from "./MaturityLinkedEvidenceList";

/* =======================
   TYPES
======================= */

export type LinkedEvidence = {
  id: number;
  title: string;
  status?: string | null;
  files_count?: number;
};

export type MaturityRow = {
  id: number;
  process_area_id: number;
  process_area_name: string;
  practice_code: string;
  practice_title: string;
  evidences?: LinkedEvidence[];
};

type Props = {
  rows?: MaturityRow[];
  auditMode?: boolean;
  onUpdated?: () => Promise<void> | void;
  onAddEvidence?: (practiceId: number) => void;
  onLinkEvidence?: (practiceId: number) => void;
};

/* =======================
   COMPONENT
======================= */

export default function MaturityPracticeTable({
  rows = [],
  auditMode = false,
  onUpdated,
  onAddEvidence,
  onLinkEvidence,
}: Props) {
  const [expandedArea, setExpandedArea] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="text-sm text-slate-400 border border-slate-800 rounded-lg p-6">
        Practice bulunamadı.
      </div>
    );
  }

  const grouped = rows.reduce<Record<number, MaturityRow[]>>((acc, row) => {
    acc[row.process_area_id] = acc[row.process_area_id] || [];
    acc[row.process_area_id].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([areaId, practices]) => {
        const areaName = practices[0].process_area_name;
        const isOpen = expandedArea === Number(areaId);

        return (
          <div
            key={areaId}
            className="border border-slate-800 rounded-xl bg-slate-900/40"
          >
            {/* ===== Process Area Header ===== */}
            <button
              type="button"
              onClick={() =>
                setExpandedArea(isOpen ? null : Number(areaId))
              }
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-900 transition"
            >
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {areaName}
                </div>
                <div className="text-xs text-slate-400">
                  {practices.length} practice
                </div>
              </div>

              <span className="text-xs text-slate-500">
                {isOpen ? "Collapse" : "Expand"}
              </span>
            </button>

            {/* ===== Practices ===== */}
            {isOpen && (
              <div className="divide-y divide-slate-800">
                {practices.map((p) => (
                  <div
                    key={p.id}
                    className="px-5 py-4 hover:bg-slate-900/60 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-400">
                          {p.practice_code}
                        </div>
                        <div className="text-sm font-medium text-slate-100">
                          {p.practice_title}
                        </div>
                      </div>

                      {!auditMode && (
                        <div className="flex gap-2">
                          {onAddEvidence && (
                            <button
                              onClick={() => onAddEvidence(p.id)}
                              className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                            >
                              + Evidence
                            </button>
                          )}

                          {onLinkEvidence && (
                            <button
                              onClick={() => onLinkEvidence(p.id)}
                              className="text-xs px-3 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
                            >
                              Link
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ===== Evidence List ===== */}
                    <div className="mt-3">
                      <MaturityLinkedEvidenceList
                        evidences={p.evidences ?? []}
                        auditMode={auditMode}
                        onUpdated={onUpdated}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
