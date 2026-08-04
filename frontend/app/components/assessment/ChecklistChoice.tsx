"use client";

type Props = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export default function ChecklistChoice({
  label,
  checked,
  disabled,
  onSelect,
}: Props) {
  return (
    <label
      className={[
        "flex items-center gap-2 px-3 py-1 rounded-full text-xs border cursor-pointer select-none",
        checked
          ? "border-blue-500 bg-blue-500/15 text-blue-200"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
        disabled && "opacity-50 cursor-not-allowed",
      ]
        .filter(Boolean)
        .join(" ")}
      role="radio"
      aria-checked={checked}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      {label}
    </label>
  );
}
