"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Building2,
  Settings,
} from "lucide-react";

export default function RiskAppetitePage() {
  const [name, setName] = useState("Default");
  const [description, setDescription] = useState(
    "Organization default threshold"
  );
  const [threshold, setThreshold] = useState(16);
  const [saving, setSaving] = useState(false);
const [message, setMessage] = useState<{
  type: "success" | "error";
  text: string;
} | null>(null);

 async function saveSettings() {
  try {
    setSaving(true);
    setMessage(null);

    const token =
      localStorage.getItem("access_token") ??
      sessionStorage.getItem("access_token");

    const res = await fetch(
      "http://localhost:8000/risk-appetite/profile",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          name,
          description,
          default_threshold: threshold,
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    setMessage({
      type: "success",
      text: "Risk appetite settings have been saved successfully.",
    });
  } catch (err) {
    console.error(err);

    setMessage({
      type: "error",
      text: "Failed to save risk appetite settings.",
    });
  } finally {
    setSaving(false);
  }
}

  return (
    <div className="space-y-6">
      {/* Header */}
<div>
  <h1 className="text-3xl font-bold text-white">
    Risk Appetite
  </h1>

  <p className="mt-2 text-slate-400">
    Configure organization-wide risk appetite settings
    and process-specific thresholds.
  </p>
</div>

{message && (
  <div
    className={`rounded-xl border px-4 py-3 text-sm ${
      message.type === "success"
        ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
        : "border-red-700 bg-red-950/40 text-red-300"
    }`}
  >
    {message.text}
  </div>
)}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Risk Appetite
        </h1>

        <p className="mt-2 text-slate-400">
          Configure organization-wide risk appetite settings
          and process-specific thresholds.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Default Threshold
            </span>

            <ShieldCheck
              size={20}
              className="text-emerald-400"
            />
          </div>

          <div className="mt-4 text-4xl font-bold text-white">
            {threshold}
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Organization Default
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Process Overrides
            </span>

            <Building2
              size={20}
              className="text-cyan-400"
            />
          </div>

          <div className="mt-4 text-4xl font-bold text-white">
            0
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Configured Processes
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Effective Threshold
            </span>

            <Settings
              size={20}
              className="text-amber-400"
            />
          </div>

          <div className="mt-4 text-4xl font-bold text-white">
            {threshold}
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Current Value
          </div>
        </div>
      </div>

      {/* Default Risk Appetite */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">
            Default Risk Appetite
          </h2>

          <p className="text-sm text-slate-400 mt-1">
            Configure the default risk threshold for
            your organization.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Profile Name
            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              className="
                w-full rounded-xl
                border border-slate-700
                bg-slate-950
                px-4 py-3
                text-white
                outline-none
                focus:border-cyan-500
              "
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Description
            </label>

            <input
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className="
                w-full rounded-xl
                border border-slate-700
                bg-slate-950
                px-4 py-3
                text-white
                outline-none
                focus:border-cyan-500
              "
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Threshold
            </label>

            <input
              type="number"
              min={1}
              max={25}
              value={threshold}
              onChange={(e) =>
                setThreshold(Number(e.target.value))
              }
              className="
                w-full rounded-xl
                border border-slate-700
                bg-slate-950
                px-4 py-3
                text-white
                outline-none
                focus:border-cyan-500
              "
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="
              rounded-xl
              bg-cyan-600
              px-5 py-3
              text-sm font-medium
              text-white
              hover:bg-cyan-500
              disabled:opacity-50
              transition
            "
          >
            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Process Overrides */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">
            Process Overrides
          </h2>

          <p className="text-sm text-slate-400 mt-1">
            Override thresholds for specific business
            processes.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-950">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-slate-400">
                  Process
                </th>

                <th className="text-left px-6 py-4 text-sm text-slate-400">
                  Threshold
                </th>

                <th className="text-right px-6 py-4 text-sm text-slate-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 text-slate-300">
                  No process overrides configured.
                </td>

                <td />

                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}