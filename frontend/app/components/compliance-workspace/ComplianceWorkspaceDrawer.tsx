"use client";

import WorkspaceOverview from "./WorkspaceOverview";
import WorkspaceEvidence from "./WorkspaceEvidence";
import WorkspaceRisks from "./WorkspaceRisks";
import WorkspaceTasks from "./WorkspaceTasks";
import WorkspaceAnalytics from "./WorkspaceAnalytics";
import WorkspaceTimeline from "./WorkspaceTimeline";
import WorkspaceAISummary from "./WorkspaceAISummary";

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import clsx from "clsx";

import {
  XMarkIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ClockIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export interface WorkspaceProps {
  open: boolean;
  controlId: number | string | null;
  onClose: () => void;
}

type TabKey =
  | "overview"
  | "evidence"
  | "risks"
  | "tasks"
  | "analytics"
  | "timeline"
  | "ai";

interface WorkspaceResponse {
  standard: any;
  clause: any;
  requirement: any;
  control: any;

  coverage: any;

  evidences: any[];

  risks: any[];
  risk_summary: any;

  tasks: any[];
  task_summary: any;

  analytics: any;

  timeline: any[];

  ai_summary: string[];

  ai_executive_summary?: string;
}

const tabs: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}[] = [
  {
    key: "overview",
    label: "Overview",
    icon: ShieldCheckIcon,
  },
  {
    key: "evidence",
    label: "Evidence",
    icon: CircleStackIcon,
  },
  {
    key: "risks",
    label: "Risks",
    icon: ExclamationTriangleIcon,
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: ClipboardDocumentListIcon,
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: ChartBarIcon,
  },
  {
    key: "timeline",
    label: "Timeline",
    icon: ClockIcon,
  },
  {
    key: "ai",
    label: "AI Summary",
    icon: SparklesIcon,
  },
];

export default function ComplianceWorkspaceDrawer({
  open,
  controlId,
  onClose,
}: WorkspaceProps) {
  const [activeTab, setActiveTab] =
    useState<TabKey>("overview");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [workspace, setWorkspace] =
    useState<WorkspaceResponse | null>(null);

  const endpoint = useMemo(() => {
    if (!controlId) return null;

    const API =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://compliance-intelligence-os-pro-2.onrender.com";

    return `${API}/company/compliance-object/${controlId}`;
  }, [controlId]);

  const fetchWorkspace = useCallback(async () => {
    if (!endpoint) return;

    try {
      setLoading(true);
      setError(null);

      /*
       * Authentication
       *
       * The application stores the JWT in localStorage/sessionStorage.
       * The previous implementation only used credentials: "include",
       * which does not send a localStorage JWT to the backend.
       */
      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers: HeadersInit = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        credentials: "include",
      });

      console.log(
        "Compliance Workspace status:",
        response.status
      );

      if (!response.ok) {
        let detail = "";

        try {
          const errorJson = await response.json();

          detail =
            errorJson?.detail ||
            errorJson?.message ||
            "";
        } catch {
          try {
            detail = await response.text();
          } catch {
            detail = "";
          }
        }

        throw new Error(
          detail ||
            `Workspace request failed (HTTP ${response.status}).`
        );
      }

      const json =
        (await response.json()) as WorkspaceResponse;

      console.log(
        "Compliance Workspace response:",
        json
      );

      setWorkspace(json);
    } catch (err: any) {
      console.error(
        "Compliance Workspace fetch failed:",
        err
      );

      setWorkspace(null);

      setError(
        err?.message ||
          "Unexpected workspace error."
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!open) return;

    fetchWorkspace();
  }, [open, fetchWorkspace]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handler
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handler
      );
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const original =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        original;
    };
  }, [open]);

  if (!open) return null;

  return (
    <Fragment>
      {/* Overlay */}
      <div
        className="
          fixed inset-0
          z-[90]
          bg-slate-950/80
          backdrop-blur-md
          transition-opacity
        "
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={clsx(
          "fixed right-0 top-0 z-[100]",
          "h-screen",
          "w-full",
          "sm:w-[95%]",
          "lg:w-[88%]",
          "xl:w-[82%]",
          "2xl:w-[78%]",
          "bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900",
          "shadow-2xl",
          "flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Header */}
        <header
          className="
            sticky
            top-0
            z-30
            border-b
            border-slate-800
            bg-slate-950/95
            backdrop-blur-xl
          "
        >
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-wide text-white">
                Compliance Workspace
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Unified Control Intelligence
              </p>
            </div>

            <button
              onClick={onClose}
              className="
                rounded-lg
                border
                border-slate-700
                bg-slate-900
                p-2
                text-slate-300
                transition
                hover:bg-slate-800
                hover:text-white
              "
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="overflow-x-auto border-t border-slate-800">
            <div className="flex min-w-max gap-2 px-6 py-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.key}
                    onClick={() =>
                      setActiveTab(tab.key)
                    }
                    className={clsx(
                      "flex items-center gap-2",
                      "rounded-xl",
                      "px-4 py-2",
                      "text-sm font-medium",
                      "transition-all",
                      activeTab === tab.key
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/40"
                        : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5" />

                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-950">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="space-y-5 text-center">
                <div
                  className="
                    mx-auto
                    h-12
                    w-12
                    animate-spin
                    rounded-full
                    border-4
                    border-cyan-500
                    border-t-transparent
                  "
                />

                <p className="text-sm text-slate-400">
                  Loading Compliance Workspace...
                </p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="m-10 rounded-xl border border-red-900/60 bg-red-950/30 p-8">
              <h3 className="text-lg font-semibold text-red-400">
                Workspace Error
              </h3>

              <p className="mt-2 text-red-300">
                {error}
              </p>

              <button
                onClick={fetchWorkspace}
                className="
                  mt-6
                  rounded-lg
                  bg-red-700
                  px-5
                  py-2
                  text-white
                  hover:bg-red-600
                "
              >
                Retry
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            workspace && (
              <div className="mx-auto max-w-[1800px] p-8">
                {activeTab === "overview" && (
                  <WorkspaceOverview
                    workspace={workspace}
                  />
                )}

                {activeTab === "evidence" && (
                  <WorkspaceEvidence
                    workspace={workspace}
                  />
                )}

                {activeTab === "risks" && (
                  <WorkspaceRisks
                    workspace={workspace}
                  />
                )}

                {activeTab === "tasks" && (
                  <WorkspaceTasks
                    workspace={workspace}
                  />
                )}

                {activeTab === "analytics" && (
                  <WorkspaceAnalytics
                    workspace={workspace}
                  />
                )}

                {activeTab === "timeline" && (
                  <WorkspaceTimeline
                    workspace={workspace}
                  />
                )}

                {activeTab === "ai" && (
                  <WorkspaceAISummary
                    workspace={workspace}
                  />
                )}
              </div>
            )}
        </div>
      </aside>
    </Fragment>
  );
}
