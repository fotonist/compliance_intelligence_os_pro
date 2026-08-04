export interface WorkspaceStandard {
  id?: number;
  code?: string;
  title?: string;
  type?: string;
}

export interface WorkspaceClause {
  id?: number;
  code?: string;
  title?: string;
  description?: string;
}

export interface WorkspaceRequirement {
  id?: number;
  code?: string;
  title?: string;
}

export interface WorkspaceControl {
  id?: number;
  code?: string;
  title?: string;
  description?: string;
}

export interface WorkspaceCoverage {
  status?: string;
  percentage?: number;

  total_evidence?: number;
  approved_evidence?: number;
  pending_evidence?: number;
  rejected_evidence?: number;
}

export interface WorkspaceEvidence {
  id: number;

  title: string;

  description?: string;

  status?: string;

  approval_status?: string;

  assessment_type?: string;

  regulation?: string;

  source_url?: string;

  reviewed_by?: string;

  reviewed_at?: string;

  created_at?: string;

  updated_at?: string;

  file_count?: number;
}

export interface WorkspaceRisk {
  id: number;

  title: string;

  description?: string;

  impact?: number;

  likelihood?: number;

  score?: number;

  risk_level?: string;

  status?: string;

  treatment?: string;

  action?: string;

  coverage_status?: string;
}

export interface WorkspaceRiskSummary {

  total:number;

  critical:number;

  high:number;

  medium:number;

  low:number;

  total_score:number;

  average_score:number;

}

export interface WorkspaceTask {

  id:number;

  title:string;

  description?:string;

  status?:string;

  priority_score:number;

  owner_role:string;

  source_type?:string;

  source_id?:number;

  due_date?:string;

}

export interface WorkspaceTaskSummary{

  total:number;

  open:number;

  completed:number;

  overdue:number;

}

export interface WorkspaceTimeline{

  type:string;

  action:string;

  title:string;

  date:string;

}

export interface WorkspaceAnalytics{

  health_score:number;

  coverage_percentage:number;

  risk_score:number;

  evidence_count:number;

  approved_evidence:number;

  pending_evidence:number;

  rejected_evidence:number;

  risk_count:number;

  critical_risk_count:number;

  high_risk_count:number;

  medium_risk_count:number;

  low_risk_count:number;

  task_count:number;

  open_tasks:number;

  completed_tasks:number;

  overdue_tasks:number;

}

export interface ComplianceWorkspace{

  standard:WorkspaceStandard;

  clause:WorkspaceClause;

  requirement:WorkspaceRequirement;

  control:WorkspaceControl;

  coverage:WorkspaceCoverage;

  evidences:WorkspaceEvidence[];

  risks:WorkspaceRisk[];

  risk_summary:WorkspaceRiskSummary;

  tasks:WorkspaceTask[];

  task_summary:WorkspaceTaskSummary;

  analytics:WorkspaceAnalytics;

  timeline:WorkspaceTimeline[];

  ai_summary:string[];

}