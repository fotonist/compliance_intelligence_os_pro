"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface Props {
  workspace: any;
}

function statusLabel(status: string) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "approved") return "Approved";
  if (normalized === "waiting_approval") return "Pending";
  if (normalized === "uploaded") return "Uploaded";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "draft") return "Draft";

  return status || "Unknown";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status ?? "").toLowerCase();

  const config =
    normalized === "approved"
      ? {
          label: "Approved",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
          icon: CheckCircleIcon,
        }
      : normalized === "waiting_approval"
        ? {
            label: "Pending",
            className:
              "border-amber-200 bg-amber-50 text-amber-700",
            icon: ClockIcon,
          }
        : normalized === "rejected"
          ? {
              label: "Rejected",
              className:
                "border-red-200 bg-red-50 text-red-700",
              icon: XCircleIcon,
            }
          : {
              label: statusLabel(status),
              className:
                "border-slate-200 bg-slate-50 text-slate-600",
              icon: DocumentTextIcon,
            };

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </div>

      <div className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-0.5 text-[10px] text-slate-500">
        {description}
      </div>
    </div>
  );
}

export default function WorkspaceEvidence({
  workspace,
}: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const evidences = Array.isArray(workspace?.evidences)
    ? workspace.evidences
    : [];

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return evidences.filter((evidence: any) => {
      const status =
        String(evidence.status ?? "").toLowerCase();

      const searchable = [
        evidence.title,
        evidence.description,
        evidence.evidence_type,
        evidence.owner,
        evidence.file_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !normalizedQuery ||
        searchable.includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [evidences, query, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: evidences.length,
      approved: evidences.filter(
        (e: any) =>
          String(e.status ?? "").toLowerCase() === "approved"
      ).length,
      pending: evidences.filter(
        (e: any) =>
          String(e.status ?? "").toLowerCase() ===
          "waiting_approval"
      ).length,
      rejected: evidences.filter(
        (e: any) =>
          String(e.status ?? "").toLowerCase() === "rejected"
      ).length,
    };
  }, [evidences]);

  return (
    <div className="space-y-5">

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Compliance Assurance
              </div>

              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Evidence Register
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Evidence supporting the current compliance object.
              </p>
            </div>

            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
              {filtered.length} of {counts.total} records
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 xl:grid-cols-4">
          <Metric
            label="Total"
            value={counts.total}
            description="Supporting records"
          />

          <Metric
            label="Approved"
            value={counts.approved}
            description="Assured evidence"
          />

          <Metric
            label="Pending"
            value={counts.pending}
            description="Awaiting review"
          />

          <Metric
            label="Rejected"
            value={counts.rejected}
            description="Requires attention"
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search evidence..."
              className="h-9 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="waiting_approval">
              Pending
            </option>
            <option value="uploaded">Uploaded</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </section>

      <section className="border border-slate-200 bg-white">

        <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_90px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:grid">
          <div>Evidence</div>
          <div>Type</div>
          <div>Status</div>
          <div className="text-right">Record</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ExclamationCircleIcon className="mx-auto h-8 w-8 text-slate-300" />

            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              No evidence records
            </h3>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              No evidence matches the current search and
              status filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((evidence: any, index: number) => (
              <div
                key={
                  evidence.id ??
                  evidence.evidence_id ??
                  index
                }
                className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_130px_130px_90px] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
                      <DocumentTextIcon className="h-4 w-4 text-slate-500" />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {evidence.title ||
                          evidence.file_name ||
                          "Untitled evidence"}
                      </div>

                      {evidence.description && (
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {evidence.description}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                        {evidence.owner && (
                          <span>
                            Owner: {evidence.owner}
                          </span>
                        )}

                        {evidence.created_at && (
                          <span>
                            Created:{" "}
                            {String(
                              evidence.created_at
                            ).slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  <span className="lg:hidden text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Type ·{" "}
                  </span>
                  {evidence.evidence_type ||
                    evidence.type ||
                    "Evidence"}
                </div>

                <div>
                  <StatusBadge
                    status={evidence.status}
                  />
                </div>

                <div className="text-left text-[10px] text-slate-400 lg:text-right">
                  #{evidence.id ?? index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

      </section>

    </div>
  );
}
