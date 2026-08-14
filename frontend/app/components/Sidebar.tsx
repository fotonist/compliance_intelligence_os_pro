"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Brain,
  Activity,
  Settings,
  User,
  LogOut,
  AlertTriangle,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import PremiumMenuItem from "./PremiumMenuItem";

type CurrentUser = {
  id?: number | string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  tenant_id?: number | null;
};

function safeParseJwt(token?: string | null): any | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map(
          (c) =>
            "%" +
            ("00" + c.charCodeAt(0).toString(16)).slice(-2)
        )
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  useEffect(() => {
    if (
      pathname.startsWith("/company/profile") ||
      pathname.startsWith("/company/processes")
    ) {
      setOpen("foundation");
    } else if (
      pathname.startsWith("/matrix") ||
      pathname.startsWith("/clause-weights") ||
      pathname.startsWith("/risk-appetite")
    ) {
      setOpen("governance");
    } else if (
      pathname.startsWith("/company/tasks") ||
      pathname.startsWith("/evidences") ||
      pathname.startsWith("/company/evidence") ||
      pathname.startsWith("/risks")
    ) {
      setOpen("execution");
    } else if (pathname.startsWith("/intelligence")) {
      setOpen("intelligence");
    } else if (pathname.startsWith("/audit")) {
      setOpen("audit");
    } else if (pathname.startsWith("/admin")) {
      setOpen("admin");
    } else {
      setOpen(null);
    }
  }, [pathname]);

  useEffect(() => {
    async function loadAlertCount() {
      try {
        const res = await apiFetch(
          "/company/intelligence/overview"
        );

        const data = await res.json();

        setAlertCount(
          data?.summary?.executive_alerts || 0
        );
      } catch {
        setAlertCount(0);
      }
    }

    loadAlertCount();
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await apiFetch("/auth/me");

        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data);
          return;
        }
      } catch {}

      try {
        const token =
          localStorage.getItem("access_token") ||
          sessionStorage.getItem("access_token");

        const payload = safeParseJwt(token);

        if (payload) {
          setCurrentUser({
            username:
              payload.username ??
              payload.sub ??
              null,
            email: payload.email ?? null,
            role: payload.role ?? null,
            tenant_id:
              payload.tenant_id ?? null,
          });

          return;
        }
      } catch {}

      setCurrentUser(null);
    }

    loadUser();
  }, []);

  function isItemActive(href: string) {
    if (href === "/matrix") {
      return (
        pathname === "/matrix" ||
        pathname === "/matrix/instances" ||
        pathname.startsWith("/matrix/instances/") ||
        pathname === "/matrix/builder" ||
        pathname.startsWith("/matrix/builder/")
      );
    }

    if (href === "/matrix/intelligence") {
      return (
        pathname === "/matrix/intelligence" ||
        pathname.startsWith("/matrix/intelligence/")
      );
    }

    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  function itemClass(href: string) {
    const active = isItemActive(href);

    return `
      flex items-center gap-2
      px-4 py-2
      rounded
      text-sm
      hover:bg-slate-800
      ${
        active
          ? "bg-slate-800 font-medium text-slate-100"
          : ""
      }
    `;
  }

  function toggle(section: string) {
    setOpen((prev) =>
      prev === section ? null : section
    );
  }

  return (
    <aside className="w-64 bg-[#020817] border-r border-slate-800 min-h-screen px-3 py-4 text-slate-200 flex flex-col">
      <div>
        <div className="mb-6 px-2">
          <div className="text-lg font-bold">
            Compliance OS
          </div>

          <div className="text-xs text-slate-400">
            Governance & Intelligence Engine
          </div>
        </div>

        <nav className="space-y-3">
          <Link
            href="/dashboard"
            className={itemClass("/dashboard")}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>

          <Section
            title="Foundation"
            icon={<Building2 size={18} />}
            id="foundation"
            open={open}
            toggle={toggle}
          >
            <Link
              href="/company/profile"
              className={itemClass(
                "/company/profile"
              )}
            >
              Company Profile
            </Link>

            <Link
              href="/company/processes"
              className={itemClass(
                "/company/processes"
              )}
            >
              Processes
            </Link>

            <Link
              href="/standards"
              className={itemClass("/standards")}
            >
              Standards
            </Link>
          </Section>

          <Section
            title="Governance"
            icon={<ShieldCheck size={18} />}
            id="governance"
            open={open}
            toggle={toggle}
          >
            <Link
              href="/matrix"
              className={itemClass("/matrix")}
            >
              Control Matrix
            </Link>

            <Link
              href="/matrix/intelligence"
              className={itemClass(
                "/matrix/intelligence"
              )}
            >
              Control Analytics
            </Link>

            <Link
              href="/clause-weights"
              className={itemClass(
                "/clause-weights"
              )}
            >
              Clause Weights
            </Link>

            <Link
              href="/risk-appetite"
              className={itemClass(
                "/risk-appetite"
              )}
            >
              Risk Appetite
            </Link>
          </Section>

          <Section
            title="Intelligence"
            icon={<Brain size={18} />}
            id="intelligence"
            open={open}
            toggle={toggle}
            badge={alertCount}
          >
            <Link
              href="/intelligence/executive"
              className={itemClass(
                "/intelligence/executive"
              )}
            >
              Executive Intelligence
            </Link>

            <Link
              href="/intelligence"
              className={itemClass("/intelligence")}
            >
              Risk Intelligence
            </Link>

            <Link
              href="/intelligence/readiness/processes"
              className={itemClass(
                "/intelligence/readiness/processes"
              )}
            >
              Executive Readiness
            </Link>

            <Link
              href="/intelligence/gaps"
              className={itemClass(
                "/intelligence/gaps"
              )}
            >
              GAP Intelligence
            </Link>
          </Section>

          <Section
            title="Maturity"
            icon={<ClipboardList size={18} />}
            id="maturity"
            open={open}
            toggle={toggle}
          >
            <Link
              href="/maturity/workspace"
              className={itemClass(
                "/maturity/workspace"
              )}
            >
              Maturity Workspace
            </Link>
          </Section>

          <Section
            title="Execution"
            icon={<Activity size={18} />}
            id="execution"
            open={open}
            toggle={toggle}
          >
            <Link
              href="/risks"
              className={itemClass("/risks")}
            >
              <AlertTriangle size={16} />
              Risk Management
            </Link>

            <PremiumMenuItem
              label="Remediation Center"
            />

            <Link
              href="/company/tasks"
              className={itemClass(
                "/company/tasks"
              )}
            >
              <ClipboardList size={16} />
              My Tasks
            </Link>

            <PremiumMenuItem
              label="Evidence Library"
            />

            <PremiumMenuItem
              label="Evidence Review"
            />
          </Section>

          <Section
            title="Internal Audit"
            icon={<ClipboardCheck size={18} />}
            id="audit"
            open={open}
            toggle={toggle}
          >
            <Link
              href="/audit/planning"
              className={itemClass("/audit/planning")}
            >
              Audit Planning
            </Link>

            <PremiumMenuItem label="Audit Execution" />
            <PremiumMenuItem label="Findings" />
            <PremiumMenuItem label="Corrective Actions" />
            <PremiumMenuItem label="Audit Reports" />
          </Section>

          <Section
            title="Administration"
            icon={<Settings size={18} />}
            id="admin"
            open={open}
            toggle={toggle}
          >
            <Link
              href="/admin/users"
              className={itemClass("/admin/users")}
            >
              Users
            </Link>

            <Link
              href="/admin/licenses"
              className={itemClass(
                "/admin/licenses"
              )}
            >
              License Management
            </Link>

            <Link
              href="/admin/logs"
              className={itemClass("/admin/logs")}
            >
              Audit Logs
            </Link>
          </Section>
        </nav>
      </div>

      <div className="mt-auto px-2 pt-4 border-t border-slate-800">
        <div className="mb-3 bg-slate-800/60 rounded p-3">
          <div
            className="
              mb-3
              flex
              items-center
              justify-between
              rounded
              bg-indigo-500/10
              border
              border-indigo-500/30
              px-3
              py-2
            "
          >
            <span className="text-xs text-indigo-300 font-medium">
              Demo Workspace
            </span>

            <span
              className="
                text-[10px]
                px-2
                py-0.5
                rounded-full
                bg-indigo-500/20
                text-indigo-300
              "
            >
              TRIAL
            </span>
          </div>

          <div className="flex items-center gap-2">
            <User size={16} />

            <span className="text-sm font-semibold">
              {currentUser?.full_name ||
                currentUser?.username ||
                "Logged in"}
            </span>
          </div>

          {(currentUser?.email ||
            currentUser?.role ||
            currentUser?.tenant_id != null) && (
            <div className="mt-1 text-xs text-slate-300 space-y-0.5">
              {currentUser?.email && (
                <div>{currentUser.email}</div>
              )}

              {currentUser?.role && (
                <div className="text-slate-400">
                  Role: {currentUser.role}
                </div>
              )}

              {currentUser?.tenant_id != null && (
                <div className="text-slate-500">
                  Tenant: {currentUser.tenant_id}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            localStorage.removeItem(
              "access_token"
            );
            localStorage.removeItem("token");
            sessionStorage.removeItem(
              "access_token"
            );
            sessionStorage.removeItem("token");

            router.replace("/login");
          }}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
  );
}

function Section({
  title,
  icon,
  id,
  open,
  toggle,
  children,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  id: string;
  open: string | null;
  toggle: (section: string) => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <div>
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-3 py-2 text-base font-semibold hover:text-white"
      >
        <div className="flex items-center gap-2">
          {icon}

          <span>{title}</span>

          {!!badge && badge > 0 && (
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {badge}
            </span>
          )}
        </div>

        <span className="text-slate-500 text-sm">
          {open === id ? "▾" : "▸"}
        </span>
      </button>

      {open === id && (
        <div className="space-y-1 ml-6 mt-1 text-sm text-slate-400">
          {children}
        </div>
      )}
    </div>
  );
}
