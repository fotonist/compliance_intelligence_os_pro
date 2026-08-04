export async function mockApiFetch(
  path: string
): Promise<Response | null> {


  if (path === "/auth/me") {

    return new Response(
      JSON.stringify({
        id: 1,
        username: "demo.admin",
        full_name: "Demo Administrator",
        email: "demo@complianceos.com",
        role: "Admin",
        tenant_id: 1,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  }



  if (path === "/standards") {

    return new Response(
      JSON.stringify([
        {
          id: 1,
          code: "ISO27001:2022",
          title: "Information Security Management System",
          type: "CONTROL_BASED",
        },
        {
          id: 2,
          code: "ISO9001:2015",
          title: "Quality Management System",
          type: "CONTROL_BASED",
        },
        {
          id: 3,
          code: "ISO22301:2019",
          title: "Business Continuity Management System",
          type: "CONTROL_BASED",
        },
      ]),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  }



  if (
    path === "/matrix" ||
    path.startsWith("/matrix?")
  ) {

    return new Response(
      JSON.stringify({
        mode: "control",

rows: [
  {
    id: 1,

    standard_id: 1,
    standard_code: "ISO27001:2022",

    clause_code: "A.5",
    clause_title: "Organizational Controls",

    requirement_code: "A.5.1",
    requirement_title: "Policies for Information Security",

    control_code: "CTRL-A5.1",

    coverage_status: "ACHIEVED",

    evidence_count: 5,
    approved_evidence_count: 5,

    risk_level: "LOW",
  },


  {
    id: 2,

    standard_id: 1,
    standard_code: "ISO27001:2022",

    clause_code: "A.8",
    clause_title: "Technological Controls",

    requirement_code: "A.8.11",
    requirement_title: "Data Masking",

    control_code: "CTRL-A8.11",

    coverage_status: "PARTIAL",

    evidence_count: 2,
    approved_evidence_count: 1,

    risk_level: "MEDIUM",
  },


  {
    id: 3,

    standard_id: 2,
    standard_code: "ISO9001:2015",

    clause_code: "8.5",
    clause_title: "Production and Service Provision",

    requirement_code: "8.5.1",
    requirement_title: "Controlled Production",

    control_code: "CTRL-8.5.1",

    coverage_status: "ACHIEVED",

    evidence_count: 4,
    approved_evidence_count: 4,

    risk_level: "LOW",
  }
],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  }



  if (
    path === "/kpi/summary" ||
    path.startsWith("/kpi/summary?")
  ) {

    return new Response(
      JSON.stringify({
        compliance_percentage: 87,

        evidence: {
          total: 245,
          completed: 218,
          in_progress: 20,
          not_completed: 7,
        },

        risk: {
          total: 42,
          critical: 3,
          high: 8,
          medium: 17,
          low: 14,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  }


if (path === "/company/intelligence/dashboard") {

  return new Response(
    JSON.stringify({
      tenant_id: 1,
      total_evidences: 245,
      orphan_evidences: 12,
      avg_quality_score: 86,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

}
if (path === "/company/intelligence/overview") {

  return new Response(
    JSON.stringify({

      summary: {
        total_risks: 42,
        forecasted_risks: 8,
        high_probability_risks: 5,
        executive_alerts: 3,
        avg_escalation_probability: 0.34,
        avg_expected_score_delta: 2.6,
      },


      top_controls: [
        {
          control_id: 101,
          control_code: "CTRL-A5.1",
          control_title: "Information Security Policies",
          risk_count: 4,
          avg_escalation_probability: 0.25,
          max_escalation_probability: 0.45,
          expected_score_delta_sum: 3.2,
          ai_priority_score: 87.5,
        },
        {
          control_id: 102,
          control_code: "CTRL-A8.11",
          control_title: "Data Masking",
          risk_count: 6,
          avg_escalation_probability: 0.52,
          max_escalation_probability: 0.72,
          expected_score_delta_sum: 5.1,
          ai_priority_score: 92.4,
        }
      ],


      top_risks: [
        {
          risk_id: 1,
          title: "Unauthorized Access Risk",
          current_score: 16,
          risk_level: "HIGH",
          status: "OPEN",
          escalation_probability_30d: 0.72,
          expected_score_delta: 4.5,
          control_code: "CTRL-A8.11",
        }
      ],

	 process_names:[
       "Information Security",
       "Access Management"
      ],
      executive_alerts: [
        {
          risk_id: 1,
          title: "Critical Access Control Gap",
          risk_level: "HIGH",
          escalation_probability_30d: 0.72,
          control_code: "CTRL-A8.11",
        }
      ]

    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

}
if (path === "/company/intelligence/escalation-distribution") {

  return new Response(
    JSON.stringify([
      {
        probability_bucket: "0-25%",
        risk_count: 18,
      },
      {
        probability_bucket: "25-50%",
        risk_count: 12,
      },
      {
        probability_bucket: "50-75%",
        risk_count: 8,
      },
      {
        probability_bucket: "75-100%",
        risk_count: 4,
      },
    ]),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

}



if (path === "/company/intelligence/exposure-coverage") {
	

  return new Response(
    JSON.stringify([
      {
        risk_bucket: 1,
        coverage_bucket: "0",
        risk_count: 3,
      },
      {
        risk_bucket: 2,
        coverage_bucket: "1-2",
        risk_count: 6,
      },
      {
        risk_bucket: 3,
        coverage_bucket: "3-5",
        risk_count: 4,
      },
      {
        risk_bucket: 4,
        coverage_bucket: "5+",
        risk_count: 2,
      },
    ]),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

}
if (
  path.startsWith("/company/intelligence/control/")
) {

  return new Response(
    JSON.stringify({

      summary: {
        linked_risk_count: 6,
        high_risk_count: 2,
        critical_risk_count: 1,
        avg_escalation_probability: 0.48,
      },

      trend: [
        {
          date: "2026-01",
          avg_score: 12,
        },
        {
          date: "2026-02",
          avg_score: 15,
        },
        {
          date: "2026-03",
          avg_score: 18,
        },
      ],

      top_risks: [],

    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

} 
if (path === "/analytics/control-health") {

  return new Response(
    JSON.stringify({

      summary: {
        total_controls: 156,
        avg_coverage: 84.5,
        avg_risk_score: 18.7,
        weak_controls: 12,
      },

      controls: [

        {
          tenant_id: 1,
          control_id: 101,
          control_code: "CTRL-A5.1",
          control_title: "Information Security Policies",
          linked_risk_count: 4,
          worst_risk_score: 16,
          avg_risk_score: 10.5,
          coverage_score: 92,
        },

        {
          tenant_id: 1,
          control_id: 102,
          control_code: "CTRL-A8.11",
          control_title: "Data Masking",
          linked_risk_count: 6,
          worst_risk_score: 22,
          avg_risk_score: 15.8,
          coverage_score: 61,
        },

        {
          tenant_id: 1,
          control_id: 103,
          control_code: "CTRL-8.5.1",
          control_title: "Production Control",
          linked_risk_count: 2,
          worst_risk_score: 8,
          avg_risk_score: 6.2,
          coverage_score: 88,
        }

      ]

    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

}
 return null;
}