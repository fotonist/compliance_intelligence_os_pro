type Props = {
  status?: string | null;
};

export default function EvidenceStatusBadge({
  status,
}: Props) {
  const map: Record<
    string,
    { label: string; className: string }
  > = {
    draft: {
      label: "Draft",
      className: "bg-gray-500",
    },
    waiting_approval: {
      label: "Waiting Approval",
      className: "bg-yellow-500",
    },
    approved: {
      label: "Approved",
      className: "bg-green-600",
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-600",
    },
  };

  const cfg =
    (status && map[status]) || map["draft"];

  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded text-white ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
