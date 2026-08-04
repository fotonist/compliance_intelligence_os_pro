"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

type WorkspaceSession = {
  id: number;
  standard_id: number;
  name: string;
  scope: string | null;
  status: string;
  created_at: string;
  process_area_id: number | null;
};

export default function MaturityWorkspaceEntryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    async function loadAndRedirect() {
      try {
        const res = await fetch(
          `${API_BASE}/maturity/workspace/sessions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error("Workspace sessions alınamadı");
        }

        const sessions: WorkspaceSession[] = await res.json();

        const activeSession = sessions.find(
          (s) => s.status === "active"
        );

        if (!activeSession) {
          setError("Aktif maturity workspace session bulunamadı.");
          setLoading(false);
          return;
        }

        router.replace(`/maturity/workspace/${activeSession.id}`);
      } catch (e) {
        setError("Workspace yüklenirken hata oluştu.");
        setLoading(false);
      }
    }

    loadAndRedirect();
  }, [router]);

  if (loading) {
    return (
      <div className="p-6 text-slate-400 text-sm">
        Loading maturity workspace…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-rose-400 text-sm">
        {error}
      </div>
    );
  }

  return null;
}