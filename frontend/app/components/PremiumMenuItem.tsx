"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { apiFetch } from "../lib/api";
import { isSuperAdmin as isSuperAdminFromToken } from "../lib/auth";

type Props = {
  label: string;
};

const PREMIUM_ROUTES: Record<string, string> = {
  "Executive Intelligence": "/intelligence",
  "Remediation Center": "/company/remediation",
  "Evidence Library": "/evidences",
  "Evidence Review": "/company/evidence/review",
};

function normalizeRole(role: unknown): string {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function hasSuperAdminRole(data: any): boolean {
  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const allRoles = [...roles, data?.role];

  return allRoles.some((role) => {
    const normalized = normalizeRole(role);
    return normalized === "super_admin" || normalized === "superadmin";
  });
}

export default function PremiumMenuItem({ label }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [superAdmin, setSuperAdmin] = useState(() => isSuperAdminFromToken());
  const [checkingRole, setCheckingRole] = useState(true);

  const route = PREMIUM_ROUTES[label];

  useEffect(() => {
    let cancelled = false;

    async function resolveRole() {
      if (isSuperAdminFromToken()) {
        if (!cancelled) {
          setSuperAdmin(true);
          setCheckingRole(false);
        }
        return;
      }

      try {
        const res = await apiFetch("/auth/me");
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setSuperAdmin(hasSuperAdminRole(data));
        }
      } catch {
        // JWT check remains the fallback for unavailable /auth/me.
      } finally {
        if (!cancelled) setCheckingRole(false);
      }
    }

    resolveRole();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequestActivation() {
    try {
      setLoading(true);
      setError("");

      const res = await apiFetch("/company/license/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_code: label.toUpperCase().replaceAll(" ", "_"),
          module_name: label,
        }),
      });

      if (!res.ok) throw new Error("Activation request failed");
      setRequested(true);
    } catch (err: any) {
      console.error("Premium request error:", err);
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    setOpen(false);
    setRequested(false);
    setError("");
  }

  // Super Admin bypasses every frontend premium lock.
  // This is intentionally independent of tenant license/module state.
  if (superAdmin) {
    return (
      <button
        type="button"
        onClick={() => route && router.push(route)}
        disabled={!route}
        className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 ${
          route ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <span>{label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
          ACTIVE
        </span>
      </button>
    );
  }

  // Avoid showing a false PRO lock while the user's role is being resolved.
  if (checkingRole) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-2 rounded text-sm text-slate-500">
        <span>{label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
          CHECKING
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 rounded text-sm text-slate-400 hover:bg-slate-800 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-amber-300" />
          <span>{label}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
          PRO
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            {!requested ? (
              <>
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Lock size={18} className="text-amber-300" />
                  Premium Module Required
                </div>
                <p className="mt-4 text-sm text-slate-400">
                  {label} is available only with Premium License activation.
                </p>
                <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-500">Requested Module</div>
                  <div className="text-white font-medium mt-1">{label}</div>
                </div>
                {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={closeModal} className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">
                    Close
                  </button>
                  <button type="button" onClick={handleRequestActivation} disabled={loading} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
                    {loading ? "Submitting..." : "Request Activation"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-emerald-300 font-semibold">✓ Request Submitted</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Your activation request has been recorded. Our team will review your request.
                  </div>
                </div>
                <button type="button" onClick={closeModal} className="mt-5 w-full px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600">
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
