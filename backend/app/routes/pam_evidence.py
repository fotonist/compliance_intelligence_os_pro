from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.evidences import Evidence
from app.models.pam_assessment import PamAssessment, PamAssessmentProcess
from app.models.pam_indicator_evaluation import PamIndicatorEvaluation, PamIndicatorEvidenceLink
from app.models.pam_definition import (
    PamBasePractice,
    PamGenericPractice,
    PamGenericResource,
    PamGenericWorkProduct,
    PamWorkProduct,
)
from app.models.user import User


router = APIRouter(prefix="/evidences", tags=["evidence-pam"])


class PamEvidenceLinkRequest(BaseModel):
    evaluation_id: int
    relevance: str | None = None
    note: str | None = None


def _get_tenant_assessment_process(db: Session, assessment_process_id: int, tenant_id: int):
    return (
        db.query(PamAssessmentProcess)
        .join(PamAssessment, PamAssessment.id == PamAssessmentProcess.assessment_id)
        .filter(
            PamAssessmentProcess.id == assessment_process_id,
            PamAssessment.tenant_id == tenant_id,
            PamAssessmentProcess.in_scope.is_(True),
        )
        .first()
    )


def _get_evaluation(db: Session, evaluation_id: int, tenant_id: int):
    return (
        db.query(PamIndicatorEvaluation)
        .join(PamAssessmentProcess, PamAssessmentProcess.id == PamIndicatorEvaluation.assessment_process_id)
        .join(PamAssessment, PamAssessment.id == PamAssessmentProcess.assessment_id)
        .filter(
            PamIndicatorEvaluation.id == evaluation_id,
            PamAssessment.tenant_id == tenant_id,
        )
        .first()
    )


def _indicator_payload(evaluation: PamIndicatorEvaluation):
    target = None
    if evaluation.base_practice:
        target = {"type": "BASE_PRACTICE", "id": evaluation.base_practice.id, "code": evaluation.base_practice.code, "text": evaluation.base_practice.text}
    elif evaluation.work_product:
        target = {"type": "WORK_PRODUCT", "id": evaluation.work_product.id, "code": evaluation.work_product.code, "name": evaluation.work_product.name}
    elif evaluation.generic_practice:
        target = {"type": "GENERIC_PRACTICE", "id": evaluation.generic_practice.id, "code": evaluation.generic_practice.code, "text": evaluation.generic_practice.text}
    elif evaluation.generic_resource:
        target = {"type": "GENERIC_RESOURCE", "id": evaluation.generic_resource.id, "code": evaluation.generic_resource.code, "text": evaluation.generic_resource.text}
    elif evaluation.generic_work_product:
        target = {"type": "GENERIC_WORK_PRODUCT", "id": evaluation.generic_work_product.id, "code": evaluation.generic_work_product.code, "text": evaluation.generic_work_product.text}
    return {
        "id": evaluation.id,
        "indicator_type": evaluation.indicator_type,
        "rating": evaluation.rating,
        "status": evaluation.status,
        "target": target,
        "assessment_process_id": evaluation.assessment_process_id,
    }


@router.get("/{evidence_id}/pam-links")
def list_pam_evidence_links(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="User tenant is not available")

    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
        )
        .first()
    )
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    rows = (
        db.query(PamIndicatorEvidenceLink)
        .join(PamIndicatorEvaluation, PamIndicatorEvaluation.id == PamIndicatorEvidenceLink.evaluation_id)
        .join(PamAssessmentProcess, PamAssessmentProcess.id == PamIndicatorEvaluation.assessment_process_id)
        .join(PamAssessment, PamAssessment.id == PamAssessmentProcess.assessment_id)
        .filter(
            PamIndicatorEvidenceLink.evidence_id == evidence.id,
            PamAssessment.tenant_id == tenant_id,
        )
        .all()
    )

    return {
        "evidence_id": evidence.id,
        "links": [
            {
                "id": link.id,
                "evaluation": _indicator_payload(link.evaluation),
                "relevance": link.relevance,
                "note": link.note,
                "created_at": link.created_at,
            }
            for link in rows
        ],
    }


@router.post("/{evidence_id}/pam-links")
def link_evidence_to_pam_indicator(
    evidence_id: int,
    payload: PamEvidenceLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="User tenant is not available")

    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
        )
        .first()
    )
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    evaluation = _get_evaluation(db, payload.evaluation_id, tenant_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="PAM indicator evaluation not found")

    existing = (
        db.query(PamIndicatorEvidenceLink)
        .filter(
            PamIndicatorEvidenceLink.evaluation_id == evaluation.id,
            PamIndicatorEvidenceLink.evidence_id == evidence.id,
        )
        .first()
    )
    if existing:
        existing.relevance = payload.relevance
        existing.note = payload.note
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "evaluation": _indicator_payload(evaluation), "relevance": existing.relevance, "note": existing.note}

    link = PamIndicatorEvidenceLink(
        evaluation_id=evaluation.id,
        evidence_id=evidence.id,
        relevance=payload.relevance,
        note=payload.note,
        created_at=datetime.utcnow(),
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return {"id": link.id, "evaluation": _indicator_payload(evaluation), "relevance": link.relevance, "note": link.note}


@router.delete("/{evidence_id}/pam-links/{link_id}")
def unlink_evidence_from_pam_indicator(
    evidence_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="User tenant is not available")

    link = (
        db.query(PamIndicatorEvidenceLink)
        .join(PamIndicatorEvaluation, PamIndicatorEvaluation.id == PamIndicatorEvidenceLink.evaluation_id)
        .join(PamAssessmentProcess, PamAssessmentProcess.id == PamIndicatorEvaluation.assessment_process_id)
        .join(PamAssessment, PamAssessment.id == PamAssessmentProcess.assessment_id)
        .filter(
            PamIndicatorEvidenceLink.id == link_id,
            PamIndicatorEvidenceLink.evidence_id == evidence_id,
            PamAssessment.tenant_id == tenant_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="PAM evidence link not found")

    db.delete(link)
    db.commit()
    return {"deleted": True, "link_id": link_id, "evidence_id": evidence_id}
