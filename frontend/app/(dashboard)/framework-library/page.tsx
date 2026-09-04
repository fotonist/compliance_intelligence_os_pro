"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Layers3,
  RefreshCw,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type Version = {
  id: number;
  version_code: string;
  status?: string | null;
};

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  versions?: Version[];
};

function typeLabel(type?: string | null) {
  return type === "MATURITY_BASED"
    ? "Maturity-Based"
    : "Control-Based";
}

function statusClass(status?: string | null) {
  if (status === "published" || status === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "deprecated" || status === "archived") {
    return "bg-slate-100 text-slate-500 border-slate-200";
  }

  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function FrameworkLibraryPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadStandards(refresh = false) {
    try {
      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await apiFetch("/framework/standards");

      if (!response.ok) {
        throw new Error(
          `Unable to load framework library (${response.status}).`
        );
      }

      const data = await response.json();

      setStandards(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load framework library."
      );
      setStandards([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStandards();
  }, []);

  const versionCount = standards.reduce(
    (sum, standard) => sum + (standard.versions?.length ?? 0),
    0
  );

  const assessmentModelCount = new Set(
    standards.map(
      (standard) => standard.type || "CONTROL_BASED"
    )
  ).size;

  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1500px]">

        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <BookOpen size={15} />
              Framework Governance
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Framework Library
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage canonical compliance frameworks, versions,
              structures and mappings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadStandards(true)}
            disabled={loading || refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              Frameworks
              <BookOpen size={18} />
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-950">
              {loading ? "—" : standards.length}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Canonical framework definitions
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              Versions
              <Layers3 size={18} />
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-950">
              {loading ? "—" : versionCount}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Available framework versions
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assessment Models
              <ShieldCheck size={18} />
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-950">
              {loading ? "—" : assessmentModelCount}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Control and maturity structures
            </div>
          </div>

        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">
              Framework Library could not be loaded
            </div>

            <div className="mt-1">{error}</div>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">
              Canonical Frameworks
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Framework definitions are managed independently
              from tenant compliance operations.
            </p>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse bg-slate-50/60"
                />
              ))}
            </div>
          ) : standards.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No frameworks are available.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {standards.map((standard) => (
                <div
                  key={standard.id}
                  className="flex flex-col gap-4 px-5 py-5 hover:bg-slate-50/70 lg:flex-row lg:items-center lg:justify-between"
                >

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-base font-semibold text-slate-950">
                        {standard.title || standard.code}
                      </h3>

                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                        {standard.code}
                      </span>

                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                        {typeLabel(standard.type)}
                      </span>

                    </div>

                    {standard.description && (
                      <p className="mt-1 max-w-3xl text-sm text-slate-500">
                        {standard.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">

                      {(standard.versions ?? []).map((version) => (
                        <span
                          key={version.id}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                            version.status
                          )}`}
                        >
                          {version.version_code} ·{" "}
                          {version.status || "draft"}
                        </span>
                      ))}

                      {(standard.versions ?? []).length === 0 && (
                        <span className="text-xs text-slate-400">
                          No versions available
                        </span>
                      )}

                    </div>
                  </div>

                  <Link
                    href={`/framework-library/${standard.id}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    Open Framework
                    <ChevronRight size={16} />
                  </Link>

                </div>
              ))}

            </div>
          )}

        </section>
      </div>
    </main>
  );
}
