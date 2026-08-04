type Props = {
  label: string;
  variant: "success" | "warning" | "danger" | "info";
};

const MAP = {
  success: "bg-emerald-600/20 text-emerald-400 border border-emerald-600/40",
  warning: "bg-amber-600/20 text-amber-400 border border-amber-600/40",
  danger: "bg-red-600/20 text-red-400 border border-red-600/40",
  info: "bg-blue-600/20 text-blue-400 border border-blue-600/40",
};

export default function SeverityBadge({ label, variant }: Props) {
  return (
    <span
      className={`px-2.5 py-1 text-xs rounded-full font-medium ${MAP[variant]}`}
    >
      {label}
    </span>
  );
}
