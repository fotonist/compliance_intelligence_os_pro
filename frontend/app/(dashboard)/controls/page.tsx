"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type Control = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  requirement_id?: number | null;
  standard_version_id?: number | null;
};

const PAGE_SIZE = 25;

export default function ControlsPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function loadControls(isRefresh = false) {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await apiFetch(
        `/controls/?skip=0&limit=1000`
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required.");
        }

        throw new Error(
          `Unable to load controls (${response.status}).`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid controls response.");
      }

      setControls(data);
      setPage(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load controls."
      );
      setControls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadControls();
  }, []);

  const filteredControls = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return controls;
    }

    return controls.filter((control) => {
      return (
        control.code?.toLowerCase().includes(query) ||
        control.title?.toLowerCase().includes(query) ||
        String(control.requirement_id ?? "").includes(query)
      );
    });
  }, [controls, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredControls.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const visibleControls = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredControls.slice(start, start + PAGE_SIZE);
  }, [filteredControls, safePage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <main className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <ShieldCheck size={15} />
              Compliance Controls
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Controls
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Tenant-scoped control catalog and control lineage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadControls(true)}
              disabled={loading || refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <Link
              href="/controls/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus size={16} />
              Create Custom Control
            </Link>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Controls
              </span>
              <ClipboardCheck size={18} className="text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-950">
              {loading ? "—" : controls.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Tenant-scoped records
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filtered
              </span>
              <Search size={18} className="text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-950">
              {loading ? "—" : filteredControls.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Matching current search
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Page
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {safePage} / {totalPages}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-950">
              {visibleControls.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Controls displayed
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-xl">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search control code, title or requirement..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {error && (
            <div className="m-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">
                  Controls could not be loaded
                </div>
                <div className="mt-1">{error}</div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Control
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Title
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Requirement
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading &&
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-5 py-4">
                        <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="ml-auto h-8 w-20 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  !error &&
                  visibleControls.map((control) => (
                    <tr
                      key={control.id}
                      className="group transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/controls/${control.id}`}
                          className="font-mono text-sm font-semibold text-blue-700 hover:text-blue-900"
                        >
                          {control.code}
                        </Link>
                      </td>

                      <td className="px-5 py-4">
                        <div className="max-w-[620px] truncate text-sm font-medium text-slate-900">
                          {control.title || "Untitled control"}
                        </div>
                        {control.description && (
                          <div className="mt-1 max-w-[620px] truncate text-xs text-slate-500">
                            {control.description}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {control.requirement_id ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                            #{control.requirement_id}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Not mapped
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/controls/${control.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            View
                            <ArrowUpRight size={13} />
                          </Link>

                          <Link
                            href={`/controls/${control.id}/evidences`}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                          >
                            <FileCheck2 size={13} />
                            Evidence
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  !error &&
                  visibleControls.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <ClipboardCheck
                          size={32}
                          className="mx-auto text-slate-300"
                        />
                        <div className="mt-3 text-sm font-semibold text-slate-700">
                          {search
                            ? "No controls match your search"
                            : "No controls available"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {search
                            ? "Try another search term."
                            : "This tenant has no accessible controls yet."}
                        </div>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          {!loading && !error && filteredControls.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <div className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {(safePage - 1) * PAGE_SIZE + 1}
                </span>
                {"–"}
                <span className="font-semibold text-slate-700">
                  {Math.min(
                    safePage * PAGE_SIZE,
                    filteredControls.length
                  )}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {filteredControls.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="px-2 text-xs font-semibold text-slate-600">
                  {safePage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1)
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
