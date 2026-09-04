"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  Info,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  X,
  AlertTriangle,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/app/lib/api";

type Mode = "control" | "maturity";

type StandardOption = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
};

type ColumnMap = {
  key: string;
  label: string;
  visible: boolean;
  sourceType: "entity_field" | "derived" | "fixed";
  entity: string;
  field: string;
  fixedValue?: string;
  position?: number;
};

type AppModalState = {
  title: string;
  description?: string;
  tone: "success" | "error" | "info";
  lines: string[];
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

const DEFAULT_COLUMNS: ColumnMap[] = [
  {
    key: "clause_code",
    label: "Clause Code",
    visible: true,
    sourceType: "entity_field",
    entity: "Clause",
    field: "code",
    position: 1,
  },
  {
    key: "clause_description",
    label: "Clause Definition",
    visible: true,
    sourceType: "entity_field",
    entity: "Clause",
    field: "description",
    position: 2,
  },
  {
    key: "requirement_code",
    label: "Requirement Code",
    visible: true,
    sourceType: "entity_field",
    entity: "Requirement",
    field: "code",
    position: 3,
  },
  {
    key: "requirement_description",
    label: "Requirement Definition",
    visible: true,
    sourceType: "entity_field",
    entity: "Requirement",
    field: "description",
    position: 4,
  },
  {
    key: "control_code",
    label: "Control Code",
    visible: true,
    sourceType: "entity_field",
    entity: "Control",
    field: "code",
    position: 5,
  },
  {
    key: "control_description",
    label: "Control Definition",
    visible: true,
    sourceType: "entity_field",
    entity: "Control",
    field: "description",
    position: 6,
  },
  {
    key: "risk_level",
    label: "Risk Level",
    visible: true,
    sourceType: "entity_field",
    entity: "Risk",
    field: "risk_level",
    position: 7,
  },
  {
    key: "coverage_status",
    label: "Coverage Status",
    visible: true,
    sourceType: "derived",
    entity: "Control",
    field: "coverage_status",
    position: 8,
  },
];



export default function MatrixBuilderPage() {
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [standardId, setStandardId] = useState<number | "">("");
  const [mode, setMode] = useState<Mode>("control");

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<ColumnMap[]>([]);

  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [onlyPreview, setOnlyPreview] = useState(true);
  const [dedupStrategy, setDedupStrategy] =
    useState<"skip" | "overwrite">("skip");

  const [notice, setNotice] = useState<Notice | null>(null);
  const [modal, setModal] = useState<AppModalState | null>(null);

  const selectedStandard = useMemo(
    () =>
      standards.find((standard) => standard.id === standardId) ?? null,
    [standardId, standards]
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible),
    [columns]
  );

  const previewRows = useMemo(
    () => rows.slice(0, 50),
    [rows]
  );

  const readiness = useMemo(() => {
    const checks = {
      standard: Boolean(selectedStandard),
      rows: rows.length > 0,
      columns: columns.length > 0,
      visible: visibleColumns.length > 0,
    };

    const passed = Object.values(checks).filter(Boolean).length;

    return {
      checks,
      passed,
      total: Object.keys(checks).length,
      ready: Object.values(checks).every(Boolean),
    };
  }, [selectedStandard, rows, columns, visibleColumns]);

  /* ==========================================================
     LOAD STANDARDS
     ========================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadStandards() {
      setLoadingStandards(true);

      try {
        const response = await apiFetch("/standards/");

        const data = await response.json();

        const source = Array.isArray(data)
          ? data
          : data?.items ?? data?.standards ?? [];

        const list: StandardOption[] = source
          .map((item: any) => ({
            id: Number(item.id),
            code: item.code,
            title: item.title ?? null,
            type:
              item.type ??
              item.standard_type ??
              item.assessment_type ??
              null,
          }))
          .filter((item: StandardOption) => item.id && item.code)
          .sort((a: StandardOption, b: StandardOption) =>
            a.code.localeCompare(b.code)
          );

        if (!cancelled) {
          setStandards(list);
        }
      } catch (error) {
        console.error("Standards load failed:", error);

        if (!cancelled) {
          setStandards([]);
          setNotice({
            type: "error",
            message: "Standards could not be loaded.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingStandards(false);
        }
      }
    }

    loadStandards();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ==========================================================
     STANDARD SELECTION
     ========================================================== */

  useEffect(() => {
    if (!selectedStandard) {
      setMode("control");
      return;
    }

    const normalized = String(selectedStandard.type ?? "").toUpperCase();

    setMode(
      normalized === "MATURITY_BASED"
        ? "maturity"
        : "control"
    );
  }, [selectedStandard]);

    /* ==========================================================
     LOAD COLUMN CONFIGURATION
     ========================================================== */

  async function loadColumnConfig(
    targetStandardId: number,
    targetMode: Mode
  ) {
    try {
      const response = await apiFetch(
        `/matrix/columns?standard_id=${targetStandardId}&mode=${targetMode}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Column configuration could not be loaded."
        );
      }

      const configured = Array.isArray(data) ? data : [];

      const defaultsByKey = new Map(
        DEFAULT_COLUMNS.map((column) => [column.key, column])
      );

      const normalized: ColumnMap[] = configured.map(
        (column: any, index: number) => {
          const fallback = defaultsByKey.get(column.key);

          return {
            key: column.key,
            label:
              column.label ??
              fallback?.label ??
              humanizeColumnKey(column.key),
            visible:
              typeof column.visible === "boolean"
                ? column.visible
                : true,
            sourceType:
              fallback?.sourceType ??
              inferSourceType(column.key),
            entity:
              fallback?.entity ??
              inferEntityFromKey(column.key, targetMode),
            field:
              fallback?.field ??
              column.key,
            fixedValue:
              fallback?.fixedValue,
            position:
              typeof column.position === "number"
                ? column.position
                : index + 1,
          };
        }
      );

      if (normalized.length > 0) {
        setColumns(
          normalized.sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0)
          )
        );
      } else {
        setColumns(DEFAULT_COLUMNS);
      }
    } catch (error) {
      console.error("Column configuration load failed:", error);
      setColumns(DEFAULT_COLUMNS);
    }
  }
  /* ==========================================================
     LOAD SAVED COLUMN CONFIGURATION
     ========================================================== */

  useEffect(() => {
    if (!standardId) {
      return;
    }

    const targetMode: Mode =
      String(selectedStandard?.type ?? "").toUpperCase() ===
      "MATURITY_BASED"
        ? "maturity"
        : "control";

    loadColumnConfig(Number(standardId), targetMode);
  }, [standardId, selectedStandard]);
/* ==========================================================
     LOAD MATRIX PREVIEW
     ========================================================== */

  async function loadPreview() {
    if (!standardId) {
      setNotice({
        type: "info",
        message: "Select a standard before loading the matrix.",
      });
      return;
    }

    setLoadingPreview(true);
    setNotice(null);

    try {
      const response = await apiFetch(
        `/matrix/?standard_id=${standardId}`
      );

      const data = await response.json();

      const resolvedRows = Array.isArray(data)
        ? data
        : Array.isArray(data?.rows)
          ? data.rows
          : [];

      const resolvedMode: Mode =
        data?.mode === "maturity"
          ? "maturity"
          : "control";

      setMode(resolvedMode);
      setRows(resolvedRows);

      const first = resolvedRows[0] ?? {};
      const keys = Object.keys(first);

      setColumns((previous) => {
        const existing = new Map(
          previous.map((column) => [column.key, column])
        );

        const defaultByKey = new Map(
          DEFAULT_COLUMNS.map((column) => [column.key, column])
        );

        const next: ColumnMap[] = [];

        for (const key of keys) {
          const existingColumn = existing.get(key);
          const defaultColumn = defaultByKey.get(key);

          if (existingColumn) {
            next.push(existingColumn);
            continue;
          }

          next.push({
            key,
            label:
              defaultColumn?.label ??
              humanizeColumnKey(key),
            visible:
              defaultColumn?.visible ?? true,
            sourceType:
              defaultColumn?.sourceType ??
              inferSourceType(key),
            entity:
              defaultColumn?.entity ??
              inferEntityFromKey(key, resolvedMode),
            field:
              defaultColumn?.field ??
              key,
            fixedValue:
              defaultColumn?.fixedValue,
            position:
              defaultColumn?.position ??
              next.length + 1,
          });
        }

        for (const old of previous) {
          if (!keys.includes(old.key)) {
            next.push({
              ...old,
              visible: false,
            });
          }
        }

        if (next.length === 0 && resolvedMode === "control") {
          return DEFAULT_COLUMNS;
        }

        return next.sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
      });
      setNotice({
        type: "success",
        message: `${resolvedRows.length.toLocaleString()} matrix rows loaded.`,
      });
    } catch (error) {
      console.error("Matrix preview failed:", error);

      setRows([]);
      setColumns([]);

      setNotice({
        type: "error",
        message: "Matrix preview could not be loaded.",
      });
    } finally {
      setLoadingPreview(false);
    }
  }

  /* ==========================================================
     COLUMN OPERATIONS
     ========================================================== */

  function moveColumn(index: number, direction: -1 | 1) {
    setColumns((previous) => {
      const next = [...previous];
      const target = index + direction;

      if (
        index < 0 ||
        target < 0 ||
        target >= next.length
      ) {
        return previous;
      }

      [next[index], next[target]] = [
        next[target],
        next[index],
      ];

      return next;
    });
  }

  function updateColumn(
    key: string,
    patch: Partial<ColumnMap>
  ) {
    setColumns((previous) =>
      previous.map((column) =>
        column.key === key
          ? { ...column, ...patch }
          : column
      )
    );
  }

  /* ==========================================================
     GENERATE
     ========================================================== */

  async function onGenerate() {
    if (!standardId) {
      setNotice({
        type: "info",
        message: "Select a standard first.",
      });
      return;
    }

    if (!rows.length) {
      setNotice({
        type: "error",
        message: "Load a matrix preview before generating.",
      });
      return;
    }

    if (!visibleColumns.length) {
      setNotice({
        type: "error",
        message: "At least one column must be visible.",
      });
      return;
    }

    if (onlyPreview) {
      setModal({
        title: "Dry-run completed",
        description:
          "No database write was performed.",
        tone: "info",
        lines: [
          `Standard: ${selectedStandard?.code ?? "-"}`,
          `Mode: ${mode}`,
          `Rows evaluated: ${rows.length}`,
          `Visible columns: ${visibleColumns.length}`,
          `Deduplication: ${dedupStrategy}`,
        ],
      });
      return;
    }

    setGenerating(true);
    setNotice(null);

    try {
      const payload = {
        standard_id: standardId,
        mode,
        dedup_strategy: dedupStrategy,
        columns: columns.map((column) => ({
          key: column.key,
          label: column.label,
          visible: column.visible,
          sourceType: column.sourceType,
          entity: column.entity,
          field: column.field,
          fixedValue: column.fixedValue,
          position: column.position,
        })),
        rows,
      };
      const response = await apiFetch(
        "/matrix/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Matrix generation failed."
        );
      }

      setModal({
        title: "Matrix generated",
        description:
          "The matrix instance was created successfully.",
        tone: "success",
        lines: [
          `Instance ID: ${result.matrix_instance_id ?? "-"}`,
          `Status: ${result.matrix_instance_status ?? result.status ?? "-"}`,
          `Standard: ${selectedStandard?.code ?? "-"}`,
          `Created: ${result.created ?? 0}`,
          `Skipped: ${result.skipped ?? 0}`,
          `Overwritten: ${result.overwritten ?? 0}`,
        ],
      });

      setNotice({
        type: "success",
        message: "Matrix instance generated successfully.",
      });
    } catch (error) {
      console.error("Matrix generation failed:", error);

      setModal({
        title: "Generation failed",
        description:
          "The matrix instance could not be generated.",
        tone: "error",
        lines: [
          error instanceof Error
            ? error.message
            : "Unknown generation error.",
        ],
      });

      setNotice({
        type: "error",
        message: "Matrix generation failed.",
      });
    } finally {
      setGenerating(false);
    }
  }

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="min-h-full bg-[#f5f7fa] text-slate-900">
      <div className="mx-auto max-w-[1800px] space-y-5 p-5 xl:p-7">

        {/* ====================================================
            ENTERPRISE HEADER
        ==================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Layers3 className="h-5 w-5 text-cyan-300" />
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                      Governance Configuration
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      MATRIX
                    </span>
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight">
                    Matrix Builder
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Configure, validate and generate a controlled
                    matrix instance from the canonical compliance model.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/matrix"
                  className="inline-flex items-center gap-2 rounded-lg min-w-0 border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Matrix
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-200 lg:grid-cols-4">
            <Metric
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Standard"
              value={selectedStandard?.code ?? "Not selected"}
              detail={
                selectedStandard?.title ??
                "Select a compliance standard"
              }
            />

            <Metric
              icon={<Layers3 className="h-4 w-4" />}
              label="Assessment model"
              value={
                mode === "maturity"
                  ? "Maturity"
                  : "Control"
              }
              detail={
                mode === "maturity"
                  ? "Practice / process-area matrix"
                  : "Clause / requirement / control matrix"
              }
            />

            <Metric
              icon={<Table2 className="h-4 w-4" />}
              label="Source rows"
              value={rows.length.toLocaleString()}
              detail="Canonical matrix preview"
            />

            <Metric
              icon={<SlidersHorizontal className="h-4 w-4" />}
              label="Visible columns"
              value={`${visibleColumns.length} / ${columns.length}`}
              detail="Current projection"
            />
          </div>
        </section>

        {/* ====================================================
            NOTICE
        ==================================================== */}

        {notice && (
          <NoticeBar
            type={notice.type}
            message={notice.message}
            onClose={() => setNotice(null)}
          />
        )}

        {/* ====================================================
            CONFIGURATION
        ==================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Matrix configuration
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Define the source standard and generation behavior.
              </p>
            </div>

            <ReadinessBadge
              ready={readiness.ready}
              passed={readiness.passed}
              total={readiness.total}
            />
          </div>

          <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">

            {/* STANDARD */}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Standard
              </label>

              <div className="relative">
                <select
                  value={standardId}
                  disabled={loadingStandards || loadingPreview || generating}
                  onChange={(event) => {
                    const value = event.target.value
                      ? Number(event.target.value)
                      : "";

                    setStandardId(value);
                    setRows([]);
                    setColumns([]);
                    setNotice(null);
                  }}
                  className="w-full min-w-0 max-w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50"
                >
                  <option value="">
                    {loadingStandards
                      ? "Loading standards..."
                      : "Select a standard"}
                  </option>

                  {standards.map((standard) => (
                    <option
                      key={standard.id}
                      value={standard.id}
                    >
                      {standard.code}
                      {standard.title
                        ? ` â€” ${standard.title}`
                        : ""}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusChip
                  label={
                    selectedStandard
                      ? selectedStandard.code
                      : "Standard pending"
                  }
                  positive={Boolean(selectedStandard)}
                />

                <StatusChip
                  label={
                    mode === "maturity"
                      ? "MATURITY_BASED"
                      : "CONTROL_BASED"
                  }
                  positive={Boolean(selectedStandard)}
                />
              </div>
            </div>

            {/* EXECUTION */}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Execution
              </label>

              <div className="grid grid-cols-2 gap-3">
                <ExecutionCard
                  title="Dry-run"
                  description="Preview only"
                  active={onlyPreview}
                  icon={<Eye className="h-4 w-4" />}
                  onClick={() => setOnlyPreview(true)}
                />

                <ExecutionCard
                  title="Persist"
                  description="Write instance"
                  active={!onlyPreview}
                  icon={<Database className="h-4 w-4" />}
                  onClick={() => setOnlyPreview(false)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="h-4 w-4" />

              {onlyPreview
                ? "Dry-run is enabled. No database write will occur."
                : "Generate & Save will create a new matrix instance."}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex items-center gap-2 rounded-lg min-w-0 border border-slate-300 bg-white px-3 py-2">
                <span className="text-xs font-medium text-slate-500">
                  Deduplication
                </span>

                <select
                  value={dedupStrategy}
                  disabled={loadingPreview || generating}
                  onChange={(event) =>
                    setDedupStrategy(
                      event.target.value as
                        | "skip"
                        | "overwrite"
                    )
                  }
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="skip">
                    Skip duplicates
                  </option>
                  <option value="overwrite">
                    Overwrite
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={loadPreview}
                disabled={
                  !standardId ||
                  loadingPreview ||
                  generating
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg min-w-0 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                {loadingPreview
                  ? "Loading..."
                  : "Preview / Refresh"}
              </button>

              <button
                type="button"
                onClick={onGenerate}
                disabled={
                  !readiness.ready ||
                  generating ||
                  loadingPreview
                }
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  onlyPreview
                    ? "bg-slate-800 hover:bg-slate-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : onlyPreview ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}

                {generating
                  ? "Generating..."
                  : onlyPreview
                    ? "Run Dry-run"
                    : "Generate & Save"}
              </button>
            </div>
          </div>
        </section>

        {/* ====================================================
            WORKSPACE
        ==================================================== */}

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">

          {/* ==================================================
              COLUMN MAPPING
          ================================================== */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold">
                      Column mapping
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Control the projection shown in the matrix.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {visibleColumns.length}/{columns.length}
                </span>
              </div>
            </div>

            <div className="max-h-[720px] overflow-y-auto p-4">
              {columns.length === 0 ? (
                <EmptyState
                  icon={<Table2 className="h-5 w-5" />}
                  title="No columns mapped"
                  description="Load a matrix preview to discover its columns."
                />
              ) : (
                <div className="space-y-2">
                  {columns.map((column, index) => (
                    <ColumnMappingCard
                      key={column.key}
                      column={column}
                      index={index}
                      total={columns.length}
                      onMove={moveColumn}
                      onUpdate={updateColumn}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ==================================================
              PREVIEW
          ================================================== */}

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold">
                    Matrix preview
                  </h2>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Canonical source data Â· first 50 rows
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg min-w-0 border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {previewRows.length.toLocaleString()} visible
                </span>

                <span className="rounded-lg min-w-0 border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {rows.length.toLocaleString()} total
                </span>
              </div>
            </div>

            {loadingPreview ? (
              <PreviewSkeleton />
            ) : previewRows.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="Preview is empty"
                description="Select a standard and run Preview / Refresh."
                action={
                  standardId
                    ? {
                        label: "Load preview",
                        onClick: loadPreview,
                      }
                    : undefined
                }
              />
            ) : visibleColumns.length === 0 ? (
              <EmptyState
                icon={<EyeOff className="h-5 w-5" />}
                title="All columns are hidden"
                description="Enable at least one column in Column mapping."
              />
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full min-w-0 max-w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="w-12 border-b border-slate-200 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        #
                      </th>

                      {visibleColumns.map((column) => (
                        <th
                          key={column.key}
                          className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-400">
                          {rowIndex + 1}
                        </td>

                        {visibleColumns.map((column) => (
                          <td
                            key={column.key}
                            className="max-w-[340px] border-b border-slate-100 px-4 py-3 text-sm text-slate-700"
                          >
                            <CellValue
                              value={row[column.key]}
                              column={column}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Preview is read-only. Generation controls persistence.
              </span>

              <span className="font-medium text-slate-600">
                {selectedStandard?.code ?? "No standard"} Â·{" "}
                {mode === "maturity"
                  ? "Maturity"
                  : "Control"}
              </span>
            </div>
          </section>
        </div>

        {/* ====================================================
            READINESS
        ==================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <CheckCircle2 className="h-4 w-4 text-slate-500" />
            <div>
              <h2 className="text-sm font-semibold">
                Generation readiness
              </h2>
              <p className="text-xs text-slate-500">
                Pre-flight validation before matrix generation.
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <ReadinessItem
              label="Standard resolved"
              passed={readiness.checks.standard}
              detail={
                selectedStandard?.code ??
                "Select a standard"
              }
            />

            <ReadinessItem
              label="Source rows loaded"
              passed={readiness.checks.rows}
              detail={`${rows.length.toLocaleString()} rows`}
            />

            <ReadinessItem
              label="Columns discovered"
              passed={readiness.checks.columns}
              detail={`${columns.length} columns`}
            />

            <ReadinessItem
              label="Projection available"
              passed={readiness.checks.visible}
              detail={`${visibleColumns.length} visible`}
            />
          </div>
        </section>
      </div>

      {/* ======================================================
          MODAL
      ====================================================== */}

      {modal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal(null);
            }
          }}
        >
          <div className="w-full min-w-0 max-w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    modal.tone === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : modal.tone === "error"
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {modal.tone === "success" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : modal.tone === "error" ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Info className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {modal.title}
                  </h3>

                  {modal.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {modal.description}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg min-w-0 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 px-6 py-5">
              {modal.lines.map((line, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg min-w-0 border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="text-slate-600">
                    {line.includes(":")
                      ? line.split(":")[0]
                      : line}
                  </span>

                  {line.includes(":") && (
                    <span className="ml-4 text-right font-semibold text-slate-900">
                      {line.substring(
                        line.indexOf(":") + 1
                      ).trim()}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg min-w-0 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   COMPONENTS
   ============================================================ */

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>

      <div className="truncate text-sm font-semibold text-slate-900">
        {value}
      </div>

      <div className="mt-1 truncate text-[11px] text-slate-400">
        {detail}
      </div>
    </div>
  );
}

function ReadinessBadge({
  ready,
  passed,
  total,
}: {
  ready: boolean;
  passed: number;
  total: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        ready
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {ready ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}

      {ready
        ? "Ready to generate"
        : `${passed}/${total} checks passed`}
    </span>
  );
}

function StatusChip({
  label,
  positive,
}: {
  label: string;
  positive: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        positive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {positive && <Check className="h-3 w-3" />}
      {label}
    </span>
  );
}

function ExecutionCard({
  title,
  description,
  active,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            active
              ? "bg-white/10 text-white"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {icon}
        </div>

        <div>
          <div className="text-xs font-semibold">
            {title}
          </div>

          <div
            className={`text-[10px] ${
              active
                ? "text-slate-400"
                : "text-slate-400"
            }`}
          >
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

function ColumnMappingCard({
  column,
  index,
  total,
  onMove,
  onUpdate,
}: {
  column: ColumnMap;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onUpdate: (
    key: string,
    patch: Partial<ColumnMap>
  ) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        column.visible
          ? "border-slate-200 bg-white"
          : "border-slate-200 bg-slate-50 opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className="rounded-md border border-slate-200 p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move column up"
          >
            <ArrowUp className="h-3 w-3" />
          </button>

          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            className="rounded-md border border-slate-200 p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move column down"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">
                {column.label}
              </div>

              <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
                {column.key}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdate(column.key, {
                  visible: !column.visible,
                })
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold ${
                column.visible
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              {column.visible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}

              {column.visible ? "Visible" : "Hidden"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Label
              </label>

              <input
                value={column.label}
                onChange={(event) =>
                  onUpdate(column.key, {
                    label: event.target.value,
                  })
                }
                className="w-full min-w-0 max-w-full rounded-lg min-w-0 border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Source
              </label>

              <div className="rounded-lg min-w-0 border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-medium text-slate-600">
                {column.entity}.{column.field}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadinessItem({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        passed
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            passed
              ? "bg-emerald-100 text-emerald-600"
              : "bg-slate-200 text-slate-400"
          }`}
        >
          {passed ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">
            {label}
          </div>

          <div className="mt-1 truncate text-[11px] text-slate-500">
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function CellValue({
  value,
  column,
}: {
  value: any;
  column: ColumnMap;
}) {
  if (value === null || value === undefined || value === "") {
    return (
      <span className="text-slate-300">
        â€”
      </span>
    );
  }

  if (column.key === "coverage_status") {
    return (
      <CoverageBadge value={String(value)} />
    );
  }

  if (column.key === "risk_level") {
    return (
      <RiskBadge value={String(value)} />
    );
  }

  if (typeof value === "object") {
    return (
      <span
        className="block truncate font-mono text-xs"
        title={JSON.stringify(value)}
      >
        {JSON.stringify(value)}
      </span>
    );
  }

  return (
    <span
      className="block truncate"
      title={String(value)}
    >
      {String(value)}
    </span>
  );
}

function CoverageBadge({
  value,
}: {
  value: string;
}) {
  const normalized = value.toUpperCase();

  const positive = normalized === "COVERED";
  const warning =
    normalized === "UNDER_REMEDIATION" ||
    normalized === "PREDICTED_GAP";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${
        positive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : warning
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function RiskBadge({
  value,
}: {
  value: string;
}) {
  const normalized = value.toUpperCase();

  const critical = normalized === "CRITICAL";
  const high = normalized === "HIGH";
  const medium = normalized === "MEDIUM";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${
        critical
          ? "border-red-200 bg-red-50 text-red-700"
          : high
            ? "border-orange-200 bg-orange-50 text-orange-700"
            : medium
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {value}
    </span>
  );
}

function NoticeBar({
  type,
  message,
  onClose,
}: {
  type: Notice["type"];
  message: string;
  onClose: () => void;
}) {
  const config =
    type === "success"
      ? {
          icon: <CheckCircle2 className="h-4 w-4" />,
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : type === "error"
        ? {
            icon: <XCircle className="h-4 w-4" />,
            className:
              "border-red-200 bg-red-50 text-red-700",
          }
        : {
            icon: <Info className="h-4 w-4" />,
            className:
              "border-slate-200 bg-white text-slate-600",
          };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${config.className}`}
    >
      <div className="flex items-center gap-2">
        {config.icon}
        <span>{message}</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </div>

      <h3 className="text-sm font-semibold text-slate-800">
        {title}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
        {description}
      </p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-lg min-w-0 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {action.label}
        </button>
      )}
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <div className="h-10 animate-pulse rounded-lg min-w-0 bg-slate-100" />

      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-5 gap-3"
        >
          {Array.from({ length: 5 }).map(
            (_, cellIndex) => (
              <div
                key={cellIndex}
                className="h-8 animate-pulse rounded-lg min-w-0 bg-slate-100"
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

function humanizeColumnKey(key: string) {
  const labels: Record<string, string> = {
    clause_code: "Clause Code",
    clause_description: "Clause Definition",
    requirement_code: "Requirement Code",
    requirement_description: "Requirement Definition",
    control_code: "Control Code",
    control_description: "Control Definition",
    risk_level: "Risk Level",
    coverage_status: "Coverage",
  };

  return (
    labels[key] ??
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      )
  );
}

function inferSourceType(
  key: string
): ColumnMap["sourceType"] {
  const normalized = key.toLowerCase();

  if (
    normalized.includes("coverage") ||
    normalized.includes("risk") ||
    normalized.includes("count")
  ) {
    return "derived";
  }

  return "entity_field";
}

function inferEntityFromKey(
  key: string,
  mode: Mode
) {
  const normalized = key.toLowerCase();

  if (normalized.includes("standard")) {
    return "Standard";
  }

  if (mode === "maturity") {
    if (normalized.includes("process_area")) {
      return "StandardProcessArea";
    }

    if (normalized.includes("practice")) {
      return "StandardPractice";
    }

    if (
      normalized.includes("capability") ||
      normalized.includes("level")
    ) {
      return "CapabilityLevel";
    }

    if (normalized.includes("evidence")) {
      return "Evidence";
    }

    return "Maturity";
  }

  if (normalized.includes("clause")) {
    return "Clause";
  }

  if (normalized.includes("requirement")) {
    return "Requirement";
  }

  if (normalized.includes("control")) {
    return "Control";
  }

  if (normalized.includes("risk")) {
    return "Risk";
  }

  if (normalized.includes("evidence")) {
    return "Evidence";
  }

  return "Control";
}

function getColumnLabel(key: string): string {
  const labels: Record<string, string> = {
    standard_code: "Standard",

    clause_code: "Clause",
    clause_title: "Clause Title",
    clause_description: "Clause Description",

    requirement_code: "Requirement",
    requirement_title: "Requirement Title",
    requirement_description: "Requirement Description",

    control_code: "Control",
    control_title: "Control Title",
    control_description: "Control Description",

    evidence_count: "Evidence Count",
    approved_evidence_count: "Approved Evidence Count",
    coverage_status: "Coverage Status",
    risk_level: "Risk Level",

    process_area_code: "Process Area",
    process_area_title: "Process Area Title",
    practice_code: "Practice",
    practice_title: "Practice Title",
    practice_description: "Practice Description",
    target_level: "Target Level",
    achieved_level: "Achieved Level",
  };

  return labels[key] || key;
}
