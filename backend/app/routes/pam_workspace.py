from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.pam_assessment import (
    PamAssessment,
    PamAssessmentProcess,
    PamProcessAttributeEvaluation,
)
from app.models.pam_capability import PamCapabilityLevel, PamProcessAttribute
from app.models.pam_definition import PamProcess, PamProcessWorkProduct
from app.models.user import User


router = APIRouter(prefix="/maturity/workspace", tags=["PAM Assessment Workspace"])


class AttributeEvaluationRequest(BaseModel):
    rating: str | None = None
    justification: str | None = None
    status: str = "DRAFT"


def _indicator_list(items):
    return [
        {
            "id": item.id,
            "code": item.code,
            "text": item.text,
            "guidance": getattr(item, "guidance", None),
            "sort_order": item.sort_order,
        }
        for item in sorted(items, key=lambda value: (value.sort_order, value.code or ""))
    ]


@router.get("/{session_id}")
def get_pam_workspace(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = (
        db.query(PamAssessment)
        .filter(
            PamAssessment.id == session_id,
            PamAssessment.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="PAM assessment not found")

    capability_levels = (
        db.query(PamCapabilityLevel)
        .options(joinedload(PamCapabilityLevel.attributes))
        .filter(PamCapabilityLevel.framework_model_id == assessment.framework_model_id)
        .order_by(PamCapabilityLevel.level)
        .all()
    )

    attributes = (
        db.query(PamProcessAttribute)
        .options(
            joinedload(PamProcessAttribute.capability_level),
            joinedload(PamProcessAttribute.generic_practices),
            joinedload(PamProcessAttribute.generic_resources),
            joinedload(PamProcessAttribute.generic_work_products),
        )
        .join(PamCapabilityLevel)
        .filter(PamCapabilityLevel.framework_model_id == assessment.framework_model_id)
        .order_by(PamCapabilityLevel.level, PamProcessAttribute.sort_order)
        .all()
    )

    assessment_processes = (
        db.query(PamAssessmentProcess)
        .options(
            joinedload(PamAssessmentProcess.tenant_process),
            joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.process_group),
            joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.outcomes),
            joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.base_practices),
            joinedload(PamAssessmentProcess.pam_process)
            .joinedload(PamProcess.work_products)
            .joinedload(PamProcessWorkProduct.work_product),
            joinedload(PamAssessmentProcess.attribute_evaluations)
            .joinedload(PamProcessAttributeEvaluation.process_attribute),
        )
        .filter(
            PamAssessmentProcess.assessment_id == assessment.id,
            PamAssessmentProcess.in_scope.is_(True),
        )
        .order_by(PamAssessmentProcess.id)
        .all()
    )

    evaluated_processes = 0
    evaluated_attributes = 0
    total_attributes = len(attributes) * len(assessment_processes)
    process_payload = []

    for assessment_process in assessment_processes:
        process = assessment_process.pam_process
        tenant_process = assessment_process.tenant_process
        evaluations = {
            evaluation.process_attribute_id: evaluation
            for evaluation in assessment_process.attribute_evaluations
        }

        if any(evaluation.rating or evaluation.justification for evaluation in assessment_process.attribute_evaluations):
            evaluated_processes += 1

        attribute_payload = []
        for attribute in attributes:
            evaluation = evaluations.get(attribute.id)
            if evaluation and (evaluation.rating or evaluation.justification):
                evaluated_attributes += 1

            attribute_payload.append(
                {
                    "id": attribute.id,
                    "code": attribute.code,
                    "name": attribute.name,
                    "description": attribute.description,
                    "capability_level": {
                        "id": attribute.capability_level.id,
                        "level": attribute.capability_level.level,
                        "code": attribute.capability_level.code,
                        "name": attribute.capability_level.name,
                        "description": attribute.capability_level.description,
                    },
                    "evaluation": (
                        {
                            "id": evaluation.id,
                            "rating": evaluation.rating,
                            "justification": evaluation.justification,
                            "status": evaluation.status,
                            "evaluated_by": evaluation.evaluated_by,
                            "evaluated_at": evaluation.evaluated_at,
                        }
                        if evaluation
                        else None
                    ),
                    "generic_practices": _indicator_list(attribute.generic_practices),
                    "generic_resources": _indicator_list(attribute.generic_resources),
                    "generic_work_products": _indicator_list(attribute.generic_work_products),
                }
            )

        process_payload.append(
            {
                "assessment_process_id": assessment_process.id,
                "tenant_process_id": tenant_process.id if tenant_process else None,
                "tenant_process": (
                    {
                        "id": tenant_process.id,
                        "code": tenant_process.code,
                        "name": tenant_process.name,
                        "type": tenant_process.type,
                        "owner": tenant_process.owner,
                        "status": tenant_process.status,
                    }
                    if tenant_process
                    else None
                ),
                "pam_process_id": process.id,
                "code": process.code,
                "name": process.name,
                "purpose": process.purpose,
                "description": process.description,
                "process_group": {
                    "id": process.process_group.id,
                    "code": process.process_group.code,
                    "name": process.process_group.name,
                },
                "outcomes": [
                    {
                        "id": outcome.id,
                        "code": outcome.code,
                        "text": outcome.text,
                        "sort_order": outcome.sort_order,
                    }
                    for outcome in sorted(
                        process.outcomes,
                        key=lambda value: (value.sort_order, value.code or ""),
                    )
                ],
                "base_practices": _indicator_list(process.base_practices),
                "work_products": [
                    {
                        "id": link.work_product.id,
                        "code": link.work_product.code,
                        "name": link.work_product.name,
                        "description": link.work_product.description,
                        "characteristics": link.work_product.characteristics,
                        "direction": link.direction,
                        "sort_order": link.sort_order,
                    }
                    for link in sorted(
                        process.work_products,
                        key=lambda value: (
                            value.sort_order,
                            value.work_product.code if value.work_product else "",
                        ),
                    )
                    if link.work_product
                ],
                "target_capability_level": assessment_process.target_capability_level,
                "status": assessment_process.status,
                "attributes": attribute_payload,
            }
        )

    return {
        "assessment": {
            "id": assessment.id,
            "name": assessment.name,
            "scope": assessment.scope,
            "status": assessment.status,
            "tenant_id": assessment.tenant_id,
            "framework_adoption_id": assessment.framework_adoption_id,
            "framework_model_id": assessment.framework_model_id,
            "assessor_user_id": assessment.assessor_user_id,
            "sponsor_user_id": assessment.sponsor_user_id,
            "created_at": assessment.created_at,
            "updated_at": assessment.updated_at,
        },
        "summary": {
            "processes_in_scope": len(assessment_processes),
            "assessed_processes": evaluated_processes,
            "attributes_evaluated": evaluated_attributes,
            "attributes_total": total_attributes,
            "average_capability": None,
            "target_capability": None,
            "capability_gap": None,
        },
        "capability_levels": [
            {
                "id": level.id,
                "level": level.level,
                "code": level.code,
                "name": level.name,
                "description": level.description,
                "attributes": [
                    {
                        "id": attribute.id,
                        "code": attribute.code,
                        "name": attribute.name,
                        "description": attribute.description,
                        "sort_order": attribute.sort_order,
                    }
                    for attribute in sorted(
                        level.attributes,
                        key=lambda value: (value.sort_order, value.code or ""),
                    )
                ],
            }
            for level in capability_levels
        ],
        "processes": process_payload,
    }


