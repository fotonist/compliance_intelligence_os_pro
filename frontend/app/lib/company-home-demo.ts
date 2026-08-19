type DemoResponse = {
  [key: string]: unknown;
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function buildRisks() {
  const levels = [
    ...Array(5).fill("CRITICAL"),
    ...Array(7).fill("HIGH"),
    ...Array(8).fill("MEDIUM"),
    ...Array(4).fill("LOW"),
  ];

  return levels.map((risk_level, index) => ({
    id: index + 1,
    title: [
      "Workplace injury risk",
      "Information leakage",
      "Change failure risk",
      "Weak project planning risk",
    ][index % 4],
    risk_level,
    status: "OPEN",
    score: risk_level === "CRITICAL" ? 20 : risk_level === "HIGH" ? 14 : risk_level === "MEDIUM" ? 8 : 3,
    created_at: "2026-08-01T09:00:00Z",
  }));
}

function buildEvidence() {
  const statuses = [
    ...Array(505).fill("approved"),
    ...Array(126).fill("pending"),
    ...Array(45).fill("rejected"),
    ...Array(66).fill("draft"),
  ];

  return statuses.map((status, index) => ({
    id: index + 1,
    title: `Compliance evidence ${index + 1}`,
    status,
    approval_status: status,
    created_at: "2026-08-01T09:00:00Z",
  }));
}

function buildControls() {
  return Array.from({ length: 386 }, (_, index) => ({
    id: index + 1,
    code: `CTRL-${String(index + 1).padStart(3, "0")}`,
    title: `Control ${index + 1}`,
  }));
}

function buildTasks() {
  return Array.from({ length: 132 }, (_, index) => ({
    id: index + 1,
    title: `Remediation action ${index + 1}`,
    status: index < 68 ? "COMPLETED" : index < 106 ? "IN_PROGRESS" : index < 122 ? "OVERDUE" : "NOT_STARTED",
    priority_score: index < 16 ? 90 : 55,
    due_date: index < 16 ? "2026-08-10" : "2026-09-15",
    created_at: "2026-08-01T09:00:00Z",
  }));
}

function buildMatrixRows(coveredCount: number) {
  return Array.from({ length: 100 }, (_, index) => ({
    id: index + 1,
    control_code: `CTRL-${String(index + 1).padStart(3, "0")}`,
    coverage_status: index < coveredCount ? "ACHIEVED" : "NOT_ACHIEVED",
    evidence_count: index < coveredCount ? 1 : 0,
  }));
}

export async function companyHomeDemoFetch(path: string): Promise<Response | null> {
  if (path === "/matrix/kpi") {
    return jsonResponse({
      unified_exposure_score: 18,
      compliance_health_index: 82,
      indices: {
        risk: 24,
        coverage: 78,
        maturity: 72,
        evidence: 68,
        task_pressure: 16,
      },
    });
  }

  if (path === "/company/intelligence/overview") {
    return jsonResponse({
      summary: {
        total_risks: 24,
        open_risks: 24,
        forecasted_risks: 11,
        high_probability_risks: 8,
        executive_alerts: 2,
        avg_escalation_probability: 0.679,
      },
      top_risks: [
        {
          risk_id: 1,
          title: "Workplace injury risk",
          current_score: 20,
          risk_level: "CRITICAL",
          status: "OPEN",
          escalation_probability_30d: 0.84,
          control_code: "CTRL-001",
        },
        {
          risk_id: 2,
          title: "Information leakage",
          current_score: 18,
          risk_level: "CRITICAL",
          status: "OPEN",
          escalation_probability_30d: 0.76,
          control_code: "CTRL-002",
        },
        {
          risk_id: 3,
          title: "Change failure risk",
          current_score: 8,
          risk_level: "MEDIUM",
          status: "OPEN",
          escalation_probability_30d: 0.84,
          control_code: "CTRL-003",
        },
        {
          risk_id: 4,
          title: "Weak project planning risk",
          current_score: 14,
          risk_level: "HIGH",
          status: "OPEN",
          escalation_probability_30d: 0.76,
          control_code: "CTRL-004",
        },
      ],
      top_controls: [
        { control_id: 1, control_code: "CTRL-001", control_title: "Control 1", ai_priority_score: 52.4 },
        { control_id: 2, control_code: "A.6.1.1", control_title: "Roles and Responsibilities", ai_priority_score: 32.2 },
        { control_id: 3, control_code: "CTRL-003", control_title: "Operational Procedures", ai_priority_score: 26.8 },
        { control_id: 4, control_code: "CTRL-004", control_title: "Access Control", ai_priority_score: 24.1 },
      ],
      executive_alerts: [
        {
          risk_id: 1,
          title: "Workplace injury risk",
          risk_level: "CRITICAL",
          escalation_probability_30d: 0.84,
          control_code: "CTRL-001",
        },
        {
          risk_id: 2,
          title: "Information leakage",
          risk_level: "CRITICAL",
          escalation_probability_30d: 0.76,
          control_code: "CTRL-002",
        },
      ],
    });
  }

  if (path === "/company/intelligence/gaps") {
    return jsonResponse({
      summary: {
        gaps_total: 31,
        uncovered: 12,
        partial: 19,
        worst_severity_score: 25,
      },
    });
  }

  if (path === "/company/intelligence/control-health") {
    return jsonResponse({
      open_tasks: 16,
      health_index: 82,
    });
  }

  if (path === "/standards/") {
    return jsonResponse([
      { id: 1, code: "ISO 27001:2022", title: "Information Security Management System", type: "CONTROL_BASED" },
      { id: 2, code: "ISO 9001:2015", title: "Quality Management System", type: "CONTROL_BASED" },
      { id: 3, code: "ISO 22301:2019", title: "Business Continuity Management System", type: "CONTROL_BASED" },
      { id: 4, code: "ISO 20000-1:2018", title: "Service Management System", type: "CONTROL_BASED" },
      { id: 5, code: "ISO 14001:2015", title: "Environmental Management System", type: "CONTROL_BASED" },
    ]);
  }

  const matrixMatch = path.match(/^\/matrix\?standard_id=(\d+)$/);
  if (matrixMatch) {
    const standardId = Number(matrixMatch[1]);
    const scores: Record<number, number> = {
      1: 78,
      2: 85,
      3: 72,
      4: 68,
      5: 80,
    };
    return jsonResponse({
      mode: "control",
      rows: buildMatrixRows(scores[standardId] ?? 0),
    });
  }

  if (path === "/controls/?skip=0&limit=1000") {
    return jsonResponse({ items: buildControls(), total: 386 });
  }

  if (path === "/evidences") {
    return jsonResponse({ items: buildEvidence(), total: 742 });
  }

  if (path === "/risks?page=1&page_size=100&status=all") {
    return jsonResponse({ items: buildRisks(), total: 24 });
  }

  if (path === "/company/tasks/my") {
    return jsonResponse({ tasks: buildTasks(), total: 132 });
  }

  if (path === "/dashboard/trends?days=180") {
    return jsonResponse({
      evidence_approvals_daily: [
        { date: "2026-03-01", count: 38 },
        { date: "2026-04-01", count: 44 },
        { date: "2026-05-01", count: 51 },
        { date: "2026-06-01", count: 49 },
        { date: "2026-07-01", count: 58 },
        { date: "2026-08-01", count: 63 },
      ],
      risk_exposure_trend: [
        { date: "2026-03-01", risk_exposure_pct: 12 },
        { date: "2026-04-01", risk_exposure_pct: 14 },
        { date: "2026-05-01", risk_exposure_pct: 18 },
        { date: "2026-06-01", risk_exposure_pct: 17 },
        { date: "2026-07-01", risk_exposure_pct: 21 },
        { date: "2026-08-01", risk_exposure_pct: 23 },
      ],
    });
  }

  return null;
}
