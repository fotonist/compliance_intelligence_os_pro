"use client";

import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  CircleStackIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

interface AIResult {
  summary: string[];
  root_causes: string[];
  warnings: string[];
  actions: string[];
  provider?: string;
  model?: string | null;
  status?: string;
  usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_tokens?: number | null;
  } | null;
  error?: string | null;
}

interface Props {
  workspace: any;
  aiResult?: AIResult | null;
  aiLoading?: boolean;
  aiError?: string | null;
  aiStage?: "idle" | "connecting" | "analyzing" | "generating";
}

function Metric({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: string | number;
  description?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const valueClass = {
    default: "text-slate-950",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  }[tone];

  return (
    <div className="bg-white px-5 py-5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>

      <div className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </div>

      {description && (
        <div className="mt-1 text-[10px] text-slate-500">
          {description}
        </div>
      )}
    </div>
  );
}

function Signal({
  number,
  title,
  description,
  tone,
}: {
  number: string;
  title: string;
  description: string;
  tone: "neutral" | "warning" | "danger" | "success";
}) {
  const dot = {
    neutral: "bg-slate-400",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    success: "bg-emerald-500",
  }[tone];

  return (
    <div className="flex gap-4 border-b border-slate-100 py-4 last:border-b-0">

      <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
        {number}
      </div>

      <div className="min-w-0 flex-1">

        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />

          <h4 className="text-xs font-semibold text-slate-800">
            {title}
          </h4>
        </div>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>

      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white">

      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">

        <div className="flex h-8 w-8 items-center justify-center border border-slate-200 bg-slate-50">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>

        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {eyebrow}
          </div>

          <h3 className="text-sm font-semibold text-slate-900">
            {title}
          </h3>
        </div>

      </div>

      <div className="p-5">
        {children}
      </div>

    </section>
  );
}

export default function WorkspaceAISummary({
  workspace,
  aiResult = null,
  aiLoading = false,
  aiError = null,
  aiStage = "idle",
}: Props) {
  if (!workspace) return null;

  const coverage = Number(
    workspace.coverage?.coverage_percentage ?? 0
  );

  const evidence = Array.isArray(workspace.evidences)
    ? workspace.evidences
    : [];

  const risks = Array.isArray(workspace.risks)
    ? workspace.risks
    : [];

  const tasks = Array.isArray(workspace.tasks)
    ? workspace.tasks
    : [];

  const approvedEvidence = Number(
    workspace.coverage?.approved ?? 0
  );

  const evidenceAssurance =
    evidence.length > 0
      ? Math.round(
          (approvedEvidence / evidence.length) * 100
        )
      : 0;

  const criticalRisks = risks.filter(
    (risk: any) =>
      String(
        risk.risk_level ?? risk.severity ?? ""
      )
        .toUpperCase()
        .includes("CRITICAL")
  ).length;

  const highRisks = risks.filter(
    (risk: any) =>
      String(
        risk.risk_level ?? risk.severity ?? ""
      )
        .toUpperCase()
        .includes("HIGH")
  ).length;

  const openTasks = tasks.filter(
    (task: any) =>
      String(task.status ?? "").toUpperCase() === "OPEN"
  ).length;

  const overdueTasks = tasks.filter(
    (task: any) =>
      String(task.status ?? "").toUpperCase() === "OVERDUE"
  ).length;

  const aiEngine =
    workspace.ai_engine ?? null;

  const signals: {
    title: string;
    description: string;
    tone: "neutral" | "warning" | "danger" | "success";
  }[] = [];

  if (coverage < 100) {
    signals.push({
      title: "Implementation gap identified",
      description:
        `Current implementation coverage is ${coverage}%. Remaining gaps should be reviewed against the applicable control requirements.`,
      tone: coverage < 50 ? "danger" : "warning",
    });
  } else {
    signals.push({
      title: "Implementation coverage established",
      description:
        "The current control reports complete implementation coverage.",
      tone: "success",
    });
  }

  if (evidence.length === 0) {
    signals.push({
      title: "Evidence assurance gap",
      description:
        "No supporting evidence is currently linked to this compliance object.",
      tone: "danger",
    });
  } else if (evidenceAssurance < 70) {
    signals.push({
      title: "Evidence assurance requires attention",
      description:
        `${approvedEvidence} of ${evidence.length} evidence records are currently approved.`,
      tone: "warning",
    });
  } else {
    signals.push({
      title: "Evidence assurance established",
      description:
        `${approvedEvidence} of ${evidence.length} evidence records are approved.`,
      tone: "success",
    });
  }

  if (criticalRisks > 0) {
    signals.push({
      title: "Critical risk exposure",
      description:
        `${criticalRisks} critical risk${criticalRisks === 1 ? "" : "s"} require immediate management review.`,
      tone: "danger",
    });
  } else if (highRisks > 0) {
    signals.push({
      title: "High-risk exposure",
      description:
        `${highRisks} high-risk item${highRisks === 1 ? "" : "s"} remain associated with this compliance object.`,
      tone: "warning",
    });
  } else {
    signals.push({
      title: "No elevated risk exposure",
      description:
        "No critical or high risk records are currently reported.",
      tone: "success",
    });
  }

  if (overdueTasks > 0) {
    signals.push({
      title: "Overdue remediation",
      description:
        `${overdueTasks} remediation action${overdueTasks === 1 ? "" : "s"} are currently overdue.`,
      tone: "danger",
    });
  } else if (openTasks > 0) {
    signals.push({
      title: "Open remediation actions",
      description:
        `${openTasks} remediation action${openTasks === 1 ? "" : "s"} remain open.`,
      tone: "warning",
    });
  }

  const recommendations: string[] = [];

  if (coverage < 100) {
    recommendations.push(
      "Review the implementation gap and identify the controls or activities required to close it."
    );
  }

  if (
    evidence.length === 0 ||
    evidenceAssurance < 70
  ) {
    recommendations.push(
      "Collect, validate and approve objective supporting evidence."
    );
  }

  if (
    criticalRisks > 0 ||
    highRisks > 0
  ) {
    recommendations.push(
      "Review risk ownership, treatment actions and residual exposure."
    );
  }

  if (
    openTasks > 0 ||
    overdueTasks > 0
  ) {
    recommendations.push(
      "Prioritize outstanding remediation activities and confirm accountable ownership."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue periodic monitoring and reassess the compliance object following material changes."
    );
  }

  return (
    <div className="space-y-5">

      {aiLoading && (
        <section className="border border-slate-200 bg-white">
          <div className="flex items-center gap-4 px-5 py-6">
            <div className="flex h-9 w-9 items-center justify-center border border-slate-200 bg-slate-50">
              <SparklesIcon className="h-4 w-4 animate-pulse text-slate-600" />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-800">
                {aiStage === "connecting"
                  ? "Connecting to OpenAI"
                  : aiStage === "analyzing"
                    ? "Analyzing compliance context"
                    : "Generating AI insight"}
              </div>

              <div className="mt-1 text-[10px] text-slate-500">
                {aiStage === "connecting"
                  ? "Establishing the external AI analysis request."
                  : aiStage === "analyzing"
                    ? "Interpreting platform-calculated compliance, evidence, risk and remediation data."
                    : "Preparing executive compliance observations."}
              </div>
            </div>
          </div>
        </section>
      )}

      {aiError && (
        <section className="border border-amber-200 bg-amber-50">
          <div className="flex gap-3 px-5 py-4">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

            <div>
              <div className="text-xs font-semibold text-amber-800">
                AI Insight unavailable
              </div>

              <p className="mt-1 text-[10px] leading-5 text-amber-700">
                {aiError}
              </p>

              <p className="mt-2 text-[10px] leading-5 text-amber-700">
                Platform intelligence remains available through
                the Rule Engine and UEE.
              </p>
            </div>
          </div>
        </section>
      )}

      {aiResult && !aiLoading && (
        <section className="border border-slate-200 bg-white">

          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-4">

              <div>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-slate-500" />

                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    External AI Interpretation
                  </span>
                </div>

                <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                  AI Insight
                </h3>
              </div>

              <div className="flex flex-col items-end gap-1.5">

                <span className="inline-flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {aiResult.provider === "openai"
                    ? "OpenAI"
                    : "Platform Intelligence"}
                </span>

                {aiResult.model && (
                  <span className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
                    {aiResult.model}
                  </span>
                )}

              </div>

            </div>
          </div>

          <div className="space-y-5 p-5">

            {aiResult.usage && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-4 py-3">

                <div className="flex items-center gap-2">
                  <CpuChipIcon className="h-3.5 w-3.5 text-slate-500" />

                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Actual AI Usage
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[9px] uppercase tracking-[0.08em] text-slate-400">

                  {aiResult.usage.input_tokens != null && (
                    <span>
                      Input{" "}
                      <strong className="text-slate-600">
                        {aiResult.usage.input_tokens.toLocaleString()}
                      </strong>
                    </span>
                  )}

                  {aiResult.usage.output_tokens != null && (
                    <span>
                      Output{" "}
                      <strong className="text-slate-600">
                        {aiResult.usage.output_tokens.toLocaleString()}
                      </strong>
                    </span>
                  )}

                  {aiResult.usage.total_tokens != null && (
                    <span>
                      Total{" "}
                      <strong className="text-slate-800">
                        {aiResult.usage.total_tokens.toLocaleString()}
                      </strong>
                    </span>
                  )}

                </div>

              </div>
            )}

            {aiResult.summary && (
              <div className="border border-slate-200 bg-slate-50 p-5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                  Executive Assessment
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {aiResult.summary}
                </p>
              </div>
            )}

            {aiResult.root_causes.length > 0 && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                  Root Causes
                </div>

                <div className="mt-3 space-y-2">
                  {aiResult.root_causes.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600"
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {aiResult.warnings.length > 0 && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                  Warnings
                </div>

                <div className="mt-3 space-y-2">
                  {aiResult.warnings.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="flex gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"
                      >
                        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {aiResult.actions.length > 0 && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                  Recommended Actions
                </div>

                <div className="mt-3 space-y-2">
                  {aiResult.actions.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="flex gap-3 border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-[8px] font-semibold text-slate-500">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span>{item}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 text-[9px] uppercase tracking-[0.08em] text-slate-400">
              AI output is an interpretation of platform-calculated
              compliance intelligence. KPI values are not generated
              or altered by the AI provider.
            </div>

          </div>

        </section>
      )}

      {/* =========================================================
          INTELLIGENCE HEADER
         ========================================================= */}

      <section className="border border-slate-200 bg-white">

        <div className="flex flex-col gap-5 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <CpuChipIcon className="h-4 w-4 text-slate-500" />

              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Compliance Intelligence
              </span>

            </div>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              Control Intelligence
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Deterministic compliance analysis generated from the
              current evidence, risk and remediation state.
            </p>

          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">

            <span className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-600">
              <CircleStackIcon className="h-3.5 w-3.5" />
              Rule Engine / UEE
            </span>

            <span className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
              External AI not required
            </span>

          </div>

        </div>

        {/* =======================================================
            KPI STRIP
           ======================================================= */}

        <div className="grid grid-cols-2 gap-px bg-slate-200 xl:grid-cols-4">

          <Metric
            label="Control Health"
            value={`${coverage}%`}
            description="Implementation coverage"
            tone={
              coverage >= 80
                ? "success"
                : coverage >= 50
                  ? "warning"
                  : "danger"
            }
          />

          <Metric
            label="Evidence Assurance"
            value={`${evidenceAssurance}%`}
            description={`${approvedEvidence} approved / ${evidence.length} total`}
            tone={
              evidenceAssurance >= 80
                ? "success"
                : evidenceAssurance >= 50
                  ? "warning"
                  : "danger"
            }
          />

          <Metric
            label="Risk Exposure"
            value={criticalRisks + highRisks}
            description={`${criticalRisks} critical � ${highRisks} high`}
            tone={
              criticalRisks > 0
                ? "danger"
                : highRisks > 0
                  ? "warning"
                  : "success"
            }
          />

          <Metric
            label="Remediation"
            value={openTasks + overdueTasks}
            description={`${openTasks} open � ${overdueTasks} overdue`}
            tone={
              overdueTasks > 0
                ? "danger"
                : openTasks > 0
                  ? "warning"
                  : "success"
            }
          />

        </div>

      </section>

      {/* =========================================================
          SIGNALS + ACTIONS
         ========================================================= */}

      <div className="grid gap-5 xl:grid-cols-2">

        <Section
          eyebrow="Deterministic Analysis"
          title="Intelligence Signals"
          icon={ArrowTrendingUpIcon}
        >
          <div>
            {signals.map((signal, index) => (
              <Signal
                key={`${signal.title}-${index}`}
                number={String(index + 1).padStart(2, "0")}
                title={signal.title}
                description={signal.description}
                tone={signal.tone}
              />
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Decision Support"
          title="Recommended Actions"
          icon={WrenchScrewdriverIcon}
        >
          <div className="space-y-3">

            {recommendations.map(
              (recommendation, index) => (
                <div
                  key={index}
                  className="flex gap-3 border border-slate-200 bg-slate-50 p-3.5"
                >

                  <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-slate-200 bg-white text-[9px] font-semibold text-slate-500">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <p className="text-xs leading-5 text-slate-600">
                    {recommendation}
                  </p>

                </div>
              )
            )}

          </div>
        </Section>

      </div>

      {/* =========================================================
          OPTIONAL AI LAYER
         ========================================================= */}

      <Section
        eyebrow="Optional AI Layer"
        title="Executive Narrative"
        icon={SparklesIcon}
      >

        {aiResult && !aiLoading ? (

          <div className="space-y-4">

            {aiResult.summary.length > 0 && (
              <div className="border border-slate-200 bg-slate-50 p-5">

                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Executive Narrative
                </div>

                <div className="mt-3 space-y-2">
                  {aiResult.summary.map((item, index) => (
                    <p
                      key={index}
                      className="text-sm leading-6 text-slate-600"
                    >
                      {item}
                    </p>
                  ))}
                </div>

              </div>
            )}

            <div className="border-t border-slate-200 pt-3 text-[9px] uppercase tracking-[0.1em] text-slate-400">
              Provider: {aiResult.provider ?? "External AI"}
              {" � "}
              Model: {aiResult.model ?? "Unknown"}
              {" � "}
              Status: {aiResult.status ?? "completed"}
            </div>

          </div>

        ) : (

          <div className="border border-slate-200 bg-slate-50 p-5">

            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              External AI
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              No external AI narrative is currently available.
              Core compliance intelligence remains available through
              the Rule Engine and UEE without an external AI provider.
            </p>

          </div>

        )}
      </Section>

      {/* =========================================================
          PROVENANCE
         ========================================================= */}

      <section className="border border-slate-200 bg-white px-5 py-4">

        <div className="flex items-start gap-3">

          <CircleStackIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

          <div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
              Intelligence Provenance
            </div>

            <p className="mt-1 text-[10px] leading-5 text-slate-500">
              Deterministic findings are calculated from the
              compliance object and its available evidence,
              risk and remediation records. External AI is an
              enhancement layer and is not required for core
              intelligence functionality.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}
