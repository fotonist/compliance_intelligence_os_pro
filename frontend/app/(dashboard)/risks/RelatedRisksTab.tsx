// C:\Projects\compliance_app\frontend\app\(dashboard)\risks\RelatedRisksTab.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RelatedRisk = {
  id: number;
  title: string;
  score: number;
  risk_level?: string | null;
  relation_reason?: string | null; // backend gelirse
};

type Props = {
  riskId: number;
};

const API_BASE = "http://localhost:8000";

// 🔴 FRONTEND FALLBACK İLİŞKİ AÇIKLAMALARI
function explainRelation(title: string): string {
  const t = title.toLowerCase();

  if (t.includes("phishing")) {
    return "Phishing saldırıları kimlik bilgilerini ele geçirerek diğer riskleri tetikleyebilir.";
  }
  if (t.includes("unauthorized")) {
    return "Phishing veya zayıf kimlik doğrulama sonucunda yetkisiz erişim oluşabilir.";
  }
  if (t.includes("privilege")) {
    return "Ele geçirilen hesaplar üzerinden yetki yükseltme mümkündür.";
  }
  if (t.includes("ransomware")) {
    return "Phishing ile zararlı yazılım bulaştırılarak ransomware saldırıları gerçekleşebilir.";
  }
  if (t.includes("data leakage")) {
    return "Yetkisiz erişim sonrası hassas veriler sızdırılabilir.";
  }
  if (t.includes("outage")) {
    return "Yetkili sistemlere erişim sonrası hizmet kesintisi yaşanabilir.";
  }

  return "Bu risk, mevcut riskle ortak tehdit vektörleri veya etki alanları paylaşmaktadır.";
}

export default function RelatedRisksTab({ riskId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RelatedRisk[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [riskId]);

  async function load() {
    setLoading(true);
    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE}/risks/${riskId}/related`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (!res.ok) {
        setRows([]);
        return;
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-slate-400">Loading…</div>;
  if (rows.length === 0)
    return <div className="text-slate-400">No related risks.</div>;

  return (
    <div className="border border-slate-700 rounded bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-800">
          <tr>
            <th className="p-2 text-left">Title</th>
            <th className="p-2 text-center">Score</th>
            <th className="p-2 text-center">Level</th>
            <th className="p-2 text-left">Relation Explanation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-slate-700 hover:bg-slate-800 cursor-pointer"
              onClick={() => router.push(`/risks/${r.id}`)}
            >
              <td className="p-2">{r.title}</td>
              <td className="p-2 text-center font-semibold">{r.score}</td>
              <td className="p-2 text-center">{r.risk_level ?? "-"}</td>
              <td className="p-2 text-slate-300">
                {r.relation_reason ?? explainRelation(r.title)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
