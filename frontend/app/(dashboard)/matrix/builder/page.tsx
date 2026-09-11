"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
} from "lucide-react";

import { apiFetch } from "@/app/lib/api";

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
};

type Process = {
  id: number;
  code: string;
  name: string;
  purpose?: string | null;
  category_id?: number | null;
  category_code?: string | null;
  category_name?: string | null;
  group_id?: number | null;
  group_code?: string | null;
  group_name?: string | null;
  outcomes?: { id: number; code: string; text: string }[];
  base_practices?: { id: number; code: string; text: string; guidance?: string | null }[];
  work_products?: { id: number; code: string; name: string; description?: string | null; direction?: string | null }[];
};

type Group = {
  id: number;
  code: string;
  name: string;
  processes: Process[];
};

type Category = {
  id: number;
  code: string;
  name: string;
  groups: Group[];
};

type ColumnMap = {
  key: string;
  label: string;
  visible: boolean;
  sourceType: "entity_field" | "derived" | "fixed";
  entity: string;
  field: string;
  position: number;
};

type PamPayload = {
  standard: Standard;
  version: { id: number; version_code: string; status: string };
  framework_model: { id: number; code: string; name: string; model_type: string };
  reference_model?: { id: number; code: string; name: string; model_type: string } | null;
  capability_measurement_framework?: { id: number; code: string; name: string; model_type: string } | null;
  adoption?: { id: number; status: string; process_ids: number[] } | null;
  categories: Category[];
  capability_levels: { id: number; level: number; code: string; name: string; description?: string | null }[];
  process_attributes: { id: number; capability_level_id: number; code: string; name: string; description?: string | null }[];
  counts: { categories: number; groups: number; processes: number };
};

const PAM_COLUMNS: ColumnMap[] = [
  { key: "category_code", label: "Category", visible: true, sourceType: "entity_field", entity: "PamProcessCategory", field: "code", position: 1 },
  { key: "group_code", label: "Process Group", visible: true, sourceType: "entity_field", entity: "PamProcessGroup", field: "code", position: 2 },
  { key: "code", label: "Process Code", visible: true, sourceType: "entity_field", entity: "PamProcess", field: "code", position: 3 },
  { key: "name", label: "Process Name", visible: true, sourceType: "entity_field", entity: "PamProcess", field: "name", position: 4 },
  { key: "purpose", label: "Purpose", visible: true, sourceType: "entity_field", entity: "PamProcess", field: "purpose", position: 5 },
  { key: "outcomes", label: "Outcomes", visible: true, sourceType: "entity_field", entity: "PamProcessOutcome", field: "text", position: 6 },
  { key: "base_practices", label: "Base Practices", visible: true, sourceType: "entity_field", entity: "PamBasePractice", field: "text", position: 7 },
  { key: "work_products", label: "Work Products", visible: true, sourceType: "entity_field", entity: "PamWorkProduct", field: "name", position: 8 },
];

function flattenProcesses(categories: Category[]) {
  return categories.flatMap((category) => category.groups.flatMap((group) => group.processes));
}

