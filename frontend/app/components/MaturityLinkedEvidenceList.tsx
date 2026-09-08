"use client";

import { useRouter } from "next/navigation";
import EvidenceStatusBadge from "./EvidenceStatusBadge";

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
  const router = useRouter();

  if (!evidences || evidences.length === 0) {
    return (
      <div className="mt-1 text-xs text-gray-500">
        No linked evidence
      </div>
    );
  }

  function openEvidence(evidenceId: number) {
    router.push(`/evidences/${evidenceId}`);
  }

  return (
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

            {!auditMode && ev.status !== "approved" && (
              <button
                type="button"
                onClick={() => openEvidence(ev.id)}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
              >
                Review
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
