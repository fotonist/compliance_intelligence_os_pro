"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Layers3 } from "lucide-react";
import { apiFetch } from "@/services/api";

type MatrixInstance = {
  id: number;
  status?: string;
  standard_id?: number;
  standard_code?: string;
  standard_version_id?: number;
  standard_version_code?: string;
  framework_adoption_id?: number | null;
  row_count?: number;
  framework_model?: { id: number; code: string; name: string } | null;
  created_at?: string;
};

type PamOutcome = { id: number; code?: string; text?: string };
type PamPractice = {
  id: number;
  code?: string;
  text?: string;
  guidance?: string | null;
};
type PamWorkProduct = {
  id: number;
  code?: string;
  name?: string;
  description?: string | null;
  direction?: string | null;
};

type PamProcess = {
  id: number;
  code: string;
  name: string;
  purpose?: string | null;
  description?: string | null;
  category_id?: number | null;
  category_code?: string | null;
  category_name?: string | null;
  group_id?: number | null;
  group_code?: string | null;
  group_name?: string | null;
  outcomes?: PamOutcome[];
  base_practices?: PamPractice[];
  work_products?: PamWorkProduct[];
};

type PamRow = {
  id: number;
  row_key?: string;
  category_id?: number | null;
  group_id?: number | null;
  pam_process_id?: number | null;
  payload?: PamProcess;
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 py-4 first:border-t-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          {title}
        </h3>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {children}
    </section>
  );
}

export default function PamMatrixInstancePage() {
  const params = useParams<{ instanceId: string }>();
  const instanceId = Number(params.instanceId);

  const [instance, setInstance] = useState<MatrixInstance | null>(null);
  const [rows, setRows] = useState<PamRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(instanceId)) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [instanceRes, rowsRes] = await Promise.all([
          apiFetch(`/matrix/pam/instances/${instanceId}`),
          apiFetch(`/matrix/pam/instances/${instanceId}/rows?limit=500&offset=0`),
        ]);

        if (!instanceRes.ok) {
          throw new Error(`Matrix instance request failed: ${instanceRes.status}`);
        }
        if (!rowsRes.ok) {
          throw new Error(`Matrix rows request failed: ${rowsRes.status}`);
        }

        const instanceData = await instanceRes.json();
        const rowsData = await rowsRes.json();

        setInstance(instanceData);
        setRows(Array.isArray(rowsData?.items) ? rowsData.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PAM matrix instance");
        setInstance(null);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [instanceId]);

  const groups = useMemo(() => {
    const map = new Map<string, { code: string; name: string; category: string; rows: PamRow[] }>();

    for (const row of rows) {
      const process = row.payload;
      if (!process) continue;
      const key = `${process.category_id ?? "x"}:${process.group_id ?? "x"}`;
      const current = map.get(key);
      if (current) {
        current.rows.push(row);
      } else {
        map.set(key, {
          code: process.group_code || "Group",
          name: process.group_name || "Process Group",
          category: process.category_name || process.category_code || "Category",
          rows: [row],
        });
      }
    }

    return Array.from(map.values());
  }, [rows]);

  return (
    <main className="min-h-full bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/matrix/instances"
              className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Matrix Instances
            </Link>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              <Layers3 className="h-3.5 w-3.5" />
              Compliance Management
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Compliance Matrix
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Canonical PAM structure for the selected matrix instance. Assessment, evidence, risk and improvement remain separate operational layers.
            </p>
          </div>

          {instance && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700">
                {instance.standard_code || "Standard"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
                {instance.standard_version_code ? `Version ${instance.standard_version_code}` : "Version —"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
                {rows.length} processes
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading canonical PAM matrix...
          </div>
        ) : error ? (
          <div className="border border-red-200 bg-white p-8 text-sm text-red-700">
            {error}
          </div>
        ) : !instance ? (
          <div className="border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Matrix instance not found.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={`${group.category}:${group.code}`} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {group.category}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div>
                      <span className="mr-2 text-sm font-semibold text-slate-900">{group.code}</span>
                      <span className="text-sm text-slate-600">{group.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{group.rows.length} processes</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.rows.map((row) => {
                    const process = row.payload;
                    if (!process) return null;
                    const isOpen = expanded === process.id;

                    return (
                      <div key={row.id}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : process.id)}
                          className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{process.code}</span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{process.name}</span>
                          <span className="hidden text-xs text-slate-400 md:block">
                            {(process.base_practices || []).length} base practices
                          </span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 pl-12">
                            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                              <div className="xl:col-span-3">
                                <Section title="Purpose" count={process.purpose ? 1 : 0}>
                                  <p className="max-w-5xl text-sm leading-6 text-slate-700">
                                    {process.purpose || process.description || "No purpose defined in the canonical dataset."}
                                  </p>
                                </Section>
                              </div>

                              <Section title="Outcomes" count={(process.outcomes || []).length}>
                                <div className="space-y-2">
                                  {(process.outcomes || []).map((item) => (
                                    <div key={item.id} className="border border-slate-200 bg-white px-3 py-2.5">
                                      <div className="text-[11px] font-semibold text-slate-500">{item.code || "Outcome"}</div>
                                      <div className="mt-1 text-sm text-slate-700">{item.text}</div>
                                    </div>
                                  ))}
                                </div>
                              </Section>

                              <Section title="Base Practices" count={(process.base_practices || []).length}>
                                <div className="space-y-2">
                                  {(process.base_practices || []).map((item) => (
                                    <div key={item.id} className="border border-slate-200 bg-white px-3 py-2.5">
                                      <div className="text-[11px] font-semibold text-slate-500">{item.code || "Practice"}</div>
                                      <div className="mt-1 text-sm text-slate-700">{item.text}</div>
                                      {item.guidance && (
                                        <div className="mt-2 text-xs leading-5 text-slate-500">{item.guidance}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </Section>

                              <Section title="Work Products" count={(process.work_products || []).length}>
                                <div className="space-y-2">
                                  {(process.work_products || []).map((item) => (
                                    <div key={item.id} className="border border-slate-200 bg-white px-3 py-2.5">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-semibold text-slate-500">{item.code || "Work Product"}</div>
                                        {item.direction && <span className="text-[10px] uppercase tracking-wide text-slate-400">{item.direction}</span>}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-700">{item.name}</div>
                                      {item.description && <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div>}
                                    </div>
                                  ))}
                                </div>
                              </Section>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
