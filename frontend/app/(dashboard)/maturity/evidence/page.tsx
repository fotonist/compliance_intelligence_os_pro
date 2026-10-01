"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileText,
  FolderSearch2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Assessment = {
  id: number;
  name?: string | null;
  code?: string | null;
  status?: string | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
};

type AssessmentProcess = {
  id: number;
  assessment_id: number;
  pam_process_id?: number | null;
  pam_process?: {
    id: number;
    code: string;
    name: string;
    purpose?: string | null;
    description?: string | null;
  } | null;
  pam_process_code?: string | null;
  pam_process_name?: string | null;
  process_code?: string | null;
  process_name?: string | null;
  target_capability_level?: number | null;
  status?: string | null;
};

type EvidenceItem = {
  evidence_id: number;
  title: string;
  description?: string | null;
  status: string;
  assessment_type: string;
  standard_id: number;
  standard_version_id: number;
  relevance?: string | null;
  note?: string | null;
};

type EvidenceCoverageProcess = {
  process: AssessmentProcess;
  base_practice_count: number;
  work_product_count: number;
  covered_base_practices: number;
  covered_work_products: number;
  evidence_links: number;
};

type EvidenceCoverageReference = EvidenceItem & {
  process_id: number;
  process_code: string;
  process_name: string;
  source_type: "Base Practice" | "Work Product";
  source_id: number;
  source_code: string;
  source_name: string;
};

type EvidenceCoverageResponse = {
  assessment_id: number;
  processes: EvidenceCoverageProcess[];
  evidence_references: EvidenceCoverageReference[];
};

type EvidenceReference = EvidenceItem & {
  processId: number;
  processCode: string;
  processName: string;
  sourceType: "Base Practice" | "Work Product";
  sourceId: number;
  sourceCode: string;
  sourceName: string;
};

type ProcessEvidenceRow = {
  process: AssessmentProcess;
  basePracticeCount: number;
  workProductCount: number;
  coveredBasePractices: number;
  coveredWorkProducts: number;
  evidenceLinks: number;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token") ||
    ""
  );
}

async function readError(response: Response) {
  const body = await response.text();

  if (!body) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(body);

    if (typeof parsed?.detail === "string") {
      return parsed.detail;
    }

    return body;
  } catch {
    return body;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<T>;
}

function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record = value as Record<string, unknown>;

    for (const key of [
      "items",
      "results",
      "data",
      "assessments",
      "processes",
    ]) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }

  return [];
}

