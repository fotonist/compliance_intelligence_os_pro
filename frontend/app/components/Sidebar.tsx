"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  Globe2,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Network,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  User,
  Users,
  Workflow,
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
          .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
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
  const [alertCount, setAlertCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/company") || pathname.startsWith("/standards")) setOpen("foundation");
    else if (pathname.startsWith("/governance") || pathname.startsWith("/matrix") || pathname.startsWith("/clause-weights") || pathname.startsWith("/risk-appetite")) setOpen("governance");
    else if (pathname.startsWith("/intelligence")) setOpen("intelligence");
    else if (pathname.startsWith("/risks") || pathname.startsWith("/evidences") || pathname.startsWith("/controls") || pathname.startsWith("/requirements") || pathname.startsWith("/clauses")) setOpen("operation");
    else if (pathname.startsWith("/audit")) setOpen("audit");
    else if (pathname.startsWith("/admin") || pathname.startsWith("/settings")) setOpen("admin");
    else setOpen(null);
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
          setAlertCount(Number(data?.summary?.executive_alerts || 0));
        }

        if (meRes.ok) {
          setCurrentUser(await meRes.json());
          return;
        }
      } catch {}

      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
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
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/matrix") {
      return pathname === "/matrix" || pathname === "/matrix/instances" || pathname.startsWith("/matrix/instances/") || pathname === "/matrix/builder";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function itemClass(href: string) {
    return `flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition ${
      isActive(href)
        ? "bg-slate-800 font-semibold text-white"
        : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
    }`;
  }

  function toggle(section: string) {
    setOpen((prev) => (prev === section ? null : section));
  }

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-[#020817] px-3 py-4 text-slate-200">
      <div>
        <div className="mb-5 px-2">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ShieldCheck size={21} className="text-emerald-400" />
            COMPLIANCE OS
          </div>
          <div className="mt-1 text-[10px] text-slate-400">Governance &amp; Intelligence</div>
        </div>

        <Link
          href="/dashboard"
          className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
            pathname === "/dashboard" ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-900"
          }`}
        >
          <LayoutDashboard size={17} />
          Company Home
        </Link>

        <nav className="space-y-1">
          <Section title="FOUNDATION" subtitle="Şirket Temeli" icon={<Building2 size={16} />} id="foundation" open={open} toggle={toggle}>
            <Link href="/company/profile" className={itemClass("/company/profile")}><Building2 size={14} />Company Profile</Link>
            <Link href="/company/processes" className={itemClass("/company/processes")}><Workflow size={14} />Processes</Link>
            <PremiumMenuItem label="Objectives" />
            <Link href="/risks" className={itemClass("/risks")}><AlertTriangle size={14} />Risks</Link>
            <Link href="/standards" className={itemClass("/standards")}><BookOpen size={14} />Standards</Link>
            <PremiumMenuItem label="Assets & Resources" />
            <PremiumMenuItem label="Organization" />
            <PremiumMenuItem label="Locations" />
            <PremiumMenuItem label="Stakeholders" />
            <PremiumMenuItem label="Policies" />
          </Section>

          <Section title="GOVERNANCE" subtitle="Yönetişim" icon={<Scale size={16} />} id="governance" open={open} toggle={toggle}>
            <PremiumMenuItem label="Governance Dashboard" />
            <PremiumMenuItem label="Policies & Procedures" />
            <PremiumMenuItem label="Roles & Responsibilities" />
            <PremiumMenuItem label="Compliance Obligations" />
            <PremiumMenuItem label="Decision Registers" />
            <PremiumMenuItem label="Governance Meetings" />
            <PremiumMenuItem label="Committees" />
            <PremiumMenuItem label="Approvals & Delegations" />
            <PremiumMenuItem label="Document Control" />
            <Link href="/matrix" className={itemClass("/matrix")}><Layers3 size={14} />Control Matrix</Link>
            <Link href="/clause-weights" className={itemClass("/clause-weights")}><Scale size={14} />Clause Weights</Link>
            <Link href="/risk-appetite" className={itemClass("/risk-appetite")}><Shield size={14} />Risk Appetite</Link>
          </Section>

          <Section title="INTELLIGENCE" subtitle="Zeka & Analitik" icon={<BarChart3 size={16} />} id="intelligence" open={open} toggle={toggle} badge={alertCount}>
            <Link href="/intelligence/executive" className={itemClass("/intelligence/executive")}><Gauge size={14} />Executive Intelligence</Link>
            <PremiumMenuItem label="Reports & Insights" />
            <Link href="/intelligence/risk" className={itemClass("/intelligence/risk")}><AlertTriangle size={14} />Risk Intelligence</Link>
            <Link href="/intelligence" className={itemClass("/intelligence")}><BarChart3 size={14} />Compliance Analytics</Link>
            <PremiumMenuItem label="Trend Analysis" />
            <PremiumMenuItem label="Predictive Insights" />
            <PremiumMenuItem label="Benchmarking" />
            <Link href="/dashboard" className={itemClass("/dashboard")}><TrendingUp size={14} />KPI & Metrics</Link>
            <PremiumMenuItem label="Data Explorer" />
          </Section>

          <Section title="OPERATION" subtitle="Operasyon" icon={<Activity size={16} />} id="operation" open={open} toggle={toggle}>
            <Link href="/matrix" className={itemClass("/matrix")}><Layers3 size={14} />Compliance Matrix</Link>
            <Link href="/controls" className={itemClass("/controls")}><ShieldCheck size={14} />Control Management</Link>
            <Link href="/requirements" className={itemClass("/requirements")}><ListChecks size={14} />Requirement Management</Link>
            <Link href="/clauses" className={itemClass("/clauses")}><FileText size={14} />Clause Management</Link>
            <Link href="/standards" className={itemClass("/standards")}><BookOpen size={14} />Standard Management</Link>
            <Link href="/risks" className={itemClass("/risks")}><AlertTriangle size={14} />Risk Management</Link>
            <Link href="/evidences" className={itemClass("/evidences")}><FolderIcon />Evidence Management</Link>
            <PremiumMenuItem label="Remediation Center" />
            <PremiumMenuItem label="Action Management" />
            <Link href="/company/tasks" className={itemClass("/company/tasks")}><ClipboardList size={14} />Task Management</Link>
          </Section>

          <Section title="INTERNAL AUDIT" subtitle="İç Denetim" icon={<ClipboardCheck size={16} />} id="audit" open={open} toggle={toggle}>
            <PremiumMenuItem label="Audit Dashboard" />
            <Link href="/audit/planning" className={itemClass("/audit/planning")}><ClipboardList size={14} />Audit Planning</Link>
            <PremiumMenuItem label="Audit Programs" />
            <PremiumMenuItem label="Audit Checklists" />
            <PremiumMenuItem label="Audit Execution" />
            <PremiumMenuItem label="Findings Management" />
            <PremiumMenuItem label="Audit Reports" />
            <PremiumMenuItem label="Follow-up Actions" />
            <PremiumMenuItem label="Audit Analytics" />
            <PremiumMenuItem label="Auditor Management" />
          </Section>

          <Section title="ADMINISTRATION" subtitle="Yönetim" icon={<Settings size={16} />} id="admin" open={open} toggle={toggle}>
            <Link href="/admin/users" className={itemClass("/admin/users")}><Users size={14} />Users</Link>
            <PremiumMenuItem label="Roles & Permissions" />
            <PremiumMenuItem label="Departments" />
            <Link href="/settings/scoring" className={itemClass("/settings/scoring")}><Settings size={14} />Settings</Link>
            <PremiumMenuItem label="Integrations" />
            <PremiumMenuItem label="Notifications" />
            <Link href="/admin/logs" className={itemClass("/admin/logs")}><ClipboardCheck size={14} />Audit Logs</Link>
            <PremiumMenuItem label="Data Management" />
            <PremiumMenuItem label="Backup & Restore" />
            <Link href="/admin/licenses" className={itemClass("/admin/licenses")}><Shield size={14} />License Management</Link>
          </Section>
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-800 pt-3">
        <div className="rounded-lg bg-slate-900/70 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-200">
              <User size={15} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{currentUser?.full_name || currentUser?.username || "Logged in"}</div>
              <div className="truncate text-[10px] text-slate-400">{currentUser?.role || "User"}</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("token");
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("token");
            router.replace("/login");
          }}
          className="mt-3 flex items-center gap-2 px-2 text-xs text-red-400 hover:text-red-300"
        >
          <LogOut size={14} /> Logout
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
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  id: string;
  open: string | null;
  toggle: (section: string) => void;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <div className="border-b border-slate-800/70 pb-1">
      <button
        type="button"
        onClick={() => toggle(id)}
        className="flex w-full items-center justify-between px-2 py-2 text-left hover:text-white"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-slate-200">
              {title}
              {!!badge && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] text-white">{badge}</span>}
            </div>
            <div className="text-[9px] text-slate-500">{subtitle}</div>
          </div>
        </div>
        <span className="text-slate-500">{open === id ? "⌄" : "›"}</span>
      </button>

      {open === id && <div className="ml-3 space-y-0.5 pb-2">{children}</div>}
    </div>
  );
}

function FolderIcon() {
  return <span className="inline-flex h-3.5 w-3.5 items-center justify-center"><FolderOpenIcon /></span>;
}

function FolderOpenIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>;
}
