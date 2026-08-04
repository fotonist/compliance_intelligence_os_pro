// frontend/app/constants/evidenceStatus.ts

export const EVIDENCE_STATUS_OPTIONS = [
  "Pending",
  "Waiting Approval",
  "In Review",
  "Approved",
  "Rejected",
  "Uploaded",
  "Not Applicable",
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUS_OPTIONS)[number];

export const EVIDENCE_STATUS_COLORS: Record<EvidenceStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Waiting Approval": "bg-amber-100 text-amber-800 border-amber-200",
  "In Review": "bg-blue-100 text-blue-800 border-blue-200",
  Approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  Uploaded: "bg-sky-100 text-sky-800 border-sky-200",
  "Not Applicable": "bg-gray-100 text-gray-700 border-gray-200",
};
