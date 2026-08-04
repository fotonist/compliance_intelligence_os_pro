"use client";

type Props = {
  score: number;
};

function levelMeta(score: number) {
  if (score >= 1 && score <= 3)
    return {
      label: "Very Low",
      bg: "rgba(0, 180, 90, 0.18)",
      border: "rgba(45, 212, 163, 0.35)",
    };

  if (score > 3 && score <= 6)
    return {
      label: "Low",
      bg: "rgba(180, 200, 0, 0.18)",
      border: "rgba(230, 217, 76, 0.35)",
    };

  // 🟡 MEDIUM — amber / sarıya yakın
  if (score > 6 && score <= 10)
    return {
      label: "Medium",
      bg: "rgba(245, 190, 65, 0.22)",   // daha sarı
      border: "rgba(245, 190, 65, 0.45)",
    };

  // 🟠 HIGH — kırmızıya daha yakın turuncu
  if (score > 10 && score <= 15)
    return {
      label: "High",
      bg: "rgba(255, 120, 60, 0.22)",   // daha sıcak / kırmızıya yakın
      border: "rgba(255, 120, 60, 0.45)",
    };

  if (score > 15 && score <= 25)
    return {
      label: "Critical",
      bg: "rgba(220, 38, 38, 0.20)",
      border: "rgba(248, 113, 113, 0.4)",
    };

  return {
    label: "Unknown",
    bg: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.2)",
  };
}

export default function RiskLevelBadge({ score }: Props) {
  const meta = levelMeta(score);

  return (
    <span
      style={{
        backgroundColor: meta.bg,
        color: "#ffffff", // metin beyaz
        border: `1px solid ${meta.border}`,
        padding: "6px 14px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "84px",
        textAlign: "center",
        lineHeight: 1,
        backdropFilter: "blur(2px)",
      }}
    >
      {meta.label}
    </span>
  );
}