@router.put("/{session_id}/processes/{assessment_process_id}/attributes/{attribute_id}")
def update_pam_attribute_evaluation(
    session_id: int,
    assessment_process_id: int,
    attribute_id: int,
    payload: AttributeEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = (
        db.query(PamAssessment)
        .filter(
            PamAssessment.id == session_id,
            PamAssessment.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="PAM assessment not found")

    assessment_process = (
        db.query(PamAssessmentProcess)
        .filter(
            PamAssessmentProcess.id == assessment_process_id,
            PamAssessmentProcess.assessment_id == assessment.id,
            PamAssessmentProcess.in_scope.is_(True),
        )
        .first()
    )
    if not assessment_process:
        raise HTTPException(status_code=404, detail="Assessment process not found")

    attribute = (
        db.query(PamProcessAttribute)
        .join(PamCapabilityLevel)
        .filter(
            PamProcessAttribute.id == attribute_id,
            PamCapabilityLevel.framework_model_id == assessment.framework_model_id,
        )
        .first()
    )
    if not attribute:
        raise HTTPException(status_code=404, detail="Process attribute not found")

    evaluation = (
        db.query(PamProcessAttributeEvaluation)
        .filter(
            PamProcessAttributeEvaluation.assessment_process_id == assessment_process.id,
            PamProcessAttributeEvaluation.process_attribute_id == attribute.id,
        )
        .first()
    )

    now = datetime.utcnow()
    if evaluation is None:
        evaluation = PamProcessAttributeEvaluation(
            assessment_process_id=assessment_process.id,
            process_attribute_id=attribute.id,
        )
        db.add(evaluation)

    evaluation.rating = payload.rating
    evaluation.justification = payload.justification
    evaluation.status = payload.status
    evaluation.evaluated_by = current_user.id
    evaluation.evaluated_at = now
    assessment_process.status = "IN_PROGRESS"

    db.commit()
    db.refresh(evaluation)

    return {
        "id": evaluation.id,
        "assessment_process_id": evaluation.assessment_process_id,
        "process_attribute_id": evaluation.process_attribute_id,
        "rating": evaluation.rating,
        "justification": evaluation.justification,
        "status": evaluation.status,
        "evaluated_by": evaluation.evaluated_by,
        "evaluated_at": evaluation.evaluated_at,
    }
