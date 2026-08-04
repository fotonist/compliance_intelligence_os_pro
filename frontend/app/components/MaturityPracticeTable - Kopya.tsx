"use client";

import { useState } from "react";
import MaturityLinkedEvidenceList from "./MaturityLinkedEvidenceList";

/* =======================
   TYPES
======================= */

export type LinkedEvidence = {
  id: number;
  title: string;
  status?: string;
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
  onAddEvidence?: (practiceId: number) => void;
  onLinkEvidence?: (practiceId: number) => void;
};

/* =======================
   COMPONENT
======================= */

export default function MaturityPracticeTable({
  rows,
  onAddEvidence,
  onLinkEvidence,
}: Props) {
  const [expandedArea, setExpandedArea] = useState<number | null>(null);

  const safeRows: MaturityRow[] = rows ?? [];

  const grouped = safeRows.reduce<Record<number, MaturityRow[]>>(
    (acc, row) => {
      acc[row.process_area_id] = acc[row.process_area_id] || [];
      acc[row.process_area_id].push(row);
      return acc;
    },
    {}
  );

  if (safeRows.length === 0) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Practice bulunamadı.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([areaId, practices]) => {
        const processAreaId = Number(areaId);
        const areaName = practices[0]?.process_area_name;
        const isOpen = expandedArea === processAreaId;

        return (
          <div
            key={processAreaId}
            className="border rounded-lg bg-white overflow-hidden"
          >
            {/* PROCESS AREA HEADER */}
            <button
              type="button"
              onClick={() =>
                setExpandedArea(
                  isOpen ? null : processAreaId
                )
              }
              className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100"
            >
              <span className="font-medium text-sm">
                {areaName}
              </span>
              <span className="text-xs text-gray-500">
                {practices.length} practice
              </span>
            </button>

            {/* PRACTICES */}
            {isOpen && (
              <div className="divide-y">
                {practices.map((practice) => (
                  <div
                    key={practice.id}
                    className="px-4 py-3 text-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          {practice.practice_code}
                        </div>
                        <div className="text-gray-500">
                          {practice.practice_title}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {onAddEvidence && (
                          <button
                            onClick={() =>
                              onAddEvidence(practice.id)
                            }
                            className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            + Evidence
                          </button>
                        )}

                        {onLinkEvidence && (
                          <button
                            onClick={() =>
                              onLinkEvidence(practice.id)
                            }
                            className="text-xs px-3 py-1 rounded border hover:bg-gray-50"
                          >
                            Link
                          </button>
                        )}
                      </div>
                    </div>

                    {/* LINKED EVIDENCES */}
                    <MaturityLinkedEvidenceList
                      evidences={practice.evidences ?? []}
                    />
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
