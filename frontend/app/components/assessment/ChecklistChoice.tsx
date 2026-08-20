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
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer select-none transition-colors",
        checked
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
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
