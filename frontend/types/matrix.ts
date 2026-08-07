export interface ComplianceMatrix {
  standard_id: number;
  standard_code: string;

  clause_id: number;
  clause_code: string;
  clause_title: string;

  requirement_id: number;
  requirement_code: string;
  requirement_text: string;

  control_id: number | null;
  control_code: string | null;
  control_name: string | null;

  risk_count: number;
  evidence_count: number;

  coverage_status: string;
}

export default ComplianceMatrix;
