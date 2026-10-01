"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileText,
  Loader2,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type PA11ProcessOutcome = {
  id: number;
  code: string;
  text: string;
  localized_text?: string | null;
  sort_order: number;
};

export type PA11BasePractice = {
  id: number;
  code: string;
  text: string;
  localized_title?: string | null;
  localized_description?: string | null;
  sort_order: number;
};

export type PA11WorkProduct = {
  link_id: number;
  id: number;
  code: string;
  name: string;
  localized_title?: string | null;
  localized_description?: string | null;
  direction: string;
  sort_order: number;
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

type WorkProductEvidenceState = {
  loading: boolean;
  error: string;
  items: EvidenceItem[];
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

function normalizeStatus(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "waiting_approval":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function PA11AssessmentEvidence({
  assessmentId,
  assessmentProcessId,
  outcomes,
  basePractices,
  workProducts,
}: {
  assessmentId: number;
  assessmentProcessId: number;
  outcomes: PA11ProcessOutcome[];
  basePractices: PA11BasePractice[];
  workProducts: PA11WorkProduct[];
}) {
  const [evidenceByProduct, setEvidenceByProduct] = useState<
    Record<number, WorkProductEvidenceState>
  >({});

  const [expandedProductId, setExpandedProductId] =
    useState<number | null>(null);

  const loadEvidence = useCallback(async () => {
    const token = getToken();

    if (!token) {
      const next: Record<number, WorkProductEvidenceState> = {};

      for (const product of workProducts) {
        next[product.id] = {
          loading: false,
          error: "Authentication token is unavailable.",
          items: [],
        };
      }

      setEvidenceByProduct(next);
      return;
    }

    const initial: Record<number, WorkProductEvidenceState> = {};

    for (const product of workProducts) {
      initial[product.id] = {
        loading: true,
        error: "",
        items: [],
      };
    }

    setEvidenceByProduct(initial);

    const results = await Promise.all(
      workProducts.map(async (product) => {
        const evidenceUrl =
          `${API_BASE}/pam/assessments/${assessmentId}` +
          `/processes/${assessmentProcessId}` +
          `/work-products/${product.id}/evidences`;

        try {
          const response = await fetch(evidenceUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(await readError(response));
          }

          const data = await response.json();

          return {
            productId: product.id,
            state: {
              loading: false,
              error: "",
              items: Array.isArray(data) ? data : [],
            } satisfies WorkProductEvidenceState,
          };
        } catch (err) {
          return {
            productId: product.id,
            state: {
              loading: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Unable to load evidence.",
              items: [],
            } satisfies WorkProductEvidenceState,
          };
        }
      })
    );

    const next: Record<number, WorkProductEvidenceState> = {};

    for (const result of results) {
      next[result.productId] = result.state;
    }

    setEvidenceByProduct(next);
  }, [assessmentId, assessmentProcessId, workProducts]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const sortedOutcomes = useMemo(
    () =>
      outcomes
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [outcomes]
  );

  const sortedPractices = useMemo(
    () =>
      basePractices
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [basePractices]
  );

  const sortedProducts = useMemo(
    () =>
      workProducts
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [workProducts]
  );

  const supportedProducts = workProducts.filter(
    (product) =>
      (evidenceByProduct[product.id]?.items.length || 0) > 0
  ).length;

  const totalEvidenceLinks = workProducts.reduce(
    (total, product) =>
      total +
      (evidenceByProduct[product.id]?.items.length || 0),
    0
  );

  const loadingCount = workProducts.filter(
    (product) => evidenceByProduct[product.id]?.loading
  ).length;

  const errorCount = workProducts.filter(
    (product) => evidenceByProduct[product.id]?.error
  ).length;

  const unsupportedProducts =
    workProducts.length - supportedProducts;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Assessment Evidence
            </div>

            <div className="mt-1 text-base font-semibold text-slate-950">
              Process Performance Evidence
            </div>

            <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Canonical process outcomes, base practices, work products,
              and linked evidence supporting PA 1.1 process performance
              assessment.
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Outcomes"
              value={sortedOutcomes.length}
            />
            <Metric
              label="Base Practices"
              value={sortedPractices.length}
            />
            <Metric
              label="Work Products"
              value={sortedProducts.length}
            />
            <Metric
              label="Evidence Links"
              value={totalEvidenceLinks}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-3">
        <SummaryCard
          label="Supported Work Products"
          value={supportedProducts}
          detail={`${sortedProducts.length} defined`}
        />

        <SummaryCard
          label="Unsupported Work Products"
          value={unsupportedProducts}
          detail="No linked evidence"
        />

        <SummaryCard
          label="Evidence Retrieval"
          value={
            loadingCount > 0
              ? "Loading"
              : errorCount > 0
                ? "Attention"
                : "Complete"
          }
          detail={
            errorCount > 0
              ? `${errorCount} request errors`
              : `${totalEvidenceLinks} evidence links loaded`
          }
        />
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">
              Process Outcomes
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {sortedOutcomes.length > 0 ? (
              sortedOutcomes.map((outcome) => (
                <div key={outcome.id} className="px-4 py-3">
                  <div className="text-xs font-semibold text-indigo-600">
                    {outcome.code}
                  </div>

                  <div className="mt-1 text-sm leading-6 text-slate-600">
                    {outcome.localized_text || outcome.text}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No process outcomes are defined." />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">
              Base Practices
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {sortedPractices.length > 0 ? (
              sortedPractices.map((practice) => (
                <div key={practice.id} className="px-4 py-3">
                  <div className="text-xs font-semibold text-indigo-600">
                    {practice.code}
                  </div>

                  <div className="mt-1 text-sm leading-6 text-slate-600">
                    {practice.localized_title || practice.text}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No base practices are defined." />
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-slate-200">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Work Product Evidence
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Read-only assessment projection of canonical work product
              evidence links.
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500">
            {supportedProducts} of {sortedProducts.length} supported
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {sortedProducts.length > 0 ? (
            sortedProducts.map((product) => {
              const state = evidenceByProduct[product.id];
              const evidenceItems = state?.items || [];
              const expanded =
                expandedProductId === product.id;

              return (
                <div key={product.link_id || product.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProductId(
                        expanded ? null : product.id
                      )
                    }
                    className="grid w-full grid-cols-[28px_90px_minmax(220px,1fr)_110px_120px] items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <div className="text-slate-400">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="text-xs font-semibold text-indigo-600">
                      {product.code}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {product.localized_title || product.name}
                      </div>
                    </div>

                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {product.direction}
                    </div>

                    <div>
                      {state?.loading ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading
                        </span>
                      ) : state?.error ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Error
                        </span>
                      ) : evidenceItems.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {evidenceItems.length} linked
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          0 linked
                        </span>
                      )}
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-slate-100 bg-slate-50 px-10 py-4">
                      {state?.loading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading evidence...
                        </div>
                      ) : state?.error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {state.error}
                        </div>
                      ) : evidenceItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                          No evidence linked to this work product.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {evidenceItems.map((evidence) => (
                            <div
                              key={evidence.evidence_id}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-400" />

                                <div className="text-sm font-semibold text-slate-900">
                                  {evidence.title}
                                </div>

                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(
                                    evidence.status
                                  )}`}
                                >
                                  {normalizeStatus(evidence.status)}
                                </span>
                              </div>

                              {evidence.description ? (
                                <div className="mt-2 text-xs leading-5 text-slate-500">
                                  {evidence.description}
                                </div>
                              ) : null}

                              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                <div>
                                  <span className="font-semibold text-slate-700">
                                    Relevance:
                                  </span>{" "}
                                  {evidence.relevance || "Not set"}
                                </div>

                                <div>
                                  <span className="font-semibold text-slate-700">
                                    Note:
                                  </span>{" "}
                                  {evidence.note || "Not set"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState text="No work products are defined." />
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />

          <div className="text-xs leading-5 text-slate-500">
            Evidence coverage is an assessment input. It does not
            automatically determine the PA 1.1 capability rating.
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[110px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {detail}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-5 text-sm text-slate-400">
      {text}
    </div>
  );
}