function statusClass(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "waiting_approval":
    case "pending":
    case "submitted":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "uploaded":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function normalizeStatus(status?: string | null) {
  if (!status) {
    return "Unknown";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function processCode(process: AssessmentProcess) {
  return (
    process.pam_process?.code ||
    process.process_code ||
    process.pam_process_code ||
    `Process ${process.id}`
  );
}

function processName(process: AssessmentProcess) {
  return (
    process.pam_process?.name ||
    process.process_name ||
    process.pam_process_name ||
    "Unnamed process"
  );
}

export default function Page() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  const [rows, setRows] = useState<ProcessEvidenceRow[]>([]);
  const [references, setReferences] = useState<EvidenceReference[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (item) => item.id === assessmentId,
      ) || null,
    [assessments, assessmentId],
  );

  const loadAssessments = useCallback(async () => {
    const raw = await apiGet<unknown>("/pam/assessments");
    const items = normalizeList<Assessment>(raw);

    setAssessments(items);

    setAssessmentId((current) => {
      if (
        current &&
        items.some((item) => item.id === current)
      ) {
        return current;
      }

      return items[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError("");

        await loadAssessments();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load maturity assessments.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAssessments]);

  const loadEvidenceWorkspace = useCallback(async () => {
    if (!assessmentId) {
      setRows([]);
      setReferences([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const coverage = await apiGet<EvidenceCoverageResponse>(
        `/pam/assessments/${assessmentId}/evidence-coverage`,
      );

      const nextRows: ProcessEvidenceRow[] = (
        coverage.processes || []
      ).map((item) => ({
        process: item.process,
        basePracticeCount: item.base_practice_count,
        workProductCount: item.work_product_count,
        coveredBasePractices: item.covered_base_practices,
        coveredWorkProducts: item.covered_work_products,
        evidenceLinks: item.evidence_links,
      }));

      const nextReferences: EvidenceReference[] = (
        coverage.evidence_references || []
      ).map((item) => ({
        evidence_id: item.evidence_id,
        title: item.title,
        description: item.description,
        status: item.status,
        assessment_type: item.assessment_type,
        standard_id: item.standard_id,
        standard_version_id: item.standard_version_id,
        relevance: item.relevance,
        note: item.note,
        processId: item.process_id,
        processCode: item.process_code,
        processName: item.process_name,
        sourceType: item.source_type,
        sourceId: item.source_id,
        sourceCode: item.source_code,
        sourceName: item.source_name,
      }));

      setRows(nextRows);
      setReferences(nextReferences);
    } catch (err) {
      setRows([]);
      setReferences([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load maturity evidence.",
      );
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void loadEvidenceWorkspace();
  }, [loadEvidenceWorkspace]);

  const totalSources = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          row.basePracticeCount +
          row.workProductCount,
        0,
      ),
    [rows],
  );

  const coveredSources = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          row.coveredBasePractices +
          row.coveredWorkProducts,
        0,
      ),
    [rows],
  );

  const evidenceCoverage =
    totalSources > 0
      ? Math.round(
          (coveredSources / totalSources) * 100,
        )
      : 0;

  const uniqueEvidence = useMemo(
    () =>
      new Set(
        references.map(
          (item) => item.evidence_id,
        ),
      ).size,
    [references],
  );

  const approvedLinks = useMemo(
    () =>
      references.filter(
        (item) =>
          item.status.toLowerCase() === "approved",
      ).length,
    [references],
  );

  const filteredReferences = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return references;
    }

    return references.filter((item) =>
      [
        item.title,
        item.description,
        item.processCode,
        item.processName,
        item.sourceCode,
        item.sourceName,
        item.status,
        item.relevance,
        item.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [references, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Maturity Workspace
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Evidence Coverage
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Assessment-scoped evidence coverage across processes,
              base practices, and work products.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Assessment
              </span>

              <select
                value={assessmentId ?? ""}
                onChange={(event) =>
                  setAssessmentId(
                    Number(event.target.value),
                  )
                }
                className="min-w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
              >
                {assessments.map((assessment) => (
                  <option
                    key={assessment.id}
                    value={assessment.id}
                  >
                    {assessment.name ||
                      assessment.code ||
                      `Assessment ${assessment.id}`}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() =>
                void loadEvidenceWorkspace()
              }
              disabled={loading || !assessmentId}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          </div>
        </div>

        {selectedAssessment && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedAssessment.status && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                {normalizeStatus(
                  selectedAssessment.status,
                )}
              </span>
            )}

            {selectedAssessment.standard_id && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                Standard {selectedAssessment.standard_id}
              </span>
            )}

            {selectedAssessment.standard_version_id && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                Version {selectedAssessment.standard_version_id}
              </span>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Evidence Coverage"
          value={`${evidenceCoverage}%`}
          detail={`${coveredSources} of ${totalSources} evidence sources covered`}
          icon={<FileCheck2 className="h-4 w-4" />}
        />

        <KpiCard
          label="Unique Evidence"
          value={uniqueEvidence.toString()}
          detail={`${references.length} total evidence links`}
          icon={<FileText className="h-4 w-4" />}
        />

        <KpiCard
          label="Approved Links"
          value={approvedLinks.toString()}
          detail="Linked evidence currently approved"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />

        <KpiCard
          label="Processes"
          value={rows.length.toString()}
          detail={`${
            rows.filter(
              (row) => row.evidenceLinks > 0,
            ).length
          } with linked evidence`}
          icon={<FolderSearch2 className="h-4 w-4" />}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-950">
            Process Evidence Coverage
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Coverage of base practices and work products by
            assessment process.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">
                  Process
                </th>
                <th className="px-4 py-3">
                  Base Practices
                </th>
                <th className="px-4 py-3">
                  Work Products
                </th>
                <th className="px-4 py-3">
                  Evidence Links
                </th>
                <th className="px-4 py-3">
                  Coverage
                </th>
                <th className="px-5 py-3 text-right">
                  Detail
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const total =
                  row.basePracticeCount +
                  row.workProductCount;

                const covered =
                  row.coveredBasePractices +
                  row.coveredWorkProducts;

                const coverage =
                  total > 0
                    ? Math.round(
                        (covered / total) * 100,
                      )
                    : 0;

                return (
                  <tr
                    key={row.process.id}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {processCode(row.process)}
                      </div>

                      <div className="mt-0.5 text-xs text-slate-500">
                        {processName(row.process)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-medium text-slate-900">
                        {row.coveredBasePractices}
                      </span>
                      <span className="text-slate-400">
                        {" "}
                        / {row.basePracticeCount}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-medium text-slate-900">
                        {row.coveredWorkProducts}
                      </span>
                      <span className="text-slate-400">
                        {" "}
                        / {row.workProductCount}
                      </span>
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-900">
                      {row.evidenceLinks}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex min-w-32 items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{
                              width: `${coverage}%`,
                            }}
                          />
                        </div>

                        <span className="w-10 text-right text-xs font-medium text-slate-600">
                          {coverage}%
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      {assessmentId && (
                        <Link
                          href={`/maturity/workspace/${assessmentId}/process/${row.process.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Open -&gt;
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No assessment processes were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              Evidence Register
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Assessment evidence links with their process and
              source context.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search evidence..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 md:w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">
                  Evidence
                </th>
                <th className="px-4 py-3">
                  Process
                </th>
                <th className="px-4 py-3">
                  Source
                </th>
                <th className="px-4 py-3">
                  Relevance
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-5 py-3 text-right">
                  Detail
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredReferences.map(
                (item, index) => (
                  <tr
                    key={`${item.processId}-${item.sourceType}-${item.sourceId}-${item.evidence_id}-${index}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {item.title}
                      </div>

                      {item.description && (
                        <div className="mt-1 max-w-md text-xs text-slate-500">
                          {item.description}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800">
                        {item.processCode}
                      </div>

                      <div className="mt-0.5 text-xs text-slate-500">
                        {item.processName}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-xs font-semibold text-slate-700">
                        {item.sourceType}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {item.sourceCode} -{" "}
                        {item.sourceName}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-600">
                      {item.relevance || "-"}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${statusClass(
                          item.status,
                        )}`}
                      >
                        {normalizeStatus(
                          item.status,
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/maturity/workspace/${assessmentId}/process/${item.processId}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Open -&gt;
                      </Link>
                    </td>
                  </tr>
                ),
              )}

              {!loading &&
                filteredReferences.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No linked evidence was found for this assessment.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          Loading assessment evidence...
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
          {icon}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        {detail}
      </div>
    </div>
  );
}




