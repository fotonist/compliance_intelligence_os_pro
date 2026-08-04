"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ScoringConfig = {
  low_max: number;
  medium_max: number;
  high_max: number;
  watch_max: number;
  mitigate_max: number;
};

const API_BASE = "http://127.0.0.1:8000";

export default function ScoringSettingsPage() {
  const router = useRouter();

  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          router.push("/login");
          return;
        }

        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/scoring/config`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setError("Failed to load scoring configuration.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setConfig(data);
      } catch (err) {
        console.error(err);
        setError("Unexpected error while loading configuration.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const updateField = (field: keyof ScoringConfig, value: number) => {
    if (!config) return;
    setConfig({
      ...config,
      [field]: value,
    });
    setMessage(null);
    setError(null);
  };

  const onSave = async () => {
    if (!config) return;

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      setSaving(true);
      setError(null);
      setMessage(null);

      const res = await fetch(`${API_BASE}/scoring/config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail =
          (body && (body.detail || body.message)) ||
          "Failed to save configuration.";
        setError(typeof detail === "string" ? detail : "Failed to save configuration.");
        setSaving(false);
        return;
      }

      const data = await res.json();
      setConfig(data);
      setMessage("Scoring configuration saved.");
    } catch (err) {
      console.error(err);
      setError("Unexpected error while saving configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Risk Scoring Settings</h1>
            <p className="text-sm text-slate-400">
              Configure risk level and treatment thresholds (score 1 – 25).
            </p>
          </div>
          <button
            onClick={() => router.push("/matrix")}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Back to Matrix
          </button>
        </div>

        {loading && (
          <div className="text-slate-300 text-sm">Loading configuration...</div>
        )}

        {error && (
          <div className="text-sm text-red-400 border border-red-700 bg-red-950/40 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {message && (
          <div className="text-sm text-emerald-300 border border-emerald-700 bg-emerald-950/40 px-3 py-2 rounded">
            {message}
          </div>
        )}

        {/* ------------------------------ */}
        {/* MAIN FORM CONTENT */}
        {/* ------------------------------ */}

        {!loading && config && (
          <div className="space-y-8">

            {/* LOW */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Low Risk Max Score
              </label>
              <input
                type="number"
                value={config.low_max}
                onChange={(e) => updateField("low_max", Number(e.target.value))}
                className="w-40 px-3 py-2 rounded bg-slate-800 border border-slate-700"
              />
            </div>

            {/* MEDIUM */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Medium Risk Max Score
              </label>
              <input
                type="number"
                value={config.medium_max}
                onChange={(e) =>
                  updateField("medium_max", Number(e.target.value))
                }
                className="w-40 px-3 py-2 rounded bg-slate-800 border border-slate-700"
              />
            </div>

            {/* HIGH */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                High Risk Max Score
              </label>
              <input
                type="number"
                value={config.high_max}
                onChange={(e) =>
                  updateField("high_max", Number(e.target.value))
                }
                className="w-40 px-3 py-2 rounded bg-slate-800 border border-slate-700"
              />
            </div>

            {/* WATCH */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Monitoring Threshold Max Score
              </label>
              <input
                type="number"
                value={config.watch_max}
                onChange={(e) =>
                  updateField("watch_max", Number(e.target.value))
                }
                className="w-40 px-3 py-2 rounded bg-slate-800 border border-slate-700"
              />
            </div>

            {/* MITIGATE */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Mitigation Threshold Max Score
              </label>
              <input
                type="number"
                value={config.mitigate_max}
                onChange={(e) =>
                  updateField("mitigate_max", Number(e.target.value))
                }
                className="w-40 px-3 py-2 rounded bg-slate-800 border border-slate-700"
              />
            </div>

            {/* SAVE */}
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
