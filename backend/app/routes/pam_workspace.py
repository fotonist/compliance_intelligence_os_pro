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
from app.models.pam_definition import (
    PamBasePractice,
    PamGenericPractice,
    PamGenericResource,
    PamGenericWorkProduct,
    PamProcess,
    PamProcessWorkProduct,
    PamWorkProduct,
)
from app.models.pam_indicator_evaluation import PamIndicatorEvaluation
from app.models.user import User


router = APIRouter(prefix="/maturity/workspace", tags=["PAM Assessment Workspace"])


class AttributeEvaluationRequest(BaseModel):
    rating: str | None = None
    justification: str | None = None
    status: str = "DRAFT"


class IndicatorEvaluationRequest(BaseModel):
    indicator_type: str
    indicator_id: int
    rating: str | None = None
    observation: str | None = None
    justification: str | None = None
    status: str = "DRAFT"


INDICATOR_TARGETS = {
    "BASE_PRACTICE": ("base_practice_id", PamBasePractice),
    "WORK_PRODUCT": ("work_product_id", PamWorkProduct),
    "GENERIC_PRACTICE": ("generic_practice_id", PamGenericPractice),
    "GENERIC_RESOURCE": ("generic_resource_id", PamGenericResource),
    "GENERIC_WORK_PRODUCT": ("generic_work_product_id", PamGenericWorkProduct),
}


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


def _get_assessment(db: Session, session_id: int, tenant_id: int):
    return (
        db.query(PamAssessment)
        .filter(PamAssessment.id == session_id, PamAssessment.tenant_id == tenant_id)
        .first()
    )


def _get_assessment_process(db: Session, session_id: int, assessment_process_id: int, tenant_id: int):
    return (
        db.query(PamAssessmentProcess)
        .join(PamAssessment, PamAssessment.id == PamAssessmentProcess.assessment_id)
        .filter(
            PamAssessmentProcess.id == assessment_process_id,
            PamAssessmentProcess.assessment_id == session_id,
            PamAssessmentProcess.in_scope.is_(True),
            PamAssessment.tenant_id == tenant_id,
        )
        .first()
    )


@router.get("/{session_id}")
def get_pam_workspace(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_assessment(db, session_id, current_user.tenant_id)
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
            joinedload(PamAssessmentProcess.indicator_evaluations)
            .joinedload(PamIndicatorEvaluation.base_practice),
            joinedload(PamAssessmentProcess.indicator_evaluations)
            .joinedload(PamIndicatorEvaluation.work_product),
            joinedload(PamAssessmentProcess.indicator_evaluations)
            .joinedload(PamIndicatorEvaluation.generic_practice),
            joinedload(PamAssessmentProcess.indicator_evaluations)
            .joinedload(PamIndicatorEvaluation.generic_resource),
            joinedload(PamAssessmentProcess.indicator_evaluations)
            .joinedload(PamIndicatorEvaluation.generic_work_product),
            joinedload(PamAssessmentProcess.indicator_evaluations)
            .joinedload(PamIndicatorEvaluation.evidence_links),
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
        indicator_evaluations = {}
        for evaluation in assessment_process.indicator_evaluations:
            if evaluation.base_practice_id:
                indicator_evaluations[("BASE_PRACTICE", evaluation.base_practice_id)] = evaluation
            if evaluation.work_product_id:
                indicator_evaluations[("WORK_PRODUCT", evaluation.work_product_id)] = evaluation
            if evaluation.generic_practice_id:
                indicator_evaluations[("GENERIC_PRACTICE", evaluation.generic_practice_id)] = evaluation
            if evaluation.generic_resource_id:
                indicator_evaluations[("GENERIC_RESOURCE", evaluation.generic_resource_id)] = evaluation
            if evaluation.generic_work_product_id:
                indicator_evaluations[("GENERIC_WORK_PRODUCT", evaluation.generic_work_product_id)] = evaluation

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
                    "generic_practices": _indicator_list_with_evaluations(attribute.generic_practices, "GENERIC_PRACTICE", indicator_evaluations),
                    "generic_resources": _indicator_list_with_evaluations(attribute.generic_resources, "GENERIC_RESOURCE", indicator_evaluations),
                    "generic_work_products": _indicator_list_with_evaluations(attribute.generic_work_products, "GENERIC_WORK_PRODUCT", indicator_evaluations),
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
                    for outcome in sorted(process.outcomes, key=lambda value: (value.sort_order, value.code or ""))
                ],
                "base_practices": _indicator_list_with_evaluations(process.base_practices, "BASE_PRACTICE", indicator_evaluations),
                "work_products": [
                    {
                        "id": link.work_product.id,
                        "code": link.work_product.code,
                        "name": link.work_product.name,
                        "description": link.work_product.description,
                        "characteristics": link.work_product.characteristics,
                        "direction": link.direction,
                        "sort_order": link.sort_order,
                        "evaluation": _evaluation_payload(indicator_evaluations.get(("WORK_PRODUCT", link.work_product.id))),
                    }
                    for link in sorted(
                        process.work_products,
                        key=lambda value: (value.sort_order, value.work_product.code if value.work_product else ""),
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
                    for attribute in sorted(level.attributes, key=lambda value: (value.sort_order, value.code or ""))
                ],
            }
            for level in capability_levels
        ],
        "processes": process_payload,
    }