export default function MatrixBuilderPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [standardId, setStandardId] = useState<number | "">("");
  const [data, setData] = useState<PamPayload | null>(null);
  const [selectedProcessIds, setSelectedProcessIds] = useState<number[]>([]);
  const [columns, setColumns] = useState<ColumnMap[]>(PAM_COLUMNS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const processes = useMemo(() => flattenProcesses(data?.categories ?? []), [data]);
  const selectedCount = selectedProcessIds.length;
  const visibleColumns = columns.filter((column) => column.visible);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/standards/")
      .then((response) => response.json())
      .then((body) => {
        const source = Array.isArray(body) ? body : body?.items ?? body?.standards ?? [];
        const list = source
          .map((item: any) => ({ id: Number(item.id), code: item.code, title: item.title ?? null, type: item.type ?? item.standard_type ?? null }))
          .filter((item: Standard) => item.id && item.code)
          .sort((a: Standard, b: Standard) => a.code.localeCompare(b.code));
        if (!cancelled) setStandards(list);
      })
      .catch(() => {
        if (!cancelled) setMessage("Standards could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);

  async function loadPam(targetId: number) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch(`/matrix/pam?standard_id=${targetId}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail ?? "PAM configuration could not be loaded.");
      setData(body);
      const all = flattenProcesses(body.categories ?? []);
      setSelectedProcessIds(body.adoption?.process_ids?.length ? body.adoption.process_ids : all.map((item) => item.id));
      setExpanded({});
      setColumns(PAM_COLUMNS);
    } catch (error) {
      setData(null);
      setSelectedProcessIds([]);
      setMessage(error instanceof Error ? error.message : "PAM configuration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function toggleProcess(id: number) {
    setSelectedProcessIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleGroup(group: Group) {
    const ids = group.processes.map((process) => process.id);
    const allSelected = ids.every((id) => selectedProcessIds.includes(id));
    setSelectedProcessIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }

  function toggleCategory(category: Category) {
    const ids = category.groups.flatMap((group) => group.processes.map((process) => process.id));
    const allSelected = ids.every((id) => selectedProcessIds.includes(id));
    setSelectedProcessIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }

  function moveColumn(index: number, direction: -1 | 1) {
    setColumns((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((column, position) => ({ ...column, position: position + 1 }));
    });
  }

  function updateColumn(key: string, patch: Partial<ColumnMap>) {
    setColumns((current) => current.map((column) => column.key === key ? { ...column, ...patch } : column));
  }

  async function generateInstance() {
    if (!data || selectedCount === 0) {
      setMessage("Select at least one process before generating the matrix instance.");
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const response = await apiFetch("/matrix/pam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standard_id: data.standard.id,
          standard_version_id: data.version.id,
          process_ids: selectedProcessIds,
          columns: visibleColumns,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail ?? "Matrix instance generation failed.");
      setMessage(`Matrix instance ${body.matrix_instance_id} created with ${body.row_count} processes.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Matrix instance generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Layers3 className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Matrix Builder</div>
                  <h1 className="mt-1 text-2xl font-semibold">Framework matrix configuration</h1>
                  <p className="mt-1 max-w-3xl text-sm text-slate-300">Configure the canonical framework structure, process scope, capability dimension and column mapping before creating a tenant matrix instance.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>{data ? `${data.framework_model.code} / ${data.version.version_code}` : "No framework selected"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end">
            <Field label="Framework">
              <select
                value={standardId}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setStandardId(value || "");
                  if (value) loadPam(value);
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Select a standard</option>
                {standards.map((standard) => <option key={standard.id} value={standard.id}>{standard.code} - {standard.title ?? ""}</option>)}
              </select>
            </Field>
            <InfoCard label="Reference Model" value={data?.reference_model ? `${data.reference_model.code} - ${data.reference_model.name}` : "-"} />
            <InfoCard label="Capability Model" value={data?.capability_measurement_framework ? `${data.capability_measurement_framework.code} - ${data.capability_measurement_framework.name}` : "-"} />
            <button type="button" onClick={() => standardId && loadPam(Number(standardId))} disabled={!standardId || loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </button>
          </div>
        </section>

        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <Metric label="Categories" value={data.counts.categories} />
              <Metric label="Process Groups" value={data.counts.groups} />
              <Metric label="Reference Processes" value={data.counts.processes} />
              <Metric label="Selected Processes" value={selectedCount} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader icon={<Layers3 className="h-4 w-4" />} title="Structure Selection" subtitle="Select the canonical processes that will become rows in the matrix instance." />
              <div className="divide-y divide-slate-100">
                {data.categories.map((category) => {
                  const categoryIds = category.groups.flatMap((group) => group.processes.map((process) => process.id));
                  const categorySelected = categoryIds.length > 0 && categoryIds.every((id) => selectedProcessIds.includes(id));
                  const categoryOpen = expanded[`c:${category.id}`] ?? true;
                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-3 bg-slate-50 px-5 py-3">
                        <button type="button" onClick={() => setExpanded((current) => ({ ...current, [`c:${category.id}`]: !categoryOpen }))}>{categoryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                        <input type="checkbox" checked={categorySelected} onChange={() => toggleCategory(category)} />
                        <div className="font-semibold text-slate-900">{category.code}</div>
                        <div className="text-sm text-slate-500">{category.name}</div>
                      </div>
                      {categoryOpen && category.groups.map((group) => {
                        const groupIds = group.processes.map((process) => process.id);
                        const groupSelected = groupIds.length > 0 && groupIds.every((id) => selectedProcessIds.includes(id));
                        const groupOpen = expanded[`g:${group.id}`] ?? true;
                        return (
                          <div key={group.id} className="border-t border-slate-100">
                            <div className="flex items-center gap-3 px-8 py-3">
                              <button type="button" onClick={() => setExpanded((current) => ({ ...current, [`g:${group.id}`]: !groupOpen }))}>{groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                              <input type="checkbox" checked={groupSelected} onChange={() => toggleGroup(group)} />
                              <div className="font-medium text-slate-800">{group.code}</div>
                              <div className="text-sm text-slate-500">{group.name}</div>
                            </div>
                            {groupOpen && <div className="grid gap-2 px-12 pb-4 lg:grid-cols-2 xl:grid-cols-3">
                              {group.processes.map((process) => (
                                <label key={process.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedProcessIds.includes(process.id) ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                                  <input type="checkbox" checked={selectedProcessIds.includes(process.id)} onChange={() => toggleProcess(process.id)} className="mt-1" />
                                  <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{process.code}</span><span className="block text-sm text-slate-600">{process.name}</span></span>
                                </label>
                              ))}
                            </div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader icon={<Database className="h-4 w-4" />} title="Canonical PAM Content" subtitle="The selected process keeps its canonical purpose, outcomes, base practices and work products. This screen does not author standard content." />
              <div className="grid gap-4 p-5 md:grid-cols-4">
                <InfoCard label="Purpose" value="Process purpose is carried by the canonical PAM process definition." />
                <InfoCard label="Outcomes" value="Canonical process outcomes are retained in the instance payload." />
                <InfoCard label="Base Practices" value="Canonical base practices are retained for downstream implementation work." />
                <InfoCard label="Work Products" value="Canonical work product relationships are retained for evidence planning." />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Capability Dimension" subtitle="Capability levels and process attributes are reference-model configuration, not assessment results." />
              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                {data.capability_levels.map((level) => {
                  const attributes = data.process_attributes.filter((item) => item.capability_level_id === level.id);
                  return <div key={level.id} className="rounded-xl border border-slate-200 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Level {level.level}</div><div className="mt-1 font-semibold text-slate-900">{level.code} - {level.name}</div><div className="mt-3 space-y-1">{attributes.map((attribute) => <div key={attribute.id} className="text-sm text-slate-600">{attribute.code} - {attribute.name}</div>)}</div></div>;
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader icon={<SlidersHorizontal className="h-4 w-4" />} title="Column Mapping" subtitle="Columns are configured here. Assessment, evidence, risk, gap and coverage results are intentionally excluded from the structural matrix." />
              <div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Column</th><th className="px-4 py-3">Label</th><th className="px-4 py-3">Source Type</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Field</th><th className="px-4 py-3">Visible</th><th className="px-4 py-3">Position</th></tr></thead><tbody className="divide-y divide-slate-100">{columns.map((column, index) => <tr key={column.key}><td className="px-4 py-3 font-mono text-xs text-slate-600">{column.key}</td><td className="px-4 py-3"><input value={column.label} onChange={(event) => updateColumn(column.key, { label: event.target.value })} className="h-9 w-48 rounded-md border border-slate-300 px-2 text-sm" /></td><td className="px-4 py-3"><select value={column.sourceType} onChange={(event) => updateColumn(column.key, { sourceType: event.target.value as ColumnMap["sourceType"] })} className="h-9 rounded-md border border-slate-300 px-2 text-sm"><option value="entity_field">Entity Field</option><option value="derived">Derived</option><option value="fixed">Fixed</option></select></td><td className="px-4 py-3 text-slate-600">{column.entity}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{column.field}</td><td className="px-4 py-3"><button type="button" onClick={() => updateColumn(column.key, { visible: !column.visible })} className="rounded-md p-1 hover:bg-slate-100">{column.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-slate-400" />}</button></td><td className="px-4 py-3"><div className="flex items-center gap-1"><button type="button" onClick={() => moveColumn(index, -1)} disabled={index === 0} className="rounded-md border p-1 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => moveColumn(index, 1)} disabled={index === columns.length - 1} className="rounded-md border p-1 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button><span className="ml-1 text-xs text-slate-500">{column.position}</span></div></td></tr>)}</tbody></table></div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader icon={<Table2 className="h-4 w-4" />} title="Instance Preview" subtitle="Preview contains only the selected structural processes and their canonical content." />
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4"><button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {preview ? "Hide preview" : "Show preview"}</button><span className="text-sm text-slate-500">{selectedCount} of {processes.length} processes selected</span></div>
              {preview && <div className="max-h-[520px] overflow-auto"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{visibleColumns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{processes.filter((process) => selectedProcessIds.includes(process.id)).map((process) => <tr key={process.id}>{visibleColumns.map((column) => <td key={column.key} className="max-w-[320px] px-4 py-3 align-top text-slate-700">{renderProcessValue(process, column.key)}</td>)}</tr>)}</tbody></table></div>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4" /> Matrix Instance</div><p className="mt-1 text-sm text-slate-500">Generation creates the structural snapshot. Tenant adoption and assessment are separate lifecycle steps.</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => setColumns(PAM_COLUMNS)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"><Save className="h-4 w-4" /> Reset mapping</button><button type="button" onClick={generateInstance} disabled={generating || selectedCount === 0} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Generate Matrix Instance</button></div></div>
              {message && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function renderProcessValue(process: Process, key: string) {
  if (key === "category_code") return process.category_code ?? "-";
  if (key === "group_code") return process.group_code ?? "-";
  if (key === "code") return <span className="font-mono font-semibold">{process.code}</span>;
  if (key === "name") return process.name;
  if (key === "purpose") return process.purpose ?? "-";
  if (key === "outcomes") return process.outcomes?.map((item) => `${item.code}: ${item.text}`).join("; ") || "-";
  if (key === "base_practices") return process.base_practices?.map((item) => `${item.code}: ${item.text}`).join("; ") || "-";
  if (key === "work_products") return process.work_products?.map((item) => `${item.code}: ${item.name}`).join("; ") || "-";
  return "-";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>{children}</div>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-medium text-slate-800">{value}</div></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</div></div>;
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{icon}{title}</div><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>;
}
