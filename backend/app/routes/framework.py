from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user

from app.services.framework.framework_service import FrameworkService
from app.models.standards import Standard


router = APIRouter(
    prefix="/framework",
    tags=["Framework Engine"],
)


# ----------------------------------------------------------------------
# SERIALIZERS
# ----------------------------------------------------------------------

def _serialize_control(control) -> Dict[str, Any]:
    return {
        "id": control.id,
        "code": control.code,
        "title": control.title,
        "description": control.description,
        "origin": control.origin,
        "requirement_id": control.requirement_id,
        "standard_version_id": control.standard_version_id,
    }


def _serialize_practice(practice) -> Dict[str, Any]:
    return {
        "id": practice.id,
        "code": practice.code,
        "title": practice.title,
        "text": practice.text,
        "guidance": practice.guidance,
        "level": practice.level,
        "process_area_id": practice.process_area_id,
        "is_active": practice.is_active,
        "sort_order": practice.sort_order,
    }


def _serialize_requirement(requirement) -> Dict[str, Any]:
    return {
        "id": requirement.id,
        "code": requirement.code,
        "title": requirement.title,
        "description": requirement.description,
        "clause_id": requirement.clause_id,
        "controls": [
            _serialize_control(control)
            for control in requirement.controls
        ],
    }


def _serialize_clause(clause) -> Dict[str, Any]:
    return {
        "id": clause.id,
        "code": clause.code,
        "title": clause.title,
        "description": clause.description,
        "requirements": [
            _serialize_requirement(requirement)
            for requirement in clause.requirements
        ],
    }


def _serialize_process_area(process_area, practices) -> Dict[str, Any]:
    area_practices = [
        practice
        for practice in practices
        if practice.process_area_id == process_area.id
    ]

    return {
        "id": process_area.id,
        "code": process_area.code,
        "name": process_area.name,
        "description": process_area.description,
        "sort_order": process_area.sort_order,
        "practices": [
            _serialize_practice(practice)
            for practice in area_practices
        ],
    }


# ----------------------------------------------------------------------
# FRAMEWORK LIBRARY
# ----------------------------------------------------------------------

@router.get("/standards")
def list_standards(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)
    standards = service.list_standards()

    return [
        {
            "id": standard.id,
            "code": standard.code,
            "title": standard.title,
            "description": standard.description,
            "type": standard.type,
            "version": standard.version,
        }
        for standard in standards
    ]


@router.get("/standards/{standard_id}")
def get_standard(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)
    standard = service.get_standard(standard_id)

    if standard is None:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    return {
        "id": standard.id,
        "code": standard.code,
        "title": standard.title,
        "description": standard.description,
        "type": standard.type,
        "version": standard.version,
    }


# ----------------------------------------------------------------------
# VERSION MANAGEMENT
# ----------------------------------------------------------------------

@router.get("/standards/{standard_id}/versions")
def list_versions(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)

    standard = service.get_standard(standard_id)
    if standard is None:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    versions = service.list_versions(standard_id)

    return [
        {
            "id": version.id,
            "standard_id": version.standard_id,
            "version_code": version.version_code,
            "status": version.status,
            "created_at": version.created_at,
        }
        for version in versions
    ]


@router.get(
    "/standards/{standard_id}/versions/{version_code}"
)
def get_version(
    standard_id: int,
    version_code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)

    standard = service.get_standard(standard_id)
    if standard is None:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    version = service.get_version(
        standard_id=standard_id,
        version_code=version_code,
    )

    if version is None:
        raise HTTPException(
            status_code=404,
            detail="Standard version not found",
        )

    return {
        "id": version.id,
        "standard_id": version.standard_id,
        "version_code": version.version_code,
        "status": version.status,
        "created_at": version.created_at,
    }


# ----------------------------------------------------------------------
# STRUCTURE
# ----------------------------------------------------------------------

