type Props = {
  status?: string | null;
  size?: "sm" | "md";
};

export default function EvidenceStatusBadge({
  status,
  size = "md",
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

  const cfg = (status && map[status]) || map["draft"];

  const sizeClass =
    size === "sm"
      ? "text-[10px] px-2 py-0.5"
      : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center rounded font-medium text-white ${sizeClass} ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
