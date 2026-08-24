from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db

from app.models.department import Department
from app.models.user import User


router = APIRouter(
    prefix="/company/departments",
    tags=["Company Departments"],
)


def department_response(department):

    return {
        "id": department.id,
        "tenant_id": department.tenant_id,
        "organization_id": department.organization_id,
        "name": department.name,
        "code": department.code,
        "description": department.description,
        "manager_id": department.manager_id,
        "status": department.status,
        "created_by": department.created_by,
        "created_at": department.created_at,
        "updated_at": department.updated_at,
    }


@router.get("")
def list_departments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(Department)
        .where(
            Department.tenant_id == user.tenant_id
        )
        .order_by(
            Department.name,
            Department.id,
        )
    )

    departments = db.execute(stmt).scalars().all()

    return [
        department_response(item)
        for item in departments
    ]


@router.get("/{department_id}")
def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Department).where(
        Department.id == department_id,
        Department.tenant_id == user.tenant_id,
    )

    department = db.execute(stmt).scalar_one_or_none()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    return department_response(department)


@router.post("")
def create_department(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    name = str(
        payload.get("name", "")
    ).strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Department name is required",
        )

    department = Department(
        tenant_id=user.tenant_id,
        organization_id=payload.get(
            "organization_id"
        ),
        name=name,
        code=payload.get("code"),
        description=payload.get("description"),
        manager_id=payload.get("manager_id"),
        status=payload.get(
            "status",
            "ACTIVE",
        ),
        created_by=payload.get(
            "created_by"
        ),
    )

    db.add(department)
    db.commit()
    db.refresh(department)

    return department_response(department)


@router.put("/{department_id}")
def update_department(
    department_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Department).where(
        Department.id == department_id,
        Department.tenant_id == user.tenant_id,
    )

    department = db.execute(stmt).scalar_one_or_none()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    for field in [
        "organization_id",
        "name",
        "code",
        "description",
        "manager_id",
        "status",
    ]:
        if field in payload:
            setattr(
                department,
                field,
                payload[field],
            )

    department.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(department)

    return department_response(department)


@router.delete("/{department_id}")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Department).where(
        Department.id == department_id,
        Department.tenant_id == user.tenant_id,
    )

    department = db.execute(stmt).scalar_one_or_none()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    db.delete(department)
    db.commit()

    return {
        "message": "Department deleted successfully"
    }