@router.get(
    "/standards/{standard_id}/versions/{version_code}/structure"
)
def get_structure(
    standard_id: int,
    version_code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)

    try:
        structure = service.get_structure(
            standard_id=standard_id,
            version_code=version_code,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    standard = structure["standard"]
    version = structure["version"]
    structure_type = structure["structure_type"]

    response: Dict[str, Any] = {
        "standard": {
            "id": standard.id,
            "code": standard.code,
            "title": standard.title,
            "description": standard.description,
            "type": standard.type,
        },
        "version": {
            "id": version.id,
            "standard_id": version.standard_id,
            "version_code": version.version_code,
            "status": version.status,
            "created_at": version.created_at,
        },
        "structure_type": structure_type,
        "clauses": [],
        "requirements": [],
        "controls": [],
        "process_areas": [],
        "practices": [],
    }

    if structure_type == "CONTROL_BASED":
        clauses = structure.get("clauses", [])
        requirements = structure.get("requirements", [])
        controls = structure.get("controls", [])

        response["clauses"] = [
            _serialize_clause(clause)
            for clause in clauses
        ]

        response["requirements"] = [
            _serialize_requirement(requirement)
            for requirement in requirements
        ]

        response["controls"] = [
            _serialize_control(control)
            for control in controls
        ]

    elif structure_type == "MATURITY_BASED":
        process_areas = structure.get("process_areas", [])
        practices = structure.get("practices", [])

        response["process_areas"] = [
            _serialize_process_area(
                process_area,
                practices,
            )
            for process_area in process_areas
        ]

        response["practices"] = [
            _serialize_practice(practice)
            for practice in practices
        ]

    return response


# ----------------------------------------------------------------------
# VALIDATION
# ----------------------------------------------------------------------

@router.post("/standards/{standard_id}/validate")
def validate_standard(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)

    standard = service.get_standard(standard_id)
    if standard is None:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    return service.validate(standard_id)


# ----------------------------------------------------------------------
# IMPORT PREVIEW
# ----------------------------------------------------------------------

@router.post("/import/preview")
def import_preview(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)

    normalized = service.normalize_import(payload)
    validation = service.validate_import(normalized)

    return {
        "normalized": normalized,
        "validation": validation,
    }


# ----------------------------------------------------------------------
# TENANT MAPPING SUMMARY
# ----------------------------------------------------------------------

@router.get("/tenants/{tenant_id}/mapping-summary")
def mapping_summary(
    tenant_id: int,
    standard_id: Optional[int] = None,
    instance_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FrameworkService(db)

    return service.mapping_summary(
        tenant_id=tenant_id,
        standard_id=standard_id,
        instance_id=instance_id,
    )

# ----------------------------------------------------------------------
# IMPORT PUBLISH
# ----------------------------------------------------------------------

@router.post("/import/publish")
def import_publish(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    from app.services.framework.framework_publish_service import (
        FrameworkPublishService,
    )

    service = FrameworkPublishService(db)

    try:
        result = service.publish_import(payload)

        if not result.get("published", False):
            return result

        return result

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Framework publish failed.",
        )

# ----------------------------------------------------------------------
# TENANT FRAMEWORK ADOPTION
# ----------------------------------------------------------------------

from datetime import datetime
from pydantic import BaseModel

from app.services.framework.framework_adoption_service import (
    FrameworkAdoptionService,
)


class FrameworkAdoptionCreate(BaseModel):
    standard_id: int
    standard_version_id: int
    applicability: str = "APPLICABLE"
    effective_date: Optional[datetime] = None


class FrameworkAdoptionUpdate(BaseModel):
    applicability: Optional[str] = None
    effective_date: Optional[datetime] = None


class FrameworkAdoptionScopeCreate(BaseModel):
    process_id: int


class FrameworkAdoptionTransition(BaseModel):
    status: str


def _adoption_payload(
    service: FrameworkAdoptionService,
    adoption,
):
    return service._serialize(adoption)


@router.get("/adoptions")
def list_adoptions(
    standard_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        adoptions = service.list(
            tenant_id=tenant_id,
            standard_id=standard_id,
            status=status,
        )

        return [
            _adoption_payload(service, adoption)
            for adoption in adoptions
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.get("/adoptions/{adoption_id}")
def get_adoption(
    adoption_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    adoption = service.get(
        tenant_id=tenant_id,
        adoption_id=adoption_id,
    )

    if adoption is None:
        raise HTTPException(
            status_code=404,
            detail="Framework adoption not found",
        )

    return _adoption_payload(service, adoption)


@router.get("/standards/{standard_id}/adoption")
def get_standard_adoption(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    standard = service.db.query(Standard).filter(
        Standard.id == standard_id
    ).first()

    if standard is None:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    adoptions = service.list(
        tenant_id=tenant_id,
        standard_id=standard_id,
    )

    return [
        _adoption_payload(service, adoption)
        for adoption in adoptions
    ]


@router.post("/adoptions")
def create_adoption(
    payload: FrameworkAdoptionCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        adoption = service.create(
            tenant_id=tenant_id,
            standard_id=payload.standard_id,
            standard_version_id=payload.standard_version_id,
            applicability=payload.applicability,
            effective_date=payload.effective_date,
            created_by=getattr(user, "id", None),
        )

        return _adoption_payload(service, adoption)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.patch("/adoptions/{adoption_id}")
def update_adoption(
    adoption_id: int,
    payload: FrameworkAdoptionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        adoption = service.update(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
            applicability=payload.applicability,
            effective_date=payload.effective_date,
        )

        return _adoption_payload(service, adoption)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.post("/adoptions/{adoption_id}/scope")
def add_adoption_scope(
    adoption_id: int,
    payload: FrameworkAdoptionScopeCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        service.add_scope(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
            process_id=payload.process_id,
        )

        adoption = service.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        return _adoption_payload(service, adoption)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.delete(
    "/adoptions/{adoption_id}/scope/{process_id}"
)
def remove_adoption_scope(
    adoption_id: int,
    process_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        service.remove_scope(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
            process_id=process_id,
        )

        adoption = service.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        return _adoption_payload(service, adoption)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.post(
    "/adoptions/{adoption_id}/transition"
)
def transition_adoption(
    adoption_id: int,
    payload: FrameworkAdoptionTransition,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        adoption = service.transition(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
            target_status=payload.status,
            user_id=getattr(user, "id", None),
        )

        return _adoption_payload(service, adoption)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.get(
    "/adoptions/{adoption_id}/resolved"
)
def get_resolved_adoption(
    adoption_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    service = FrameworkAdoptionService(db)

    try:
        return service.resolved(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )
