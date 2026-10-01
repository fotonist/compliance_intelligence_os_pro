"use client";

import { useState } from "react";
import EvidenceStatusBadge from "./EvidenceStatusBadge";
import EvidenceApprovalModal from "./EvidenceApprovalModal";

/* =======================
   TYPES
======================= */

type Evidence = {
  id: number;
  title: string;
  status?: string | null;
  files_count?: number;
};

type Props = {
  evidences: Evidence[];
  auditMode?: boolean;
  onUpdated?: () => Promise<void> | void;
};

/* =======================
   COMPONENT
======================= */

export default function MaturityLinkedEvidenceList({
  evidences,
  auditMode = false,
  onUpdated,
}: Props) {
  const [selectedEvidenceId, setSelectedEvidenceId] =
    useState<number | null>(null);

  if (!evidences || evidences.length === 0) {
    return (
      <div className="mt-1 text-xs text-gray-500">
        Linked evidence yok
      </div>
    );
  }

  return (
    <>
      <ul className="mt-2 space-y-1">
        {evidences.map((ev) => (
          <li
            key={ev.id}
            className="flex items-center justify-between bg-slate-800 rounded px-2 py-1 text-xs"
          >
            <div className="flex items-center gap-2">
              <span>{ev.title}</span>
              <EvidenceStatusBadge status={ev.status} />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-400">
                {ev.files_count ?? 0} files
              </span>

              {!auditMode &&
                ev.status !== "approved" && (
                  <button
                    onClick={() =>
                      setSelectedEvidenceId(ev.id)
                    }
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                  >
                    Review
                  </button>
                )}
            </div>
          </li>
        ))}
      </ul>

      {selectedEvidenceId !== null && (
        <EvidenceApprovalModal
          evidenceId={selectedEvidenceId}
          onClose={() => setSelectedEvidenceId(null)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}
