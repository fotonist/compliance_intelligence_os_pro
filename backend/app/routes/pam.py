from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.pam_runtime import PamProcess
from app.schemas.pam_assessment import (
    PamAssessmentContextResponse,
    PamAssessmentCreate,
    PamAssessmentProcessCreate,
    PamAssessmentProcessTargetCapabilityUpdate,
    PamAssessmentProcessResponse,
    PamAssessmentResponse,
    PamAssessmentProcessDetailResponse,
    PamAvailableProcessResponse,
    PamCapabilityLevelResponse,
    PamBasePracticeEvaluationUpdate,
    PamBasePracticeEvaluationResponse,
    PamBasePracticeEvidenceLinkRequest,
    PamBasePracticeEvidenceResponse,
    PamPerformanceMeasurementCreate,
    PamPerformanceObjectiveUpdate,
    PamPerformanceObjectiveCreate,
    PamAuditTargetCreate,
    PamAuditTargetExecutionUpdate,
    PamAuditTargetAssignAuditor,
    PamEligibleAuditorResponse,
    PamAuditTargetResponse,
    PamAuditTargetRevisionResponse,
    PamFollowUpActionCreate,
    PamFollowUpAssignOwner,
    PamFollowUpComment,
    PamFollowUpSubmitVerification,
    PamFollowUpVerification,
    PamFollowUpEvidenceLinkCreate,
    PamFollowUpActionResponse,
    PamFollowUpEvidenceLinkResponse,
    PamFollowUpWorkflowEventResponse,
    PamAuditFindingCreate,
    PamAuditFindingAssignOwner,
    PamAuditFindingOwnerResponse,
    PamAuditFindingComment,
    PamAuditFindingRevision,
    PamAuditFindingImplementationComplete,
    PamAuditFindingVerification,
    PamAuditFindingResponse,
    PamAuditFindingWorkflowEventResponse,
)
from app.services.maturity_context_resolver import MaturityContextError

from app.services.maturity_audit_service import (
    MaturityAuditConflictError,
    MaturityAuditError,
    MaturityAuditNotFoundError,
    MaturityAuditService,
)
from app.services.maturity_follow_up_action_service import (
    MaturityFollowUpActionConflictError,
    MaturityFollowUpActionError,
    MaturityFollowUpActionNotFoundError,
    MaturityFollowUpActionService,
)
from app.models.audit_maturity_follow_up_workflow_event import (
    AuditMaturityFollowUpWorkflowEvent,
)
from app.services.maturity_audit_finding_service import (
    MaturityAuditFindingConflictError,
    MaturityAuditFindingError,
    MaturityAuditFindingNotFoundError,
    MaturityAuditFindingService,
)
from app.models.audit_maturity_finding_workflow_event import (
    AuditMaturityFindingWorkflowEvent,
)
from app.services.pam_assessment_service import (
    PamAssessmentConflictError,
    PamAssessmentError,
    PamAssessmentNotFoundError,
    PamAssessmentService,
)

from app.services.risk_creation_service import RiskCreationService
from app.services.maturity_base_practice_identity_resolver import MaturityBasePracticeIdentityResolver


class PamProcessAttributeEvaluationUpdate(BaseModel):
    rating: str | None = None
    justification: str | None = None
    status: str



def _audit_target_payload(target):
    if isinstance(target, dict):
        return PamAuditTargetResponse(**target)

    return PamAuditTargetResponse(
        id=target.id,
        tenant_id=target.tenant_id,
        audit_plan_id=target.audit_plan_id,
        pam_assessment_id=target.pam_assessment_id,
        assessment_process_id=target.assessment_process_id,
        process_attribute_id=target.process_attribute_id,
        standard_indicator_id=target.standard_indicator_id,
        status=target.status,
        result=target.result,
        observation=target.observation,
        conclusion=target.conclusion,
        auditor_id=target.auditor_id,
        started_at=target.started_at,
        completed_at=target.completed_at,
        created_at=target.created_at,
        updated_at=target.updated_at,
    )

class PamBasePracticeRiskCreate(BaseModel):
    title: str
    description: str | None = None
    likelihood: int
    impact: int
    action: str | None = "assessment"


router = APIRouter(
    prefix="/pam",
    tags=["PAM Assessment"],
)


ROLE_ALIASES = {
    "superadmin": "superadmin", "super_admin": "superadmin",
    "internal_auditor": "internal_auditor", "internal_audit": "internal_auditor",
    "auditor": "internal_auditor", "process_manager": "process_manager",
    "processmanager": "process_manager", "process_owner": "process_manager",
    "compliance_manager": "process_manager", "admin": "admin",
}


def _roles(user: User) -> set[str]:
    result = set()
    for role in (user.roles or []):
        raw = str(role.name).strip().lower().replace("-", "_").replace(" ", "_")
        result.add(ROLE_ALIASES.get(raw, raw))
    return result

def _is_superadmin(user: User) -> bool:
    return "superadmin" in _roles(user)

def _has_role(user: User, *allowed: str) -> bool:
    return _is_superadmin(user) or bool(_roles(user).intersection(allowed))


def _tenant_id(user) -> int:
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    return tenant_id


def _context_payload(context):
    return PamAssessmentContextResponse(
        tenant_id=context.tenant_id,
        framework_adoption_id=context.framework_adoption_id,
        standard_id=context.standard_id,
        standard_version_id=context.standard_version_id,
        standard_code=context.standard_code,
        standard_type=context.standard_type,
        version_code=context.version_code,
        pam_framework_model_id=context.pam_framework_model_id,
        pam_framework_model_code=context.pam_framework_model_code,
        capability_framework_model_id=(
            context.capability_framework_model_id
        ),
        capability_framework_model_code=(
            context.capability_framework_model_code
        ),
    )


def _assessment_payload(
    db: Session,
    tenant_id: int,
    assessment,
):
    context = PamAssessmentService.resolve_assessment_context(
        db,
        tenant_id=tenant_id,
        assessment_id=assessment.id,
    )

    return PamAssessmentResponse(
        id=assessment.id,
        tenant_id=assessment.tenant_id,
        framework_adoption_id=assessment.framework_adoption_id,
        framework_model_id=assessment.framework_model_id,
        name=assessment.name,
        scope=assessment.scope,
        status=assessment.status,
        assessor_user_id=assessment.assessor_user_id,
        sponsor_user_id=assessment.sponsor_user_id,
        audit_plan_id=assessment.audit_plan_id,
        created_at=(
            assessment.created_at.isoformat()
            if assessment.created_at
            else None
        ),
        updated_at=(
            assessment.updated_at.isoformat()
            if assessment.updated_at
            else None
        ),
        context=_context_payload(context),
    )


