"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  HardDrive,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  Users,
  Workflow,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import PremiumMenuItem from "./PremiumMenuItem";
import { apiFetch } from "../lib/api";

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
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    return JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map(
            (c) =>
              `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`
          )
          .join("")
      )
    );
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (
      pathname.startsWith("/company") ||
      pathname.startsWith("/standards")
    ) {
      setOpen("foundation");
    } else if (
      pathname.startsWith("/governance") ||
      pathname.startsWith("/matrix") ||
      pathname.startsWith("/clause-weights") ||
      pathname.startsWith("/risk-appetite")
    ) {
      setOpen("governance");
    } else if (pathname.startsWith("/intelligence")) {
      setOpen("intelligence");
    } else if (
      pathname.startsWith("/risks") ||
      pathname.startsWith("/evidences") ||
      pathname.startsWith("/controls") ||
      pathname.startsWith("/requirements") ||
      pathname.startsWith("/clauses")
    ) {
      setOpen("operation");
    } else if (pathname.startsWith("/audit")) {
      setOpen("audit");
    } else if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/settings")
    ) {
      setOpen("admin");
    } else {
      setOpen(null);
    }
  }, [pathname]);

  useEffect(() => {
    async function load() {
      try {
        const [overviewRes, meRes] = await Promise.all([
          apiFetch("/company/intelligence/overview"),
          apiFetch("/auth/me"),
        ]);

        if (overviewRes.ok) {
          const data = await overviewRes.json();

          setAlertCount(
            Number(data?.summary?.executive_alerts || 0)
          );
        }

        if (meRes.ok) {
          setCurrentUser(await meRes.json());
          return;
        }
      } catch {}

      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token");

      const payload = safeParseJwt(token);

      if (payload) {
        setCurrentUser({
          username: payload.username ?? payload.sub ?? null,
          email: payload.email ?? null,
          role: payload.role ?? null,
          tenant_id: payload.tenant_id ?? null,
        });
      }
    }

    load();
  }, []);

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    if (href === "/matrix") {
      return (
        pathname === "/matrix" ||
        pathname === "/matrix/instances" ||
        pathname.startsWith("/matrix/instances/") ||
        pathname === "/matrix/builder"
      );
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  function itemClass(href: string, nested = false) {
    return `flex items-center gap-2 rounded-md py-1.5 text-[12px] transition ${
      nested ? "pl-7 pr-3" : "px-3"
    } ${
      isActive(href)
        ? "bg-[#eaf1fb] font-semibold text-[#0f2747]"
        : "text-slate-600 hover:bg-slate-50 hover:text-[#0f2747]"
    }`;
  }

  function toggle(section: string) {
    setOpen((prev) =>
      prev === section ? null : section
    );
  }

  function sectionToggle(section: string) {
    if (collapsed) {
      setCollapsed(false);
      setOpen(section);
      return;
    }

    toggle(section);
  }

  return (
    <aside
      className={`flex min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-4 text-slate-700 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="min-w-0">
        <div
          className={`mb-4 flex items-center ${
            collapsed
              ? "justify-center"
              : "justify-between px-2"
          }`}
        >
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : ""
            }`}
            title="ComplianceOS PRO"
          >
            {collapsed ? (
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white">
                <img
                  src="/complianceos-pro-logo.png"
                  alt="ComplianceOS PRO"
                  className="h-8 w-auto max-w-none object-contain"
                />
              </div>
            ) : (
              <img
                src="/complianceos-pro-logo.png"
                alt="ComplianceOS PRO"
                className="h-[58px] w-auto max-w-[170px] object-contain object-left"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setCollapsed((value) => !value)
            }
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-[#eaf1fb] hover:text-[#0f2747]"
            title={
              collapsed
                ? "Open sidebar"
                : "Collapse sidebar"
            }
            aria-label={
              collapsed
                ? "Open sidebar"
                : "Collapse sidebar"
            }
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="mb-4 px-2 text-[10px] text-slate-500">
            Governance &amp; Intelligence
          </div>
        )}

        <Link
          href="/dashboard"
          title="Company Home"
          className={`mb-3 flex items-center rounded-lg py-2 text-sm font-semibold transition ${
            collapsed
              ? "justify-center px-2"
              : "gap-2 px-3"
          } ${
            pathname === "/dashboard"
              ? "bg-[#eaf1fb] text-[#0f2747]"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <LayoutDashboard size={17} />

          {!collapsed && "Company Home"}
        </Link>

        <nav className="space-y-1">
          <Section
            title="FOUNDATION"
            subtitle="Company Foundation"
            icon={<Building2 size={16} />}
            id="foundation"
            open={open}
            toggle={sectionToggle}
            collapsed={collapsed}
          >
            <Link
              href="/company/profile"
              className={itemClass("/company/profile")}
            >
              <Building2 size={14} />
              Company Profile
            </Link>

            <Link
              href="/company/organization"
              className={itemClass("/company/organization")}
            >
              <Building2 size={14} />
              Organization
            </Link>

            <Link
              href="/company/departments"
              className={itemClass("/company/departments")}
            >
              <Building2 size={14} />
              Departments
            </Link>

            <Link
              href="/company/locations"
              className={itemClass("/company/locations")}
            >
              <MapPin size={14} />
              Locations
            </Link>

            <Link
              href="/company/stakeholders"
              className={itemClass("/company/stakeholders")}
            >
              <Users size={14} />
              Stakeholders
            </Link>

            <Link
              href="/company/processes"
              className={itemClass("/company/processes")}
            >
              <Workflow size={14} />
              Processes
            </Link>

            <Link
              href="/company/objectives"
              className={itemClass("/company/objectives")}
            >
              <Target size={14} />
              Objectives
            </Link>

            <Link
              href="/risks"
              className={itemClass("/risks")}
            >
              <AlertTriangle size={14} />
              Risks
            </Link>

            <Link
              href="/standards"
              className={itemClass("/standards")}
            >
              <BookOpen size={14} />
              Standards
            </Link>

            <Link
  href="/company/assets"
  className={itemClass("/company/assets")}
>
  <HardDrive size={14} />
  Assets & Resources
</Link>
          </Section>

          <Section
            title="GOVERNANCE"
            subtitle="Administration"
            icon={<Scale size={16} />}
            id="governance"
            open={open}
            toggle={sectionToggle}
            collapsed={collapsed}
          >
            <PremiumMenuItem label="Governance Dashboard" />
            <PremiumMenuItem label="Policies & Procedures" />
            <PremiumMenuItem label="Roles & Responsibilities" />
            <PremiumMenuItem label="Compliance Obligations" />
            <PremiumMenuItem label="Decision Registers" />
            <PremiumMenuItem label="Governance Meetings" />
            <PremiumMenuItem label="Committees" />
            <PremiumMenuItem label="Approvals & Delegations" />
            <PremiumMenuItem label="Document Control" />

            <Link
              href="/matrix"
              className={itemClass("/matrix")}
            >
              <Layers3 size={14} />
              Control Matrix
            </Link>

            <Link
              href="/clause-weights"
              className={itemClass("/clause-weights")}
            >
              <Scale size={14} />
              Clause Weights
            </Link>

            <Link
              href="/risk-appetite"
              className={itemClass("/risk-appetite")}
            >
              <Shield size={14} />
              Risk Appetite
            </Link>
          </Section>

          <Section
            title="INTELLIGENCE"
            subtitle="Zeka & Analitik"
            icon={<BarChart3 size={16} />}
            id="intelligence"
            open={open}
            toggle={sectionToggle}
            badge={alertCount}
            collapsed={collapsed}
          >
            <Link
              href="/intelligence/executive"
              className={itemClass("/intelligence/executive")}
            >
              <Gauge size={14} />
              Executive Intelligence
            </Link>

            <Link
              href="/intelligence/readiness/processes"
              className={itemClass(
                "/intelligence/readiness/processes"
              )}
            >
              <Gauge size={14} />
              Executive Readiness
            </Link>

            <Link
              href="/intelligence/gaps"
              className={itemClass("/intelligence/gaps")}
            >
              <AlertTriangle size={14} />
              Gap Intelligence
            </Link>

            <PremiumMenuItem label="Reports & Insights" />

            <Link
              href="/intelligence/risk"
              className={itemClass("/intelligence/risk")}
            >
              <AlertTriangle size={14} />
              Risk Intelligence
            </Link>

            <Link
              href="/intelligence/control/control-health"
              className={itemClass(
                "/intelligence/control/control-health"
              )}
            >
              <ShieldCheck size={14} />
              Control Health
            </Link>

            <Link
              href="/intelligence/configuration"
              className={itemClass("/intelligence/configuration")}
            >
              <Settings2 size={14} />
              Model Configuration
            </Link>

            <Link
              href="/intelligence"
              className={itemClass("/intelligence")}
            >
              <BarChart3 size={14} />
              Compliance Analytics
            </Link>

            <PremiumMenuItem label="Trend Analysis" />
            <PremiumMenuItem label="Predictive Insights" />
            <PremiumMenuItem label="Benchmarking" />

            <Link
              href="/dashboard"
              className={itemClass("/dashboard")}
            >
              <TrendingUp size={14} />
              KPI & Metrics
            </Link>

            <PremiumMenuItem label="Data Explorer" />
          </Section>

          <Section
            title="OPERATION"
            subtitle="Administration"
            icon={<Activity size={16} />}
            id="operation"
            open={open}
            toggle={sectionToggle}
            collapsed={collapsed}
          >
            <Link
              href="/matrix"
              className={itemClass("/matrix")}
            >
              <Layers3 size={14} />
              Compliance Matrix
            </Link>

            <Link
              href="/controls"
              className={itemClass("/controls")}
            >
              <ShieldCheck size={14} />
              Control Management
            </Link>

            <Link
              href="/requirements"
              className={itemClass("/requirements")}
            >
              <ListChecks size={14} />
              Requirement Management
            </Link>

            <Link
              href="/clauses"
              className={itemClass("/clauses")}
            >
              <FileText size={14} />
              Clause Management
            </Link>

            <Link
              href="/standards"
              className={itemClass("/standards")}
            >
              <BookOpen size={14} />
              Standard Management
            </Link>

            <Link
              href="/risks"
              className={itemClass("/risks")}
            >
              <AlertTriangle size={14} />
              Risk Management
            </Link>

            <Link
              href="/evidences"
              className={itemClass("/evidences")}
            >
              <FolderIcon />
              Evidence Management
            </Link>

            <Link
              href="/company/evidence/review"
              className={itemClass(
                "/company/evidence/review",
                true
              )}
            >
              <ClipboardCheck size={13} />
              Evidence Review
            </Link>

            <PremiumMenuItem label="Remediation Center" />
            <PremiumMenuItem label="Action Management" />

            <Link
              href="/company/tasks"
              className={itemClass("/company/tasks")}
            >
              <ClipboardList size={14} />
              Task Management
            </Link>
          </Section>

          <Section
            title="INTERNAL AUDIT"
            subtitle="Internal Audit"
            icon={<ClipboardCheck size={16} />}
            id="audit"
            open={open}
            toggle={sectionToggle}
            collapsed={collapsed}
          >
            <PremiumMenuItem label="Audit Dashboard" />

            <Link
              href="/audit/planning"
              className={itemClass("/audit/planning")}
            >
              <ClipboardList size={14} />
              Audit Planning
            </Link>

            <PremiumMenuItem label="Audit Programs" />
            <PremiumMenuItem label="Audit Checklists" />
            <PremiumMenuItem label="Audit Execution" />

            <Link
              href="/audit/findings"
              className={itemClass("/audit/findings")}
            >
              <AlertTriangle size={14} />
              Findings / Nonconformity Management
            </Link>

            <PremiumMenuItem label="Audit Reports" />
            <PremiumMenuItem label="Follow-up Actions" />
            <PremiumMenuItem label="Audit Analytics" />
            <PremiumMenuItem label="Auditor Management" />
          </Section>

          <Section
            title="ADMINISTRATION"
            subtitle="Administration"
            icon={<Settings size={16} />}
            id="admin"
            open={open}
            toggle={sectionToggle}
            collapsed={collapsed}
          >
            <Link
              href="/admin/users"
              className={itemClass("/admin/users")}
            >
              <Users size={14} />
              Users
            </Link>

            <PremiumMenuItem label="Roles & Permissions" />
            <PremiumMenuItem label="Departments" />

            <Link
              href="/settings/scoring"
              className={itemClass("/settings/scoring")}
            >
              <Settings size={14} />
              Settings
            </Link>

            <PremiumMenuItem label="Integrations" />
            <PremiumMenuItem label="Notifications" />

            <Link
              href="/admin/logs"
              className={itemClass("/admin/logs")}
            >
              <ClipboardCheck size={14} />
              Audit Logs
            </Link>

            <PremiumMenuItem label="Data Management" />
            <PremiumMenuItem label="Backup & Restore" />

            <Link
              href="/admin/licenses"
              className={itemClass("/admin/licenses")}
            >
              <Shield size={14} />
              License Management
            </Link>
          </Section>
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-200 pt-3">
        <div
          className={`rounded-lg bg-slate-50 p-2 ${
            collapsed ? "flex justify-center" : "p-3"
          }`}
          title={
            collapsed
              ? currentUser?.full_name ||
                currentUser?.username ||
                "Logged in"
              : undefined
          }
        >
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "gap-2"
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf1fb] text-[#0f2747]">
              <User size={15} />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[#0f2747]">
                  {currentUser?.full_name ||
                    currentUser?.username ||
                    "Logged in"}
                </div>

                <div className="truncate text-[10px] text-slate-500">
                  {currentUser?.role || "User"}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("token");
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("token");
            router.replace("/login");
          }}
          title="Logout"
          className={`mt-3 flex items-center text-xs text-red-500 hover:text-red-600 ${
            collapsed
              ? "justify-center w-full px-2"
              : "gap-2 px-2"
          }`}
        >
          <LogOut size={14} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}

function Section({
  title,
  subtitle,
  icon,
  id,
  open,
  toggle,
  children,
  badge,
  collapsed,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  id: string;
  open: string | null;
  toggle: (section: string) => void;
  children: ReactNode;
  badge?: number;
  collapsed: boolean;
}) {
  return (
    <div className="border-b border-slate-200/80 pb-1">
      <button
        type="button"
        onClick={() => toggle(id)}
        title={collapsed ? title : undefined}
        className={`flex w-full items-center rounded-md py-2 text-left hover:bg-slate-50 hover:text-[#0f2747] ${
          collapsed
            ? "justify-center px-2"
            : "justify-between px-2"
        }`}
      >
        <div
          className={`flex min-w-0 items-center ${
            collapsed
              ? "justify-center"
              : "gap-2"
          }`}
        >
          <span className="shrink-0 text-slate-500">
            {icon}
          </span>

          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-[#0f2747]">
                {title}

                {!!badge && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </div>

              <div className="text-[9px] text-slate-500">
                {subtitle}
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <span className="text-slate-400">
            {open === id ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
          </span>
        )}
      </button>

      {!collapsed && open === id && (
        <div className="ml-3 space-y-0.5 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
      <FolderOpenIcon />
    </span>
  );
}

function FolderOpenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3.5 w-3.5"
    >
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