def _evaluation_payload(evaluation):
    if not evaluation:
        return None
    return {
        "id": evaluation.id,
        "rating": evaluation.rating,
        "observation": evaluation.observation,
        "justification": evaluation.justification,
        "status": evaluation.status,
        "evidence_count": len(evaluation.evidence_links),
        "evaluated_by": evaluation.evaluator_user_id,
        "evaluated_at": evaluation.evaluated_at,
    }


def _indicator_list_with_evaluations(items, indicator_type, evaluations):
    return [
        {
            "id": item.id,
            "code": item.code,
            "text": item.text,
            "guidance": getattr(item, "guidance", None),
            "sort_order": item.sort_order,
            "evaluation": _evaluation_payload(evaluations.get((indicator_type, item.id))),
        }
        for item in sorted(items, key=lambda value: (value.sort_order, value.code or ""))
    ]


@router.put("/{session_id}/processes/{assessment_process_id}/attributes/{attribute_id}")
def update_pam_attribute_evaluation(
    session_id: int,
    assessment_process_id: int,
    attribute_id: int,
    payload: AttributeEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_assessment(db, session_id, current_user.tenant_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="PAM assessment not found")

    assessment_process = _get_assessment_process(db, session_id, assessment_process_id, current_user.tenant_id)
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


@router.put("/{session_id}/processes/{assessment_process_id}/indicators")
def update_pam_indicator_evaluation(
    session_id: int,
    assessment_process_id: int,
    payload: IndicatorEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_assessment(db, session_id, current_user.tenant_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="PAM assessment not found")

    assessment_process = _get_assessment_process(db, session_id, assessment_process_id, current_user.tenant_id)
    if not assessment_process:
        raise HTTPException(status_code=404, detail="Assessment process not found")

    indicator_type = payload.indicator_type.strip().upper()
    target_config = INDICATOR_TARGETS.get(indicator_type)
    if not target_config:
        raise HTTPException(status_code=422, detail="Unsupported PAM indicator type")

    target_field, target_model = target_config
    target = (
        db.query(target_model)
        .filter(target_model.id == payload.indicator_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="PAM indicator not found")

    if indicator_type == "BASE_PRACTICE":
        valid = db.query(PamBasePractice).filter(
            PamBasePractice.id == target.id,
            PamBasePractice.process_id == assessment_process.pam_process_id,
        ).first()
    elif indicator_type == "WORK_PRODUCT":
        valid = (
            db.query(PamProcessWorkProduct)
            .filter(
                PamProcessWorkProduct.process_id == assessment_process.pam_process_id,
                PamProcessWorkProduct.work_product_id == target.id,
            )
            .first()
        )
    else:
        valid = (
            db.query(target_model)
            .filter(
                target_model.id == target.id,
                target_model.process_attribute_id.in_(
                    db.query(PamProcessAttribute.id)
                    .join(PamCapabilityLevel)
                    .filter(PamCapabilityLevel.framework_model_id == assessment.framework_model_id)
                )
            )
            .first()
        )
    if not valid:
        raise HTTPException(status_code=422, detail="PAM indicator is not part of the assessment process")

    existing = (
        db.query(PamIndicatorEvaluation)
        .filter(
            PamIndicatorEvaluation.assessment_process_id == assessment_process.id,
            PamIndicatorEvaluation.indicator_type == indicator_type,
            getattr(PamIndicatorEvaluation, target_field) == target.id,
        )
        .first()
    )

    if existing is None:
        existing = PamIndicatorEvaluation(
            assessment_process_id=assessment_process.id,
            indicator_type=indicator_type,
            **{target_field: target.id},
        )
        db.add(existing)

    existing.rating = payload.rating
    existing.observation = payload.observation
    existing.justification = payload.justification
    existing.status = payload.status
    existing.evaluator_user_id = current_user.id
    existing.evaluated_at = datetime.utcnow()
    assessment_process.status = "IN_PROGRESS"

    db.commit()
    db.refresh(existing)

    return _evaluation_payload(existing)