def _raise_service_error(exc: Exception):
    if isinstance(exc, PamAssessmentNotFoundError):
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    if isinstance(exc, PamAssessmentConflictError):
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    if isinstance(exc, MaturityContextError):
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    if isinstance(exc, PamAssessmentError):
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    raise exc


@router.get(
    "/assessments",
    response_model=list[PamAssessmentResponse],
)
def list_assessments(
    framework_adoption_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        assessments = PamAssessmentService.list_assessments(
            db,
            tenant_id=tenant_id,
            framework_adoption_id=framework_adoption_id,
        )

        return [
            _assessment_payload(
                db,
                tenant_id,
                assessment,
            )
            for assessment in assessments
        ]

    except Exception as exc:
        _raise_service_error(exc)


@router.post(
    "/assessments",
    response_model=PamAssessmentResponse,
)
def create_assessment(
    payload: PamAssessmentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        assessment = PamAssessmentService.create_assessment(
            db,
            tenant_id=tenant_id,
            framework_adoption_id=payload.framework_adoption_id,
            name=payload.name,
            scope=payload.scope,
            assessor_user_id=payload.assessor_user_id,
            sponsor_user_id=payload.sponsor_user_id,
            audit_plan_id=payload.audit_plan_id,
            commit=True,
        )

        return _assessment_payload(
            db,
            tenant_id,
            assessment,
        )

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)


@router.get(
    "/assessments/{assessment_id}",
    response_model=PamAssessmentResponse,
)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        assessment = PamAssessmentService.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        return _assessment_payload(
            db,
            tenant_id,
            assessment,
        )

    except Exception as exc:
        _raise_service_error(exc)


@router.get(
    "/assessments/{assessment_id}/context",
    response_model=PamAssessmentContextResponse,
)
def get_assessment_context(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        assessment = PamAssessmentService.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = PamAssessmentService.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment.id,
        )

        return _context_payload(context)

    except Exception as exc:
        _raise_service_error(exc)


@router.post(
    "/assessments/{assessment_id}/processes",
    response_model=PamAssessmentProcessResponse,
)
def add_assessment_process(
    assessment_id: int,
    payload: PamAssessmentProcessCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        item = PamAssessmentService.add_process(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            pam_process_id=payload.pam_process_id,
            tenant_process_id=payload.tenant_process_id,
            target_capability_level=(
                payload.target_capability_level
            ),
            commit=True,
        )

        pam_process = (
            db.query(PamProcess)
            .filter(
                PamProcess.id == item.pam_process_id
            )
            .one()
        )

        return PamAssessmentProcessResponse(
            id=item.id,
            assessment_id=item.assessment_id,
            tenant_process_id=item.tenant_process_id,
            pam_process_id=item.pam_process_id,
            pam_process_code=pam_process.code,
            pam_process_name=pam_process.name,
            in_scope=item.in_scope,
            target_capability_level=(
                item.target_capability_level
            ),
            status=item.status,
            created_at=(
                item.created_at.isoformat()
                if item.created_at
                else None
            ),
        )

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)


@router.patch(
    "/assessments/{assessment_id}/processes/"
    "{assessment_process_id}/target-capability",
    response_model=PamAssessmentProcessResponse,
)
def update_assessment_process_target_capability(
    assessment_id: int,
    assessment_process_id: int,
    payload: PamAssessmentProcessTargetCapabilityUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        item = (
            PamAssessmentService.update_process_target_capability(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                assessment_process_id=assessment_process_id,
                target_capability_level=(
                    payload.target_capability_level
                ),
                commit=True,
            )
        )

        pam_process = (
            db.query(PamProcess)
            .filter(
                PamProcess.id == item.pam_process_id
            )
            .one()
        )

        return PamAssessmentProcessResponse(
            id=item.id,
            assessment_id=item.assessment_id,
            tenant_process_id=item.tenant_process_id,
            pam_process_id=item.pam_process_id,
            pam_process_code=pam_process.code,
            pam_process_name=pam_process.name,
            in_scope=item.in_scope,
            target_capability_level=(
                item.target_capability_level
            ),
            status=item.status,
            created_at=(
                item.created_at.isoformat()
                if item.created_at
                else None
            ),
        )

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)


@router.get(
    "/assessments/{assessment_id}/processes",
    response_model=list[PamAssessmentProcessDetailResponse],
)
def list_assessment_processes(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        return PamAssessmentService.list_processes(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

@router.get(
    "/assessments/{assessment_id}/available-processes",
    response_model=list[PamAvailableProcessResponse],
)
def list_available_assessment_processes(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        return PamAssessmentService.list_available_processes(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

@router.get(
    "/assessments/{assessment_id}/capability-levels",
    response_model=list[PamCapabilityLevelResponse],
)
def list_assessment_capability_levels(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        return PamAssessmentService.list_capability_levels(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

@router.get(
    "/assessments/{assessment_id}/rating-options",
)
def list_assessment_rating_options(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        return PamAssessmentService.list_rating_options(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.get(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/workspace",
)
def get_assessment_process_workspace(
    assessment_id: int,
    assessment_process_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        return PamAssessmentService.get_process_workspace(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

@router.get(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/base-practice-evaluations",
    response_model=list[PamBasePracticeEvaluationResponse],
)
def list_base_practice_evaluations(
    assessment_id: int,
    assessment_process_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        return PamAssessmentService.list_base_practice_evaluations(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.put(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/base-practices/{base_practice_id}/evaluation",
)
def update_base_practice_evaluation(
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
    payload: PamBasePracticeEvaluationUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    try:
        evaluation = (
            PamAssessmentService.upsert_base_practice_evaluation(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                assessment_process_id=assessment_process_id,
                base_practice_id=base_practice_id,
                rating=payload.rating,
                observation=payload.observation,
                justification=payload.justification,
                status=payload.status,
                evaluator_user_id=getattr(
                    user,
                    "id",
                    None,
                ),
            )
        )

        return {
            "id": evaluation.id,
            "assessment_process_id":
                evaluation.assessment_process_id,
            "base_practice_id":
                evaluation.base_practice_id,
            "indicator_type":
                evaluation.indicator_type,
            "rating": evaluation.rating,
            "observation":
                evaluation.observation,
            "justification":
                evaluation.justification,
            "status": evaluation.status,
            "evaluator_user_id":
                evaluation.evaluator_user_id,
            "evaluated_at":
                evaluation.evaluated_at,
        }

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )




def _resolve_workspace_base_practice(
    db: Session,
    *,
    tenant_id: int,
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
):
    workspace = PamAssessmentService.get_process_workspace(
        db,
        tenant_id=tenant_id,
        assessment_id=assessment_id,
        assessment_process_id=assessment_process_id,
    )

    practice = next(
        (
            item
            for item in workspace["base_practices"]
            if int(item["id"]) == int(base_practice_id)
        ),
        None,
    )

    if practice is None:
        raise PamAssessmentConflictError(
            "Base practice does not belong to the "
            "assessment process."
        )

    identity = MaturityBasePracticeIdentityResolver.resolve(
        db,
        tenant_id=tenant_id,
        assessment_id=assessment_id,
        assessment_process_id=assessment_process_id,
        pam_base_practice_id=base_practice_id,
    )

    return {
        "standard_id": identity.standard_id,
        "standard_code": identity.standard_code,
        "standard_title": identity.standard_title,

        "standard_version_id":
            identity.standard_version_id,
        "standard_version_code":
            identity.standard_version_code,

        "adoption_id": identity.adoption_id,
        "framework_type": identity.framework_type,

        "pam_process_id": identity.pam_process_id,
        "pam_process_code": identity.pam_process_code,
        "pam_process_name": identity.pam_process_name,

        "pam_base_practice_id":
            identity.pam_base_practice_id,

        "base_practice_id":
            identity.standard_base_practice_id,
        "base_practice_code":
            identity.base_practice_code,
        "base_practice_title":
            identity.standard_base_practice_title,

        "reference_process_id":
            identity.reference_process_id,
        "reference_process_code":
            identity.reference_process_code,
        "reference_process_name":
            identity.reference_process_name,
    }


@router.get(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/base-practices/{base_practice_id}/risks",
)
def list_base_practice_risks(
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    context = _resolve_workspace_base_practice(
        db,
        tenant_id=tenant_id,
        assessment_id=assessment_id,
        assessment_process_id=assessment_process_id,
        base_practice_id=base_practice_id,
    )

    rows = db.execute(
        text(
            """
            WITH latest_versions AS (
                SELECT DISTINCT ON (rv.risk_id)
                    rv.id AS risk_version_id,
                    rv.risk_id,
                    rv.version_number
                FROM risk_versions rv
                WHERE rv.tenant_id = :tenant_id
                ORDER BY
                    rv.risk_id,
                    rv.version_number DESC,
                    rv.id DESC
            )
            SELECT
                r.id,
                lv.risk_version_id,
                lv.version_number,
                r.title,
                r.description,
                r.likelihood,
                r.impact,
                r.score,
                r.risk_level,
                r.status,
                r.action,
                r.treatment,
                r.created_at,
                r.updated_at
            FROM latest_versions lv
            JOIN risks r
              ON r.id = lv.risk_id
             AND r.tenant_id = :tenant_id
            JOIN pam_base_practice_risk_links link
              ON link.risk_version_id = lv.risk_version_id
             AND link.tenant_id = :tenant_id
             AND link.base_practice_id = :base_practice_id
            ORDER BY
                r.updated_at DESC NULLS LAST,
                r.id DESC
            """
        ),
        {
            "tenant_id": tenant_id,
            "base_practice_id": int(
                context["base_practice_id"]
            ),
        },
    ).mappings().all()

    return {
        "framework": {
            "standard_id": int(context["standard_id"]),
            "standard_code": context["standard_code"],
            "standard_version_id": int(
                context["standard_version_id"]
            ),
            "standard_version_code":
                context["standard_version_code"],
            "adoption_id": int(context["adoption_id"]),
            "framework_type": context["framework_type"],
        },
        "target": {
            "type": "BASE_PRACTICE",
            "base_practice_id": int(
                context["base_practice_id"]
            ),
            "base_practice_code":
                context["base_practice_code"],
            "base_practice_title":
                context["base_practice_title"],
            "reference_process_id": int(
                context["reference_process_id"]
            ),
            "reference_process_code":
                context["reference_process_code"],
            "reference_process_name":
                context["reference_process_name"],
        },
        "count": len(rows),
        "items": [dict(row) for row in rows],
    }


@router.post(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/base-practices/{base_practice_id}/risks",
    status_code=201,
)
def create_assessment_base_practice_risk(
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
    payload: PamBasePracticeRiskCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        context = _resolve_workspace_base_practice(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
        )

        result = RiskCreationService.create(
            db,
            tenant_id=tenant_id,
            title=payload.title,
            description=payload.description,
            likelihood=payload.likelihood,
            impact=payload.impact,
            action=payload.action,
            source_type="STANDARD",
            source_id=int(context["standard_id"]),
            process_id=None,
            base_practice_id=int(
                context["base_practice_id"]
            ),
        )

        db.commit()

        return {
            "id": result.risk_id,
            "risk_version_id": result.risk_version_id,
            "score": result.score,
            "risk_level": result.risk_level,
            "status": result.status,
            "framework": {
                "standard_id": int(
                    context["standard_id"]
                ),
                "standard_code":
                    context["standard_code"],
                "standard_version_id": int(
                    context["standard_version_id"]
                ),
                "standard_version_code":
                    context["standard_version_code"],
                "adoption_id": int(
                    context["adoption_id"]
                ),
                "framework_type":
                    context["framework_type"],
            },
            "target": {
                "type": "BASE_PRACTICE",
                "base_practice_id": int(
                    context["base_practice_id"]
                ),
                "base_practice_code":
                    context["base_practice_code"],
                "base_practice_title":
                    context["base_practice_title"],
                "reference_process_id": int(
                    context["reference_process_id"]
                ),
                "reference_process_code":
                    context["reference_process_code"],
                "reference_process_name":
                    context["reference_process_name"],
            },
        }

    except PamAssessmentNotFoundError as exc:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Base Practice risk creation failed",
        ) from exc


@router.get(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/base-practices/{base_practice_id}/evidences",
    response_model=list[PamBasePracticeEvidenceResponse],
)
def list_base_practice_evidences(
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return PamAssessmentService.list_base_practice_evidences(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.post(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/base-practices/{base_practice_id}/evidences",
    response_model=PamBasePracticeEvidenceResponse,
)
def link_base_practice_evidence(
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
    payload: PamBasePracticeEvidenceLinkRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return PamAssessmentService.link_base_practice_evidence(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
            evidence_id=payload.evidence_id,
            evaluator_user_id=user.id,
            relevance=payload.relevance,
            note=payload.note,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.delete(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/base-practices/{base_practice_id}"
    "/evidences/{evidence_id}",
)
def unlink_base_practice_evidence(
    assessment_id: int,
    assessment_process_id: int,
    base_practice_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        PamAssessmentService.unlink_base_practice_evidence(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
            evidence_id=evidence_id,
        )

        return {
            "success": True,
            "evidence_id": evidence_id,
        }
    except Exception as exc:
        _raise_service_error(exc)



@router.get(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/work-products/{work_product_id}/evidences",
    response_model=list[PamBasePracticeEvidenceResponse],
)
def list_work_product_evidences(
    assessment_id: int,
    assessment_process_id: int,
    work_product_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return PamAssessmentService.list_work_product_evidences(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            work_product_id=work_product_id,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.post(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/work-products/{work_product_id}/evidences",
    response_model=PamBasePracticeEvidenceResponse,
)
def link_work_product_evidence(
    assessment_id: int,
    assessment_process_id: int,
    work_product_id: int,
    payload: PamBasePracticeEvidenceLinkRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return PamAssessmentService.link_work_product_evidence(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            work_product_id=work_product_id,
            evidence_id=payload.evidence_id,
            evaluator_user_id=user.id,
            relevance=payload.relevance,
            note=payload.note,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.delete(
    "/assessments/{assessment_id}"
    "/processes/{assessment_process_id}"
    "/work-products/{work_product_id}"
    "/evidences/{evidence_id}",
)
def unlink_work_product_evidence(
    assessment_id: int,
    assessment_process_id: int,
    work_product_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        PamAssessmentService.unlink_work_product_evidence(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            work_product_id=work_product_id,
            evidence_id=evidence_id,
        )

        return {
            "success": True,
            "evidence_id": evidence_id,
        }
    except Exception as exc:
        _raise_service_error(exc)



@router.get(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/capability"
)
def get_process_capability(
    assessment_id: int,
    assessment_process_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        return PamAssessmentService.get_process_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.get(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/process-attribute-evaluations"
)
def list_process_attribute_evaluations(
    assessment_id: int,
    assessment_process_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        return PamAssessmentService.list_process_attribute_evaluations(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.put(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/process-attributes/{process_attribute_id}/evaluation"
)
def upsert_process_attribute_evaluation(
    assessment_id: int,
    assessment_process_id: int,
    process_attribute_id: int,
    payload: PamProcessAttributeEvaluationUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        result = PamAssessmentService.upsert_process_attribute_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            process_attribute_id=process_attribute_id,
            evaluator_user_id=user.id,
            rating=payload.rating,
            justification=payload.justification,
            status=payload.status,
        )

        db.commit()

        return result

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)



@router.get(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/performance-objectives"
)
def list_performance_objectives(
    assessment_id: int,
    assessment_process_id: int,
    process_attribute_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        return PamAssessmentService.list_performance_objectives(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            process_attribute_id=process_attribute_id,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.post(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/performance-objectives"
)
def create_performance_objective(
    assessment_id: int,
    assessment_process_id: int,
    payload: PamPerformanceObjectiveCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        result = PamAssessmentService.create_performance_objective(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            process_attribute_id=payload.process_attribute_id,
            standard_indicator_id=payload.standard_indicator_id,
            title=payload.title,
            description=payload.description,
            measurement_method=payload.measurement_method,
            unit=payload.unit,
            target_value=payload.target_value,
            direction=payload.direction,
            owner_user_id=payload.owner_user_id,
            status=payload.status,
            created_by=user.id,
            commit=False,
        )

        db.commit()
        return result

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)


@router.put(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/performance-objectives/{objective_id}"
)
def update_performance_objective(
    assessment_id: int,
    assessment_process_id: int,
    objective_id: int,
    payload: PamPerformanceObjectiveUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        update_data = payload.model_dump(
            exclude_unset=True
        )

        result = PamAssessmentService.update_performance_objective(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            objective_id=objective_id,
            payload=update_data,
            commit=False,
        )

        db.commit()
        return result

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)


@router.get(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/performance-objectives/{objective_id}/measurements"
)
def list_performance_measurements(
    assessment_id: int,
    assessment_process_id: int,
    objective_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        return PamAssessmentService.list_performance_measurements(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            objective_id=objective_id,
        )
    except Exception as exc:
        _raise_service_error(exc)


@router.post(
    "/assessments/{assessment_id}/processes/{assessment_process_id}/performance-objectives/{objective_id}/measurements"
)
def add_performance_measurement(
    assessment_id: int,
    assessment_process_id: int,
    objective_id: int,
    payload: PamPerformanceMeasurementCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        result = PamAssessmentService.add_performance_measurement(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            objective_id=objective_id,
            period_start=payload.period_start,
            period_end=payload.period_end,
            measured_value=payload.measured_value,
            measurement_source=payload.measurement_source,
            evidence_id=payload.evidence_id,
            measured_by=user.id,
            note=payload.note,
            commit=False,
        )

        db.commit()
        return result

    except Exception as exc:
        db.rollback()
        _raise_service_error(exc)

# ============================================================
# MATURITY AUDIT TARGETS
# ============================================================

@router.get(
    "/assessments/{assessment_id}/audit-targets",
    response_model=list[PamAuditTargetResponse],
)
def list_maturity_audit_targets(
    assessment_id: int,
    assessment_process_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        targets = MaturityAuditService.list_targets(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        return [
            _audit_target_payload(target)
            for target in targets
        ]

    except MaturityAuditNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/eligible-auditors",
    response_model=list[PamEligibleAuditorResponse],
)
def list_eligible_maturity_auditors(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    return MaturityAuditService.list_eligible_auditors(
        db,
        tenant_id=tenant_id,
    )


@router.post(
    "/assessments/{assessment_id}/audit-targets",
    response_model=PamAuditTargetResponse,
    status_code=201,
)
def create_maturity_audit_target(
    assessment_id: int,
    payload: PamAuditTargetCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        target = MaturityAuditService.create_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=(
                payload.assessment_process_id
            ),
            audit_plan_id=payload.audit_plan_id,
            process_attribute_id=(
                payload.process_attribute_id
            ),
            standard_indicator_id=(
                payload.standard_indicator_id
            ),
            auditor_id=payload.auditor_id,
            commit=True,
        )

        return _audit_target_payload(target)

    except MaturityAuditNotFoundError as exc:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

@router.post(
    "/assessments/{assessment_id}"
    "/audit-targets/{target_id}/assign-auditor",
    response_model=PamAuditTargetResponse,
)
def assign_maturity_audit_target_auditor(
    assessment_id: int,
    target_id: int,
    payload: PamAuditTargetAssignAuditor,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    roles = _roles(user)

    if not (
        "admin" in roles
        or "superadmin" in roles
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only an administrator can assign "
                "an audit target auditor."
            ),
        )

    tenant_id = _tenant_id(user)

    try:
        target = MaturityAuditService.assign_target_auditor(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
            auditor_id=payload.auditor_id,
            commit=True,
        )

        return _audit_target_payload(target)

    except MaturityAuditNotFoundError as exc:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/assessments/{assessment_id}"
    "/audit-targets/{target_id}/reopen",
)
def reopen_maturity_audit_target(
    assessment_id: int,
    target_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    # Audit authority must be explicit.
    # Do not use _has_role() here because its
    # superadmin bypass must not grant audit authority.
    if "internal_auditor" not in _roles(user):
        raise HTTPException(
            status_code=403,
            detail="Internal Auditor role is required.",
        )

    try:
        target = MaturityAuditService._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        if target.auditor_id is None:
            raise HTTPException(
                status_code=409,
                detail="Audit target has no assigned auditor.",
            )

        if target.auditor_id != user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned auditor can reopen "
                    "this audit target."
                ),
            )

        current_status = str(
            target.status or ""
        ).strip().upper()

        if current_status != "COMPLETED":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only a completed audit target "
                    "can be reopened."
                ),
            )

        updated = (
            MaturityAuditService.update_target_execution(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                target_id=target_id,
                status="IN_PROGRESS",
                result=target.result,
                observation=target.observation,
                conclusion=target.conclusion,
                commit=True,
            )
        )

        return {
            "id": updated.id,
            "status": updated.status,
            "auditor_id": updated.auditor_id,
            "started_at": updated.started_at,
            "completed_at": updated.completed_at,
            "updated_at": updated.updated_at,
        }

    except HTTPException:
        raise

    except MaturityAuditNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/assessments/{assessment_id}"
    "/audit-targets/{target_id}/revisions",
    response_model=list[PamAuditTargetRevisionResponse],
)
def list_maturity_audit_target_revisions(
    assessment_id: int,
    target_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        return MaturityAuditService.list_target_revisions(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

    except MaturityAuditNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/assessments/{assessment_id}"
    "/audit-targets/{target_id}/pa-evaluation",
)
def get_maturity_audit_target_pa_evaluation(
    assessment_id: int,
    target_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        return (
            MaturityAuditService
            .get_target_process_attribute_evaluation(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                target_id=target_id,
            )
        )

    except MaturityAuditNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.put(
    "/assessments/{assessment_id}"
    "/audit-targets/{target_id}/pa-evaluation",
)
def upsert_maturity_audit_target_pa_evaluation(
    assessment_id: int,
    target_id: int,
    payload: PamProcessAttributeEvaluationUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    if "internal_auditor" not in _roles(user):
        raise HTTPException(
            status_code=403,
            detail="Internal auditor role is required.",
        )

    try:
        target = MaturityAuditService._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        if target.auditor_id is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Audit target must have an assigned auditor "
                    "before a PA evaluation can be recorded."
                ),
            )

        if target.auditor_id != user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Audit target is not assigned to the "
                    "current auditor."
                ),
            )

        result = (
            MaturityAuditService
            .upsert_target_process_attribute_evaluation(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                target_id=target_id,
                evaluator_user_id=user.id,
                rating=payload.rating,
                justification=payload.justification,
                status=payload.status,
                commit=True,
            )
        )

        return result

    except HTTPException:
        db.rollback()
        raise

    except MaturityAuditNotFoundError as exc:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.put(
    "/assessments/{assessment_id}"
    "/audit-targets/{target_id}/execution",
    response_model=PamAuditTargetResponse,
)
def update_maturity_audit_target_execution(
    assessment_id: int,
    target_id: int,
    payload: PamAuditTargetExecutionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        target = MaturityAuditService._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        # Audit judgment authority is intentionally stricter than
        # administrative authority. SuperAdmin alone must not bypass it.
        if "internal_auditor" not in _roles(user):
            raise HTTPException(
                status_code=403,
                detail="Internal Auditor role is required.",
            )

        if target.auditor_id is None:
            raise HTTPException(
                status_code=409,
                detail="An auditor must be assigned before audit execution.",
            )

        if target.auditor_id != user.id:
            raise HTTPException(
                status_code=403,
                detail="Only the assigned auditor may update audit execution.",
            )

        target = MaturityAuditService.update_target_execution(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
            status=payload.status,
            result=payload.result,
            observation=payload.observation,
            conclusion=payload.conclusion,
            commit=True,
        )

        return _audit_target_payload(target)

    except MaturityAuditNotFoundError as exc:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except MaturityAuditConflictError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    except MaturityAuditError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc




def _audit_finding_payload(record):
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "audit_plan_id": record.audit_plan_id,
        "audit_maturity_target_id": (
            record.audit_maturity_target_id
        ),
        "created_by": record.created_by,
        "assigned_owner_id": record.assigned_owner_id,
        "process_manager_id": record.process_manager_id,
        "title": record.title,
        "description": record.description,
        "requirement": record.requirement,
        "objective_evidence": record.objective_evidence,
        "severity": record.severity,
        "status": record.status,
        "owner": record.owner,
        "due_date": record.due_date,
        "root_cause": record.root_cause,
        "correction": record.correction,
        "corrective_action_plan": (
            record.corrective_action_plan
        ),
        "recommendation": record.recommendation,
        "owner_submitted_at": record.owner_submitted_at,
        "owner_submitted_by": record.owner_submitted_by,
        "manager_review_status": (
            record.manager_review_status
        ),
        "manager_review_comment": (
            record.manager_review_comment
        ),
        "manager_reviewed_by": record.manager_reviewed_by,
        "manager_reviewed_at": record.manager_reviewed_at,
        "implementation_status": (
            record.implementation_status
        ),
        "implementation_completed_at": (
            record.implementation_completed_at
        ),
        "implementation_evidence": (
            record.implementation_evidence
        ),
        "verification_status": (
            record.verification_status
        ),
        "verification_comment": (
            record.verification_comment
        ),
        "verified_by": record.verified_by,
        "verified_at": record.verified_at,
        "closed_by": record.closed_by,
        "closed_at": record.closed_at,
        "closure_comment": record.closure_comment,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _audit_finding_event_payload(event):
    return {
        "id": event.id,
        "tenant_id": event.tenant_id,
        "finding_id": event.finding_id,
        "actor_id": event.actor_id,
        "actor_role": event.actor_role,
        "action": event.action,
        "from_status": event.from_status,
        "to_status": event.to_status,
        "comment": event.comment,
        "created_at": event.created_at,
    }


def _maturity_finding_http_error(exc):
    if isinstance(
        exc,
        MaturityAuditFindingNotFoundError,
    ):
        return HTTPException(
            status_code=404,
            detail=str(exc),
        )

    if isinstance(
        exc,
        MaturityAuditFindingConflictError,
    ):
        return HTTPException(
            status_code=409,
            detail=str(exc),
        )

    return HTTPException(
        status_code=400,
        detail=str(exc),
    )


@router.get(
    "/assessments/{assessment_id}/audit-findings",
    response_model=list[PamAuditFindingResponse],
)
def list_maturity_audit_findings(
    assessment_id: int,
    target_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        records = MaturityAuditFindingService.list_findings(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        return [
            _audit_finding_payload(record)
            for record in records
        ]

    except MaturityAuditFindingError as exc:
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings",
    response_model=PamAuditFindingResponse,
    status_code=201,
)
def create_maturity_audit_finding(
    assessment_id: int,
    payload: PamAuditFindingCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not _has_role(
        user,
        "internal_auditor",
        "process_manager",
        "admin",
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only an auditor, process manager or "
                "administrator can create a finding"
            ),
        )

    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.create_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=payload.target_id,
            created_by=user.id,
            assigned_owner_id=payload.assigned_owner_id,
            process_manager_id=payload.process_manager_id,
            title=payload.title,
            description=payload.description,
            severity=payload.severity,
            requirement=payload.requirement,
            objective_evidence=payload.objective_evidence,
            due_date=payload.due_date,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else None
            ),
            commit=True,
        )

        return _audit_finding_payload(record)

    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.get(
    "/assessments/{assessment_id}/audit-findings/{finding_id}",
    response_model=PamAuditFindingResponse,
)
def get_maturity_audit_finding(
    assessment_id: int,
    finding_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        return _audit_finding_payload(record)

    except MaturityAuditFindingError as exc:
        raise _maturity_finding_http_error(exc) from exc


@router.get(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/workflow",
    response_model=list[
        PamAuditFindingWorkflowEventResponse
    ],
)
def list_maturity_audit_finding_workflow(
    assessment_id: int,
    finding_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        events = (
            db.query(
                AuditMaturityFindingWorkflowEvent
            )
            .filter(
                AuditMaturityFindingWorkflowEvent.tenant_id
                == tenant_id,
                AuditMaturityFindingWorkflowEvent.finding_id
                == record.id,
            )
            .order_by(
                AuditMaturityFindingWorkflowEvent.id.asc()
            )
            .all()
        )

        return [
            _audit_finding_event_payload(event)
            for event in events
        ]

    except MaturityAuditFindingError as exc:
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/assign-owner",
    response_model=PamAuditFindingResponse,
)
def assign_maturity_audit_finding_owner(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingAssignOwner,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not _has_role(
        user,
        "internal_auditor",
        "process_manager",
        "admin",
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only an auditor, process manager or "
                "administrator can assign finding ownership"
            ),
        )

    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.assign_owner(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            assigned_owner_id=payload.assigned_owner_id,
            process_manager_id=payload.process_manager_id,
            comment=payload.comment,
            manager_comment=payload.manager_comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else None
            ),
            commit=True,
        )

        return _audit_finding_payload(record)

    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/owner-response",
    response_model=PamAuditFindingResponse,
)
def save_maturity_audit_finding_owner_response(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingOwnerResponse,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        if not (
            _is_superadmin(user)
            or record.assigned_owner_id == user.id
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned owner can submit "
                    "the finding response"
                ),
            )

        record = MaturityAuditFindingService.save_owner_response(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            root_cause=payload.root_cause,
            correction=payload.correction,
            corrective_action_plan=(
                payload.corrective_action_plan
            ),
            recommendation=payload.recommendation,
            implementation_evidence=(
                payload.implementation_evidence
            ),
            due_date=payload.due_date,
            comment=payload.comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else None
            ),
            enforce_actor=not _is_superadmin(user),
            commit=True,
        )

        return _audit_finding_payload(record)

    except HTTPException:
        raise
    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/owner-submit",
    response_model=PamAuditFindingResponse,
)
def submit_maturity_audit_finding_owner_plan(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingComment,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        if not (
            _is_superadmin(user)
            or record.assigned_owner_id == user.id
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned owner can submit "
                    "the corrective action plan"
                ),
            )

        record = MaturityAuditFindingService.owner_submit(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            comment=payload.comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else None
            ),
            enforce_actor=not _is_superadmin(user),
            commit=True,
        )

        return _audit_finding_payload(record)

    except HTTPException:
        raise
    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/manager-approve",
    response_model=PamAuditFindingResponse,
)
def approve_maturity_audit_finding_plan(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingComment,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        allowed = (
            _is_superadmin(user)
            or record.process_manager_id == user.id
            or _has_role(user, "process_manager")
        )

        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned process manager "
                    "can approve the corrective action plan"
                ),
            )

        record = MaturityAuditFindingService.manager_approve(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            comment=payload.comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else "process_manager"
            ),
            enforce_actor=False,
            commit=True,
        )

        return _audit_finding_payload(record)

    except HTTPException:
        raise
    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/manager-revision",
    response_model=PamAuditFindingResponse,
)
def revise_maturity_audit_finding_plan(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingRevision,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        allowed = (
            _is_superadmin(user)
            or record.process_manager_id == user.id
            or _has_role(user, "process_manager")
        )

        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned process manager "
                    "can request a revision"
                ),
            )

        record = MaturityAuditFindingService.manager_revision(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            comment=payload.comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else "process_manager"
            ),
            enforce_actor=False,
            commit=True,
        )

        return _audit_finding_payload(record)

    except HTTPException:
        raise
    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/implementation-complete",
    response_model=PamAuditFindingResponse,
)
def complete_maturity_audit_finding_implementation(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingImplementationComplete,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        if not (
            _is_superadmin(user)
            or record.assigned_owner_id == user.id
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned owner can mark "
                    "implementation complete"
                ),
            )

        record = MaturityAuditFindingService.implementation_complete(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            implementation_evidence=(
                payload.implementation_evidence
            ),
            comment=payload.comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else None
            ),
            enforce_actor=not _is_superadmin(user),
            commit=True,
        )

        return _audit_finding_payload(record)

    except HTTPException:
        raise
    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/audit-findings/{finding_id}/verify",
    response_model=PamAuditFindingResponse,
)
def verify_maturity_audit_finding(
    assessment_id: int,
    finding_id: int,
    payload: PamAuditFindingVerification,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not _has_role(
        user,
        "internal_auditor",
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only an internal auditor can verify "
                "and close a finding"
            ),
        )

    tenant_id = _tenant_id(user)

    try:
        record = MaturityAuditFindingService.verify_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
            actor_id=user.id,
            effective=payload.effective,
            comment=payload.comment,
            actor_role=(
                "superadmin"
                if _is_superadmin(user)
                else "internal_auditor"
            ),
            commit=True,
        )

        return _audit_finding_payload(record)

    except MaturityAuditFindingError as exc:
        db.rollback()
        raise _maturity_finding_http_error(exc) from exc



def _follow_up_actor_role(user) -> str | None:
    if _is_superadmin(user):
        return "superadmin"

    roles = _roles(user)

    for role in (
        "internal_auditor",
        "process_manager",
        "admin",
    ):
        if role in roles:
            return role

    return None


def _follow_up_payload(record):
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "finding_id": record.finding_id,
        "action_code": record.action_code,
        "title": record.title,
        "description": record.description,
        "assigned_owner_id": record.assigned_owner_id,
        "created_by": record.created_by,
        "verifier_id": record.verifier_id,
        "priority": record.priority,
        "due_date": record.due_date,
        "status": record.status,
        "started_at": record.started_at,
        "submitted_for_verification_at": (
            record.submitted_for_verification_at
        ),
        "verified_at": record.verified_at,
        "completed_at": record.completed_at,
        "completion_note": record.completion_note,
        "verification_comment": record.verification_comment,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _follow_up_evidence_payload(record):
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "follow_up_action_id": record.follow_up_action_id,
        "evidence_id": record.evidence_id,
        "linked_by": record.linked_by,
        "note": record.note,
        "created_at": record.created_at,
    }


def _follow_up_event_payload(event):
    return {
        "id": event.id,
        "tenant_id": event.tenant_id,
        "follow_up_action_id": event.follow_up_action_id,
        "actor_id": event.actor_id,
        "actor_role": event.actor_role,
        "action": event.action,
        "from_status": event.from_status,
        "to_status": event.to_status,
        "comment": event.comment,
        "created_at": event.created_at,
    }


def _follow_up_http_error(exc):
    if isinstance(
        exc,
        MaturityFollowUpActionNotFoundError,
    ):
        return HTTPException(
            status_code=404,
            detail=str(exc),
        )

    if isinstance(
        exc,
        MaturityFollowUpActionConflictError,
    ):
        return HTTPException(
            status_code=409,
            detail=str(exc),
        )

    return HTTPException(
        status_code=400,
        detail=str(exc),
    )


def _require_follow_up_manager(user):
    if not _has_role(
        user,
        "internal_auditor",
        "process_manager",
        "admin",
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Follow-up management permission is required"
            ),
        )


def _require_follow_up_owner(
    record,
    user,
):
    if _is_superadmin(user):
        return

    if record.assigned_owner_id != user.id:
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the assigned owner can perform "
                "this follow-up action"
            ),
        )


def _require_follow_up_verifier(user):
    if not _has_role(
        user,
        "internal_auditor",
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only an internal auditor can verify "
                "a follow-up action"
            ),
        )


@router.get(
    "/assessments/{assessment_id}/follow-up-actions",
    response_model=list[PamFollowUpActionResponse],
)
def list_maturity_follow_up_actions(
    assessment_id: int,
    finding_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        records = MaturityFollowUpActionService.list_actions(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        return [
            _follow_up_payload(record)
            for record in records
        ]

    except MaturityFollowUpActionError as exc:
        raise _follow_up_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/follow-up-actions",
    response_model=PamFollowUpActionResponse,
    status_code=201,
)
def create_maturity_follow_up_action(
    assessment_id: int,
    payload: PamFollowUpActionCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _require_follow_up_manager(user)
    tenant_id = _tenant_id(user)

    try:
        record = MaturityFollowUpActionService.create_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=payload.finding_id,
            title=payload.title,
            description=payload.description,
            assigned_owner_id=payload.assigned_owner_id,
            created_by=user.id,
            priority=payload.priority,
            due_date=payload.due_date,
            actor_role=_follow_up_actor_role(user),
            comment=payload.comment,
            commit=True,
        )

        return _follow_up_payload(record)

    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.get(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}",
    response_model=PamFollowUpActionResponse,
)
def get_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityFollowUpActionService.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        return _follow_up_payload(record)

    except MaturityFollowUpActionError as exc:
        raise _follow_up_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/assign-owner",
    response_model=PamFollowUpActionResponse,
)
def assign_maturity_follow_up_owner(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpAssignOwner,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _require_follow_up_manager(user)
    tenant_id = _tenant_id(user)

    try:
        record = MaturityFollowUpActionService.assign_owner(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
            assigned_owner_id=payload.assigned_owner_id,
            actor_id=user.id,
            actor_role=_follow_up_actor_role(user),
            comment=payload.comment,
            commit=True,
        )

        return _follow_up_payload(record)

    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


def _owner_follow_up_action(
    *,
    assessment_id,
    action_id,
    db,
    user,
    operation,
    comment=None,
):
    tenant_id = _tenant_id(user)

    try:
        current = MaturityFollowUpActionService.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        _require_follow_up_owner(
            current,
            user,
        )

        record = operation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
            actor_id=user.id,
            actor_role=_follow_up_actor_role(user),
            comment=comment,
            commit=True,
        )

        return _follow_up_payload(record)

    except HTTPException:
        raise
    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/start",
    response_model=PamFollowUpActionResponse,
)
def start_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpComment,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _owner_follow_up_action(
        assessment_id=assessment_id,
        action_id=action_id,
        db=db,
        user=user,
        operation=MaturityFollowUpActionService.start_action,
        comment=payload.comment,
    )


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/block",
    response_model=PamFollowUpActionResponse,
)
def block_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpComment,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _owner_follow_up_action(
        assessment_id=assessment_id,
        action_id=action_id,
        db=db,
        user=user,
        operation=MaturityFollowUpActionService.block_action,
        comment=payload.comment,
    )


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/resume",
    response_model=PamFollowUpActionResponse,
)
def resume_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpComment,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _owner_follow_up_action(
        assessment_id=assessment_id,
        action_id=action_id,
        db=db,
        user=user,
        operation=MaturityFollowUpActionService.resume_action,
        comment=payload.comment,
    )


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/submit-for-verification",
    response_model=PamFollowUpActionResponse,
)
def submit_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpSubmitVerification,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        current = MaturityFollowUpActionService.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        _require_follow_up_owner(
            current,
            user,
        )

        record = (
            MaturityFollowUpActionService
            .submit_for_verification(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                action_id=action_id,
                actor_id=user.id,
                completion_note=payload.completion_note,
                actor_role=_follow_up_actor_role(user),
                comment=payload.comment,
                commit=True,
            )
        )

        return _follow_up_payload(record)

    except HTTPException:
        raise
    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/verify",
    response_model=PamFollowUpActionResponse,
)
def verify_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpVerification,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _require_follow_up_verifier(user)
    tenant_id = _tenant_id(user)

    try:
        record = MaturityFollowUpActionService.verify_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
            actor_id=user.id,
            effective=payload.effective,
            comment=payload.comment,
            actor_role=_follow_up_actor_role(user),
            commit=True,
        )

        return _follow_up_payload(record)

    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/cancel",
    response_model=PamFollowUpActionResponse,
)
def cancel_maturity_follow_up_action(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpComment,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _require_follow_up_manager(user)
    tenant_id = _tenant_id(user)

    try:
        record = MaturityFollowUpActionService.cancel_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
            actor_id=user.id,
            actor_role=_follow_up_actor_role(user),
            comment=payload.comment,
            commit=True,
        )

        return _follow_up_payload(record)

    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.get(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/evidences",
    response_model=list[PamFollowUpEvidenceLinkResponse],
)
def list_maturity_follow_up_evidence(
    assessment_id: int,
    action_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        records = MaturityFollowUpActionService.list_evidence(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        return [
            _follow_up_evidence_payload(record)
            for record in records
        ]

    except MaturityFollowUpActionError as exc:
        raise _follow_up_http_error(exc) from exc


@router.post(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/evidences",
    response_model=PamFollowUpEvidenceLinkResponse,
    status_code=201,
)
def link_maturity_follow_up_evidence(
    assessment_id: int,
    action_id: int,
    payload: PamFollowUpEvidenceLinkCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        current = MaturityFollowUpActionService.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        _require_follow_up_owner(
            current,
            user,
        )

        record = MaturityFollowUpActionService.link_evidence(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
            evidence_id=payload.evidence_id,
            actor_id=user.id,
            actor_role=_follow_up_actor_role(user),
            note=payload.note,
            commit=True,
        )

        return _follow_up_evidence_payload(record)

    except HTTPException:
        raise
    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.delete(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/evidences/{evidence_id}",
    status_code=204,
)
def unlink_maturity_follow_up_evidence(
    assessment_id: int,
    action_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        current = MaturityFollowUpActionService.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        _require_follow_up_owner(
            current,
            user,
        )

        MaturityFollowUpActionService.unlink_evidence(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
            evidence_id=evidence_id,
            actor_id=user.id,
            actor_role=_follow_up_actor_role(user),
            commit=True,
        )

        return None

    except HTTPException:
        raise
    except MaturityFollowUpActionError as exc:
        db.rollback()
        raise _follow_up_http_error(exc) from exc


@router.get(
    "/assessments/{assessment_id}/follow-up-actions/{action_id}/workflow",
    response_model=list[PamFollowUpWorkflowEventResponse],
)
def list_maturity_follow_up_workflow(
    assessment_id: int,
    action_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant_id(user)

    try:
        record = MaturityFollowUpActionService.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        events = (
            db.query(
                AuditMaturityFollowUpWorkflowEvent
            )
            .filter(
                AuditMaturityFollowUpWorkflowEvent.tenant_id
                == tenant_id,
                AuditMaturityFollowUpWorkflowEvent
                .follow_up_action_id == record.id,
            )
            .order_by(
                AuditMaturityFollowUpWorkflowEvent.id.asc()
            )
            .all()
        )

        return [
            _follow_up_event_payload(event)
            for event in events
        ]

    except MaturityFollowUpActionError as exc:
        raise _follow_up_http_error(exc) from exc

@router.get(
    "/assessments/{assessment_id}/evidence-coverage",
)
def get_assessment_evidence_coverage(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return PamAssessmentService.get_evidence_coverage(
            db,
            tenant_id=_tenant_id(user),
            assessment_id=assessment_id,
        )

    except PamAssessmentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except PamAssessmentConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except PamAssessmentError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

