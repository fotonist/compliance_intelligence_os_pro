"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  "Audit Execution": "/audit/execution",
  "Findings": "/audit/findings",
  "Corrective Actions": "/audit/corrective-actions",
  "Audit Reports": "/audit/reports",

  "Governance Dashboard": "/governance/dashboard",
  "Policies & Procedures": "/governance",
  "Roles & Responsibilities": "/governance/roles",
  "Compliance Obligations": "/compliance-obligations",
  "Decision Registers": "/governance/decisions",
  "Governance Meetings": "/governance/meetings",
  "Committees": "/governance/committees",
  "Approvals & Delegations": "/governance/approvals",
  "Document Control": "/governance/documents",
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [superAdmin, setSuperAdmin] = useState(() => isSuperAdminFromToken());
  const [checkingRole, setCheckingRole] = useState(true);

  const route = PREMIUM_ROUTES[label];
  const active =
    !!route &&
    (
      pathname === route ||
      (
        route !== "/governance" &&
        pathname.startsWith(`${route}/`)
      )
    );

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
        if (!cancelled) {
          setCheckingRole(false);
        }
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module_code: label.toUpperCase().replaceAll(" ", "_"),
          module_name: label,
        }),
      });

      if (!res.ok) {
        throw new Error("Activation request failed");
      }

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

  if (superAdmin) {
    return (
      <button
        type="button"
        onClick={() => route && router.push(route)}
        disabled={!route}
        className={`w-full flex items-center gap-2 rounded-md py-1.5 px-3 text-[12px] transition ${
          active
            ? "bg-[#eaf1fb] font-semibold text-[#0f2747]"
            : "text-slate-600 hover:bg-slate-50 hover:text-[#0f2747]"
        } ${route ? "cursor-pointer" : "cursor-default"}`}
      >
        <span>{label}</span>
      </button>
    );
  }

  if (checkingRole) {
    return (
      <div className="w-full flex items-center px-3 py-2 rounded text-sm text-slate-500">
        <span>{label}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 rounded-md py-1.5 px-3 text-[12px] text-slate-600 transition hover:bg-slate-50 hover:text-[#0f2747]"
      >
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-amber-300" />
          <span>{label}</span>
        </div>

        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
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
                  <div className="text-xs text-slate-500">
                    Requested Module
                  </div>

                  <div className="text-white font-medium mt-1">
                    {label}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestActivation}
                    disabled={loading}
                    className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {loading ? "Submitting..." : "Request Activation"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-emerald-300 font-semibold">
                    ? Request Submitted
                  </div>

                  <div className="mt-2 text-sm text-slate-400">
                    Your activation request has been recorded. Our team will
                    review your request.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-5 w-full px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600"
                >
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



