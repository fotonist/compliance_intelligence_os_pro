"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

interface Props {
  workspace: any;
}

function normalize(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function activityConfig(activity: any) {
  const value = normalize(
    activity.event_type ??
      activity.type ??
      activity.action ??
      activity.status
  );

  if (
    value.includes("approve") ||
    value.includes("complete") ||
    value.includes("resolved") ||
    value.includes("close")
  ) {
    return {
      icon: CheckCircleIcon,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (
    value.includes("risk") ||
    value.includes("reject") ||
    value.includes("fail")
  ) {
    return {
      icon: ShieldExclamationIcon,
      className:
        "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (
    value.includes("evidence") ||
    value.includes("document") ||
    value.includes("upload")
  ) {
    return {
      icon: DocumentTextIcon,
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  return {
    icon: ClockIcon,
    className:
      "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function formatDate(value: any) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkspaceTimeline({
  workspace,
}: Props) {
  const [query, setQuery] = useState("");

  const timeline = Array.isArray(workspace?.timeline)
    ? workspace.timeline
    : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return timeline;

    return timeline.filter((item: any) => {
      const searchable = [
        item.event_type,
        item.type,
        item.action,
        item.title,
        item.description,
        item.message,
        item.actor,
        item.user,
        item.user_name,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [timeline, query]);

  return (
    <div className="space-y-5">

      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 px-5 py-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Governance Record
              </div>

              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Audit Activity
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Chronological activity associated with the current
                compliance object.
              </p>
            </div>

            <div className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {filtered.length} activities
            </div>

          </div>

        </div>

        <div className="border-b border-slate-200 bg-slate-50 p-4">

          <div className="relative max-w-xl">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Search activity..."
              className="h-9 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

        </div>

      </section>

      <section className="border border-slate-200 bg-white">

        {filtered.length === 0 ? (

          <div className="px-6 py-14 text-center">

            <ClockIcon className="mx-auto h-8 w-8 text-slate-300" />

            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              No audit activity
            </h3>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              There are no activity records matching the
              current search.
            </p>

          </div>

        ) : (

          <div className="divide-y divide-slate-100">

            {filtered.map(
              (activity: any, index: number) => {

                const config =
                  activityConfig(activity);

                const Icon = config.icon;

                const title =
                  activity.title ??
                  activity.action ??
                  activity.event_type ??
                  activity.type ??
                  "Activity";

                const description =
                  activity.description ??
                  activity.message ??
                  activity.details ??
                  null;

                const actor =
                  activity.actor ??
                  activity.user_name ??
                  activity.user ??
                  activity.created_by ??
                  null;

                const timestamp =
                  activity.created_at ??
                  activity.timestamp ??
                  activity.occurred_at ??
                  activity.date ??
                  null;

                const status =
                  activity.status ?? null;

                return (
                  <div
                    key={
                      activity.id ??
                      activity.event_id ??
                      index
                    }
                    className="relative px-5 py-5 transition hover:bg-slate-50"
                  >

                    <div className="flex gap-4">

                      <div className="relative shrink-0">

                        <div
                          className={`flex h-9 w-9 items-center justify-center border ${config.className}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {index <
                          filtered.length - 1 && (
                          <div className="absolute left-1/2 top-9 h-[calc(100%+1px)] w-px -translate-x-1/2 bg-slate-200" />
                        )}

                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">

                          <div className="min-w-0">

                            <div className="text-sm font-medium text-slate-800">
                              {title}
                            </div>

                            {description && (
                              <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                                {description}
                              </div>
                            )}

                          </div>

                          {status && (
                            <span className="inline-flex shrink-0 self-start border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                              {status}
                            </span>
                          )}

                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">

                          {timestamp && (
                            <span>
                              {formatDate(timestamp)}
                            </span>
                          )}

                          {actor && (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              {actor}
                            </span>
                          )}

                          {activity.id && (
                            <span>
                              Event #{activity.id}
                            </span>
                          )}

                        </div>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </section>

    </div>
  );
}
