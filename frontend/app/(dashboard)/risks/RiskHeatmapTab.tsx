// C:\Projects\compliance_app\frontend\app\(dashboard)\risks\RiskHeatmapTab.tsx
"use client";

type Props = {
  likelihood?: number;
  impact?: number;
};

export default function RiskHeatmapTab({ likelihood, impact }: Props) {
  const L = Math.min(Math.max(likelihood ?? 0, 1), 5);
  const I = Math.min(Math.max(impact ?? 0, 1), 5);

  return (
    <div className="inline-block border border-slate-700 rounded p-3 bg-slate-900">
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 25 }).map((_, idx) => {
          const row = 5 - Math.floor(idx / 5);
          const col = (idx % 5) + 1;
          const active = row === I && col === L;

          return (
            <div
              key={idx}
              className={[
                "w-8 h-8 border border-slate-700",
                active ? "bg-red-600" : "bg-slate-800",
              ].join(" ")}
              title={`L:${col} I:${row}`}
            />
          );
        })}
      </div>
      <div className="mt-2 text-xs text-slate-400">
        L={L} · I={I}
      </div>
    </div>
  );
}
