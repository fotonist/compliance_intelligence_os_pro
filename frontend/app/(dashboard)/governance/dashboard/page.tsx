"use client";

import { useEffect, useState } from "react";


import {
  FileText,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Files,
  Archive,
  XCircle,
  Workflow,
  Activity,
  Gauge,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";


type DashboardData = {
  policy_summary: {
    total: number;
    draft: number;
    under_review: number;
    approved: number;
    expired: number;
    archived: number;
  };

  procedure_summary: {
    total: number;
    draft: number;
    under_review: number;
    approved: number;
    archived: number;
  };

  document_summary: {
    total: number;
    current: number;
    archived: number;
    approved: number;
    rejected: number;
  };

  upcoming_reviews: {
    id: number;
    title: string;
    review_date: string | null;
  }[];

  health_score: {
    governance: number;
    document: number;
    policy: number;
    review: number;
    approval: number;
  };

  document_health: {
    score: number;
    current: number;
    approved: number;
    rejected: number;
    archived: number;
  };

  attention_items: {
    severity: string;
    title: string;
    message: string;
  }[];

  activity_summary: {
    id: number;
    action: string;
    status: string | null;
    document: string | null;
    version: string | null;
    performed_by: string;
    created_at: string;
  }[];
};


const emptyDashboard: DashboardData = {
  policy_summary: {
    total: 0,
    draft: 0,
    under_review: 0,
    approved: 0,
    expired: 0,
    archived: 0,
  },

  procedure_summary: {
    total: 0,
    draft: 0,
    under_review: 0,
    approved: 0,
    archived: 0,
  },

  document_summary: {
    total: 0,
    current: 0,
    archived: 0,
    approved: 0,
    rejected: 0,
  },

  upcoming_reviews: [],

  health_score: {
    governance: 0,
    document: 0,
    policy: 0,
    review: 0,
    approval: 0,
  },

  document_health: {
    score: 0,
    current: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
  },

  attention_items: [],

  activity_summary: [],
};


export default function GovernanceDashboardPage() {

  const [dashboard, setDashboard] =
    useState<DashboardData>(emptyDashboard);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {

    async function load() {

      try {

        const res = await apiFetch(
          "/governance/dashboard"
        );

        if (!res.ok) {
          throw new Error(
            "Failed to load governance dashboard"
          );
        }

        const data = await res.json();

        setDashboard(data);

      } catch (error) {

        console.error(
          "Governance dashboard error:",
          error
        );

      } finally {

        setLoading(false);

      }

    }


    load();

  }, []);




  const healthMetrics = [
    {
      title: "Governance Health",
      value: dashboard.health_score.governance,
      description: "Overall governance maturity",
      icon: Gauge,
    },

    {
      title: "Document Health",
      value: dashboard.health_score.document,
      description: "Document lifecycle quality",
      icon: Files,
    },

    {
      title: "Policy Health",
      value: dashboard.health_score.policy,
      description: "Policy approval maturity",
      icon: ShieldCheck,
    },

    {
      title: "Approval Health",
      value: dashboard.health_score.approval,
      description: "Governance approval status",
      icon: Activity,
    },

    {
      title: "Review Compliance",
      value: dashboard.health_score.review,
      description: "Scheduled review compliance",
      icon: AlertCircle,
    },
  ];
  const metrics = [
    {
      title: "Total Policies",
      value: dashboard.policy_summary.total,
      icon: FileText,
    },

    {
      title: "Approved Policies",
      value: dashboard.policy_summary.approved,
      icon: ShieldCheck,
    },

    {
      title: "Pending Review",
      value: dashboard.policy_summary.under_review,
      icon: Clock,
    },

    {
      title: "Expired Policies",
      value: dashboard.policy_summary.expired,
      icon: AlertTriangle,
    },

    {
      title: "Total Procedures",
      value: dashboard.procedure_summary.total,
      icon: Workflow,
    },

    {
      title: "Current Documents",
      value: dashboard.document_summary.current,
      icon: Files,
    },

    {
      title: "Archived Documents",
      value: dashboard.document_summary.archived,
      icon: Archive,
    },

    {
      title: "Rejected Documents",
      value: dashboard.document_summary.rejected,
      icon: XCircle,
    },
  ];



  if (loading) {

    return (
      <div className="p-8 text-sm text-slate-500">
        Loading governance dashboard...
      </div>
    );

  }



  return (

    <div className="min-h-full bg-slate-50 p-6 lg:p-8">

      <div className="mx-auto max-w-[1600px]">

        <h1 className="text-2xl font-semibold text-slate-950">
          Governance Executive Dashboard
        </h1>


        <p className="mt-2 text-sm text-slate-500">
          Policy lifecycle and governance status overview.
        </p>




        <div className="mt-8">

          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Governance Intelligence
          </h2>


          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">


            {healthMetrics.map((item) => {

              const Icon = item.icon;

              const healthStatus =
                item.value >= 80
                  ? {
                      label: "Healthy",
                      className: "bg-emerald-50 text-emerald-700",
                    }
                  : item.value >= 60
                  ? {
                      label: "Attention",
                      className: "bg-amber-50 text-amber-700",
                    }
                  : {
                      label: "Critical",
                      className: "bg-red-50 text-red-700",
                    };

              return (

                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >

                  <div className="flex items-start justify-between">

                    <div>

                      <span className="text-xs uppercase text-slate-400">
                        {item.title}
                      </span>

                      <div className="mt-4 text-3xl font-semibold text-slate-950">
                        {item.value}%
                      </div>

                    </div>

                    <Icon
                      size={18}
                      className="text-slate-400"
                    />

                  </div>


                  <div className="mt-2 text-xs text-slate-500">
                    {item.description}
                  </div>


                  <div className="mt-4">

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${healthStatus.className}`}
                    >
                      {healthStatus.label}
                    </span>

                  </div>

                </div>

              );

            })}


          </div>

        </div>


        <div className="mt-10 mb-4">

          <h2 className="text-sm font-semibold text-slate-700">
            Operational Overview
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Governance lifecycle and document status indicators.
          </p>

        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">


          {metrics.map((item) => {

            const Icon = item.icon;

            return (

              <div
                key={item.title}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >

                <div className="flex justify-between">

                  <span className="text-xs uppercase text-slate-400">
                    {item.title}
                  </span>

                  <Icon size={18}/>
                </div>


                <div className="mt-4 text-3xl font-semibold">
                  {item.value}
                </div>


              </div>

            );

          })}


        </div>



        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="font-semibold text-slate-900">
                Attention Required
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Governance items requiring management attention.
              </p>

            </div>

            <AlertCircle size={18} className="text-slate-400" />

          </div>


          <div className="mt-5 space-y-3">

            {dashboard.attention_items.length === 0 && (

              <div className="rounded-lg border border-slate-100 p-4 text-sm text-slate-400">
                No items require attention.
              </div>

            )}


            {dashboard.attention_items.map((item, index) => (

              <div
                key={`${item.title}-${index}`}
                className="flex items-start justify-between rounded-lg border border-slate-100 p-4"
              >

                <div className="flex items-start gap-3">

                  <div
                    className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                      item.severity === "high"
                        ? "bg-red-500"
                        : item.severity === "medium"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                    }`}
                  />

                  <div>

                    <div className="text-sm font-semibold text-slate-800">
                      {item.title}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {item.message}
                    </div>

                  </div>

                </div>


                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    item.severity === "high"
                      ? "bg-red-50 text-red-700"
                      : item.severity === "medium"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.severity}
                </span>

              </div>

            ))}

          </div>

        </div>



        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">

          <h2 className="font-semibold">
            Upcoming Policy Reviews
          </h2>


          <div className="mt-4 space-y-3">


            {dashboard.upcoming_reviews.length === 0 && (

              <div className="text-sm text-slate-400">
                No upcoming reviews
              </div>

            )}



            {dashboard.upcoming_reviews.map((item) => {

              const reviewDate = item.review_date
                ? new Date(item.review_date)
                : null;

              const today = new Date();

              const daysRemaining = reviewDate
                ? Math.ceil(
                    (
                      reviewDate.getTime() -
                      today.getTime()
                    ) /
                    (1000 * 60 * 60 * 24)
                  )
                : null;

              const reviewStatus =
                daysRemaining === null
                  ? {
                      label: "No Date",
                      className: "bg-slate-100 text-slate-600",
                    }
                  : daysRemaining < 0
                  ? {
                      label: "Overdue",
                      className: "bg-red-50 text-red-700",
                    }
                  : daysRemaining <= 30
                  ? {
                      label: "Due Soon",
                      className: "bg-red-50 text-red-700",
                    }
                  : daysRemaining <= 90
                  ? {
                      label: "Upcoming",
                      className: "bg-amber-50 text-amber-700",
                    }
                  : {
                      label: "Scheduled",
                      className: "bg-emerald-50 text-emerald-700",
                    };

              return (

                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 p-4"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <div className="font-semibold text-slate-800">
                        {item.title}
                      </div>

                      <div className="mt-2 text-sm text-slate-500">

                        <span className="font-medium text-slate-600">
                          Review Date:
                        </span>

                        {" "}

                        {reviewDate
                          ? reviewDate.toLocaleDateString()
                          : "No date"}

                      </div>

                    </div>


                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${reviewStatus.className}`}
                    >
                      {reviewStatus.label}
                    </span>

                  </div>


                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">

                    <span className="text-xs text-slate-400">
                      Review Schedule
                    </span>

                    <span className="text-xs font-medium text-slate-600">

                      {daysRemaining === null
                        ? "-"
                        : daysRemaining < 0
                        ? `${Math.abs(daysRemaining)} days overdue`
                        : daysRemaining === 0
                        ? "Due today"
                        : `${daysRemaining} days remaining`}

                    </span>

                  </div>

                </div>

              );

            })}


          </div>


        </div>



        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">

          <h2 className="font-semibold">
            Governance Activity Timeline
          </h2>

          <div className="mt-4 space-y-3">

            {dashboard.activity_summary.length === 0 && (
              <div className="text-sm text-slate-400">
                No governance activities
              </div>
            )}

            {dashboard.activity_summary.map((item) => (

              <div
                key={item.id}
                className="rounded-lg border border-slate-100 p-3"
              >

                <div className="font-semibold">
                  {item.action}
                </div>


                <div className="mt-2 text-sm text-slate-600">

                  <span className="font-medium">
                    Document:
                  </span>

                  {" "}

                  {item.document || "-"}

                </div>


                <div className="mt-1 text-sm text-slate-600">

                  <span className="font-medium">
                    Version:
                  </span>

                  {" "}

                  {item.version || "-"}

                </div>


                <div className="mt-1 text-sm text-slate-600">

                  <span className="font-medium">
                    Performed By:
                  </span>

                  {" "}

                  {item.performed_by}

                </div>


                <div className="mt-2 text-xs text-slate-500">

                  Status:
                  {" "}
                  {item.status || "-"}

                </div>


                <div className="mt-1 text-xs text-slate-400">

                  {new Date(
                    item.created_at
                  ).toLocaleString()}

                </div>

              </div>

            ))}

          </div>

        </div>
      </div>

    </div>

  );

}
























