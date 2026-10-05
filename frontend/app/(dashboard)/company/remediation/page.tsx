"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/api";
import { ArrowUpRight, CheckCircle2, ChevronRight, Clock3, Filter, ListChecks, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";

type RemediationItem = {
  source: string;
  source_id: number;
  title: string;
  description?: string | null;
  status: string;
  normalized_status: string;
  priority?: string | null;
  priority_score?: number | null;
  severity?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
  process_id?: number | null;
  control_id?: number | null;
  due_date?: string | null;
  overdue: boolean;
  due_soon: boolean;
  awaiting_review: boolean;
  action_url: string;
};

type RemediationSummary = {
  total: number;
  active: number;
  overdue: number;
  due_soon: number;
  high_priority: number;
  awaiting_review: number;
  completed: number;
};

type RemediationResponse = {
  summary: RemediationSummary;
  items: RemediationItem[];
};

const statuses = ["OPEN", "IN_PROGRESS", "BLOCKED", "UNDER_REVIEW", "READY_TO_CLOSE", "DONE", "CANCELLED"];
const normalize = (value?: string | null) => String(value || "").trim().toUpperCase();
const label = (value?: string | null) => value ? value.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "Not specified";
function dateLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "No due date";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function statusTone(status: string) {
  if (status === "DONE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "BLOCKED") return "border-red-200 bg-red-50 text-red-700";
  if (["UNDER_REVIEW", "READY_TO_CLOSE"].includes(status)) return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function RemediationCenterPage() {
  const [items, setItems] = useState<RemediationItem[]>([]);
  const [summary, setSummary] = useState<RemediationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
    const [status, setStatus] = useState("ALL");
  const [process, setProcess] = useState("ALL");
  const [view, setView] = useState("ALL");
  const [sort, setSort] = useState("due");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  async function load(signal?: AbortSignal) {
    setLoading(true); setError(null);
    try {
      const response = await apiFetch("/company/remediation", { signal });
      if (!response.ok) throw new Error(`Unable to load remediation portfolio (HTTP ${response.status}).`);

      const body = (await response.json()) as RemediationResponse;

      if (
        !body ||
        !body.summary ||
        !Array.isArray(body.items)
      ) {
        throw new Error("Unexpected remediation response. Refresh or check the API contract.");
      }

      if (signal?.aborted) return;

      setItems(body.items);
      setSummary(body.summary);
      setUpdatedAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Unable to load actions.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }
  const counts = {
    active: summary?.active ?? 0,
    overdue: summary?.overdue ?? 0,
    review: summary?.awaiting_review ?? 0,
    done: summary?.completed ?? 0,
    blocked: items.filter(item => normalize(item.status) === "BLOCKED").length,
    unassigned: items.filter(
      item =>
        item.normalized_status === "ACTIVE" &&
        item.owner_id == null
    ).length,
  };

  const filtered = useMemo(() => {
    const search = query.toLowerCase().trim();

    return items
      .filter(item => {
        if (status !== "ALL" && normalize(item.status) !== status) return false;
        if (process !== "ALL" && String(item.process_id) !== process) return false;

        if (view === "ACTIVE" && item.normalized_status !== "ACTIVE") return false;
        if (view === "OVERDUE" && !item.overdue) return false;
        if (view === "REVIEW" && !item.awaiting_review) return false;
        if (view === "DONE" && item.normalized_status !== "COMPLETED") return false;
        if (view === "BLOCKED" && normalize(item.status) !== "BLOCKED") return false;
        if (
          view === "UNASSIGNED" &&
          (item.normalized_status !== "ACTIVE" || item.owner_id != null)
        ) return false;

        return (
          !search ||
          [
            item.title,
            item.source,
            item.source_id,
            item.description,
            item.owner_name,
            item.reviewer_name,
            item.process_id,
            item.control_id,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
        );
      })
      .sort((a, b) => {
        if (sort === "priority") {
          return (
            (b.priority_score ?? -1) -
              (a.priority_score ?? -1) ||
            b.source_id - a.source_id
          );
        }

        if (sort === "newest") {
          return b.source_id - a.source_id;
        }

        const aDue = a.due_date ? Date.parse(a.due_date) : Infinity;
        const bDue = b.due_date ? Date.parse(b.due_date) : Infinity;

        return aDue - bDue || b.source_id - a.source_id;
      });
  }, [items, query, status, process, view, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const processIds = Array.from(
    new Set(
      items
        .map(item => item.process_id)
        .filter((id): id is number => id != null)
    )
  ).sort((a, b) => a - b);

  function selectView(value: string) {
    setView(current => current === value ? "ALL" : value);
    setStatus("ALL");
    setPage(1);
  }

  function reset() {
    setQuery("");
    setStatus("ALL");
    setProcess("ALL");
    setView("ALL");
    setSort("due");
    setPage(1);
  }

  const unavailable = loading || (!!error && updatedAt === null);
  const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
  const input = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200";

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 text-slate-900 md:p-7 xl:p-9">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">Governance <ChevronRight size={12} /> Remediation</div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Remediation Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Track corrective work, resolve blockers and move actions toward verified closure.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={loading} onClick={() => void load()} className={button}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
            <Link href="/company/tasks" className={button}>Task register <ArrowUpRight size={14} /></Link>
            <Link href="/company/tasks/create" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">Create action <ArrowUpRight size={14} /></Link>
          </div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Actions could not be refreshed.</strong><p className="mt-1 break-words">{error}</p>{updatedAt !== null && <p className="mt-2 text-xs">Showing the last successful result. Counts may be out of date.</p>}</div>}

        <section aria-label="Action portfolio" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { name: "Active actions", value: counts.active, caption: "Open work across your selected scope", filter: "ACTIVE", icon: ListChecks, tone: "bg-blue-50 text-blue-600" },
            { name: "Overdue", value: counts.overdue, caption: "Active actions past their due date", filter: "OVERDUE", icon: Clock3, tone: "bg-red-50 text-red-600" },
            { name: "Awaiting review", value: counts.review, caption: "Under review or ready for closure", filter: "REVIEW", icon: ShieldCheck, tone: "bg-violet-50 text-violet-600" },
            { name: "Completed", value: counts.done, caption: "Recorded as done in the task workflow", filter: "DONE", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
          ].map(card => <button type="button" key={card.name} onClick={() => selectView(card.filter)} aria-pressed={view === card.filter} className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-blue-300 ${view === card.filter ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200"}`}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{card.name}</span><span className={`rounded-lg p-2 ${card.tone}`}><card.icon size={17} /></span></div><div className="mt-3 text-3xl font-semibold tracking-tight">{unavailable ? "--" : card.value}</div><div className="mt-2 text-[11px] text-slate-500">{card.caption}</div></button>)}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Action portfolio</h2>
              <p className="mt-1 text-xs text-slate-500">
                Canonical remediation portfolio across findings, corrective actions and remediation tasks.
              </p>
            </div>
            {view !== "ALL" && (
              <button type="button" className={button} onClick={() => selectView("ALL")}>
                Clear portfolio view
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3 p-5">
            <div className="relative min-w-48 flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search actions" className={`${input} w-full pl-9`} placeholder="Search action, owner role or source..." value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div>
            <select aria-label="Status filter" className={input} value={status} onChange={event => { setStatus(event.target.value); setView("ALL"); setPage(1); }}><option value="ALL">All statuses</option>{statuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select>
            <select aria-label="Process filter" className={input} value={process} onChange={event => { setProcess(event.target.value); setPage(1); }}><option value="ALL">All processes</option>{processIds.map(id => <option key={id} value={String(id)}>Process #{id}</option>)}</select>
            <select aria-label="Sort actions" className={input} value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="due">Due date: earliest</option><option value="priority">Priority score: highest</option><option value="newest">ID: newest</option></select>
            <button type="button" className={button} onClick={reset}><Filter size={13} /> Reset</button>
          </div>
                    {loading ? (
            <div role="status" className="space-y-3 px-5 pb-5">
              <p className="text-sm text-slate-500">Loading remediation portfolio...</p>
              {[1, 2, 3].map(id => (
                <div key={id} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : error && updatedAt === null ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Use Refresh to retry. No remediation counts are available.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <ListChecks className="mx-auto mb-4 text-slate-300" size={32} />
              <h3 className="text-sm font-semibold">No matching remediation actions</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
                Adjust the filters or clear the selected portfolio view.
              </p>
              <button type="button" onClick={reset} className={`${button} mt-4`}>
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="border-y border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {[
                      "Action / source",
                      "Process / control",
                      "Owner / reviewer",
                      "Priority",
                      "Due date",
                      "Status",
                      "",
                    ].map((text, index) => (
                      <th scope="col" className="px-5 py-3 font-semibold" key={index}>
                        {text || <span className="sr-only">Open remediation</span>}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {visible.map(item => (
                    <tr
                      key={`${item.source}-${item.source_id}`}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="max-w-sm px-5 py-4">
                        <Link
                          href={item.action_url}
                          className="font-semibold text-slate-900 hover:text-blue-700"
                        >
                          {item.title}
                        </Link>

                        <div className="mt-1.5 text-[11px] text-slate-500">
                          {label(item.source)} #{item.source_id}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {item.process_id != null
                          ? `Process #${item.process_id}`
                          : "No process linked"}

                        <div className="mt-1 text-[11px] text-slate-400">
                          {item.control_id != null
                            ? `Control #${item.control_id}`
                            : "No control linked"}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {item.owner_name || "Unassigned"}

                        <div className="mt-1 text-[11px] text-slate-400">
                          {item.reviewer_name
                            ? `Reviewer: ${item.reviewer_name}`
                            : "No reviewer"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-semibold">
                          {item.priority || "--"}
                        </span>

                        {item.priority_score != null && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            Score {item.priority_score}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={
                            item.overdue
                              ? "font-medium text-red-700"
                              : "text-slate-600"
                          }
                        >
                          {dateLabel(item.due_date)}
                        </span>

                        {item.overdue && (
                          <div className="mt-1 text-[10px] font-semibold text-red-600">
                            Overdue
                          </div>
                        )}

                        {!item.overdue && item.due_soon && (
                          <div className="mt-1 text-[10px] font-semibold text-amber-600">
                            Due soon
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(normalize(item.status))}`}
                        >
                          {label(item.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={item.action_url}
                          aria-label={`Open remediation ${item.source} ${item.source_id}`}
                          className={button}
                        >
                          Open <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>{unavailable ? "--" : filtered.length} matching actions / {unavailable ? "--" : items.length} in remediation portfolio</span><div className="flex items-center gap-3"><button type="button" className={button} disabled={loading || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" className={button} disabled={loading || currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
        </section>
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert size={15} className="text-amber-600" /> Attention required</h2><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} onClick={() => selectView("BLOCKED")}>Blocked <span className="rounded bg-amber-50 px-2 text-amber-800">{unavailable ? "--" : counts.blocked}</span></button><button type="button" className={button} onClick={() => selectView("UNASSIGNED")}>Unassigned active actions <span className="rounded bg-slate-100 px-2">{unavailable ? "--" : counts.unassigned}</span></button></div><p className="mt-3 text-xs leading-5 text-slate-500">Summary counts come from the canonical remediation portfolio. Search, status and process filters apply to the table.</p></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold">Controlled closure</h2><p className="mt-2 text-xs leading-6 text-slate-500">Open an action to manage evidence, review and closure through the existing task workflow and its authorization checks.</p></section>
        </div>
        <footer className="flex flex-wrap justify-between gap-2 pb-4 text-[11px] text-slate-400"><span>Visibility follows remediation source authorization and tenant scope.</span><span>{updatedAt ? `Last refreshed ${new Date(updatedAt).toLocaleTimeString("en-GB")}` : "Waiting for first successful load"}</span></footer>
      </div>
    </div>
  );
}
