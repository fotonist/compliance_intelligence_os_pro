"use client";

import { useEffect, useRef, useState } from "react";

type AIInsight = {
  summary: string;
  root_causes: string[];
  warnings: string[];
  actions: string[];
};

type Params = {
  periodDays: number;
  kpis: Record<string, any> | null;
};

export function useDashboardAIInsight({ periodDays, kpis }: Params) {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aynı KPI payload ile tekrar çağrı yapılmasını engeller
  const lastPayloadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!kpis) return;

    const payload = {
      period_days: periodDays,
      kpis,
    };

    const payloadKey = JSON.stringify(payload);

    // Cache hit → tekrar çağırma
    if (lastPayloadRef.current === payloadKey) {
      return;
    }

    lastPayloadRef.current = payloadKey;
    setLoading(true);
    setError(null);

    const token =
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/dashboard/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error("AI insight request failed");
        }
        return r.json();
      })
      .then(setInsight)
      .catch((e) => {
        console.error(e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [kpis, periodDays]);

  const refresh = () => {
    lastPayloadRef.current = null;
    setInsight(null);
  };

  return {
    insight,
    loading,
    error,
    refresh,
  };
}
