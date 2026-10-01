from datetime import date, datetime
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PamAssessmentCreate(BaseModel):
    framework_adoption_id: int
    name: str = Field(min_length=1, max_length=255)
    scope: Optional[str] = None
    assessor_user_id: Optional[int] = None
    sponsor_user_id: Optional[int] = None
    audit_plan_id: Optional[int] = None


class PamAssessmentProcessCreate(BaseModel):
    pam_process_id: int
    tenant_process_id: Optional[int] = None
    target_capability_level: Optional[int] = None


class PamAssessmentProcessTargetCapabilityUpdate(BaseModel):
    target_capability_level: Optional[int] = None


class PamAssessmentContextResponse(BaseModel):
    tenant_id: int
    framework_adoption_id: int
    standard_id: int
    standard_version_id: int
    standard_code: str
    standard_type: str
    version_code: str
    pam_framework_model_id: int
    pam_framework_model_code: str
    capability_framework_model_id: int
    capability_framework_model_code: str


class PamAssessmentResponse(BaseModel):
    id: int
    tenant_id: int
    framework_adoption_id: int
    framework_model_id: int
    name: str
    scope: Optional[str] = None
    status: str
    assessor_user_id: Optional[int] = None
    sponsor_user_id: Optional[int] = None
    audit_plan_id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    context: PamAssessmentContextResponse


class PamAssessmentProcessResponse(BaseModel):
    id: int
    assessment_id: int
    tenant_process_id: Optional[int] = None
    pam_process_id: int
    pam_process_code: str
    pam_process_name: str
    in_scope: bool
    target_capability_level: Optional[int] = None
    status: str
    created_at: Optional[str] = None

class PamProcessIdentityResponse(BaseModel):
    id: int
    code: str
    name: str
    purpose: str | None = None
    description: str | None = None


class PamProcessGroupResponse(BaseModel):
    id: int
    code: str
    name: str


class PamProcessCategoryResponse(BaseModel):
    id: int
    code: str
    name: str


class PamTenantProcessResponse(BaseModel):
    id: int
    code: str
    name: str


class PamAssessmentProcessDetailResponse(BaseModel):
    id: int
    assessment_id: int
    tenant_process_id: int | None = None
    pam_process_id: int
    in_scope: bool
    target_capability_level: int | None = None
    status: str
    created_at: datetime

    pam_process: PamProcessIdentityResponse
    process_group: PamProcessGroupResponse
    process_category: PamProcessCategoryResponse
    tenant_process: PamTenantProcessResponse | None = None

class PamProcessMappingResponse(BaseModel):
    mapping_id: int
    mapping_type: str
    confidence: float | None = None
    rationale: str | None = None
    tenant_process: PamTenantProcessResponse


class PamAvailableProcessResponse(BaseModel):
    pam_process: PamProcessIdentityResponse
    process_group: PamProcessGroupResponse
    process_category: PamProcessCategoryResponse
    is_added: bool
    tenant_mappings: list[PamProcessMappingResponse]

class PamCapabilityLevelResponse(BaseModel):
    id: int
    framework_model_id: int
    level: int
    code: str
    name: str
    description: str | None = None
    sort_order: int

class PamBasePracticeEvaluationUpdate(BaseModel):
    rating: str | None = None
    observation: str | None = None
    justification: str | None = None
    status: str = "not_assessed"


class PamBasePracticeEvaluationResponse(BaseModel):
    base_practice_id: int
    code: str
    text: str
    guidance: str | None = None
    sort_order: int
    evaluation_id: int | None = None
    rating: str | None = None
    observation: str | None = None
    justification: str | None = None
    status: str
    evaluator_user_id: int | None = None
    evaluated_at: datetime | None = None




class PamBasePracticeEvidenceLinkRequest(BaseModel):
    evidence_id: int
    relevance: Optional[str] = None
    note: Optional[str] = None


class PamBasePracticeEvidenceResponse(BaseModel):
    evidence_id: int
    title: str
    description: Optional[str] = None
    status: str
    assessment_type: str
    standard_id: int
    standard_version_id: int
    relevance: Optional[str] = None
    note: Optional[str] = None



class PamPerformanceObjectiveCreate(BaseModel):
    process_attribute_id: int
    standard_indicator_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    measurement_method: Optional[str] = None
    unit: Optional[str] = Field(default=None, max_length=50)
    target_value: Optional[float] = None
    direction: Optional[str] = None
    owner_user_id: Optional[int] = None
    status: str = Field(default="active", min_length=1, max_length=32)


class PamPerformanceObjectiveUpdate(BaseModel):
    standard_indicator_id: Optional[int] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    measurement_method: Optional[str] = None
    unit: Optional[str] = Field(default=None, max_length=50)
    target_value: Optional[float] = None
    direction: Optional[str] = None
    owner_user_id: Optional[int] = None
    status: Optional[str] = Field(default=None, min_length=1, max_length=32)


class PamPerformanceMeasurementCreate(BaseModel):
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    measured_value: float
    measurement_source: Optional[str] = Field(
        default=None,
        max_length=255,
    )
    evidence_id: Optional[int] = None
    note: Optional[str] = None

class PamAuditTargetCreate(BaseModel):
    assessment_process_id: int
    audit_plan_id: int
    process_attribute_id: int
    standard_indicator_id: Optional[int] = None
    auditor_id: Optional[int] = None


class PamAuditTargetExecutionUpdate(BaseModel):
    status: str
    result: Optional[str] = None
    observation: Optional[str] = None
    conclusion: Optional[str] = None


class PamAuditTargetAssignAuditor(BaseModel):
    auditor_id: int


class PamEligibleAuditorResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None


class PamAuditTargetRevisionResponse(BaseModel):
    id: int
    audit_maturity_target_id: int
    revision_no: int
    tenant_id: int
    pam_assessment_id: int
    assessment_process_id: int
    process_attribute_id: int
    standard_indicator_id: Optional[int] = None
    auditor_id: Optional[int] = None
    pa_evaluation_id: int
    rating: str
    rating_justification: Optional[str] = None
    observation: Optional[str] = None
    conclusion: Optional[str] = None
    result: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: datetime
    created_at: datetime


class PamAuditTargetResponse(BaseModel):
    id: int
    tenant_id: int
    audit_plan_id: int
    pam_assessment_id: int
    assessment_process_id: int
    process_attribute_id: int
    standard_indicator_id: Optional[int] = None
    status: str
    result: Optional[str] = None
    observation: Optional[str] = None
    conclusion: Optional[str] = None
    auditor_id: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    audit_plan_reference: Optional[str] = None
    audit_plan_name: Optional[str] = None
    process_code: Optional[str] = None
    process_name: Optional[str] = None
    process_attribute_code: Optional[str] = None
    process_attribute_name: Optional[str] = None
    indicator_code: Optional[str] = None
    indicator_name: Optional[str] = None





class PamFollowUpActionCreate(BaseModel):
    finding_id: int
    title: str
    description: str | None = None
    assigned_owner_id: int | None = None
    priority: str = "MEDIUM"
    due_date: date | None = None
    comment: str | None = None


class PamFollowUpAssignOwner(BaseModel):
    assigned_owner_id: int
    comment: str | None = None


class PamFollowUpComment(BaseModel):
    comment: str | None = None


class PamFollowUpSubmitVerification(BaseModel):
    completion_note: str
    comment: str | None = None


class PamFollowUpVerification(BaseModel):
    effective: bool
    comment: str


class PamFollowUpEvidenceLinkCreate(BaseModel):
    evidence_id: int
    note: str | None = None


class PamFollowUpActionResponse(BaseModel):
    id: int
    tenant_id: int
    finding_id: int
    action_code: str
    title: str
    description: str | None = None
    assigned_owner_id: int | None = None
    created_by: int | None = None
    verifier_id: int | None = None
    priority: str
    due_date: date | None = None
    status: str
    started_at: datetime | None = None
    submitted_for_verification_at: datetime | None = None
    verified_at: datetime | None = None
    completed_at: datetime | None = None
    completion_note: str | None = None
    verification_comment: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PamFollowUpEvidenceLinkResponse(BaseModel):
    id: int
    tenant_id: int
    follow_up_action_id: int
    evidence_id: int
    linked_by: int | None = None
    note: str | None = None
    created_at: datetime | None = None


class PamFollowUpWorkflowEventResponse(BaseModel):
    id: int
    tenant_id: int
    follow_up_action_id: int
    actor_id: int | None = None
    actor_role: str | None = None
    action: str
    from_status: str | None = None
    to_status: str | None = None
    comment: str | None = None
    created_at: datetime | None = None

class PamAuditFindingCreate(BaseModel):
    target_id: int
    title: str
    description: str
    severity: str = "MEDIUM"
    requirement: str | None = None
    objective_evidence: str | None = None
    assigned_owner_id: int | None = None
    process_manager_id: int | None = None
    due_date: date | None = None


class PamAuditFindingAssignOwner(BaseModel):
    assigned_owner_id: int
    process_manager_id: int | None = None
    comment: str | None = None
    manager_comment: str | None = None


class PamAuditFindingOwnerResponse(BaseModel):
    root_cause: str | None = None
    correction: str | None = None
    corrective_action_plan: str | None = None
    recommendation: str | None = None
    implementation_evidence: str | None = None
    due_date: date | None = None
    comment: str | None = None


class PamAuditFindingComment(BaseModel):
    comment: str | None = None


class PamAuditFindingRevision(BaseModel):
    comment: str


class PamAuditFindingImplementationComplete(
    BaseModel
):
    implementation_evidence: str
    comment: str | None = None


class PamAuditFindingVerification(BaseModel):
    effective: bool
    comment: str


class PamAuditFindingResponse(BaseModel):
    id: int
    tenant_id: int
    audit_plan_id: int
    audit_maturity_target_id: int
    created_by: int | None = None
    assigned_owner_id: int | None = None
    process_manager_id: int | None = None
    title: str
    description: str
    requirement: str | None = None
    objective_evidence: str | None = None
    severity: str
    status: str
    owner: str | None = None
    due_date: date | None = None
    root_cause: str | None = None
    correction: str | None = None
    corrective_action_plan: str | None = None
    recommendation: str | None = None
    owner_submitted_at: datetime | None = None
    owner_submitted_by: int | None = None
    manager_review_status: str
    manager_review_comment: str | None = None
    manager_reviewed_by: int | None = None
    manager_reviewed_at: datetime | None = None
    implementation_status: str
    implementation_completed_at: datetime | None = None
    implementation_evidence: str | None = None
    verification_status: str
    verification_comment: str | None = None
    verified_by: int | None = None
    verified_at: datetime | None = None
    closed_by: int | None = None
    closed_at: datetime | None = None
    closure_comment: str | None = None
    created_at: datetime
    updated_at: datetime


class PamAuditFindingWorkflowEventResponse(
    BaseModel
):
    id: int
    tenant_id: int
    finding_id: int
    actor_id: int | None = None
    actor_role: str | None = None
    action: str
    from_status: str | None = None
    to_status: str | None = None
    comment: str | None = None
    created_at: datetime
