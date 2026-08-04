type Props = {
  label: string;
  color?:
    | "risk"
    | "control"
    | "task"
    | "evidence"
    | "intel"
    | "default";
};

const colorMap = {
  risk: "bg-red-600",
  control: "bg-blue-600",
  task: "bg-green-600",
  evidence: "bg-yellow-600",
  intel: "bg-purple-600",
  default: "bg-slate-600",
};

export default function TabBadge({
  label,
  color = "default",
}: Props) {
  return (
    <span
      className={`
        text-xs
        font-semibold
        px-2
        py-0.5
        rounded
        text-white
        ${colorMap[color]}
      `}
    >
      {label}
    </span>
  );
}